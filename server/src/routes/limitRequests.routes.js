import express from 'express';
import { query, withTransaction } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { refreshOmsConfig } from '../services/rmsConfigCache.service.js';

const router = express.Router();

router.use(authenticate);

// Same field list oms-config.routes.js accepts - kept in sync manually since the two live in
// different runtimes (client vs server); a request for anything else is rejected outright,
// not silently accepted and later failing to apply.
const VALID_FIELDS = [
  'max_order_quantity', 'max_order_value', 'price_band_pct', 'bad_trade_price_pct',
  'max_open_order_value', 'max_position_qty', 'max_exposure_value', 'global_exposure_value',
  'max_turnover_value', 'global_turnover_value', 'max_open_orders_count', 'max_orders_per_second'
];

// POST /api/limit-requests - PM submits a proposed change to a global RMS limit. Snapshots
// the current value at submission time so a reviewer can see exactly what was being asked
// for relative to what was true then, even if the config has since changed again.
router.post('/', authorize('PM'), async (req, res) => {
  try {
    const { fieldKey, requestedValue, reason } = req.body;
    if (!VALID_FIELDS.includes(fieldKey)) {
      return res.status(400).json({ message: 'Unknown field for a limit change request' });
    }
    const numericValue = Number(requestedValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return res.status(400).json({ message: 'Requested value must be a positive number' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'A reason is required' });
    }

    const configResult = await query('SELECT * FROM oms_config WHERE id = 1');
    const currentValue = configResult.rows[0][fieldKey];

    const result = await query(
      `INSERT INTO limit_change_requests (requested_by, field_key, current_value, requested_value, reason)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.userId, fieldKey, currentValue, numericValue, reason.trim()]
    );

    await logAudit(req.user.userId, 'LIMIT_REQUEST_SUBMITTED', fieldKey,
      `Requested ${fieldKey}: ${currentValue} -> ${numericValue}. Reason: ${reason.trim()}`);

    res.status(201).json({ message: 'Request submitted', request: result.rows[0] });
  } catch (error) {
    console.error('Submit Limit Request Error:', error);
    res.status(500).json({ message: 'Internal server error submitting limit request' });
  }
});

// GET /api/limit-requests - a PM sees only their own requests; RMS Admin/Super Admin/Company
// Account see every request, since reviewing is their job.
router.get('/', async (req, res) => {
  try {
    const isReviewer = ['RMS_ADMIN', 'SUPER_ADMIN', 'COMPANY_ACCOUNT'].includes(req.user.role);
    const result = isReviewer
      ? await query('SELECT * FROM limit_change_requests ORDER BY created_at DESC')
      : await query('SELECT * FROM limit_change_requests WHERE requested_by = $1 ORDER BY created_at DESC', [req.user.userId]);
    res.status(200).json({ requests: result.rows });
  } catch (error) {
    console.error('Fetch Limit Requests Error:', error);
    res.status(500).json({ message: 'Internal server error fetching limit requests' });
  }
});

// PUT /api/limit-requests/:id/approve - RMS Admin ONLY (same edit-rights restriction as
// PUT /api/oms-config directly). Approving actually applies requested_value to oms_config in
// the same transaction as marking the request APPROVED, so the two can never disagree.
router.put('/:id/approve', authorize('RMS_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const pending = await query(`SELECT * FROM limit_change_requests WHERE id = $1 AND status = 'PENDING'`, [id]);
    if (pending.rows.length === 0) {
      return res.status(404).json({ message: 'No pending request found with that id' });
    }
    const { field_key: fieldKey, requested_value: requestedValue } = pending.rows[0];

    const updated = await withTransaction(async (client) => {
      await client.query(`UPDATE oms_config SET ${fieldKey} = $1, updated_by = $2, updated_at = NOW() WHERE id = 1`, [requestedValue, req.user.userId]);
      return client.query(
        `UPDATE limit_change_requests SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2 RETURNING *`,
        [req.user.userId, id]
      );
    });

    await refreshOmsConfig();
    await logAudit(req.user.userId, 'LIMIT_REQUEST_APPROVED', fieldKey, `Approved: ${fieldKey} -> ${requestedValue}`);
    res.status(200).json({ message: 'Request approved and applied', request: updated.rows[0] });
  } catch (error) {
    console.error('Approve Limit Request Error:', error);
    res.status(500).json({ message: 'Internal server error approving limit request' });
  }
});

// PUT /api/limit-requests/:id/reject - RMS Admin ONLY. Never touches oms_config.
router.put('/:id/reject', authorize('RMS_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const result = await query(
      `UPDATE limit_change_requests SET status = 'REJECTED', reviewed_by = $1, review_note = $2, reviewed_at = NOW()
       WHERE id = $3 AND status = 'PENDING' RETURNING *`,
      [req.user.userId, note || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No pending request found with that id' });
    }
    await logAudit(req.user.userId, 'LIMIT_REQUEST_REJECTED', result.rows[0].field_key, note || 'No note given');
    res.status(200).json({ message: 'Request rejected', request: result.rows[0] });
  } catch (error) {
    console.error('Reject Limit Request Error:', error);
    res.status(500).json({ message: 'Internal server error rejecting limit request' });
  }
});

export default router;

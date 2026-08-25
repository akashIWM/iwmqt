import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

// View access: RMS Admin, Super Admin, Company Account (all view-only except RMS Admin).
router.use(authenticate, authorize('RMS_ADMIN', 'SUPER_ADMIN', 'COMPANY_ACCOUNT'));

// GET /api/oms-config - current risk limits, plus best-effort current utilisation per
// control (spec 6.2 wants a "current utilisation" column on the RMS Limits grid). Utilisation
// for user-scoped limits is the worst case across all users right now (most actionable single
// number for an admin); price/quantity/order-value/OPS controls are evaluated per-order, not
// as a running total, so they have no meaningful utilisation figure at all - left null.
router.get('/', async (req, res) => {
  try {
    const configResult = await query('SELECT * FROM oms_config WHERE id = 1');
    const utilisationResult = await query(`
      SELECT
        (SELECT COALESCE(MAX(v), 0) FROM (SELECT SUM(quantity * price) AS v FROM orders WHERE status = 'PENDING' GROUP BY user_id) t1) AS max_open_order_value_used,
        (SELECT COALESCE(MAX(v), 0) FROM (SELECT ABS(SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END)) AS v FROM orders WHERE status IN ('EXECUTED', 'PENDING') GROUP BY user_id, symbol) t2) AS max_position_qty_used,
        (SELECT COALESCE(MAX(v), 0) FROM (SELECT SUM(quantity * price) AS v FROM orders WHERE status IN ('PENDING', 'EXECUTED') GROUP BY user_id) t3) AS max_exposure_value_used,
        (SELECT COALESCE(SUM(quantity * price), 0) FROM orders WHERE status IN ('PENDING', 'EXECUTED')) AS global_exposure_value_used,
        (SELECT COALESCE(MAX(v), 0) FROM (SELECT SUM(quantity * price) AS v FROM orders WHERE status = 'EXECUTED' GROUP BY user_id) t4) AS max_turnover_value_used,
        (SELECT COALESCE(MAX(v), 0) FROM (SELECT COUNT(*) AS v FROM orders WHERE status = 'PENDING' GROUP BY user_id) t5) AS max_open_orders_count_used
    `);

    res.status(200).json({ config: configResult.rows[0], utilisation: utilisationResult.rows[0] });
  } catch (error) {
    console.error('Fetch OMS Config Error:', error);
    res.status(500).json({ message: 'Internal server error fetching OMS configuration' });
  }
});

// Field name (request body / DB column) -> validation label. All must be positive numbers.
const NUMERIC_FIELDS = [
  'max_order_quantity',
  'max_order_value',
  'price_band_pct',
  'max_open_order_value',
  'max_position_qty',
  'max_exposure_value',
  'global_exposure_value',
  'max_turnover_value',
  'max_open_orders_count',
  'max_orders_per_second'
];

// PUT /api/oms-config - update risk limits (all 14-control global defaults live here).
// Spec 2.1: edit rights are RMS Admin ONLY - Super Admin/Company Account are view-only.
router.put('/', authorize('RMS_ADMIN'), async (req, res) => {
  try {
    const values = {};
    for (const field of NUMERIC_FIELDS) {
      const value = Number(req.body[field]);
      if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({ message: `${field} must be a positive number` });
      }
      values[field] = value;
    }

    const setClause = NUMERIC_FIELDS.map((field, i) => `${field} = $${i + 1}`).join(', ');
    const result = await query(
      `UPDATE oms_config SET ${setClause}, updated_by = $${NUMERIC_FIELDS.length + 1}, updated_at = NOW()
       WHERE id = 1 RETURNING *`,
      [...NUMERIC_FIELDS.map((field) => values[field]), req.user.userId]
    );

    await logAudit(
      req.user.userId,
      'OMS_CONFIG_UPDATE',
      'oms_config',
      NUMERIC_FIELDS.map((field) => `${field}=${values[field]}`).join(', ')
    );

    res.status(200).json({ message: 'OMS configuration updated', config: result.rows[0] });
  } catch (error) {
    console.error('Update OMS Config Error:', error);
    res.status(500).json({ message: 'Internal server error updating OMS configuration' });
  }
});

export default router;

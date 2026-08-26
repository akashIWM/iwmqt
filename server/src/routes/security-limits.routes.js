import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { refreshSecurityLimits } from '../services/rmsConfigCache.service.js';

const router = express.Router();

router.use(authenticate, authorize('RMS_ADMIN', 'SUPER_ADMIN', 'COMPANY_ACCOUNT'));

// GET /api/security-limits - list all configured per-security limits
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM security_limits ORDER BY created_at DESC');
    res.status(200).json({ limits: result.rows });
  } catch (error) {
    console.error('Fetch Security Limits Error:', error);
    res.status(500).json({ message: 'Internal server error fetching security limits' });
  }
});

// PUT /api/security-limits/:symbol - set (or update) a security's limit
router.put('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.trim().toUpperCase();
    const maxQty = Number(req.body.maxQty);
    const maxValue = Number(req.body.maxValue);

    if (!Number.isFinite(maxQty) || maxQty <= 0) return res.status(400).json({ message: 'maxQty must be a positive number' });
    if (!Number.isFinite(maxValue) || maxValue <= 0) return res.status(400).json({ message: 'maxValue must be a positive number' });

    const result = await query(
      `INSERT INTO security_limits (symbol, max_qty, max_value, set_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (symbol) DO UPDATE SET max_qty = $2, max_value = $3, set_by = $4 RETURNING *`,
      [symbol, maxQty, maxValue, req.user.userId]
    );

    await refreshSecurityLimits();
    await logAudit(req.user.userId, 'SECURITY_LIMIT_SET', symbol, `max_qty=${maxQty}, max_value=${maxValue}`);
    res.status(200).json({ message: `Limit set for ${symbol}`, limit: result.rows[0] });
  } catch (error) {
    console.error('Set Security Limit Error:', error);
    res.status(500).json({ message: 'Internal server error setting security limit' });
  }
});

// DELETE /api/security-limits/:symbol - remove a security's limit
router.delete('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.trim().toUpperCase();
    await query('DELETE FROM security_limits WHERE symbol = $1', [symbol]);
    await refreshSecurityLimits();
    await logAudit(req.user.userId, 'SECURITY_LIMIT_REMOVED', symbol, null);
    res.status(200).json({ message: `Limit removed for ${symbol}` });
  } catch (error) {
    console.error('Remove Security Limit Error:', error);
    res.status(500).json({ message: 'Internal server error removing security limit' });
  }
});

export default router;

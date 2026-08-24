import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

router.use(authenticate, authorize('RMS_ADMIN', 'SUPER_ADMIN', 'COMPANY_ACCOUNT'));

// GET /api/oms-config - current risk limits
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM oms_config WHERE id = 1');
    res.status(200).json({ config: result.rows[0] });
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

// PUT /api/oms-config - update risk limits (all 14-control global defaults live here)
router.put('/', async (req, res) => {
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

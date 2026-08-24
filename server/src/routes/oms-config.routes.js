import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

router.use(authenticate, authorize('RMS_ADMIN', 'SUPER_ADMIN'));

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

// PUT /api/oms-config - update risk limits
router.put('/', async (req, res) => {
  try {
    const maxOrderQuantity = Number(req.body.max_order_quantity);
    const maxOrderValue = Number(req.body.max_order_value);

    if (!Number.isFinite(maxOrderQuantity) || maxOrderQuantity <= 0) {
      return res.status(400).json({ message: 'max_order_quantity must be a positive number' });
    }
    if (!Number.isFinite(maxOrderValue) || maxOrderValue <= 0) {
      return res.status(400).json({ message: 'max_order_value must be a positive number' });
    }

    const result = await query(
      `UPDATE oms_config SET max_order_quantity = $1, max_order_value = $2, updated_by = $3, updated_at = NOW()
       WHERE id = 1 RETURNING *`,
      [maxOrderQuantity, maxOrderValue, req.user.userId]
    );

    await logAudit(
      req.user.userId,
      'OMS_CONFIG_UPDATE',
      'oms_config',
      `max_order_quantity=${maxOrderQuantity}, max_order_value=${maxOrderValue}`
    );

    res.status(200).json({ message: 'OMS configuration updated', config: result.rows[0] });
  } catch (error) {
    console.error('Update OMS Config Error:', error);
    res.status(500).json({ message: 'Internal server error updating OMS configuration' });
  }
});

export default router;

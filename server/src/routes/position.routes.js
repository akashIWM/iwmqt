import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { getLtp, getExpiry } from '../services/marketData.service.js';

const router = express.Router();

// GET /api/positions - Calculate net positions from executed or active orders.
// RMS/Super Admin see aggregated positions across all users; everyone else sees only their own.
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const isRmsRole = req.user.role === 'RMS_ADMIN' || req.user.role === 'SUPER_ADMIN';

    const positionsQuery = isRmsRole
      ? await query(
          `SELECT
             symbol,
             SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) as net_qty,
             AVG(price) as avg_price
           FROM orders
           WHERE status = 'EXECUTED'
           GROUP BY symbol
           HAVING SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) <> 0`
        )
      : await query(
          `SELECT
             symbol,
             SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) as net_qty,
             AVG(price) as avg_price
           FROM orders
          WHERE user_id = $1 AND status = 'EXECUTED'
           GROUP BY symbol
           HAVING SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) <> 0`,
          [userId]
        );

    // Mark-to-market against the live mock LTP; null when the symbol has no live quote.
    const positions = positionsQuery.rows.map((row) => {
      const ltp = getLtp(row.symbol);
      const netQty = Number(row.net_qty);
      const avgPrice = Number(row.avg_price);
      const pnl = ltp !== null ? (ltp - avgPrice) * netQty : null;
      return { ...row, ltp, pnl, expiry: getExpiry(row.symbol) };
    });

    res.status(200).json({ positions });
  } catch (error) {
    console.error('Positions Error:', error);
    res.status(500).json({ message: 'Internal server error fetching positions' });
  }
});

export default router;
import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { getLtp, getExpiry } from '../services/marketData.service.js';
import { scopeByRole } from '../utils/visibility.js';

const router = express.Router();

// GET /api/positions - Calculate net positions from fills.
// RMS/Super Admin see everyone's; PM sees their desk's; everyone else sees only their own.
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { clause, params } = scopeByRole(req.user.role, userId);

    // Computed from fills (the immutable execution record), not from orders.status =
    // 'EXECUTED' - a partially filled order's fills count toward the position even though
    // the order row itself is still PARTIALLY_FILLED (or later CANCELLED for the remainder).
    // avg_price is quantity-weighted across fills (not a plain AVG(price)), so a mix of
    // small and large fills at different prices is represented proportionally - still a
    // simplification versus true FIFO cost-basis accounting, but a meaningfully more
    // correct one than before.
    // Grouped by (user_id, symbol) rather than symbol alone, even for the RMS/Super Admin
    // view - collapsing across users would erase per-trader ("OMS-wise") visibility, which
    // the spec requires the Net Positions grid to support.
    const positionsQuery = await query(
      `SELECT
         user_id, symbol,
         SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) as net_qty,
         SUM(quantity * price) / SUM(quantity) as avg_price
       FROM fills
       WHERE ${clause}
       GROUP BY user_id, symbol
       HAVING SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) <> 0`,
      params
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
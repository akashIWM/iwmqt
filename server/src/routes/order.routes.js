import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { getExpiry, getToken } from '../services/marketData.service.js';
import { opsRateLimit } from '../middleware/opsRateLimit.middleware.js';
import { pushOrderUpdate } from '../services/wsHub.service.js';
import { scopeByRole } from '../utils/visibility.js';
import { placeOrderForUser } from '../services/orderPlacement.service.js';

const router = express.Router();

// GET /api/orders - RMS/Super Admin see everyone's orders, PM sees their desk's, everyone
// else sees only their own.
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { clause, params } = scopeByRole(req.user.role, userId, 'o.user_id');

    const userOrders = await query(
      `SELECT o.*, u.pan, u.nnf_id, u.neat_id FROM orders o
       JOIN users u ON u.user_id = o.user_id
       WHERE ${clause} ORDER BY o.created_at DESC LIMIT 200`,
      params
    );

    const orders = userOrders.rows.map((row) => ({ ...row, expiry: getExpiry(row.symbol), token: getToken(row.symbol) }));

    res.status(200).json({ orders });
  } catch (error) {
    console.error('Fetch Orders Error:', error);
    res.status(500).json({ message: 'Internal server error fetching orders' });
  }
});

// GET /api/orders/events - rolling buffer of order lifecycle events (Order Logs grid).
// Same visibility split as GET /.
router.get('/events', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { clause, params } = scopeByRole(req.user.role, userId);

    const events = await query(
      `SELECT * FROM order_events WHERE ${clause} ORDER BY created_at DESC LIMIT 200`,
      params
    );

    res.status(200).json({ events: events.rows });
  } catch (error) {
    console.error('Fetch Order Events Error:', error);
    res.status(500).json({ message: 'Internal server error fetching order events' });
  }
});

// GET /api/orders/fills - Trade Book source: one row per actual fill (not per order), so
// a partially filled order that filled in several slices shows each slice separately.
// Same visibility split as GET / and /events.
router.get('/fills', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { clause, params } = scopeByRole(req.user.role, userId);

    const fills = await query(
      `SELECT * FROM fills WHERE ${clause} ORDER BY created_at DESC LIMIT 200`,
      params
    );

    const enriched = fills.rows.map((row) => ({ ...row, token: getToken(row.symbol) }));
    res.status(200).json({ fills: enriched });
  } catch (error) {
    console.error('Fetch Fills Error:', error);
    res.status(500).json({ message: 'Internal server error fetching fills' });
  }
});

// POST /api/orders/place
// Spec: order entry is Trader-only - RMS Admin/PM/Company Account/Super Admin must not be able to place orders.
// All 14-control RMS logic lives in orderPlacement.service.js now (placeOrderForUser) - this
// route is a thin HTTP wrapper around it, so the multi-leg strategy engine can call the exact
// same checked placement function directly without a self-referential HTTP round trip.
router.post('/place', authenticate, authorize('TRADER'), opsRateLimit, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const result = await placeOrderForUser(userId, req.body);
    if (!result.ok) return res.status(result.status).json({ message: result.message });
    res.status(result.status).json({ message: 'Order placed successfully', order: result.order });
  } catch (error) {
    console.error('OMS Error:', error);
    res.status(500).json({ message: 'Internal server error processing order' });
  }
});

// PUT /api/orders/:id/cancel - Cancel a pending order
router.put('/:id/cancel', authenticate, authorize('TRADER'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    // A partially filled order can still be cancelled - that stops any further fills on
    // the remaining quantity, while the fills already recorded stay exactly as they are.
    const result = await query(
      `UPDATE orders SET status = 'CANCELLED' WHERE id = $1 AND user_id = $2 AND status IN ('PENDING', 'PARTIALLY_FILLED') RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found or cannot be cancelled (already executed/cancelled)' });
    }

    const cancelled = result.rows[0];
    const remainingQty = Number(cancelled.quantity) - Number(cancelled.filled_quantity);
    await query(
      `INSERT INTO order_events (order_id, user_id, symbol, order_type, quantity, price, event)
       VALUES ($1, $2, $3, $4, $5, $6, 'CANCELLED')`,
      [cancelled.id, cancelled.user_id, cancelled.symbol, cancelled.type, remainingQty, cancelled.price]
    );

    pushOrderUpdate(cancelled.user_id, cancelled);

    res.status(200).json({ message: 'Order cancelled successfully', order: cancelled });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    res.status(500).json({ message: 'Internal server error cancelling order' });
  }
});

export default router;

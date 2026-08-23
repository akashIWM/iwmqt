import express from 'express';
import { query } from '../db/postgres.js'; 
import { authenticate } from '../middleware/auth.middleware.js'; 
import { validateOrder } from '../utils/validators.js';

const router = express.Router();

// GET /api/orders - Fetch all orders for the logged-in user
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const userOrders = await query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    res.status(200).json({ orders: userOrders.rows });
  } catch (error) {
    console.error('Fetch Orders Error:', error);
    res.status(500).json({ message: 'Internal server error fetching orders' });
  }
});

// POST /api/orders/place
router.post('/place', authenticate, async (req, res) => {
  try {
    const { symbol, side, type, quantity, price } = req.body;
    const userId = req.user.userId || req.user.id; 
    const validationError = validateOrder(req.body);

    if (validationError) return res.status(400).json({ message: validationError });

    // --- RMS PRE-TRADE CHECK ---
    // Check if the symbol is in the banned_scripts table
    const normalizedSymbol = symbol.trim().toUpperCase();
    const banCheck = await query('SELECT * FROM banned_scripts WHERE symbol = $1', [normalizedSymbol]);
    
    if (banCheck.rows.length > 0) {
      return res.status(400).json({ 
        message: `Order Rejected: ${symbol} is currently BANNED by RMS risk controls. Reason: ${banCheck.rows[0].reason}` 
      });
    }
    // --- END RMS CHECK ---

    const newOrder = await query(
      `INSERT INTO orders (user_id, symbol, side, type, quantity, price, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING *`,
      [userId, normalizedSymbol, side, type, quantity, price || null]
    );

    res.status(201).json({ 
      message: 'Order placed successfully', 
      order: newOrder.rows[0] 
    });
  } catch (error) {
    console.error('OMS Error:', error);
    res.status(500).json({ message: 'Internal server error processing order' });
  }
});

// PUT /api/orders/:id/cancel - Cancel a pending order
router.put('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    const result = await query(
      `UPDATE orders SET status = 'CANCELLED' WHERE id = $1 AND user_id = $2 AND status = 'PENDING' RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found or cannot be cancelled (already executed/cancelled)' });
    }

    res.status(200).json({ message: 'Order cancelled successfully', order: result.rows[0] });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    res.status(500).json({ message: 'Internal server error cancelling order' });
  }
});

export default router;
import express from 'express';
import { query } from '../db/postgres.js'; 
// 1. Swapped verifyToken to authenticate
import { authenticate } from '../middleware/auth.middleware.js'; 

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

// 2. Applied authenticate to the route
router.post('/place', authenticate, async (req, res) => {
  try {
    const { symbol, side, type, quantity, price } = req.body;
    
    // In your JWT payload, double-check if your user ID is stored as `id` or `userId`. 
    // Usually it's `userId` from earlier, but if this errors later, it might just be `req.user.id`.
    const userId = req.user.userId || req.user.id; 

    const newOrder = await query(
      `INSERT INTO orders (user_id, symbol, side, type, quantity, price, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING *`,
      [userId, symbol, side, type, quantity, price || null]
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

export default router;
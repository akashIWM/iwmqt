import express from 'express';
import { query } from '../db/postgres.js';
import { getAllUsers, updateUserRole, updateUserStatus } from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/admin/stats - System-wide metrics for Admin Dashboard
router.get('/stats', authenticate, authorize('ADMIN', 'RMS', 'SUPER_ADMIN', 'RMS_ADMIN'), async (req, res) => {
  try {
    const totalOrders = await query('SELECT COUNT(*) FROM orders');
    const totalUsers = await query('SELECT COUNT(*) FROM users');
    const bannedCount = await query('SELECT COUNT(*) FROM banned_scripts');
    const recentOrders = await query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10');

    res.status(200).json({
      stats: {
        totalOrders: parseInt(totalOrders.rows[0].count),
        totalUsers: parseInt(totalUsers.rows[0].count),
        bannedScriptsCount: parseInt(bannedCount.rows[0].count),
      },
      recentOrders: recentOrders.rows
    });
  } catch (error) {
    console.error('Admin Stats Error:', error);
    res.status(500).json({ message: 'Internal server error fetching admin stats' });
  }
});

// Apply the bouncer to ALL routes in this file
router.use(authenticate, authorize('SUPER_ADMIN'));

// The actual API endpoints
router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', updateUserStatus);

export default router;
import express from 'express';
import { query } from '../db/postgres.js';
import { getAllUsers, createUser, updateUserRole, updateUserStatus, resetUserPassword } from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/admin/stats - System-wide metrics for Admin Dashboard
router.get('/stats', authenticate, authorize('ADMIN', 'RMS', 'SUPER_ADMIN', 'RMS_ADMIN', 'COMPANY_ACCOUNT', 'PM'), async (req, res) => {
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
router.use(authenticate, authorize('RMS_ADMIN', 'SUPER_ADMIN', 'COMPANY_ACCOUNT'));

// The actual API endpoints
router.get('/users', getAllUsers);
// User creation is Super Admin (global) / Company Account (own entity) only - not RMS Admin.
router.post('/users', authorize('SUPER_ADMIN', 'COMPANY_ACCOUNT'), createUser);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', updateUserStatus);
router.post('/users/:id/reset-password', resetUserPassword);

export default router;
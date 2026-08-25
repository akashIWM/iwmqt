import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/audit-log?limit= - recent RMS/admin actions, newest first
router.get('/', authenticate, authorize('RMS_ADMIN', 'SUPER_ADMIN', 'COMPANY_ACCOUNT'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    // LEFT JOIN, not JOIN: actor_user_id is nullable (ON DELETE SET NULL) and a deleted
    // actor's row must still show up in the log rather than silently vanishing.
    const result = await query(
      `SELECT a.*, u.role AS actor_role FROM audit_log a
       LEFT JOIN users u ON u.user_id = a.actor_user_id
       ORDER BY a.created_at DESC LIMIT $1`,
      [limit]
    );
    res.status(200).json({ entries: result.rows });
  } catch (error) {
    console.error('Fetch Audit Log Error:', error);
    res.status(500).json({ message: 'Internal server error fetching audit log' });
  }
});

export default router;

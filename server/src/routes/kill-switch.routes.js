import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { refreshKillSwitches } from '../services/rmsConfigCache.service.js';

const router = express.Router();

router.use(authenticate, authorize('RMS_ADMIN', 'SUPER_ADMIN', 'COMPANY_ACCOUNT'));

// GET /api/kill-switch - current global + per-user halt state
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM kill_switches ORDER BY activated_at DESC');
    res.status(200).json({ switches: result.rows });
  } catch (error) {
    console.error('Fetch Kill Switches Error:', error);
    res.status(500).json({ message: 'Internal server error fetching kill switches' });
  }
});

// POST /api/kill-switch/global - halt all new order placement platform-wide
router.post('/global', async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await query(
      `INSERT INTO kill_switches (scope, reason, activated_by) VALUES ('GLOBAL', $1, $2)
       ON CONFLICT (scope) WHERE scope = 'GLOBAL' DO UPDATE SET reason = $1 RETURNING *`,
      [reason || 'Manual RMS halt', req.user.userId]
    );
    await refreshKillSwitches();
    await logAudit(req.user.userId, 'KILL_SWITCH_GLOBAL_ON', 'GLOBAL', reason || null);
    res.status(201).json({ message: 'Global trading halt activated', switch: result.rows[0] });
  } catch (error) {
    console.error('Global Kill Switch Error:', error);
    res.status(500).json({ message: 'Internal server error activating global kill switch' });
  }
});

// DELETE /api/kill-switch/global - lift the global halt
router.delete('/global', async (req, res) => {
  try {
    await query(`DELETE FROM kill_switches WHERE scope = 'GLOBAL'`);
    await refreshKillSwitches();
    await logAudit(req.user.userId, 'KILL_SWITCH_GLOBAL_OFF', 'GLOBAL', null);
    res.status(200).json({ message: 'Global trading halt lifted' });
  } catch (error) {
    console.error('Global Kill Switch Error:', error);
    res.status(500).json({ message: 'Internal server error lifting global kill switch' });
  }
});

// POST /api/kill-switch/user/:userId - suspend trading for one user
router.post('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const result = await query(
      `INSERT INTO kill_switches (scope, target_user_id, reason, activated_by) VALUES ('USER', $1, $2, $3)
       ON CONFLICT (target_user_id) WHERE scope = 'USER' DO UPDATE SET reason = $2 RETURNING *`,
      [userId, reason || 'Manual RMS suspension', req.user.userId]
    );
    await refreshKillSwitches();
    await logAudit(req.user.userId, 'KILL_SWITCH_USER_ON', userId, reason || null);
    res.status(201).json({ message: `Trading suspended for ${userId}`, switch: result.rows[0] });
  } catch (error) {
    console.error('User Kill Switch Error:', error);
    res.status(500).json({ message: 'Internal server error suspending user' });
  }
});

// DELETE /api/kill-switch/user/:userId - resume trading for one user
router.delete('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await query(`DELETE FROM kill_switches WHERE scope = 'USER' AND target_user_id = $1`, [userId]);
    await refreshKillSwitches();
    await logAudit(req.user.userId, 'KILL_SWITCH_USER_OFF', userId, null);
    res.status(200).json({ message: `Trading resumed for ${userId}` });
  } catch (error) {
    console.error('User Kill Switch Error:', error);
    res.status(500).json({ message: 'Internal server error resuming user' });
  }
});

export default router;

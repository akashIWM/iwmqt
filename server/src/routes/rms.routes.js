import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

// GET /api/rms/banned - Fetch all currently banned scripts
router.get('/banned', authenticate, async (req, res) => {
  try {
    const banned = await query('SELECT * FROM banned_scripts ORDER BY banned_at DESC');
    res.status(200).json({ bannedScripts: banned.rows });
  } catch (error) {
    console.error('Fetch Banned Scripts Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rms/ban - RMS Admin can ban a script
router.post('/ban', authenticate, authorize('RMS_ADMIN', 'SUPER_ADMIN', 'COMPANY_ACCOUNT'), async (req, res) => {
  try {
    const { symbol, reason, asmStage, gsmStage } = req.body;
    const result = await query(
      `INSERT INTO banned_scripts (symbol, reason, asm_stage, gsm_stage) VALUES ($1, $2, $3, $4)
       ON CONFLICT (symbol) DO UPDATE SET reason = $2, asm_stage = $3, gsm_stage = $4 RETURNING *`,
      [symbol, reason || 'Volatility Limit Reached', asmStage || null, gsmStage || null]
    );
    await logAudit(req.user.userId, 'BAN_SCRIPT', symbol, reason || null);
    res.status(201).json({ message: `Script ${symbol} banned successfully`, ban: result.rows[0] });
  } catch (error) {
    console.error('Ban Script Error:', error);
    res.status(500).json({ message: 'Internal server error banning script' });
  }
});

// DELETE /api/rms/unban/:symbol - Unban a script
router.delete('/unban/:symbol', authenticate, authorize('RMS_ADMIN', 'SUPER_ADMIN', 'COMPANY_ACCOUNT'), async (req, res) => {
  try {
    const { symbol } = req.params;
    await query('DELETE FROM banned_scripts WHERE symbol = $1', [symbol]);
    await logAudit(req.user.userId, 'UNBAN_SCRIPT', symbol, null);
    res.status(200).json({ message: `Script ${symbol} unbanned successfully` });
  } catch (error) {
    console.error('Unban Error:', error);
    res.status(500).json({ message: 'Internal server error unbanning script' });
  }
});

export default router;
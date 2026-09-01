import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { refreshBannedScripts } from '../services/rmsConfigCache.service.js';
import { scopeByRole } from '../utils/visibility.js';

const router = express.Router();

// GET /api/rms/desk-utilisation - per-trader limit utilisation for a PM's own desk (spec
// 2.1: "per-trader limit utilisation view (read-only)"). Same underlying formulas as the
// admin OMS Config panel's utilisation query (open value from `orders`, position/turnover
// from `fills`), just grouped per-trader instead of collapsed to a platform-wide worst case -
// a PM needs to see which specific trader is near a limit, not just that someone is.
router.get('/desk-utilisation', authenticate, authorize('PM'), async (req, res) => {
  try {
    const { clause, params } = scopeByRole('PM', req.user.userId, 'u.user_id');
    const configResult = await query('SELECT * FROM oms_config WHERE id = 1');

    const tradersResult = await query(
      `SELECT
         u.user_id, u.full_name,
         COALESCE(oo.open_value, 0) AS open_order_value,
         COALESCE(oo.open_count, 0) AS open_orders_count,
         COALESCE(pos.position_qty, 0) AS position_qty,
         COALESCE(oo.open_value, 0) + COALESCE(f.executed_value, 0) AS exposure_value,
         COALESCE(f.executed_value, 0) AS turnover_value
       FROM users u
       LEFT JOIN (
         SELECT user_id, SUM((quantity - filled_quantity) * price) AS open_value, COUNT(*) AS open_count
         FROM orders WHERE status IN ('PENDING', 'PARTIALLY_FILLED') GROUP BY user_id
       ) oo ON oo.user_id = u.user_id
       LEFT JOIN (
         SELECT user_id, SUM(quantity * price) AS executed_value FROM fills GROUP BY user_id
       ) f ON f.user_id = u.user_id
       LEFT JOIN (
         SELECT user_id, MAX(ABS(net_qty)) AS position_qty FROM (
           SELECT user_id, symbol, SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) AS net_qty
           FROM fills GROUP BY user_id, symbol
         ) t GROUP BY user_id
       ) pos ON pos.user_id = u.user_id
       WHERE u.role = 'TRADER' AND ${clause}
       ORDER BY u.user_id`,
      params
    );

    res.status(200).json({ limits: configResult.rows[0], traders: tradersResult.rows });
  } catch (error) {
    console.error('Desk Utilisation Error:', error);
    res.status(500).json({ message: 'Internal server error fetching desk utilisation' });
  }
});

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
    await refreshBannedScripts();
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
    await refreshBannedScripts();
    await logAudit(req.user.userId, 'UNBAN_SCRIPT', symbol, null);
    res.status(200).json({ message: `Script ${symbol} unbanned successfully` });
  } catch (error) {
    console.error('Unban Error:', error);
    res.status(500).json({ message: 'Internal server error unbanning script' });
  }
});

export default router;
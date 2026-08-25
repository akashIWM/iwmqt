import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

// Spec 2.1: Server/OMS Configuration is Super Admin/Company Account/RMS Admin only - no
// PM/Trader access at all.
router.use(authenticate, authorize('RMS_ADMIN', 'SUPER_ADMIN', 'COMPANY_ACCOUNT'));

router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM servers ORDER BY server_id');
    res.status(200).json({ servers: result.rows });
  } catch (error) {
    console.error('Fetch Servers Error:', error);
    res.status(500).json({ message: 'Internal server error fetching servers' });
  }
});

router.post('/', async (req, res) => {
  const { serverId, exchange, segment, assignedTrader, ipPort } = req.body;
  if (!serverId || !exchange || !segment || !ipPort) {
    return res.status(400).json({ message: 'serverId, exchange, segment, and ipPort are required' });
  }

  try {
    const result = await query(
      `INSERT INTO servers (server_id, exchange, segment, assigned_trader, ip_port)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [serverId, exchange, segment, assignedTrader || null, ipPort]
    );
    await logAudit(req.user.userId, 'SERVER_CREATED', serverId, `trader: ${assignedTrader || 'unassigned'}`);
    res.status(201).json({ message: 'Server created', server: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Server ID already exists, or that trader already has an OMS assigned' });
    console.error('Create Server Error:', error);
    res.status(500).json({ message: 'Internal server error creating server' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { exchange, segment, assignedTrader, ipPort, status } = req.body;

  try {
    const result = await query(
      `UPDATE servers SET
         exchange = COALESCE($1, exchange),
         segment = COALESCE($2, segment),
         assigned_trader = $3,
         ip_port = COALESCE($4, ip_port),
         status = COALESCE($5, status),
         updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [exchange || null, segment || null, assignedTrader || null, ipPort || null, status || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Server not found' });

    await logAudit(req.user.userId, 'SERVER_UPDATED', result.rows[0].server_id, `trader: ${assignedTrader || 'unassigned'}, status: ${result.rows[0].status}`);
    res.status(200).json({ message: 'Server updated', server: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'That trader already has an OMS assigned' });
    console.error('Update Server Error:', error);
    res.status(500).json({ message: 'Internal server error updating server' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM servers WHERE id = $1 RETURNING server_id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Server not found' });
    await logAudit(req.user.userId, 'SERVER_DELETED', result.rows[0].server_id, null);
    res.status(200).json({ message: 'Server removed' });
  } catch (error) {
    console.error('Delete Server Error:', error);
    res.status(500).json({ message: 'Internal server error deleting server' });
  }
});

export default router;

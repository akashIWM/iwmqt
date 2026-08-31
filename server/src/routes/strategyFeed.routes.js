import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { broadcastStrategyUpdate } from '../services/wsHub.service.js';

const router = express.Router();

// Internal-only ingest endpoint for the Python TCP listener (strategy-feed/server.py) - not
// user-facing, so it's guarded by a shared secret header instead of the cookie-JWT auth every
// other route uses. Requires the secret to be configured on both sides; an unset env var here
// must never be treated as "no secret required".
router.post('/ingest', (req, res) => {
  const expected = process.env.STRATEGY_FEED_SECRET;
  if (!expected || req.header('X-Internal-Secret') !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  broadcastStrategyUpdate(req.body);
  res.status(202).json({ status: 'broadcast' });
});

// Reverse direction: a trader's Deploy/Stop action on the Strategy panel lands here (normal
// cookie-JWT session auth, same role gate as order placement) and gets relayed to the Python
// listener's own control port, which writes it down to the connected strategist/algo TCP
// client(s). This process never talks to those TCP sockets directly.
router.post('/command', authenticate, authorize('TRADER'), async (req, res) => {
  const secret = process.env.STRATEGY_FEED_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'STRATEGY_FEED_SECRET is not configured on the server' });
  }

  const controlUrl = process.env.STRATEGY_FEED_CONTROL_URL || 'http://localhost:9101/command';
  try {
    const response = await fetch(controlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
      body: JSON.stringify({ target: 'all', command: req.body }),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(502).json({ error: 'Strategy feed control server unreachable', detail: error.message });
  }
});

export default router;

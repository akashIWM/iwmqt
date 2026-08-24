import { query } from '../db/postgres.js';

// In-memory sliding-window OPS (orders-per-second) limiter. Correct for this single-process
// server; a multi-process deployment would need a shared store (e.g. Redis) instead.
const requestLog = new Map();

export const opsRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const now = Date.now();

    const config = await query('SELECT max_orders_per_second FROM oms_config WHERE id = 1');
    const limit = config.rows[0]?.max_orders_per_second ?? 120;

    const recent = (requestLog.get(userId) || []).filter((ts) => now - ts < 1000);

    if (recent.length >= limit) {
      return res.status(429).json({
        message: `Order Rejected: OPS limit exceeded - maximum ${limit} orders/second allowed.`
      });
    }

    recent.push(now);
    requestLog.set(userId, recent);
    next();
  } catch (error) {
    console.error('OPS Rate Limit Error:', error);
    next();
  }
};

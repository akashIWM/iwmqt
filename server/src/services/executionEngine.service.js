import { query } from '../db/postgres.js';
import { logAudit } from '../utils/audit.js';

// Matches PENDING LIMIT orders against a fresh LTP tick for one symbol. A BUY fills once
// the market trades at or below the limit (you'd have paid your price or better); a SELL
// fills once it trades at or above it. Filled at the LTP itself, since that's the best
// price actually available at the moment the condition is met - never worse than the
// order's own limit, per the WHERE clause below.
// Single atomic UPDATE ... WHERE status = 'PENDING' so this can never race the cancel
// endpoint (PUT /:id/cancel), which does the same atomic-update-guarded-by-status pattern.
export const matchPendingOrders = async (symbol, ltp) => {
  const filled = await query(
    `UPDATE orders
     SET status = 'EXECUTED', price = $2, executed_at = NOW(), updated_at = NOW()
     WHERE status = 'PENDING' AND type = 'LIMIT' AND symbol = $1
       AND ((side = 'BUY' AND price >= $2) OR (side = 'SELL' AND price <= $2))
     RETURNING *`,
    [symbol, ltp]
  );

  for (const order of filled.rows) {
    await logAudit(
      order.user_id,
      'ORDER_EXECUTED',
      order.symbol,
      `${order.side} ${order.quantity} @ ${ltp} (order ${order.id})`
    );
  }

  return filled.rows;
};

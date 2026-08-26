import { query } from '../db/postgres.js';
import { logAudit } from '../utils/audit.js';

// Matches PENDING/PARTIALLY_FILLED LIMIT orders against a fresh LTP tick for one symbol.
// A BUY fills once the market trades at or below the limit (you'd have paid your price or
// better); a SELL fills once it trades at or above it.
//
// Partial fills: there's no real order-book depth model here, so each match event fills a
// random 20%-100% slice of the order's remaining quantity (rounded to a whole unit) rather
// than always the full remaining amount - a simple, honest stand-in for "only some of the
// counterparty liquidity showed up at this price," which produces realistic-looking partial
// fills without pretending to model real market depth.
//
// orders.price is NEVER touched here - it stays the trader's original requested limit price
// for the order's whole lifecycle. The actual price of each fill lives only in the `fills`
// table, which is what positions/turnover/P&L must be computed from, not from order rows.
//
// Still a single atomic statement (a CTE feeding an UPDATE ... FROM), so this can never race
// the cancel endpoint's own atomic, status-guarded UPDATE.
export const matchPendingOrders = async (symbol, ltp) => {
  const filled = await query(
    `WITH candidates AS (
       SELECT
         id,
         LEAST(
           quantity - filled_quantity,
           GREATEST(1, ROUND((quantity - filled_quantity) * (0.2 + random() * 0.8)))
         ) AS fill_qty
       FROM orders
       WHERE status IN ('PENDING', 'PARTIALLY_FILLED') AND type = 'LIMIT' AND symbol = $1
         AND ((side = 'BUY' AND price >= $2) OR (side = 'SELL' AND price <= $2))
     )
     UPDATE orders o
     SET
       filled_quantity = o.filled_quantity + c.fill_qty,
       status = CASE WHEN o.filled_quantity + c.fill_qty >= o.quantity THEN 'EXECUTED' ELSE 'PARTIALLY_FILLED' END,
       executed_at = CASE WHEN o.filled_quantity + c.fill_qty >= o.quantity THEN NOW() ELSE o.executed_at END,
       updated_at = NOW()
     FROM candidates c
     WHERE o.id = c.id
     RETURNING o.*, c.fill_qty AS this_fill_qty`,
    [symbol, ltp]
  );

  for (const order of filled.rows) {
    await query(
      `INSERT INTO fills (order_id, user_id, symbol, side, quantity, price) VALUES ($1, $2, $3, $4, $5, $6)`,
      [order.id, order.user_id, order.symbol, order.side, order.this_fill_qty, ltp]
    );

    await logAudit(
      order.user_id,
      'ORDER_EXECUTED',
      order.symbol,
      `${order.side} ${order.this_fill_qty} of ${order.quantity} @ ${ltp} (order ${order.id}, status ${order.status})`
    );

    await query(
      `INSERT INTO order_events (order_id, user_id, symbol, order_type, quantity, price, event)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [order.id, order.user_id, order.symbol, order.type, order.this_fill_qty, ltp, order.status]
    );
  }

  return filled.rows;
};

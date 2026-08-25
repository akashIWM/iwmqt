import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { validateOrder } from '../utils/validators.js';
import { getLtp, getExpiry, getToken } from '../services/marketData.service.js';
import { opsRateLimit } from '../middleware/opsRateLimit.middleware.js';

const router = express.Router();

const isRmsRole = (role) => role === 'RMS_ADMIN' || role === 'SUPER_ADMIN';

// GET /api/orders - RMS/Super Admin see all users' orders; everyone else sees only their own
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const userOrders = isRmsRole(req.user.role)
      ? await query(
          `SELECT o.*, u.pan, u.nnf_id, u.neat_id FROM orders o
           JOIN users u ON u.user_id = o.user_id
           ORDER BY o.created_at DESC LIMIT 200`
        )
      : await query(
          `SELECT o.*, u.pan, u.nnf_id, u.neat_id FROM orders o
           JOIN users u ON u.user_id = o.user_id
           WHERE o.user_id = $1 ORDER BY o.created_at DESC`,
          [userId]
        );

    const orders = userOrders.rows.map((row) => ({ ...row, expiry: getExpiry(row.symbol), token: getToken(row.symbol) }));

    res.status(200).json({ orders });
  } catch (error) {
    console.error('Fetch Orders Error:', error);
    res.status(500).json({ message: 'Internal server error fetching orders' });
  }
});

// GET /api/orders/events - rolling buffer of order lifecycle events (Order Logs grid).
// Same visibility split as GET / : RMS/Super Admin see everyone's, everyone else sees own.
router.get('/events', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const events = isRmsRole(req.user.role)
      ? await query(`SELECT * FROM order_events ORDER BY created_at DESC LIMIT 200`)
      : await query(`SELECT * FROM order_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`, [userId]);

    res.status(200).json({ events: events.rows });
  } catch (error) {
    console.error('Fetch Order Events Error:', error);
    res.status(500).json({ message: 'Internal server error fetching order events' });
  }
});

// POST /api/orders/place
// Spec: order entry is Trader-only - RMS Admin/PM/Company Account/Super Admin must not be able to place orders.
router.post('/place', authenticate, authorize('TRADER'), opsRateLimit, async (req, res) => {
  try {
    const { symbol, side, type, quantity, price } = req.body;
    const userId = req.user.userId || req.user.id;
    const validationError = validateOrder(req.body);

    if (validationError) return res.status(400).json({ message: validationError });

    const normalizedSymbol = symbol.trim().toUpperCase();
    const numericQuantity = Number(quantity);
    const numericPrice = Number(price);
    const orderValue = numericQuantity * numericPrice;

    // --- RMS PRE-TRADE CHECKS (spec Section 8, control numbers noted per check) ---
    const killSwitchCheck = await query(
      `SELECT * FROM kill_switches WHERE scope = 'GLOBAL' OR (scope = 'USER' AND target_user_id = $1)`,
      [userId]
    );
    const globalHalt = killSwitchCheck.rows.find((row) => row.scope === 'GLOBAL');
    if (globalHalt) {
      return res.status(400).json({
        message: `Order Rejected: Trading is currently HALTED platform-wide by RMS. Reason: ${globalHalt.reason}`
      });
    }
    const userHalt = killSwitchCheck.rows.find((row) => row.scope === 'USER');
    if (userHalt) {
      return res.status(400).json({
        message: `Order Rejected: Your trading access has been suspended by RMS. Reason: ${userHalt.reason}`
      });
    }

    const banCheck = await query('SELECT * FROM banned_scripts WHERE symbol = $1', [normalizedSymbol]);
    if (banCheck.rows.length > 0) {
      return res.status(400).json({
        message: `Order Rejected: ${symbol} is currently BANNED by RMS risk controls. Reason: ${banCheck.rows[0].reason}`
      });
    }

    const omsConfig = (await query('SELECT * FROM oms_config WHERE id = 1')).rows[0];
    const {
      max_order_quantity: maxOrderQuantity,
      max_order_value: maxOrderValue,
      price_band_pct: priceBandPct,
      max_open_order_value: maxOpenOrderValue,
      max_position_qty: maxPositionQty,
      max_exposure_value: maxExposureValue,
      global_exposure_value: globalExposureValue,
      max_turnover_value: maxTurnoverValue,
      max_open_orders_count: maxOpenOrdersCount
    } = omsConfig;

    // Control 1 (Price Check) + Control 4 (Trade Price Protection, linked to Control 1):
    // reject LIMIT prices too far from the live reference price. Skipped if the symbol
    // isn't in the mock market universe - there's no reference price to band against.
    const ltp = getLtp(normalizedSymbol);
    if (ltp !== null) {
      const band = ltp * (Number(priceBandPct) / 100);
      if (numericPrice < ltp - band || numericPrice > ltp + band) {
        return res.status(400).json({
          message: `Order Rejected: Price Check - ${numericPrice} is outside the allowed ${priceBandPct}% band around LTP ${ltp}`
        });
      }
    }

    // Control 2 (Quantity Limit Check)
    if (numericQuantity > Number(maxOrderQuantity)) {
      return res.status(400).json({
        message: `Order Rejected: Quantity Limit Check - ${numericQuantity} exceeds the RMS-configured limit of ${maxOrderQuantity}`
      });
    }
    // Control 3 (Order Value Check)
    if (orderValue > Number(maxOrderValue)) {
      return res.status(400).json({
        message: `Order Rejected: Order Value Check - order value exceeds the RMS-configured limit of ${maxOrderValue}`
      });
    }

    // Per-symbol position, for Control 8
    const positionRow = (await query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'EXECUTED' THEN (CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) ELSE 0 END), 0) AS net_qty,
         COALESCE(SUM(CASE WHEN status = 'PENDING' THEN (CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) ELSE 0 END), 0) AS pending_qty
       FROM orders WHERE user_id = $1 AND symbol = $2`,
      [userId, normalizedSymbol]
    )).rows[0];

    // Per-user totals across all symbols, for Controls 6, 7, 9/11, 10 (user), 13
    const userTotalsRow = (await query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'PENDING' THEN quantity * price ELSE 0 END), 0) AS pending_value,
         COALESCE(SUM(CASE WHEN status = 'EXECUTED' THEN quantity * price ELSE 0 END), 0) AS executed_value,
         COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count
       FROM orders WHERE user_id = $1`,
      [userId]
    )).rows[0];

    const signedQty = side === 'BUY' ? numericQuantity : -numericQuantity;
    const prospectivePosition = Number(positionRow.net_qty) + Number(positionRow.pending_qty) + signedQty;

    // Control 8 (Position Limit Check)
    if (Math.abs(prospectivePosition) > Number(maxPositionQty)) {
      return res.status(400).json({
        message: `Order Rejected: Position Limit Check - resulting position ${prospectivePosition} exceeds the max position of ${maxPositionQty}`
      });
    }

    // Control 6 (Cumulative Open Order Value Check)
    const prospectiveOpenValue = Number(userTotalsRow.pending_value) + orderValue;
    if (prospectiveOpenValue > Number(maxOpenOrderValue)) {
      return res.status(400).json({
        message: `Order Rejected: Cumulative Open Order Value Check - open order value ${prospectiveOpenValue.toFixed(2)} exceeds the limit of ${maxOpenOrderValue}`
      });
    }

    // Current exposure proxy shared by the margin and exposure checks below - pending +
    // executed value on record plus this new order. Not a true mark-to-market net figure
    // (that needs live pricing across every open symbol); a reasonable stand-in for now.
    const currentExposure = Number(userTotalsRow.pending_value) + Number(userTotalsRow.executed_value) + orderValue;

    // Control 7 (Net Position vs. Available Margin Check)
    const marginRow = (await query('SELECT available_margin FROM users WHERE user_id = $1', [userId])).rows[0];
    if (marginRow && currentExposure > Number(marginRow.available_margin)) {
      return res.status(400).json({
        message: `Order Rejected: Net Position vs. Available Margin Check - exposure ${currentExposure.toFixed(2)} exceeds available margin of ${marginRow.available_margin}`
      });
    }

    // Control 10 (Exposure Limit Check - user level)
    if (currentExposure > Number(maxExposureValue)) {
      return res.status(400).json({
        message: `Order Rejected: Exposure Limit Check - your exposure ${currentExposure.toFixed(2)} exceeds the user limit of ${maxExposureValue}`
      });
    }

    // Control 10 (Exposure Limit Check - global level)
    const globalExposureRow = (await query(
      `SELECT COALESCE(SUM(quantity * price), 0) AS total_value FROM orders WHERE status IN ('PENDING', 'EXECUTED')`
    )).rows[0];
    const prospectiveGlobalExposure = Number(globalExposureRow.total_value) + orderValue;
    if (prospectiveGlobalExposure > Number(globalExposureValue)) {
      return res.status(400).json({
        message: `Order Rejected: Exposure Limit Check - platform-wide exposure would exceed the global limit of ${globalExposureValue}`
      });
    }

    // Control 9 / 11 (Trading Limit Check / Turnover Limit Check - same cumulative executed value)
    const prospectiveTurnover = Number(userTotalsRow.executed_value) + orderValue;
    if (prospectiveTurnover > Number(maxTurnoverValue)) {
      return res.status(400).json({
        message: `Order Rejected: Turnover Limit Check - cumulative turnover ${prospectiveTurnover.toFixed(2)} exceeds the limit of ${maxTurnoverValue}`
      });
    }

    // Control 12 (Security-Wise Limit Check) - only enforced when RMS has configured a limit for this symbol
    const securityLimit = (await query('SELECT max_qty, max_value FROM security_limits WHERE symbol = $1', [normalizedSymbol])).rows[0];
    if (securityLimit) {
      if (numericQuantity > Number(securityLimit.max_qty)) {
        return res.status(400).json({
          message: `Order Rejected: Security-Wise Limit Check - quantity exceeds the ${symbol} limit of ${securityLimit.max_qty}`
        });
      }
      if (orderValue > Number(securityLimit.max_value)) {
        return res.status(400).json({
          message: `Order Rejected: Security-Wise Limit Check - order value exceeds the ${symbol} limit of ${securityLimit.max_value}`
        });
      }
    }

    // Control 13 (Automated Execution Check) - caps outstanding unconfirmed orders per user
    if (Number(userTotalsRow.pending_count) >= Number(maxOpenOrdersCount)) {
      return res.status(400).json({
        message: `Order Rejected: Automated Execution Check - you already have ${userTotalsRow.pending_count} open orders, the maximum is ${maxOpenOrdersCount}`
      });
    }
    // --- END RMS CHECKS ---

    // Mock exchange-facing order id - no real exchange connectivity yet, but Order Book
    // needs to show both an internal id and an "exchange" one per the GUI spec.
    const exchangeOrderId = `NSE${Math.floor(100000 + Math.random() * 900000)}`;

    const newOrder = await query(
      `INSERT INTO orders (user_id, symbol, side, type, quantity, price, status, exchange_order_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7) RETURNING *`,
      [userId, normalizedSymbol, side, type, quantity, price, exchangeOrderId]
    );

    await query(
      `INSERT INTO order_events (order_id, user_id, symbol, order_type, quantity, price, event)
       VALUES ($1, $2, $3, $4, $5, $6, 'PLACED')`,
      [newOrder.rows[0].id, userId, normalizedSymbol, type, quantity, price]
    );

    res.status(201).json({
      message: 'Order placed successfully',
      order: newOrder.rows[0]
    });
  } catch (error) {
    console.error('OMS Error:', error);
    res.status(500).json({ message: 'Internal server error processing order' });
  }
});

// PUT /api/orders/:id/cancel - Cancel a pending order
router.put('/:id/cancel', authenticate, authorize('TRADER'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    const result = await query(
      `UPDATE orders SET status = 'CANCELLED' WHERE id = $1 AND user_id = $2 AND status = 'PENDING' RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found or cannot be cancelled (already executed/cancelled)' });
    }

    const cancelled = result.rows[0];
    await query(
      `INSERT INTO order_events (order_id, user_id, symbol, order_type, quantity, price, event)
       VALUES ($1, $2, $3, $4, $5, $6, 'CANCELLED')`,
      [cancelled.id, cancelled.user_id, cancelled.symbol, cancelled.type, cancelled.quantity, cancelled.price]
    );

    res.status(200).json({ message: 'Order cancelled successfully', order: cancelled });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    res.status(500).json({ message: 'Internal server error cancelling order' });
  }
});

export default router;

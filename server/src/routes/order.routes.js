import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { validateOrder } from '../utils/validators.js';
import { getLtp, getExpiry, getToken } from '../services/marketData.service.js';
import { opsRateLimit } from '../middleware/opsRateLimit.middleware.js';
import { logAudit } from '../utils/audit.js';
import { getOmsConfig, getBanReason, getGlobalKillSwitch, getUserKillSwitchReason, getSecurityLimit } from '../services/rmsConfigCache.service.js';
import { pushOrderUpdate } from '../services/wsHub.service.js';
import { scopeByRole } from '../utils/visibility.js';

const router = express.Router();

// Control 13's "auto-restrict on abnormal activity" clause - a first pass using an actual
// behavioral signal (repeated rejections in a short window) rather than only the static
// open-order-count cap below. Same in-memory sliding-window shape as opsRateLimit.middleware.js;
// tune the threshold/window once real usage patterns exist to calibrate against.
const REJECTION_WINDOW_MS = 60_000;
const REJECTION_THRESHOLD = 5;
const rejectionLog = new Map(); // userId -> recent rejection timestamps

const recentRejections = (userId) => {
  const now = Date.now();
  const recent = (rejectionLog.get(userId) || []).filter((ts) => now - ts < REJECTION_WINDOW_MS);
  rejectionLog.set(userId, recent);
  return recent;
};

// A blocked order used to leave zero compliance record - only successful fills were ever
// audited. Every RMS/kill-switch/ban rejection now writes one ORDER_REJECTED entry (control
// tag + the exact message shown to the trader) before responding, so "who tried what and
// why it was blocked" is answerable from the audit log, not just from server logs. Also
// feeds the Control 13 rejection-rate tracker above, so repeated rejections build toward
// the abnormal-activity threshold regardless of which specific control kept firing.
const rejectOrder = async (res, userId, symbol, controlTag, message) => {
  recentRejections(userId).push(Date.now());
  await logAudit(userId, 'ORDER_REJECTED', symbol, `[${controlTag}] ${message}`);
  return res.status(400).json({ message });
};

// GET /api/orders - RMS/Super Admin see everyone's orders, PM sees their desk's, everyone
// else sees only their own.
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { clause, params } = scopeByRole(req.user.role, userId, 'o.user_id');

    const userOrders = await query(
      `SELECT o.*, u.pan, u.nnf_id, u.neat_id FROM orders o
       JOIN users u ON u.user_id = o.user_id
       WHERE ${clause} ORDER BY o.created_at DESC LIMIT 200`,
      params
    );

    const orders = userOrders.rows.map((row) => ({ ...row, expiry: getExpiry(row.symbol), token: getToken(row.symbol) }));

    res.status(200).json({ orders });
  } catch (error) {
    console.error('Fetch Orders Error:', error);
    res.status(500).json({ message: 'Internal server error fetching orders' });
  }
});

// GET /api/orders/events - rolling buffer of order lifecycle events (Order Logs grid).
// Same visibility split as GET /.
router.get('/events', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { clause, params } = scopeByRole(req.user.role, userId);

    const events = await query(
      `SELECT * FROM order_events WHERE ${clause} ORDER BY created_at DESC LIMIT 200`,
      params
    );

    res.status(200).json({ events: events.rows });
  } catch (error) {
    console.error('Fetch Order Events Error:', error);
    res.status(500).json({ message: 'Internal server error fetching order events' });
  }
});

// GET /api/orders/fills - Trade Book source: one row per actual fill (not per order), so
// a partially filled order that filled in several slices shows each slice separately.
// Same visibility split as GET / and /events.
router.get('/fills', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { clause, params } = scopeByRole(req.user.role, userId);

    const fills = await query(
      `SELECT * FROM fills WHERE ${clause} ORDER BY created_at DESC LIMIT 200`,
      params
    );

    const enriched = fills.rows.map((row) => ({ ...row, token: getToken(row.symbol) }));
    res.status(200).json({ fills: enriched });
  } catch (error) {
    console.error('Fetch Fills Error:', error);
    res.status(500).json({ message: 'Internal server error fetching fills' });
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

    // Control 13, abnormal-activity clause: checked first and cheaply (no DB work), before
    // any of the real RMS checks run - a user who has just racked up several rejections in
    // the last minute gets stopped immediately rather than re-running the full check chain
    // on an order that's very likely to be rejected again anyway (or is probing the limits).
    if (recentRejections(userId).length >= REJECTION_THRESHOLD) {
      return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_13_ABNORMAL_ACTIVITY',
        `Order Rejected: Automated Execution Check - ${REJECTION_THRESHOLD}+ rejected orders in the last minute. Trading temporarily restricted; contact RMS if this persists.`);
    }

    // --- RMS PRE-TRADE CHECKS (spec Section 8, control numbers noted per check) ---
    // Kill switches, ban list, and OMS config all come from the in-memory RMS config
    // cache (rmsConfigCache.service.js) rather than a live query - this data only changes
    // when an admin edits it, so there's no reason to hit Postgres for it on every order.
    // The cache is refreshed the instant any of those admin writes happens, so it's never
    // stale relative to the database.
    const globalHalt = getGlobalKillSwitch();
    if (globalHalt) {
      return rejectOrder(res, userId, normalizedSymbol, 'KILL_SWITCH_GLOBAL',
        `Order Rejected: Trading is currently HALTED platform-wide by RMS. Reason: ${globalHalt.reason}`);
    }
    const userHaltReason = getUserKillSwitchReason(userId);
    if (userHaltReason) {
      return rejectOrder(res, userId, normalizedSymbol, 'KILL_SWITCH_USER',
        `Order Rejected: Your trading access has been suspended by RMS. Reason: ${userHaltReason}`);
    }

    const banReason = getBanReason(normalizedSymbol);
    if (banReason) {
      return rejectOrder(res, userId, normalizedSymbol, 'BANNED_SCRIPT',
        `Order Rejected: ${symbol} is currently BANNED by RMS risk controls. Reason: ${banReason}`);
    }

    const omsConfig = getOmsConfig();
    const {
      max_order_quantity: maxOrderQuantity,
      max_order_value: maxOrderValue,
      price_band_pct: priceBandPct,
      bad_trade_price_pct: badTradePricePct,
      max_open_order_value: maxOpenOrderValue,
      max_position_qty: maxPositionQty,
      max_exposure_value: maxExposureValue,
      global_exposure_value: globalExposureValue,
      max_turnover_value: maxTurnoverValue,
      global_turnover_value: globalTurnoverValue,
      max_open_orders_count: maxOpenOrdersCount
    } = omsConfig;

    // Control 1 (Price Check): the wide exchange price-band/circuit filter. Skipped if the
    // symbol isn't in the mock market universe - there's no reference price to band against.
    const ltp = getLtp(normalizedSymbol);
    if (ltp !== null) {
      const band = ltp * (Number(priceBandPct) / 100);
      if (numericPrice < ltp - band || numericPrice > ltp + band) {
        return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_1_PRICE_CHECK',
          `Order Rejected: Price Check - ${numericPrice} is outside the allowed ${priceBandPct}% exchange price band around LTP ${ltp}`);
      }

      // Control 4 (Trade Price Protection): a distinct, materially tighter "bad trade price"
      // guard against fat-finger entries close to LTP - always at least as strict as, and
      // normally much tighter than, Control 1's wider circuit band above.
      const tightBand = ltp * (Number(badTradePricePct) / 100);
      if (numericPrice < ltp - tightBand || numericPrice > ltp + tightBand) {
        return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_4_TRADE_PRICE_PROTECTION',
          `Order Rejected: Trade Price Protection - ${numericPrice} is outside the allowed ${badTradePricePct}% bad-trade-price band around LTP ${ltp}`);
      }
    }

    // Control 2 (Quantity Limit Check)
    if (numericQuantity > Number(maxOrderQuantity)) {
      return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_2_QUANTITY_LIMIT',
        `Order Rejected: Quantity Limit Check - ${numericQuantity} exceeds the RMS-configured limit of ${maxOrderQuantity}`);
    }
    // Control 3 (Order Value Check)
    if (orderValue > Number(maxOrderValue)) {
      return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_3_ORDER_VALUE',
        `Order Rejected: Order Value Check - order value exceeds the RMS-configured limit of ${maxOrderValue}`);
    }

    // Per-symbol position, for Control 8. net_qty comes from fills (the immutable record
    // of what actually executed) rather than orders.status = 'EXECUTED' - a partially
    // filled or even a since-cancelled order can still have real fills on record.
    // pending_qty uses each open order's remaining (quantity - filled_quantity), not its
    // full original quantity, so an already-partially-filled order doesn't double-count.
    const positionRow = (await query(
      `SELECT
         COALESCE((SELECT SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END)
                   FROM fills WHERE user_id = $1 AND symbol = $2), 0) AS net_qty,
         COALESCE((SELECT SUM(CASE WHEN side = 'BUY' THEN (quantity - filled_quantity) ELSE -(quantity - filled_quantity) END)
                   FROM orders WHERE user_id = $1 AND symbol = $2 AND status IN ('PENDING', 'PARTIALLY_FILLED')), 0) AS pending_qty`,
      [userId, normalizedSymbol]
    )).rows[0];

    // Per-user totals across all symbols, for Controls 6, 7, 9/11, 10 (user), 13
    const userTotalsRow = (await query(
      `SELECT
         COALESCE((SELECT SUM((quantity - filled_quantity) * price) FROM orders
                   WHERE user_id = $1 AND status IN ('PENDING', 'PARTIALLY_FILLED')), 0) AS pending_value,
         COALESCE((SELECT SUM(quantity * price) FROM fills WHERE user_id = $1), 0) AS executed_value,
         COALESCE((SELECT COUNT(*) FROM orders
                   WHERE user_id = $1 AND status IN ('PENDING', 'PARTIALLY_FILLED')), 0) AS pending_count`,
      [userId]
    )).rows[0];

    const signedQty = side === 'BUY' ? numericQuantity : -numericQuantity;
    const prospectivePosition = Number(positionRow.net_qty) + Number(positionRow.pending_qty) + signedQty;

    // Control 8 (Position Limit Check)
    if (Math.abs(prospectivePosition) > Number(maxPositionQty)) {
      return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_8_POSITION_LIMIT',
        `Order Rejected: Position Limit Check - resulting position ${prospectivePosition} exceeds the max position of ${maxPositionQty}`);
    }

    // Control 6 (Cumulative Open Order Value Check)
    const prospectiveOpenValue = Number(userTotalsRow.pending_value) + orderValue;
    if (prospectiveOpenValue > Number(maxOpenOrderValue)) {
      return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_6_OPEN_ORDER_VALUE',
        `Order Rejected: Cumulative Open Order Value Check - open order value ${prospectiveOpenValue.toFixed(2)} exceeds the limit of ${maxOpenOrderValue}`);
    }

    // Current exposure proxy shared by the margin and exposure checks below - pending +
    // executed value on record plus this new order. Not a true mark-to-market net figure
    // (that needs live pricing across every open symbol); a reasonable stand-in for now.
    const currentExposure = Number(userTotalsRow.pending_value) + Number(userTotalsRow.executed_value) + orderValue;

    // Control 7 (Net Position vs. Available Margin Check)
    const marginRow = (await query('SELECT available_margin FROM users WHERE user_id = $1', [userId])).rows[0];
    if (marginRow && currentExposure > Number(marginRow.available_margin)) {
      return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_7_MARGIN',
        `Order Rejected: Net Position vs. Available Margin Check - exposure ${currentExposure.toFixed(2)} exceeds available margin of ${marginRow.available_margin}`);
    }

    // Control 10 (Exposure Limit Check - user level)
    if (currentExposure > Number(maxExposureValue)) {
      return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_10_EXPOSURE_USER',
        `Order Rejected: Exposure Limit Check - your exposure ${currentExposure.toFixed(2)} exceeds the user limit of ${maxExposureValue}`);
    }

    // Control 10 (Exposure Limit Check - global level) - open remaining order value
    // platform-wide, plus everything actually filled platform-wide (from fills).
    const globalExposureRow = (await query(
      `SELECT
         COALESCE((SELECT SUM((quantity - filled_quantity) * price) FROM orders WHERE status IN ('PENDING', 'PARTIALLY_FILLED')), 0)
         + COALESCE((SELECT SUM(quantity * price) FROM fills), 0) AS total_value`
    )).rows[0];
    const prospectiveGlobalExposure = Number(globalExposureRow.total_value) + orderValue;
    if (prospectiveGlobalExposure > Number(globalExposureValue)) {
      return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_10_EXPOSURE_GLOBAL',
        `Order Rejected: Exposure Limit Check - platform-wide exposure would exceed the global limit of ${globalExposureValue}`);
    }

    // Control 9 (Trading Limit Check) - per-user cumulative executed value.
    const prospectiveTurnover = Number(userTotalsRow.executed_value) + orderValue;
    if (prospectiveTurnover > Number(maxTurnoverValue)) {
      return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_9_TRADING_LIMIT',
        `Order Rejected: Trading Limit Check - your cumulative turnover ${prospectiveTurnover.toFixed(2)} exceeds the limit of ${maxTurnoverValue}`);
    }

    // Control 11 (Turnover Limit Check) - a genuinely distinct, platform-wide cap (sum of
    // every user's executed value, not just this one), the same user-vs-global split
    // oms_config already has for Control 10 (max_exposure_value / global_exposure_value).
    const globalTurnoverRow = (await query(`SELECT COALESCE(SUM(quantity * price), 0) AS total_value FROM fills`)).rows[0];
    const prospectiveGlobalTurnover = Number(globalTurnoverRow.total_value) + orderValue;
    if (prospectiveGlobalTurnover > Number(globalTurnoverValue)) {
      return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_11_TURNOVER_LIMIT',
        `Order Rejected: Turnover Limit Check - platform-wide turnover would exceed the global limit of ${globalTurnoverValue}`);
    }

    // Control 12 (Security-Wise Limit Check) - only enforced when RMS has configured a limit for this symbol
    const securityLimit = getSecurityLimit(normalizedSymbol);
    if (securityLimit) {
      if (numericQuantity > Number(securityLimit.max_qty)) {
        return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_12_SECURITY_QTY',
          `Order Rejected: Security-Wise Limit Check - quantity exceeds the ${symbol} limit of ${securityLimit.max_qty}`);
      }
      if (orderValue > Number(securityLimit.max_value)) {
        return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_12_SECURITY_VALUE',
          `Order Rejected: Security-Wise Limit Check - order value exceeds the ${symbol} limit of ${securityLimit.max_value}`);
      }
    }

    // Control 13 (Automated Execution Check) - caps outstanding unconfirmed orders per user
    if (Number(userTotalsRow.pending_count) >= Number(maxOpenOrdersCount)) {
      return rejectOrder(res, userId, normalizedSymbol, 'CONTROL_13_AUTOMATED_EXECUTION',
        `Order Rejected: Automated Execution Check - you already have ${userTotalsRow.pending_count} open orders, the maximum is ${maxOpenOrdersCount}`);
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

    pushOrderUpdate(userId, newOrder.rows[0]);

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

    // A partially filled order can still be cancelled - that stops any further fills on
    // the remaining quantity, while the fills already recorded stay exactly as they are.
    const result = await query(
      `UPDATE orders SET status = 'CANCELLED' WHERE id = $1 AND user_id = $2 AND status IN ('PENDING', 'PARTIALLY_FILLED') RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found or cannot be cancelled (already executed/cancelled)' });
    }

    const cancelled = result.rows[0];
    const remainingQty = Number(cancelled.quantity) - Number(cancelled.filled_quantity);
    await query(
      `INSERT INTO order_events (order_id, user_id, symbol, order_type, quantity, price, event)
       VALUES ($1, $2, $3, $4, $5, $6, 'CANCELLED')`,
      [cancelled.id, cancelled.user_id, cancelled.symbol, cancelled.type, remainingQty, cancelled.price]
    );

    pushOrderUpdate(cancelled.user_id, cancelled);

    res.status(200).json({ message: 'Order cancelled successfully', order: cancelled });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    res.status(500).json({ message: 'Internal server error cancelling order' });
  }
});

export default router;

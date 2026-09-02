// The actual order-placement logic, extracted from order.routes.js's POST /place handler so
// it can be called directly (no self-referential HTTP round trip) by anything that needs to
// place a real, RMS-checked order on a user's behalf - today that's just the /place route
// itself, but the multi-leg strategy engine (algoStrategy.service.js) calls this same
// function per leg, so every leg gets the exact same 14-control gauntlet a manual order does.
// This file changed nothing about the checks themselves - only how the result gets reported
// (a plain object instead of writing to an Express `res`), so behavior is byte-identical.
import { query } from '../db/postgres.js';
import { validateOrder } from '../utils/validators.js';
import { getLtp } from './marketData.service.js';
import { getOmsConfig, getBanReason, getGlobalKillSwitch, getUserKillSwitchReason, getSecurityLimit } from './rmsConfigCache.service.js';
import { pushOrderUpdate } from './wsHub.service.js';
import { logAudit } from '../utils/audit.js';

const REJECTION_WINDOW_MS = 60_000;
const REJECTION_THRESHOLD = 5;
const rejectionLog = new Map(); // userId -> recent rejection timestamps

export const recentRejections = (userId) => {
  const now = Date.now();
  const recent = (rejectionLog.get(userId) || []).filter((ts) => now - ts < REJECTION_WINDOW_MS);
  rejectionLog.set(userId, recent);
  return recent;
};

const reject = async (userId, symbol, controlTag, message) => {
  recentRejections(userId).push(Date.now());
  await logAudit(userId, 'ORDER_REJECTED', symbol, `[${controlTag}] ${message}`);
  return { ok: false, status: 400, message, controlTag };
};

// Places one order for `userId`, running the full RMS pre-trade gauntlet. Returns
// { ok: true, status: 201, order } on success, or { ok: false, status, message, controlTag }
// on rejection - callers decide what to do with a rejection (a route maps it to an HTTP
// response; the strategy engine records it against a specific leg).
export async function placeOrderForUser(userId, { symbol, side, type, quantity, price }) {
  const validationError = validateOrder({ symbol, side, type, quantity, price });
  if (validationError) return { ok: false, status: 400, message: validationError };

  const normalizedSymbol = symbol.trim().toUpperCase();
  const numericQuantity = Number(quantity);
  const numericPrice = Number(price);
  const orderValue = numericQuantity * numericPrice;

  if (recentRejections(userId).length >= REJECTION_THRESHOLD) {
    return reject(userId, normalizedSymbol, 'CONTROL_13_ABNORMAL_ACTIVITY',
      `Order Rejected: Automated Execution Check - ${REJECTION_THRESHOLD}+ rejected orders in the last minute. Trading temporarily restricted; contact RMS if this persists.`);
  }

  const globalHalt = getGlobalKillSwitch();
  if (globalHalt) {
    return reject(userId, normalizedSymbol, 'KILL_SWITCH_GLOBAL',
      `Order Rejected: Trading is currently HALTED platform-wide by RMS. Reason: ${globalHalt.reason}`);
  }
  const userHaltReason = getUserKillSwitchReason(userId);
  if (userHaltReason) {
    return reject(userId, normalizedSymbol, 'KILL_SWITCH_USER',
      `Order Rejected: Your trading access has been suspended by RMS. Reason: ${userHaltReason}`);
  }

  const banReason = getBanReason(normalizedSymbol);
  if (banReason) {
    return reject(userId, normalizedSymbol, 'BANNED_SCRIPT',
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

  const ltp = getLtp(normalizedSymbol);
  if (ltp !== null) {
    const band = ltp * (Number(priceBandPct) / 100);
    if (numericPrice < ltp - band || numericPrice > ltp + band) {
      return reject(userId, normalizedSymbol, 'CONTROL_1_PRICE_CHECK',
        `Order Rejected: Price Check - ${numericPrice} is outside the allowed ${priceBandPct}% exchange price band around LTP ${ltp}`);
    }

    const tightBand = ltp * (Number(badTradePricePct) / 100);
    if (numericPrice < ltp - tightBand || numericPrice > ltp + tightBand) {
      return reject(userId, normalizedSymbol, 'CONTROL_4_TRADE_PRICE_PROTECTION',
        `Order Rejected: Trade Price Protection - ${numericPrice} is outside the allowed ${badTradePricePct}% bad-trade-price band around LTP ${ltp}`);
    }
  }

  if (numericQuantity > Number(maxOrderQuantity)) {
    return reject(userId, normalizedSymbol, 'CONTROL_2_QUANTITY_LIMIT',
      `Order Rejected: Quantity Limit Check - ${numericQuantity} exceeds the RMS-configured limit of ${maxOrderQuantity}`);
  }
  if (orderValue > Number(maxOrderValue)) {
    return reject(userId, normalizedSymbol, 'CONTROL_3_ORDER_VALUE',
      `Order Rejected: Order Value Check - order value exceeds the RMS-configured limit of ${maxOrderValue}`);
  }

  const positionRow = (await query(
    `SELECT
       COALESCE((SELECT SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END)
                 FROM fills WHERE user_id = $1 AND symbol = $2), 0) AS net_qty,
       COALESCE((SELECT SUM(CASE WHEN side = 'BUY' THEN (quantity - filled_quantity) ELSE -(quantity - filled_quantity) END)
                 FROM orders WHERE user_id = $1 AND symbol = $2 AND status IN ('PENDING', 'PARTIALLY_FILLED')), 0) AS pending_qty`,
    [userId, normalizedSymbol]
  )).rows[0];

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

  if (Math.abs(prospectivePosition) > Number(maxPositionQty)) {
    return reject(userId, normalizedSymbol, 'CONTROL_8_POSITION_LIMIT',
      `Order Rejected: Position Limit Check - resulting position ${prospectivePosition} exceeds the max position of ${maxPositionQty}`);
  }

  const prospectiveOpenValue = Number(userTotalsRow.pending_value) + orderValue;
  if (prospectiveOpenValue > Number(maxOpenOrderValue)) {
    return reject(userId, normalizedSymbol, 'CONTROL_6_OPEN_ORDER_VALUE',
      `Order Rejected: Cumulative Open Order Value Check - open order value ${prospectiveOpenValue.toFixed(2)} exceeds the limit of ${maxOpenOrderValue}`);
  }

  const currentExposure = Number(userTotalsRow.pending_value) + Number(userTotalsRow.executed_value) + orderValue;

  const marginRow = (await query('SELECT available_margin FROM users WHERE user_id = $1', [userId])).rows[0];
  if (marginRow && currentExposure > Number(marginRow.available_margin)) {
    return reject(userId, normalizedSymbol, 'CONTROL_7_MARGIN',
      `Order Rejected: Net Position vs. Available Margin Check - exposure ${currentExposure.toFixed(2)} exceeds available margin of ${marginRow.available_margin}`);
  }

  if (currentExposure > Number(maxExposureValue)) {
    return reject(userId, normalizedSymbol, 'CONTROL_10_EXPOSURE_USER',
      `Order Rejected: Exposure Limit Check - your exposure ${currentExposure.toFixed(2)} exceeds the user limit of ${maxExposureValue}`);
  }

  const globalExposureRow = (await query(
    `SELECT
       COALESCE((SELECT SUM((quantity - filled_quantity) * price) FROM orders WHERE status IN ('PENDING', 'PARTIALLY_FILLED')), 0)
       + COALESCE((SELECT SUM(quantity * price) FROM fills), 0) AS total_value`
  )).rows[0];
  const prospectiveGlobalExposure = Number(globalExposureRow.total_value) + orderValue;
  if (prospectiveGlobalExposure > Number(globalExposureValue)) {
    return reject(userId, normalizedSymbol, 'CONTROL_10_EXPOSURE_GLOBAL',
      `Order Rejected: Exposure Limit Check - platform-wide exposure would exceed the global limit of ${globalExposureValue}`);
  }

  const prospectiveTurnover = Number(userTotalsRow.executed_value) + orderValue;
  if (prospectiveTurnover > Number(maxTurnoverValue)) {
    return reject(userId, normalizedSymbol, 'CONTROL_9_TRADING_LIMIT',
      `Order Rejected: Trading Limit Check - your cumulative turnover ${prospectiveTurnover.toFixed(2)} exceeds the limit of ${maxTurnoverValue}`);
  }

  const globalTurnoverRow = (await query(`SELECT COALESCE(SUM(quantity * price), 0) AS total_value FROM fills`)).rows[0];
  const prospectiveGlobalTurnover = Number(globalTurnoverRow.total_value) + orderValue;
  if (prospectiveGlobalTurnover > Number(globalTurnoverValue)) {
    return reject(userId, normalizedSymbol, 'CONTROL_11_TURNOVER_LIMIT',
      `Order Rejected: Turnover Limit Check - platform-wide turnover would exceed the global limit of ${globalTurnoverValue}`);
  }

  const securityLimit = getSecurityLimit(normalizedSymbol);
  if (securityLimit) {
    if (numericQuantity > Number(securityLimit.max_qty)) {
      return reject(userId, normalizedSymbol, 'CONTROL_12_SECURITY_QTY',
        `Order Rejected: Security-Wise Limit Check - quantity exceeds the ${symbol} limit of ${securityLimit.max_qty}`);
    }
    if (orderValue > Number(securityLimit.max_value)) {
      return reject(userId, normalizedSymbol, 'CONTROL_12_SECURITY_VALUE',
        `Order Rejected: Security-Wise Limit Check - order value exceeds the ${symbol} limit of ${securityLimit.max_value}`);
    }
  }

  if (Number(userTotalsRow.pending_count) >= Number(maxOpenOrdersCount)) {
    return reject(userId, normalizedSymbol, 'CONTROL_13_AUTOMATED_EXECUTION',
      `Order Rejected: Automated Execution Check - you already have ${userTotalsRow.pending_count} open orders, the maximum is ${maxOpenOrdersCount}`);
  }
  // --- END RMS CHECKS ---

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

  return { ok: true, status: 201, order: newOrder.rows[0] };
}

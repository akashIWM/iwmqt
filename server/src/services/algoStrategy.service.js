// Multi-leg algo strategy engine. "Start" places every leg as a real order through
// placeOrderForUser() - the exact same RMS-checked path a manual trade uses - then, if
// price_execution is REVERT_ALL_LEGS, waits time_ms and cancels any leg that hasn't fully
// filled by then (a best-effort hedge-protection: it can withdraw an unfilled remainder, it
// does not try to unwind an already-executed leg by firing a fresh offsetting order, since
// that would introduce new market risk on its own rather than remove it).
//
// This is deliberately a one-shot "deploy legs, protect for time_ms, settle" model, not a
// perpetually-running background algo that watches the market indefinitely - a real
// continuously-monitoring strategy engine is a much bigger, separate piece of work.
import { query } from '../db/postgres.js';
import { placeOrderForUser } from './orderPlacement.service.js';
import { getLtp, getInstrumentDetails } from './marketData.service.js';
import { logAudit } from '../utils/audit.js';

const loadStrategyWithLegs = async (strategyId, userId) => {
  const strategyRes = await query('SELECT * FROM algo_strategies WHERE id = $1 AND user_id = $2', [strategyId, userId]);
  if (strategyRes.rows.length === 0) return null;
  const legsRes = await query('SELECT * FROM algo_strategy_legs WHERE strategy_id = $1 ORDER BY leg_number', [strategyId]);
  return { strategy: strategyRes.rows[0], legs: legsRes.rows };
};

// Per-leg P&L at one underlying price point at expiry. Options settle to intrinsic value;
// futures settle to the underlying price itself - both compared against this leg's own
// entered price, signed for BUY (pay premium / pay futures price) vs SELL (receive it).
const legPnlAt = (leg, details, underlyingPrice) => {
  const lots = Number(leg.lots);
  const price = Number(leg.price);
  const sign = leg.side === 'BUY' ? 1 : -1;

  let settlementValue;
  if (details?.optionType === 'CE') {
    settlementValue = Math.max(0, underlyingPrice - Number(details.strikePrice));
  } else if (details?.optionType === 'PE') {
    settlementValue = Math.max(0, Number(details.strikePrice) - underlyingPrice);
  } else {
    settlementValue = underlyingPrice; // future - or unknown symbol treated as linear
  }

  return sign * (settlementValue - price) * lots;
};

// Payoff-at-expiry curve across a range of UNDERLYING prices (multi-leg ratio spreads are
// built on one underlying, so one shared price axis is the correct model, not a per-leg
// one). Pure math - no market depth or broker data involved at all.
//
// The center of that range must be the underlying's own price, not an option's premium -
// for an option leg that's its strike (the mock data has no separate raw index/spot feed,
// and strike is denominated in the same units as the underlying, e.g. a 24500 strike implies
// the underlying trades near 24500); for a future leg, the future's own LTP already tracks
// the underlying closely enough to use directly. Getting this wrong silently produces a
// payoff curve computed against the wrong price axis entirely - confirmed by testing this
// against a real NIFTY CE/PE pair and seeing a curve centered on ~140 (the premium) instead
// of ~24500 (the strike) before this fix.
export function computePayoffCurve(legs) {
  if (legs.length === 0) return [];
  const referenceSymbol = legs[0].symbol;
  const referenceDetails = getInstrumentDetails(referenceSymbol);
  const centerPrice = referenceDetails?.strikePrice ? Number(referenceDetails.strikePrice) : getLtp(referenceSymbol);
  if (centerPrice === null || centerPrice === undefined) return [];

  const points = [];
  const steps = 20;
  const rangeStart = centerPrice * 0.8;
  const rangeEnd = centerPrice * 1.2;
  for (let i = 0; i <= steps; i += 1) {
    const underlyingPrice = rangeStart + ((rangeEnd - rangeStart) * i) / steps;
    const totalPnl = legs.reduce((sum, leg) => {
      const details = getInstrumentDetails(leg.symbol);
      return sum + legPnlAt(leg, details, underlyingPrice);
    }, 0);
    points.push({ underlyingPrice: Number(underlyingPrice.toFixed(2)), pnl: Number(totalPnl.toFixed(2)) });
  }
  return points;
}

// Cancels every leg still PENDING/PARTIALLY_FILLED for a strategy - the "withdraw the
// unfilled remainder" half of hedge protection. Never touches a leg that's already EXECUTED.
async function cancelOpenLegs(legs, userId) {
  const cancelled = [];
  for (const leg of legs) {
    if (!leg.order_id) continue;
    const result = await query(
      `UPDATE orders SET status = 'CANCELLED' WHERE id = $1 AND user_id = $2 AND status IN ('PENDING', 'PARTIALLY_FILLED') RETURNING id`,
      [leg.order_id, userId]
    );
    if (result.rows.length > 0) cancelled.push(leg.leg_number);
  }
  return cancelled;
}

// Runs time_ms after legs are placed, off the HTTP request/response cycle entirely (the
// caller already responded once legs were placed) - checks whether every leg reached
// EXECUTED, and if the strategy is configured REVERT_ALL_LEGS and it didn't, cancels the
// unfilled remainder and marks the strategy FAILED so the UI reflects what actually happened
// instead of silently staying "RUNNING" forever.
async function settleStrategyAfterDelay(strategyId, userId, timeMs) {
  await new Promise((resolve) => setTimeout(resolve, timeMs));

  const { strategy, legs } = await loadStrategyWithLegs(strategyId, userId) || {};
  if (!strategy || strategy.status !== 'RUNNING') return; // already stopped/failed by the user in the meantime

  const orderIds = legs.map((leg) => leg.order_id).filter(Boolean);
  const statusRes = orderIds.length
    ? await query(`SELECT id, status FROM orders WHERE id = ANY($1)`, [orderIds])
    : { rows: [] };
  const statusByOrderId = new Map(statusRes.rows.map((row) => [row.id, row.status]));
  const allExecuted = legs.every((leg) => leg.order_id && statusByOrderId.get(leg.order_id) === 'EXECUTED');

  if (allExecuted) {
    await query(`UPDATE algo_strategies SET status = 'STOPPED', last_run_message = 'All legs executed', updated_at = NOW() WHERE id = $1`, [strategyId]);
    return;
  }

  if (strategy.price_execution === 'REVERT_ALL_LEGS') {
    const cancelledLegs = await cancelOpenLegs(legs, userId);
    await query(
      `UPDATE algo_strategies SET status = 'FAILED', last_run_message = $2, updated_at = NOW() WHERE id = $1`,
      [strategyId, `Not all legs filled within ${timeMs}ms - cancelled remaining leg(s): ${cancelledLegs.join(', ') || 'none pending'}`]
    );
    await logAudit(userId, 'ALGO_STRATEGY_REVERTED', strategy.name, `Legs cancelled after timeout: ${cancelledLegs.join(', ')}`);
  } else {
    await query(
      `UPDATE algo_strategies SET status = 'FAILED', last_run_message = $2, updated_at = NOW() WHERE id = $1`,
      [strategyId, `Not all legs filled within ${timeMs}ms - left as-is (Leave As Is mode), unhedged`]
    );
  }
}

// Places every leg through the real RMS-checked order path. Returns immediately once legs
// are placed (or rejected) - the fill-timeout/revert logic above runs afterward, in the
// background, not blocking this response.
export async function startStrategy(strategyId, userId) {
  const loaded = await loadStrategyWithLegs(strategyId, userId);
  if (!loaded) return { ok: false, status: 404, message: 'Strategy not found' };
  const { strategy, legs } = loaded;

  if (legs.length === 0) return { ok: false, status: 400, message: 'Strategy has no legs configured' };
  if (strategy.status === 'RUNNING') return { ok: false, status: 400, message: 'Strategy is already running' };

  const legResults = [];
  for (const leg of legs) {
    const result = await placeOrderForUser(userId, {
      symbol: leg.symbol, side: leg.side, type: 'LIMIT', quantity: leg.lots, price: leg.price
    });
    legResults.push({ leg, result });
    if (result.ok) {
      await query('UPDATE algo_strategy_legs SET order_id = $1 WHERE id = $2', [result.order.id, leg.id]);
    }
  }

  const rejected = legResults.filter((r) => !r.result.ok);
  if (rejected.length > 0) {
    // At least one leg couldn't even be placed - cancel whichever legs DID get placed
    // (best-effort, since leaving a lone unhedged leg live is worse than the alternative)
    // and report exactly which leg failed and why.
    const placedLegs = legResults.filter((r) => r.result.ok).map((r) => r.leg);
    await cancelOpenLegs(placedLegs, userId);
    const reasons = rejected.map((r) => `Leg ${r.leg.leg_number}: ${r.result.message}`).join(' | ');
    await query(
      `UPDATE algo_strategies SET status = 'FAILED', last_run_message = $2, updated_at = NOW() WHERE id = $1`,
      [strategyId, reasons]
    );
    await logAudit(userId, 'ALGO_STRATEGY_REJECTED', strategy.name, reasons);
    return { ok: false, status: 400, message: reasons };
  }

  await query(`UPDATE algo_strategies SET status = 'RUNNING', last_run_message = NULL, updated_at = NOW() WHERE id = $1`, [strategyId]);
  await logAudit(userId, 'ALGO_STRATEGY_STARTED', strategy.name, `${legs.length} leg(s) placed`);

  // Deliberately not awaited - this continues after the HTTP response is already sent.
  settleStrategyAfterDelay(strategyId, userId, strategy.time_ms).catch((error) => {
    console.error('Strategy settle error:', error);
  });

  const refreshed = await loadStrategyWithLegs(strategyId, userId);
  return { ok: true, status: 200, strategy: refreshed.strategy, legs: refreshed.legs };
}

// Cancels any still-open legs and marks the strategy stopped - does not unwind fills already
// on record, same principle as the single-order Cancel endpoint.
export async function stopStrategy(strategyId, userId) {
  const loaded = await loadStrategyWithLegs(strategyId, userId);
  if (!loaded) return { ok: false, status: 404, message: 'Strategy not found' };
  const { strategy, legs } = loaded;

  const cancelledLegs = await cancelOpenLegs(legs, userId);
  await query(
    `UPDATE algo_strategies SET status = 'STOPPED', last_run_message = $2, updated_at = NOW() WHERE id = $1`,
    [strategyId, cancelledLegs.length ? `Stopped by user - cancelled leg(s): ${cancelledLegs.join(', ')}` : 'Stopped by user']
  );
  await logAudit(userId, 'ALGO_STRATEGY_STOPPED', strategy.name, `Cancelled leg(s): ${cancelledLegs.join(', ') || 'none pending'}`);

  const refreshed = await loadStrategyWithLegs(strategyId, userId);
  return { ok: true, status: 200, strategy: refreshed.strategy, legs: refreshed.legs };
}

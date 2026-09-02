import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { getAllInstruments } from '../services/marketData.service.js';
import { computePayoffCurve, startStrategy, stopStrategy } from '../services/algoStrategy.service.js';

const router = express.Router();

// Algo strategies are Trader-only, same as manual order entry - a PM/RMS Admin/Company
// Account/Super Admin cannot deploy trades on a trader's behalf via this route either.
router.use(authenticate, authorize('TRADER'));

// GET /api/strategies/instruments - the mock instrument list, for the leg builder's
// Symbol/Strike/Option-type dropdowns. Single source of truth (marketData.service.js), so
// this can never drift from what Watchlist/TradeWindow already show.
router.get('/instruments', (req, res) => {
  res.status(200).json({ instruments: getAllInstruments() });
});

// POST /api/strategies/payoff-preview - live payoff-at-expiry curve while still building the
// form, before anything is saved. Pure math (computePayoffCurve) - no market depth needed.
router.post('/payoff-preview', (req, res) => {
  const { legs } = req.body;
  if (!Array.isArray(legs) || legs.length === 0) {
    return res.status(200).json({ points: [] });
  }
  const points = computePayoffCurve(legs);
  res.status(200).json({ points });
});

// GET /api/strategies - this trader's own strategies + legs.
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const strategies = await query('SELECT * FROM algo_strategies WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    const legs = await query(
      `SELECT l.* FROM algo_strategy_legs l
       JOIN algo_strategies s ON s.id = l.strategy_id
       WHERE s.user_id = $1 ORDER BY l.strategy_id, l.leg_number`,
      [userId]
    );
    const legsByStrategy = new Map();
    for (const leg of legs.rows) {
      if (!legsByStrategy.has(leg.strategy_id)) legsByStrategy.set(leg.strategy_id, []);
      legsByStrategy.get(leg.strategy_id).push(leg);
    }
    const strategiesWithLegs = strategies.rows.map((s) => ({ ...s, legs: legsByStrategy.get(s.id) || [] }));
    res.status(200).json({ strategies: strategiesWithLegs });
  } catch (error) {
    console.error('Fetch Strategies Error:', error);
    res.status(500).json({ message: 'Internal server error fetching strategies' });
  }
});

// POST /api/strategies - create a new strategy (does not start it - Deploy/ADD, not Start).
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { name, legs, unhedgedQtyMode, priceExecution, bidMode, allowDuplicates, timeMs,
      executionMode, priceDepth, orderDepth, allowedBidDepth, allowedSlippage, marketRetries, tickSize, threshold } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ message: 'Algorithm name is required' });
    if (!Array.isArray(legs) || legs.length < 2) return res.status(400).json({ message: 'At least 2 legs are required' });
    for (const leg of legs) {
      if (!leg.symbol || !['BUY', 'SELL'].includes(leg.side) || !(Number(leg.lots) > 0) || !(Number(leg.price) > 0)) {
        return res.status(400).json({ message: 'Every leg needs a symbol, side, positive lots, and positive price' });
      }
    }
    if (!allowDuplicates) {
      const existing = await query(
        `SELECT id FROM algo_strategies WHERE user_id = $1 AND name = $2 AND status != 'STOPPED'`,
        [userId, name.trim()]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'A strategy with this name is already active - enable "Allow Duplicates" or use a different name' });
      }
    }

    const strategyRes = await query(
      `INSERT INTO algo_strategies
         (user_id, name, unhedged_qty_mode, price_execution, bid_mode, allow_duplicates, time_ms,
          execution_mode, price_depth, order_depth, allowed_bid_depth, allowed_slippage, market_retries, tick_size, threshold_qty)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [userId, name.trim(), unhedgedQtyMode || 'RATIO', priceExecution || 'REVERT_ALL_LEGS', bidMode || 'NORMAL',
        !!allowDuplicates, timeMs || 500, executionMode || 'AGGRESSIVE_SWEEP', priceDepth || 1, orderDepth || 1,
        allowedBidDepth || 0, allowedSlippage || 0, marketRetries || 0, tickSize || 0.05, threshold || 0]
    );
    const strategy = strategyRes.rows[0];

    const insertedLegs = [];
    for (let i = 0; i < legs.length; i += 1) {
      const leg = legs[i];
      const legRes = await query(
        `INSERT INTO algo_strategy_legs (strategy_id, leg_number, symbol, side, lots, price)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [strategy.id, i + 1, leg.symbol.trim().toUpperCase(), leg.side, leg.lots, leg.price]
      );
      insertedLegs.push(legRes.rows[0]);
    }

    await logAudit(userId, 'ALGO_STRATEGY_CREATED', strategy.name, `${insertedLegs.length} legs`);
    res.status(201).json({ message: 'Strategy created', strategy: { ...strategy, legs: insertedLegs } });
  } catch (error) {
    console.error('Create Strategy Error:', error);
    res.status(500).json({ message: 'Internal server error creating strategy' });
  }
});

// PUT /api/strategies/:id/start - places every leg for real through the RMS-checked order path.
router.put('/:id/start', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const result = await startStrategy(req.params.id, userId);
    if (!result.ok) return res.status(result.status).json({ message: result.message });
    res.status(result.status).json({ message: 'Strategy started', strategy: result.strategy, legs: result.legs });
  } catch (error) {
    console.error('Start Strategy Error:', error);
    res.status(500).json({ message: 'Internal server error starting strategy' });
  }
});

// PUT /api/strategies/:id/stop - cancels any still-open legs.
router.put('/:id/stop', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const result = await stopStrategy(req.params.id, userId);
    if (!result.ok) return res.status(result.status).json({ message: result.message });
    res.status(result.status).json({ message: 'Strategy stopped', strategy: result.strategy, legs: result.legs });
  } catch (error) {
    console.error('Stop Strategy Error:', error);
    res.status(500).json({ message: 'Internal server error stopping strategy' });
  }
});

// DELETE /api/strategies/:id - only when stopped, to avoid deleting a live strategy's record
// out from under its own running legs.
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const result = await query(
      `DELETE FROM algo_strategies WHERE id = $1 AND user_id = $2 AND status != 'RUNNING' RETURNING id`,
      [req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Strategy not found, or still running - stop it first' });
    }
    res.status(200).json({ message: 'Strategy deleted' });
  } catch (error) {
    console.error('Delete Strategy Error:', error);
    res.status(500).json({ message: 'Internal server error deleting strategy' });
  }
});

export default router;

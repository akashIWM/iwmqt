import { matchPendingOrders } from './executionEngine.service.js';
import { identifyFromCookieHeader, registerClient, unregisterClient } from './wsHub.service.js';
import { logMarketTicks } from './clickhouse/logger.js';

// Initial Mock Ticker Master
// expiry: weekly for index options (nearest Thursday), monthly for stock futures (last Thursday).
// token: NSE-style numeric instrument identifier - mock/stable, no real exchange master yet.
const INITIAL_INSTRUMENTS = [
  { symbol: 'NIFTY 24500 CE', instrument: 'NIFTY', optionType: 'CE', strikePrice: 24500, ltp: 142.50, prevClose: 130.00, high: 165.00, low: 110.00, volume: 1254000, bid: 142.30, ask: 142.60, expiry: '2026-08-27', token: 46201 },
  { symbol: 'NIFTY 24500 PE', instrument: 'NIFTY', optionType: 'PE', strikePrice: 24500, ltp: 88.20, prevClose: 95.00, high: 105.00, low: 72.50, volume: 980000, bid: 88.05, ask: 88.35, expiry: '2026-08-27', token: 46202 },
  { symbol: 'BANKNIFTY 52000 CE', instrument: 'BANKNIFTY', optionType: 'CE', strikePrice: 52000, ltp: 310.75, prevClose: 290.00, high: 360.00, low: 275.00, volume: 640000, bid: 310.25, ask: 311.00, expiry: '2026-08-27', token: 46301 },
  { symbol: 'BANKNIFTY 52000 PE', instrument: 'BANKNIFTY', optionType: 'PE', strikePrice: 52000, ltp: 195.40, prevClose: 215.00, high: 230.00, low: 180.00, volume: 520000, bid: 195.10, ask: 195.70, expiry: '2026-08-27', token: 46302 },
  { symbol: 'RELIANCE FUT', instrument: 'RELIANCE', optionType: null, strikePrice: null, ltp: 2985.00, prevClose: 2970.00, high: 3010.00, low: 2965.00, volume: 340000, bid: 2984.50, ask: 2985.50, expiry: '2026-09-24', token: 35001 },
  { symbol: 'HDFCBANK FUT', instrument: 'HDFCBANK', optionType: null, strikePrice: null, ltp: 1640.50, prevClose: 1655.00, high: 1662.00, low: 1638.00, volume: 410000, bid: 1640.10, ask: 1640.80, expiry: '2026-09-24', token: 35002 }
];

let marketState = [...INITIAL_INSTRUMENTS];
let seq = 0;

// Reference price for pre-trade band checks (order.routes.js). Returns null if the
// symbol isn't in the mock market universe - callers should skip the check in that case.
export const getLtp = (symbol) => {
  const instrument = marketState.find((inst) => inst.symbol === symbol);
  return instrument ? instrument.ltp : null;
};

// Full mock instrument list, for UI dropdowns (e.g. the algo strategy leg builder) that need
// to offer a real, current set of symbols rather than a second, hand-maintained copy of it.
export const getAllInstruments = () => marketState;

// Contract expiry date for a symbol, same "null if unknown" contract as getLtp.
export const getExpiry = (symbol) => {
  const instrument = marketState.find((inst) => inst.symbol === symbol);
  return instrument ? instrument.expiry : null;
};

// Strike/option-type/instrument-family for a symbol - needed to compute a payoff-at-expiry
// curve (algo strategy builder), same "null if unknown" contract as getLtp.
export const getInstrumentDetails = (symbol) => {
  const instrument = marketState.find((inst) => inst.symbol === symbol);
  if (!instrument) return null;
  return { instrument: instrument.instrument, optionType: instrument.optionType, strikePrice: instrument.strikePrice };
};

// NSE-style instrument token for a symbol, same "null if unknown" contract as getLtp.
export const getToken = (symbol) => {
  const instrument = marketState.find((inst) => inst.symbol === symbol);
  return instrument ? instrument.token : null;
};

const tickInstrument = (inst) => {
  const volatility = inst.ltp * 0.0015; // 0.15% max tick delta
  const noise = (Math.random() - 0.5) * volatility;
  // Pull a fraction of the gap to prevClose back each tick, so LTP wanders around
  // prevClose instead of drifting away unboundedly over a long-running process.
  const reversion = (inst.prevClose - inst.ltp) * 0.02;
  const newLtp = parseFloat((inst.ltp + noise + reversion).toFixed(2));
  const priceDiff = newLtp - inst.prevClose;
  const pChange = parseFloat(((priceDiff / inst.prevClose) * 100).toFixed(2));

  return {
    ...inst,
    ltp: newLtp,
    change: parseFloat(priceDiff.toFixed(2)),
    pChange,
    high: Math.max(inst.high, newLtp),
    low: Math.min(inst.low, newLtp),
    bid: parseFloat((newLtp - 0.15).toFixed(2)),
    ask: parseFloat((newLtp + 0.15).toFixed(2)),
    volume: inst.volume + Math.floor(Math.random() * 250)
  };
};

const snapshotPayload = () => JSON.stringify({ type: 'INITIAL_SNAPSHOT', seq, data: marketState });

export const initMarketDataSocket = (wss) => {
  console.log('📡 Market Data WebSocket Server initialized');

  // Broadcast state changes every 600ms - only the instruments that actually ticked,
  // and only if something did. seq only advances on an actual broadcast, so a gap in
  // seq observed by a client reliably means a dropped message, never a quiet tick.
  setInterval(() => {
    if (wss.clients.size === 0) return;

    // Simulate realistic market sparsity - not every instrument moves every tick.
    const changes = [];
    marketState = marketState.map((inst) => {
      if (Math.random() > 0.6) return inst;
      const updated = tickInstrument(inst);
      changes.push(updated);
      return updated;
    });

    if (changes.length === 0) return;
    seq += 1;

    const payload = JSON.stringify({ type: 'MARKET_DELTA', seq, changes });

    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(payload);
      }
    });

    // Run matching after the broadcast so a slow DB never delays the market data feed.
    Promise.all(changes.map((inst) => matchPendingOrders(inst.symbol, inst.ltp))).catch((error) => {
      console.error('Execution engine - failed to match pending orders:', error.message);
    });

    // Persist this tick cycle's changed instruments as one batch insert, not one row at a
    // time - logMarketTicks() is itself fail-soft, and not awaited here for the same reason
    // matching isn't: a slow write must never delay the next tick's broadcast.
    logMarketTicks(changes.map((inst) => ({
      symbol: inst.symbol,
      ltp: inst.ltp,
      bid: inst.bid,
      ask: inst.ask,
      volume: inst.volume,
      change: inst.change,
      p_change: inst.pChange,
      high: inst.high,
      low: inst.low,
      seq
    })));
  }, 600);

  wss.on('connection', (ws, req) => {
    // Identify who owns this connection (if anyone) so order/fill push updates can be
    // targeted correctly - see wsHub.service.js. An unauthenticated/expired connection
    // still works fine for market data, it just never receives order pushes.
    registerClient(ws, identifyFromCookieHeader(req.headers.cookie));

    // Send immediate snapshot on initial connect
    ws.send(snapshotPayload());

    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw);
        if (message.type === 'RESYNC_REQUEST') {
          ws.send(snapshotPayload());
        }
      } catch (error) {
        console.error('Market Data WS - malformed client message:', error.message);
      }
    });

    ws.on('close', () => unregisterClient(ws));
  });
};

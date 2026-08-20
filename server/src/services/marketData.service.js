// Initial Mock Ticker Master
const INITIAL_INSTRUMENTS = [
  { symbol: 'NIFTY 24500 CE', ltp: 142.50, prevClose: 130.00, high: 165.00, low: 110.00, volume: 1254000, bid: 142.30, ask: 142.60 },
  { symbol: 'NIFTY 24500 PE', ltp: 88.20, prevClose: 95.00, high: 105.00, low: 72.50, volume: 980000, bid: 88.05, ask: 88.35 },
  { symbol: 'BANKNIFTY 52000 CE', ltp: 310.75, prevClose: 290.00, high: 360.00, low: 275.00, volume: 640000, bid: 310.25, ask: 311.00 },
  { symbol: 'BANKNIFTY 52000 PE', ltp: 195.40, prevClose: 215.00, high: 230.00, low: 180.00, volume: 520000, bid: 195.10, ask: 195.70 },
  { symbol: 'RELIANCE FUT', ltp: 2985.00, prevClose: 2970.00, high: 3010.00, low: 2965.00, volume: 340000, bid: 2984.50, ask: 2985.50 },
  { symbol: 'HDFCBANK FUT', ltp: 1640.50, prevClose: 1655.00, high: 1662.00, low: 1638.00, volume: 410000, bid: 1640.10, ask: 1640.80 }
];

let marketState = [...INITIAL_INSTRUMENTS];

export const initMarketDataSocket = (wss) => {
  console.log('📡 Market Data WebSocket Server initialized');

  // Broadcast state changes every 600ms
  setInterval(() => {
    if (wss.clients.size === 0) return;

    // Simulate realistic micro-ticks for active instruments
    marketState = marketState.map((inst) => {
      const volatility = inst.ltp * 0.0015; // 0.15% max tick delta
      const change = (Math.random() - 0.49) * volatility;
      const newLtp = parseFloat((inst.ltp + change).toFixed(2));
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
    });

    const payload = JSON.stringify({ type: 'MARKET_TICK', data: marketState });

    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(payload);
      }
    });
  }, 600);

  wss.on('connection', (ws) => {
    // Send immediate snapshot on initial connect
    ws.send(JSON.stringify({ type: 'INITIAL_SNAPSHOT', data: marketState }));
  });
};
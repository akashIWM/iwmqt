import jwt from 'jsonwebtoken';

// Tracks which authenticated user (and role) owns each live market-data WebSocket
// connection, so order/fill push updates can be targeted correctly - only the trader who
// owns the order, plus any connected RMS/Super Admin (who see everyone's, per the exact
// same visibility rule GET /api/orders already enforces over REST). Never broadcast order
// data to every connected socket the way market data ticks are - that would leak one
// trader's private order flow to every other connected browser tab.
const clients = new Map(); // ws -> { userId, role }

const isRmsRole = (role) => role === 'RMS_ADMIN' || role === 'SUPER_ADMIN';

// Reads the `token` cookie straight off the WebSocket upgrade request - browsers attach
// cookies to a WS handshake automatically for same-site requests (client :5173 and server
// :3000 are different ports but the same site, localhost), so no client-side change is
// needed to send it. Returns null (not an error) for an unauthenticated/expired connection
// - that socket still gets market data, it just never gets registered for order pushes.
export const identifyFromCookieHeader = (cookieHeader) => {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  if (!match) return null;
  try {
    if (!process.env.JWT_SECRET) return null;
    const decoded = jwt.verify(decodeURIComponent(match[1]), process.env.JWT_SECRET);
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
};

export const registerClient = (ws, identity) => {
  if (identity) clients.set(ws, identity);
};

export const unregisterClient = (ws) => {
  clients.delete(ws);
};

const pushTo = (userId, message) => {
  const payload = JSON.stringify(message);
  for (const [ws, identity] of clients) {
    if (ws.readyState === 1 && (identity.userId === userId || isRmsRole(identity.role))) {
      ws.send(payload);
    }
  }
};

// Sent on every order lifecycle change: placed, cancelled, or a fill moved it to
// PARTIALLY_FILLED/EXECUTED. Carries the full current order row - the client's own job is
// just to know "something changed, go refetch," not to reconstruct state from the deltas.
export const pushOrderUpdate = (userId, order) => pushTo(userId, { type: 'ORDER_UPDATE', order });

// Sent alongside pushOrderUpdate whenever a fill actually happens - Trade Book cares about
// the fill event itself (a slice of an order executing), not just the parent order's status.
export const pushFillUpdate = (userId, fill) => pushTo(userId, { type: 'FILL_UPDATE', fill });

// Unlike order/fill pushes, a strategy/algo feed update isn't scoped to one trader - it's
// broadcast to every authenticated connection, the same way market ticks are, since any
// desk viewing the Strategy panel should see it live.
export const broadcastStrategyUpdate = (update) => {
  const payload = JSON.stringify({ type: 'STRATEGY_FEED_UPDATE', update });
  for (const [ws] of clients) {
    if (ws.readyState === 1) ws.send(payload);
  }
};

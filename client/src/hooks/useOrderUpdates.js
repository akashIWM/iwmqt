import { useEffect, useRef } from 'react';
import { WS_BASE_URL } from '../api';

// One shared WebSocket connection for ORDER_UPDATE/FILL_UPDATE push messages, reused across
// every grid that subscribes (Order Book, Open Orders, Trade Book, Net Positions) instead of
// each opening its own socket. Ref-counted: the connection opens on the first subscriber and
// closes once the last one unmounts. This reuses the same authenticated market-data endpoint
// (server/src/services/wsHub.service.js) rather than a second WS server - the browser already
// attaches the session cookie to it automatically.
let sharedSocket = null;
let refCount = 0;
const listeners = new Set();

function ensureSocket() {
  if (sharedSocket) return sharedSocket;
  const ws = new WebSocket(`${WS_BASE_URL}/ws/market-data`);
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'ORDER_UPDATE' || message.type === 'FILL_UPDATE') {
        listeners.forEach((listener) => listener(message));
      }
    } catch {
      // Not JSON, or not a message we care about - ignore.
    }
  };
  ws.onclose = () => {
    if (sharedSocket === ws) sharedSocket = null;
  };
  sharedSocket = ws;
  return ws;
}

// Calls onUpdate(message) whenever an ORDER_UPDATE or FILL_UPDATE push arrives. Consumers
// don't need to distinguish the two - the pattern is "something changed, go refetch," not
// reconstructing state from the push payload itself (see the components' own comments for
// why: derived data like positions/P&L is safer recomputed from a REST call than replayed
// from a stream of deltas).
export function useOrderUpdates(onUpdate) {
  const callbackRef = useRef(onUpdate);

  // Ref writes must happen in an effect, not during render - this keeps the ref pointing
  // at the latest onUpdate after every render without re-subscribing the listener below.
  useEffect(() => {
    callbackRef.current = onUpdate;
  });

  useEffect(() => {
    const listener = (message) => callbackRef.current(message);
    listeners.add(listener);
    refCount += 1;
    ensureSocket();

    return () => {
      listeners.delete(listener);
      refCount -= 1;
      if (refCount <= 0 && sharedSocket) {
        sharedSocket.close();
        sharedSocket = null;
        refCount = 0;
      }
    };
  }, []);
}

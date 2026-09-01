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
let closeTimer = null;
const listeners = new Set();

function ensureSocket() {
  // A pending teardown (see scheduleClose) is now moot - either this call is reusing the
  // still-open socket it was about to close, or a fresh one is about to replace it either way.
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
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

// Closing happens on a deferred macrotask, not synchronously in the effect cleanup - multiple
// subscribers can mount in the same tick (e.g. every trader panel now mounts together instead
// of one at a time), and React StrictMode intentionally mounts-cleans-remounts every effect
// once in dev. Both cases can drop refCount to 0 and immediately back up to 1+ within the
// same tick; closing synchronously there tears down a socket the very next line of code was
// about to reuse, closing it before the handshake even finishes ("WebSocket is closed before
// the connection is established") and forcing a full reconnect - repeated across several
// components at once, that's real main-thread churn, not just a console warning.
function scheduleClose() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    closeTimer = null;
    if (refCount <= 0) {
      if (sharedSocket) {
        sharedSocket.close();
        sharedSocket = null;
      }
      refCount = 0;
    }
  }, 0);
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
      if (refCount <= 0) scheduleClose();
    };
  }, []);
}

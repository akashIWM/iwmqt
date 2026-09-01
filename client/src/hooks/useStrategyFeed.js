import { useEffect, useRef } from 'react';
import { WS_BASE_URL } from '../api';

// One shared WebSocket connection for STRATEGY_FEED_UPDATE push messages, mirroring the
// ref-counted pattern in useOrderUpdates.js - kept as its own module/socket rather than
// folded into that hook so neither file has to change shape for the other's message type.
let sharedSocket = null;
let refCount = 0;
let closeTimer = null;
const listeners = new Set();

function ensureSocket() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (sharedSocket) return sharedSocket;
  const ws = new WebSocket(`${WS_BASE_URL}/ws/market-data`);
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'STRATEGY_FEED_UPDATE') {
        listeners.forEach((listener) => listener(message.update));
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

// Deferred, not synchronous - see useOrderUpdates.js's scheduleClose for the full
// explanation (multiple subscribers mounting in the same tick, plus React StrictMode's
// mount-cleanup-remount cycle, can both drop refCount to 0 and back to 1+ within one tick).
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

// Calls onUpdate(update) whenever a strategist/algo feed update arrives from the Python TCP
// listener (see strategy-feed/server.py -> POST /api/strategy-feed/ingest -> this socket).
export function useStrategyFeed(onUpdate) {
  const callbackRef = useRef(onUpdate);

  useEffect(() => {
    callbackRef.current = onUpdate;
  });

  useEffect(() => {
    const listener = (update) => callbackRef.current(update);
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

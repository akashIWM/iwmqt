import { useEffect, useRef } from 'react';
import { WS_BASE_URL } from '../api';

// One shared WebSocket connection for STRATEGY_FEED_UPDATE push messages, mirroring the
// ref-counted pattern in useOrderUpdates.js - kept as its own module/socket rather than
// folded into that hook so neither file has to change shape for the other's message type.
let sharedSocket = null;
let refCount = 0;
const listeners = new Set();

function ensureSocket() {
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
      if (refCount <= 0 && sharedSocket) {
        sharedSocket.close();
        sharedSocket = null;
        refCount = 0;
      }
    };
  }, []);
}

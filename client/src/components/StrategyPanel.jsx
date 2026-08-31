import { useCallback, useState } from 'react';
import { apiFetch } from '../api';
import { useStrategyFeed } from '../hooks/useStrategyFeed';

const MAX_FEED_ITEMS = 50;

export default function StrategyPanel() {
  const [strategyName, setStrategyName] = useState('Nifty_Momentum_Breakout');
  const [lotSize, setLotSize] = useState(50);
  const [stopLoss, setStopLoss] = useState(25);
  const [isRunning, setIsRunning] = useState(false);
  const [feed, setFeed] = useState([]);
  const [commandStatus, setCommandStatus] = useState(null);

  // Sends the Deploy/Stop action to the backend, which relays it through the strategy-feed
  // Python listener's control port to whichever external strategist/algo system is connected.
  // Local isRunning only flips once the command is actually delivered - not optimistically -
  // so "RUNNING" never lies about a system that never received the command.
  const handleToggleStrategy = async (e) => {
    e.preventDefault();
    const nextRunning = !isRunning;
    setCommandStatus('sending');
    try {
      const response = await apiFetch('/strategy-feed/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: nextRunning ? 'DEPLOY_STRATEGY' : 'STOP_STRATEGY',
          strategyName,
          lotSize,
          stopLoss
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setCommandStatus(data.error || 'Command failed');
        return;
      }
      if (!data.delivered_to || data.delivered_to.length === 0) {
        setCommandStatus('No connected strategist/algo system to receive this command');
        return;
      }
      setIsRunning(nextRunning);
      setCommandStatus(`Delivered to: ${data.delivered_to.join(', ')}`);
    } catch (error) {
      setCommandStatus(`Failed to reach backend: ${error.message}`);
    }
  };

  // Newest first, capped so a chatty external system can't grow this unbounded in memory.
  const handleFeedUpdate = useCallback((update) => {
    setFeed((prev) => [update, ...prev].slice(0, MAX_FEED_ITEMS));
  }, []);

  useStrategyFeed(handleFeedUpdate);

  const styles = {
    container: { fontFamily: '"Inter", sans-serif', color: '#f8fafc', fontSize: '12px' },
    inputGroup: { marginBottom: '14px' },
    label: { display: 'block', color: '#94a3b8', marginBottom: '6px', fontWeight: '600' },
    input: { width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' },
    btn: { width: '100%', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', marginTop: '10px' }
  };

  return (
    <div style={styles.container}>
      <div style={{ padding: '4px 0 16px 0', color: '#627d98', fontSize: '13px' }}>
        Algo Execution Engine
      </div>

      <form onSubmit={handleToggleStrategy}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>STRATEGY MODEL</label>
          <select 
            value={strategyName} 
            onChange={(e) => setStrategyName(e.target.value)} 
            style={styles.input}
          >
            <option value="Nifty_Momentum_Breakout">Nifty Momentum Breakout</option>
            <option value="BankNifty_VWAP_Cross">BankNifty VWAP Cross</option>
            <option value="Mean_Reversion_Pairs">Mean Reversion Pairs</option>
          </select>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>BASE QUANTITY / LOTS</label>
          <input 
            type="number" 
            value={lotSize} 
            onChange={(e) => setLotSize(e.target.value)} 
            style={styles.input} 
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>MAX STOP LOSS (PTS)</label>
          <input 
            type="number" 
            value={stopLoss} 
            onChange={(e) => setStopLoss(e.target.value)} 
            style={styles.input} 
          />
        </div>

        <button 
          type="submit" 
          style={{ 
            ...styles.btn, 
            backgroundColor: isRunning ? '#ef4444' : '#22c55e', 
            color: '#fff' 
          }}
        >
          {isRunning ? 'STOP ALGO STRATEGY' : 'DEPLOY ALGO STRATEGY'}
        </button>
      </form>

      <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#1e293b', borderRadius: '6px', border: '1px solid #334155' }}>
        <div style={{ fontWeight: '700', marginBottom: '4px', color: isRunning ? '#4ade80' : '#94a3b8' }}>
          Status: {isRunning ? 'RUNNING (Listening to Ticks)' : 'IDLE / DISCONNECTED'}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          Executes automated limit entries based on real-time WebSocket tick arrays.
        </div>
        {commandStatus && (
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
            {commandStatus}
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        <div style={{ color: '#627d98', fontSize: '13px', marginBottom: '8px' }}>
          External Feed ({feed.length}) - Strategist / Algo Systems
        </div>
        <div style={{
          maxHeight: '260px',
          overflowY: 'auto',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '6px',
          padding: feed.length ? '6px' : '12px'
        }}>
          {feed.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '11px' }}>
              No updates received yet. Waiting for a connection on the strategy-feed TCP listener.
            </div>
          ) : (
            feed.map((update, i) => (
              <div
                key={`${update.received_at}-${i}`}
                style={{
                  padding: '8px',
                  borderBottom: i === feed.length - 1 ? 'none' : '1px solid #334155',
                  fontSize: '11px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>{update.source_address}</span>
                  <span>{new Date(update.received_at).toLocaleTimeString()}</span>
                </div>
                <pre style={{
                  margin: '4px 0 0 0',
                  color: '#e2e8f0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace'
                }}>
                  {JSON.stringify(update.payload, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
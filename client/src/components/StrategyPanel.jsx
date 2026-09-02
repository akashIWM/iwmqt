import { useCallback, useState } from 'react';
import { apiFetch } from '../api';
import { useStrategyFeed } from '../hooks/useStrategyFeed';
import { gridColors } from '../styles/gridTheme';
import AlgoStrategyList from './AlgoStrategyList';

const MAX_FEED_ITEMS = 50;

const styles = {
  container: { fontFamily: '"Inter", sans-serif', color: gridColors.primary, fontSize: '12px' },
  sectionTitle: { color: gridColors.muted, fontSize: '13px', marginBottom: '8px', marginTop: '24px' },
  card: { backgroundColor: '#fbfcfe', border: '1px solid #edf2f7', borderRadius: '6px', padding: '12px' },
  inputGroup: { marginBottom: '14px' },
  label: { display: 'block', color: gridColors.muted, marginBottom: '6px', fontWeight: '600' },
  input: { width: '100%', padding: '8px', backgroundColor: '#f8f9fa', border: '1px solid #d9e2ec', borderRadius: '4px', color: gridColors.primary, boxSizing: 'border-box' },
  btn: { width: '100%', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', marginTop: '10px' }
};

export default function StrategyPanel() {
  return (
    <div style={styles.container}>
      {/* The real, functional feature: build and run our own multi-leg strategies, each leg
          a genuine RMS-checked order (see AlgoStrategyList / AlgoStrategyBuilder). */}
      <AlgoStrategyList />

      <div style={styles.sectionTitle}>External Algo/Strategist Control</div>
      <ExternalAlgoControl />

      <div style={styles.sectionTitle}>External Feed - Strategist / Algo Systems</div>
      <ExternalFeed />
    </div>
  );
}

// Sends a Deploy/Stop command to whichever outside algo/strategist system is connected via
// the strategy-feed Python TCP listener - distinct from AlgoStrategyList above, which runs
// strategies inside this platform. This one controls an external process we don't own.
function ExternalAlgoControl() {
  const [strategyName, setStrategyName] = useState('Nifty_Momentum_Breakout');
  const [lotSize, setLotSize] = useState(50);
  const [stopLoss, setStopLoss] = useState(25);
  const [isRunning, setIsRunning] = useState(false);
  const [commandStatus, setCommandStatus] = useState(null);

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

  return (
    <div style={styles.card}>
      <form onSubmit={handleToggleStrategy}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>STRATEGY MODEL</label>
          <select value={strategyName} onChange={(e) => setStrategyName(e.target.value)} style={styles.input}>
            <option value="Nifty_Momentum_Breakout">Nifty Momentum Breakout</option>
            <option value="BankNifty_VWAP_Cross">BankNifty VWAP Cross</option>
            <option value="Mean_Reversion_Pairs">Mean Reversion Pairs</option>
          </select>
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>BASE QUANTITY / LOTS</label>
          <input type="number" value={lotSize} onChange={(e) => setLotSize(e.target.value)} style={styles.input} />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>MAX STOP LOSS (PTS)</label>
          <input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} style={styles.input} />
        </div>
        <button type="submit" style={{ ...styles.btn, backgroundColor: isRunning ? gridColors.sell : gridColors.buy, color: '#fff' }}>
          {isRunning ? 'STOP EXTERNAL ALGO' : 'DEPLOY EXTERNAL ALGO'}
        </button>
      </form>
      <div style={{ marginTop: '14px', fontWeight: '700', color: isRunning ? gridColors.buy : gridColors.muted }}>
        Status: {isRunning ? 'RUNNING' : 'IDLE / DISCONNECTED'}
      </div>
      {commandStatus && <div style={{ fontSize: '11px', color: gridColors.muted, marginTop: '4px' }}>{commandStatus}</div>}
    </div>
  );
}

function ExternalFeed() {
  const [feed, setFeed] = useState([]);
  const handleFeedUpdate = useCallback((update) => {
    setFeed((prev) => [update, ...prev].slice(0, MAX_FEED_ITEMS));
  }, []);
  useStrategyFeed(handleFeedUpdate);

  return (
    <div style={{ ...styles.card, maxHeight: '260px', overflowY: 'auto' }}>
      {feed.length === 0 ? (
        <div style={{ color: gridColors.muted, fontSize: '11px' }}>
          No updates received yet. Waiting for a connection on the strategy-feed TCP listener.
        </div>
      ) : (
        feed.map((update, i) => (
          <div key={`${update.received_at}-${i}`} style={{ padding: '8px 0', borderBottom: i === feed.length - 1 ? 'none' : '1px solid #edf2f7', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: gridColors.muted }}>
              <span>{update.source_address}</span>
              <span>{new Date(update.received_at).toLocaleTimeString()}</span>
            </div>
            <pre style={{ margin: '4px 0 0 0', color: gridColors.primary, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
              {JSON.stringify(update.payload, null, 2)}
            </pre>
          </div>
        ))
      )}
    </div>
  );
}

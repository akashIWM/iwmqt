import { useState } from 'react';

export default function StrategyPanel() {
  const [strategyName, setStrategyName] = useState('Nifty_Momentum_Breakout');
  const [lotSize, setLotSize] = useState(50);
  const [stopLoss, setStopLoss] = useState(25);
  const [isRunning, setIsRunning] = useState(false);

  const handleToggleStrategy = (e) => {
    e.preventDefault();
    setIsRunning(!isRunning);
  };

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
      </div>
    </div>
  );
}
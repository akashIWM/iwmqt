import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalOrders: 0, totalUsers: 0, bannedScriptsCount: 0 });
  const [symbolToBan, setSymbolToBan] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchAdminStats();
  }, []);

  async function fetchAdminStats() {
    try {
      const response = await apiFetch('/admin/stats');
      const data = await response.json();
      if (response.ok) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    }
  }

  const handleBanScript = async (e) => {
    e.preventDefault();
    if (!symbolToBan) return;

    try {
      const response = await apiFetch('/rms/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbolToBan.toUpperCase(), reason })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Successfully restricted ${symbolToBan.toUpperCase()}`);
        setSymbolToBan('');
        setReason('');
        fetchAdminStats();
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error('Ban action failed', err);
      setMessage('Network error executing ban');
    }
  };

  const styles = {
    container: { padding: '20px', fontFamily: '"Inter", sans-serif', color: '#f8fafc', backgroundColor: '#0f172a', minHeight: '100vh' },
    cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' },
    card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' },
    cardTitle: { fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' },
    cardValue: { fontSize: '24px', fontWeight: '700', color: '#38bdf8' },
    formCard: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155', maxWidth: '500px' },
    input: { width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' },
    btn: { padding: '10px 16px', backgroundColor: '#c92a2a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' }
  };

  return (
    <div style={styles.container}>
      <h2>RMS & Super Admin Command Center</h2>
      <p style={{ color: '#94a3b8', marginBottom: '20px' }}>Platform-wide risk oversight and compliance controls.</p>

      {/* Metrics Row */}
      <div style={styles.cardGrid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>TOTAL PLATFORM USERS</div>
          <div style={styles.cardValue}>{stats.totalUsers}</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardTitle}>TOTAL OMS ORDERS PROCESSED</div>
          <div style={styles.cardValue}>{stats.totalOrders}</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardTitle}>ACTIVE BANNED SCRIPTS</div>
          <div style={{ ...styles.cardValue, color: '#f87171' }}>{stats.bannedScriptsCount}</div>
        </div>
      </div>

      {/* Action Control: Ban Script */}
      <div style={styles.formCard}>
        <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>Emergency Script Restriction</h3>
        {message && <p style={{ color: '#4ade80', fontSize: '13px', marginBottom: '10px' }}>{message}</p>}
        <form onSubmit={handleBanScript}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px', color: '#94a3b8' }}>SYMBOL (e.g. NIFTY 24500 CE)</label>
          <input 
            type="text" 
            value={symbolToBan} 
            onChange={(e) => setSymbolToBan(e.target.value)} 
            placeholder="Enter exact trading symbol" 
            style={styles.input} 
            required 
          />
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px', color: '#94a3b8' }}>REASON</label>
          <input 
            type="text" 
            value={reason} 
            onChange={(e) => setReason(e.target.value)} 
            placeholder="e.g. Excessive Volatility / Circuit Hit" 
            style={styles.input} 
          />
          <button type="submit" style={styles.btn}>APPLY RMS BAN</button>
        </form>
      </div>
    </div>
  );
}
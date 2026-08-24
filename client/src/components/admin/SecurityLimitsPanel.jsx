import { useState, useEffect } from 'react';
import { apiFetch } from '../../api';

const styles = {
  card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px' },
  text: { color: '#94a3b8', fontSize: '13px', marginBottom: '16px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', flex: 1 },
  row: { display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' },
  btn: { padding: '10px 16px', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', color: '#fff', backgroundColor: '#38bdf8' },
  removeBtn: { padding: '6px 12px', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', color: '#fff', backgroundColor: '#c92a2a', fontSize: '11px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '8px' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #334155' },
  td: { padding: '10px 12px', fontSize: '13px', color: '#f8fafc', borderBottom: '1px solid #334155' }
};

export default function SecurityLimitsPanel() {
  const [limits, setLimits] = useState([]);
  const [form, setForm] = useState({ symbol: '', maxQty: '', maxValue: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchLimits();
  }, []);

  async function fetchLimits() {
    try {
      const response = await apiFetch('/security-limits');
      const data = await response.json();
      if (response.ok) setLimits(data.limits);
    } catch (err) {
      console.error('Failed to fetch security limits:', err);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch(`/security-limits/${form.symbol.toUpperCase()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxQty: form.maxQty, maxValue: form.maxValue })
      });
      const data = await response.json();
      setMessage(response.ok ? data.message : `Error: ${data.message}`);
      if (response.ok) {
        setForm({ symbol: '', maxQty: '', maxValue: '' });
        fetchLimits();
      }
    } catch (err) {
      console.error('Failed to set security limit:', err);
      setMessage('Network error setting security limit');
    }
  };

  const handleRemove = async (symbol) => {
    try {
      await apiFetch(`/security-limits/${symbol}`, { method: 'DELETE' });
      fetchLimits();
    } catch (err) {
      console.error('Failed to remove security limit:', err);
    }
  };

  return (
    <div>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Security-Wise Limits</h3>
        <p style={styles.text}>Control 12 - per-security quantity/value caps. No entry means no per-security limit is enforced.</p>
        {message && <p style={{ color: '#4ade80', fontSize: '13px' }}>{message}</p>}
        <form onSubmit={handleSubmit} style={styles.row}>
          <input style={styles.input} placeholder="Symbol" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} required />
          <input type="number" min="1" style={styles.input} placeholder="Max Qty" value={form.maxQty} onChange={(e) => setForm({ ...form, maxQty: e.target.value })} required />
          <input type="number" min="1" style={styles.input} placeholder="Max Value (₹)" value={form.maxValue} onChange={(e) => setForm({ ...form, maxValue: e.target.value })} required />
          <button type="submit" style={styles.btn}>Set Limit</button>
        </form>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Symbol</th>
              <th style={styles.th}>Max Qty</th>
              <th style={styles.th}>Max Value</th>
              <th style={styles.th}>Set By</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {limits.map((l) => (
              <tr key={l.symbol}>
                <td style={styles.td}><strong>{l.symbol}</strong></td>
                <td style={styles.td}>{l.max_qty}</td>
                <td style={styles.td}>{l.max_value}</td>
                <td style={styles.td}>{l.set_by}</td>
                <td style={styles.td}>
                  <button style={styles.removeBtn} onClick={() => handleRemove(l.symbol)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {limits.length === 0 && <p style={styles.text}>No per-security limits configured.</p>}
      </div>
    </div>
  );
}

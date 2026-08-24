import { useState, useEffect } from 'react';
import { apiFetch } from '../../api';

const styles = {
  card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155', maxWidth: '500px' },
  text: { color: '#94a3b8', fontSize: '13px', marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', marginBottom: '5px', color: '#94a3b8' },
  input: { width: '100%', padding: '10px', marginBottom: '16px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' },
  btn: { padding: '10px 16px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' },
  meta: { fontSize: '12px', color: '#64748b', marginBottom: '16px' }
};

export default function OmsConfigPanel() {
  const [config, setConfig] = useState(null);
  const [maxOrderQuantity, setMaxOrderQuantity] = useState('');
  const [maxOrderValue, setMaxOrderValue] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const response = await apiFetch('/oms-config');
      const data = await response.json();
      if (response.ok) {
        setConfig(data.config);
        setMaxOrderQuantity(data.config.max_order_quantity);
        setMaxOrderValue(data.config.max_order_value);
      }
    } catch (err) {
      console.error('Failed to fetch OMS config:', err);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/oms-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_order_quantity: maxOrderQuantity, max_order_value: maxOrderValue })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('OMS configuration updated');
        setConfig(data.config);
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error('Failed to update OMS config:', err);
      setMessage('Network error updating OMS configuration');
    }
  };

  return (
    <div style={styles.card}>
      <p style={styles.text}>Platform-wide order risk limits, enforced on every order placement.</p>
      {config && (
        <p style={styles.meta}>
          Last updated {new Date(config.updated_at).toLocaleString()}{config.updated_by ? ` by ${config.updated_by}` : ''}
        </p>
      )}
      {message && <p style={{ color: '#4ade80', fontSize: '13px', marginBottom: '10px' }}>{message}</p>}
      <form onSubmit={handleSubmit}>
        <label style={styles.label}>MAX ORDER QUANTITY</label>
        <input
          type="number" min="1" step="1" style={styles.input}
          value={maxOrderQuantity} onChange={(e) => setMaxOrderQuantity(e.target.value)} required
        />
        <label style={styles.label}>MAX ORDER VALUE (₹)</label>
        <input
          type="number" min="1" step="1" style={styles.input}
          value={maxOrderValue} onChange={(e) => setMaxOrderValue(e.target.value)} required
        />
        <button type="submit" style={styles.btn}>SAVE CONFIGURATION</button>
      </form>
    </div>
  );
}

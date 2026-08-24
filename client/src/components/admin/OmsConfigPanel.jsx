import { useState, useEffect } from 'react';
import { apiFetch } from '../../api';

const styles = {
  card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155', maxWidth: '600px' },
  text: { color: '#94a3b8', fontSize: '13px', marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', marginBottom: '5px', color: '#94a3b8' },
  input: { width: '100%', padding: '10px', marginBottom: '16px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' },
  btn: { padding: '10px 16px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' },
  meta: { fontSize: '12px', color: '#64748b', marginBottom: '16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 16px' }
};

// Field key -> {label, control} - control name maps each limit to its spec Section 8 control.
const FIELDS = [
  { key: 'max_order_quantity', label: 'MAX ORDER QUANTITY', control: 'Control 2 - Quantity Limit' },
  { key: 'max_order_value', label: 'MAX ORDER VALUE (₹)', control: 'Control 3 - Order Value' },
  { key: 'price_band_pct', label: 'PRICE BAND (%)', control: 'Controls 1/4 - Price / Trade Price Protection' },
  { key: 'max_open_order_value', label: 'MAX OPEN ORDER VALUE (₹)', control: 'Control 6 - Cumulative Open Order Value' },
  { key: 'max_position_qty', label: 'MAX POSITION QUANTITY', control: 'Control 8 - Position Limit' },
  { key: 'max_exposure_value', label: 'MAX EXPOSURE - USER (₹)', control: 'Control 10 - Exposure (User)' },
  { key: 'global_exposure_value', label: 'MAX EXPOSURE - GLOBAL (₹)', control: 'Control 10 - Exposure (Global)' },
  { key: 'max_turnover_value', label: 'MAX TURNOVER (₹)', control: 'Controls 9/11 - Trading / Turnover Limit' },
  { key: 'max_open_orders_count', label: 'MAX OPEN ORDERS PER USER', control: 'Control 13 - Automated Execution' },
  { key: 'max_orders_per_second', label: 'MAX ORDERS / SECOND (OPS)', control: 'OPS cap' }
];

export default function OmsConfigPanel() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({});
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
        setForm(Object.fromEntries(FIELDS.map((f) => [f.key, data.config[f.key]])));
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
        body: JSON.stringify(form)
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
      <p style={styles.text}>Platform-wide RMS risk limits - global defaults enforced on every order placement.</p>
      {config && (
        <p style={styles.meta}>
          Last updated {new Date(config.updated_at).toLocaleString()}{config.updated_by ? ` by ${config.updated_by}` : ''}
        </p>
      )}
      {message && <p style={{ color: '#4ade80', fontSize: '13px', marginBottom: '10px' }}>{message}</p>}
      <form onSubmit={handleSubmit}>
        <div style={styles.grid}>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label style={styles.label} title={f.control}>{f.label}</label>
              <input
                type="number" min="0.01" step="0.01" style={styles.input}
                value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} required
              />
            </div>
          ))}
        </div>
        <button type="submit" style={styles.btn}>SAVE CONFIGURATION</button>
      </form>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { apiFetch } from '../../api';

const styles = {
  card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px' },
  text: { color: '#94a3b8', fontSize: '13px', marginBottom: '16px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', flex: 1 },
  row: { display: 'flex', gap: '10px', marginBottom: '12px' },
  btn: (danger) => ({
    padding: '10px 16px', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', color: '#fff',
    backgroundColor: danger ? '#c92a2a' : '#40c057'
  }),
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '8px' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #334155' },
  td: { padding: '10px 12px', fontSize: '13px', color: '#f8fafc', borderBottom: '1px solid #334155' }
};

export default function KillSwitchPanel() {
  const [switches, setSwitches] = useState([]);
  const [reason, setReason] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSwitches();
  }, []);

  async function fetchSwitches() {
    try {
      const response = await apiFetch('/kill-switch');
      const data = await response.json();
      if (response.ok) setSwitches(data.switches);
    } catch (err) {
      console.error('Failed to fetch kill switches:', err);
    }
  }

  const globalSwitch = switches.find((s) => s.scope === 'GLOBAL');
  const userSwitches = switches.filter((s) => s.scope === 'USER');

  const toggleGlobal = async () => {
    try {
      const response = globalSwitch
        ? await apiFetch('/kill-switch/global', { method: 'DELETE' })
        : await apiFetch('/kill-switch/global', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
          });
      const data = await response.json();
      setMessage(response.ok ? data.message : `Error: ${data.message}`);
      fetchSwitches();
    } catch (err) {
      console.error('Failed to toggle global kill switch:', err);
      setMessage('Network error toggling global kill switch');
    }
  };

  const suspendUser = async (e) => {
    e.preventDefault();
    if (!targetUserId) return;
    try {
      const response = await apiFetch(`/kill-switch/user/${targetUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await response.json();
      setMessage(response.ok ? data.message : `Error: ${data.message}`);
      setTargetUserId('');
      fetchSwitches();
    } catch (err) {
      console.error('Failed to suspend user:', err);
      setMessage('Network error suspending user');
    }
  };

  const resumeUser = async (userId) => {
    try {
      const response = await apiFetch(`/kill-switch/user/${userId}`, { method: 'DELETE' });
      const data = await response.json();
      setMessage(response.ok ? data.message : `Error: ${data.message}`);
      fetchSwitches();
    } catch (err) {
      console.error('Failed to resume user:', err);
      setMessage('Network error resuming user');
    }
  };

  return (
    <div>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Global Trading Halt</h3>
        <p style={styles.text}>
          When active, ALL new order placement platform-wide is rejected.
          Current state: <strong style={{ color: globalSwitch ? '#f87171' : '#4ade80' }}>
            {globalSwitch ? `HALTED (${globalSwitch.reason})` : 'TRADING ENABLED'}
          </strong>
        </p>
        {!globalSwitch && (
          <div style={styles.row}>
            <input style={styles.input} placeholder="Reason for halt" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        <button style={styles.btn(!globalSwitch)} onClick={toggleGlobal}>
          {globalSwitch ? 'Lift Global Halt' : 'Activate Global Halt'}
        </button>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Per-User Suspension</h3>
        {message && <p style={{ color: '#4ade80', fontSize: '13px' }}>{message}</p>}
        <form onSubmit={suspendUser} style={styles.row}>
          <input style={styles.input} placeholder="User ID to suspend" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required />
          <input style={styles.input} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="submit" style={styles.btn(true)}>Suspend</button>
        </form>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Suspended User</th>
              <th style={styles.th}>Reason</th>
              <th style={styles.th}>Since</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {userSwitches.map((s) => (
              <tr key={s.id}>
                <td style={styles.td}>{s.target_user_id}</td>
                <td style={styles.td}>{s.reason}</td>
                <td style={styles.td}>{new Date(s.activated_at).toLocaleString()}</td>
                <td style={styles.td}>
                  <button style={styles.btn(false)} onClick={() => resumeUser(s.target_user_id)}>Resume</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

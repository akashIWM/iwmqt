import { useState, useEffect } from 'react';
import { apiFetch } from '../../api';

const styles = {
  card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' },
  text: { color: '#94a3b8', fontSize: '13px', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #334155' },
  td: { padding: '10px 12px', fontSize: '13px', color: '#f8fafc', borderBottom: '1px solid #334155' }
};

export default function AuditLogPanel() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchEntries();
    const interval = setInterval(fetchEntries, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchEntries() {
    try {
      const response = await apiFetch('/audit-log?limit=100');
      const data = await response.json();
      if (response.ok) setEntries(data.entries);
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    }
  }

  return (
    <div style={styles.card}>
      <p style={styles.text}>Every RMS/admin action - script bans, kill switches, role and config changes.</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>Actor</th>
              <th style={styles.th}>Action</th>
              <th style={styles.th}>Target</th>
              <th style={styles.th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td style={styles.td}>{new Date(entry.created_at).toLocaleString()}</td>
                <td style={styles.td}>{entry.actor_user_id}</td>
                <td style={styles.td}>{entry.action}</td>
                <td style={styles.td}>{entry.target}</td>
                <td style={styles.td}>{entry.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p style={styles.text}>No audit entries yet.</p>}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { apiFetch } from '../../api';

const styles = {
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' },
  card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' },
  cardTitle: { fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' },
  cardValue: { fontSize: '24px', fontWeight: '700', color: '#38bdf8' },
  note: { color: '#64748b', fontSize: '12px', marginTop: '16px' }
};

// Read-only RMS snapshot for roles (e.g. PM) that can view but not edit RMS controls.
export default function RmsStatsSummary() {
  const [stats, setStats] = useState({ totalOrders: 0, totalUsers: 0, bannedScriptsCount: 0 });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const response = await apiFetch('/admin/stats');
      const data = await response.json();
      if (response.ok) setStats(data.stats);
    } catch (err) {
      console.error('Failed to load RMS stats:', err);
    }
  }

  return (
    <div>
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
      <p style={styles.note}>View-only RMS snapshot. Contact your RMS Admin to change risk controls.</p>
    </div>
  );
}

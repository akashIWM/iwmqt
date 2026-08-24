import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../api';

const styles = {
  card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' },
  text: { color: '#94a3b8', fontSize: '13px', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #334155' },
  td: { padding: '10px 12px', fontSize: '13px', color: '#f8fafc', borderBottom: '1px solid #334155' },
  select: { padding: '6px 8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '12px' },
  actionBtn: { padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', color: '#fff' },
  badge: (active) => ({
    padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
    backgroundColor: active ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
    color: active ? '#4ade80' : '#f87171'
  })
};

export default function UserRoleManagement() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE_URL}/admin/users`)
      .then((response) => { if (active) setUsers(response.data.users); })
      .catch(() => { if (active) setError('Failed to load user data. Check permissions or network.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`${API_BASE_URL}/admin/users/${userId}/role`, { role: newRole });
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    try {
      await axios.put(`${API_BASE_URL}/admin/users/${userId}/status`, { status: newStatus });
      setUsers(users.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  if (loading) return <p style={styles.text}>Loading user data...</p>;
  if (error) return <p style={{ ...styles.text, color: '#f87171' }}>{error}</p>;

  return (
    <div style={styles.card}>
      <p style={styles.text}>Assign roles and lock/unlock accounts for every registered user.</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Full Name</th>
              <th style={styles.th}>User ID</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={styles.td}>{u.full_name}</td>
                <td style={styles.td}><strong>{u.user_id}</strong></td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}>
                  <select style={styles.select} value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                    <option value="TRADER">Trader</option>
                    <option value="PM">Portfolio Manager</option>
                    <option value="RMS_ADMIN">RMS Admin</option>
                    <option value="COMPANY_ACCOUNT">Company Account</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </td>
                <td style={styles.td}>
                  <span style={styles.badge(u.status === 'ACTIVE')}>{u.status}</span>
                </td>
                <td style={styles.td}>
                  <button
                    style={{ ...styles.actionBtn, backgroundColor: u.status === 'ACTIVE' ? '#fa5252' : '#40c057' }}
                    onClick={() => handleStatusToggle(u.id, u.status)}
                  >
                    {u.status === 'ACTIVE' ? 'Lock' : 'Unlock'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

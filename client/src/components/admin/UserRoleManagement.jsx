import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../api';
import { useAuth } from '../../auth/AuthContext';

const ALL_ROLES = [
  { value: 'TRADER', label: 'Trader' },
  { value: 'PM', label: 'Portfolio Manager' },
  { value: 'RMS_ADMIN', label: 'RMS Admin' },
  { value: 'COMPANY_ACCOUNT', label: 'Company Account' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' }
];
const COMPANY_ACCOUNT_CREATABLE_ROLES = ALL_ROLES.filter((r) => ['RMS_ADMIN', 'PM', 'TRADER'].includes(r.value));

const styles = {
  card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px' },
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
  }),
  input: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' },
  row: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' },
  btn: { padding: '8px 16px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' },
  tempPassword: { backgroundColor: '#052e16', border: '1px solid #16a34a', color: '#4ade80', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', fontFamily: 'monospace' }
};

export default function UserRoleManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ userId: '', fullName: '', email: '', role: 'TRADER' });
  const [createError, setCreateError] = useState('');
  const [createResult, setCreateResult] = useState(null);

  const creatableRoles = currentUser.role === 'COMPANY_ACCOUNT' ? COMPANY_ACCOUNT_CREATABLE_ROLES : ALL_ROLES;

  useEffect(() => {
    loadUsers();
  }, []);

  function loadUsers() {
    setLoading(true);
    axios.get(`${API_BASE_URL}/admin/users`)
      .then((response) => setUsers(response.data.users))
      .catch(() => setError('Failed to load user data. Check permissions or network.'))
      .finally(() => setLoading(false));
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateResult(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/admin/users`, newUser);
      setCreateResult(response.data);
      setNewUser({ userId: '', fullName: '', email: '', role: creatableRoles[0].value });
      loadUsers();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create user');
    }
  };

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

  return (
    <div>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Add User</h3>
        {createError && <p style={{ color: '#f87171', fontSize: '13px' }}>{createError}</p>}
        {createResult && (
          <div style={styles.tempPassword}>
            Login <strong>{createResult.user.user_id}</strong> created. One-time temp password: <strong>{createResult.tempPassword}</strong>
            <br />Share this securely - it will not be shown again.
          </div>
        )}
        <form onSubmit={handleCreate} style={styles.row}>
          <input style={styles.input} placeholder="User ID" value={newUser.userId} onChange={(e) => setNewUser({ ...newUser, userId: e.target.value })} required />
          <input style={styles.input} placeholder="Full Name" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} required />
          <input type="email" style={styles.input} placeholder="Email (@iwmquant.com)" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
          <select style={styles.select} value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
            {creatableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="submit" style={styles.btn}>Add User</button>
        </form>
      </div>

      <div style={styles.card}>
      <p style={styles.text}>Assign roles and lock/unlock accounts for every registered user.</p>
      {loading ? <p style={styles.text}>Loading user data...</p> : error ? <p style={{ ...styles.text, color: '#f87171' }}>{error}</p> : (
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
      )}
      </div>
    </div>
  );
}

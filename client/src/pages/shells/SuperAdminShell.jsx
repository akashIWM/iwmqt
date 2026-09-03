import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { styles } from './styles';
import { AccessModule } from './shared';

export default function SuperAdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    axios.get('/admin/users')
      .then((response) => {
        if (active) setUsers(response.data.users);
      })
      .catch(() => {
        if (active) setError('Failed to load user data. Check permissions or network.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`/admin/users/${userId}/role`, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    try {
      await axios.put(`/admin/users/${userId}/status`, { status: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.navbar}>
        <div>
          <h2 style={styles.brandTitle}>IWM Quant | Core System</h2>
          <p style={styles.userInfo}>
            <span style={{...styles.statusDot, backgroundColor: '#f59f00'}}></span>
            Super Admin | {user.userId}
          </p>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Disconnect</button>
      </header>
      <main style={styles.contentCard}>
        <h3 style={styles.pageTitle}>Platform Administration</h3>
        <p style={styles.text}>Welcome, <strong>{user.fullName}</strong>. Here are your authorized modules:</p>

        {/* Module Summary Grid */}
        <div style={styles.grid}>
          <AccessModule title="Company Account Management" scope="✔ Full Access" onClick={() => navigate('/app/admin?tab=company-accounts')} />
          <AccessModule title="User & Role Management" scope="✔ Global" onClick={() => navigate('/app/admin?tab=users')} />
          <AccessModule title="Server / OMS Configuration" scope="✔ Global" onClick={() => navigate('/app/admin?tab=servers')} />
          <AccessModule title="Security-Wise Limits" scope="✔ Global" onClick={() => navigate('/app/admin?tab=security-limits')} />
          <AccessModule title="Kill Switch" scope="✔ Platform-wide" onClick={() => navigate('/app/admin?tab=kill-switch')} />
          <AccessModule title="Audit Log" scope="✔ Platform-wide" onClick={() => navigate('/app/admin?tab=audit-log')} />
          <AccessModule title="RMS Dashboard (Stats)" scope="View-Only" onClick={() => navigate('/app/admin')} />
          <AccessModule title="RMS Risk Limits (14 Controls)" scope="View-Only" onClick={() => navigate('/app/admin?tab=oms-config')} />
        </div>

        <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid #d9e2ec' }} />

        {/* Dynamic User Management Table */}
        <h3 style={styles.pageTitle}>User Management Console</h3>

        {loading ? (
          <p style={styles.text}>Loading user data...</p>
        ) : error ? (
          <p style={{ ...styles.text, color: '#c92a2a' }}>{error}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Full Name</th>
                  <th style={styles.th}>User ID</th>
                  <th style={styles.th}>Email Address</th>
                  <th style={styles.th}>Assigned Role</th>
                  <th style={styles.th}>Account Status</th>
                  <th style={styles.th}>Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ transition: 'background-color 0.2s' }}>
                    <td style={styles.td}>{u.full_name}</td>
                    <td style={styles.td}><strong>{u.user_id}</strong></td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}>
                      <select
                        style={styles.select}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="TRADER">Trader</option>
                        <option value="PM">Portfolio Manager</option>
                        <option value="RMS_ADMIN">RMS Admin</option>
                        <option value="COMPANY_ACCOUNT">Company Account</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        letterSpacing: '0.5px',
                        backgroundColor: u.status === 'ACTIVE' ? '#d3f9d8' : '#ffe3e3',
                        color: u.status === 'ACTIVE' ? '#2b8a3e' : '#c92a2a'
                      }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        style={{
                          ...styles.actionBtn,
                          backgroundColor: u.status === 'ACTIVE' ? '#fa5252' : '#40c057'
                        }}
                        onClick={() => handleStatusToggle(u.id, u.status)}
                      >
                        {u.status === 'ACTIVE' ? 'Lock Account' : 'Unlock'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

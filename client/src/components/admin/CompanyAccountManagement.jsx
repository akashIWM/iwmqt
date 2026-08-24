import { useState, useEffect } from 'react';
import { apiFetch } from '../../api';

const styles = {
  card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px', maxWidth: '600px' },
  text: { color: '#94a3b8', fontSize: '13px', marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', marginBottom: '5px', color: '#94a3b8' },
  input: { width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' },
  btn: { padding: '10px 16px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' },
  tempPassword: { backgroundColor: '#052e16', border: '1px solid #16a34a', color: '#4ade80', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', fontFamily: 'monospace' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #334155' },
  td: { padding: '10px 12px', fontSize: '13px', color: '#f8fafc', borderBottom: '1px solid #334155' },
  badge: (active) => ({
    padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
    backgroundColor: active ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
    color: active ? '#4ade80' : '#f87171'
  }),
  actionBtn: (danger) => ({
    padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', color: '#fff',
    backgroundColor: danger ? '#fa5252' : '#40c057'
  })
};

export default function CompanyAccountManagement() {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ code: '', name: '', adminUserId: '', adminFullName: '', adminEmail: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  async function fetchCompanies() {
    try {
      const response = await apiFetch('/companies');
      const data = await response.json();
      if (response.ok) setCompanies(data.companies);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    try {
      const response = await apiFetch('/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (response.ok) {
        setResult(data);
        setForm({ code: '', name: '', adminUserId: '', adminFullName: '', adminEmail: '' });
        fetchCompanies();
      } else {
        setError(data.error || 'Failed to create company');
      }
    } catch (err) {
      console.error('Failed to create company:', err);
      setError('Network error creating company');
    }
  };

  const toggleStatus = async (code, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiFetch(`/companies/${code}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchCompanies();
    } catch (err) {
      console.error('Failed to update company status:', err);
    }
  };

  return (
    <div>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>New Company Account</h3>
        <p style={styles.text}>Creates the entity and its first Company Account login in one step.</p>
        {error && <p style={{ color: '#f87171', fontSize: '13px' }}>{error}</p>}
        {result && (
          <div style={styles.tempPassword}>
            Login <strong>{result.adminUser.user_id}</strong> created. One-time temp password: <strong>{result.tempPassword}</strong>
            <br />Share this securely - it will not be shown again.
          </div>
        )}
        <form onSubmit={handleCreate}>
          <label style={styles.label}>COMPANY CODE (e.g. ACME)</label>
          <input style={styles.input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
          <label style={styles.label}>COMPANY NAME</label>
          <input style={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <label style={styles.label}>ADMIN USER ID</label>
          <input style={styles.input} value={form.adminUserId} onChange={(e) => setForm({ ...form, adminUserId: e.target.value })} required />
          <label style={styles.label}>ADMIN FULL NAME</label>
          <input style={styles.input} value={form.adminFullName} onChange={(e) => setForm({ ...form, adminFullName: e.target.value })} required />
          <label style={styles.label}>ADMIN EMAIL (@iwmquant.com)</label>
          <input type="email" style={styles.input} value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required />
          <button type="submit" style={styles.btn}>CREATE COMPANY</button>
        </form>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Companies</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Code</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Members</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.code}>
                <td style={styles.td}><strong>{c.code}</strong></td>
                <td style={styles.td}>{c.name}</td>
                <td style={styles.td}>{c.member_count}</td>
                <td style={styles.td}><span style={styles.badge(c.status === 'ACTIVE')}>{c.status}</span></td>
                <td style={styles.td}>
                  <button style={styles.actionBtn(c.status === 'ACTIVE')} onClick={() => toggleStatus(c.code, c.status)}>
                    {c.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
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

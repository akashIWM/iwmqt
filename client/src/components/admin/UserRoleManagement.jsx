import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../auth/AuthContext';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { useGridColumnPersistence } from '../../hooks/useGridColumnPersistence';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const ALL_ROLES = [
  { value: 'TRADER', label: 'Trader' },
  { value: 'PM', label: 'Portfolio Manager' },
  { value: 'RMS_ADMIN', label: 'RMS Admin' },
  { value: 'COMPANY_ACCOUNT', label: 'Company Account' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' }
];
const COMPANY_ACCOUNT_CREATABLE_ROLES = ALL_ROLES.filter((r) => ['RMS_ADMIN', 'PM', 'TRADER'].includes(r.value));

const styles = {
  card: { backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' },
  text: { color: gridColors.muted, fontSize: '13px', marginBottom: '16px' },
  select: { padding: '6px 8px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#f8f9fa', color: gridColors.primary, fontSize: '12px' },
  input: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#f8f9fa', color: gridColors.primary },
  row: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' },
  btn: { padding: '8px 16px', backgroundColor: gridColors.accent, color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' },
  tempPassword: { backgroundColor: '#ecfdf5', border: '1px solid #2b8a3e', color: '#1a5c2a', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', fontFamily: 'monospace' }
};

export default function UserRoleManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ userId: '', fullName: '', email: '', role: 'TRADER' });
  const [createError, setCreateError] = useState('');
  const [createResult, setCreateResult] = useState(null);
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:user-role-management');

  const creatableRoles = currentUser.role === 'COMPANY_ACCOUNT' ? COMPANY_ACCOUNT_CREATABLE_ROLES : ALL_ROLES;

  // useCallback with an empty dependency array: this closes over nothing that changes
  // (setUsers/setError/setLoading are the stable setter functions React guarantees), so a
  // stable reference is both correct and lets the handlers below - and the columnDefs memo -
  // list it as a dependency without recomputing on every render.
  const loadUsers = useCallback(() => {
    setLoading(true);
    axios.get('/admin/users')
      .then((response) => setUsers(response.data.users))
      .catch(() => setError('Failed to load user data. Check permissions or network.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateResult(null);
    try {
      const response = await axios.post('/admin/users', newUser);
      setCreateResult(response.data);
      setNewUser({ userId: '', fullName: '', email: '', role: creatableRoles[0].value });
      loadUsers();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create user');
    }
  };

  // These three reload from the server rather than patching local state in place: the
  // columnDefs memo below needs its own fresh `users` snapshot for the PM-options dropdown
  // anyway (see its comment), so patching a second copy of the list here would just be two
  // sources of truth to keep in sync for no benefit. loadUsers() is the single source.
  // Wrapped in useCallback (dep: the now-stable loadUsers) so these have stable references
  // too - satisfies columnDefs' exhaustive-deps honestly instead of suppressing the warning.
  const handleRoleChange = useCallback(async (userId, newRole) => {
    try {
      await axios.put(`/admin/users/${userId}/role`, { role: newRole });
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  }, [loadUsers]);

  const handleStatusToggle = useCallback(async (userId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    try {
      await axios.put(`/admin/users/${userId}/status`, { status: newStatus });
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  }, [loadUsers]);

  const handlePmChange = useCallback(async (userId, pmUserId) => {
    try {
      await axios.put(`/admin/users/${userId}/pm`, { pmUserId: pmUserId || null });
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update desk assignment');
    }
  }, [loadUsers]);

  const handleForceReset = useCallback(async (userId, displayUserId) => {
    if (!window.confirm(`Force-reset the password for ${displayUserId}? They'll need to set a new one on next login.`)) return;
    try {
      const response = await axios.post(`/admin/users/${userId}/reset-password`);
      alert(`New temp password for ${displayUserId}: ${response.data.tempPassword}\n\nShare this securely - it will not be shown again.`);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  }, [loadUsers]);

  // useMemo, not the plain useState([...]) every other column set in this codebase uses -
  // the PM dropdown's options depend on the current `users` list itself (who's a PM right
  // now), which a frozen-at-first-render array could never see past its initial (pre-load,
  // empty) snapshot. Recomputing per `users` change keeps that dropdown - and every other
  // closure in here - honestly current instead of silently stale.
  const columnDefs = useMemo(() => {
    const pmOptions = users.filter((u) => u.role === 'PM');
    return [
    { field: 'user_id', headerName: 'USER ID', width: 120, cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'full_name', headerName: 'NAME', width: 160, cellStyle: { color: gridColors.primary } },
    { field: 'email', headerName: 'EMAIL', width: 200, cellStyle: { color: gridColors.muted } },
    {
      field: 'role', headerName: 'ROLE', width: 170,
      cellRenderer: (params) => (
        <select style={styles.select} value={params.value} onChange={(e) => handleRoleChange(params.data.id, e.target.value)}>
          {ALL_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      )
    },
    {
      headerName: 'DESK (PM)', width: 170,
      cellRenderer: (params) => (
        params.data.role !== 'TRADER' ? <span style={{ color: gridColors.muted }}>—</span> : (
          <select style={styles.select} value={params.data.pm_user_id || ''} onChange={(e) => handlePmChange(params.data.id, e.target.value)}>
            <option value="">Unassigned</option>
            {pmOptions.map((pm) => <option key={pm.user_id} value={pm.user_id}>{pm.user_id}</option>)}
          </select>
        )
      )
    },
    {
      headerName: 'SERVER / OMS MAPPING', width: 170,
      valueGetter: (p) => p.data.server_id || '—',
      cellStyle: { color: gridColors.muted }
    },
    {
      field: 'last_login_at', headerName: 'LAST LOGIN', width: 150,
      valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : 'Never'),
      cellStyle: { color: gridColors.muted, fontSize: '11px' }
    },
    {
      field: 'status', headerName: 'STATUS', width: 90,
      cellStyle: (p) => ({ color: p.value === 'ACTIVE' ? gridColors.buy : gridColors.sell, fontWeight: '700' })
    },
    {
      headerName: 'ACTION', width: 190,
      cellRenderer: (params) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            style={{ padding: '4px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', color: '#fff', backgroundColor: params.data.status === 'ACTIVE' ? gridColors.sell : gridColors.buy }}
            onClick={() => handleStatusToggle(params.data.id, params.data.status)}
          >
            {params.data.status === 'ACTIVE' ? 'Lock' : 'Unlock'}
          </button>
          <button
            style={{ padding: '4px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', color: '#fff', backgroundColor: gridColors.pending }}
            onClick={() => handleForceReset(params.data.id, params.data.user_id)}
          >
            Reset PW
          </button>
        </div>
      )
    }
    ];
  }, [users, handleRoleChange, handlePmChange, handleStatusToggle, handleForceReset]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `users-${Date.now()}.csv` });
  };

  return (
    <div>
      <style>{GRID_THEME_CSS}</style>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: gridColors.primary }}>Add User</h3>
        {createError && <p style={{ color: gridColors.sell, fontSize: '13px' }}>{createError}</p>}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={styles.text}>Assign roles and lock/unlock accounts for every registered user.</p>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary, height: 'fit-content' }}>
            Export CSV
          </button>
        </div>
        {loading ? <p style={styles.text}>Loading user data...</p> : error ? <p style={{ ...styles.text, color: gridColors.sell }}>{error}</p> : (
          <div className={GRID_THEME_CLASS} style={{ height: '400px', width: '100%' }}>
            <AgGridReact
              ref={gridRef}
              theme="legacy"
              rowData={users}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={(params) => params.data.id}
              rowHeight={40}
              headerHeight={35}
              {...columnPersistence}
            />
          </div>
        )}
      </div>
    </div>
  );
}

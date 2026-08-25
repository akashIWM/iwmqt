import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const styles = {
  card: { backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', maxWidth: '600px' },
  text: { color: gridColors.muted, fontSize: '13px', marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', marginBottom: '5px', color: gridColors.muted },
  input: { width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#f8f9fa', color: gridColors.primary, boxSizing: 'border-box' },
  btn: { padding: '10px 16px', backgroundColor: gridColors.accent, color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' },
  tempPassword: { backgroundColor: '#ecfdf5', border: '1px solid #2b8a3e', color: '#1a5c2a', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', fontFamily: 'monospace' }
};

export default function CompanyAccountManagement() {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ code: '', name: '', adminUserId: '', adminFullName: '', adminEmail: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const gridRef = useRef();

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

  const [columnDefs] = useState([
    { field: 'code', headerName: 'CODE', width: 120, cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'name', headerName: 'NAME', width: 200, cellStyle: { color: gridColors.primary } },
    { field: 'member_count', headerName: 'MEMBERS', width: 100, cellStyle: { color: gridColors.primary } },
    {
      field: 'status', headerName: 'STATUS', width: 110,
      cellStyle: (p) => ({ color: p.value === 'ACTIVE' ? gridColors.buy : gridColors.sell, fontWeight: '700' })
    },
    {
      headerName: 'ACTION', width: 120,
      cellRenderer: (params) => (
        <button
          onClick={() => toggleStatus(params.data.code, params.data.status)}
          style={{ padding: '4px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', color: '#fff', backgroundColor: params.data.status === 'ACTIVE' ? gridColors.sell : gridColors.buy }}
        >
          {params.data.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
        </button>
      )
    }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `companies-${Date.now()}.csv` });
  };

  return (
    <div>
      <style>{GRID_THEME_CSS}</style>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: gridColors.primary }}>New Company Account</h3>
        <p style={styles.text}>Creates the entity and its first Company Account login in one step.</p>
        {error && <p style={{ color: gridColors.sell, fontSize: '13px' }}>{error}</p>}
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

      <div style={{ ...styles.card, maxWidth: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, color: gridColors.primary }}>Companies</h3>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
        </div>
        <div className={GRID_THEME_CLASS} style={{ height: '350px', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            theme="legacy"
            rowData={companies}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => params.data.code}
            rowHeight={35}
            headerHeight={35}
          />
        </div>
      </div>
    </div>
  );
}

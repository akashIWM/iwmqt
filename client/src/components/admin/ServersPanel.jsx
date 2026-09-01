import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { useGridColumnPersistence } from '../../hooks/useGridColumnPersistence';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const styles = {
  card: { backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' },
  text: { color: gridColors.muted, fontSize: '13px', marginBottom: '16px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#f8f9fa', color: gridColors.primary, flex: 1 },
  select: { padding: '10px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#f8f9fa', color: gridColors.primary, flex: 1 },
  row: { display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' },
  btn: { padding: '10px 16px', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', color: '#fff', backgroundColor: gridColors.accent }
};

const EXCHANGES = ['NSE', 'BSE'];
const SEGMENTS = ['FO', 'CM', 'CD'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];

// Server/OMS Configuration screen per GUI spec 6.2 + 7.4: one OMS instance per trader,
// exchange- and segment-wise, with a ClientID/Terminal IP:Port display.
export default function ServersPanel() {
  const [servers, setServers] = useState([]);
  const [traders, setTraders] = useState([]);
  const [form, setForm] = useState({ serverId: '', exchange: 'NSE', segment: 'FO', assignedTrader: '', ipPort: '' });
  const [message, setMessage] = useState('');
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:servers-panel');

  useEffect(() => {
    fetchServers();
    fetchTraders();
  }, []);

  async function fetchServers() {
    try {
      const response = await apiFetch('/servers');
      const data = await response.json();
      if (response.ok) setServers(data.servers);
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    }
  }

  async function fetchTraders() {
    try {
      const response = await apiFetch('/admin/users');
      const data = await response.json();
      if (response.ok) setTraders(data.users.filter((u) => u.role === 'TRADER'));
    } catch (err) {
      console.error('Failed to fetch traders:', err);
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      setMessage(response.ok ? data.message : `Error: ${data.message}`);
      if (response.ok) {
        setForm({ serverId: '', exchange: 'NSE', segment: 'FO', assignedTrader: '', ipPort: '' });
        fetchServers();
      }
    } catch (err) {
      console.error('Failed to create server:', err);
      setMessage('Network error creating server');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await apiFetch(`/servers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchServers();
    } catch (err) {
      console.error('Failed to update server status:', err);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this server/OMS instance?')) return;
    try {
      await apiFetch(`/servers/${id}`, { method: 'DELETE' });
      fetchServers();
    } catch (err) {
      console.error('Failed to remove server:', err);
    }
  };

  const [columnDefs] = useState([
    { field: 'server_id', headerName: 'SERVER / OMS ID', width: 150, cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'exchange', headerName: 'EXCHANGE', width: 100, cellStyle: { color: gridColors.primary } },
    { field: 'segment', headerName: 'SEGMENT', width: 100, cellStyle: { color: gridColors.primary } },
    { field: 'assigned_trader', headerName: 'ASSIGNED TRADER', width: 140, valueFormatter: (p) => p.value || 'Unassigned', cellStyle: { color: gridColors.muted } },
    { field: 'ip_port', headerName: 'IP : PORT', width: 150, cellStyle: { color: gridColors.muted, fontSize: '11px' } },
    {
      field: 'status', headerName: 'STATUS', width: 130,
      cellRenderer: (params) => (
        <select
          style={{ ...styles.select, padding: '4px 6px', fontSize: '11px' }}
          value={params.value}
          onChange={(e) => handleStatusChange(params.data.id, e.target.value)}
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )
    },
    {
      headerName: 'ACTION', width: 90,
      cellRenderer: (params) => (
        <button
          onClick={() => handleRemove(params.data.id)}
          style={{ background: gridColors.sell, color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
        >
          Remove
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
    gridRef.current?.api?.exportDataAsCsv({ fileName: `servers-${Date.now()}.csv` });
  };

  return (
    <div>
      <style>{GRID_THEME_CSS}</style>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: gridColors.primary }}>New Server / OMS Instance</h3>
        <p style={styles.text}>One OMS instance per trader, exchange- and segment-wise.</p>
        {message && <p style={{ color: gridColors.buy, fontSize: '13px' }}>{message}</p>}
        <form onSubmit={handleCreate} style={styles.row}>
          <input style={styles.input} placeholder="Server / OMS ID" value={form.serverId} onChange={(e) => setForm({ ...form, serverId: e.target.value })} required />
          <select style={styles.select} value={form.exchange} onChange={(e) => setForm({ ...form, exchange: e.target.value })}>
            {EXCHANGES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select style={styles.select} value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
            {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={styles.select} value={form.assignedTrader} onChange={(e) => setForm({ ...form, assignedTrader: e.target.value })}>
            <option value="">Unassigned</option>
            {traders.map((t) => <option key={t.user_id} value={t.user_id}>{t.user_id} ({t.full_name})</option>)}
          </select>
          <input style={styles.input} placeholder="IP:Port (e.g. 10.0.4.12:9443)" value={form.ipPort} onChange={(e) => setForm({ ...form, ipPort: e.target.value })} required />
          <button type="submit" style={styles.btn}>Create</button>
        </form>
      </div>

      <div style={{ ...styles.card }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
        </div>
        <div className={GRID_THEME_CLASS} style={{ height: '350px', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            theme="legacy"
            rowData={servers}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => params.data.id}
            rowHeight={38}
            headerHeight={35}
            {...columnPersistence}
          />
        </div>
      </div>
    </div>
  );
}

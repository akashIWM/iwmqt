import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const styles = {
  card: { backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' },
  text: { color: gridColors.muted, fontSize: '13px', marginBottom: '16px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#f8f9fa', color: gridColors.primary, flex: 1 },
  row: { display: 'flex', gap: '10px', marginBottom: '12px' },
  btn: (danger) => ({
    padding: '10px 16px', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', color: '#fff',
    backgroundColor: danger ? gridColors.sell : gridColors.buy
  })
};

export default function KillSwitchPanel() {
  const [switches, setSwitches] = useState([]);
  const [reason, setReason] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [message, setMessage] = useState('');
  const gridRef = useRef();

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

  // Deliberately hard to misclick, per spec 7.3 - a confirmation dialog gates every
  // kill-switch action, since this is the single highest-blast-radius control in the app.
  const toggleGlobal = async () => {
    const confirmed = globalSwitch
      ? window.confirm('Lift the platform-wide trading halt? All users will be able to place orders again.')
      : window.confirm('HALT ALL TRADING PLATFORM-WIDE? No user will be able to place or cancel any order until this is lifted.');
    if (!confirmed) return;

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
    if (!window.confirm(`Suspend trading access for "${targetUserId}"? They will be unable to place or cancel orders.`)) return;
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
    if (!window.confirm(`Restore trading access for "${userId}"?`)) return;
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

  const [columnDefs] = useState([
    { field: 'target_user_id', headerName: 'SUSPENDED USER', width: 150, cellStyle: { fontWeight: '700', color: gridColors.sell } },
    { field: 'reason', headerName: 'REASON', width: 200, cellStyle: { color: gridColors.muted } },
    {
      field: 'activated_at', headerName: 'SINCE', width: 170,
      valueFormatter: (p) => new Date(p.value).toLocaleString(), cellStyle: { color: gridColors.muted, fontSize: '11px' }
    },
    {
      headerName: 'ACTION', width: 110,
      cellRenderer: (params) => (
        <button style={styles.btn(false)} onClick={() => resumeUser(params.data.target_user_id)}>Resume</button>
      )
    }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `kill-switch-suspensions-${Date.now()}.csv` });
  };

  return (
    <div>
      <style>{GRID_THEME_CSS}</style>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: gridColors.primary }}>Global Trading Halt</h3>
        <p style={styles.text}>
          When active, ALL new order placement platform-wide is rejected.
          Current state: <strong style={{ color: globalSwitch ? gridColors.sell : gridColors.buy }}>
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
        <h3 style={{ marginTop: 0, color: gridColors.primary }}>Per-User Suspension</h3>
        {message && <p style={{ color: gridColors.buy, fontSize: '13px' }}>{message}</p>}
        <form onSubmit={suspendUser} style={styles.row}>
          <input style={styles.input} placeholder="User ID to suspend" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required />
          <input style={styles.input} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="submit" style={styles.btn(true)}>Suspend</button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
        </div>

        <div className={GRID_THEME_CLASS} style={{ height: '300px', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            theme="legacy"
            rowData={userSwitches}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => params.data.id}
            rowHeight={35}
            headerHeight={35}
          />
        </div>
      </div>
    </div>
  );
}

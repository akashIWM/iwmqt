import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { useGridColumnPersistence } from '../../hooks/useGridColumnPersistence';
import { RMS_LIMIT_FIELDS } from '../../constants/rmsLimitFields';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const styles = {
  card: { backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  text: { color: gridColors.muted, fontSize: '13px', marginBottom: '16px' },
  meta: { fontSize: '12px', color: gridColors.muted, marginBottom: '16px' },
  btn: { padding: '10px 16px', backgroundColor: gridColors.accent, color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', marginTop: '12px' }
};

const FIELDS = RMS_LIMIT_FIELDS;

const buildRows = (config, utilisation) => FIELDS.map((f) => {
  const limit = Number(config[f.key]);
  const used = f.usedKey ? Number(utilisation[f.usedKey]) : null;
  const pct = used !== null ? (used / limit) * 100 : null;
  const status = pct === null ? 'N/A' : pct >= 100 ? 'BREACHED' : pct >= 80 ? 'WARNING' : 'OK';
  return { key: f.key, label: f.label, control: f.control, scope: f.scope, limit, used, pct, status };
});

export default function OmsConfigPanel() {
  const { user } = useAuth();
  const canEdit = user?.role === 'RMS_ADMIN';
  const [rows, setRows] = useState([]);
  const [config, setConfig] = useState(null);
  const [message, setMessage] = useState('');
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:oms-config');

  async function fetchConfig() {
    try {
      const response = await apiFetch('/oms-config');
      const data = await response.json();
      if (response.ok) {
        setConfig(data.config);
        setRows(buildRows(data.config, data.utilisation));
      }
    } catch (err) {
      console.error('Failed to fetch OMS config:', err);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConfig();
  }, []);

  const handleSave = async () => {
    try {
      const body = Object.fromEntries(rows.map((r) => [r.key, r.limit]));
      const response = await apiFetch('/oms-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('OMS configuration updated');
        setConfig(data.config);
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error('Failed to update OMS config:', err);
      setMessage('Network error updating OMS configuration');
    }
  };

  const columnDefs = useMemo(() => [
    { field: 'control', headerName: 'CONTROL', width: 250, cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'scope', headerName: 'SCOPE', width: 90, cellStyle: { color: gridColors.muted } },
    {
      field: 'limit', headerName: 'CONFIGURED LIMIT', width: 150, editable: canEdit,
      valueParser: (p) => Number(p.newValue),
      cellStyle: { color: gridColors.accent, fontWeight: '700', backgroundColor: canEdit ? '#fffbeb' : 'transparent' }
    },
    {
      field: 'used', headerName: 'CURRENT UTILISATION', width: 150,
      valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : '—'),
      cellStyle: { color: gridColors.muted }
    },
    {
      field: 'status', headerName: 'STATUS', width: 110,
      cellStyle: (p) => ({
        fontWeight: '700',
        color: p.value === 'BREACHED' ? gridColors.sell : p.value === 'WARNING' ? gridColors.pending : p.value === 'OK' ? gridColors.buy : gridColors.muted
      })
    }
  ], [canEdit]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `oms-config-${Date.now()}.csv` });
  };

  const onCellValueChanged = (params) => {
    // Recompute pct/status locally so editing a limit updates STATUS immediately, before Save.
    setRows((prev) => prev.map((r) => {
      if (r.key !== params.data.key) return r;
      const pct = r.used !== null ? (r.used / params.data.limit) * 100 : null;
      const status = pct === null ? 'N/A' : pct >= 100 ? 'BREACHED' : pct >= 80 ? 'WARNING' : 'OK';
      return { ...r, limit: params.data.limit, pct, status };
    }));
  };

  return (
    <div style={styles.card}>
      <style>{GRID_THEME_CSS}</style>
      <p style={styles.text}>
        Platform-wide RMS risk limits per the 14 pre-trade controls (spec Section 8).
        {canEdit
          ? ' Double-click CONFIGURED LIMIT to edit, then Save.'
          : ' View-only - edit rights are RMS Admin only.'}
        {' '}Utilisation is the worst case across all users right now; controls checked per-order rather
        than as a running total show "—".
      </p>
      {config && (
        <p style={styles.meta}>
          Last updated {new Date(config.updated_at).toLocaleString()}{config.updated_by ? ` by ${config.updated_by}` : ''}
        </p>
      )}
      {message && <p style={{ color: gridColors.buy, fontSize: '13px' }}>{message}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
          Export CSV
        </button>
      </div>

      <div className={GRID_THEME_CLASS} style={{ height: '400px', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          theme="legacy"
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(params) => params.data.key}
          onCellValueChanged={onCellValueChanged}
          rowHeight={38}
          headerHeight={35}
          {...columnPersistence}
        />
      </div>

      {canEdit && <button style={styles.btn} onClick={handleSave}>SAVE CONFIGURATION</button>}
    </div>
  );
}

import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { syncGridRows } from '../../utils/gridSync';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const getRowId = (row) => row.id;

const styles = {
  card: { backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  text: { color: gridColors.muted, fontSize: '13px', marginBottom: '16px' }
};

export default function AuditLogPanel() {
  const [entryCount, setEntryCount] = useState(0);
  const gridRef = useRef();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchEntries();
    const interval = setInterval(fetchEntries, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchEntries() {
    try {
      const response = await apiFetch('/audit-log?limit=100');
      const data = await response.json();
      if (response.ok) {
        syncGridRows(gridRef.current?.api, data.entries, getRowId);
        setEntryCount(data.entries.length);
      }
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    }
  }

  // Column set per GUI spec 6.2: Timestamp, Actor, Role, Action, Target, Result. "Result"
  // is always SUCCESS today - every logAudit() call site only fires on the success path,
  // there's no failed-action logging yet to give this column a second value.
  const [columnDefs] = useState([
    {
      field: 'created_at', headerName: 'TIMESTAMP', width: 170,
      valueFormatter: (p) => new Date(p.value).toLocaleString(), cellStyle: { color: gridColors.muted, fontSize: '11px' }
    },
    { field: 'actor_user_id', headerName: 'ACTOR', width: 120, valueFormatter: (p) => p.value || 'SYSTEM', cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'actor_role', headerName: 'ROLE', width: 130, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } },
    { field: 'action', headerName: 'ACTION', width: 170, cellStyle: { color: gridColors.accent, fontWeight: '600' } },
    { field: 'target', headerName: 'TARGET', width: 160, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.primary } },
    { headerName: 'RESULT', width: 90, valueGetter: () => 'SUCCESS', cellStyle: { color: gridColors.buy, fontWeight: '700' } },
    { field: 'details', headerName: 'DETAILS', width: 220, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `audit-log-${Date.now()}.csv` });
  };

  return (
    <div style={styles.card}>
      <style>{GRID_THEME_CSS}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <p style={{ ...styles.text, marginBottom: 0 }}>Every RMS/admin action - script bans, kill switches, role and config changes.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
          <span style={{ fontSize: '13px', color: gridColors.muted }}>{entryCount} Entries</span>
        </div>
      </div>

      <div className={GRID_THEME_CLASS} style={{ height: '450px', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          theme="legacy"
          rowData={[]}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(params) => getRowId(params.data)}
          rowHeight={35}
          headerHeight={35}
        />
      </div>
    </div>
  );
}

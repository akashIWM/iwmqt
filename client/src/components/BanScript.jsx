import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { syncGridRows } from '../utils/gridSync';
import { useGridColumnPersistence } from '../hooks/useGridColumnPersistence';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Plain (row) => id form - used directly by syncGridRows and wrapped for AgGridReact's own params.data convention.
const getRowId = (row) => row.symbol;

export default function BanScript() {
  const [bannedCount, setBannedCount] = useState(0);
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:ban-script');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchBannedScripts();
    // Poll every 3 seconds - this is a live risk restriction list, it should stay current.
    const interval = setInterval(fetchBannedScripts, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchBannedScripts() {
    try {
      const response = await apiFetch('/rms/banned', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        syncGridRows(gridRef.current?.api, data.bannedScripts, getRowId);
        setBannedCount(data.bannedScripts.length);
      }
    } catch (err) {
      console.error('Failed to fetch banned scripts:', err);
    }
  }

  // Column set per GUI spec 6.2: Script, ASM stage, GSM stage, Alert flag - reason/banned_at
  // kept as bonus context columns since they're real, useful RMS data the spec doesn't ask for.
  const [columnDefs] = useState([
    { field: 'symbol', headerName: 'SCRIPT', width: 150, cellStyle: { fontWeight: '700', color: gridColors.sell } },
    { field: 'asm_stage', headerName: 'ASM STAGE', width: 110, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } },
    { field: 'gsm_stage', headerName: 'GSM STAGE', width: 110, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } },
    {
      headerName: 'ALERT FLAG', width: 100,
      valueGetter: (p) => (p.data.asm_stage || p.data.gsm_stage ? 'YES' : 'NO'),
      cellStyle: (p) => ({ color: p.value === 'YES' ? gridColors.sell : gridColors.muted, fontWeight: '700' })
    },
    { field: 'reason', headerName: 'RMS REASON', width: 170, cellStyle: { color: gridColors.muted } },
    {
      field: 'banned_at',
      headerName: 'TIME',
      width: 110,
      valueFormatter: (p) => new Date(p.value).toLocaleTimeString(),
      cellStyle: { color: gridColors.muted, fontSize: '11px' }
    }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `ban-script-${Date.now()}.csv` });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '4px' }}>
      <style>{GRID_THEME_CSS}</style>

      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: gridColors.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>RMS Risk Restrictions</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
          <span>{bannedCount} Restricted Symbols</span>
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
          {...columnPersistence}
        />
      </div>
    </div>
  );
}

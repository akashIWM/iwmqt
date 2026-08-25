import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { syncGridRows } from '../utils/gridSync';
import { useGridColumnPersistence } from '../hooks/useGridColumnPersistence';

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

  const [columnDefs] = useState([
    { field: 'symbol', headerName: 'BANNED SCRIPT', width: 140, cellStyle: { fontWeight: '700', color: '#f87171' } },
    { field: 'reason', headerName: 'RMS REASON', width: 150, cellStyle: { color: '#94a3b8' } },
    {
      field: 'banned_at',
      headerName: 'TIME',
      width: 110,
      valueFormatter: (p) => new Date(p.banned_at).toLocaleTimeString(),
      cellStyle: { color: '#64748b', fontSize: '11px' }
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
      <style>{`
        .ag-theme-alpine-dark {
          --ag-background-color: #0f172a;
          --ag-header-background-color: #1e293b;
          --ag-odd-row-background-color: #0f172a;
          --ag-border-color: #334155;
          --ag-row-border-color: #1e293b;
          --ag-header-column-separator-display: none;
          --ag-foreground-color: #f8fafc;
          --ag-header-foreground-color: #f8fafc;
        }
      `}</style>

      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: '#627d98', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>RMS Risk Restrictions</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#334155', color: '#f8fafc' }}>
            Export CSV
          </button>
          <span>{bannedCount} Restricted Symbols</span>
        </div>
      </div>

      <div className="ag-theme-alpine-dark" style={{ height: '450px', width: '100%' }}>
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

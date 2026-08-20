import React, { useState, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export default function BanScript() {
  const [banned, setBanned] = useState([]);

  useEffect(() => {
    fetchBannedScripts();
  }, []);

  const fetchBannedScripts = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/rms/banned', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setBanned(data.bannedScripts);
      }
    } catch (err) {
      console.error('Failed to fetch banned scripts:', err);
    }
  };

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
      
      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: '#627d98', display: 'flex', justifyContent: 'space-between' }}>
        <span>RMS Risk Restrictions</span>
        <span>{banned.length} Restricted Symbols</span>
      </div>

      <div className="ag-theme-alpine-dark" style={{ height: '450px', width: '100%' }}>
        <AgGridReact
          theme="legacy"
          rowData={banned}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowHeight={35}
          headerHeight={35}
        />
      </div>
    </div>
  );
}
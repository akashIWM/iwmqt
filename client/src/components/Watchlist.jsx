import { useState, useEffect, useMemo, useRef } from 'react';
import { WS_BASE_URL } from '../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { useGridColumnPersistence } from '../hooks/useGridColumnPersistence';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export default function Watchlist() {
  const [rowData, setRowData] = useState([]);
  const [connected, setConnected] = useState(false);
  const gridRef = useRef();
  const lastSeqRef = useRef(null);
  const columnPersistence = useGridColumnPersistence('grid-columns:watchlist');

  useEffect(() => {
    let isMounted = true; // Guard flag
    const ws = new WebSocket(`${WS_BASE_URL}/ws/market-data`);

    ws.onopen = () => {
      if (isMounted) setConnected(true);
    };

    ws.onclose = () => {
      if (isMounted) setConnected(false);
    };

    ws.onmessage = (event) => {
      if (!isMounted) return; // Ignore messages if unmounted
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'INITIAL_SNAPSHOT') {
          lastSeqRef.current = message.seq;
          setRowData(message.data);
          return;
        }

        if (message.type === 'MARKET_DELTA') {
          // A gap in seq means a dropped message - ask the server for a fresh snapshot
          // instead of silently drifting out of sync.
          if (lastSeqRef.current !== null && message.seq !== lastSeqRef.current + 1) {
            ws.send(JSON.stringify({ type: 'RESYNC_REQUEST' }));
            return;
          }
          lastSeqRef.current = message.seq;
          gridRef.current?.api?.applyTransactionAsync({ update: message.changes });
        }
      } catch (err) {
        console.error('Failed to parse tick message:', err);
      }
    };

    return () => {
      isMounted = false; // Prevent ghost connections from altering UI state
      if (ws.readyState === 1) ws.close();
      else if (ws.readyState === 0) ws.onopen = () => ws.close();
    };
  }, []);

  // Cleaned up Column Definitions (No background flashing)
  const [columnDefs] = useState([
    { field: 'symbol', headerName: 'INSTRUMENT', flex: 1.5, minWidth: 160, pinned: 'left', cellStyle: { fontWeight: '700', color: '#f8fafc' } },
    {
      field: 'ltp',
      headerName: 'LTP',
      flex: 1,
      valueFormatter: (p) => `₹${p.value?.toFixed(2) || '0.00'}`,
      cellStyle: { fontWeight: '700', color: '#38bdf8' }, // Constant Cyan text color
      enableCellChangeFlash: true
    },
    {
      field: 'change',
      headerName: 'CHG',
      flex: 1,
      valueFormatter: (p) => p.value > 0 ? `+${p.value?.toFixed(2)}` : p.value?.toFixed(2),
      cellStyle: (p) => ({ color: p.value >= 0 ? '#4ade80' : '#f87171', fontWeight: '600' }), // Text changes color, not background
      enableCellChangeFlash: true
    },
    {
      field: 'pChange',
      headerName: '% CHG',
      flex: 1,
      valueFormatter: (p) => `${p.value > 0 ? '+' : ''}${p.value?.toFixed(2) || '0'}%`,
      cellStyle: (p) => ({ color: p.value >= 0 ? '#4ade80' : '#f87171' }),
      enableCellChangeFlash: true
    },
    { field: 'bid', headerName: 'BID', flex: 1, valueFormatter: (p) => `₹${p.value?.toFixed(2)}`, cellStyle: { color: '#94a3b8' }, enableCellChangeFlash: true },
    { field: 'ask', headerName: 'ASK', flex: 1, valueFormatter: (p) => `₹${p.value?.toFixed(2)}`, cellStyle: { color: '#94a3b8' }, enableCellChangeFlash: true },
    { field: 'high', headerName: 'HIGH', flex: 1, valueFormatter: (p) => p.value?.toFixed(2), cellStyle: { color: '#64748b' } },
    { field: 'low', headerName: 'LOW', flex: 1, valueFormatter: (p) => p.value?.toFixed(2), cellStyle: { color: '#64748b' } }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '13px', display: 'flex', alignItems: 'center' }
  }), []);

  const getRowId = useMemo(() => (params) => params.data.symbol, []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `watchlist-${Date.now()}.csv` });
  };

  const styles = {
    container: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0f172a', // Deep terminal navy
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 20px',
      backgroundColor: '#1e293b',
      borderBottom: '1px solid #334155'
    },
    title: { margin: 0, fontSize: '15px', fontWeight: '700', color: '#f8fafc', letterSpacing: '0.5px' },
    headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
    exportBtn: {
      fontSize: '11px', padding: '4px 10px', borderRadius: '6px', fontWeight: '700',
      backgroundColor: '#334155', color: '#f8fafc', border: 'none', cursor: 'pointer'
    },
    badge: {
      fontSize: '11px',
      padding: '4px 10px',
      borderRadius: '6px',
      fontWeight: '700',
      backgroundColor: connected ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
      color: connected ? '#4ade80' : '#f87171',
      border: `1px solid ${connected ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`
    }
  };

  return (
    <div style={styles.container}>
      {/* Basic AG Grid Dark Theme Overrides without flash animations */}
      <style>{`
        .ag-theme-alpine-dark {
          --ag-background-color: #0f172a;
          --ag-header-background-color: #1e293b;
          --ag-odd-row-background-color: #0f172a;
          --ag-border-color: #334155;
          --ag-row-border-color: #1e293b;
          --ag-header-column-separator-display: none;
        }
      `}</style>

      <div style={styles.header}>
        <h4 style={styles.title}>SCRIPT WATCH</h4>
        <div style={styles.headerRight}>
          <button style={styles.exportBtn} onClick={handleExportCsv}>Export CSV</button>
          <span style={styles.badge}>{connected ? '● LIVE FEED' : '○ DISCONNECTED'}</span>
        </div>
      </div>

      <div className="ag-theme-alpine-dark" style={{ height: '450px', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          theme="legacy"
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          animateRows={false}
          rowHeight={40}
          headerHeight={40}
          {...columnPersistence}
        />
      </div>
    </div>
  );
}

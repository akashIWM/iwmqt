import { useState, useEffect, useMemo, useRef } from 'react';
import { WS_BASE_URL } from '../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { useGridColumnPersistence } from '../hooks/useGridColumnPersistence';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../styles/gridTheme';

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

  // Column set per GUI spec 6.2: Instrument, Symbol, Expiry, Option Type, Strike Price,
  // LTP, Bid, Ask, Chg% - plus High/Low/absolute Chg kept from the original build.
  const [columnDefs] = useState([
    { field: 'instrument', headerName: 'INSTRUMENT', width: 110, cellStyle: { color: gridColors.muted } },
    { field: 'symbol', headerName: 'SYMBOL', flex: 1.5, minWidth: 160, pinned: 'left', cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'expiry', headerName: 'EXPIRY', width: 100, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } },
    { field: 'optionType', headerName: 'OPTION TYPE', width: 110, valueFormatter: (p) => p.value || 'FUT', cellStyle: { color: gridColors.muted } },
    { field: 'strikePrice', headerName: 'STRIKE PRICE', width: 110, valueFormatter: (p) => p.value ?? '—', cellStyle: { color: gridColors.muted } },
    {
      field: 'ltp',
      headerName: 'LTP',
      flex: 1,
      valueFormatter: (p) => `₹${p.value?.toFixed(2) || '0.00'}`,
      cellStyle: { fontWeight: '700', color: gridColors.accent },
      enableCellChangeFlash: true
    },
    {
      field: 'change',
      headerName: 'CHG',
      flex: 1,
      valueFormatter: (p) => p.value > 0 ? `+${p.value?.toFixed(2)}` : p.value?.toFixed(2),
      cellStyle: (p) => ({ color: p.value >= 0 ? gridColors.buy : gridColors.sell, fontWeight: '600' }),
      enableCellChangeFlash: true
    },
    {
      field: 'pChange',
      headerName: '% CHG',
      flex: 1,
      valueFormatter: (p) => `${p.value > 0 ? '+' : ''}${p.value?.toFixed(2) || '0'}%`,
      cellStyle: (p) => ({ color: p.value >= 0 ? gridColors.buy : gridColors.sell }),
      enableCellChangeFlash: true
    },
    { field: 'bid', headerName: 'BID', flex: 1, valueFormatter: (p) => `₹${p.value?.toFixed(2)}`, cellStyle: { color: gridColors.muted }, enableCellChangeFlash: true },
    { field: 'ask', headerName: 'ASK', flex: 1, valueFormatter: (p) => `₹${p.value?.toFixed(2)}`, cellStyle: { color: gridColors.muted }, enableCellChangeFlash: true },
    { field: 'high', headerName: 'HIGH', flex: 1, valueFormatter: (p) => p.value?.toFixed(2), cellStyle: { color: gridColors.muted } },
    { field: 'low', headerName: 'LOW', flex: 1, valueFormatter: (p) => p.value?.toFixed(2), cellStyle: { color: gridColors.muted } }
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
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
      border: '1px solid #e2e8f0'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 20px',
      backgroundColor: '#f1f5f9',
      borderBottom: '1px solid #e2e8f0'
    },
    title: { margin: 0, fontSize: '15px', fontWeight: '700', color: gridColors.primary, letterSpacing: '0.5px' },
    headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
    exportBtn: {
      fontSize: '11px', padding: '4px 10px', borderRadius: '6px', fontWeight: '700',
      backgroundColor: '#e2e8f0', color: gridColors.primary, border: 'none', cursor: 'pointer'
    },
    badge: {
      fontSize: '11px',
      padding: '4px 10px',
      borderRadius: '6px',
      fontWeight: '700',
      backgroundColor: connected ? 'rgba(43, 138, 62, 0.1)' : 'rgba(201, 42, 42, 0.1)',
      color: connected ? gridColors.buy : gridColors.sell,
      border: `1px solid ${connected ? 'rgba(43, 138, 62, 0.3)' : 'rgba(201, 42, 42, 0.3)'}`
    }
  };

  return (
    <div style={styles.container}>
      <style>{GRID_THEME_CSS}</style>

      <div style={styles.header}>
        <h4 style={styles.title}>MARKET WATCH</h4>
        <div style={styles.headerRight}>
          <button style={styles.exportBtn} onClick={handleExportCsv}>Export CSV</button>
          <span style={styles.badge}>{connected ? '● LIVE FEED' : '○ DISCONNECTED'}</span>
        </div>
      </div>

      <div className={GRID_THEME_CLASS} style={{ height: '450px', width: '100%' }}>
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

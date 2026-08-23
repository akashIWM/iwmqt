import { useState, useEffect, useMemo, useRef } from 'react';
import { WS_BASE_URL } from '../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export default function Watchlist() {
  const [rowData, setRowData] = useState([]);
  const [connected, setConnected] = useState(false);
  const gridRef = useRef();

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
        if (message.type === 'INITIAL_SNAPSHOT' || message.type === 'MARKET_TICK') {
          setRowData(message.data);
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
      cellStyle: { fontWeight: '700', color: '#38bdf8' } // Constant Cyan text color
    },
    { 
      field: 'change', 
      headerName: 'CHG',
      flex: 1,
      valueFormatter: (p) => p.value > 0 ? `+${p.value?.toFixed(2)}` : p.value?.toFixed(2),
      cellStyle: (p) => ({ color: p.value >= 0 ? '#4ade80' : '#f87171', fontWeight: '600' }) // Text changes color, not background
    },
    { 
      field: 'pChange', 
      headerName: '% CHG',
      flex: 1,
      valueFormatter: (p) => `${p.value > 0 ? '+' : ''}${p.value?.toFixed(2) || '0'}%`,
      cellStyle: (p) => ({ color: p.value >= 0 ? '#4ade80' : '#f87171' })
    },
    { field: 'bid', headerName: 'BID', flex: 1, valueFormatter: (p) => `₹${p.value?.toFixed(2)}`, cellStyle: { color: '#94a3b8' } },
    { field: 'ask', headerName: 'ASK', flex: 1, valueFormatter: (p) => `₹${p.value?.toFixed(2)}`, cellStyle: { color: '#94a3b8' } },
    { field: 'high', headerName: 'HIGH', flex: 1, valueFormatter: (p) => p.value?.toFixed(2), cellStyle: { color: '#64748b' } },
    { field: 'low', headerName: 'LOW', flex: 1, valueFormatter: (p) => p.value?.toFixed(2), cellStyle: { color: '#64748b' } }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '13px', display: 'flex', alignItems: 'center' }
  }), []);

  const getRowId = useMemo(() => (params) => params.data.symbol, []);

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
      padding: '12px 20px', 
      backgroundColor: '#1e293b', 
      borderBottom: '1px solid #334155' 
    },
    title: { margin: 0, fontSize: '15px', fontWeight: '700', color: '#f8fafc', letterSpacing: '0.5px' },
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
        <span style={styles.badge}>{connected ? '● LIVE FEED' : '○ DISCONNECTED'}</span>
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
        />
      </div>
    </div>
  );
}
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

const getRowId = (row) => row.id;

// Trade Book (fills) per GUI spec 6.2 - separate from Order Book. Sourced from the real
// `fills` table (one row per actual execution, including each individual slice of a
// partially filled order), not a filtered view of orders.
export default function TradeBook() {
  const [tradeCount, setTradeCount] = useState(0);
  const [groupBy, setGroupBy] = useState(null); // null | 'token' | 'oms'
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:trade-book');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchTrades();
    const interval = setInterval(fetchTrades, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchTrades() {
    try {
      const response = await apiFetch('/orders/fills');
      const data = await response.json();
      if (response.ok) {
        syncGridRows(gridRef.current?.api, data.fills, getRowId);
        setTradeCount(data.fills.length);
      }
    } catch (err) {
      console.error('Failed to fetch trade book:', err);
    }
  }

  const [columnDefs] = useState([
    { field: 'user_id', headerName: 'OMS / TRADER', width: 110, cellStyle: { color: gridColors.muted } },
    { field: 'symbol', headerName: 'SCRIPT', width: 150, cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'token', headerName: 'TOKEN', width: 80, cellStyle: { color: gridColors.muted } },
    {
      field: 'side', headerName: 'SIDE', width: 70,
      cellStyle: (p) => ({ color: p.value === 'BUY' ? gridColors.buy : gridColors.sell, fontWeight: '700' })
    },
    { field: 'quantity', headerName: 'QTY', width: 80, cellStyle: { color: gridColors.primary } },
    { field: 'price', headerName: 'PRICE', width: 90, valueFormatter: (p) => `₹${Number(p.value).toFixed(2)}`, cellStyle: { color: gridColors.price } },
    {
      field: 'created_at', headerName: 'TIME', width: 150,
      valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : '—'), cellStyle: { color: gridColors.muted, fontSize: '11px' }
    }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `trade-book-${Date.now()}.csv` });
  };

  // Community-tier stand-in for OMS-wise/Token-wise grouping, same pattern as Net Positions.
  const setGrouping = (mode) => {
    const next = groupBy === mode ? null : mode;
    setGroupBy(next);
    const colId = next === 'oms' ? 'user_id' : next === 'token' ? 'token' : null;
    gridRef.current?.api?.applyColumnState({
      state: colId ? [{ colId, sort: 'asc' }] : [{ colId: 'user_id', sort: null }, { colId: 'token', sort: null }]
    });
  };

  const groupBtnStyle = (active) => ({
    fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700',
    backgroundColor: active ? gridColors.accent : '#e2e8f0', color: active ? '#ffffff' : gridColors.primary
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{GRID_THEME_CSS}</style>

      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: gridColors.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Trade Book</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setGrouping('oms')} style={groupBtnStyle(groupBy === 'oms')}>OMS-wise</button>
          <button onClick={() => setGrouping('token')} style={groupBtnStyle(groupBy === 'token')}>Token-wise</button>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
          <span>{tradeCount} Trades</span>
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

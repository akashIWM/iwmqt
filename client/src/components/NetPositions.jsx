import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { syncGridRows } from '../utils/gridSync';
import { useGridColumnPersistence } from '../hooks/useGridColumnPersistence';
import { useOrderUpdates } from '../hooks/useOrderUpdates';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// symbol alone is no longer unique once RMS/Super Admin see every trader's positions -
// composite id keeps each (user, symbol) pair distinct.
const getRowId = (row) => `${row.user_id}:${row.symbol}`;

export default function NetPositions() {
  const [positionCount, setPositionCount] = useState(0);
  const [groupBy, setGroupBy] = useState(null); // null | 'token' | 'oms'
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:net-positions');

  useEffect(() => {
    // The very first fetch is triggered from onGridReady on the grid below, not here -
    // syncGridRows() silently no-ops if the grid API isn't attached yet, and a mount-time
    // fetch can resolve before AG Grid finishes its own init (see OrderBook.jsx for the
    // full explanation of this race and why it caused "count updates, grid stays empty").
    // Unlike the other grids, this poll isn't just a fallback net: P&L moves continuously
    // with LTP (via market ticks), not only when an order/fill event fires, so it still
    // needs a real cadence of its own rather than the long fallback interval used elsewhere.
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  // Refetch immediately on a fill/cancel too, instead of waiting up to 5s to see a new
  // position appear.
  useOrderUpdates(fetchPositions);

  async function fetchPositions() {
    try {
      const response = await apiFetch('/positions');
      const data = await response.json();
      if (response.ok) {
        syncGridRows(gridRef.current?.api, data.positions, getRowId);
        setPositionCount(data.positions.length);
      }
    } catch (err) {
      console.error('Failed to fetch positions:', err);
    }
  }

  const [columnDefs] = useState([
    { field: 'user_id', headerName: 'OMS / TRADER', width: 110, cellStyle: { color: gridColors.muted } },
    { field: 'symbol', headerName: 'INSTRUMENT', width: 140, pinned: 'left', cellStyle: { fontWeight: '700', color: gridColors.primary } },
    {
      field: 'net_qty', headerName: 'NET QTY', width: 90, enableCellChangeFlash: true,
      cellStyle: (p) => ({ color: Number(p.value) > 0 ? gridColors.buy : gridColors.sell, fontWeight: '700' })
    },
    {
      field: 'avg_price', headerName: 'AVG PRICE', width: 100, enableCellChangeFlash: true,
      valueFormatter: (p) => `₹${Number(p.value).toFixed(2)}`, cellStyle: { color: gridColors.accent }
    },
    { field: 'expiry', headerName: 'EXPIRY', width: 90, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } },
    {
      field: 'ltp', headerName: 'LTP', width: 90, enableCellChangeFlash: true,
      valueFormatter: (p) => (p.value != null ? `₹${Number(p.value).toFixed(2)}` : '—'), cellStyle: { color: gridColors.accent }
    },
    {
      field: 'pnl', headerName: 'P&L', width: 100, enableCellChangeFlash: true,
      valueFormatter: (p) => (p.value != null ? `₹${Number(p.value).toFixed(2)}` : '—'),
      cellStyle: (p) => ({ color: p.value > 0 ? gridColors.buy : p.value < 0 ? gridColors.sell : gridColors.pending, fontWeight: '700' })
    }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `net-positions-${Date.now()}.csv` });
  };

  // Community-tier stand-in for OMS-wise/Token-wise grouping (needs AG Grid Enterprise for
  // real collapsible row groups) - segments rows via a plain sort instead.
  const setGrouping = (mode) => {
    const next = groupBy === mode ? null : mode;
    setGroupBy(next);
    const colId = next === 'oms' ? 'user_id' : next === 'token' ? 'symbol' : null;
    gridRef.current?.api?.applyColumnState({
      state: colId ? [{ colId, sort: 'asc' }] : [{ colId: 'user_id', sort: null }, { colId: 'symbol', sort: null }]
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
        <span>Open Market Positions</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setGrouping('oms')} style={groupBtnStyle(groupBy === 'oms')}>OMS-wise</button>
          <button onClick={() => setGrouping('token')} style={groupBtnStyle(groupBy === 'token')}>Token-wise</button>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
          <span>{positionCount} Active</span>
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
          onGridReady={(params) => {
            columnPersistence.onGridReady(params);
            fetchPositions();
          }}
        />
      </div>
    </div>
  );
}

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

const eventColor = (event) => {
  switch (event) {
    case 'EXECUTED': return gridColors.executed;
    case 'CANCELLED': return gridColors.cancelled;
    default: return gridColors.pending; // PLACED
  }
};

// Order Logs grid per GUI spec 6.2: Timestamp, Order Type, Script details, Quantity,
// Price, Event/Status - a real append-only feed of order lifecycle events (order_events
// table), capped at a 200-row rolling buffer server-side. Replaces the earlier fake
// heartbeat placeholder that had nothing to do with actual order activity.
export default function LogWindow() {
  const [eventCount, setEventCount] = useState(0);
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:log-window');

  useEffect(() => {
    // The very first fetch is triggered from onGridReady on the grid below, not here -
    // syncGridRows() silently no-ops if the grid API isn't attached yet, and a mount-time
    // fetch can resolve before AG Grid finishes its own init (see OrderBook.jsx for the
    // full explanation of this race and why it caused "count updates, grid stays empty").
    const interval = setInterval(fetchEvents, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchEvents() {
    try {
      const response = await apiFetch('/orders/events');
      const data = await response.json();
      if (response.ok) {
        syncGridRows(gridRef.current?.api, data.events, getRowId);
        setEventCount(data.events.length);
      }
    } catch (err) {
      console.error('Failed to fetch order events:', err);
    }
  }

  const [columnDefs] = useState([
    {
      field: 'created_at', headerName: 'TIMESTAMP', width: 150,
      valueFormatter: (p) => new Date(p.value).toLocaleTimeString(), cellStyle: { color: gridColors.muted, fontSize: '11px' }
    },
    { field: 'order_type', headerName: 'ORDER TYPE', width: 100, cellStyle: { color: gridColors.primary } },
    { field: 'symbol', headerName: 'SCRIPT', width: 150, pinned: 'left', cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'quantity', headerName: 'QTY', width: 80, enableCellChangeFlash: true, cellStyle: { color: gridColors.primary } },
    { field: 'price', headerName: 'PRICE', width: 90, enableCellChangeFlash: true, valueFormatter: (p) => (p.value ? `₹${Number(p.value).toFixed(2)}` : 'MKT'), cellStyle: { color: gridColors.price } },
    {
      field: 'event', headerName: 'EVENT / STATUS', width: 130, enableCellChangeFlash: true,
      cellStyle: (p) => ({ color: eventColor(p.value), fontWeight: '700' })
    }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `order-logs-${Date.now()}.csv` });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{GRID_THEME_CSS}</style>
      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: gridColors.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Order Logs</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
          <span>{eventCount} Events</span>
        </div>
      </div>

      <div className={GRID_THEME_CLASS} style={{ flex: 1, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          theme="legacy"
          rowData={[]}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(params) => getRowId(params.data)}
          rowHeight={32}
          headerHeight={32}
          {...columnPersistence}
          onGridReady={(params) => {
            columnPersistence.onGridReady(params);
            fetchEvents();
          }}
        />
      </div>
    </div>
  );
}

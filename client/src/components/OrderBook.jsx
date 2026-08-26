import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { syncGridRows } from '../utils/gridSync';
import { useGridColumnPersistence } from '../hooks/useGridColumnPersistence';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors, statusColor } from '../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Plain (row) => id form - used directly by syncGridRows and wrapped for AgGridReact's own params.data convention.
const getRowId = (row) => row.id;

export default function OrderBook() {
  const [orderCount, setOrderCount] = useState(0);
  const [groupBySymbol, setGroupBySymbol] = useState(false);
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:order-book');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchOrders();
    // Poll every 3 seconds to keep order status updated
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchOrders() {
    try {
      const response = await apiFetch('/orders');
      const data = await response.json();
      if (response.ok) {
        syncGridRows(gridRef.current?.api, data.orders, getRowId);
        setOrderCount(data.orders.length);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }

  // Column set per GUI spec 6.2 - wider than the 400px side panel, so this grid scrolls
  // horizontally within it (standard AG Grid behavior, and unavoidable at this column count).
  const [columnDefs] = useState([
    { field: 'id', headerName: 'INTERNAL ORDER ID', width: 130, valueFormatter: (p) => p.value?.slice(0, 8), cellStyle: { color: gridColors.muted } },
    { field: 'exchange_order_id', headerName: 'EXCHANGE ORDER ID', width: 150, cellStyle: { color: gridColors.muted } },
    { field: 'token', headerName: 'TOKEN', width: 80, cellStyle: { color: gridColors.muted } },
    { field: 'symbol', headerName: 'SCRIPT', width: 150, cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'expiry', headerName: 'EXPIRY', width: 90, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } },
    { field: 'type', headerName: 'ORDER TYPE', width: 95, cellStyle: { color: gridColors.primary } },
    {
      field: 'price', headerName: 'PRICE', width: 85, enableCellChangeFlash: true,
      valueFormatter: (p) => p.value ? `₹${Number(p.value).toFixed(2)}` : 'MKT', cellStyle: { color: gridColors.price }
    },
    { field: 'quantity', headerName: 'QTY', width: 70, enableCellChangeFlash: true, cellStyle: { color: gridColors.primary } },
    { field: 'filled_quantity', headerName: 'FILLED QTY', width: 90, enableCellChangeFlash: true, cellStyle: { color: gridColors.muted } },
    {
      field: 'side', headerName: 'SIDE', width: 65,
      cellStyle: (p) => ({ color: p.value === 'BUY' ? gridColors.buy : gridColors.sell, fontWeight: '700' })
    },
    { field: 'pan', headerName: 'PAN', width: 100, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } },
    { field: 'nnf_id', headerName: 'NNF', width: 90, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } },
    { field: 'neat_id', headerName: 'NEAT ID', width: 90, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } },
    {
      field: 'status', headerName: 'STATUS', width: 90, enableCellChangeFlash: true,
      cellStyle: (p) => ({ color: statusColor(p.value), fontWeight: '700' })
    }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `order-book-${Date.now()}.csv` });
  };

  // Community-tier stand-in for Token-wise grouping (needs AG Grid Enterprise + row
  // grouping, neither of which is installed) - segments rows by token via a plain sort
  // instead of collapsible group headers.
  const toggleGroupByToken = () => {
    const next = !groupBySymbol;
    setGroupBySymbol(next);
    gridRef.current?.api?.applyColumnState({
      state: next ? [{ colId: 'token', sort: 'asc' }] : [{ colId: 'token', sort: null }]
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{GRID_THEME_CSS}</style>

      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: gridColors.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Active Order History</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleGroupByToken}
            style={{
              fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700',
              backgroundColor: groupBySymbol ? gridColors.accent : '#e2e8f0', color: groupBySymbol ? '#ffffff' : gridColors.primary
            }}
          >
            Group by Token
          </button>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
          <span>{orderCount} Total Orders</span>
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

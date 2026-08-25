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

  // Fixed widths to fit the 400px side panel cleanly without horizontal scrollbars
  const [columnDefs] = useState([
    { field: 'symbol', headerName: 'INSTRUMENT', width: 135, cellStyle: { fontWeight: '700', color: '#f8fafc' } },
    {
      field: 'side',
      headerName: 'SIDE',
      width: 65,
      cellStyle: (p) => ({ color: p.value === 'BUY' ? '#4ade80' : '#f87171', fontWeight: '700' })
    },
    { field: 'quantity', headerName: 'QTY', width: 60, cellStyle: { color: '#f8fafc' } },
    { field: 'price', headerName: 'PRICE', width: 75, valueFormatter: (p) => p.value ? `₹${Number(p.value).toFixed(2)}` : 'MKT', cellStyle: { color: '#38bdf8' } },
    { field: 'expiry', headerName: 'EXPIRY', width: 90, valueFormatter: (p) => p.value || '—', cellStyle: { color: '#94a3b8' } },
    {
      field: 'status',
      headerName: 'STATUS',
      width: 85,
      cellStyle: (p) => ({
        color: p.value === 'EXECUTED' ? '#4ade80' : p.value === 'PENDING' ? '#facc15' : '#f87171',
        fontWeight: '700'
      })
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

  // Community-tier stand-in for OMS/Token-wise grouping (needs AG Grid Enterprise +
  // a real OMS/Token field, neither of which exist yet) - segments rows by symbol via a
  // plain sort instead of collapsible group headers.
  const toggleGroupBySymbol = () => {
    const next = !groupBySymbol;
    setGroupBySymbol(next);
    gridRef.current?.api?.applyColumnState({
      state: next ? [{ colId: 'symbol', sort: 'asc' }] : [{ colId: 'symbol', sort: null }]
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
        <span>Active Order History</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleGroupBySymbol}
            style={{
              fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700',
              backgroundColor: groupBySymbol ? '#38bdf8' : '#334155', color: groupBySymbol ? '#0f172a' : '#f8fafc'
            }}
          >
            Group by Symbol
          </button>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#334155', color: '#f8fafc' }}>
            Export CSV
          </button>
          <span>{orderCount} Total Orders</span>
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

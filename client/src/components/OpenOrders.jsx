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

const getRowId = (row) => row.id;

export default function OpenOrders() {
  const [openCount, setOpenCount] = useState(0);
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:open-orders');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchOpenOrders();
    const interval = setInterval(fetchOpenOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchOpenOrders() {
    try {
      const response = await apiFetch('/orders');
      const data = await response.json();
      if (response.ok) {
        // Partially filled orders are still open (the remainder is live in the book) and
        // belong here too, not just untouched PENDING ones.
        const pending = data.orders.filter((o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED');
        // Transaction-based update (add/update/remove by row id), never a full rowData
        // replacement - per the AG Grid contract, this is required, not just a nicety.
        syncGridRows(gridRef.current?.api, pending, getRowId);
        setOpenCount(pending.length);
      }
    } catch (err) {
      console.error('Failed to fetch open orders:', err);
    }
  }

  const cancelOrder = async (orderId) => {
    try {
      const response = await apiFetch(`/orders/${orderId}/cancel`, { method: 'PUT' });
      if (response.ok) {
        fetchOpenOrders();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to cancel order');
      }
    } catch (err) {
      console.error('Error cancelling order:', err);
    }
  };

  const [columnDefs] = useState([
    { field: 'id', headerName: 'ORDER ID', width: 100, valueFormatter: (p) => p.value?.slice(0, 8), cellStyle: { color: gridColors.muted } },
    { field: 'symbol', headerName: 'INSTRUMENT', width: 140, cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'token', headerName: 'TOKEN', width: 80, cellStyle: { color: gridColors.muted } },
    { field: 'expiry', headerName: 'EXPIRY', width: 90, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } },
    {
      field: 'side', headerName: 'SIDE', width: 70,
      cellStyle: (p) => ({ color: p.value === 'BUY' ? gridColors.buy : gridColors.sell, fontWeight: '700' })
    },
    { field: 'quantity', headerName: 'QTY', width: 70, enableCellChangeFlash: true, cellStyle: { color: gridColors.primary } },
    {
      headerName: 'REMAINING', width: 90, enableCellChangeFlash: true,
      valueGetter: (p) => Number(p.data.quantity) - Number(p.data.filled_quantity),
      cellStyle: { color: gridColors.primary }
    },
    {
      field: 'price', headerName: 'PRICE', width: 85, enableCellChangeFlash: true,
      valueFormatter: (p) => (p.value ? `₹${p.value}` : 'MKT'), cellStyle: { color: gridColors.price }
    },
    {
      field: 'status', headerName: 'STATUS', width: 90, enableCellChangeFlash: true,
      cellStyle: (p) => ({ color: statusColor(p.value), fontWeight: '700' })
    },
    {
      headerName: 'ACTION',
      width: 90,
      cellRenderer: (params) => (
        <button
          onClick={() => cancelOrder(params.data.id)}
          style={{
            backgroundColor: gridColors.sell,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '10px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          CANCEL
        </button>
      )
    }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `open-orders-${Date.now()}.csv` });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{GRID_THEME_CSS}</style>

      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: gridColors.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Pending Working Orders</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
          <span>{openCount} Open</span>
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

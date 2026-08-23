import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export default function OpenOrders() {
  const [openOrders, setOpenOrders] = useState([]);

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
        // Filter only pending active orders
        const pending = data.orders.filter(o => o.status === 'PENDING');
        setOpenOrders(pending);
      }
    } catch (err) {
      console.error('Failed to fetch open orders:', err);
    }
  }

  const cancelOrder = async (orderId) => {
    try {
      const response = await apiFetch(`/orders/${orderId}/cancel`, {
        method: 'PUT',
      });
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
    { field: 'symbol', headerName: 'INSTRUMENT', width: 130, cellStyle: { fontWeight: '700', color: '#f8fafc' } },
    { 
      field: 'side', 
      headerName: 'SIDE', 
      width: 75, 
      cellStyle: (p) => ({ color: p.value === 'BUY' ? '#4ade80' : '#f87171', fontWeight: '700' }) 
    },
    { field: 'quantity', headerName: 'QTY', width: 75, cellStyle: { color: '#38bdf8' } },
    { 
      field: 'price', 
      headerName: 'PRICE', 
      width: 85, 
      valueFormatter: (p) => p.value ? `₹${p.value}` : 'MKT',
      cellStyle: { color: '#facc15' } 
    },
    {
      headerName: 'ACTION',
      width: 90,
      cellRenderer: (params) => (
        <button 
          onClick={() => cancelOrder(params.data.id)}
          style={{
            backgroundColor: '#ef4444',
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

  const getRowId = useMemo(() => (params) => params.data.id, []);

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
      
      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: '#627d98', display: 'flex', justifyContent: 'space-between' }}>
        <span>Pending Working Orders</span>
        <span>{openOrders.length} Open</span>
      </div>

      <div className="ag-theme-alpine-dark" style={{ height: '450px', width: '100%' }}>
        <AgGridReact
          theme="legacy"
          rowData={openOrders}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          rowHeight={35}
          headerHeight={35}
        />
      </div>
    </div>
  );
}
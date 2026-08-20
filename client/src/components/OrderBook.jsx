import React, { useState, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export default function OrderBook() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    // Poll every 3 seconds to keep order status updated
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

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
        <span>Active Order History</span>
        <span>{orders.length} Total Orders</span>
      </div>

      <div className="ag-theme-alpine-dark" style={{ height: '450px', width: '100%' }}>
        <AgGridReact
          theme="legacy"
          rowData={orders}
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
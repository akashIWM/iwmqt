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
const getRowId = (row) => row.symbol;

export default function NetPositions() {
  const [positionCount, setPositionCount] = useState(0);
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:net-positions');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchPositions();
    const interval = setInterval(fetchPositions, 3000);
    return () => clearInterval(interval);
  }, []);

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
    { field: 'symbol', headerName: 'INSTRUMENT', width: 140, cellStyle: { fontWeight: '700', color: '#f8fafc' } },
    {
      field: 'net_qty',
      headerName: 'NET QTY',
      width: 90,
      cellStyle: (p) => ({ color: Number(p.value) > 0 ? '#4ade80' : '#f87171', fontWeight: '700' })
    },
    {
      field: 'avg_price',
      headerName: 'AVG PRICE',
      width: 100,
      valueFormatter: (p) => `₹${Number(p.value).toFixed(2)}`,
      cellStyle: { color: '#38bdf8' }
    },
    {
      headerName: 'P&L',
      width: 90,
      valueGetter: () => '₹0.00', // Mock P&L placeholder until live LTP ticks are hooked up
      cellStyle: { color: '#facc15', fontWeight: '700' }
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
        <span>Open Market Positions</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#334155', color: '#f8fafc' }}>
            Export CSV
          </button>
          <span>{positionCount} Active Symbols</span>
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

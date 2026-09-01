import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { useGridColumnPersistence } from '../../hooks/useGridColumnPersistence';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Read-only per-trader limit utilisation for a PM's own desk (spec 2.1: "per-trader limit
// utilisation view (read-only)") - distinct from RmsStatsSummary, which is a platform-wide
// aggregate snapshot, not broken out by trader. A PM needs to see WHICH trader is near a
// limit, not just that the desk as a whole is fine on average.
const DIMENSIONS = [
  { usedKey: 'open_order_value', limitKey: 'max_open_order_value', label: 'OPEN ORDER VALUE' },
  { usedKey: 'position_qty', limitKey: 'max_position_qty', label: 'POSITION QTY' },
  { usedKey: 'exposure_value', limitKey: 'max_exposure_value', label: 'EXPOSURE' },
  { usedKey: 'turnover_value', limitKey: 'max_turnover_value', label: 'TURNOVER' },
  { usedKey: 'open_orders_count', limitKey: 'max_open_orders_count', label: 'OPEN ORDERS' }
];

const statusFor = (pct) => (pct >= 100 ? 'BREACHED' : pct >= 80 ? 'WARNING' : 'OK');
const statusColor = (status) => (
  status === 'BREACHED' ? gridColors.sell : status === 'WARNING' ? gridColors.pending : gridColors.buy
);

export default function DeskLimitUtilisation() {
  const [traders, setTraders] = useState([]);
  const [limits, setLimits] = useState(null);
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:desk-limit-utilisation');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchUtilisation();
    const interval = setInterval(fetchUtilisation, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchUtilisation() {
    try {
      const response = await apiFetch('/rms/desk-utilisation');
      const data = await response.json();
      if (response.ok) {
        setLimits(data.limits);
        setTraders(data.traders);
      }
    } catch (err) {
      console.error('Failed to fetch desk utilisation:', err);
    }
  }

  const columnDefs = useMemo(() => {
    if (!limits) return [];
    const dimensionCols = DIMENSIONS.map((d) => ({
      headerName: d.label,
      width: 160,
      valueGetter: (p) => {
        const used = Number(p.data[d.usedKey]);
        const limit = Number(limits[d.limitKey]);
        const pct = limit > 0 ? (used / limit) * 100 : 0;
        return { used, limit, pct, status: statusFor(pct) };
      },
      valueFormatter: (p) => `${p.value.used.toLocaleString()} / ${p.value.limit.toLocaleString()} (${p.value.pct.toFixed(0)}%)`,
      cellStyle: (p) => ({ color: statusColor(p.value.status), fontWeight: '700' })
    }));

    return [
      { field: 'user_id', headerName: 'TRADER', width: 120, pinned: 'left', cellStyle: { fontWeight: '700', color: gridColors.primary } },
      { field: 'full_name', headerName: 'NAME', width: 150, cellStyle: { color: gridColors.muted } },
      ...dimensionCols
    ];
  }, [limits]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `desk-limit-utilisation-${Date.now()}.csv` });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{GRID_THEME_CSS}</style>
      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: gridColors.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Per-Trader Limit Utilisation (Your Desk)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
          <span>{traders.length} Traders</span>
        </div>
      </div>

      {traders.length === 0 ? (
        <p style={{ color: gridColors.muted, fontSize: '13px' }}>No traders are currently assigned to your desk.</p>
      ) : (
        <div className={GRID_THEME_CLASS} style={{ height: '350px', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            theme="legacy"
            rowData={traders}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => params.data.user_id}
            rowHeight={35}
            headerHeight={35}
            {...columnPersistence}
          />
        </div>
      )}
      <p style={{ color: gridColors.muted, fontSize: '12px', marginTop: '12px' }}>
        Read-only - limits are platform-wide RMS defaults, not per-trader overrides. Contact your RMS Admin to change risk controls.
      </p>
    </div>
  );
}

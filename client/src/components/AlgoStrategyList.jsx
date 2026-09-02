import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { apiFetch } from '../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { useGridColumnPersistence } from '../hooks/useGridColumnPersistence';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../styles/gridTheme';
import AlgoStrategyBuilder from './AlgoStrategyBuilder';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const statusColor = (status) => (
  status === 'RUNNING' ? gridColors.buy : status === 'FAILED' ? gridColors.sell : gridColors.muted
);

// Real multi-leg strategy management - Start places every leg through the actual RMS-checked
// order path (server/src/services/algoStrategy.service.js), Stop cancels any leg still open.
export default function AlgoStrategyList() {
  const [strategies, setStrategies] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:algo-strategy-list');

  const loadStrategies = useCallback(() => {
    apiFetch('/strategies').then((r) => r.json()).then((data) => setStrategies(data.strategies || []));
  }, []);

  useEffect(() => {
    loadStrategies();
    const interval = setInterval(loadStrategies, 3000);
    return () => clearInterval(interval);
  }, [loadStrategies]);

  const handleStart = useCallback(async (id) => {
    try {
      const response = await apiFetch(`/strategies/${id}/start`, { method: 'PUT' });
      const data = await response.json();
      if (!response.ok) alert(data.message || 'Failed to start strategy');
      loadStrategies();
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  }, [loadStrategies]);

  const handleStop = useCallback(async (id) => {
    try {
      const response = await apiFetch(`/strategies/${id}/stop`, { method: 'PUT' });
      const data = await response.json();
      if (!response.ok) alert(data.message || 'Failed to stop strategy');
      loadStrategies();
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  }, [loadStrategies]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete this strategy?')) return;
    try {
      const response = await apiFetch(`/strategies/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) alert(data.message || 'Failed to delete strategy');
      loadStrategies();
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  }, [loadStrategies]);

  const columnDefs = useMemo(() => [
    { field: 'name', headerName: 'ALGORITHM', width: 170, pinned: 'left', cellStyle: { fontWeight: '700', color: gridColors.primary } },
    {
      headerName: 'LEGS', width: 220,
      valueGetter: (p) => (p.data.legs || []).map((l) => `${l.side[0]}${l.lots} ${l.symbol}`).join(' / '),
      cellStyle: { color: gridColors.muted, fontSize: '10.5px' }
    },
    {
      field: 'status', headerName: 'STATUS', width: 100, enableCellChangeFlash: true,
      cellStyle: (p) => ({ color: statusColor(p.value), fontWeight: '700' })
    },
    { field: 'last_run_message', headerName: 'LAST RUN', width: 260, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted, fontSize: '10.5px' } },
    {
      field: 'created_at', headerName: 'CREATED', width: 140,
      valueFormatter: (p) => new Date(p.value).toLocaleString(), cellStyle: { color: gridColors.muted, fontSize: '10.5px' }
    },
    {
      headerName: 'ACTION', width: 200,
      cellRenderer: (params) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          {params.data.status === 'RUNNING' ? (
            <button
              style={{ padding: '4px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', color: '#fff', backgroundColor: gridColors.sell }}
              onClick={() => handleStop(params.data.id)}
            >
              Stop
            </button>
          ) : (
            <button
              style={{ padding: '4px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', color: '#fff', backgroundColor: gridColors.buy }}
              onClick={() => handleStart(params.data.id)}
            >
              Start
            </button>
          )}
          <button
            style={{ padding: '4px 10px', border: '1px solid #d9e2ec', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', color: gridColors.muted, backgroundColor: '#fff' }}
            onClick={() => handleDelete(params.data.id)}
            disabled={params.data.status === 'RUNNING'}
          >
            Delete
          </button>
        </div>
      )
    }
  ], [handleStart, handleStop, handleDelete]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', display: 'flex', alignItems: 'center' }
  }), []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{GRID_THEME_CSS}</style>
      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: gridColors.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Multi-Leg Algo Strategies</span>
        <button
          onClick={() => setShowBuilder(true)}
          style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: gridColors.accent, color: '#fff' }}
        >
          + New Strategy
        </button>
      </div>

      {strategies.length === 0 ? (
        <p style={{ color: gridColors.muted, fontSize: '13px' }}>No strategies yet - click "+ New Strategy" to build one.</p>
      ) : (
        <div className={GRID_THEME_CLASS} style={{ height: '260px', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            theme="legacy"
            rowData={strategies}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => params.data.id}
            rowHeight={36}
            headerHeight={35}
            {...columnPersistence}
          />
        </div>
      )}

      {showBuilder && (
        <AlgoStrategyBuilder
          onClose={() => setShowBuilder(false)}
          onCreated={() => loadStrategies()}
        />
      )}
    </div>
  );
}

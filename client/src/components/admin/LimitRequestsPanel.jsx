import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { apiFetch } from '../../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { useGridColumnPersistence } from '../../hooks/useGridColumnPersistence';
import { useAuth } from '../../auth/AuthContext';
import { RMS_LIMIT_FIELDS } from '../../constants/rmsLimitFields';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const fieldLabel = (key) => RMS_LIMIT_FIELDS.find((f) => f.key === key)?.label || key;

// RMS Admin's half of the approval workflow - review every PM's limit-change request,
// approve (applies it to oms_config immediately, in the same transaction as marking the
// request approved) or reject (with an optional note, oms_config untouched).
export default function LimitRequestsPanel() {
  const { user } = useAuth();
  const canReview = user?.role === 'RMS_ADMIN';
  const [requests, setRequests] = useState([]);
  const gridRef = useRef();
  const columnPersistence = useGridColumnPersistence('grid-columns:limit-requests');

  const loadRequests = useCallback(() => {
    apiFetch('/limit-requests')
      .then((res) => res.json())
      .then((data) => setRequests(data.requests || []))
      .catch((err) => console.error('Failed to load limit requests:', err));
  }, []);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 10000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  const handleApprove = useCallback(async (id, label, requestedValue) => {
    if (!window.confirm(`Approve this request? ${label} will be set to ${requestedValue} immediately.`)) return;
    try {
      const response = await apiFetch(`/limit-requests/${id}/approve`, { method: 'PUT' });
      const data = await response.json();
      if (!response.ok) alert(data.message || 'Failed to approve request');
      loadRequests();
    } catch (err) {
      console.error('Failed to approve limit request:', err);
      alert('Network error approving request');
    }
  }, [loadRequests]);

  const handleReject = useCallback(async (id) => {
    const note = window.prompt('Optional note for rejecting this request:') || '';
    try {
      const response = await apiFetch(`/limit-requests/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
      });
      const data = await response.json();
      if (!response.ok) alert(data.message || 'Failed to reject request');
      loadRequests();
    } catch (err) {
      console.error('Failed to reject limit request:', err);
      alert('Network error rejecting request');
    }
  }, [loadRequests]);

  const columnDefs = useMemo(() => [
    { field: 'requested_by', headerName: 'PM', width: 110, cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'field_key', headerName: 'FIELD', width: 180, valueFormatter: (p) => fieldLabel(p.value), cellStyle: { color: gridColors.primary } },
    { field: 'current_value', headerName: 'CURRENT', width: 110, valueFormatter: (p) => Number(p.value).toLocaleString(), cellStyle: { color: gridColors.muted } },
    { field: 'requested_value', headerName: 'REQUESTED', width: 110, valueFormatter: (p) => Number(p.value).toLocaleString(), cellStyle: { color: gridColors.accent, fontWeight: '700' } },
    { field: 'reason', headerName: 'REASON', width: 220, cellStyle: { color: gridColors.muted } },
    {
      field: 'status', headerName: 'STATUS', width: 100,
      cellStyle: (p) => ({
        fontWeight: '700',
        color: p.value === 'APPROVED' ? gridColors.buy : p.value === 'REJECTED' ? gridColors.sell : gridColors.pending
      })
    },
    {
      field: 'created_at', headerName: 'SUBMITTED', width: 150,
      valueFormatter: (p) => new Date(p.value).toLocaleString(), cellStyle: { color: gridColors.muted, fontSize: '11px' }
    },
    {
      headerName: 'ACTION', width: 160,
      cellRenderer: (params) => (
        params.data.status !== 'PENDING' || !canReview ? <span style={{ color: gridColors.muted }}>—</span> : (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              style={{ padding: '4px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', color: '#fff', backgroundColor: gridColors.buy }}
              onClick={() => handleApprove(params.data.id, fieldLabel(params.data.field_key), params.data.requested_value)}
            >
              Approve
            </button>
            <button
              style={{ padding: '4px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', color: '#fff', backgroundColor: gridColors.sell }}
              onClick={() => handleReject(params.data.id)}
            >
              Reject
            </button>
          </div>
        )
      )
    }
  ], [handleApprove, handleReject, canReview]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `limit-requests-${Date.now()}.csv` });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{GRID_THEME_CSS}</style>
      <div style={{ padding: '4px 0 12px 0', fontSize: '13px', color: gridColors.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>PM Limit Change Requests</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
          <span>{requests.length} Requests</span>
        </div>
      </div>

      <div className={GRID_THEME_CLASS} style={{ height: '400px', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          theme="legacy"
          rowData={requests}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(params) => params.data.id}
          rowHeight={38}
          headerHeight={35}
          {...columnPersistence}
        />
      </div>
    </div>
  );
}

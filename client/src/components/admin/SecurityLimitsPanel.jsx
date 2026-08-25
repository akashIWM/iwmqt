import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community';
import { syncGridRows } from '../../utils/gridSync';
import { GRID_THEME_CLASS, GRID_THEME_CSS, gridColors } from '../../styles/gridTheme';

ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const getRowId = (row) => row.symbol;

const styles = {
  card: { backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' },
  text: { color: gridColors.muted, fontSize: '13px', marginBottom: '16px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#f8f9fa', color: gridColors.primary, flex: 1 },
  row: { display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' },
  btn: { padding: '10px 16px', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', color: '#fff', backgroundColor: gridColors.accent }
};

export default function SecurityLimitsPanel() {
  const [limitCount, setLimitCount] = useState(0);
  const [form, setForm] = useState({ symbol: '', maxQty: '', maxValue: '' });
  const [message, setMessage] = useState('');
  const gridRef = useRef();

  useEffect(() => {
    fetchLimits();
  }, []);

  async function fetchLimits() {
    try {
      const response = await apiFetch('/security-limits');
      const data = await response.json();
      if (response.ok) {
        syncGridRows(gridRef.current?.api, data.limits, getRowId);
        setLimitCount(data.limits.length);
      }
    } catch (err) {
      console.error('Failed to fetch security limits:', err);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch(`/security-limits/${form.symbol.toUpperCase()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxQty: form.maxQty, maxValue: form.maxValue })
      });
      const data = await response.json();
      setMessage(response.ok ? data.message : `Error: ${data.message}`);
      if (response.ok) {
        setForm({ symbol: '', maxQty: '', maxValue: '' });
        fetchLimits();
      }
    } catch (err) {
      console.error('Failed to set security limit:', err);
      setMessage('Network error setting security limit');
    }
  };

  const handleRemove = async (symbol) => {
    try {
      await apiFetch(`/security-limits/${symbol}`, { method: 'DELETE' });
      fetchLimits();
    } catch (err) {
      console.error('Failed to remove security limit:', err);
    }
  };

  const [columnDefs] = useState([
    { field: 'symbol', headerName: 'SYMBOL', width: 160, cellStyle: { fontWeight: '700', color: gridColors.primary } },
    { field: 'max_qty', headerName: 'MAX QTY', width: 120, cellStyle: { color: gridColors.primary } },
    { field: 'max_value', headerName: 'MAX VALUE', width: 140, valueFormatter: (p) => `₹${Number(p.value).toLocaleString()}`, cellStyle: { color: gridColors.primary } },
    { field: 'set_by', headerName: 'SET BY', width: 120, valueFormatter: (p) => p.value || '—', cellStyle: { color: gridColors.muted } },
    {
      headerName: 'ACTION', width: 100,
      cellRenderer: (params) => (
        <button
          onClick={() => handleRemove(params.data.symbol)}
          style={{ background: gridColors.sell, color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
        >
          Remove
        </button>
      )
    }
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    cellStyle: { fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', display: 'flex', alignItems: 'center' }
  }), []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `security-limits-${Date.now()}.csv` });
  };

  return (
    <div>
      <style>{GRID_THEME_CSS}</style>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: gridColors.primary }}>Security-Wise Limits</h3>
        <p style={styles.text}>Control 12 - per-security quantity/value caps. No entry means no per-security limit is enforced.</p>
        {message && <p style={{ color: gridColors.buy, fontSize: '13px' }}>{message}</p>}
        <form onSubmit={handleSubmit} style={styles.row}>
          <input style={styles.input} placeholder="Symbol" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} required />
          <input type="number" min="1" style={styles.input} placeholder="Max Qty" value={form.maxQty} onChange={(e) => setForm({ ...form, maxQty: e.target.value })} required />
          <input type="number" min="1" style={styles.input} placeholder="Max Value (₹)" value={form.maxValue} onChange={(e) => setForm({ ...form, maxValue: e.target.value })} required />
          <button type="submit" style={styles.btn}>Set Limit</button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button onClick={handleExportCsv} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '700', backgroundColor: '#e2e8f0', color: gridColors.primary }}>
            Export CSV
          </button>
        </div>

        <div className={GRID_THEME_CLASS} style={{ height: '300px', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            theme="legacy"
            rowData={[]}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => getRowId(params.data)}
            rowHeight={35}
            headerHeight={35}
          />
        </div>
        {limitCount === 0 && <p style={styles.text}>No per-security limits configured.</p>}
      </div>
    </div>
  );
}

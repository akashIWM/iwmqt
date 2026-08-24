import { useCallback } from 'react';

// Persists column order/width per grid to localStorage, restored on next visit.
// Spread the returned props onto an AgGridReact instance.
export function useGridColumnPersistence(storageKey) {
  const save = useCallback((params) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(params.api.getColumnState()));
    } catch (err) {
      console.error(`Failed to persist column layout for ${storageKey}:`, err);
    }
  }, [storageKey]);

  const onGridReady = useCallback((params) => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) params.api.applyColumnState({ state: JSON.parse(saved), applyOrder: true });
    } catch (err) {
      console.error(`Failed to restore column layout for ${storageKey}:`, err);
    }
  }, [storageKey]);

  return { onGridReady, onColumnMoved: save, onColumnResized: save };
}

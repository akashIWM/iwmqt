// Diffs a freshly-fetched row array against the grid's own current row nodes and applies
// only the add/update/remove transaction needed - no separate "previous data" copy to
// maintain, the grid's own nodes ARE the previous state. Used by every REST-polled grid
// (WS-driven grids like Watchlist get true deltas from the server instead).
export function syncGridRows(gridApi, rows, getRowId) {
  if (!gridApi) return;

  const incomingIds = new Set(rows.map(getRowId));
  const add = [];
  const update = [];

  rows.forEach((row) => {
    const id = getRowId(row);
    if (gridApi.getRowNode(id)) {
      update.push(row);
    } else {
      add.push(row);
    }
  });

  const remove = [];
  gridApi.forEachNode((node) => {
    if (!incomingIds.has(node.id)) remove.push(node.data);
  });

  // Synchronous, not applyTransactionAsync: this runs off a ~3s poll, not a high-frequency
  // feed, so there's no batching benefit - and staying synchronous means the row model is
  // guaranteed up to date before the next poll's getRowNode() lookups (avoids a race where
  // two overlapping calls - e.g. React StrictMode's double-invoked effects in dev - both
  // decide the same row needs adding because neither's prior transaction has landed yet).
  gridApi.applyTransaction({ add, update, remove });
}

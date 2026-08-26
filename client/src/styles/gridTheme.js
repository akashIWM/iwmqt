// Shared AG Grid theme override - spec mandates a light, low-repaint default (dark themes
// cost more GPU/compositing on large fill grids). Also matches the rest of the app, which
// is already light everywhere outside these grids (Login, Signup, TradeWindow).
export const GRID_THEME_CLASS = 'ag-theme-quant-light';

export const GRID_THEME_CSS = `
  .${GRID_THEME_CLASS} {
    --ag-background-color: #ffffff;
    --ag-header-background-color: #f1f5f9;
    --ag-odd-row-background-color: #f8fafc;
    --ag-border-color: #e2e8f0;
    --ag-row-border-color: #e2e8f0;
    --ag-header-column-separator-display: none;
    --ag-foreground-color: #102a43;
    --ag-header-foreground-color: #334e68;
  }
`;

// Reuses the exact palette already established in Login/Signup/TradeWindow for consistency.
export const gridColors = {
  primary: '#102a43',
  muted: '#627d98',
  accent: '#245a9e',
  buy: '#2b8a3e',
  sell: '#c92a2a',
  qty: '#245a9e',
  price: '#a16207',
  pending: '#b45309',
  executed: '#2b8a3e',
  partiallyFilled: '#245a9e',
  cancelled: '#627d98',
  rejected: '#c92a2a'
};

export const statusColor = (status) => {
  switch (status) {
    case 'EXECUTED': return gridColors.executed;
    case 'PARTIALLY_FILLED': return gridColors.partiallyFilled;
    case 'PENDING': return gridColors.pending;
    case 'CANCELLED': return gridColors.cancelled;
    case 'REJECTED': return gridColors.rejected;
    default: return gridColors.primary;
  }
};

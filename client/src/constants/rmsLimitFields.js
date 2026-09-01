// Field key -> {label, control, scope, usedKey}. Shared between the RMS Admin's OMS Config
// panel (which edits these directly) and the PM limit-change-request form (which asks RMS
// Admin to edit one on their behalf) - one list, so the two screens can never drift apart on
// what a field is called or which control it maps to.
// usedKey points at the matching field in the /oms-config utilisation payload; null means
// this control is checked per-order, not as a running total, so it has no meaningful
// "current utilisation" to show.
export const RMS_LIMIT_FIELDS = [
  { key: 'max_order_quantity', label: 'Quantity Limit Check', control: 'Control 2', scope: 'User', usedKey: null },
  { key: 'max_order_value', label: 'Order Value Check', control: 'Control 3', scope: 'User', usedKey: null },
  { key: 'price_band_pct', label: 'Price Check', control: 'Control 1', scope: 'Global', usedKey: null },
  { key: 'bad_trade_price_pct', label: 'Trade Price Protection', control: 'Control 4', scope: 'Global', usedKey: null },
  { key: 'max_open_order_value', label: 'Cumulative Open Order Value', control: 'Control 6', scope: 'User', usedKey: 'max_open_order_value_used' },
  { key: 'max_position_qty', label: 'Position Limit', control: 'Control 8', scope: 'User', usedKey: 'max_position_qty_used' },
  { key: 'max_exposure_value', label: 'Exposure Limit (User)', control: 'Control 10', scope: 'User', usedKey: 'max_exposure_value_used' },
  { key: 'global_exposure_value', label: 'Exposure Limit (Global)', control: 'Control 10', scope: 'Global', usedKey: 'global_exposure_value_used' },
  { key: 'max_turnover_value', label: 'Trading Limit', control: 'Control 9', scope: 'User', usedKey: 'max_turnover_value_used' },
  { key: 'global_turnover_value', label: 'Turnover Limit', control: 'Control 11', scope: 'Global', usedKey: 'global_turnover_value_used' },
  { key: 'max_open_orders_count', label: 'Automated Execution Check', control: 'Control 13', scope: 'User', usedKey: 'max_open_orders_count_used' },
  { key: 'max_orders_per_second', label: 'OPS Cap', control: 'OPS (separate from the 14)', scope: 'Global', usedKey: null }
];

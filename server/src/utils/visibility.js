// Row-visibility scoping shared by every orders/fills/positions endpoint:
//   - RMS Admin / Super Admin see everyone
//   - PM sees only their own desk (traders assigned to them via users.pm_user_id)
//   - everyone else (Trader, etc.) sees only their own rows
// Centralized here because the same three-way rule applies identically across four
// different queries (orders, order events, fills, positions) - duplicating the branching
// in each one is exactly the kind of place a rule quietly drifts out of sync.
export const isRmsRole = (role) => role === 'RMS_ADMIN' || role === 'SUPER_ADMIN';

// Returns a WHERE-fragment (referencing the given column, e.g. 'o.user_id') and its bind
// params. Always uses $1 - callers must not have another parameter ahead of it.
export const scopeByRole = (role, userId, column = 'user_id') => {
  if (isRmsRole(role)) return { clause: 'TRUE', params: [] };
  if (role === 'PM') {
    return { clause: `${column} IN (SELECT user_id FROM users WHERE pm_user_id = $1)`, params: [userId] };
  }
  return { clause: `${column} = $1`, params: [userId] };
};

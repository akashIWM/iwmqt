import { query } from '../db/postgres.js';

// In-memory mirror of the RMS config tables that order placement was re-querying from
// Postgres on every single order (oms_config, banned_scripts, kill_switches,
// security_limits) - these change only when an admin edits them, not with every order,
// so there's no reason to pay a DB round-trip per order to read them.
//
// Refreshed once at server startup and again immediately after any admin write to one of
// these tables - never on a timer/TTL. That means it's always exactly as fresh as the
// database, just without the redundant per-order reads, and there's no window where a
// just-changed limit could still be read stale.
//
// Deliberately NOT included here: positions, exposure, turnover, margin - those are live
// aggregates that change with every order across every user. Caching those would be the
// one mistake that actually makes RMS checks wrong (stale risk numbers), not just slower,
// so they stay live per-request queries in order.routes.js.

let omsConfig = null;
let bannedScripts = new Map(); // symbol -> reason
let globalKillSwitch = null; // { reason } | null
let userKillSwitches = new Map(); // user_id -> reason
let securityLimits = new Map(); // symbol -> { max_qty, max_value }

export const refreshOmsConfig = async () => {
  const result = await query('SELECT * FROM oms_config WHERE id = 1');
  omsConfig = result.rows[0];
};

export const refreshBannedScripts = async () => {
  const result = await query('SELECT symbol, reason FROM banned_scripts');
  bannedScripts = new Map(result.rows.map((r) => [r.symbol, r.reason]));
};

export const refreshKillSwitches = async () => {
  const result = await query('SELECT * FROM kill_switches');
  globalKillSwitch = result.rows.find((r) => r.scope === 'GLOBAL') || null;
  userKillSwitches = new Map(
    result.rows.filter((r) => r.scope === 'USER').map((r) => [r.target_user_id, r.reason])
  );
};

export const refreshSecurityLimits = async () => {
  const result = await query('SELECT symbol, max_qty, max_value FROM security_limits');
  securityLimits = new Map(result.rows.map((r) => [r.symbol, { max_qty: r.max_qty, max_value: r.max_value }]));
};

export const refreshAllRmsCaches = async () => {
  await Promise.all([refreshOmsConfig(), refreshBannedScripts(), refreshKillSwitches(), refreshSecurityLimits()]);
};

export const getOmsConfig = () => omsConfig;
export const getBanReason = (symbol) => bannedScripts.get(symbol) ?? null;
export const getGlobalKillSwitch = () => globalKillSwitch;
export const getUserKillSwitchReason = (userId) => userKillSwitches.get(userId) ?? null;
export const getSecurityLimit = (symbol) => securityLimits.get(symbol) ?? null;

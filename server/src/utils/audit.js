import { query } from '../db/postgres.js';

// Fail-soft: an audit trail write must never break the action it's recording.
export const logAudit = async (actorUserId, action, target, details) => {
  try {
    await query(
      'INSERT INTO audit_log (actor_user_id, action, target, details) VALUES ($1, $2, $3, $4)',
      [actorUserId, action, target ?? null, details ?? null]
    );
  } catch (error) {
    console.error('[AUDIT ERROR] Failed to write audit log entry:', error.message);
  }
};

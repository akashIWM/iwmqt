import bcrypt from 'bcrypt';
import { query } from '../db/postgres.js';
import { logAudit } from '../utils/audit.js';
import { generateTempPassword } from '../utils/password.js';
import { isNonEmptyString, isValidEmail } from '../utils/validators.js';

// 1. Fetch all registered users - Company Account only sees its own entity
export const getAllUsers = async (req, res) => {
  try {
    const result = req.user.role === 'COMPANY_ACCOUNT'
      ? await query(
          'SELECT id, user_id, full_name, email, role, company_id, status, created_at FROM users WHERE company_id = $1 ORDER BY created_at DESC',
          [req.user.companyId]
        )
      : await query(
          'SELECT id, user_id, full_name, email, role, company_id, status, created_at FROM users ORDER BY created_at DESC'
        );
    res.status(200).json({ users: result.rows });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: 'Failed to fetch users data.' });
  }
};

// Creation rights: Super Admin can create any role/company; Company Account can only
// create RMS_ADMIN/PM/TRADER, always pinned to its own company_id.
const CREATABLE_ROLES_BY_COMPANY_ACCOUNT = ['RMS_ADMIN', 'PM', 'TRADER'];

export const createUser = async (req, res) => {
  const { userId, fullName, email, role } = req.body;

  if (!isNonEmptyString(userId, 50)) return res.status(400).json({ error: 'User ID is required.' });
  if (!isNonEmptyString(fullName, 100)) return res.status(400).json({ error: 'Full name is required.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid @iwmquant.com email is required.' });

  const validRoles = ['TRADER', 'RMS_ADMIN', 'PM', 'COMPANY_ACCOUNT', 'SUPER_ADMIN'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role provided.' });

  let companyId = req.body.companyId || null;

  if (req.user.role === 'COMPANY_ACCOUNT') {
    if (!CREATABLE_ROLES_BY_COMPANY_ACCOUNT.includes(role)) {
      return res.status(403).json({ error: 'Company Accounts can only create RMS Admin, PM, or Trader logins.' });
    }
    companyId = req.user.companyId;
  }

  try {
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const result = await query(
      `INSERT INTO users (user_id, full_name, email, password_hash, role, company_id, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, user_id, full_name, email, role, company_id, status`,
      [userId, fullName, email, passwordHash, role, companyId]
    );

    await logAudit(req.user.userId, 'USER_CREATED', userId, `role: ${role}`);
    res.status(201).json({ message: 'User created successfully', user: result.rows[0], tempPassword });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'User ID or email already exists.' });
    console.error('Create User Error:', error);
    res.status(500).json({ error: 'Failed to create user.' });
  }
};

// 2. Change a user's role
export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  const validRoles = ['TRADER', 'RMS_ADMIN', 'PM', 'COMPANY_ACCOUNT', 'SUPER_ADMIN'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role provided.' });
  }

  // Only a Super Admin can grant the Super Admin role.
  if (req.user.role !== 'SUPER_ADMIN' && role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Only a Super Admin can grant the Super Admin role.' });
  }

  try {
    const result = await query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, user_id, role',
      [role, id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
    await logAudit(req.user.userId, 'USER_ROLE_CHANGE', result.rows[0].user_id, `new role: ${role}`);
    res.status(200).json({ message: 'Role updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
};

// 3. Lock or Unlock an account
export const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['ACTIVE', 'LOCKED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status provided.' });
  }

  try {
    // Unlocking must also clear the failed-attempt counter, or the very next wrong
    // password re-trips the >= MAX_FAILED_ATTEMPTS check and instantly re-locks the account.
    const result = status === 'ACTIVE'
      ? await query(
          'UPDATE users SET status = $1, failed_login_attempts = 0, locked_at = NULL, updated_at = NOW() WHERE id = $2 RETURNING id, user_id, status',
          [status, id]
        )
      : await query(
          'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, user_id, status',
          [status, id]
        );

    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
    await logAudit(req.user.userId, 'USER_STATUS_CHANGE', result.rows[0].user_id, `new status: ${status}`);
    res.status(200).json({ message: `Account marked as ${status}`, user: result.rows[0] });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ error: 'Failed to update account status.' });
  }
};

// Admin override: force-reset an existing user's credentials (spec: Super Admin / Company
// Account / RMS Admin can do this). Also clears any lockout, since a credential reset makes
// the old lock moot - and issues a temp password that must be changed on next login.
export const resetUserPassword = async (req, res) => {
  const { id } = req.params;

  try {
    const target = await query('SELECT user_id, password_hash FROM users WHERE id = $1', [id]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await query(
      `UPDATE users SET
         password_hash = $1,
         previous_password_hash = $2,
         must_change_password = true,
         status = 'ACTIVE',
         failed_login_attempts = 0,
         locked_at = NULL,
         password_changed_at = NOW(),
         password_expires_at = NOW() + INTERVAL '15 days',
         updated_at = NOW()
       WHERE id = $3`,
      [passwordHash, target.rows[0].password_hash, id]
    );

    await logAudit(req.user.userId, 'USER_PASSWORD_RESET', target.rows[0].user_id, 'admin-initiated credential reset');
    res.status(200).json({ message: 'Password reset successfully', tempPassword });
  } catch (error) {
    console.error('Reset User Password Error:', error);
    res.status(500).json({ error: 'Failed to reset user password.' });
  }
};
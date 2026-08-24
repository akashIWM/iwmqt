import { query } from '../db/postgres.js';
import { logAudit } from '../utils/audit.js';

// 1. Fetch all registered users
export const getAllUsers = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, user_id, full_name, email, role, company_id, status, created_at FROM users ORDER BY created_at DESC'
    );
    res.status(200).json({ users: result.rows });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: 'Failed to fetch users data.' });
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

  // RMS Admins manage their own scope only - they cannot grant or touch SUPER_ADMIN.
  if (req.user.role === 'RMS_ADMIN' && role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'RMS Admins cannot grant the Super Admin role.' });
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
    const result = await query(
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
import bcrypt from 'bcrypt';
import { query } from '../db/postgres.js';
import { generateTempPassword } from '../utils/password.js';
import { isNonEmptyString, isValidEmail } from '../utils/validators.js';
import { logAudit } from '../utils/audit.js';

// GET /api/companies - list every company with its member count
export const listCompanies = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.code, c.name, c.status, c.created_at,
              COUNT(u.id)::int AS member_count
       FROM companies c
       LEFT JOIN users u ON u.company_id = c.code
       GROUP BY c.code, c.name, c.status, c.created_at
       ORDER BY c.created_at DESC`
    );
    res.status(200).json({ companies: result.rows });
  } catch (error) {
    console.error('List Companies Error:', error);
    res.status(500).json({ error: 'Failed to fetch companies.' });
  }
};

// POST /api/companies - create a company and its first Company Account login
export const createCompany = async (req, res) => {
  const { code, name, adminUserId, adminFullName, adminEmail } = req.body;

  if (!isNonEmptyString(code, 100) || code.trim() !== code.trim().toUpperCase()) {
    return res.status(400).json({ error: 'Company code must be a non-empty uppercase code.' });
  }
  if (!isNonEmptyString(name, 255)) return res.status(400).json({ error: 'Company name is required.' });
  if (!isNonEmptyString(adminUserId, 50)) return res.status(400).json({ error: 'Admin user ID is required.' });
  if (!isNonEmptyString(adminFullName, 100)) return res.status(400).json({ error: 'Admin full name is required.' });
  if (!isValidEmail(adminEmail)) return res.status(400).json({ error: 'A valid @iwmquant.com email is required for the admin.' });

  let companyCreated = false;

  try {
    const existing = await query('SELECT code FROM companies WHERE code = $1', [code]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'A company with this code already exists.' });

    await query('INSERT INTO companies (code, name, created_by) VALUES ($1, $2, $3)', [code, name, req.user.userId]);
    companyCreated = true;

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const adminUser = await query(
      `INSERT INTO users (user_id, full_name, email, password_hash, role, company_id)
       VALUES ($1, $2, $3, $4, 'COMPANY_ACCOUNT', $5)
       RETURNING id, user_id, full_name, email, role, company_id, status`,
      [adminUserId, adminFullName, adminEmail, passwordHash, code]
    );

    await logAudit(req.user.userId, 'COMPANY_CREATED', code, `admin: ${adminUserId}`);

    res.status(201).json({
      message: 'Company and admin login created successfully',
      company: { code, name, status: 'ACTIVE' },
      adminUser: adminUser.rows[0],
      tempPassword
    });
  } catch (error) {
    if (companyCreated) {
      await query('DELETE FROM companies WHERE code = $1', [code]).catch(() => {});
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Admin user ID or email already exists.' });
    }
    console.error('Create Company Error:', error);
    res.status(500).json({ error: 'Failed to create company.' });
  }
};

// PUT /api/companies/:code/status - suspend or reactivate a company
export const updateCompanyStatus = async (req, res) => {
  const { code } = req.params;
  const { status } = req.body;

  if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status provided.' });
  }

  try {
    const result = await query(
      'UPDATE companies SET status = $1, updated_at = NOW() WHERE code = $2 RETURNING code, name, status',
      [status, code]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Company not found.' });
    await logAudit(req.user.userId, 'COMPANY_STATUS_CHANGE', code, `new status: ${status}`);
    res.status(200).json({ message: `Company marked as ${status}`, company: result.rows[0] });
  } catch (error) {
    console.error('Update Company Status Error:', error);
    res.status(500).json({ error: 'Failed to update company status.' });
  }
};

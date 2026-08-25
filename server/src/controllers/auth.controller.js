import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { query } from '../db/postgres.js';
import { logAuthEvent } from '../services/clickhouse/logger.js';
import { isNonEmptyString, isValidEmail, normalizeEmail, validatePasswordComplexity } from '../utils/validators.js';
const MAX_FAILED_ATTEMPTS = 5;

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return process.env.JWT_SECRET;
};

export const sendOtp = async (req, res) => {
  const email = typeof req.body.email === 'string' ? normalizeEmail(req.body.email) : '';

  if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid @iwmquant.com email is required.' });

  try {
    // 1. Domain Restriction Check
    const emailDomain = email.split('@')[1];
    if (emailDomain !== 'iwmquant.com') {
      return res.status(403).json({ error: "Only @iwmquant.com emails are authorized." });
    }

    // 2. Generate a random 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    
    // 3. Set expiration time (10 minutes from now)
    const expiresAt = new Date(Date.now() + 10 * 60000);

    // 4. Save to PostgreSQL (Upsert: Update if email already requested an OTP recently)
    await query(
      `INSERT INTO otp_verifications (email, otp_code, expires_at) 
       VALUES ($1, $2, $3)
       ON CONFLICT (email) 
       DO UPDATE SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at`,
      [email, otpCode, expiresAt]
    );

    // 5. Configure Zoho Transporter
    const transporter = nodemailer.createTransport({
      host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in',
      port: 465,
      secure: true,
      auth: {
        user: process.env.ZOHO_EMAIL,
        pass: process.env.ZOHO_PASSWORD
      }
    });

    // 6. Send the Email
    const mailOptions = {
      from: `"IWM Quant Security" <${process.env.ZOHO_EMAIL}>`,
      to: email,
      subject: 'Your IWM Quant Verification Code',
      text: `Your registration verification code is: ${otpCode}. It will expire in 10 minutes. Do not share this code with anyone.`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "OTP sent successfully!" });

  } catch (error) {
    console.error("OTP Generation Error:", error);
    res.status(500).json({ error: "Failed to send OTP. Please try again later." });
  }
};

export const register = async (req, res) => {
  // Added `otp` to the destructured body
  const { fullName, userId, email, password, confirmPassword, companyId, otp } = req.body;

  if (![fullName, userId, email, password, confirmPassword].every((value) => isNonEmptyString(value))) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid @iwmquant.com email is required' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
  if (!validatePasswordComplexity(password)) return res.status(400).json({ error: 'Password does not meet complexity requirements' });
  
  // Ensure the OTP was provided by the frontend
  if (!otp) return res.status(400).json({ error: 'Verification OTP is required' });

  try {
    const userExists = await query('SELECT id FROM users WHERE user_id = $1 OR email = $2', [userId, email]);
    if (userExists.rows.length > 0) return res.status(409).json({ error: 'User ID or Email already exists' });

    // --- NEW: OTP VERIFICATION LOGIC ---
    const otpResult = await query('SELECT otp_code, expires_at FROM otp_verifications WHERE email = $1', [email]);
    
    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: 'No OTP was requested for this email' });
    }

    const { otp_code, expires_at } = otpResult.rows[0];

    if (otp_code !== otp) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (new Date() > new Date(expires_at)) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }
    // -----------------------------------

    const passwordHash = await bcrypt.hash(password, 12);
    
    const newUser = await query(
      `INSERT INTO users (user_id, full_name, email, password_hash, role, company_id) 
       VALUES ($1, $2, $3, $4, 'TRADER', $5) RETURNING id, user_id, full_name, email, role, status`,
      [userId, fullName, email, passwordHash, companyId || null]
    );

    // Delete the OTP from the database so it cannot be reused
    await query('DELETE FROM otp_verifications WHERE email = $1', [email]);

    await logAuthEvent({
      event_type: 'SIGNUP', user_id: userId, role: 'TRADER', company_id: companyId, success: true,
      ip_address: req.ip, user_agent: req.headers['user-agent']
    });

    res.status(201).json({ message: 'Registration successful', user: newUser.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req, res) => {
  const { userId, password, forceLogin } = req.body;
  const ip = req.ip;
  const ua = req.headers['user-agent'];

  try {
    const result = await query('SELECT * FROM users WHERE user_id = $1', [userId]);
    const user = result.rows[0];

    if (!user) {
      await logAuthEvent({ event_type: 'LOGIN_FAILURE', user_id: userId, success: false, ip_address: ip, user_agent: ua });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (['LOCKED', 'SUSPENDED', 'PENDING'].includes(user.status)) {
      await logAuthEvent({ event_type: 'LOGIN_FAILURE', user_id: userId, success: false, ip_address: ip, user_agent: ua, metadata: 'Account locked' });
      return res.status(403).json({ error: `Account is ${user.status.toLowerCase()}. Please contact administration.` });
    }

    if (user.password_expires_at && new Date(user.password_expires_at) <= new Date()) {
      return res.status(403).json({ error: 'Password has expired. Please reset it before logging in.' });
    }

    if (user.company_id) {
      const company = await query('SELECT status FROM companies WHERE code = $1', [user.company_id]);
      if (company.rows[0]?.status === 'SUSPENDED') {
        await logAuthEvent({ event_type: 'LOGIN_FAILURE', user_id: userId, success: false, ip_address: ip, user_agent: ua, metadata: 'Company suspended' });
        return res.status(403).json({ error: "Your organisation's access has been suspended. Please contact your Super Admin." });
      }
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      const attempts = user.failed_login_attempts + 1;
      let status = user.status;
      
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        status = 'LOCKED';
        await query('UPDATE users SET failed_login_attempts = $1, status = $2, locked_at = NOW() WHERE id = $3', [attempts, status, user.id]);
        await logAuthEvent({ event_type: 'LOCKOUT', user_id: userId, success: false, ip_address: ip, user_agent: ua, metadata: `${attempts} consecutive failed attempts` });
      } else {
        await query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [attempts, user.id]);
      }

      await logAuthEvent({ event_type: 'LOGIN_FAILURE', user_id: userId, success: false, ip_address: ip, user_agent: ua });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await query('UPDATE users SET failed_login_attempts = 0, last_login_at = NOW() WHERE id = $1', [user.id]);

    // First login on a temp password, or an admin-forced credential reset - the caller
    // must set their own password before a real session is issued.
    if (user.must_change_password) {
      await logAuthEvent({ event_type: 'LOGIN_SUCCESS', user_id: userId, role: user.role, company_id: user.company_id, success: true, ip_address: ip, user_agent: ua, metadata: 'must_change_password pending' });
      return res.status(200).json({ mustChangePassword: true, userId: user.user_id });
    }

    // Single active session per user - a second login attempt is rejected with a prompt
    // unless the caller explicitly forces it (which supersedes/kills the older session).
    if (user.active_session_id && !forceLogin) {
      await logAuthEvent({ event_type: 'LOGIN_FAILURE', user_id: userId, success: false, ip_address: ip, user_agent: ua, metadata: 'session already active' });
      return res.status(409).json({
        error: 'session_already_active',
        message: 'This account is already logged in elsewhere. Force sign-in to end that session and continue here.'
      });
    }

    const sid = crypto.randomUUID();
    await query('UPDATE users SET active_session_id = $1 WHERE id = $2', [sid, user.id]);

    const token = jwt.sign(
      { id: user.id, userId: user.user_id, role: user.role, companyId: user.company_id, sid },
      getJwtSecret(),
      { expiresIn: '12h' }
    );

    await logAuthEvent({ event_type: 'LOGIN_SUCCESS', user_id: userId, role: user.role, company_id: user.company_id, success: true, ip_address: ip, user_agent: ua });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000 
    });

    res.json({
      user: {
        id: user.id, userId: user.user_id, fullName: user.full_name,
        email: user.email, role: user.role, companyId: user.company_id, status: user.status,
        passwordExpiresAt: user.password_expires_at
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Completes the forced password-change gate from login() (temp password on first login,
// or an admin-initiated credential reset) - verifies the temp password one more time,
// enforces the same complexity/reuse rules as a normal reset, then issues a real session.
export const completeFirstLogin = async (req, res) => {
  const { userId, currentPassword, newPassword, confirmPassword } = req.body;
  const ip = req.ip;
  const ua = req.headers['user-agent'];

  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
  if (!validatePasswordComplexity(newPassword)) return res.status(400).json({ error: 'Password does not meet complexity requirements' });

  try {
    const result = await query('SELECT * FROM users WHERE user_id = $1', [userId]);
    const user = result.rows[0];

    if (!user || !user.must_change_password) {
      return res.status(400).json({ error: 'No pending password change for this account' });
    }

    const validCurrent = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validCurrent) return res.status(401).json({ error: 'Invalid credentials' });

    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ error: 'New password must differ from your current password' });
    }
    if (user.previous_password_hash && await bcrypt.compare(newPassword, user.previous_password_hash)) {
      return res.status(400).json({ error: 'New password must differ from your previous password' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(
      `UPDATE users SET
         password_hash = $1, previous_password_hash = $2, must_change_password = false,
         password_changed_at = NOW(), password_expires_at = NOW() + INTERVAL '15 days',
         failed_login_attempts = 0, last_login_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [passwordHash, user.password_hash, user.id]
    );

    const sid = crypto.randomUUID();
    await query('UPDATE users SET active_session_id = $1 WHERE id = $2', [sid, user.id]);

    const token = jwt.sign(
      { id: user.id, userId: user.user_id, role: user.role, companyId: user.company_id, sid },
      getJwtSecret(),
      { expiresIn: '12h' }
    );

    await logAuthEvent({ event_type: 'PASSWORD_RESET', user_id: userId, role: user.role, company_id: user.company_id, success: true, ip_address: ip, user_agent: ua, metadata: 'first-login password change completed' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000
    });

    res.json({
      user: {
        id: user.id, userId: user.user_id, fullName: user.full_name,
        email: user.email, role: user.role, companyId: user.company_id, status: user.status
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Self-service change-password for an already-authenticated user (e.g. the expiry
// banner's "Change Now" action) - distinct from resetPassword (email-OTP, logged out)
// and completeFirstLogin (temp-password gate before a session even exists).
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
  if (!validatePasswordComplexity(newPassword)) return res.status(400).json({ error: 'Password does not meet complexity requirements' });

  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const validCurrent = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validCurrent) return res.status(401).json({ error: 'Current password is incorrect' });

    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ error: 'New password must differ from your current password' });
    }
    if (user.previous_password_hash && await bcrypt.compare(newPassword, user.previous_password_hash)) {
      return res.status(400).json({ error: 'New password must differ from your previous password' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(
      `UPDATE users SET
         password_hash = $1, previous_password_hash = $2,
         password_changed_at = NOW(), password_expires_at = NOW() + INTERVAL '15 days',
         updated_at = NOW()
       WHERE id = $3`,
      [passwordHash, user.password_hash, user.id]
    );

    await logAuthEvent({
      event_type: 'PASSWORD_RESET', user_id: user.user_id, role: user.role, company_id: user.company_id,
      success: true, ip_address: req.ip, user_agent: req.headers['user-agent'], metadata: 'self-service change'
    });

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      // Only clear the session if this token's sid still owns it - a stale/already-
      // superseded logout call must not wipe out a newer legitimate session.
      if (decoded.sid) {
        await query('UPDATE users SET active_session_id = NULL WHERE id = $1 AND active_session_id = $2', [decoded.id, decoded.sid]);
      }
      await logAuthEvent({ event_type: 'LOGOUT', user_id: decoded.userId, role: decoded.role, company_id: decoded.companyId, success: true, ip_address: req.ip, user_agent: req.headers['user-agent'] });
    } catch (e) { /* Ignore invalid token during logout */ }
  }

  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
};

export const getMe = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, user_id, full_name, email, role, company_id, status, password_expires_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const row = result.rows[0];
    res.json({
      user: {
        id: row.id, userId: row.user_id, fullName: row.full_name, email: row.email,
        role: row.role, companyId: row.company_id, status: row.status, passwordExpiresAt: row.password_expires_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
// --- FORGOT PASSWORD FLOW ---

export const sendForgotPasswordOtp = async (req, res) => {
  const { email } = req.body;

  try {
    // 1. Verify the user actually exists in the database
    const userExists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length === 0) {
      // For security, we give a generic error so attackers can't fish for valid emails
      return res.status(404).json({ error: 'If this email is registered, an OTP has been sent.' });
    }

    // 2. Generate OTP and Expiry (10 mins)
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000);

    await query(
      `INSERT INTO otp_verifications (email, otp_code, expires_at) 
       VALUES ($1, $2, $3)
       ON CONFLICT (email) 
       DO UPDATE SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at`,
      [email, otpCode, expiresAt]
    );

    const transporter = nodemailer.createTransport({
      host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: { user: process.env.ZOHO_EMAIL, pass: process.env.ZOHO_PASSWORD }
    });

    await transporter.sendMail({
      from: `"IWM Quant Security" <${process.env.ZOHO_EMAIL}>`,
      to: email,
      subject: 'Your IWM Quant Password Reset Code',
      text: `Your password reset code is: ${otpCode}. It will expire in 10 minutes. If you did not request this, please contact your RMS Admin immediately.`
    });

    res.status(200).json({ message: 'OTP sent successfully!' });
  } catch (error) {
    console.error('Password Reset OTP Error:', error);
    res.status(500).json({ error: 'Failed to send OTP. Please try again later.' });
  }
};

export const resetPassword = async (req, res) => {
  const { email, otp, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
  if (!validatePasswordComplexity(newPassword)) return res.status(400).json({ error: 'Password does not meet complexity requirements' });
  if (!otp) return res.status(400).json({ error: 'OTP is required' });

  try {
    // Verify OTP
    const otpResult = await query('SELECT otp_code, expires_at FROM otp_verifications WHERE email = $1', [email]);
    
    if (otpResult.rows.length === 0) return res.status(400).json({ error: 'No OTP was requested for this email' });
    
    const { otp_code, expires_at } = otpResult.rows[0];

    if (otp_code !== otp) return res.status(400).json({ error: 'Invalid verification code' });
    if (new Date() > new Date(expires_at)) return res.status(400).json({ error: 'Verification code has expired.' });

    const userResult = await query('SELECT id, password_hash, previous_password_hash FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'No account found for this email' });

    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ error: 'New password must differ from your current password' });
    }
    if (user.previous_password_hash && await bcrypt.compare(newPassword, user.previous_password_hash)) {
      return res.status(400).json({ error: 'New password must differ from your previous password' });
    }

    // Hash new password and update user - a self-service reset also clears any lockout,
    // since it's one of the two spec-sanctioned recovery paths (the other being admin reset).
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await query(
      `UPDATE users SET
         password_hash = $1, previous_password_hash = $2, must_change_password = false,
         status = CASE WHEN status = 'LOCKED' THEN 'ACTIVE' ELSE status END,
         failed_login_attempts = 0, locked_at = NULL,
         password_changed_at = NOW(), password_expires_at = NOW() + INTERVAL '15 days',
         updated_at = NOW()
       WHERE id = $3`,
      [passwordHash, user.password_hash, user.id]
    );
    await query('DELETE FROM otp_verifications WHERE email = $1', [email]);

    await logAuthEvent({
      event_type: 'PASSWORD_RESET', user_id: email, success: true,
      ip_address: req.ip, user_agent: req.headers['user-agent']
    });

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
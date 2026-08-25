import jwt from 'jsonwebtoken';
import { query } from '../db/postgres.js';

// This function checks if the user has a valid HTTP-only cookie session, AND that its
// session id (sid) still matches users.active_session_id - a later login (same user,
// different device/tab) overwrites that column, which immediately invalidates this one.
export const authenticate = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.sid) {
      const result = await query('SELECT active_session_id FROM users WHERE id = $1', [decoded.id]);
      const current = result.rows[0]?.active_session_id;
      if (current !== decoded.sid) {
        return res.status(401).json({ error: 'Session ended - you have been logged in elsewhere.' });
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// This function checks if the logged-in user has the correct role
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};
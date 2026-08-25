import { useState } from 'react';
import axios from 'axios';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ROLE_ROUTES = {
  SUPER_ADMIN: '/app/super-admin',
  COMPANY_ACCOUNT: '/app/company',
  RMS_ADMIN: '/app/rms',
  PM: '/app/pm',
  TRADER: '/app/trader'
};

// Self-service change-password for an already-authenticated user. Reached either
// voluntarily (expiry banner's "Change Now") or forced (?forced=1, password already
// expired - ProtectedRoute redirects here instead of rendering the requested screen).
export default function ChangePassword() {
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forced = searchParams.get('forced') === '1';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!loading && !user) return <Navigate to="/login" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) return setError('Passwords do not match');

    try {
      await axios.post('/auth/change-password', { currentPassword, newPassword, confirmPassword });
      await refreshUser();
      navigate(user ? ROLE_ROUTES[user.role] : '/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    }
  };

  const styles = {
    container: {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    },
    card: { background: '#ffffff', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)', width: '100%', maxWidth: '400px', boxSizing: 'border-box' },
    header: { textAlign: 'center', marginBottom: '30px' },
    title: { margin: '0 0 8px 0', color: '#102a43', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' },
    subtitle: { margin: '0', color: '#627d98', fontSize: '14px' },
    inputGroup: { marginBottom: '18px' },
    label: { display: 'block', marginBottom: '6px', color: '#334e68', fontSize: '13px', fontWeight: '600' },
    input: { width: '100%', padding: '12px 14px', border: '1px solid #d9e2ec', borderRadius: '8px', fontSize: '14px', color: '#102a43', backgroundColor: '#f8f9fa', boxSizing: 'border-box', outline: 'none' },
    passwordWrapper: { position: 'relative' },
    toggleBtn: { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#245a9e', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '0' },
    passwordHint: { display: 'block', marginTop: '6px', color: '#829ab1', fontSize: '11px' },
    button: { width: '100%', padding: '14px', marginTop: '10px', backgroundColor: isHovered ? '#1e4e8c' : '#245a9e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s ease', boxShadow: '0 4px 6px rgba(36, 90, 158, 0.2)' },
    errorBox: { backgroundColor: '#ffe3e3', color: '#c92a2a', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: '500', textAlign: 'center' },
    forcedBox: { backgroundColor: '#fff4e0', color: '#8a5a00', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: '500', textAlign: 'center' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Change Password</h2>
          <p style={styles.subtitle}>Update the password on your account.</p>
        </div>

        {forced && <div style={styles.forcedBox}>Your password has expired. You must set a new one to continue.</div>}
        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Current Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>New Password</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ ...styles.input, paddingRight: '60px' }}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.toggleBtn}>
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            <small style={styles.passwordHint}>Must contain 8+ characters, 1 letter, 1 number, and 1 special symbol.</small>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Confirm New Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" style={styles.button} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            Change Password
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';

const ROLE_ROUTES = {
  SUPER_ADMIN: '/app/super-admin',
  COMPANY_ACCOUNT: '/app/company',
  RMS_ADMIN: '/app/rms',
  PM: '/app/pm',
  TRADER: '/app/trader'
};

// Forced password-change gate: reached from Login when the server returns
// mustChangePassword (first login on a temp password, or an admin-initiated reset).
export default function CompleteFirstLogin() {
  const { completeFirstLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, currentPassword } = location.state || {};

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Reached directly (refresh, bookmarked, etc.) without the login-flow state - start over.
  if (!userId || !currentPassword) return <Navigate to="/login" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) return setError('Passwords do not match');

    try {
      const user = await completeFirstLogin({ userId, currentPassword, newPassword, confirmPassword });
      navigate(ROLE_ROUTES[user.role]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set new password');
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    },
    card: {
      background: '#ffffff',
      padding: '40px',
      borderRadius: '16px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)',
      width: '100%',
      maxWidth: '400px',
      boxSizing: 'border-box'
    },
    header: { textAlign: 'center', marginBottom: '30px' },
    title: { margin: '0 0 8px 0', color: '#102a43', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' },
    subtitle: { margin: '0', color: '#627d98', fontSize: '14px' },
    inputGroup: { marginBottom: '18px' },
    label: { display: 'block', marginBottom: '6px', color: '#334e68', fontSize: '13px', fontWeight: '600' },
    input: {
      width: '100%',
      padding: '12px 14px',
      border: '1px solid #d9e2ec',
      borderRadius: '8px',
      fontSize: '14px',
      color: '#102a43',
      backgroundColor: '#f8f9fa',
      boxSizing: 'border-box',
      outline: 'none'
    },
    passwordWrapper: { position: 'relative' },
    toggleBtn: {
      position: 'absolute',
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'none',
      border: 'none',
      color: '#245a9e',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      padding: '0'
    },
    passwordHint: { display: 'block', marginTop: '6px', color: '#829ab1', fontSize: '11px' },
    button: {
      width: '100%',
      padding: '14px',
      marginTop: '10px',
      backgroundColor: isHovered ? '#1e4e8c' : '#245a9e',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      boxShadow: '0 4px 6px rgba(36, 90, 158, 0.2)'
    },
    errorBox: {
      backgroundColor: '#ffe3e3',
      color: '#c92a2a',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '20px',
      fontSize: '13px',
      fontWeight: '500',
      textAlign: 'center'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Set a New Password</h2>
          <p style={styles.subtitle}>This account must set its own password before continuing.</p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
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
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ ...styles.input, paddingRight: '60px' }}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            style={styles.button}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            Set Password & Continue
          </button>
        </form>
      </div>
    </div>
  );
}

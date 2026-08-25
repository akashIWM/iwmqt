import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const ROLE_ROUTES = {
  SUPER_ADMIN: '/app/super-admin',
  COMPANY_ACCOUNT: '/app/company',
  RMS_ADMIN: '/app/rms',
  PM: '/app/pm',
  TRADER: '/app/trader'
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Single shared login form for all five roles — role is resolved server-side from the credential, not chosen by the user[cite: 1].
  const attemptLogin = async (forceLogin) => {
    setError('');
    try {
      const result = await login({ userId, password, forceLogin });
      if (result.mustChangePassword) {
        navigate('/first-login', { state: { userId: result.userId, currentPassword: password } });
      } else {
        navigate(ROLE_ROUTES[result.user.role]);
      }
    } catch (err) {
      const data = err.response?.data;
      // Single active session per user - the server rejects a second concurrent login
      // with this specific error code so we can offer a "force sign-in" prompt instead
      // of just failing outright.
      if (data?.error === 'session_already_active') {
        if (window.confirm(`${data.message}\n\nForce sign-in here?`)) {
          attemptLogin(true);
        }
        return;
      }
      setError(data?.error || 'Invalid credentials');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    attemptLogin(false);
  };

  // --- STYLES ---
  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)', // Clean bluish-white gradient
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
    header: {
      textAlign: 'center',
      marginBottom: '30px'
    },
    title: {
      margin: '0 0 8px 0',
      color: '#102a43',
      fontSize: '24px',
      fontWeight: '700',
      letterSpacing: '-0.5px'
    },
    subtitle: {
      margin: '0',
      color: '#627d98',
      fontSize: '14px'
    },
    inputGroup: {
      marginBottom: '20px'
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      color: '#334e68',
      fontSize: '13px',
      fontWeight: '600'
    },
    input: {
      width: '100%',
      padding: '12px 14px',
      border: '1px solid #d9e2ec',
      borderRadius: '8px',
      fontSize: '14px',
      color: '#102a43',
      backgroundColor: '#f8f9fa',
      boxSizing: 'border-box',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      outline: 'none'
    },
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
      transition: 'background-color 0.2s ease, transform 0.1s ease',
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
    footerLinks: {
      marginTop: '24px',
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '13px'
    },
    link: {
      color: '#245a9e',
      textDecoration: 'none',
      fontWeight: '600'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>IWM Quant</h2>
          <p style={styles.subtitle}>Sign in to your Platform Terminal</p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>User ID</label>
            <input 
              type="text" 
              value={userId} 
              onChange={(e) => setUserId(e.target.value)} 
              required 
              style={styles.input} 
              placeholder="Enter your User ID"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ ...styles.input, paddingRight: '60px' }}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.toggleBtn}>
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            style={styles.button}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            Access Terminal
          </button>
        </form>

        <div style={styles.footerLinks}>
          <Link to="/forgot-password" style={styles.link}>Forgot Password?</Link>
          <Link to="/signup" style={styles.link}>Create Account</Link>
        </div>
      </div>
    </div>
  );
}
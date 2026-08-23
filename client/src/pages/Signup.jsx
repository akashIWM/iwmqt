import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '', userId: '', email: '', password: '', confirmPassword: '', companyId: '', otp: ''
  });
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  
  // New States for OTP and Password Visibility
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOtp = async () => {
    setError('');
    if (!formData.email) {
      return setError('Please enter your email address first.');
    }
    if (!formData.email.endsWith('@iwmquant.com')) {
      return setError('Only @iwmquant.com emails are authorized.');
    }

    setIsSendingOtp(true);
    try {
      await axios.post('/auth/send-otp', { email: formData.email });
      setOtpSent(true);
      alert('Verification code sent! Please check your email.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (!otpSent) {
      return setError('Please verify your email with an OTP first.');
    }

    try {
      await axios.post('/auth/register', formData);
      alert('Registration successful! Please login.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  // --- STYLES ---
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
      maxWidth: '450px',
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
    flexRow: { display: 'flex', gap: '12px' },
    sendOtpBtn: {
      padding: '0 16px',
      backgroundColor: isSendingOtp ? '#e1e8f0' : '#f0f4f8',
      color: '#245a9e',
      border: '1px solid #d9e2ec',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: isSendingOtp ? 'not-allowed' : 'pointer',
      whiteSpace: 'nowrap'
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
    },
    footerText: { marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#627d98' },
    link: { color: '#245a9e', textDecoration: 'none', fontWeight: '600' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Welcome to IWM Quant</h2>
          <p style={styles.subtitle}>Initialize your Trading Terminal Account</p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Full Name</label>
            <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required style={styles.input} placeholder="John Doe" />
          </div>

          <div style={styles.flexRow}>
            <div style={{ ...styles.inputGroup, flex: 1 }}>
              <label style={styles.label}>User ID</label>
              <input type="text" name="userId" value={formData.userId} onChange={handleChange} required style={styles.input} placeholder="john01" />
            </div>
            <div style={{ ...styles.inputGroup, flex: 1 }}>
              <label style={styles.label}>Company ID</label>
              <input type="text" name="companyId" value={formData.companyId} onChange={handleChange} style={styles.input} placeholder="(Optional)" />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <div style={styles.flexRow}>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                required 
                style={{ ...styles.input, flex: 1 }} 
                placeholder="name@iwmquant.com" 
                disabled={otpSent} 
              />
              {!otpSent && (
                <button type="button" onClick={handleSendOtp} disabled={isSendingOtp} style={styles.sendOtpBtn}>
                  {isSendingOtp ? 'Sending...' : 'Send OTP'}
                </button>
              )}
            </div>
          </div>

          {/* OTP Input - Only visible after OTP is sent */}
          {otpSent && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Verification Code (OTP)</label>
              <input 
                type="text" 
                name="otp" 
                value={formData.otp} 
                onChange={handleChange} 
                required 
                style={{ ...styles.input, letterSpacing: '2px', textAlign: 'center', fontSize: '18px' }} 
                placeholder="••••••" 
                maxLength="6"
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrapper}>
              <input 
                type={showPassword ? "text" : "password"} 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
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
            <label style={styles.label}>Confirm Password</label>
            <div style={styles.passwordWrapper}>
              <input 
                type={showPassword ? "text" : "password"} 
                name="confirmPassword" 
                value={formData.confirmPassword} 
                onChange={handleChange} 
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
            Create Account
          </button>
        </form>

        <div style={styles.footerText}>
          Already have an account? <Link to="/login" style={styles.link}>Sign in securely</Link>
        </div>
      </div>
    </div>
  );
}
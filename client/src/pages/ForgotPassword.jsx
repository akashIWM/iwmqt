import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', otp: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  
  // UI States
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOtp = async () => {
    setError('');
    setSuccess('');
    if (!formData.email) return setError('Please enter your registered email address.');

    setIsSendingOtp(true);
    try {
      await axios.post('http://localhost:3000/api/auth/forgot-password-otp', { email: formData.email });
      setOtpSent(true);
      setSuccess('Verification code sent! Please check your inbox.');
    } catch (err) {
      // If the email isn't found, we show the generic message returned by the server
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (formData.newPassword !== formData.confirmPassword) return setError('Passwords do not match');

    try {
      await axios.post('http://localhost:3000/api/auth/reset-password', formData);
      alert('Password reset successfully! You can now log in.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    }
  };

  // --- STYLES (Matching your existing theme) ---
  const styles = {
    container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)', fontFamily: '"Inter", sans-serif', padding: '20px' },
    card: { background: '#ffffff', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)', width: '100%', maxWidth: '450px', boxSizing: 'border-box' },
    header: { textAlign: 'center', marginBottom: '30px' },
    title: { margin: '0 0 8px 0', color: '#102a43', fontSize: '24px', fontWeight: '700' },
    subtitle: { margin: '0', color: '#627d98', fontSize: '14px' },
    inputGroup: { marginBottom: '18px' },
    label: { display: 'block', marginBottom: '6px', color: '#334e68', fontSize: '13px', fontWeight: '600' },
    input: { width: '100%', padding: '12px 14px', border: '1px solid #d9e2ec', borderRadius: '8px', fontSize: '14px', color: '#102a43', backgroundColor: '#f8f9fa', boxSizing: 'border-box', outline: 'none' },
    passwordWrapper: { position: 'relative' },
    toggleBtn: { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#245a9e', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '0' },
    passwordHint: { display: 'block', marginTop: '6px', color: '#829ab1', fontSize: '11px' },
    flexRow: { display: 'flex', gap: '12px' },
    sendOtpBtn: { padding: '0 16px', backgroundColor: isSendingOtp ? '#e1e8f0' : '#f0f4f8', color: '#245a9e', border: '1px solid #d9e2ec', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: isSendingOtp ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' },
    button: { width: '100%', padding: '14px', marginTop: '10px', backgroundColor: isHovered ? '#1e4e8c' : '#245a9e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s ease' },
    errorBox: { backgroundColor: '#ffe3e3', color: '#c92a2a', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: '500', textAlign: 'center' },
    successBox: { backgroundColor: '#d3f9d8', color: '#2b8a3e', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: '500', textAlign: 'center' },
    footerText: { marginTop: '24px', textAlign: 'center', fontSize: '13px' },
    link: { color: '#245a9e', textDecoration: 'none', fontWeight: '600' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Reset Password</h2>
          <p style={styles.subtitle}>Securely recover your trading account</p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Registered Email Address</label>
            <div style={styles.flexRow}>
              <input 
                type="email" name="email" value={formData.email} onChange={handleChange} 
                required style={{ ...styles.input, flex: 1 }} placeholder="name@iwmquant.com" 
                disabled={otpSent} 
              />
              {!otpSent && (
                <button type="button" onClick={handleSendOtp} disabled={isSendingOtp} style={styles.sendOtpBtn}>
                  {isSendingOtp ? 'Sending...' : 'Send OTP'}
                </button>
              )}
            </div>
          </div>

          {otpSent && (
            <>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Verification Code (OTP)</label>
                <input 
                  type="text" name="otp" value={formData.otp} onChange={handleChange} 
                  required style={{ ...styles.input, letterSpacing: '2px', textAlign: 'center', fontSize: '18px' }} 
                  placeholder="••••••" maxLength="6"
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>New Password</label>
                <div style={styles.passwordWrapper}>
                  <input 
                    type={showPassword ? "text" : "password"} name="newPassword" 
                    value={formData.newPassword} onChange={handleChange} required 
                    style={{ ...styles.input, paddingRight: '60px' }} placeholder="••••••••" 
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
                    type={showPassword ? "text" : "password"} name="confirmPassword" 
                    value={formData.confirmPassword} onChange={handleChange} required 
                    style={{ ...styles.input, paddingRight: '60px' }} placeholder="••••••••" 
                  />
                </div>
              </div>

              <button 
                type="submit" style={styles.button}
                onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
              >
                Reset Password
              </button>
            </>
          )}
        </form>

        <div style={styles.footerText}>
          Remember your password? <Link to="/login" style={styles.link}>Return to Login</Link>
        </div>
      </div>
    </div>
  );
}
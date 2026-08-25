import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Non-blocking warning starting 3 days before password_expires_at. Expiry itself (day 0)
// is handled separately by ProtectedRoute forcing a redirect, not by this banner.
export default function PasswordExpiryBanner({ user }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(null); // Date.now() is impure - only read inside an effect

  useEffect(() => {
    // setState only inside timer callbacks, never synchronously in the effect body itself.
    const tick = () => setNow(Date.now());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 60000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  if (!user?.passwordExpiresAt || dismissed || now === null) return null;

  const daysLeft = Math.ceil((new Date(user.passwordExpiresAt).getTime() - now) / 86400000);
  if (daysLeft > 3 || daysLeft <= 0) return null;

  const styles = {
    bar: {
      position: 'sticky', top: 0, zIndex: 500,
      background: '#fff4e0', color: '#8a5a00',
      padding: '8px 16px', fontSize: '13px', fontWeight: '600',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
      fontFamily: '"Inter", sans-serif', borderBottom: '1px solid #f0d090'
    },
    button: {
      background: '#8a5a00', color: '#fff', border: 'none', borderRadius: '4px',
      padding: '4px 10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
    },
    dismiss: { background: 'none', border: 'none', color: '#8a5a00', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }
  };

  return (
    <div style={styles.bar}>
      <span>Your password expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}.</span>
      <button style={styles.button} onClick={() => navigate('/change-password')}>Change Now</button>
      <button style={styles.dismiss} onClick={() => setDismissed(true)} aria-label="Dismiss">×</button>
    </div>
  );
}

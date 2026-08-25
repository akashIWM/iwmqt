import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import PasswordExpiryBanner from './PasswordExpiryBanner';
import IdleWarningModal from './IdleWarningModal';

const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 min idle before forced logout
const IDLE_WARNING_MS = 60 * 1000; // show the countdown for the last 60s of that

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(null); // null = no idle warning showing
  const [passwordExpired, setPasswordExpired] = useState(false);
  const lastActivityRef = useRef(0);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSecondsLeft(null);
  }, []);

  // Checked once on mount/whenever the expiry date changes, not on every render - Date.now()
  // is impure and must stay out of the render body, and setState must stay inside a timer
  // callback rather than run synchronously in the effect body.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPasswordExpired(!!user?.passwordExpiresAt && new Date(user.passwordExpiresAt).getTime() <= Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, [user?.passwordExpiresAt]);

  useEffect(() => {
    if (!user) return;

    lastActivityRef.current = Date.now();
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, resetActivity));

    const interval = setInterval(() => {
      const remaining = IDLE_LIMIT_MS - (Date.now() - lastActivityRef.current);
      if (remaining <= 0) {
        logout().then(() => navigate('/login'));
      } else if (remaining <= IDLE_WARNING_MS) {
        setSecondsLeft(Math.ceil(remaining / 1000));
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetActivity));
      clearInterval(interval);
    };
  }, [user, resetActivity, logout, navigate]);

  if (loading) return <div>Loading session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <div>Access Denied: Insufficient Role Permissions</div>;
  }

  // Password expiry forces the change flow rather than just warning, once it's actually due.
  if (passwordExpired) {
    return <Navigate to="/change-password?forced=1" replace />;
  }

  return (
    <>
      <PasswordExpiryBanner user={user} />
      {children}
      {secondsLeft !== null && <IdleWarningModal secondsLeft={secondsLeft} onStayLoggedIn={resetActivity} />}
    </>
  );
};

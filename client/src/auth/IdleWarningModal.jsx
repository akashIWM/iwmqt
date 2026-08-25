// Visible countdown before a forced idle logout - the spec requires the warning be seen,
// not just the timeout enforced silently.
export default function IdleWarningModal({ secondsLeft, onStayLoggedIn }) {
  const styles = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(16, 42, 67, 0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    },
    card: {
      background: '#ffffff', borderRadius: '12px', padding: '32px', maxWidth: '360px',
      textAlign: 'center', fontFamily: '"Inter", sans-serif', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
    },
    title: { margin: '0 0 12px 0', color: '#102a43', fontSize: '18px', fontWeight: '700' },
    body: { margin: '0 0 20px 0', color: '#627d98', fontSize: '14px' },
    countdown: { fontSize: '28px', fontWeight: '700', color: '#c92a2a', margin: '0 0 20px 0' },
    button: {
      width: '100%', padding: '12px', backgroundColor: '#245a9e', color: '#fff', border: 'none',
      borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer'
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <h3 style={styles.title}>Still there?</h3>
        <p style={styles.body}>You've been idle. For your security, you'll be signed out automatically.</p>
        <p style={styles.countdown}>{secondsLeft}s</p>
        <button style={styles.button} onClick={onStayLoggedIn}>Stay Signed In</button>
      </div>
    </div>
  );
}

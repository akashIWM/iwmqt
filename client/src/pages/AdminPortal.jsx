import { API_BASE_URL } from '../api';
import AdminDashboard from '../components/AdminDashboard';

export default function AdminPortal() {
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include' 
      });
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const navStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 30px',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
    color: '#fff',
    fontFamily: '"Inter", sans-serif'
  };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh' }}>
      {/* Admin Top Navigation Bar */}
      <nav style={navStyles}>
        <div style={{ fontWeight: '700', fontSize: '16px', letterSpacing: '0.5px' }}>
          IWM Quant <span style={{ color: '#38bdf8', fontSize: '12px' }}>| RMS & Admin Control</span>
        </div>
        <button 
          onClick={handleLogout}
          style={{
            padding: '8px 14px',
            backgroundColor: '#c92a2a',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Logout
        </button>
      </nav>

      {/* Render the Dashboard Component */}
      <AdminDashboard />
    </div>
  );
}
import { useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import AdminDashboard from '../components/AdminDashboard';
import UserRoleManagement from '../components/admin/UserRoleManagement';
import OmsConfigPanel from '../components/admin/OmsConfigPanel';
import KillSwitchPanel from '../components/admin/KillSwitchPanel';
import AuditLogPanel from '../components/admin/AuditLogPanel';
import OrderBook from '../components/OrderBook';
import NetPositions from '../components/NetPositions';
import Watchlist from '../components/Watchlist';
import BanScript from '../components/BanScript';

const TABS = [
  { key: 'dashboard', label: 'RMS Dashboard' },
  { key: 'users', label: 'User & Role Management' },
  { key: 'oms-config', label: 'Server / OMS Config' },
  { key: 'kill-switch', label: 'Kill Switch' },
  { key: 'audit-log', label: 'Audit Log' },
  { key: 'orders', label: 'Order Book & Trade Book' },
  { key: 'positions', label: 'Net Positions' },
  { key: 'watchlist', label: 'Watchlist & BanScript' }
];

const PANELS = {
  dashboard: () => <AdminDashboard />,
  users: () => (
    <div style={{ padding: '20px' }}>
      <UserRoleManagement />
    </div>
  ),
  'oms-config': () => (
    <div style={{ padding: '20px' }}>
      <OmsConfigPanel />
    </div>
  ),
  'kill-switch': () => (
    <div style={{ padding: '20px' }}>
      <KillSwitchPanel />
    </div>
  ),
  'audit-log': () => (
    <div style={{ padding: '20px' }}>
      <AuditLogPanel />
    </div>
  ),
  orders: () => (
    <div style={{ padding: '20px' }}>
      <OrderBook />
    </div>
  ),
  positions: () => (
    <div style={{ padding: '20px' }}>
      <NetPositions />
    </div>
  ),
  watchlist: () => (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Watchlist />
      <BanScript />
    </div>
  )
};

export default function AdminPortal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'dashboard';

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

  const tabBarStyles = {
    display: 'flex',
    gap: '4px',
    padding: '0 24px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #334155',
    overflowX: 'auto'
  };

  const tabButtonStyle = (isActive) => ({
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
    color: isActive ? '#38bdf8' : '#94a3b8',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  });

  const ActivePanel = PANELS[activeTab];

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

      {/* Module Tab Bar */}
      <div style={tabBarStyles}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={tabButtonStyle(activeTab === tab.key)}
            onClick={() => setSearchParams(tab.key === 'dashboard' ? {} : { tab: tab.key })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Render the Active Module */}
      <ActivePanel />
    </div>
  );
}

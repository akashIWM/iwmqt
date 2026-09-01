import { useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../auth/AuthContext';
import AdminDashboard from '../components/AdminDashboard';
import UserRoleManagement from '../components/admin/UserRoleManagement';
import OmsConfigPanel from '../components/admin/OmsConfigPanel';
import KillSwitchPanel from '../components/admin/KillSwitchPanel';
import AuditLogPanel from '../components/admin/AuditLogPanel';
import CompanyAccountManagement from '../components/admin/CompanyAccountManagement';
import SecurityLimitsPanel from '../components/admin/SecurityLimitsPanel';
import ServersPanel from '../components/admin/ServersPanel';
import LimitRequestsPanel from '../components/admin/LimitRequestsPanel';
import OrderBook from '../components/OrderBook';
import TradeBook from '../components/TradeBook';
import NetPositions from '../components/NetPositions';
import Watchlist from '../components/Watchlist';
import BanScript from '../components/BanScript';

const TABS = [
  { key: 'dashboard', label: 'RMS Dashboard' },
  { key: 'company-accounts', label: 'Company Account Management', superAdminOnly: true },
  { key: 'users', label: 'User & Role Management' },
  { key: 'oms-config', label: 'RMS Risk Limits (14 Controls)' },
  { key: 'limit-requests', label: 'PM Limit Requests' },
  { key: 'servers', label: 'Server / OMS Configuration' },
  { key: 'security-limits', label: 'Security-Wise Limits' },
  { key: 'kill-switch', label: 'Kill Switch' },
  { key: 'audit-log', label: 'Audit Log' },
  { key: 'orders', label: 'Order Book & Trade Book' },
  { key: 'positions', label: 'Net Positions' },
  { key: 'watchlist', label: 'Watchlist & BanScript' }
];

const PANELS = {
  dashboard: () => <AdminDashboard />,
  'company-accounts': () => (
    <div style={{ padding: '20px' }}>
      <CompanyAccountManagement />
    </div>
  ),
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
  'limit-requests': () => (
    <div style={{ padding: '20px' }}>
      <LimitRequestsPanel />
    </div>
  ),
  servers: () => (
    <div style={{ padding: '20px' }}>
      <ServersPanel />
    </div>
  ),
  'security-limits': () => (
    <div style={{ padding: '20px' }}>
      <SecurityLimitsPanel />
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
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <OrderBook />
      <TradeBook />
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
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const visibleTabs = TABS.filter((t) => !t.superAdminOnly || user.role === 'SUPER_ADMIN');
  const activeTab = visibleTabs.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'dashboard';

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
        {visibleTabs.map((tab) => (
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

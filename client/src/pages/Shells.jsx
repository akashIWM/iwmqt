import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import Watchlist from '../components/Watchlist';
import OrderBook from '../components/OrderBook';
import TradeWindow from '../components/TradeWindow';
import NetPositions from '../components/NetPositions';
import BanScript from '../components/BanScript';
import { useAuth } from '../auth/AuthContext';
import OpenOrders from '../components/OpenOrders';
import StrategyPanel from '../components/StrategyPanel';
import LogWindow from '../components/LogWindow';
import RmsStatsSummary from '../components/admin/RmsStatsSummary';
import { useNavigate } from 'react-router-dom';

// --- SHARED STYLES FOR ALL SHELLS ---
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '24px',
    boxSizing: 'border-box'
  },
  navbar: {
    background: '#ffffff',
    padding: '16px 24px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  brandTitle: {
    margin: 0,
    color: '#102a43',
    fontSize: '20px',
    fontWeight: '700',
    letterSpacing: '-0.5px'
  },
  userInfo: {
    margin: '4px 0 0 0',
    color: '#627d98',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '500'
  },
  statusDot: {
    height: '8px',
    width: '8px',
    backgroundColor: '#12b886',
    borderRadius: '50%',
    display: 'inline-block'
  },
  logoutBtn: {
    padding: '8px 16px',
    backgroundColor: '#ffe3e3',
    color: '#c92a2a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    boxShadow: '0 2px 4px rgba(201, 42, 42, 0.1)'
  },
  contentCard: {
    background: '#ffffff',
    padding: '32px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
    minHeight: '60vh'
  },
  pageTitle: {
    margin: '0 0 8px 0',
    color: '#102a43',
    fontSize: '24px',
    fontWeight: '700'
  },
  text: {
    color: '#334e68',
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 0 24px 0'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '16px'
  },
  moduleCard: {
    padding: '16px',
    border: '1px solid #d9e2ec',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  },
  moduleTitle: {
    margin: '0 0 8px 0',
    color: '#102a43',
    fontSize: '14px',
    fontWeight: '600'
  },
  moduleScope: {
    fontSize: '12px',
    color: '#245a9e',
    fontWeight: '600',
    backgroundColor: '#e1effe',
    padding: '4px 8px',
    borderRadius: '4px',
    alignSelf: 'flex-start'
  },
  table: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    borderCollapse: 'collapse',
    border: '1px solid #e4e7eb',
    marginTop: '16px'
  },
  th: {
    backgroundColor: '#f8f9fa',
    color: '#334e68',
    padding: '14px 16px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '700',
    borderBottom: '2px solid #e4e7eb'
  },
  td: {
    padding: '14px 16px',
    borderBottom: '1px solid #e4e7eb',
    color: '#102a43',
    fontSize: '14px'
  },
  select: {
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid #d9e2ec',
    backgroundColor: '#f8f9fa',
    outline: 'none',
    fontSize: '13px',
    color: '#102a43',
    cursor: 'pointer'
  },
  actionBtn: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '12px',
    color: 'white',
    transition: 'opacity 0.2s'
  }
};

// Reusable Component for Access Modules
const AccessModule = ({ title, scope, onClick }) => (
  <div 
    style={{ ...styles.moduleCard, cursor: onClick ? 'pointer' : 'default' }}
    onClick={onClick}
  >
    <h4 style={styles.moduleTitle}>{title}</h4>
    <span style={styles.moduleScope}>{scope}</span>
  </div>
);

// --- 1. TRADER SHELL ---
export const TraderShell = () => {
  const { user, logout } = useAuth();
  const [activePanel, setActivePanel] = useState(null);

  const tabs = [
    { id: 'TradeWindow', label: 'Trade' },
    { id: 'OrderWindow', label: 'Order Book' },
    { id: 'OpenOrders', label: 'Open Orders' },
    { id: 'NetPositions', label: 'Positions' },
    { id: 'BanScript', label: 'Ban Script' },
    { id: 'Strategy', label: 'Strategy' },
    { id: 'LogWindow', label: 'Logs' }
  ];

  const layoutStyles = {
    wrapper: {
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
      fontFamily: '"Inter", sans-serif',
      overflow: 'hidden'
    },
    topNav: {
      background: '#ffffff',
      padding: '12px 24px',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 10
    },
    mainArea: {
      display: 'flex',
      flex: 1,
      overflow: 'hidden'
    },
    workspace: {
      flex: 1,
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.3s ease'
    },
    sidePanel: {
      width: activePanel ? '400px' : '0px',
      backgroundColor: '#ffffff',
      borderLeft: activePanel ? '1px solid #d9e2ec' : 'none',
      transition: 'width 0.3s ease',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    },
    panelHeader: {
      padding: '16px',
      backgroundColor: '#f8f9fa',
      borderBottom: '1px solid #d9e2ec',
      fontWeight: '700',
      color: '#102a43',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    panelContent: {
      padding: '16px',
      flex: 1,
      overflowY: 'auto'
    },
    tabRail: {
      width: '60px',
      backgroundColor: '#102a43',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '16px',
      gap: '8px',
      zIndex: 10
    },
    tabButton: (isActive) => ({
      writingMode: 'vertical-rl',
      textOrientation: 'mixed',
      transform: 'rotate(180deg)',
      padding: '16px 8px',
      backgroundColor: isActive ? '#245a9e' : 'transparent',
      color: isActive ? '#ffffff' : '#829ab1',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      transition: 'all 0.2s ease',
      letterSpacing: '1px'
    }),
    closeBtn: {
      background: 'none',
      border: 'none',
      color: '#627d98',
      cursor: 'pointer',
      fontWeight: 'bold',
      fontSize: '16px'
    }
  };

  return (
    <div style={layoutStyles.wrapper}>
      <header style={layoutStyles.topNav}>
        <div>
          <h2 style={styles.brandTitle}>IWM Quant | NSE F&O</h2>
          <p style={styles.userInfo}>
            <span style={styles.statusDot}></span>Trader | {user.userId}
          </p>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Disconnect</button>
      </header>

      <div style={layoutStyles.mainArea}>
        <div style={layoutStyles.workspace}>
          <Watchlist />
        </div>

        <div style={layoutStyles.sidePanel}>
          {activePanel && (
            <>
              <div style={layoutStyles.panelHeader}>
                {tabs.find(t => t.id === activePanel)?.label}
                <button style={layoutStyles.closeBtn} onClick={() => setActivePanel(null)}>✕</button>
              </div>
              <div style={layoutStyles.panelContent}>
                {activePanel === 'TradeWindow' && <TradeWindow />}
                {activePanel === 'OrderWindow' && <OrderBook />}
                {activePanel === 'OpenOrders' && <OpenOrders />}
                {activePanel === 'NetPositions' && <NetPositions />}
                {activePanel === 'BanScript' && <BanScript />}
                {activePanel === 'Strategy' && <StrategyPanel />}
                {activePanel === 'LogWindow' && <LogWindow />}

                {!['TradeWindow', 'OrderWindow', 'NetPositions', 'BanScript'].includes(activePanel) && (
                  <p style={{ color: '#627d98', fontSize: '14px' }}>
                    {activePanel} module is coming soon.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div style={layoutStyles.tabRail}>
          {tabs.map((tab) => (
            <button 
              key={tab.id}
              style={layoutStyles.tabButton(activePanel === tab.id)}
              onClick={() => setActivePanel(current => current === tab.id ? null : tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- 2. RMS ADMIN SHELL ---
export const RMSAdminShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div style={styles.container}>
      <header style={styles.navbar}>
        <div>
          <h2 style={styles.brandTitle}>IWM Quant | NSE F&O</h2>
          <p style={styles.userInfo}><span style={styles.statusDot}></span>RMS Admin | {user.userId}</p>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Disconnect</button>
      </header>
      <main style={styles.contentCard}>
        <h3 style={styles.pageTitle}>RMS Administration</h3>
        <p style={styles.text}>Welcome, <strong>{user.fullName}</strong>. Here are your authorized modules:</p>
        
        <div style={styles.grid}>
          <AccessModule title="RMS Dashboard (14 Controls)" scope="✔ Edit" onClick={() => navigate('/app/admin')} />
          <AccessModule title="User & Role Management" scope="✔ Own Entity" onClick={() => navigate('/app/admin?tab=users')} />
          <AccessModule title="Server / OMS Config" scope="✔ Entity Scope" onClick={() => navigate('/app/admin?tab=oms-config')} />
          <AccessModule title="Security-Wise Limits" scope="✔ Entity Scope" onClick={() => navigate('/app/admin?tab=security-limits')} />
          <AccessModule title="Kill Switch" scope="✔ User / Global" onClick={() => navigate('/app/admin?tab=kill-switch')} />
          <AccessModule title="Audit Log" scope="✔ Entity-wide" onClick={() => navigate('/app/admin?tab=audit-log')} />
          <AccessModule title="Order Book & Trade Book" scope="View (Entity)" onClick={() => navigate('/app/admin?tab=orders')} />
          <AccessModule title="Net Positions" scope="View (Entity)" onClick={() => navigate('/app/admin?tab=positions')} />
          <AccessModule title="Watchlist & BanScript" scope="View-Only" onClick={() => navigate('/app/admin?tab=watchlist')} />
        </div>
      </main>
    </div>
  );
};

// --- 3. PM (PORTFOLIO MANAGER) SHELL ---
// PM is view-only/approval-routing per spec (no order entry, no RMS-limit edit rights), so
// its modules render inline here rather than routing into the RMS Admin edit-capable portal.
export const PMShell = () => {
  const { user, logout } = useAuth();
  const [activeModule, setActiveModule] = useState(null);

  const modules = {
    positions: { label: 'Net Positions (Aggregated)', render: () => <NetPositions /> },
    orders: { label: 'Order Book & Trade Book', render: () => <OrderBook /> },
    rms: { label: 'RMS Dashboard (View-Only)', render: () => <RmsStatsSummary /> },
    watchlist: { label: 'Watchlist', render: () => <Watchlist /> },
    banscript: { label: 'BanScript Alerts', render: () => <BanScript /> }
  };

  return (
    <div style={styles.container}>
      <header style={styles.navbar}>
        <div>
          <h2 style={styles.brandTitle}>IWM Quant | NSE F&O</h2>
          <p style={styles.userInfo}><span style={styles.statusDot}></span>Portfolio Manager | {user.userId}</p>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Disconnect</button>
      </header>
      <main style={styles.contentCard}>
        <h3 style={styles.pageTitle}>Portfolio Management</h3>
        <p style={styles.text}>Welcome, <strong>{user.fullName}</strong>. Here are your authorized modules:</p>

        <div style={styles.grid}>
          <AccessModule title="Net Positions" scope="✔ Aggregated (Desk)" onClick={() => setActiveModule('positions')} />
          <AccessModule title="Order Book & Trade Book" scope="View (Desk)" onClick={() => setActiveModule('orders')} />
          <AccessModule title="RMS Dashboard" scope="View-Only (Own Desk)" onClick={() => setActiveModule('rms')} />
          <AccessModule title="Watchlist" scope="View-Only" onClick={() => setActiveModule('watchlist')} />
          <AccessModule title="BanScript Alerts" scope="View-Only" onClick={() => setActiveModule('banscript')} />
        </div>

        {activeModule && (
          <div style={{ marginTop: '24px' }}>
            <hr style={{ margin: '0 0 24px 0', border: 'none', borderTop: '1px solid #d9e2ec' }} />
            <h3 style={styles.pageTitle}>{modules[activeModule].label}</h3>
            {modules[activeModule].render()}
          </div>
        )}
      </main>
    </div>
  );
};

// --- 4. COMPANY ACCOUNT SHELL ---
export const CompanyShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div style={styles.container}>
      <header style={styles.navbar}>
        <div>
          <h2 style={styles.brandTitle}>IWM Quant | NSE F&O</h2>
          <p style={styles.userInfo}><span style={styles.statusDot}></span>Company Account | {user.userId}</p>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Disconnect</button>
      </header>
      <main style={styles.contentCard}>
        <h3 style={styles.pageTitle}>Entity Management</h3>
        <p style={styles.text}>Welcome, <strong>{user.fullName}</strong>. Here are your authorized modules:</p>
        
        <div style={styles.grid}>
          <AccessModule title="User & Role Management" scope="✔ Own Entity" onClick={() => navigate('/app/admin?tab=users')} />
          <AccessModule title="Server / OMS Config" scope="✔ Entity Scope" onClick={() => navigate('/app/admin?tab=oms-config')} />
          <AccessModule title="Security-Wise Limits" scope="✔ Entity Scope" onClick={() => navigate('/app/admin?tab=security-limits')} />
          <AccessModule title="Kill Switch" scope="✔ Entity-wide" onClick={() => navigate('/app/admin?tab=kill-switch')} />
          <AccessModule title="Audit Log" scope="✔ Entity-wide" onClick={() => navigate('/app/admin?tab=audit-log')} />
          <AccessModule title="Order Book & Trade Book" scope="View (Entity)" onClick={() => navigate('/app/admin?tab=orders')} />
          <AccessModule title="Net Positions" scope="View (Entity)" onClick={() => navigate('/app/admin?tab=positions')} />
          <AccessModule title="RMS Dashboard" scope="View-Only" onClick={() => navigate('/app/admin')} />
          <AccessModule title="Watchlist & BanScript" scope="View-Only" onClick={() => navigate('/app/admin?tab=watchlist')} />
        </div>
      </main>
    </div>
  );
};

// --- 5. SUPER ADMIN SHELL ---
export const SuperAdminShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE_URL}/admin/users`)
      .then((response) => {
        if (active) setUsers(response.data.users);
      })
      .catch(() => {
        if (active) setError('Failed to load user data. Check permissions or network.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`${API_BASE_URL}/admin/users/${userId}/role`, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    try {
      await axios.put(`${API_BASE_URL}/admin/users/${userId}/status`, { status: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.navbar}>
        <div>
          <h2 style={styles.brandTitle}>IWM Quant | Core System</h2>
          <p style={styles.userInfo}>
            <span style={{...styles.statusDot, backgroundColor: '#f59f00'}}></span>
            Super Admin | {user.userId}
          </p>
        </div>
        <button style={styles.logoutBtn} onClick={logout}>Disconnect</button>
      </header>
      <main style={styles.contentCard}>
        <h3 style={styles.pageTitle}>Platform Administration</h3>
        <p style={styles.text}>Welcome, <strong>{user.fullName}</strong>. Here are your authorized modules:</p>
        
        {/* Module Summary Grid */}
        <div style={styles.grid}>
          <AccessModule title="Company Account Management" scope="✔ Full Access" onClick={() => navigate('/app/admin?tab=company-accounts')} />
          <AccessModule title="User & Role Management" scope="✔ Global" onClick={() => navigate('/app/admin?tab=users')} />
          <AccessModule title="Server / OMS Config" scope="✔ Global" onClick={() => navigate('/app/admin?tab=oms-config')} />
          <AccessModule title="Security-Wise Limits" scope="✔ Global" onClick={() => navigate('/app/admin?tab=security-limits')} />
          <AccessModule title="Kill Switch" scope="✔ Platform-wide" onClick={() => navigate('/app/admin?tab=kill-switch')} />
          <AccessModule title="Audit Log" scope="✔ Platform-wide" onClick={() => navigate('/app/admin?tab=audit-log')} />
          <AccessModule title="RMS Dashboard" scope="View-Only" onClick={() => navigate('/app/admin')} />
        </div>

        <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid #d9e2ec' }} />
        
        {/* Dynamic User Management Table */}
        <h3 style={styles.pageTitle}>User Management Console</h3>
        
        {loading ? (
          <p style={styles.text}>Loading user data...</p>
        ) : error ? (
          <p style={{ ...styles.text, color: '#c92a2a' }}>{error}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Full Name</th>
                  <th style={styles.th}>User ID</th>
                  <th style={styles.th}>Email Address</th>
                  <th style={styles.th}>Assigned Role</th>
                  <th style={styles.th}>Account Status</th>
                  <th style={styles.th}>Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ transition: 'background-color 0.2s' }}>
                    <td style={styles.td}>{u.full_name}</td>
                    <td style={styles.td}><strong>{u.user_id}</strong></td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}>
                      <select 
                        style={styles.select} 
                        value={u.role} 
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="TRADER">Trader</option>
                        <option value="PM">Portfolio Manager</option>
                        <option value="RMS_ADMIN">RMS Admin</option>
                        <option value="COMPANY_ACCOUNT">Company Account</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                    </td>
                    <td style={styles.td}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: '700',
                        letterSpacing: '0.5px',
                        backgroundColor: u.status === 'ACTIVE' ? '#d3f9d8' : '#ffe3e3',
                        color: u.status === 'ACTIVE' ? '#2b8a3e' : '#c92a2a'
                      }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button 
                        style={{ 
                          ...styles.actionBtn, 
                          backgroundColor: u.status === 'ACTIVE' ? '#fa5252' : '#40c057' 
                        }}
                        onClick={() => handleStatusToggle(u.id, u.status)}
                      >
                        {u.status === 'ACTIVE' ? 'Lock Account' : 'Unlock'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};
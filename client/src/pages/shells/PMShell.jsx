import { useState } from 'react';
import NetPositions from '../../components/NetPositions';
import OrderBook from '../../components/OrderBook';
import Watchlist from '../../components/Watchlist';
import BanScript from '../../components/BanScript';
import RmsStatsSummary from '../../components/admin/RmsStatsSummary';
import { useAuth } from '../../auth/AuthContext';
import { styles } from './styles';
import { AccessModule } from './shared';

// PM is view-only/approval-routing per spec (no order entry, no RMS-limit edit rights), so
// its modules render inline here rather than routing into the RMS Admin edit-capable portal.
export default function PMShell() {
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
}

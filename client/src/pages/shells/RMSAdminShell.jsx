import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { styles } from './styles';
import { AccessModule } from './shared';

export default function RMSAdminShell() {
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
          <AccessModule title="RMS Dashboard (Stats & BanScript)" scope="✔ Edit" onClick={() => navigate('/app/admin')} />
          <AccessModule title="RMS Risk Limits (14 Controls)" scope="✔ Edit" onClick={() => navigate('/app/admin?tab=oms-config')} />
          <AccessModule title="User & Role Management" scope="✔ Own Entity" onClick={() => navigate('/app/admin?tab=users')} />
          <AccessModule title="Server / OMS Configuration" scope="✔ Entity Scope" onClick={() => navigate('/app/admin?tab=servers')} />
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
}

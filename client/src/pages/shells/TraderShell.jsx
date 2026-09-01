import { useState } from 'react';
import Watchlist from '../../components/Watchlist';
import OrderBook from '../../components/OrderBook';
import TradeBook from '../../components/TradeBook';
import TradeWindow from '../../components/TradeWindow';
import NetPositions from '../../components/NetPositions';
import BanScript from '../../components/BanScript';
import OpenOrders from '../../components/OpenOrders';
import StrategyPanel from '../../components/StrategyPanel';
import LogWindow from '../../components/LogWindow';
import { useAuth } from '../../auth/AuthContext';
import { styles } from './styles';

export default function TraderShell() {
  const { user, logout } = useAuth();
  const [activePanel, setActivePanel] = useState(null);

  const tabs = [
    { id: 'TradeWindow', label: 'Trade' },
    { id: 'OrderWindow', label: 'Order Book' },
    { id: 'TradeBook', label: 'Trade Book' },
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
      overflowY: 'auto',
      position: 'relative'
    },
    // AG Grid sizes its viewport off its container's actual dimensions - a container
    // collapsed to 0x0 (display:none) can come back blank when made visible again, since
    // there's no guarantee the grid re-measures and repaints the instant it's shown. Keeping
    // every panel at its real size at all times (just moved off-screen when inactive) avoids
    // that class of bug entirely, instead of hiding via display:none.
    panelSlot: (isActive) => (isActive
      ? { position: 'relative' }
      : { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, visibility: 'hidden', pointerEvents: 'none' }
    ),
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
          {/* Header/content are always in the tree (not gated on activePanel) so every panel
              below mounts the instant the shell loads and starts fetching/polling/listening in
              the background right away - not just once first clicked. The sidePanel's own
              width collapses to 0px when nothing is active (see layoutStyles above), so this
              costs nothing visually while idle. */}
          <div style={layoutStyles.panelHeader}>
            {tabs.find(t => t.id === activePanel)?.label}
            <button style={layoutStyles.closeBtn} onClick={() => setActivePanel(null)}>✕</button>
          </div>
          <div style={layoutStyles.panelContent}>
            {/* Every panel stays mounted for the lifetime of the shell instead of
                mounting/unmounting per tab click - each one keeps fetching, polling, and
                listening for pushes in the background, so opening any tab - the first time or
                the fiftieth - is an instant toggle instead of a fresh REST round trip. Inactive
                panels are moved off-screen (panelSlot), not display:none'd - AG Grid sizes its
                viewport off the container's real dimensions, and a container that was ever
                0x0 isn't guaranteed to repaint the instant it becomes visible again. */}
            <div style={layoutStyles.panelSlot(activePanel === 'TradeWindow')}><TradeWindow /></div>
            <div style={layoutStyles.panelSlot(activePanel === 'OrderWindow')}><OrderBook /></div>
            <div style={layoutStyles.panelSlot(activePanel === 'TradeBook')}><TradeBook /></div>
            <div style={layoutStyles.panelSlot(activePanel === 'OpenOrders')}><OpenOrders /></div>
            <div style={layoutStyles.panelSlot(activePanel === 'NetPositions')}><NetPositions /></div>
            <div style={layoutStyles.panelSlot(activePanel === 'BanScript')}><BanScript /></div>
            <div style={layoutStyles.panelSlot(activePanel === 'Strategy')}><StrategyPanel /></div>
            <div style={layoutStyles.panelSlot(activePanel === 'LogWindow')}><LogWindow /></div>

            {activePanel && !tabs.some((t) => t.id === activePanel) && (
              <p style={{ color: '#627d98', fontSize: '14px' }}>
                {activePanel} module is coming soon.
              </p>
            )}
          </div>
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
}

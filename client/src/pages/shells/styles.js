// --- SHARED STYLES FOR ALL SHELLS ---
export const styles = {
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

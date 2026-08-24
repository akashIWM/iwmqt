import { styles } from './styles';

// Reusable Component for Access Modules
export const AccessModule = ({ title, scope, onClick }) => (
  <div
    style={{ ...styles.moduleCard, cursor: onClick ? 'pointer' : 'default' }}
    onClick={onClick}
  >
    <h4 style={styles.moduleTitle}>{title}</h4>
    <span style={styles.moduleScope}>{scope}</span>
  </div>
);

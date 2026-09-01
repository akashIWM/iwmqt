import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api';
import { RMS_LIMIT_FIELDS } from '../../constants/rmsLimitFields';
import { gridColors } from '../../styles/gridTheme';

const styles = {
  card: { backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  text: { color: gridColors.muted, fontSize: '13px', marginBottom: '16px' },
  row: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'flex-start' },
  select: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#f8f9fa', color: gridColors.primary, fontSize: '13px', minWidth: '220px' },
  input: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#f8f9fa', color: gridColors.primary, fontSize: '13px', width: '160px' },
  textarea: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#f8f9fa', color: gridColors.primary, fontSize: '13px', width: '100%', minHeight: '60px', boxSizing: 'border-box' },
  btn: { padding: '8px 16px', backgroundColor: gridColors.accent, color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' },
  currentValue: { fontSize: '12px', color: gridColors.muted, marginTop: '4px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '8px' },
  th: { textAlign: 'left', padding: '6px 8px', color: gridColors.muted, borderBottom: '1px solid #e2e8f0', fontSize: '11px', textTransform: 'uppercase' },
  td: { padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }
};

const statusColor = (status) => (
  status === 'APPROVED' ? gridColors.buy : status === 'REJECTED' ? gridColors.sell : gridColors.pending
);

// PM's half of the approval workflow (GUI spec 2.1: "request limit changes to RMS Admin").
// PM has no edit rights on oms_config directly (RMS Admin only) - this is the actual
// mechanism for "request" rather than the RmsStatsSummary note that used to just say
// "contact your RMS Admin" with no way to actually do it.
export default function LimitChangeRequestForm() {
  const [limits, setLimits] = useState(null);
  const [requests, setRequests] = useState([]);
  const [fieldKey, setFieldKey] = useState(RMS_LIMIT_FIELDS[0].key);
  const [requestedValue, setRequestedValue] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [utilRes, reqRes] = await Promise.all([
        apiFetch('/rms/desk-utilisation'),
        apiFetch('/limit-requests')
      ]);
      const utilData = await utilRes.json();
      const reqData = await reqRes.json();
      if (utilRes.ok) setLimits(utilData.limits);
      if (reqRes.ok) setRequests(reqData.requests);
    } catch (err) {
      console.error('Failed to load limit request data:', err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const response = await apiFetch('/limit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldKey, requestedValue, reason })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Request submitted to RMS Admin.');
        setRequestedValue('');
        setReason('');
        loadData();
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error('Failed to submit limit request:', err);
      setMessage('Network error submitting request');
    }
  };

  const currentValue = limits ? limits[fieldKey] : null;

  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0, color: gridColors.primary }}>Request a Limit Change</h3>
      <p style={styles.text}>
        You cannot edit RMS risk limits directly - submit a proposed value and reason, and your RMS Admin will approve or reject it.
      </p>
      {message && <p style={{ color: message.startsWith('Error') ? gridColors.sell : gridColors.buy, fontSize: '13px' }}>{message}</p>}

      <form onSubmit={handleSubmit}>
        <div style={styles.row}>
          <div>
            <select style={styles.select} value={fieldKey} onChange={(e) => setFieldKey(e.target.value)}>
              {RMS_LIMIT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label} ({f.control})</option>)}
            </select>
            {currentValue !== null && (
              <div style={styles.currentValue}>Current value: {Number(currentValue).toLocaleString()}</div>
            )}
          </div>
          <input
            style={styles.input} type="number" placeholder="Requested value"
            value={requestedValue} onChange={(e) => setRequestedValue(e.target.value)} required
          />
        </div>
        <div style={styles.row}>
          <textarea
            style={styles.textarea} placeholder="Reason (e.g. a specific trader is repeatedly hitting this limit)"
            value={reason} onChange={(e) => setReason(e.target.value)} required
          />
        </div>
        <button type="submit" style={styles.btn}>Submit Request</button>
      </form>

      <h4 style={{ marginTop: '20px', marginBottom: '8px', color: gridColors.primary, fontSize: '13px' }}>Your Requests</h4>
      {requests.length === 0 ? (
        <p style={styles.text}>No requests submitted yet.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Field</th>
              <th style={styles.th}>Current → Requested</th>
              <th style={styles.th}>Reason</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td style={styles.td}>{RMS_LIMIT_FIELDS.find((f) => f.key === r.field_key)?.label || r.field_key}</td>
                <td style={styles.td}>{Number(r.current_value).toLocaleString()} → {Number(r.requested_value).toLocaleString()}</td>
                <td style={styles.td}>{r.reason}</td>
                <td style={{ ...styles.td, color: statusColor(r.status), fontWeight: '700' }}>
                  {r.status}{r.status === 'REJECTED' && r.review_note ? ` - ${r.review_note}` : ''}
                </td>
                <td style={styles.td}>{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

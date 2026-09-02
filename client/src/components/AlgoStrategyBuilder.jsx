import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api';
import { gridColors } from '../styles/gridTheme';

// Multi-leg strategy builder - each leg is one real LIMIT order (symbol/side/lots/price).
// Simplified from a full options-chain picker (Instrument+Expiry+Strike+Opt as separate
// dropdowns) down to a single Symbol dropdown, because this app's mock market data is a
// fixed list of 6 already-fully-specified instruments, not a real options chain - the
// strike/option-type/expiry are already encoded in the symbol string itself (e.g. "NIFTY
// 24500 CE"). When a real instrument master exists, this dropdown is the one place that
// needs to change.
const EXECUTION_MODES = [{ value: 'AGGRESSIVE_SWEEP', label: '1 - Aggressive (sweep)' }];

const emptyLeg = (n) => ({ legNumber: n, symbol: '', side: n === 1 ? 'BUY' : 'SELL', lots: 1, price: '' });

const styles = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(16,42,67,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '40px 20px' },
  modal: { backgroundColor: '#ffffff', borderRadius: '8px', width: '100%', maxWidth: '880px', border: '1px solid #d9e2ec', boxShadow: '0 12px 32px rgba(16,42,67,0.25)', fontFamily: '"Inter", sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #d9e2ec' },
  title: { fontWeight: '700', fontSize: '15px', color: gridColors.primary },
  closeBtn: { background: 'none', border: 'none', fontSize: '18px', color: gridColors.muted, cursor: 'pointer' },
  body: { padding: '20px', maxHeight: '70vh', overflowY: 'auto' },
  legRow: { display: 'grid', gridTemplateColumns: '30px 1.4fr 0.6fr 0.7fr 0.7fr 0.7fr 0.9fr', gap: '8px', alignItems: 'center', marginBottom: '8px' },
  legHeader: { display: 'grid', gridTemplateColumns: '30px 1.4fr 0.6fr 0.7fr 0.7fr 0.7fr 0.9fr', gap: '8px', fontSize: '10px', color: gridColors.muted, fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' },
  summaryTable: { width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '10px' },
  summaryTh: { textAlign: 'left', padding: '5px 8px', color: gridColors.muted, borderBottom: '1px solid #edf2f7', fontSize: '9.5px', textTransform: 'uppercase' },
  summaryTd: { padding: '5px 8px', borderBottom: '1px solid #edf2f7', color: gridColors.primary },
  input: { padding: '7px 8px', borderRadius: '4px', border: '1px solid #d9e2ec', fontSize: '12px', backgroundColor: '#f8f9fa', color: gridColors.primary, width: '100%', boxSizing: 'border-box' },
  select: { padding: '7px 8px', borderRadius: '4px', border: '1px solid #d9e2ec', fontSize: '12px', backgroundColor: '#f8f9fa', color: gridColors.primary, width: '100%' },
  sideSelect: (side) => ({
    padding: '7px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: '#f8f9fa', width: '100%', fontWeight: '700',
    border: `1.5px solid ${side === 'BUY' ? gridColors.buy : gridColors.sell}`,
    color: side === 'BUY' ? gridColors.buy : gridColors.sell
  }),
  label: { display: 'block', fontSize: '10px', fontWeight: '700', color: gridColors.muted, marginBottom: '4px', textTransform: 'uppercase' },
  section: { marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #edf2f7' },
  paramGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' },
  radioGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginTop: '4px' },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: gridColors.primary },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px', borderTop: '1px solid #d9e2ec' },
  btnGhost: { padding: '9px 16px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#fff', color: gridColors.muted, fontWeight: '700', fontSize: '12px', cursor: 'pointer' },
  btnPrimary: { padding: '9px 16px', borderRadius: '4px', border: 'none', backgroundColor: gridColors.accent, color: '#fff', fontWeight: '700', fontSize: '12px', cursor: 'pointer' },
  removeLegBtn: { background: 'none', border: 'none', color: gridColors.sell, cursor: 'pointer', fontSize: '14px', fontWeight: '700' },
  addLegBtn: { fontSize: '11px', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${gridColors.accent}`, backgroundColor: '#fff', color: gridColors.accent, fontWeight: '700', cursor: 'pointer', marginBottom: '10px' },
  error: { color: gridColors.sell, fontSize: '12px', marginBottom: '10px' }
};

export default function AlgoStrategyBuilder({ onClose, onCreated }) {
  const [instruments, setInstruments] = useState([]);
  const [name, setName] = useState('Ratio 2 Leg Strategy');
  const [legs, setLegs] = useState([emptyLeg(1), emptyLeg(2)]);
  const [unhedgedQtyMode, setUnhedgedQtyMode] = useState('RATIO');
  const [priceExecution, setPriceExecution] = useState('REVERT_ALL_LEGS');
  const [bidMode, setBidMode] = useState('NORMAL');
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [timeMs, setTimeMs] = useState(500);
  const [executionMode, setExecutionMode] = useState('AGGRESSIVE_SWEEP');
  const [priceDepth, setPriceDepth] = useState(1);
  const [orderDepth, setOrderDepth] = useState(2);
  const [allowedBidDepth, setAllowedBidDepth] = useState(0);
  const [allowedSlippage, setAllowedSlippage] = useState(100);
  const [marketRetries, setMarketRetries] = useState(5);
  const [tickSize, setTickSize] = useState(0.05);
  const [threshold, setThreshold] = useState(100);
  const [payoff, setPayoff] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const payoffDebounce = useRef();

  useEffect(() => {
    apiFetch('/strategies/instruments').then((r) => r.json()).then((data) => setInstruments(data.instruments || []));
  }, []);

  const fetchPayoff = useCallback((currentLegs) => {
    const validLegs = currentLegs.filter((l) => l.symbol && Number(l.lots) > 0 && Number(l.price) > 0);
    if (validLegs.length === 0) {
      setPayoff([]);
      return;
    }
    apiFetch('/strategies/payoff-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ legs: validLegs })
    }).then((r) => r.json()).then((data) => setPayoff(data.points || []));
  }, []);

  useEffect(() => {
    clearTimeout(payoffDebounce.current);
    payoffDebounce.current = setTimeout(() => fetchPayoff(legs), 300);
    return () => clearTimeout(payoffDebounce.current);
  }, [legs, fetchPayoff]);

  const updateLeg = (index, field, value) => {
    setLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, [field]: value } : leg)));
  };

  const addLeg = () => setLegs((prev) => [...prev, emptyLeg(prev.length + 1)]);
  const removeLeg = (index) => setLegs((prev) => prev.filter((_, i) => i !== index).map((leg, i) => ({ ...leg, legNumber: i + 1 })));

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const response = await apiFetch('/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, legs, unhedgedQtyMode, priceExecution, bidMode, allowDuplicates, timeMs,
          executionMode, priceDepth, orderDepth, allowedBidDepth, allowedSlippage, marketRetries, tickSize, threshold
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Failed to create strategy');
        return;
      }
      onCreated(data.strategy);
      onClose();
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const maxPnl = payoff.length ? Math.max(...payoff.map((p) => Math.abs(p.pnl)), 1) : 1;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Multi-Leg Strategy Builder</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          <label style={styles.label}>Algorithm Name</label>
          <input style={{ ...styles.input, marginBottom: '14px' }} value={name} onChange={(e) => setName(e.target.value)} />

          <div style={styles.legHeader}>
            <span>#</span><span>Symbol</span><span>Side</span><span>Lots</span><span>Price (Rs)</span><span>Token</span><span></span>
          </div>
          {legs.map((leg, i) => {
            const token = instruments.find((inst) => inst.symbol === leg.symbol)?.token;
            return (
              <div style={styles.legRow} key={i}>
                <span style={{ fontSize: '12px', color: gridColors.muted }}>{leg.legNumber}</span>
                <select style={styles.select} value={leg.symbol} onChange={(e) => updateLeg(i, 'symbol', e.target.value)}>
                  <option value="">Select symbol...</option>
                  {instruments.map((inst) => <option key={inst.symbol} value={inst.symbol}>{inst.symbol}</option>)}
                </select>
                <select style={styles.sideSelect(leg.side)} value={leg.side} onChange={(e) => updateLeg(i, 'side', e.target.value)}>
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </select>
                <input style={styles.input} type="number" min="1" value={leg.lots} onChange={(e) => updateLeg(i, 'lots', e.target.value)} />
                <input style={styles.input} type="number" step="0.05" value={leg.price} onChange={(e) => updateLeg(i, 'price', e.target.value)} />
                <span style={{ fontSize: '11px', color: gridColors.muted }}>{token || '—'}</span>
                {legs.length > 2 && <button style={styles.removeLegBtn} onClick={() => removeLeg(i)}>Remove</button>}
              </div>
            );
          })}
          <button style={styles.addLegBtn} onClick={addLeg}>+ Add Leg</button>

          <LegSummaryTable legs={legs} />

          <div style={styles.section}>
            <div style={styles.paramGrid}>
              <div>
                <label style={styles.label}>Execution Mode</label>
                <select style={styles.select} value={executionMode} onChange={(e) => setExecutionMode(e.target.value)}>
                  {EXECUTION_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div><label style={styles.label}>Price Depth</label><input style={styles.input} type="number" value={priceDepth} onChange={(e) => setPriceDepth(e.target.value)} /></div>
              <div><label style={styles.label}>Order Depth</label><input style={styles.input} type="number" value={orderDepth} onChange={(e) => setOrderDepth(e.target.value)} /></div>
              <div><label style={styles.label}>Allowed Bid Depth</label><input style={styles.input} type="number" value={allowedBidDepth} onChange={(e) => setAllowedBidDepth(e.target.value)} /></div>
              <div><label style={styles.label}>Allowed Slippage</label><input style={styles.input} type="number" value={allowedSlippage} onChange={(e) => setAllowedSlippage(e.target.value)} /></div>
              <div><label style={styles.label}>Market Retries</label><input style={styles.input} type="number" value={marketRetries} onChange={(e) => setMarketRetries(e.target.value)} /></div>
              <div><label style={styles.label}>Tick Size</label><input style={styles.input} type="number" step="0.01" value={tickSize} onChange={(e) => setTickSize(e.target.value)} /></div>
              <div><label style={styles.label}>Threshold Qty</label><input style={styles.input} type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
              <div><label style={styles.label}>Time (ms)</label><input style={styles.input} type="number" value={timeMs} onChange={(e) => setTimeMs(e.target.value)} /></div>
            </div>

            <div style={styles.radioGrid}>
              <div>
                <label style={styles.label}>Unhedged Qty</label>
                <div style={styles.radioGroup}>
                  <label><input type="radio" checked={unhedgedQtyMode === 'RATIO'} onChange={() => setUnhedgedQtyMode('RATIO')} /> Ratio</label>
                  <label><input type="radio" checked={unhedgedQtyMode === 'NONE'} onChange={() => setUnhedgedQtyMode('NONE')} /> None</label>
                </div>
              </div>
              <div>
                <label style={styles.label}>If a leg doesn't fill</label>
                <div style={styles.radioGroup}>
                  <label><input type="radio" checked={priceExecution === 'LEAVE_AS_IS'} onChange={() => setPriceExecution('LEAVE_AS_IS')} /> Leave As Is</label>
                  <label><input type="radio" checked={priceExecution === 'REVERT_ALL_LEGS'} onChange={() => setPriceExecution('REVERT_ALL_LEGS')} /> Revert All Legs</label>
                </div>
              </div>
              <div>
                <label style={styles.label}>Bid</label>
                <div style={styles.radioGroup}>
                  <label><input type="radio" checked={bidMode === 'NORMAL'} onChange={() => setBidMode('NORMAL')} /> Normal</label>
                  <label><input type="radio" checked={bidMode === 'BEST'} onChange={() => setBidMode('BEST')} /> Best</label>
                </div>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: gridColors.primary, marginTop: '10px' }}>
              <input type="checkbox" checked={allowDuplicates} onChange={(e) => setAllowDuplicates(e.target.checked)} /> Allow Duplicates
            </label>
          </div>

          <div style={styles.section}>
            <label style={styles.label}>Payoff at expiry</label>
            {payoff.length === 0 ? (
              <p style={{ fontSize: '12px', color: gridColors.muted }}>Select a symbol, lots, and price on each leg above to preview the payoff.</p>
            ) : (
              <PayoffChart points={payoff} maxPnl={maxPnl} />
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button style={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>{submitting ? 'Adding...' : 'ADD'}</button>
        </div>
      </div>
    </div>
  );
}

// A hand-drawn inline payoff line - pure SVG, no charting library, matching this app's
// existing pattern of drawing its own small diagrams rather than pulling in a dependency.
function PayoffChart({ points, maxPnl }) {
  const width = 800;
  const height = 220;
  const padTop = 16;
  const padBottom = 34;
  const plotHeight = height - padTop - padBottom;
  const midY = padTop + plotHeight / 2;
  const stepX = width / (points.length - 1);
  const scaleY = (pnl) => midY - (pnl / maxPnl) * (plotHeight / 2);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${scaleY(p.pnl)}`).join(' ');
  const zeroCrossing = points.find((p) => p.pnl >= 0);

  // A single shared linear scale, calibrated to the single most extreme point, is honest but
  // can make a gently-sloped region look flat next to a steep one (e.g. an unbalanced-lot
  // ratio spread) even though the underlying numbers really are varying. Gridlines with real
  // Rs values, plus a hoverable marker + native tooltip on every point, let a reader confirm
  // the actual number at any point instead of having to trust the visual slope alone.
  const gridFractions = [1, 0.5, 0, -0.5, -1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', border: '1px solid #edf2f7', borderRadius: '4px', background: '#fbfcfe' }}>
      {gridFractions.map((f) => (
        <g key={f}>
          <line x1="60" y1={scaleY(f * maxPnl)} x2={width} y2={scaleY(f * maxPnl)} stroke={f === 0 ? '#d9e2ec' : '#f1f5f9'} strokeWidth="1" />
          <text x="54" y={scaleY(f * maxPnl) + 3} fontSize="9" fill={gridColors.muted} textAnchor="end">
            {(f * maxPnl).toFixed(0)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke={gridColors.accent} strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={i * stepX} cy={scaleY(p.pnl)} r="3" fill={gridColors.accent}>
          <title>Underlying {p.underlyingPrice}: P&L {p.pnl.toFixed(2)}</title>
        </circle>
      ))}
      <text x="60" y="12" fontSize="10" fill={gridColors.muted}>P&L (Rs)</text>
      <text x={width - 6} y={height - 6} fontSize="10" fill={gridColors.muted} textAnchor="end">
        Underlying: {points[0].underlyingPrice} - {points[points.length - 1].underlyingPrice}
      </text>
      {zeroCrossing && (
        <text x="60" y={height - 6} fontSize="10" fill={gridColors.muted}>Breakeven near {zeroCrossing.underlyingPrice}</text>
      )}
    </svg>
  );
}

// Aggregate BUY-side vs SELL-side totals across the legs entered so far - pure arithmetic,
// no market data needed. Weighted avg price is quantity-weighted, same convention used
// elsewhere in this app (position.routes.js) rather than a plain average across legs.
function LegSummaryTable({ legs }) {
  const summarize = (side) => {
    const sideLegs = legs.filter((l) => l.side === side && Number(l.lots) > 0 && Number(l.price) > 0);
    const totalLots = sideLegs.reduce((sum, l) => sum + Number(l.lots), 0);
    const weightedPrice = totalLots > 0
      ? sideLegs.reduce((sum, l) => sum + Number(l.lots) * Number(l.price), 0) / totalLots
      : 0;
    return { totalLots, weightedPrice };
  };
  const long = summarize('BUY');
  const short = summarize('SELL');

  return (
    <table style={styles.summaryTable}>
      <thead>
        <tr>
          <th style={styles.summaryTh}></th>
          <th style={styles.summaryTh}>Qty (Lots)</th>
          <th style={styles.summaryTh}>Avg Price (Rs)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ ...styles.summaryTd, color: gridColors.buy, fontWeight: '700' }}>Long [Buy]</td>
          <td style={styles.summaryTd}>{long.totalLots}</td>
          <td style={styles.summaryTd}>{long.weightedPrice.toFixed(2)}</td>
        </tr>
        <tr>
          <td style={{ ...styles.summaryTd, borderBottom: 'none', color: gridColors.sell, fontWeight: '700' }}>Short [Sell]</td>
          <td style={{ ...styles.summaryTd, borderBottom: 'none' }}>{short.totalLots}</td>
          <td style={{ ...styles.summaryTd, borderBottom: 'none' }}>{short.weightedPrice.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}

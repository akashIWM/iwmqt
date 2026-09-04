import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api';
import { gridColors } from '../styles/gridTheme';

// Multi-leg options/futures strategy builder, modeled directly on a real desk's existing
// "Ratio 2 Leg" order ticket: every leg picks its own Instrument Type + Symbol + Strike +
// Opt (no shared top-of-form Instrument/Expiry, no fixed "Long Leg1/Put Leg2" roles - legs
// are generic and numbered, exactly like the reference ticket). Instrument Type only offers
// OPTIDX/FUTSTK because that's genuinely all this app's mock market data supports (index
// option chains for NIFTY/BANKNIFTY, single-expiry futures for RELIANCE/HDFCBANK) - a real
// broker OMS would also offer OPTSTK/FUTIDX.
//
// Each leg is still one real LIMIT order under the hood (server/src/services/algoStrategy
// .service.js places it through the exact same RMS-checked path as a manual order).
const EXECUTION_MODES = [{ value: 'AGGRESSIVE_SWEEP', label: '1 - Aggressive (sweep)' }];

// Templates only prefill each leg's Side + Opt (nothing about Instrument/Strike, since that's
// always the trader's own pick) - a starting point, not a locked-in role.
const TEMPLATES = {
  RATIO_2_LEG: { label: 'Ratio 2 Leg', legDefs: [{ side: 'BUY', opt: 'CE' }, { side: 'SELL', opt: 'CE' }] },
  // Straddle vs Strangle only differ in which strikes the trader picks (same strike for a
  // straddle, a lower/higher pair for a strangle) - this builder can't dictate that choice up
  // front, so the two templates are legitimately identical in their starting leg defaults;
  // `hint` is the only thing distinguishing them in the picker.
  STRADDLE: { label: 'Straddle', hint: 'pick the same strike on both legs', legDefs: [{ side: 'BUY', opt: 'CE' }, { side: 'BUY', opt: 'PE' }] },
  STRANGLE: { label: 'Strangle', hint: 'pick different OTM strikes', legDefs: [{ side: 'BUY', opt: 'CE' }, { side: 'BUY', opt: 'PE' }] },
  CUSTOM: { label: 'Custom', legDefs: [{ side: 'BUY', opt: 'CE' }, { side: 'SELL', opt: 'CE' }] }
};

const blankLeg = (def) => ({
  instrumentType: 'OPTIDX', underlying: '', strike: '', opt: def.opt, side: def.side,
  lots: 1, useLiveBid: false, stm: 0, price: '', symbol: ''
});

const buildLegsFromTemplate = (key) => TEMPLATES[key].legDefs.map(blankLeg);

const emptyQtyPriceRow = () => ({ soq: 0, qty: 0, price: 0 });

const styles = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(16,42,67,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '40px 20px' },
  modal: { backgroundColor: '#ffffff', borderRadius: '8px', width: '100%', maxWidth: '1120px', border: '1px solid #d9e2ec', boxShadow: '0 12px 32px rgba(16,42,67,0.25)', fontFamily: '"Inter", sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #d9e2ec', gap: '16px' },
  title: { fontWeight: '700', fontSize: '15px', color: gridColors.primary },
  headerRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  headerCheck: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: gridColors.muted, textTransform: 'uppercase' },
  closeBtn: { background: 'none', border: 'none', fontSize: '18px', color: gridColors.muted, cursor: 'pointer' },
  body: { padding: '20px', maxHeight: '74vh', overflowY: 'auto' },
  nameRow: { display: 'grid', gridTemplateColumns: '1fr 200px', gap: '12px', marginBottom: '14px' },
  legTableWrap: { overflowX: 'auto' },
  legRow: { display: 'grid', gridTemplateColumns: '24px 90px 104px 92px 92px 58px 64px 56px 74px 40px 64px 58px 28px', gap: '5px', alignItems: 'center', marginBottom: '7px', minWidth: '890px' },
  legHeader: { display: 'grid', gridTemplateColumns: '24px 90px 104px 92px 92px 58px 64px 56px 74px 40px 64px 58px 28px', gap: '5px', fontSize: '9px', color: gridColors.muted, fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', minWidth: '890px' },
  summaryTable: { width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' },
  summaryTh: { textAlign: 'left', padding: '5px 8px', color: gridColors.muted, borderBottom: '1px solid #edf2f7', fontSize: '9.5px', textTransform: 'uppercase' },
  summaryTd: { padding: '4px 8px', borderBottom: '1px solid #edf2f7' },
  input: { padding: '6px 7px', borderRadius: '4px', border: '1px solid #d9e2ec', fontSize: '11.5px', backgroundColor: '#f8f9fa', color: gridColors.primary, width: '100%', boxSizing: 'border-box' },
  select: { padding: '6px 7px', borderRadius: '4px', border: '1px solid #d9e2ec', fontSize: '11.5px', backgroundColor: '#f8f9fa', color: gridColors.primary, width: '100%' },
  sideSelect: (side) => ({
    padding: '6px 4px', borderRadius: '4px', fontSize: '11.5px', backgroundColor: '#f8f9fa', width: '100%', fontWeight: '700',
    border: `1.5px solid ${side === 'BUY' ? gridColors.buy : gridColors.sell}`,
    color: side === 'BUY' ? gridColors.buy : gridColors.sell
  }),
  label: { display: 'block', fontSize: '10px', fontWeight: '700', color: gridColors.muted, marginBottom: '4px', textTransform: 'uppercase' },
  section: { marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #edf2f7' },
  paramGrid6: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' },
  paramGrid5: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginTop: '10px' },
  radioGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginTop: '14px' },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: gridColors.primary },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #d9e2ec' },
  footerHint: { fontSize: '10.5px', color: gridColors.muted },
  footerBtns: { display: 'flex', gap: '10px' },
  btnGhost: { padding: '9px 16px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#fff', color: gridColors.muted, fontWeight: '700', fontSize: '12px', cursor: 'pointer' },
  btnPrimary: { padding: '9px 16px', borderRadius: '4px', border: 'none', backgroundColor: gridColors.accent, color: '#fff', fontWeight: '700', fontSize: '12px', cursor: 'pointer' },
  removeLegBtn: { background: 'none', border: 'none', color: gridColors.sell, cursor: 'pointer', fontSize: '13px', fontWeight: '700' },
  addLegBtn: { fontSize: '11px', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${gridColors.accent}`, backgroundColor: '#fff', color: gridColors.accent, fontWeight: '700', cursor: 'pointer', marginBottom: '10px' },
  error: { color: gridColors.sell, fontSize: '12px', marginBottom: '10px' },
  hint: { fontSize: '10.5px', color: gridColors.muted, marginTop: '6px', marginBottom: '4px' },
  staticCell: { fontSize: '11px', color: gridColors.muted, textAlign: 'center' }
};

export default function AlgoStrategyBuilder({ onClose, onCreated }) {
  const [underlyings, setUnderlyings] = useState([]);
  const [futures, setFutures] = useState([]);
  const [chains, setChains] = useState({});
  const [isBidding, setIsBidding] = useState(true);
  const [allowDelivery, setAllowDelivery] = useState(false);
  const [template, setTemplate] = useState('RATIO_2_LEG');
  const [name, setName] = useState('Ratio 2 Leg Strategy');
  const [legs, setLegs] = useState(buildLegsFromTemplate('RATIO_2_LEG'));
  const [unhedgedQtyMode, setUnhedgedQtyMode] = useState('RATIO');
  const [priceExecution, setPriceExecution] = useState('REVERT_ALL_LEGS');
  const [orderTypePreference, setOrderTypePreference] = useState('LIMIT');
  const [bidMode, setBidMode] = useState('NORMAL');
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [timeMs, setTimeMs] = useState(500);
  const [executionMode, setExecutionMode] = useState('AGGRESSIVE_SWEEP');
  const [priceDepth, setPriceDepth] = useState(1);
  const [tradeGear, setTradeGear] = useState(0);
  const [orderDepth, setOrderDepth] = useState(2);
  const [allowedBidDepth, setAllowedBidDepth] = useState(0);
  const [allowedSlippage, setAllowedSlippage] = useState(100);
  const [marketRetries, setMarketRetries] = useState(5);
  const [tickSize, setTickSize] = useState(0.05);
  const [threshold, setThreshold] = useState(100);
  const [shortFlag, setShortFlag] = useState(0);
  // Long/Short only store what the trader can't get from the legs themselves (SOQ, plus an
  // optional qty/price override) - their qty/price default is *derived* from the legs each
  // render (see legSummary below), not synced into state, so overriding one never fights a
  // re-render. PN(Add)/PN(Mult) are pure manual fields with no derived default at all.
  const [qtyPriceBlock, setQtyPriceBlock] = useState({
    long: { soq: 0, qtyOverride: null, priceOverride: null },
    short: { soq: 0, qtyOverride: null, priceOverride: null },
    pnAdd: { ...emptyQtyPriceRow(), on: false },
    pnMult: { ...emptyQtyPriceRow(), qty: 1, on: false }
  });
  const [payoff, setPayoff] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const payoffDebounce = useRef();

  useEffect(() => {
    apiFetch('/strategies/underlyings').then((r) => r.json()).then((data) => setUnderlyings(data.underlyings || []))
      .catch(() => setError('Could not load instrument list - check your connection and reopen this builder'));
    apiFetch('/strategies/futures').then((r) => r.json()).then((data) => setFutures(data.futures || []))
      .catch(() => setError('Could not load futures list - check your connection and reopen this builder'));
  }, []);

  const ensureChain = useCallback((instrument) => {
    if (!instrument || chains[instrument]) return;
    apiFetch(`/strategies/option-chain?instrument=${encodeURIComponent(instrument)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`No option chain for ${instrument}`))))
      .then((data) => setChains((prev) => ({ ...prev, [instrument]: data })))
      .catch(() => setError(`Could not load strikes for ${instrument} - try a different instrument`));
  }, [chains]);

  // Resolves whatever a leg currently has selected into a real {symbol, token, ltp} - the
  // one place both the leg row's Token column and the live-bid price auto-fill read from.
  const resolveLeg = useCallback((leg) => {
    if (leg.instrumentType === 'FUTSTK') {
      const fut = futures.find((f) => f.instrument === leg.underlying);
      return fut ? { symbol: fut.symbol, token: fut.token, ltp: fut.ltp, expiry: fut.expiry } : null;
    }
    const chain = chains[leg.underlying];
    const row = chain?.strikes.find((s) => String(s.strike) === String(leg.strike));
    if (!row) return null;
    const entry = leg.opt === 'PE' ? row.pe : row.ce;
    return entry ? { symbol: entry.symbol, token: entry.token, ltp: entry.ltp, expiry: chain.expiry } : null;
  }, [chains, futures]);

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

  // Long/Short totals, recomputed fresh every render straight from the legs - not stored
  // state, so there's nothing to keep in sync. qtyPriceBlock's *Override fields (below) win
  // over these whenever the trader has actually typed something in.
  const summarizeSide = (side) => {
    const sideLegs = legs.filter((l) => l.side === side && Number(l.lots) > 0 && Number(l.price) > 0);
    const totalLots = sideLegs.reduce((sum, l) => sum + Number(l.lots), 0);
    const weightedPrice = totalLots > 0
      ? sideLegs.reduce((sum, l) => sum + Number(l.lots) * Number(l.price), 0) / totalLots
      : 0;
    return { qty: totalLots, price: Number(weightedPrice.toFixed(2)) };
  };
  const legSummary = { long: summarizeSide('BUY'), short: summarizeSide('SELL') };

  const updateLeg = (index, field, value) => {
    setLegs((prev) => prev.map((leg, i) => {
      if (i !== index) return leg;
      let next = { ...leg, [field]: value };
      if (field === 'instrumentType') {
        next = { ...next, underlying: '', strike: '', symbol: '', price: '' };
      } else if (field === 'underlying') {
        next = { ...next, strike: '', symbol: '', price: '' };
        if (value && next.instrumentType === 'OPTIDX') ensureChain(value);
      }
      if (['underlying', 'strike', 'opt', 'instrumentType'].includes(field)) {
        const resolved = resolveLeg(next);
        next.symbol = resolved?.symbol || '';
        if (next.useLiveBid && isBidding && resolved) next.price = resolved.ltp;
      }
      if (field === 'useLiveBid' && value && isBidding) {
        const resolved = resolveLeg(next);
        if (resolved) next.price = resolved.ltp;
      }
      return next;
    }));
  };

  const applyTemplate = (templateKey) => {
    setTemplate(templateKey);
    setLegs(buildLegsFromTemplate(templateKey));
  };

  const addLeg = () => setLegs((prev) => [...prev, blankLeg({ side: 'BUY', opt: 'CE' })]);
  const removeLeg = (index) => setLegs((prev) => prev.filter((_, i) => i !== index));

  const buildPayload = () => ({
    name, legs, unhedgedQtyMode, priceExecution, bidMode, allowDuplicates, timeMs,
    executionMode, priceDepth, orderDepth, allowedBidDepth, allowedSlippage, marketRetries, tickSize, threshold,
    template, isBidding, allowDelivery, orderTypePreference, tradeGear, shortFlag, qtyPriceOverrides: qtyPriceBlock
  });

  const handleSaveJson = () => {
    const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name.trim().replace(/\s+/g, '_') || 'strategy'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = useCallback(async () => {
    setError('');
    setSubmitting(true);
    try {
      const response = await apiFetch('/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, legs, unhedgedQtyMode, priceExecution, bidMode, allowDuplicates, timeMs, executionMode, priceDepth,
    orderDepth, allowedBidDepth, allowedSlippage, marketRetries, tickSize, threshold, template, isBidding,
    allowDelivery, orderTypePreference, tradeGear, shortFlag, qtyPriceBlock]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  const maxPnl = payoff.length ? Math.max(...payoff.map((p) => Math.abs(p.pnl)), 1) : 1;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown} tabIndex={-1}>
        <div style={styles.header}>
          <span style={styles.title}>{TEMPLATES[template].label}</span>
          <div style={styles.headerRight}>
            <label style={styles.headerCheck}><input type="checkbox" checked={isBidding} onChange={(e) => setIsBidding(e.target.checked)} /> Is Bidding</label>
            <label style={styles.headerCheck}><input type="checkbox" checked={allowDelivery} onChange={(e) => setAllowDelivery(e.target.checked)} /> Allow Delivery</label>
            <button style={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.legTableWrap}>
            <div style={styles.legHeader}>
              <span>#</span><span>Instrument</span><span>Symbol</span><span>Expiry</span><span>Strike</span><span>Opt</span>
              <span>B/S</span><span>Lots</span><span>Price (Rs)</span><span>Bid</span><span>#STM</span><span>Token</span><span></span>
            </div>
            {legs.map((leg, i) => {
              const isFut = leg.instrumentType === 'FUTSTK';
              const chain = chains[leg.underlying];
              const resolved = resolveLeg(leg);
              const expiry = isFut ? futures.find((f) => f.instrument === leg.underlying)?.expiry : chain?.expiry;
              return (
                <div style={styles.legRow} key={i}>
                  <span style={{ fontSize: '11px', color: gridColors.muted }}>{i + 1}</span>
                  <select style={styles.select} value={leg.instrumentType} onChange={(e) => updateLeg(i, 'instrumentType', e.target.value)}>
                    <option value="OPTIDX">OPTIDX</option>
                    <option value="FUTSTK">FUTSTK</option>
                  </select>
                  <select style={styles.select} value={leg.underlying} onChange={(e) => updateLeg(i, 'underlying', e.target.value)}>
                    <option value="">Symbol</option>
                    {isFut
                      ? futures.map((f) => <option key={f.instrument} value={f.instrument}>{f.instrument}</option>)
                      : underlyings.map((u) => <option key={u.instrument} value={u.instrument}>{u.instrument}</option>)}
                  </select>
                  <span style={styles.staticCell}>{expiry || '—'}</span>
                  {isFut ? <span style={styles.staticCell}>—</span> : (
                    <select style={styles.select} value={leg.strike} onChange={(e) => updateLeg(i, 'strike', e.target.value)} disabled={!chain}>
                      <option value="">Strike</option>
                      {chain?.strikes.map((s) => <option key={s.strike} value={s.strike}>{s.strike}</option>)}
                    </select>
                  )}
                  {isFut ? <span style={styles.staticCell}>—</span> : (
                    <select style={styles.select} value={leg.opt} onChange={(e) => updateLeg(i, 'opt', e.target.value)}>
                      <option value="CE">CE</option>
                      <option value="PE">PE</option>
                    </select>
                  )}
                  <select style={styles.sideSelect(leg.side)} value={leg.side} onChange={(e) => updateLeg(i, 'side', e.target.value)}>
                    <option value="BUY">Buy</option>
                    <option value="SELL">Sell</option>
                  </select>
                  <input style={styles.input} type="number" min="1" value={leg.lots} onChange={(e) => updateLeg(i, 'lots', e.target.value)} />
                  <input
                    style={styles.input} type="number" step="0.05" value={leg.price} onChange={(e) => updateLeg(i, 'price', e.target.value)}
                    title="Type a limit price directly, or check Bid to auto-fill it from the current mock LTP"
                  />
                  <input
                    type="checkbox" checked={leg.useLiveBid} disabled={!isBidding}
                    onChange={(e) => updateLeg(i, 'useLiveBid', e.target.checked)}
                    title="Auto-fill this leg's price from the current mock LTP"
                  />
                  <input style={styles.input} type="number" value={leg.stm} onChange={(e) => updateLeg(i, 'stm', e.target.value)} title="#STM - manually entered, not used in any calculation" />
                  <span style={{ fontSize: '10.5px', color: gridColors.muted, textAlign: 'center' }}>{resolved?.token || '—'}</span>
                  {legs.length > 2 && <button style={styles.removeLegBtn} onClick={() => removeLeg(i)}>✕</button>}
                </div>
              );
            })}
          </div>
          <button style={styles.addLegBtn} onClick={addLeg}>+ Add Leg</button>

          <div style={styles.nameRow}>
            <div>
              <label style={styles.label}>Algorithm Name</label>
              <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label style={styles.label}>Strategy Template</label>
              <select style={styles.select} value={template} onChange={(e) => applyTemplate(e.target.value)}>
                {Object.entries(TEMPLATES).map(([key, t]) => <option key={key} value={key}>{t.label}{t.hint ? ` - ${t.hint}` : ''}</option>)}
              </select>
            </div>
          </div>

          <p style={styles.hint}>Price fills in per-leg only when Is Bidding and that leg's Bid box are both checked - otherwise type it in yourself.</p>

          <div style={styles.section}>
            <QtyPriceBlock block={qtyPriceBlock} setBlock={setQtyPriceBlock} legSummary={legSummary} />
          </div>

          <div style={styles.section}>
            <div style={styles.paramGrid6}>
              <div>
                <label style={styles.label}>Execution Mode</label>
                <select style={styles.select} value={executionMode} onChange={(e) => setExecutionMode(e.target.value)}>
                  {EXECUTION_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div><label style={styles.label}>Price Depth</label><input style={styles.input} type="number" value={priceDepth} onChange={(e) => setPriceDepth(e.target.value)} /></div>
              <div><label style={styles.label} title="Execution aggressiveness tier - stored, not yet enforced">Trade Gear</label><input style={styles.input} type="number" value={tradeGear} onChange={(e) => setTradeGear(e.target.value)} /></div>
              <div><label style={styles.label}>Allowed Slippage</label><input style={styles.input} type="number" value={allowedSlippage} onChange={(e) => setAllowedSlippage(e.target.value)} /></div>
              <div><label style={styles.label}>Market Retries</label><input style={styles.input} type="number" value={marketRetries} onChange={(e) => setMarketRetries(e.target.value)} /></div>
              <div><label style={styles.label}>Tick Size</label><input style={styles.input} type="number" step="0.01" value={tickSize} onChange={(e) => setTickSize(e.target.value)} /></div>
            </div>

            <div style={styles.paramGrid5}>
              <div><label style={styles.label}>Order Depth</label><input style={styles.input} type="number" value={orderDepth} onChange={(e) => setOrderDepth(e.target.value)} /></div>
              <div><label style={styles.label}>Allowed Bid Depth</label><input style={styles.input} type="number" value={allowedBidDepth} onChange={(e) => setAllowedBidDepth(e.target.value)} /></div>
              <div><label style={styles.label}>Threshold Qty</label><input style={styles.input} type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
              <div><label style={styles.label} title="Marks this as a short-only strategy - stored, not yet enforced">Short Flag</label><input style={styles.input} type="number" value={shortFlag} onChange={(e) => setShortFlag(e.target.value)} /></div>
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
                <label style={styles.label}>Price Execution</label>
                <div style={styles.radioGroup}>
                  <label><input type="radio" checked={priceExecution === 'LEAVE_AS_IS'} onChange={() => setPriceExecution('LEAVE_AS_IS')} /> Leave As Is</label>
                  <label><input type="radio" checked={priceExecution === 'REVERT_ALL_LEGS'} onChange={() => setPriceExecution('REVERT_ALL_LEGS')} /> Revert All Legs</label>
                </div>
              </div>
              <div>
                <label style={styles.label} title="Only LIMIT is actually routed - this platform's RMS accepts LIMIT orders only">Order Type</label>
                <div style={styles.radioGroup}>
                  <label><input type="radio" checked={orderTypePreference === 'LIMIT'} onChange={() => setOrderTypePreference('LIMIT')} /> Limit</label>
                  <label><input type="radio" checked={orderTypePreference === 'MARKET'} onChange={() => setOrderTypePreference('MARKET')} /> Market</label>
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
            {orderTypePreference === 'MARKET' && (
              <p style={styles.hint}>Order Type is recorded for reference only - every leg is placed as LIMIT when started (this platform's RMS accepts LIMIT orders only).</p>
            )}
          </div>

          <div style={styles.section}>
            <label style={styles.label}>Payoff at expiry</label>
            {payoff.length === 0 ? (
              <p style={{ fontSize: '12px', color: gridColors.muted }}>Select instrument, strike, option type &amp; side on the legs above to preview the payoff.</p>
            ) : (
              <PayoffChart points={payoff} maxPnl={maxPnl} />
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <span style={styles.footerHint}>Esc cancel &middot; Ctrl+Enter add</span>
          <div style={styles.footerBtns}>
            <button style={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button style={styles.btnGhost} onClick={handleSaveJson}>Deploy JSON</button>
            <button style={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>{submitting ? 'Adding...' : 'ADD'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// The reference ticket's Long[Buy]/Short[Sell]/PN(Add)/PN(Mult) block - a manual
// summary/override panel, not something that drives or is driven by the legs. Long/Short
// show the live leg totals (legSummary) until the trader types over them, at which point
// their typed *Override value wins; PN(Add)/PN(Mult) have no derived default at all.
function QtyPriceBlock({ block, setBlock, legSummary }) {
  const updateRow = (rowKey, field, value) => {
    setBlock((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], [field]: value } }));
  };

  const derivedRow = (rowKey, label, color, computed) => (
    <tr>
      <td style={{ ...styles.summaryTd, color, fontWeight: '700' }}>{label}</td>
      <td style={styles.summaryTd}><input style={styles.input} type="number" value={block[rowKey].soq} onChange={(e) => updateRow(rowKey, 'soq', e.target.value)} /></td>
      <td style={styles.summaryTd}>
        <input style={styles.input} type="number" value={block[rowKey].qtyOverride ?? computed.qty} onChange={(e) => updateRow(rowKey, 'qtyOverride', e.target.value)} />
      </td>
      <td style={styles.summaryTd}>
        <input style={styles.input} type="number" value={block[rowKey].priceOverride ?? computed.price} onChange={(e) => updateRow(rowKey, 'priceOverride', e.target.value)} />
      </td>
      <td style={styles.summaryTd}></td>
    </tr>
  );

  const manualRow = (rowKey, label) => (
    <tr>
      <td style={{ ...styles.summaryTd, color: gridColors.primary, fontWeight: '700' }}>{label}</td>
      <td style={styles.summaryTd}><input style={styles.input} type="number" value={block[rowKey].soq} onChange={(e) => updateRow(rowKey, 'soq', e.target.value)} /></td>
      <td style={styles.summaryTd}><input style={styles.input} type="number" value={block[rowKey].qty} onChange={(e) => updateRow(rowKey, 'qty', e.target.value)} /></td>
      <td style={styles.summaryTd}><input style={styles.input} type="number" value={block[rowKey].price} onChange={(e) => updateRow(rowKey, 'price', e.target.value)} /></td>
      <td style={styles.summaryTd}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: gridColors.muted }}>
          <input type="checkbox" checked={block[rowKey].on} onChange={(e) => updateRow(rowKey, 'on', e.target.checked)} /> on
        </label>
      </td>
    </tr>
  );

  return (
    <table style={styles.summaryTable}>
      <thead>
        <tr>
          <th style={styles.summaryTh}></th>
          <th style={styles.summaryTh}>SOQ</th>
          <th style={styles.summaryTh}>Qty (Lots)</th>
          <th style={styles.summaryTh}>Price (Rs)</th>
          <th style={styles.summaryTh}></th>
        </tr>
      </thead>
      <tbody>
        {derivedRow('long', 'Long [Buy]', gridColors.buy, legSummary.long)}
        {derivedRow('short', 'Short [Sell]', gridColors.sell, legSummary.short)}
        {manualRow('pnAdd', 'PN (Add)')}
        {manualRow('pnMult', 'PN (Mult)')}
      </tbody>
    </table>
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

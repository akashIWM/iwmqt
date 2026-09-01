import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

// Must match server/src/utils/validators.js exactly - this is a client-side mirror of the
// same rule, not a separate source of truth. A direct API call still gets the server-side
// check regardless of what happens here.
const TICK_SIZE = 0.05;
const isOnTick = (price) => {
  const ticks = price / TICK_SIZE;
  return Math.abs(ticks - Math.round(ticks)) < 1e-6;
};
const nearestTicks = (price) => {
  const below = Math.floor(price / TICK_SIZE) * TICK_SIZE;
  const above = Math.ceil(price / TICK_SIZE) * TICK_SIZE;
  return [below, above === below ? above + TICK_SIZE : above].map((v) => Number(v.toFixed(2)));
};

// Only LIMIT orders are supported per spec - no Market/IOC/Manual types on the ticket at all.
export default function TradeWindow() {
  const [order, setOrder] = useState({
    symbol: 'NIFTY 24500 CE', // Default for now
    side: 'BUY',
    type: 'LIMIT',
    quantity: 50, // Standard Nifty lot size
    price: 0
  });
  // Per-field inline errors, cleared as soon as the field becomes valid again. priceSuggestion
  // holds the two nearest valid tick values so the UI can offer them as one-click fixes,
  // rather than just naming the rule and leaving the trader to do the arithmetic.
  const [fieldErrors, setFieldErrors] = useState({});
  const [priceSuggestion, setPriceSuggestion] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setOrder(prev => ({ ...prev, [name]: value }));
  };

  // Validates a single field the moment it changes - this is what the spec means by
  // "corrected inline," as opposed to only finding out something was wrong after the round
  // trip to the server (or worse, from the browser's own native step-mismatch tooltip, which
  // is what used to surface this exact tick-size case before this was built).
  const validateField = (name, rawValue) => {
    if (name === 'quantity') {
      const qty = Number(rawValue);
      if (!Number.isFinite(qty) || qty <= 0) {
        setFieldErrors((prev) => ({ ...prev, quantity: 'Quantity must be greater than zero' }));
      } else {
        setFieldErrors((prev) => ({ ...prev, quantity: null }));
      }
    }

    if (name === 'price') {
      const price = Number(rawValue);
      if (!Number.isFinite(price) || price <= 0) {
        setFieldErrors((prev) => ({ ...prev, price: 'Price must be greater than zero' }));
        setPriceSuggestion(null);
      } else if (!isOnTick(price)) {
        const [below, above] = nearestTicks(price);
        setFieldErrors((prev) => ({ ...prev, price: `Price must be in multiples of ₹${TICK_SIZE.toFixed(2)}` }));
        setPriceSuggestion({ below, above });
      } else {
        setFieldErrors((prev) => ({ ...prev, price: null }));
        setPriceSuggestion(null);
      }
    }
  };

  const handleFieldChange = (e) => {
    handleChange(e);
    validateField(e.target.name, e.target.value);
  };

  const applySuggestedPrice = (value) => {
    setOrder((prev) => ({ ...prev, price: value }));
    setFieldErrors((prev) => ({ ...prev, price: null }));
    setPriceSuggestion(null);
  };

  // F1/F2 always toggle Buy/Sell; +/- do too, but only when not typing in a field
  // (both characters are valid input while entering quantity/price).
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);

      if (e.key === 'F1' || (!isTyping && e.key === '+')) {
        e.preventDefault();
        setOrder((p) => ({ ...p, side: 'BUY' }));
      } else if (e.key === 'F2' || (!isTyping && e.key === '-')) {
        e.preventDefault();
        setOrder((p) => ({ ...p, side: 'SELL' }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

const handleSubmit = async (e) => {
    e.preventDefault();

    // Re-validate both fields on submit too - not just relying on the last onChange, since
    // a value can arrive at submit time without ever firing a change event (e.g. a browser
    // autofill or a pasted value the user never edited afterward).
    validateField('quantity', order.quantity);
    validateField('price', order.price);
    const qty = Number(order.quantity);
    const price = Number(order.price);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0 || !isOnTick(price)) {
      return;
    }

    try {
      const response = await apiFetch('/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      
      const data = await response.json();
      if (response.ok) {
                alert(`Success: ${order.side} order placed for ${order.symbol} (ID: ${data.order.id})`);
       } else {
        // Change this line to show the error message from your backend
        alert(data.message || 'Order Failed: Check RMS Risk Settings');
      }
    } catch (error) {
      console.error('Failed to place order', error);
      alert('Network error communicating with OMS');
    }
  };

  const isBuy = order.side === 'BUY';

  const styles = {
    container: { padding: '10px', fontFamily: '"Inter", sans-serif' },
    toggleGroup: { display: 'flex', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #d9e2ec' },
    toggleBtn: (active, side) => ({
      flex: 1,
      padding: '10px',
      border: 'none',
      fontWeight: '700',
      cursor: 'pointer',
      backgroundColor: active 
        ? (side === 'BUY' ? '#2b8a3e' : '#c92a2a') 
        : '#f8f9fa',
      color: active ? '#ffffff' : '#627d98', // Fixed to white text when active
      transition: 'all 0.2s'
    }),
    formGroup: { marginBottom: '16px' },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', color: '#627d98', marginBottom: '6px' },
    
    // THE FIX IS HERE: Added backgroundColor and color to both input and select
    input: { 
      width: '100%', 
      padding: '10px', 
      borderRadius: '4px', 
      border: '1px solid #d9e2ec', 
      fontSize: '14px', 
      boxSizing: 'border-box',
      backgroundColor: '#f8f9fa',
      color: '#102a43' 
    },
    select: {
      width: '100%',
      padding: '10px',
      borderRadius: '4px',
      border: '1px solid #d9e2ec',
      fontSize: '14px',
      backgroundColor: '#f8f9fa',
      color: '#102a43'
    },
    inputError: { border: '1px solid #c92a2a' },
    errorText: { color: '#c92a2a', fontSize: '11px', marginTop: '4px' },
    suggestionRow: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: '#627d98' },
    suggestionBtn: {
      padding: '3px 8px', borderRadius: '4px', border: '1px solid #d9e2ec', backgroundColor: '#eaf2fa',
      color: '#245a9e', fontWeight: '700', fontSize: '11px', cursor: 'pointer'
    },

    submitBtn: {
      width: '100%',
      padding: '14px',
      marginTop: '10px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '15px',
      fontWeight: '700',
      color: '#fff',
      backgroundColor: isBuy ? '#2b8a3e' : '#c92a2a',
      cursor: 'pointer',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }
  };

  return (
    <div style={styles.container}>
      {/* BUY / SELL Toggle */}
      <div style={styles.toggleGroup}>
        <button 
          style={styles.toggleBtn(isBuy, 'BUY')} 
          onClick={() => setOrder(p => ({ ...p, side: 'BUY' }))}
        >
          BUY
        </button>
        <button 
          style={styles.toggleBtn(!isBuy, 'SELL')} 
          onClick={() => setOrder(p => ({ ...p, side: 'SELL' }))}
        >
          SELL
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div style={styles.formGroup}>
          <label style={styles.label}>INSTRUMENT</label>
          <input name="symbol" value={order.symbol} onChange={handleFieldChange} style={styles.input} />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>QUANTITY</label>
            <input
              type="number" name="quantity" value={order.quantity} onChange={handleFieldChange}
              style={{ ...styles.input, ...(fieldErrors.quantity ? styles.inputError : {}) }}
            />
            {fieldErrors.quantity && <div style={styles.errorText}>{fieldErrors.quantity}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>LIMIT PRICE</label>
            <input
              type="number" name="price" value={order.price} onChange={handleFieldChange}
              style={{ ...styles.input, ...(fieldErrors.price ? styles.inputError : {}) }}
            />
            {fieldErrors.price && <div style={styles.errorText}>{fieldErrors.price}</div>}
            {priceSuggestion && (
              <div style={styles.suggestionRow}>
                <span>Nearest valid:</span>
                <button type="button" style={styles.suggestionBtn} onClick={() => applySuggestedPrice(priceSuggestion.below)}>
                  ₹{priceSuggestion.below.toFixed(2)}
                </button>
                <button type="button" style={styles.suggestionBtn} onClick={() => applySuggestedPrice(priceSuggestion.above)}>
                  ₹{priceSuggestion.above.toFixed(2)}
                </button>
              </div>
            )}
          </div>
        </div>

        <button type="submit" style={styles.submitBtn}>
          {isBuy ? 'PLACE BUY ORDER' : 'PLACE SELL ORDER'}
        </button>
      </form>
    </div>
  );
}
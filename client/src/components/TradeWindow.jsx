import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

// Only LIMIT orders are supported per spec - no Market/IOC/Manual types on the ticket at all.
export default function TradeWindow() {
  const [order, setOrder] = useState({
    symbol: 'NIFTY 24500 CE', // Default for now
    side: 'BUY',
    type: 'LIMIT',
    quantity: 50, // Standard Nifty lot size
    price: 0
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setOrder(prev => ({ ...prev, [name]: value }));
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

      <form onSubmit={handleSubmit}>
        <div style={styles.formGroup}>
          <label style={styles.label}>INSTRUMENT</label>
          <input name="symbol" value={order.symbol} onChange={handleChange} style={styles.input} />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>QUANTITY</label>
            <input type="number" name="quantity" value={order.quantity} onChange={handleChange} style={styles.input} min="1" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>LIMIT PRICE</label>
            <input type="number" name="price" value={order.price} onChange={handleChange} style={styles.input} step="0.05" min="0" required />
          </div>
        </div>

        <button type="submit" style={styles.submitBtn}>
          {isBuy ? 'PLACE BUY ORDER' : 'PLACE SELL ORDER'}
        </button>
      </form>
    </div>
  );
}
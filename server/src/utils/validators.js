export const isValidEmail = (email) => (
	typeof email === 'string' && /^[^\s@]+@iwmquant\.com$/i.test(email)
);

export const normalizeEmail = (email) => email.trim().toLowerCase();

export const isNonEmptyString = (value, maxLength = 255) => (
	typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
);

// Minimum 8 characters; must include at least one alphabet, one numeral, and one special character/symbol.
export const validatePasswordComplexity = (password) => (
	/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/.test(password)
);

// NSE F&O minimum price movement - matches the client ticket's step="0.05" (TradeWindow.jsx),
// but enforced here too since that's only a browser-side nicety a direct API call can skip.
const TICK_SIZE = 0.05;
const isOnTick = (price) => {
	const ticks = price / TICK_SIZE;
	return Math.abs(ticks - Math.round(ticks)) < 1e-6;
};

// Only LIMIT orders are supported (no Market, IOC, or Manual order types) per spec.
export const validateOrder = ({ symbol, side, type, quantity, price }) => {
	const numericQuantity = Number(quantity);
	const numericPrice = price === undefined || price === null || price === '' ? null : Number(price);

	if (!isNonEmptyString(symbol, 50) || symbol.trim() !== symbol.trim().toUpperCase()) {
		return 'Symbol must be an uppercase instrument code';
	}
	if (!['BUY', 'SELL'].includes(side)) return 'Side must be BUY or SELL';
	if (type !== 'LIMIT') return 'Only LIMIT orders are supported';
	if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return 'Quantity must be greater than zero';
	if (!Number.isFinite(numericPrice) || numericPrice <= 0) return 'Limit orders require a positive price';
	if (!isOnTick(numericPrice)) return `Price must be in multiples of the ₹${TICK_SIZE.toFixed(2)} tick size`;
	return null;
};

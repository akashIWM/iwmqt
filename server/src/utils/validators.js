export const isValidEmail = (email) => (
	typeof email === 'string' && /^[^\s@]+@iwmquant\.com$/i.test(email)
);

export const normalizeEmail = (email) => email.trim().toLowerCase();

export const isNonEmptyString = (value, maxLength = 255) => (
	typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
);

export const validateOrder = ({ symbol, side, type, quantity, price }) => {
	const numericQuantity = Number(quantity);
	const numericPrice = price === undefined || price === null || price === '' ? null : Number(price);

	if (!isNonEmptyString(symbol, 50) || symbol.trim() !== symbol.trim().toUpperCase()) {
		return 'Symbol must be an uppercase instrument code';
	}
	if (!['BUY', 'SELL'].includes(side)) return 'Side must be BUY or SELL';
	if (!['MARKET', 'LIMIT'].includes(type)) return 'Type must be MARKET or LIMIT';
	if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return 'Quantity must be greater than zero';
	if (type === 'LIMIT' && (!Number.isFinite(numericPrice) || numericPrice <= 0)) {
		return 'Limit orders require a positive price';
	}
	if (type === 'MARKET' && numericPrice !== null) return 'Market orders cannot include a price';
	return null;
};

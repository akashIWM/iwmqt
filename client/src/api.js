export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || (
  API_BASE_URL.startsWith('http')
    ? API_BASE_URL.replace(/^http/, 'ws').replace(/\/api$/, '')
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
);

export const apiFetch = (path, options = {}) => fetch(`${API_BASE_URL}${path}`, {
  credentials: 'include',
  ...options,
});
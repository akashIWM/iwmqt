export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || (
  API_BASE_URL.replace(/^http/, 'ws').replace(/\/api$/, '')
);

export const apiFetch = (path, options = {}) => fetch(`${API_BASE_URL}${path}`, {
  credentials: 'include',
  ...options,
});
import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api';

axios.defaults.withCredentials = true;
axios.defaults.baseURL = API_BASE_URL;

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchMe() {
    try {
      const { data } = await axios.get('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(fetchMe, 0);
    return () => clearTimeout(timer);
  }, []);

  const login = async (credentials) => {
    const { data } = await axios.post('/auth/login', credentials);
    if (data.user) setUser(data.user);
    return data;
  };

  // Completes the forced password-change gate login() returns when mustChangePassword
  // is true (first login on a temp password, or an admin-initiated credential reset).
  const completeFirstLogin = async (payload) => {
    const { data } = await axios.post('/auth/complete-first-login', payload);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await axios.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, completeFirstLogin, logout, loading, refreshUser: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
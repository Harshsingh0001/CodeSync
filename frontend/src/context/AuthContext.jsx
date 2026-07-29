import { createContext, useContext, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('codesync_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    persistSession(data);
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    persistSession(data);
    return data;
  };

  const persistSession = (data) => {
    const { token, ...userData } = data;
    localStorage.setItem('codesync_token', token);
    localStorage.setItem('codesync_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('codesync_token');
    localStorage.removeItem('codesync_user');
    setUser(null);
  };

  const getToken = () => localStorage.getItem('codesync_token');

  return (
    <AuthContext.Provider value={{ user, login, register, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

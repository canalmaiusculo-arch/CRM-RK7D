import { useState, useCallback } from 'react';

export function useAuth() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('crm_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('crm_token'));

  const loginUser = useCallback((userData, authToken) => {
    localStorage.setItem('crm_token', authToken);
    localStorage.setItem('crm_user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setToken(null);
    setUser(null);
  }, []);

  const isVisitor = user?.role === 'visitor';
  const isLoggedIn = !!token && !!user;

  return { user, token, isLoggedIn, isVisitor, loginUser, logout };
}

import React, { createContext, useState, useContext, useEffect } from 'react';
import '../services/sessionGuard';   // signs the person out when the server says their login is no longer valid
import { readLogin, saveLogin, saveUser, clearLogin } from '../services/tabLogin';   // one login per browser tab

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { token: savedToken, user: savedUser } = readLogin();
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    saveLogin(jwtToken, userData);
  };

  // change a few fields of the signed-in user (name, profile picture) without logging in again
  const updateUser = (changes) => {
    setUser((prev) => {
      const next = { ...prev, ...changes };
      saveUser(next);
      return next;
    });
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    clearLogin();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
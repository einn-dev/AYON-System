import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('ayon_token');
    const savedUser  = localStorage.getItem('ayon_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('ayon_token', jwtToken);
    localStorage.setItem('ayon_user',  JSON.stringify(userData));
  };

  // change a few fields of the signed-in user (name, profile picture) without logging in again
  const updateUser = (changes) => {
    setUser((prev) => {
      const next = { ...prev, ...changes };
      localStorage.setItem('ayon_user', JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('ayon_token');
    localStorage.removeItem('ayon_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
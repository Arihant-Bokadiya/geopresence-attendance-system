import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types/index.js';
import { apiRequest } from '../utils/api.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updatedFields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
  });
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const savedToken = typeof window !== 'undefined'
      ? (sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token'))
      : null;

    if (!savedToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{ user: User }>('/auth/me');
      setUser(data.user);
      sessionStorage.setItem('auth_token', savedToken);
      sessionStorage.setItem('auth_user', JSON.stringify(data.user));
    } catch (err) {
      console.warn('Session expired or invalid token');
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
      localStorage.removeItem('auth_token');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = (newToken: string, newUser: User) => {
    // Store in tab-isolated sessionStorage so tabs don't overwrite each other
    sessionStorage.setItem('auth_token', newToken);
    sessionStorage.setItem('auth_user', JSON.stringify(newUser));
    // Clear legacy localStorage to avoid cross-tab leakage
    localStorage.removeItem('auth_token');
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedFields: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      sessionStorage.setItem('auth_user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

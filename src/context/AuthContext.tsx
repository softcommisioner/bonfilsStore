import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Business } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  business: Business | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userMode: 'shopping' | 'seller';
  setUserMode: (mode: 'shopping' | 'seller') => void;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: any) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => (
    api.getToken() ? api.getUserProfile() : null
  ));
  const [business, setBusiness] = useState<Business | null>(() => (
    api.getToken() ? api.getUserBusiness() : null
  ));
  const [isLoading, setIsLoading] = useState(true);
  const [userMode, setUserModeState] = useState<'shopping' | 'seller'>('shopping');

  const setUserMode = (mode: 'shopping' | 'seller') => {
    setUserModeState(mode);
    localStorage.setItem('bonfils_user_mode', mode);
  };

  const refreshUser = async () => {
    try {
      if (!api.getToken()) {
        api.clearToken();
        setUser(null);
        setBusiness(null);
        return;
      }
      const data = await api.getMe();
      setUser(data.user);
      setBusiness(data.business || null);
      
      const savedMode = localStorage.getItem('bonfils_user_mode') as 'shopping' | 'seller';
      if (savedMode) {
        setUserModeState(savedMode);
      }
    } catch (err: any) {
      // Never clear the stored session from a background verification. A
      // transient network error, a parallel token rotation, or a permission
      // failure must not drop an authenticated admin or seller on reload.
      // Tokens are only removed by an explicit sign-out.
      console.warn('[auth] background session refresh failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setUser(res.user);
    setBusiness(res.business || null);
    return res.user;
  };

  const register = async (payload: any) => {
    const res = await api.register(payload);
    setUser(res.user);
    setBusiness(res.business || null);
    return res.user;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setBusiness(null);
    setUserModeState('shopping');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        isAuthenticated: !!user,
        isLoading,
        userMode,
        setUserMode,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

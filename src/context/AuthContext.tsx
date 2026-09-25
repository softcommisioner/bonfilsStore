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
  login: (email: string, password: string) => Promise<{ requireOtp: boolean; email: string; maskedEmail: string }>;
  verifyLoginOtp: (email: string, code: string) => Promise<void>;
  register: (payload: any) => Promise<{ email: string; expiresInSeconds: number }>;
  verifyRegistrationOtp: (email: string, code: string) => Promise<void>;
  resendOtp: (email: string, purpose: 'registration' | 'login' | 'admin_login' | 'password_reset') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userMode, setUserModeState] = useState<'shopping' | 'seller'>('shopping');

  const setUserMode = (mode: 'shopping' | 'seller') => {
    setUserModeState(mode);
    localStorage.setItem('bonfils_user_mode', mode);
  };

  const refreshUser = async () => {
    try {
      if (!api.getToken()) {
        setUser(null);
        setBusiness(null);
        return;
      }
      const data = await api.getMe();
      setUser(data.user);
      if (data.business) setBusiness(data.business);
      
      const savedMode = localStorage.getItem('bonfils_user_mode') as 'shopping' | 'seller';
      if (savedMode && data.user.roles.includes('seller')) {
        setUserModeState(savedMode);
      }
    } catch (err) {
      api.clearToken();
      setUser(null);
      setBusiness(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    return { requireOtp: res.requireOtp, email: res.email, maskedEmail: res.maskedEmail };
  };

  const verifyLoginOtp = async (email: string, code: string) => {
    const res = await api.verifyLoginOtp(email, code);
    setUser(res.user);
    await refreshUser();
  };

  const register = async (payload: any) => {
    const res = await api.register(payload);
    return { email: res.email, expiresInSeconds: res.expiresInSeconds };
  };

  const verifyRegistrationOtp = async (email: string, code: string) => {
    const res = await api.verifyRegistrationOtp(email, code);
    setUser(res.user);
    await refreshUser();
  };

  const resendOtp = async (email: string, purpose: 'registration' | 'login' | 'admin_login' | 'password_reset') => {
    await api.resendOtp(email, purpose);
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
        verifyLoginOtp,
        register,
        verifyRegistrationOtp,
        resendOtp,
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

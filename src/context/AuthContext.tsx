import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, KYCStatus, BookingContextData } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeRole: 'CLIENT' | 'COMPANION' | null;
  isAuthenticated: boolean;
  showAuthModal: boolean;
  authModalTab: 'login' | 'signin';
  showKycWizard: boolean;
  showRoleSelection: boolean;
  openAuthModal: (tab?: 'login' | 'signin') => void;
  closeAuthModal: () => void;
  openKycWizard: () => void;
  closeKycWizard: () => void;
  requestOtp: (phone: string, purpose?: string) => Promise<{ success: boolean; message?: string; devCode?: string; error?: string }>;
  registerWithOtp: (phone: string, otp: string, password: string) => Promise<{ success: boolean; isFirstTime?: boolean; error?: string }>;
  loginWithPassword: (phone: string, password: string) => Promise<{ success: boolean; isNotRegistered?: boolean; error?: string }>;
  selectActiveRole: (role: 'CLIENT' | 'COMPANION') => Promise<{ success: boolean; error?: string }>;
  submitKyc: (formData: any) => Promise<{ success: boolean; mandatoryLogout?: boolean; error?: string }>;
  logout: () => void;
  refreshUserData: () => void;
  bookingContext: BookingContextData | null;
  setBookingContext: (ctx: BookingContextData | null) => void;
  checkPhoneRegistered: (phone: string) => Promise<{ registered: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('pairup_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('pairup_token');
  });

  const [activeRole, setActiveRole] = useState<'CLIENT' | 'COMPANION' | null>(() => {
    const saved = localStorage.getItem('pairup_active_role');
    return saved === 'CLIENT' || saved === 'COMPANION' ? saved : null;
  });

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signin'>('login');
  const [showKycWizard, setShowKycWizard] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [bookingContext, setBookingContextState] = useState<BookingContextData | null>(() => {
    try {
      const saved = localStorage.getItem('pairup_booking_context');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setBookingContext = (ctx: BookingContextData | null) => {
    setBookingContextState(ctx);
    if (ctx) {
      localStorage.setItem('pairup_booking_context', JSON.stringify(ctx));
    } else {
      localStorage.removeItem('pairup_booking_context');
    }
  };

  const checkPhoneRegistered = async (phone: string) => {
    try {
      const res = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (!res.ok) {
        return { registered: false, error: data.error };
      }
      return { registered: Boolean(data.registered) };
    } catch (err: any) {
      return { registered: false, error: err.message };
    }
  };

  useEffect(() => {
    if (user) {
      localStorage.setItem('pairup_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('pairup_user');
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('pairup_token', token);
    } else {
      localStorage.removeItem('pairup_token');
    }
  }, [token]);

  useEffect(() => {
    if (activeRole) {
      localStorage.setItem('pairup_active_role', activeRole);
    } else {
      localStorage.removeItem('pairup_active_role');
    }
  }, [activeRole]);

  const openAuthModal = (tab: 'login' | 'signin' = 'login') => {
    setAuthModalTab(tab);
    setShowAuthModal(true);
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
  };

  const openKycWizard = () => {
    setShowKycWizard(true);
  };

  const closeKycWizard = () => {
    setShowKycWizard(false);
  };

  const requestOtp = async (phone: string, purpose = 'auth') => {
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to send OTP' };
      }
      return { success: true, message: data.message, devCode: data.devCode };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error requesting OTP' };
    }
  };

  const registerWithOtp = async (phone: string, otp: string, password: string) => {
    try {
      const res = await fetch('/api/auth/register-with-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, password })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }
      setUser(data.user);
      setToken(data.token);
      setShowAuthModal(false);
      // First-time users are prompted to the Unified Profile & KYC Wizard
      setShowKycWizard(true);
      return { success: true, isFirstTime: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during registration' };
    }
  };

  const loginWithPassword = async (phone: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error,
          isNotRegistered: data.isNotRegistered
        };
      }

      setUser(data.user);
      setToken(data.token);
      setShowAuthModal(false);

      // Check if user still needs KYC
      if (data.user.kycStatus === 'NOT_SUBMITTED') {
        setShowKycWizard(true);
      } else {
        // Every successful login displays role selection
        setShowRoleSelection(true);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const selectActiveRole = async (role: 'CLIENT' | 'COMPANION') => {
    if (!user) return { success: false, error: 'User not signed in' };
    try {
      const res = await fetch('/api/auth/select-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, role })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }
      setActiveRole(role);
      setUser(prev => prev ? { ...prev, activeRole: role } : null);
      setShowRoleSelection(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const submitKyc = async (formData: any) => {
    if (!user) return { success: false, error: 'User session required' };
    try {
      const res = await fetch('/api/kyc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userId: user.id })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }

      // Mandatory Logout After KYC Submission
      // 1. Revoke active session
      // 2. Automatically log out the user
      // 3. Return user to login page
      logout();
      setShowKycWizard(false);
      openAuthModal('login');

      return { success: true, mandatoryLogout: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setActiveRole(null);
    setShowRoleSelection(false);
    setShowKycWizard(false);
    localStorage.removeItem('pairup_user');
    localStorage.removeItem('pairup_token');
    localStorage.removeItem('pairup_active_role');
  };

  const refreshUserData = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/companion/status/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setUser(prev => prev ? { ...prev, kycStatus: data.kycStatus } : null);
      }
    } catch (err) {
      console.error('Error refreshing user status', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeRole,
        isAuthenticated: Boolean(user && token),
        showAuthModal,
        authModalTab,
        showKycWizard,
        showRoleSelection,
        openAuthModal,
        closeAuthModal,
        openKycWizard,
        closeKycWizard,
        requestOtp,
        registerWithOtp,
        loginWithPassword,
        selectActiveRole,
        submitKyc,
        logout,
        refreshUserData,
        bookingContext,
        setBookingContext,
        checkPhoneRegistered
      }}
    >
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

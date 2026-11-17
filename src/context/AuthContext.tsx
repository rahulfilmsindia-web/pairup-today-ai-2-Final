import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, KYCStatus, BookingContextData } from '../types';
import { apiFetch } from '../utils/api';

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
  registerWithOtp: (phone: string, otp: string, password: string, selectedRole?: 'CLIENT' | 'COMPANION') => Promise<{ success: boolean; isFirstTime?: boolean; error?: string }>;
  loginWithPassword: (phone: string, password: string, selectedRole?: 'CLIENT' | 'COMPANION') => Promise<{ success: boolean; isNotRegistered?: boolean; error?: string }>;
  selectActiveRole: (role: 'CLIENT' | 'COMPANION') => Promise<{ success: boolean; error?: string }>;
  submitKyc: (formData: any) => Promise<{ success: boolean; mandatoryLogout?: boolean; error?: string }>;
  logout: () => void;
  refreshUserData: () => void;
  updateProfile: (profileData: {
    profileName?: string;
    bio?: string;
    profilePhoto?: string;
    photos?: string[];
    city?: string;
    state?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<{ success: boolean; error?: string; user?: User }>;
  bookingContext: BookingContextData | null;
  setBookingContext: (ctx: BookingContextData | null) => void;
  checkPhoneRegistered: (phone: string) => Promise<{ registered: boolean; error?: string }>;
  resetPassword: (phone: string, otp: string, newPassword: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  changePassword: (otp: string, newPassword: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  deleteAccount: (otp: string) => Promise<{ success: boolean; message?: string; error?: string }>;
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
      const res = await apiFetch('/api/auth/check-phone', {
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

  // Cross-device synchronization: Fetch latest profile whenever token is available
  useEffect(() => {
    if (!token) return;
    let active = true;
    apiFetch('/api/user/profile', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (active && data?.success && data?.user) {
          setUser(data.user);
          localStorage.setItem('pairup_user', JSON.stringify(data.user));
          if (data.user.activeRole) {
            setActiveRole(data.user.activeRole);
            localStorage.setItem('pairup_active_role', data.user.activeRole);
          }
        }
      })
      .catch(err => {
        console.warn('Cross-device profile auto-sync warning:', err);
      });
    return () => { active = false; };
  }, [token]);

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
      const res = await apiFetch('/api/auth/request-otp', {
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

  const registerWithOtp = async (phone: string, otp: string, password: string, selectedRole?: 'CLIENT' | 'COMPANION') => {
    try {
      const res = await apiFetch('/api/auth/register-with-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, password, role: selectedRole })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('pairup_user', JSON.stringify(data.user));
      localStorage.setItem('pairup_token', data.token);

      const effectiveRole = selectedRole || data.user?.activeRole || 'CLIENT';
      setActiveRole(effectiveRole);
      localStorage.setItem('pairup_active_role', effectiveRole);

      setShowAuthModal(false);
      // First-time users are prompted to the Unified Profile & KYC Wizard
      setShowKycWizard(true);
      return { success: true, isFirstTime: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during registration' };
    }
  };

  const loginWithPassword = async (phone: string, password: string, selectedRole?: 'CLIENT' | 'COMPANION') => {
    try {
      const res = await apiFetch('/api/auth/login', {
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
      localStorage.setItem('pairup_user', JSON.stringify(data.user));
      localStorage.setItem('pairup_token', data.token);

      // Determine active role based on explicit user choice, or user.activeRole
      const effectiveRole = selectedRole || data.user?.activeRole || (data.user?.role === 'COMPANION' ? 'COMPANION' : 'CLIENT');
      setActiveRole(effectiveRole);
      localStorage.setItem('pairup_active_role', effectiveRole);

      // Seamlessly sync chosen role with backend
      if (selectedRole) {
        apiFetch('/api/auth/select-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
          body: JSON.stringify({ userId: data.user.id, role: selectedRole })
        }).catch(err => console.warn('Role sync warning:', err));
      }

      setShowAuthModal(false);

      // Check if user still needs KYC
      if (data.user.kycStatus === 'NOT_SUBMITTED') {
        setShowKycWizard(true);
      } else if (!selectedRole && data.user.role === 'DUAL') {
        setShowRoleSelection(true);
      } else {
        setShowRoleSelection(false);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const selectActiveRole = async (role: 'CLIENT' | 'COMPANION') => {
    if (!user) return { success: false, error: 'User not signed in' };
    try {
      const res = await apiFetch('/api/auth/select-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, role })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }
      setActiveRole(role);
      localStorage.setItem('pairup_active_role', role);
      setUser(prev => prev ? { ...prev, role: data.role || prev.role, activeRole: role } : null);
      setShowRoleSelection(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const submitKyc = async (formData: any) => {
    if (!user) return { success: false, error: 'User session required' };
    try {
      const res = await apiFetch('/api/kyc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    if (!token) return;
    try {
      const res = await apiFetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.user) {
          setUser(data.user);
          localStorage.setItem('pairup_user', JSON.stringify(data.user));
          if (data.user.activeRole) {
            setActiveRole(data.user.activeRole);
            localStorage.setItem('pairup_active_role', data.user.activeRole);
          }
        }
      }
    } catch (err) {
      console.warn('Error refreshing user profile', err);
    }
  };

  const updateProfile = async (profileData: {
    profileName?: string;
    bio?: string;
    profilePhoto?: string;
    photos?: string[];
    city?: string;
    state?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    try {
      const res = await apiFetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        return { 
          success: false, 
          error: res.status === 503 
            ? 'Server is temporarily busy or photo size is too large. Please retry.' 
            : `Server returned error (${res.status}): ${text.slice(0, 100)}` 
        };
      }
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('pairup_user', JSON.stringify(data.user));
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error || 'Failed to update profile' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating profile' };
    }
  };

  const resetPassword = async (phone: string, otp: string, newPassword: string) => {
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to reset password' };
      }
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error resetting password' };
    }
  };

  const changePassword = async (otp: string, newPassword: string) => {
    try {
      const res = await apiFetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ otp, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to change password' };
      }
      logout();
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error changing password' };
    }
  };

  const deleteAccount = async (otp: string) => {
    try {
      const res = await apiFetch('/api/user/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ otp, confirmDelete: true })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to delete account' };
      }
      logout();
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error deleting account' };
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
        updateProfile,
        bookingContext,
        setBookingContext,
        checkPhoneRegistered,
        resetPassword,
        changePassword,
        deleteAccount
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

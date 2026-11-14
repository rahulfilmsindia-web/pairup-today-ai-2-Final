import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser } from '../types';
import { apiFetch } from '../utils/api';

interface AdminAuthContextType {
  admin: AdminUser | null;
  adminToken: string | null;
  isAdminAuthenticated: boolean;
  step: 'CREDENTIALS' | 'MFA_OTP';
  pendingEmail: string;
  maskedPhone: string;
  loginStepOne: (email: string, password: string) => Promise<{ success: boolean; requiresMfa?: boolean; error?: string }>;
  verifyMfaStepTwo: (otp: string) => Promise<{ success: boolean; error?: string }>;
  adminLogout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('pairup_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('pairup_admin_token');
  });

  const [step, setStep] = useState<'CREDENTIALS' | 'MFA_OTP'>('CREDENTIALS');
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const [maskedPhone, setMaskedPhone] = useState<string>('');

  useEffect(() => {
    if (admin) {
      localStorage.setItem('pairup_admin_user', JSON.stringify(admin));
    } else {
      localStorage.removeItem('pairup_admin_user');
    }
  }, [admin]);

  useEffect(() => {
    if (adminToken) {
      localStorage.setItem('pairup_admin_token', adminToken);
    } else {
      localStorage.removeItem('pairup_admin_token');
    }
  }, [adminToken]);

  const loginStepOne = async (email: string, password: string) => {
    try {
      const res = await apiFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Admin authentication failed' };
      }

      setPendingEmail(email);
      setMaskedPhone(data.maskedPhone || '+91 86******37');
      setStep('MFA_OTP');

      return { success: true, requiresMfa: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during admin login' };
    }
  };

  const verifyMfaStepTwo = async (otp: string) => {
    try {
      const res = await apiFetch('/api/admin/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, otp })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid MFA code' };
      }

      setAdmin(data.admin);
      setAdminToken(data.adminToken);
      setStep('CREDENTIALS');
      setPendingEmail('');
      setMaskedPhone('');

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during MFA verification' };
    }
  };

  const adminLogout = () => {
    setAdmin(null);
    setAdminToken(null);
    setStep('CREDENTIALS');
    setPendingEmail('');
    setMaskedPhone('');
    localStorage.removeItem('pairup_admin_user');
    localStorage.removeItem('pairup_admin_token');
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        adminToken,
        isAdminAuthenticated: Boolean(admin && adminToken),
        step,
        pendingEmail,
        maskedPhone,
        loginStepOne,
        verifyMfaStepTwo,
        adminLogout
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { AdminRole, KYCStatus } from '../types';
import { apiFetch } from '../utils/api';
import { 
  ShieldAlert, Lock, KeyRound, CheckCircle, AlertCircle, 
  Users, DollarSign, FileCheck, Shield, Eye, EyeOff, 
  Search, RefreshCw, Send, Check, X, LogOut, ChevronRight,
  UserCheck, CreditCard, Calendar, Clock, Sliders, Settings,
  CheckCircle2, AlertTriangle, FileText, Landmark, Trash2, RotateCcw, Building2, Copy
} from 'lucide-react';

// 17 Admin Modules
export type AdminModule =
  | 'overview'
  | 'reports'
  | 'clients'
  | 'companions'
  | 'client-kyc'
  | 'companion-kyc'
  | 'pending-approvals'
  | 'approved-rejected'
  | 'memberships'
  | 'bookings'
  | 'payments'
  | 'refunds'
  | 'finance'
  | 'manual-payout'
  | 'support'
  | 'audit'
  | 'staff'
  | 'security';

// Strict Role-Based Module Access Control (RBAC - Least Privilege)
export const ROLE_ALLOWED_MODULES: Record<AdminRole, AdminModule[]> = {
  SUPER_ADMIN: [
    'overview',
    'reports',
    'clients',
    'companions',
    'client-kyc',
    'companion-kyc',
    'pending-approvals',
    'approved-rejected',
    'memberships',
    'bookings',
    'payments',
    'refunds',
    'finance',
    'manual-payout',
    'audit',
    'staff',
    'security'
  ],
  KYC_ADMIN: [
    'pending-approvals',
    'client-kyc',
    'companion-kyc',
    'approved-rejected'
  ],
  FINANCE_ADMIN: [
    'finance',
    'manual-payout',
    'payments',
    'memberships',
    'bookings',
    'refunds'
  ],
  SUPPORT_ADMIN: [
    'reports',
    'clients',
    'companions',
    'bookings',
    'refunds'
  ],
  AUDITOR: [
    'audit',
    'overview',
    'payments',
    'memberships',
    'bookings',
    'reports',
    'refunds'
  ]
};

export const getDefaultModuleForRole = (role?: AdminRole): AdminModule => {
  switch (role) {
    case 'KYC_ADMIN':
      return 'pending-approvals';
    case 'FINANCE_ADMIN':
      return 'finance';
    case 'SUPPORT_ADMIN':
      return 'reports';
    case 'AUDITOR':
      return 'audit';
    case 'SUPER_ADMIN':
    default:
      return 'overview';
  }
};

export const isModuleAllowedForRole = (role: AdminRole | undefined, module: AdminModule): boolean => {
  if (!role) return false;
  const allowed = ROLE_ALLOWED_MODULES[role];
  return allowed ? allowed.includes(module) : false;
};

export const AdminPortal: React.FC = () => {
  const {
    admin,
    adminToken,
    isAdminAuthenticated,
    step,
    pendingEmail,
    maskedPhone,
    loginStepOne,
    verifyMfaStepTwo,
    adminLogout
  } = useAdminAuth();

  // Admin login credentials state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [mfaOtpInput, setMfaOtpInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [currentSection, setCurrentSection] = useState<AdminModule>(() => {
    return admin ? getDefaultModuleForRole(admin.role) : 'overview';
  });

  useEffect(() => {
    if (admin) {
      if (!isModuleAllowedForRole(admin.role, currentSection)) {
        setCurrentSection(getDefaultModuleForRole(admin.role));
      }
    }
  }, [admin?.role]);

  // Overview stats
  const [stats, setStats] = useState<any | null>(null);

  // Incident Reports & Safety
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [reportFilter, setReportFilter] = useState<'ALL' | 'PENDING_REVIEW' | 'WARNED' | 'SUSPENDED' | 'DISMISSED'>('ALL');

  // User Moderation Modal
  const [moderationModal, setModerationModal] = useState<{
    open: boolean;
    user: { id: string; name: string; phone?: string; role?: string; isSuspended?: boolean; warningCount?: number };
    defaultAction?: 'WARN' | 'SUSPEND' | 'UNSUSPEND';
    reportId?: string;
    reportContext?: string;
  } | null>(null);
  const [moderationAction, setModerationAction] = useState<'WARN' | 'SUSPEND' | 'UNSUSPEND'>('WARN');
  const [moderationReason, setModerationReason] = useState('');
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationFeedback, setModerationFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // KYC lists
  const [clientKycs, setClientKycs] = useState<any[]>([]);
  const [companionKycs, setCompanionKycs] = useState<any[]>([]);
  const [kycFilter, setKycFilter] = useState<string>('ALL');
  const [selectedKycDoc, setSelectedKycDoc] = useState<any | null>(null);
  const [kycDocuments, setKycDocuments] = useState<Record<string, string | null> | null>(null);
  const [kycDocumentsError, setKycDocumentsError] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Additional Admin Collections
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [companionsList, setCompanionsList] = useState<any[]>([]);
  const [membershipsList, setMembershipsList] = useState<any[]>([]);
  const [bookingsList, setBookingsList] = useState<any[]>([]);
  const [refundsList, setRefundsList] = useState<any[]>([]);
  const [refundStatusFilter, setRefundStatusFilter] = useState<'ALL' | 'PENDING' | 'REFUNDED' | 'NOT_APPLICABLE'>('ALL');
  const [selectedRefundForProcess, setSelectedRefundForProcess] = useState<any | null>(null);
  const [refundUtrInput, setRefundUtrInput] = useState('');
  const [refundNoteInput, setRefundNoteInput] = useState('');
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [refundProcessError, setRefundProcessError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyText = (text: string, key: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleProcessRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefundForProcess) return;
    if (!refundUtrInput.trim()) {
      setRefundProcessError('Bank UTR / Transaction Reference Number is required.');
      return;
    }
    setIsProcessingRefund(true);
    setRefundProcessError(null);
    try {
      const res = await apiFetch(`/api/admin/refunds/${selectedRefundForProcess.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminTransactionRef: refundUtrInput.trim(),
          note: refundNoteInput.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setRefundProcessError(data.error || 'Failed to process refund.');
      } else {
        setSelectedRefundForProcess(null);
        setRefundUtrInput('');
        setRefundNoteInput('');
        loadAdminData();
      }
    } catch (err: any) {
      setRefundProcessError(err.message || 'Error processing refund.');
    } finally {
      setIsProcessingRefund(false);
    }
  };
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'PAID' | 'FAILED' | 'CANCELLED' | 'PENDING'>('ALL');

  // Finance desk state
  const [settlements, setSettlements] = useState<any[]>([]);
  const [revealedBanks, setRevealedBanks] = useState<Record<string, any>>({});
  const [mfaChallengeModal, setMfaChallengeModal] = useState<{ open: boolean; companionId: string } | null>(null);
  const [mfaChallengeCode, setMfaChallengeCode] = useState('');
  const [mfaChallengeError, setMfaChallengeError] = useState<string | null>(null);

  // Manual Payout Done form state
  const [payoutModalBooking, setPayoutModalBooking] = useState<any | null>(null);
  const [utrInput, setUtrInput] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // Staff management state
  const [staffList, setStaffList] = useState<any[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<AdminRole>('KYC_ADMIN');

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Support Center state
  const [supportConversations, setSupportConversations] = useState<any[]>([]);
  const [selectedSupportConversation, setSelectedSupportConversation] = useState<any | null>(null);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [newSupportMessage, setNewSupportMessage] = useState('');
  const [supportLoading, setSupportLoading] = useState(false);

  // Sync button state & feedback
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Fetch all admin data
  const loadAdminData = async (manual = false) => {
    if (!isAdminAuthenticated || !adminToken) return;
    if (manual) setIsSyncing(true);
    const authHeaders = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };
    try {
      const fetchJson = async (path: string) => {
        try {
          const res = await apiFetch(path, { headers: authHeaders });
          if (!res.ok) return null;
          return await res.json();
        } catch (e) {
          console.warn(`Admin sync skipped for ${path}:`, e);
          return null;
        }
      };

      const role = admin?.role;
      const canOverview = role === 'SUPER_ADMIN' || role === 'AUDITOR';
      const canKyc = role === 'SUPER_ADMIN' || role === 'KYC_ADMIN';
      const canFinance = role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN';
      const canMemberships = role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN' || role === 'AUDITOR';
      const canPayments = role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN' || role === 'AUDITOR';
      const canBookings = role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN' || role === 'SUPPORT_ADMIN' || role === 'AUDITOR';
      const canRefunds = role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN' || role === 'SUPPORT_ADMIN' || role === 'AUDITOR';
      const canClients = role === 'SUPER_ADMIN' || role === 'SUPPORT_ADMIN';
      const canCompanions = role === 'SUPER_ADMIN' || role === 'SUPPORT_ADMIN';
      const canReports = role === 'SUPER_ADMIN' || role === 'SUPPORT_ADMIN' || role === 'AUDITOR';
      const canStaff = role === 'SUPER_ADMIN';
      const canAudit = role === 'SUPER_ADMIN' || role === 'AUDITOR';
      const canSupport = role === 'SUPER_ADMIN' || role === 'SUPPORT_ADMIN';

      const [
        overviewData, clientsKycData, compsKycData, finData, staffData, logsData,
        clientsData, compsData, memsData, bksData, paysData, supportData, reportsData, refundsData
      ] = await Promise.all([
        canOverview ? fetchJson('/api/admin/overview') : Promise.resolve(null),
        canKyc ? fetchJson('/api/admin/kyc/list?userType=CLIENT') : Promise.resolve(null),
        canKyc ? fetchJson('/api/admin/kyc/list?userType=COMPANION') : Promise.resolve(null),
        canFinance ? fetchJson('/api/admin/finance/settlements') : Promise.resolve(null),
        canStaff ? fetchJson('/api/admin/staff') : Promise.resolve(null),
        canAudit ? fetchJson('/api/admin/audit-logs') : Promise.resolve(null),
        canClients ? fetchJson('/api/admin/clients') : Promise.resolve(null),
        canCompanions ? fetchJson('/api/admin/companions') : Promise.resolve(null),
        canMemberships ? fetchJson('/api/admin/memberships') : Promise.resolve(null),
        canBookings ? fetchJson('/api/admin/bookings') : Promise.resolve(null),
        canPayments ? fetchJson('/api/admin/payments') : Promise.resolve(null),
        canSupport ? fetchJson('/api/admin/support/conversations') : Promise.resolve(null),
        canReports ? fetchJson('/api/admin/reports') : Promise.resolve(null),
        canRefunds ? fetchJson('/api/admin/refunds') : Promise.resolve(null)
      ]);

      if (overviewData) setStats(overviewData);
      if (clientsKycData?.submissions) setClientKycs(clientsKycData.submissions);
      if (compsKycData?.submissions) setCompanionKycs(compsKycData.submissions);
      if (finData?.settlements) setSettlements(finData.settlements);
      if (staffData?.staff) setStaffList(staffData.staff);
      if (logsData?.logs) setAuditLogs(logsData.logs);
      if (clientsData?.clients) setClientsList(clientsData.clients);
      if (compsData?.companions) setCompanionsList(compsData.companions);
      if (memsData?.memberships) setMembershipsList(memsData.memberships);
      if (bksData?.bookings) setBookingsList(bksData.bookings);
      if (paysData?.payments) setPaymentsList(paysData.payments);
      if (supportData?.conversations) setSupportConversations(supportData.conversations);
      if (reportsData?.reports) setReportsList(reportsData.reports);
      if (refundsData?.refunds) setRefundsList(refundsData.refunds);

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncedTime(timeStr);
      if (manual) {
        setSyncStatus('Refreshed');
        setTimeout(() => setSyncStatus(null), 2500);
      }
    } catch (err) {
      console.error('Error fetching admin data', err);
      if (manual) {
        setSyncStatus('Sync Error');
        setTimeout(() => setSyncStatus(null), 2500);
      }
    } finally {
      if (manual) setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      loadAdminData();
      // Relaxed 2-minute administrative background sync
      const interval = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          loadAdminData();
        }
      }, 120000);
      return () => clearInterval(interval);
    }
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (!selectedKycDoc || !adminToken) {
      setKycDocuments(null);
      setKycDocumentsError(null);
      return;
    }
    let active = true;
    setKycDocuments(null);
    setKycDocumentsError(null);
    apiFetch(`/api/admin/kyc/${encodeURIComponent(selectedKycDoc.id)}/documents`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    }).then(async response => {
      if (!response.ok) throw new Error('Private KYC documents could not be loaded.');
      const payload = await response.json();
      if (active) setKycDocuments(payload.documents || {});
    }).catch(error => {
      if (active) setKycDocumentsError(error instanceof Error ? error.message : 'Private KYC documents could not be loaded.');
    });
    return () => { active = false; };
  }, [selectedKycDoc?.id, adminToken]);

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    if (step === 'CREDENTIALS') {
      const res = await loginStepOne(emailInput, passwordInput);
      setLoginLoading(false);
      if (!res.success) {
        setLoginError(res.error || 'Admin credentials rejected.');
      }
    } else {
      const res = await verifyMfaStepTwo(mfaOtpInput);
      setLoginLoading(false);
      if (!res.success) {
        setLoginError(res.error || 'MFA validation failed.');
      }
    }
  };

  // KYC Action (Approve / Reject)
  const handleKycAction = async (submissionId: string, action: 'APPROVE' | 'REJECT') => {
    if (!admin) return;
    try {
      const res = await apiFetch(`/api/admin/kyc/${submissionId}/action`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          action,
          rejectionReason: rejectionReasonInput,
          adminId: admin.id,
          adminEmail: admin.email
        })
      });
      if (res.ok) {
        setSelectedKycDoc(null);
        setRejectionReasonInput('');
        loadAdminData();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update KYC status');
      }
    } catch (err) {
      console.error('Error deciding KYC', err);
    }
  };

  // Open Moderation Modal
  const openModerationModal = (
    user: { id: string; name: string; phone?: string; role?: string; isSuspended?: boolean; warningCount?: number },
    defaultAction: 'WARN' | 'SUSPEND' | 'UNSUSPEND' = 'WARN',
    reportId?: string,
    reportContext?: string
  ) => {
    setModerationModal({
      open: true,
      user,
      defaultAction,
      reportId,
      reportContext
    });
    setModerationAction(defaultAction);
    setModerationReason('');
    setModerationFeedback(null);
  };

  // Submit Moderation Action (Warn, Suspend, Unsuspend)
  const handleUserModeration = async () => {
    if (!moderationModal) return;
    if (moderationAction !== 'UNSUSPEND' && (!moderationReason || moderationReason.trim().length < 3)) {
      setModerationFeedback({ type: 'error', message: 'Please provide or select a reason for this moderation action.' });
      return;
    }
    setModerationLoading(true);
    setModerationFeedback(null);
    try {
      const res = await apiFetch(`/api/admin/users/${moderationModal.user.id}/moderation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: moderationAction,
          reason: moderationReason.trim(),
          reportId: moderationModal.reportId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply moderation action.');
      }
      setModerationFeedback({
        type: 'success',
        message: moderationAction === 'WARN'
          ? `Warning #${data.user?.warningCount || '1'} successfully issued to ${moderationModal.user.name}.`
          : moderationAction === 'SUSPEND'
            ? `Account of ${moderationModal.user.name} has been suspended.`
            : `Suspension lifted for ${moderationModal.user.name}. Account is now active.`
      });
      loadAdminData();
      setTimeout(() => {
        setModerationModal(null);
        setModerationFeedback(null);
        setModerationReason('');
      }, 1400);
    } catch (err: any) {
      setModerationFeedback({ type: 'error', message: err.message || 'Error executing action.' });
    } finally {
      setModerationLoading(false);
    }
  };

  // Dismiss Incident Report
  const handleDismissReport = async (reportId: string) => {
    try {
      const res = await apiFetch(`/api/admin/reports/${reportId}/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ notes: 'Dismissed by administrator after review.' })
      });
      if (res.ok) {
        loadAdminData();
      }
    } catch (err) {
      console.error('Error dismissing report:', err);
    }
  };

  // Re-authenticate MFA to reveal unmasked bank details
  const handleOpenRevealBank = async (companionId: string) => {
    setMfaChallengeModal({ open: true, companionId });
    setMfaChallengeCode('');
    setMfaChallengeError(null);
    try {
      const response = await apiFetch('/api/admin/finance/re-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVEAL_BANK' })
      });
      const data = await response.json();
      if (!response.ok) setMfaChallengeError(data.error || 'Could not send the verification code.');
      else setMfaChallengeError('A verification code was sent to your registered admin phone.');
    } catch (error: any) {
      setMfaChallengeError(error.message || 'Could not send the verification code.');
    }
  };

  const handleRevealBankChallenge = async () => {
    if (!mfaChallengeModal || !admin) return;
    setMfaChallengeError(null);
    try {
      const verification = await apiFetch('/api/admin/finance/re-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVEAL_BANK', otp: mfaChallengeCode })
      });
      const verificationData = await verification.json();
      if (!verification.ok) {
        setMfaChallengeError(verificationData.error || 'MFA verification failed.');
        return;
      }
      const response = await apiFetch('/api/admin/finance/reveal-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: mfaChallengeModal.companionId })
      });
      const data = await response.json();
      if (!response.ok) {
        setMfaChallengeError(data.error || 'Bank details could not be revealed.');
        return;
      }
      setRevealedBanks(prev => ({
        ...prev,
        [mfaChallengeModal.companionId]: {
          accountNumber: data.accountNumber,
          accountNumberMasked: data.accountNumberMasked,
          ifsc: data.ifsc,
          bankName: data.bankName,
          accountHolderName: data.accountHolderName
        }
      }));
      setMfaChallengeModal(null);
      setMfaChallengeCode('');
    } catch (error: any) {
      setMfaChallengeError(error.message || 'MFA request failed.');
    }
  };

  // Manual bank payout submit
  const handleProcessPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModalBooking || !admin) return;
    setPayoutLoading(true);
    setPayoutError(null);

    try {
      const challenge = await apiFetch('/api/admin/finance/re-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PROCESS_PAYOUT' })
      });
      const challengeData = await challenge.json();
      if (!challenge.ok) throw new Error(challengeData.error || 'Could not send payout verification code.');
      const code = window.prompt('Enter the six-digit payout verification code sent to your registered admin phone.');
      if (!code) throw new Error('Payout cancelled because no verification code was provided.');
      const verification = await apiFetch('/api/admin/finance/re-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PROCESS_PAYOUT', otp: code })
      });
      const verificationData = await verification.json();
      if (!verification.ok) throw new Error(verificationData.error || 'Payout MFA verification failed.');
      const res = await apiFetch('/api/admin/finance/process-payout', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          bookingId: payoutModalBooking.id,
          utrNumber: utrInput,
          adminId: admin.id,
          adminEmail: admin.email
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPayoutModalBooking(null);
        setUtrInput('');
        loadAdminData();
      } else {
        setPayoutError(data.error || 'Failed to process payout.');
      }
    } catch (err: any) {
      setPayoutError(err.message || 'Network error during payout');
    } finally {
      setPayoutLoading(false);
    }
  };

  // Staff creation
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (admin?.role !== 'SUPER_ADMIN') return;

    try {
      const res = await apiFetch('/api/admin/staff/create', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          email: newStaffEmail,
          phone: newStaffPhone,
          name: newStaffName,
          role: newStaffRole,
          password: newStaffPassword,
          requesterRole: admin.role
        })
      });
      if (res.ok) {
        setNewStaffEmail('');
        setNewStaffPhone('');
        setNewStaffName('');
        setNewStaffPassword('');
        loadAdminData();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to create staff account');
      }
    } catch (err) {
      console.error('Error creating staff', err);
    }
  };

  // Staff role modification (Super Admin only)
  const handleUpdateStaffRole = async (staffId: string, role: AdminRole) => {
    if (admin?.role !== 'SUPER_ADMIN') return;
    try {
      const res = await apiFetch(`/api/admin/staff/${staffId}/role`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        loadAdminData();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update staff role');
      }
    } catch (err) {
      console.error('Error updating staff role', err);
    }
  };

  // Staff deletion / access revocation (Super Admin only)
  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (admin?.role !== 'SUPER_ADMIN') return;
    if (!window.confirm(`Are you sure you want to revoke access and delete staff account for ${staffName}?`)) return;
    try {
      const res = await apiFetch(`/api/admin/staff/${staffId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        loadAdminData();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete staff member');
      }
    } catch (err) {
      console.error('Error deleting staff member', err);
    }
  };

  // UN-AUTHENTICATED ADMIN LOGIN FORM WITH 2-STEP APITXT MFA
  if (!isAdminAuthenticated || !admin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-100">
              PairUpToday Command Center
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Restricted Gateway · Authorized Personnel Only
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            {step === 'CREDENTIALS' ? (
              <>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Admin Staff Email
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="rahulfilmsindia@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Master Password
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder="Enter security password"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 text-slate-950 font-bold text-xs shadow-lg transition-all"
                >
                  {loginLoading ? 'Verifying Credentials...' : 'Proceed to Step 2: APITXT MFA'}
                </button>
              </>
            ) : (
              <>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                  <span>MFA OTP dispatched via APITXT to registered Admin phone: </span>
                  <strong className="text-amber-400 font-mono">{maskedPhone}</strong>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    6-Digit APITXT SMS MFA Code
                  </label>
                  <input
                    type="text"
                    value={mfaOtpInput}
                    onChange={e => setMfaOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit MFA OTP"
                    maxLength={6}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center tracking-widest text-slate-100 text-sm focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-slate-950 font-extrabold text-xs shadow-lg transition-all"
                >
                  {loginLoading ? 'Authenticating Admin Session...' : 'Verify MFA & Enter Vault'}
                </button>
              </>
            )}
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
            Protected by PairUp Security Network · Least Privilege RBAC
          </div>
        </div>
      </div>
    );
  }

  // Filtered KYC lists
  const pendingApprovals = [...clientKycs, ...companionKycs].filter(k => k.status === 'PENDING');
  const decidedRecords = [...clientKycs, ...companionKycs].filter(k => k.status === 'APPROVED' || k.status === 'REJECTED');

  // AUTHENTICATED ADMIN PANEL DASHBOARD
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      
      {/* Top Admin Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/40 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>PairUpToday Central Command</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">
                {admin.role}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              {admin.email} · Phone: {admin.phone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => loadAdminData(true)}
            disabled={isSyncing}
            title="Click to refresh and sync all admin data"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-700/60 disabled:opacity-60 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 transition-transform ${isSyncing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span className={syncStatus === 'Refreshed' ? 'text-emerald-400 font-semibold' : ''}>
              {isSyncing ? 'Syncing...' : syncStatus ? `✓ ${syncStatus}` : 'Sync'}
            </span>
            {lastSyncedTime && !isSyncing && !syncStatus && (
              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">({lastSyncedTime})</span>
            )}
          </button>

          <button
            onClick={adminLogout}
            className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/40 text-xs font-semibold flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Vault</span>
          </button>
        </div>
      </header>

      {/* Mobile Module Selector for smartphones & mobile devices */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 p-3">
        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
          Select Admin Module ({admin.role}):
        </label>
        <select
          value={currentSection}
          onChange={e => setCurrentSection(e.target.value as AdminModule)}
          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400"
        >
          {isModuleAllowedForRole(admin.role, 'overview') && (
            <option value="overview">Overview</option>
          )}
          {isModuleAllowedForRole(admin.role, 'reports') && (
            <option value="reports">Incident Reports & Safety ({reportsList.filter(r => r.status === 'PENDING_REVIEW').length} pending)</option>
          )}
          {isModuleAllowedForRole(admin.role, 'clients') && (
            <option value="clients">Client Management ({clientsList.length})</option>
          )}
          {isModuleAllowedForRole(admin.role, 'companions') && (
            <option value="companions">Companion Management ({companionsList.length})</option>
          )}
          {isModuleAllowedForRole(admin.role, 'pending-approvals') && (
            <option value="pending-approvals">Pending Approvals ({pendingApprovals.length})</option>
          )}
          {isModuleAllowedForRole(admin.role, 'client-kyc') && (
            <option value="client-kyc">Client Documents / KYC ({clientKycs.length})</option>
          )}
          {isModuleAllowedForRole(admin.role, 'companion-kyc') && (
            <option value="companion-kyc">Companion Documents / KYC ({companionKycs.length})</option>
          )}
          {isModuleAllowedForRole(admin.role, 'approved-rejected') && (
            <option value="approved-rejected">Approved / Rejected Records ({decidedRecords.length})</option>
          )}
          {isModuleAllowedForRole(admin.role, 'finance') && (
            <option value="finance">Finance & Settlement</option>
          )}
          {isModuleAllowedForRole(admin.role, 'manual-payout') && (
            <option value="manual-payout">Manual Payout</option>
          )}
          {isModuleAllowedForRole(admin.role, 'payments') && (
            <option value="payments">Payment Records ({paymentsList.length})</option>
          )}
          {isModuleAllowedForRole(admin.role, 'memberships') && (
            <option value="memberships">Membership Records ({membershipsList.length})</option>
          )}
          {isModuleAllowedForRole(admin.role, 'bookings') && (
            <option value="bookings">Booking Management ({bookingsList.length})</option>
          )}
          {isModuleAllowedForRole(admin.role, 'refunds') && (
            <option value="refunds">Cancelled & Refunds ({refundsList.filter(r => r.refundStatus === 'pending').length} pending)</option>
          )}
          {isModuleAllowedForRole(admin.role, 'audit') && (
            <option value="audit">Audit Logs</option>
          )}
          {isModuleAllowedForRole(admin.role, 'staff') && (
            <option value="staff">Staff Management (Super Admin)</option>
          )}
          {isModuleAllowedForRole(admin.role, 'security') && (
            <option value="security">Security Settings</option>
          )}
        </select>
      </div>

      {/* Main Admin Body */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        
        {/* Sidebar Nav: Role-Based Least Privilege (Desktop) */}
        <aside className="hidden md:block w-64 bg-slate-900/60 border-r border-slate-800 p-4 space-y-1 text-xs font-semibold overflow-y-auto shrink-0">
          <div className="pb-3 mb-2 border-b border-slate-800/80 px-2 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Authorized Modules</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-bold">
              {admin.role}
            </span>
          </div>

          {isModuleAllowedForRole(admin.role, 'overview') && (
            <button
              onClick={() => setCurrentSection('overview')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
                currentSection === 'overview' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Overview</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'reports') && (
            <button
              onClick={() => setCurrentSection('reports')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                currentSection === 'reports' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Incident Reports & Safety</span>
              </div>
              {reportsList.filter(r => r.status === 'PENDING_REVIEW').length > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                  {reportsList.filter(r => r.status === 'PENDING_REVIEW').length}
                </span>
              )}
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'clients') && (
            <button
              onClick={() => setCurrentSection('clients')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                currentSection === 'clients' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4" />
                <span>Client Management</span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{clientsList.length}</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'companions') && (
            <button
              onClick={() => setCurrentSection('companions')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                currentSection === 'companions' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>Companion Management</span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{companionsList.length}</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'pending-approvals') && (
            <button
              onClick={() => setCurrentSection('pending-approvals')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                currentSection === 'pending-approvals' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Pending Approvals</span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300">{pendingApprovals.length}</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'client-kyc') && (
            <button
              onClick={() => setCurrentSection('client-kyc')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                currentSection === 'client-kyc' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-4 h-4" />
                <span>Client Documents / KYC</span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{clientKycs.length}</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'companion-kyc') && (
            <button
              onClick={() => setCurrentSection('companion-kyc')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                currentSection === 'companion-kyc' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-4 h-4" />
                <span>Companion Documents / KYC</span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{companionKycs.length}</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'approved-rejected') && (
            <button
              onClick={() => setCurrentSection('approved-rejected')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                currentSection === 'approved-rejected' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Approved/Rejected Records</span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{decidedRecords.length}</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'finance') && (
            <button
              onClick={() => setCurrentSection('finance')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
                currentSection === 'finance' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Landmark className="w-4 h-4" />
              <span>Finance & Settlement</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'manual-payout') && (
            <button
              onClick={() => setCurrentSection('manual-payout')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
                currentSection === 'manual-payout' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Manual Payout</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'payments') && (
            <button
              onClick={() => setCurrentSection('payments')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                currentSection === 'payments' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-4 h-4" />
                <span>Payment Records</span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{paymentsList.length}</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'memberships') && (
            <button
              onClick={() => setCurrentSection('memberships')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                currentSection === 'memberships' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4" />
                <span>Membership Records</span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{membershipsList.length}</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'bookings') && (
            <button
              onClick={() => setCurrentSection('bookings')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                currentSection === 'bookings' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4" />
                <span>Booking Management</span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{bookingsList.length}</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'refunds') && (
            <button
              onClick={() => setCurrentSection('refunds')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                currentSection === 'refunds' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-4 h-4" />
                <span>Cancelled & Refunds</span>
              </div>
              {refundsList.filter(r => r.refundStatus === 'pending').length > 0 ? (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                  {refundsList.filter(r => r.refundStatus === 'pending').length}
                </span>
              ) : (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {refundsList.length}
                </span>
              )}
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'audit') && (
            <button
              onClick={() => setCurrentSection('audit')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
                currentSection === 'audit' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Audit Logs</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'staff') && (
            <button
              onClick={() => setCurrentSection('staff')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
                currentSection === 'staff' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Shield className="w-4 h-4 text-rose-400" />
              <span>Staff Management (Super Admin)</span>
            </button>
          )}

          {isModuleAllowedForRole(admin.role, 'security') && (
            <button
              onClick={() => setCurrentSection('security')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
                currentSection === 'security' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Security Settings</span>
            </button>
          )}
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {!isModuleAllowedForRole(admin.role, currentSection) ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-rose-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Access Restricted by Role</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Your account is assigned the <strong className="text-amber-400 font-mono">{admin.role}</strong> role. You only have authorized access to modules assigned to your role per least-privilege security policy.
              </p>
              <button
                onClick={() => setCurrentSection(getDefaultModuleForRole(admin.role))}
                className="px-4 py-2 bg-amber-400 text-slate-950 font-bold rounded-xl text-xs hover:bg-amber-500 transition-colors"
              >
                Go to Authorized Workspace
              </button>
            </div>
          ) : (
            <>
          {/* 1. OVERVIEW */}
          {currentSection === 'overview' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-100">
                System Health & Platform Metrics
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Total Registered Users</span>
                  <div className="text-2xl font-bold text-slate-100 mt-2">{stats?.totalUsers || 0}</div>
                  <span className="text-[10px] text-emerald-400 mt-1 block">Active across India</span>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Total Bookings</span>
                  <div className="text-2xl font-bold text-slate-100 mt-2">{stats?.totalBookings || 0}</div>
                  <span className="text-[10px] text-sky-400 mt-1 block">
                    {stats?.completedBookingsCount || 0} Completed
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Admin 15% Platform Fees</span>
                  <div className="text-2xl font-bold text-amber-400 mt-2">
                    ₹{((stats?.finance?.totalAdminPlatformFeePaise || 0) / 100).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">15% of actual booking amounts</span>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Pending KYC Documents</span>
                  <div className="text-2xl font-bold text-rose-400 mt-2">{stats?.pendingKycCount || 0}</div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Requires manual audit</span>
                </div>
              </div>
            </div>
          )}

          {/* INCIDENT REPORTS & SAFETY */}
          {currentSection === 'reports' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    <span>Incident Reports & Safety Desk</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Review safety incidents reported from Secure Chat sessions. Issue formal warnings or suspend violating accounts.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  {(['ALL', 'PENDING_REVIEW', 'WARNED', 'SUSPENDED', 'DISMISSED'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setReportFilter(tab)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                        reportFilter === tab
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab === 'ALL' ? `All (${reportsList.length})` :
                       tab === 'PENDING_REVIEW' ? `Pending (${reportsList.filter(r => r.status === 'PENDING_REVIEW').length})` :
                       tab === 'WARNED' ? `Warned (${reportsList.filter(r => r.status === 'WARNED').length})` :
                       tab === 'SUSPENDED' ? `Suspended (${reportsList.filter(r => r.status === 'SUSPENDED').length})` :
                       `Dismissed (${reportsList.filter(r => r.status === 'DISMISSED').length})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reports Grid / List */}
              {reportsList.filter(r => reportFilter === 'ALL' || r.status === reportFilter).length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                  <p className="font-semibold text-slate-300">No incident reports in this view</p>
                  <p className="text-[11px] text-slate-500 mt-1">When clients or companions click "Report Us" in Secure Chat, incidents appear here for administrative review.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reportsList
                    .filter(r => reportFilter === 'ALL' || r.status === reportFilter)
                    .map(report => (
                      <div
                        key={report.id}
                        className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-400">#{report.bookingCode || 'BOOKING'}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">
                              {new Date(report.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                            report.status === 'PENDING_REVIEW' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            report.status === 'WARNED' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                            report.status === 'SUSPENDED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {report.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Reporting User ({report.reportingUserRole})</span>
                            <span className="font-bold text-slate-200 text-sm block mt-0.5">{report.reportingUserName}</span>
                            {report.reportingUserPhone && <span className="font-mono text-slate-400 text-[11px]">{report.reportingUserPhone}</span>}
                          </div>
                          <div>
                            <span className="text-[10px] text-rose-400 uppercase font-semibold block">Reported User ({report.reportedUserRole})</span>
                            <span className="font-bold text-rose-300 text-sm block mt-0.5">{report.reportedUserName}</span>
                            {report.reportedUserPhone && <span className="font-mono text-slate-400 text-[11px]">{report.reportedUserPhone}</span>}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-amber-400 uppercase">Reason: {report.reason}</span>
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {report.details}
                          </div>
                        </div>

                        {report.resolutionNotes && (
                          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-300">
                            <strong className="text-amber-400">Resolution:</strong> {report.resolutionNotes}
                            {report.resolvedAt && <span className="text-slate-500 ml-2">({new Date(report.resolvedAt).toLocaleDateString()})</span>}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => openModerationModal(
                              { id: report.reportedUserId, name: report.reportedUserName, phone: report.reportedUserPhone, role: report.reportedUserRole },
                              'WARN',
                              report.id,
                              `Reported reason: ${report.reason}`
                            )}
                            className="px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 font-bold transition flex items-center gap-1.5"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Issue Warning</span>
                          </button>

                          <button
                            onClick={() => openModerationModal(
                              { id: report.reportedUserId, name: report.reportedUserName, phone: report.reportedUserPhone, role: report.reportedUserRole },
                              'SUSPEND',
                              report.id,
                              `Reported reason: ${report.reason}`
                            )}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold transition flex items-center gap-1.5"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Suspend Account</span>
                          </button>

                          {report.status === 'PENDING_REVIEW' && (
                            <button
                              onClick={() => handleDismissReport(report.id)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                            >
                              Dismiss Report
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* 2. CLIENT MANAGEMENT */}
          {currentSection === 'clients' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100">Client Management</h2>
              <p className="text-xs text-slate-400">All registered clients on PairUpToday. Client membership is strictly 100% Free.</p>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Client Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">City</th>
                      <th className="p-3">KYC Status</th>
                      <th className="p-3">Moderation</th>
                      <th className="p-3">Total Bookings</th>
                      <th className="p-3">Membership Fee</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {clientsList.map(c => (
                      <tr key={c.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-200">{c.legalName || 'Client Member'}</td>
                        <td className="p-3 font-mono text-slate-400">{c.phone}</td>
                        <td className="p-3 text-slate-300">{c.city || 'India'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            c.kycStatus === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {c.kycStatus}
                          </span>
                        </td>
                        <td className="p-3">
                          {c.isSuspended ? (
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30" title={c.suspendedReason || ''}>
                              🚫 SUSPENDED
                            </span>
                          ) : (c.warningCount || 0) > 0 ? (
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30" title={c.lastWarningReason || ''}>
                              ⚠️ WARNED ({c.warningCount})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-500/20 text-emerald-400">
                              ✓ ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono">{c.totalBookings || 0}</td>
                        <td className="p-3 text-emerald-400 font-bold">FREE (₹0)</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openModerationModal(
                                { id: c.id, name: c.legalName || 'Client', phone: c.phone, role: 'CLIENT', isSuspended: c.isSuspended, warningCount: c.warningCount },
                                'WARN'
                              )}
                              className="px-2 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-[10px] font-bold"
                            >
                              ⚠️ Warn
                            </button>
                            {c.isSuspended ? (
                              <button
                                onClick={() => openModerationModal(
                                  { id: c.id, name: c.legalName || 'Client', phone: c.phone, role: 'CLIENT', isSuspended: c.isSuspended, warningCount: c.warningCount },
                                  'UNSUSPEND'
                                )}
                                className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold"
                              >
                                ✓ Restore
                              </button>
                            ) : (
                              <button
                                onClick={() => openModerationModal(
                                  { id: c.id, name: c.legalName || 'Client', phone: c.phone, role: 'CLIENT', isSuspended: c.isSuspended, warningCount: c.warningCount },
                                  'SUSPEND'
                                )}
                                className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-[10px] font-bold"
                              >
                                🚫 Suspend
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. COMPANION MANAGEMENT */}
          {currentSection === 'companions' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100">Companion Management</h2>
              <p className="text-xs text-slate-400">Companion hosts and 3-Gate Activation Status (KYC, Membership, Bank).</p>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Host Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Live Status</th>
                      <th className="p-3">Moderation</th>
                      <th className="p-3">Gate 1: KYC</th>
                      <th className="p-3">Gate 2: Membership</th>
                      <th className="p-3">Gate 3: Bank</th>
                      <th className="p-3">Total Settled</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {companionsList.map(c => (
                      <tr key={c.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-200">{c.legalName}</td>
                        <td className="p-3 font-mono text-slate-400">{c.phone}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            c.isLive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {c.isLive ? 'LIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="p-3">
                          {c.isSuspended ? (
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30" title={c.suspendedReason || ''}>
                              🚫 SUSPENDED
                            </span>
                          ) : (c.warningCount || 0) > 0 ? (
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30" title={c.lastWarningReason || ''}>
                              ⚠️ WARNED ({c.warningCount})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-500/20 text-emerald-400">
                              ✓ ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {c.kycStatus === 'APPROVED' ? (
                            <span className="text-emerald-400 font-semibold">✓ Approved</span>
                          ) : (
                            <span className="text-amber-400 font-medium">{c.kycStatus || 'Pending'}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {c.membershipActive ? (
                            <span className="text-emerald-400 font-semibold">✓ {c.membershipTier}</span>
                          ) : (
                            <span className="text-slate-400">No Plan</span>
                          )}
                        </td>
                        <td className="p-3">
                          {c.bankVerified ? (
                            <span className="text-emerald-400 font-semibold">✓ Verified</span>
                          ) : (
                            <span className="text-amber-400 font-medium">Unverified</span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-emerald-400">₹{(c.totalSettledPaise / 100).toFixed(2)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openModerationModal(
                                { id: c.id, name: c.legalName || 'Companion', phone: c.phone, role: 'COMPANION', isSuspended: c.isSuspended, warningCount: c.warningCount },
                                'WARN'
                              )}
                              className="px-2 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-[10px] font-bold"
                            >
                              ⚠️ Warn
                            </button>
                            {c.isSuspended ? (
                              <button
                                onClick={() => openModerationModal(
                                  { id: c.id, name: c.legalName || 'Companion', phone: c.phone, role: 'COMPANION', isSuspended: c.isSuspended, warningCount: c.warningCount },
                                  'UNSUSPEND'
                                )}
                                className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold"
                              >
                                ✓ Restore
                              </button>
                            ) : (
                              <button
                                onClick={() => openModerationModal(
                                  { id: c.id, name: c.legalName || 'Companion', phone: c.phone, role: 'COMPANION', isSuspended: c.isSuspended, warningCount: c.warningCount },
                                  'SUSPEND'
                                )}
                                className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-[10px] font-bold"
                              >
                                🚫 Suspend
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4 & 5. CLIENT & COMPANION KYC */}
          {(currentSection === 'client-kyc' || currentSection === 'companion-kyc') && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-100">
                    {currentSection === 'client-kyc' ? 'Client Documents / KYC' : 'Companion Documents / KYC'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Strict identity verification with document preview and permanent decision audit.
                  </p>
                </div>

                <div className="flex gap-2">
                  {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                    <button
                      key={f}
                      onClick={() => setKycFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        kycFilter === f ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">User</th>
                      <th className="p-3.5">Phone</th>
                      <th className="p-3.5">ID Type</th>
                      <th className="p-3.5">DOB (Locked)</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(currentSection === 'client-kyc' ? clientKycs : companionKycs)
                      .filter(k => kycFilter === 'ALL' || k.status === kycFilter)
                      .map(k => (
                        <tr key={k.id} className="hover:bg-slate-800/40">
                          <td className="p-3.5 font-bold text-slate-200">{k.legalName}</td>
                          <td className="p-3.5 font-mono text-slate-300">{k.userPhone}</td>
                          <td className="p-3.5">{k.idType}</td>
                          <td className="p-3.5 font-mono text-slate-400">{k.dob}</td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              k.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : k.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {k.status}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <button
                              onClick={() => setSelectedKycDoc(k)}
                              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-[11px]"
                            >
                              Inspect Docs
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. PENDING APPROVALS */}
          {currentSection === 'pending-approvals' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100">Pending KYC Approvals Queue</h2>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Legal Name</th>
                      <th className="p-3">User Role</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">ID Type</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {pendingApprovals.map(k => (
                      <tr key={k.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-200">{k.legalName}</td>
                        <td className="p-3 font-semibold text-amber-300">{k.userType}</td>
                        <td className="p-3 font-mono">{k.userPhone}</td>
                        <td className="p-3">{k.idType}</td>
                        <td className="p-3">
                          <button
                            onClick={() => setSelectedKycDoc(k)}
                            className="px-3 py-1 bg-amber-400 text-slate-950 font-bold rounded"
                          >
                            Inspect & Decide
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. APPROVED/REJECTED RECORDS */}
          {currentSection === 'approved-rejected' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100">Approved & Rejected Records</h2>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Decision</th>
                      <th className="p-3">Decided At</th>
                      <th className="p-3">Decided By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {decidedRecords.map(k => (
                      <tr key={k.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-200">{k.legalName}</td>
                        <td className="p-3">{k.userType}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            k.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {k.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400">{k.decidedAt ? new Date(k.decidedAt).toLocaleString() : 'N/A'}</td>
                        <td className="p-3 font-mono text-slate-400">{k.decidedBy || 'Admin System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. MEMBERSHIP RECORDS */}
          {currentSection === 'memberships' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100">Companion Membership Records</h2>
              <p className="text-xs text-slate-400">STARTER: ₹449, PROFESSIONAL: ₹1,099, PREMIUM: ₹5,999.</p>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Transaction ID</th>
                      <th className="p-3">Companion Name</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Price Paid</th>
                      <th className="p-3">Start Date</th>
                      <th className="p-3">Expiry Date</th>
                      <th className="p-3">Active Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {membershipsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500">
                          No verified paid companion memberships recorded yet.
                        </td>
                      </tr>
                    ) : (
                      membershipsList.map(m => (
                        <tr key={m.id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-amber-400">{m.id}</td>
                          <td className="p-3 font-bold text-slate-200">{m.userName}</td>
                          <td className="p-3 font-semibold text-pink-400">{m.plan}</td>
                          <td className="p-3 font-bold text-emerald-400">₹{(m.pricePaise / 100).toFixed(2)}</td>
                          <td className="p-3 font-mono text-slate-400">{new Date(m.startDate).toLocaleDateString()}</td>
                          <td className="p-3 font-mono text-slate-400">{new Date(m.expiryDate).toLocaleDateString()}</td>
                          <td className="p-3 font-semibold">
                            {m.isActive ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold inline-flex items-center gap-1">
                                <span>✓</span> Active
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-medium">
                                Expired
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 9. BOOKING MANAGEMENT */}
          {currentSection === 'bookings' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100">Booking Management Desk</h2>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Booking Code</th>
                      <th className="p-3">Service</th>
                      <th className="p-3">Client</th>
                      <th className="p-3">Companion</th>
                      <th className="p-3">Date & Time</th>
                      <th className="p-3">Total Amount</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {bookingsList.map(b => (
                      <tr key={b.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-amber-300">{b.bookingCode}</td>
                        <td className="p-3 font-semibold">{b.serviceName}</td>
                        <td className="p-3">{b.clientName}</td>
                        <td className="p-3">{b.companionName}</td>
                        <td className="p-3 text-slate-400">{b.date} ({b.startTime} - {b.endTime})</td>
                        <td className="p-3 font-bold text-emerald-400">₹{(b.bookingAmountPaise / 100).toFixed(2)}</td>
                        <td className="p-3 font-semibold">{b.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REFUNDS MANAGEMENT DESK */}
          {currentSection === 'refunds' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-amber-400" />
                    Cancelled Bookings & Refund Desk
                  </h2>
                  <p className="text-xs text-slate-400">
                    Review cancellation reasons, automated time-slab refunds, APITXT verified bank accounts, and disburse bank transfers.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs overflow-x-auto">
                  {(['ALL', 'PENDING', 'REFUNDED', 'NOT_APPLICABLE'] as const).map(tab => {
                    const label = tab === 'ALL'
                      ? `All (${refundsList.length})`
                      : tab === 'PENDING'
                      ? `Pending (${refundsList.filter(r => r.refundStatus === 'pending').length})`
                      : tab === 'REFUNDED'
                      ? `Refunded (${refundsList.filter(r => r.refundStatus === 'refunded').length})`
                      : `0% Slab (${refundsList.filter(r => r.refundStatus === 'not_applicable' || r.refundAmount === 0).length})`;
                    return (
                      <button
                        key={tab}
                        onClick={() => setRefundStatusFilter(tab)}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                          refundStatusFilter === tab
                            ? 'bg-amber-400 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Cancellations</span>
                  <div className="text-xl font-black text-slate-100 mt-1">{refundsList.length}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[11px] text-amber-300 uppercase font-semibold">Pending Refunds</span>
                  <div className="text-xl font-black text-amber-400 mt-1">
                    ₹{refundsList.filter(r => r.refundStatus === 'pending').reduce((sum, r) => sum + (r.refundAmount || 0), 0).toLocaleString()}
                    <span className="text-xs font-normal text-amber-300 ml-1.5">
                      ({refundsList.filter(r => r.refundStatus === 'pending').length})
                    </span>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[11px] text-emerald-300 uppercase font-semibold">Total Refunded</span>
                  <div className="text-xl font-black text-emerald-400 mt-1">
                    ₹{refundsList.filter(r => r.refundStatus === 'refunded').reduce((sum, r) => sum + (r.refundAmount || 0), 0).toLocaleString()}
                    <span className="text-xs font-normal text-emerald-300 ml-1.5">
                      ({refundsList.filter(r => r.refundStatus === 'refunded').length})
                    </span>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">0% / Non-Refundable</span>
                  <div className="text-xl font-black text-slate-300 mt-1">
                    {refundsList.filter(r => r.refundStatus === 'not_applicable' || r.refundAmount === 0).length}
                  </div>
                </div>
              </div>

              {/* Refunds Table */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Booking & Service</th>
                      <th className="p-3">Client & Companion</th>
                      <th className="p-3">Cancellation Details</th>
                      <th className="p-3">Timing & Slab</th>
                      <th className="p-3">Refund Amount</th>
                      <th className="p-3">Bank Details (APITXT Verified)</th>
                      <th className="p-3">Status & Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {refundsList
                      .filter(item => {
                        if (refundStatusFilter === 'PENDING') return item.refundStatus === 'pending';
                        if (refundStatusFilter === 'REFUNDED') return item.refundStatus === 'refunded';
                        if (refundStatusFilter === 'NOT_APPLICABLE') return item.refundStatus === 'not_applicable' || item.refundAmount === 0;
                        return true;
                      })
                      .map(item => {
                        const hours = item.hoursBeforeStart;
                        let slabBadge = (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            &lt; 3h before (0% Refund)
                          </span>
                        );
                        if (hours !== null && hours !== undefined) {
                          if (hours > 12) {
                            slabBadge = (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                &gt; 12h before (100% Refund)
                              </span>
                            );
                          } else if (hours >= 3) {
                            slabBadge = (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                3–12h before (50% Refund)
                              </span>
                            );
                          }
                        }

                        const bank = item.refundBankDetails;

                        return (
                          <tr key={item.id} className="hover:bg-slate-800/40">
                            <td className="p-3">
                              <div className="font-mono font-bold text-amber-400">{item.bookingCode}</div>
                              <div className="font-semibold text-slate-200">{item.serviceName}</div>
                              <div className="text-[11px] text-slate-400">{item.date} {item.startTime}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-200">{item.clientName}</div>
                              <div className="text-[11px] text-slate-400">{item.clientPhone}</div>
                              <div className="text-[11px] text-slate-400 mt-1">Companion: <span className="text-slate-300 font-medium">{item.companionName}</span></div>
                            </td>
                            <td className="p-3 max-w-xs">
                              <div className="font-medium text-slate-200 text-wrap break-words">{item.cancellationReason}</div>
                              {item.cancellationNote && (
                                <div className="text-[11px] text-slate-400 italic mt-0.5 text-wrap break-words">"{item.cancellationNote}"</div>
                              )}
                              <div className="text-[10px] text-slate-500 mt-1 font-mono">
                                {new Date(item.cancelledAt).toLocaleString()}
                              </div>
                            </td>
                            <td className="p-3">
                              {slabBadge}
                              <div className="text-[11px] text-slate-400 mt-1">
                                {hours !== null && hours !== undefined ? `${hours.toFixed(1)} hrs remaining` : 'Immediate'}
                              </div>
                            </td>
                            <td className="p-3 font-mono">
                              <div className="text-xs text-slate-400 line-through">₹{item.totalPaidAmount}</div>
                              <div className="text-sm font-bold text-emerald-400">₹{item.refundAmount}</div>
                              <div className="text-[10px] text-slate-400">({item.refundPercentage}%)</div>
                            </td>
                            <td className="p-3">
                              {bank ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-200">{bank.beneficiaryName}</span>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      <CheckCircle2 className="w-3 h-3" /> APITXT
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                                    <span>A/C: {bank.accountNumber}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(bank.accountNumber, `ac_${item.id}`)}
                                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                                      title="Copy Account Number"
                                    >
                                      {copiedKey === `ac_${item.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                                    <span>IFSC: {bank.ifscCode}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(bank.ifscCode, `ifsc_${item.id}`)}
                                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                                      title="Copy IFSC Code"
                                    >
                                      {copiedKey === `ifsc_${item.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                  {bank.bankName && (
                                    <div className="text-[10px] text-slate-400">{bank.bankName}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">No bank required (₹0)</span>
                              )}
                            </td>
                            <td className="p-3">
                              {item.refundStatus === 'refunded' ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle className="w-3 h-3" /> Refunded
                                  </span>
                                  <div className="font-mono text-[10px] text-slate-300">
                                    UTR: <span className="text-amber-300 font-bold">{item.refundUtr}</span>
                                  </div>
                                  {item.refundedAt && (
                                    <div className="text-[10px] text-slate-500">
                                      {new Date(item.refundedAt).toLocaleDateString()} by {item.refundedByAdmin || 'Admin'}
                                    </div>
                                  )}
                                </div>
                              ) : item.refundStatus === 'pending' ? (
                                <div className="space-y-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    <Clock className="w-3 h-3" /> Pending Refund
                                  </span>
                                  <div>
                                    <button
                                      onClick={() => {
                                        setSelectedRefundForProcess(item);
                                        setRefundUtrInput('');
                                        setRefundNoteInput('');
                                        setRefundProcessError(null);
                                      }}
                                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors shadow"
                                    >
                                      Mark as Refunded
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400">
                                  Non-refundable
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {refundsList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          No cancelled bookings or refund requests found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mark as Refunded Modal */}
          {selectedRefundForProcess && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative space-y-4">
                <button
                  type="button"
                  onClick={() => setSelectedRefundForProcess(null)}
                  className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-amber-400" />
                    Record Completed Bank Refund
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enter the bank UTR / IMPS transaction reference after transferring the funds.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Booking Code:</span>
                    <span className="font-mono font-bold text-amber-400">{selectedRefundForProcess.bookingCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Client:</span>
                    <span className="font-semibold text-slate-200">{selectedRefundForProcess.clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Refund Amount:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">₹{selectedRefundForProcess.refundAmount}</span>
                  </div>
                  {selectedRefundForProcess.refundBankDetails && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      <div className="text-[11px] text-slate-400">Beneficiary: <span className="text-slate-200 font-semibold">{selectedRefundForProcess.refundBankDetails.beneficiaryName}</span></div>
                      <div className="text-[11px] font-mono text-slate-300">A/C: {selectedRefundForProcess.refundBankDetails.accountNumber}</div>
                      <div className="text-[11px] font-mono text-slate-300">IFSC: {selectedRefundForProcess.refundBankDetails.ifscCode}</div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleProcessRefundSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Bank UTR / Transaction Reference Number <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 239014582918"
                      value={refundUtrInput}
                      onChange={e => setRefundUtrInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Internal Admin Note (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Processed via HDFC Corporate NetBanking"
                      value={refundNoteInput}
                      onChange={e => setRefundNoteInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 text-xs"
                    />
                  </div>

                  {refundProcessError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{refundProcessError}</span>
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRefundForProcess(null)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessingRefund}
                      className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors shadow disabled:opacity-50"
                    >
                      {isProcessingRefund ? 'Processing...' : 'Confirm & Mark Refunded'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 10. PAYMENT RECORDS */}
          {currentSection === 'payments' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-100">Payment Records & Escrow Ledger</h2>
                  <p className="text-xs text-slate-400">Real-time ledger of booking escrows and companion memberships with verified payment statuses.</p>
                </div>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs overflow-x-auto">
                  {(['ALL', 'PAID', 'FAILED', 'CANCELLED', 'PENDING'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setPaymentStatusFilter(tab)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                        paymentStatusFilter === tab
                          ? 'bg-amber-400 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab === 'ALL' ? 'All Records' : tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Payment ID</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Payer</th>
                      <th className="p-3">Recipient</th>
                      <th className="p-3">Gross Amount</th>
                      <th className="p-3">Admin Fee</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {paymentsList
                      .filter(p => paymentStatusFilter === 'ALL' || p.status === paymentStatusFilter)
                      .map(p => (
                        <tr key={p.id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-amber-400">{p.id}</td>
                          <td className="p-3">{p.type}</td>
                          <td className="p-3 font-semibold text-slate-200">{p.payerName}</td>
                          <td className="p-3 text-slate-300">{p.recipientName}</td>
                          <td className="p-3 font-bold text-emerald-400">₹{(p.grossAmountPaise / 100).toFixed(2)}</td>
                          <td className="p-3 text-amber-400">₹{(p.adminFeePaise / 100).toFixed(2)}</td>
                          <td className="p-3 font-semibold">
                            {p.status === 'PAID' ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold inline-flex items-center gap-1">
                                <span>✓</span> PAID
                              </span>
                            ) : p.status === 'FAILED' ? (
                              <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold inline-flex items-center gap-1">
                                <span>✕</span> FAILED
                              </span>
                            ) : p.status === 'CANCELLED' ? (
                              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold inline-flex items-center gap-1">
                                <span>⊘</span> CANCELLED
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium inline-flex items-center gap-1">
                                <span>⏳</span> {p.status || 'PENDING'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    {paymentsList.filter(p => paymentStatusFilter === 'ALL' || p.status === paymentStatusFilter).length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500">
                          No payment records found for {paymentStatusFilter} status.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 11 & 12. FINANCE & MANUAL PAYOUT */}
          {(currentSection === 'finance' || currentSection === 'manual-payout') && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  Finance Admin Desk — 15% Platform Fees & 85% Companion Settlements
                </h2>
                <p className="text-xs text-slate-400">
                  Late penalties deducted from companion share and credited to client. 48-Hour UTC safety lock enforced before manual payout.
                </p>
              </div>

              {/* Settlements Table */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Booking ID</th>
                      <th className="p-3">Client</th>
                      <th className="p-3">Companion</th>
                      <th className="p-3">Amount (100%)</th>
                      <th className="p-3">Admin Fee (15%)</th>
                      <th className="p-3">Companion Share (85%)</th>
                      <th className="p-3">Late Penalty</th>
                      <th className="p-3">Net Payable</th>
                      <th className="p-3">Bank Account</th>
                      <th className="p-3">48h UTC Lock Status</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {settlements.map(b => {
                      const revealed = revealedBanks[b.companionId];
                      return (
                        <tr key={b.id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-amber-300">{b.bookingCode}</td>
                          <td className="p-3 text-slate-300">{b.clientName}</td>
                          <td className="p-3 text-slate-300">{b.companionName}</td>
                          <td className="p-3 font-semibold text-slate-100">₹{(b.bookingAmountPaise / 100).toFixed(2)}</td>
                          <td className="p-3 text-amber-400 font-semibold">₹{(b.adminPlatformFeePaise / 100).toFixed(2)}</td>
                          <td className="p-3 text-slate-300">₹{(b.companionGrossSharePaise / 100).toFixed(2)}</td>
                          <td className="p-3 text-rose-400">
                            {b.latePenaltyPaise > 0 ? (
                              <span>-₹{(b.latePenaltyPaise / 100).toFixed(2)} ({b.delayMinutes}m delay)</span>
                            ) : (
                              <span className="text-slate-500">None</span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-emerald-400">
                            ₹{(b.companionNetSharePaise / 100).toFixed(2)}
                          </td>
                          <td className="p-3 font-mono text-slate-400">
                            {revealed ? (
                              <span className="text-emerald-300 font-bold">
                                {revealed.accountNumber} ({revealed.ifsc})
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span>{b.bankAccountMasked || '••••••••1234'}</span>
                                <button
                                  onClick={() => handleOpenRevealBank(b.companionId)}
                                  className="text-[10px] text-amber-400 underline hover:text-amber-300"
                                >
                                  MFA Reveal
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.calculatedEligibility === 'PAID_OUT'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : b.calculatedEligibility === 'ELIGIBLE_FOR_PAYOUT'
                                ? 'bg-sky-500/10 text-sky-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {b.calculatedEligibility}
                            </span>
                          </td>
                          <td className="p-3">
                            {b.calculatedEligibility === 'ELIGIBLE_FOR_PAYOUT' && (
                              <button
                                onClick={() => setPayoutModalBooking(b)}
                                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs"
                              >
                                Process Payout
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 13. AUDIT TRAIL */}
          {currentSection === 'audit' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-100">
                Tamper-Resistant Security Audit Trail
              </h2>
              <div className="space-y-2">
                {auditLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400">{log.action}</span>
                        <span className="text-slate-500 font-mono text-[10px]">({log.id})</span>
                      </div>
                      <p className="text-slate-300 mt-0.5">{log.details}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 14. STAFF MANAGEMENT (SUPER_ADMIN ONLY) */}
          {currentSection === 'staff' && admin.role === 'SUPER_ADMIN' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-100">
                Staff Administration & Role Permissions
              </h2>

              {/* Create Staff Form */}
              <form onSubmit={handleCreateStaff} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Staff Name</label>
                  <input
                    type="text"
                    value={newStaffName}
                    onChange={e => setNewStaffName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newStaffEmail}
                    onChange={e => setNewStaffEmail(e.target.value)}
                    placeholder="admin@pairuptoday.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newStaffPhone}
                    onChange={e => setNewStaffPhone(e.target.value)}
                    placeholder="+91XXXXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Temporary Password (12+ characters)</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={1024}
                    value={newStaffPassword}
                    onChange={e => setNewStaffPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Role (Strict 5)</label>
                  <select
                    value={newStaffRole}
                    onChange={e => setNewStaffRole(e.target.value as AdminRole)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                  >
                    <option value="KYC_ADMIN">KYC_ADMIN</option>
                    <option value="FINANCE_ADMIN">FINANCE_ADMIN</option>
                    <option value="SUPPORT_ADMIN">SUPPORT_ADMIN</option>
                    <option value="AUDITOR">AUDITOR</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full py-2 bg-amber-400 text-slate-950 font-bold rounded-xl">
                    Create Staff
                  </button>
                </div>
              </form>

              {/* Staff Table */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Staff Member</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Assigned Role</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {staffList.map(s => (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-200">{s.name}</td>
                        <td className="p-3 font-mono">{s.email}</td>
                        <td className="p-3 font-mono text-slate-400">{s.phone}</td>
                        <td className="p-3">
                          {s.role === 'SUPER_ADMIN' ? (
                            <span className="font-bold text-rose-400 font-mono">SUPER_ADMIN</span>
                          ) : (
                            <select
                              value={s.role}
                              onChange={e => handleUpdateStaffRole(s.id, e.target.value as AdminRole)}
                              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-amber-300 font-semibold text-xs focus:outline-none focus:border-amber-400"
                            >
                              <option value="KYC_ADMIN">KYC_ADMIN (KYC Only)</option>
                              <option value="FINANCE_ADMIN">FINANCE_ADMIN (Finance Only)</option>
                              <option value="SUPPORT_ADMIN">SUPPORT_ADMIN (Support Only)</option>
                              <option value="AUDITOR">AUDITOR (Read-Only Audit)</option>
                            </select>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {s.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => handleDeleteStaff(s.id, s.name)}
                              className="px-2.5 py-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-xs inline-flex items-center gap-1 border border-transparent hover:border-rose-500/30"
                              title="Revoke staff access"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Revoke</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 15. SECURITY SETTINGS */}
          {currentSection === 'security' && (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs max-w-2xl">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                Security Policies & Hardening
              </h2>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-bold text-slate-200 block mb-1">Server-Secret HMAC-SHA256 OTP Challenge</span>
                  <p className="text-slate-400">All 6-digit OTPs are hashed using server-side HMAC secrets with constant-time verification.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-bold text-slate-200 block mb-1">48-Hour UTC Settlement Lock</span>
                  <p className="text-slate-400">Automatic safety hold is active across all companion booking balances before disbursement.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-bold text-slate-200 block mb-1">Least Privilege Role Enforcement</span>
                  <p className="text-slate-400">Restricted to SUPER_ADMIN, KYC_ADMIN, FINANCE_ADMIN, SUPPORT_ADMIN, and AUDITOR.</p>
                </div>
              </div>
            </div>
          )}
          </>
        )}
        </main>
      </div>

      {/* INSPECT KYC MODAL */}
      {selectedKycDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100">
                KYC Verification: {selectedKycDoc.legalName} ({selectedKycDoc.userType})
              </h3>
              <button
                onClick={() => setSelectedKycDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Front ID Document:</span>
                <img
                  src={kycDocuments?.idFrontUrl || undefined}
                  alt="Front ID"
                  referrerPolicy="no-referrer"
                  className="w-full h-40 object-cover rounded-xl border border-slate-700 bg-slate-950"
                />
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Live Facial Selfie:</span>
                <img
                  src={kycDocuments?.selfieUrl || undefined}
                  alt="Selfie"
                  referrerPolicy="no-referrer"
                  className="w-full h-40 object-cover rounded-xl border border-slate-700 bg-slate-950"
                />
              </div>
              {kycDocuments?.idBackUrl && (
                <div className="col-span-2">
                  <span className="text-slate-400 block mb-1">Back ID Document:</span>
                  <img
                    src={kycDocuments.idBackUrl}
                    alt="Back ID"
                    referrerPolicy="no-referrer"
                    className="w-full max-h-56 object-contain rounded-xl border border-slate-700 bg-slate-950"
                  />
                </div>
              )}
            </div>
            {kycDocumentsError && <p className="text-xs text-rose-400">{kycDocumentsError}</p>}

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div>DOB: <strong className="font-mono text-slate-200">{selectedKycDoc.dob}</strong> (Permanently Locked)</div>
              <div>Phone: <strong className="font-mono text-slate-200">{selectedKycDoc.userPhone}</strong></div>
              <div>ID Type: <strong className="text-amber-400">{selectedKycDoc.idType}</strong></div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Rejection Reason (Required if Rejecting):
              </label>

              {/* Predefined Quick-Select Rejection Reasons */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">Quick Select Preset Reason:</span>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {[
                    'Document photo is blur or unreadable. Please re-upload clear photos.',
                    'Government ID expired or invalid document type. Please upload valid Govt ID.',
                    'Live selfie photo does not match document photo. Please retake clear selfie.',
                    'Document front or back side is missing or cut off. Please re-upload full document.',
                    'Name or Date of Birth does not match document details. Please verify your details.',
                    'ID document has glare, reflection or partial coverage. Please re-upload clear scan.'
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectionReasonInput(preset)}
                      className={`text-left text-[11px] p-2 rounded-lg border transition-all ${
                        rejectionReasonInput === preset
                          ? 'bg-red-500/20 border-red-500 text-red-200 font-semibold shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      • {preset}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                value={rejectionReasonInput}
                onChange={e => setRejectionReasonInput(e.target.value)}
                placeholder="Or type a custom rejection reason..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-red-400"
              />
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => handleKycAction(selectedKycDoc.id, 'REJECT')}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                Reject KYC
              </button>
              <button
                onClick={() => handleKycAction(selectedKycDoc.id, 'APPROVE')}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
              >
                Approve KYC & Activate Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MFA CHALLENGE MODAL BEFORE REVEALING BANK DETAILS */}
      {mfaChallengeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>Security Re-Authentication</span>
            </div>
            <p className="text-xs text-slate-400">
              Viewing sensitive bank details requires a one-time SMS verification code sent to your registered admin phone.
            </p>

            {mfaChallengeError && (
              <div className="p-2 rounded bg-red-500/10 text-red-300 text-xs">
                {mfaChallengeError}
              </div>
            )}

            <input
              type="password"
              value={mfaChallengeCode}
              onChange={e => setMfaChallengeCode(e.target.value)}
              placeholder="Six-digit SMS code"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-center font-mono tracking-widest text-slate-100 text-sm"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setMfaChallengeModal(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRevealBankChallenge}
                className="flex-1 py-2 bg-amber-400 text-slate-950 font-bold rounded-xl text-xs"
              >
                Authorize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT DONE FORM */}
      {payoutModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100">
                Payment Done Form — Record Manual Bank Transfer
              </h3>
              <button onClick={() => setPayoutModalBooking(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div>Booking Code: <strong className="text-amber-400">{payoutModalBooking.bookingCode}</strong></div>
              <div>Companion: <strong>{payoutModalBooking.companionName}</strong></div>
              <div>Amount to Disburse: <strong className="text-emerald-400 font-bold">₹{(payoutModalBooking.companionNetSharePaise / 100).toFixed(2)}</strong></div>
            </div>

            {payoutError && (
              <div className="p-2 rounded bg-red-500/10 text-red-300 text-xs">
                {payoutError}
              </div>
            )}

            <form onSubmit={handleProcessPayout} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Bank UTR Transaction Number *
                </label>
                <input
                  type="text"
                  value={utrInput}
                  onChange={e => setUtrInput(e.target.value.toUpperCase())}
                  placeholder="e.g. UTR192837465201"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Verified Admin Session ID
                </label>
                <input
                  type="text"
                  value={admin.email}
                  disabled
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={payoutLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-slate-950 font-bold text-xs"
              >
                {payoutLoading ? 'Committing Atomic Ledger Debit...' : 'Confirm Manual Bank Payout'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* USER MODERATION MODAL (WARN / SUSPEND / UNSUSPEND WITH PRESETS) */}
      {moderationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  User Moderation & Safety Enforcement
                </h3>
              </div>
              <button
                onClick={() => setModerationModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target User Info */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-100 text-sm block">{moderationModal.user.name}</span>
                <span className="text-slate-400 font-mono text-[11px]">{moderationModal.user.phone || 'No phone'} • {moderationModal.user.role || 'User'}</span>
              </div>
              <div className="text-right">
                {moderationModal.user.isSuspended ? (
                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    SUSPENDED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-500/20 text-emerald-400">
                    ACTIVE {moderationModal.user.warningCount ? `(${moderationModal.user.warningCount} Warnings)` : ''}
                  </span>
                )}
              </div>
            </div>

            {moderationFeedback && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                moderationFeedback.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {moderationFeedback.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{moderationFeedback.message}</span>
              </div>
            )}

            {/* Action Picker Tabs */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Select Enforcement Action:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setModerationAction('WARN'); setModerationReason(''); }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    moderationAction === 'WARN'
                      ? 'bg-amber-400 text-slate-950 shadow-md'
                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Issue Warning</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setModerationAction('SUSPEND'); setModerationReason(''); }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    moderationAction === 'SUSPEND'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Suspend Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setModerationAction('UNSUSPEND'); setModerationReason('Account restored by administration.'); }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    moderationAction === 'UNSUSPEND'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Lift Suspension</span>
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            {moderationAction !== 'UNSUSPEND' && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase">
                  Quick Select Reason (click to apply):
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  {(moderationAction === 'WARN' ? [
                    'Abusive language / Misconduct in chat',
                    'Late arrival or unresponsiveness',
                    'Soliciting off-platform payment',
                    'Inappropriate profile bio or photos',
                    'Violation of community safety guidelines',
                    'Unverified contact details sharing'
                  ] : [
                    'Severe misconduct / harassment reported',
                    'Fraudulent payment or identity issue',
                    'Repeated safety guideline violations',
                    'Extortion or unauthorized commercial activity',
                    'Multiple verified incident complaints',
                    'Terms of service non-compliance'
                  ]).map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setModerationReason(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                        moderationReason === preset
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reason Textarea */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase">
                {moderationAction === 'UNSUSPEND' ? 'Restoration Notes' : 'Specific Reason / Notice Text (editable):'}
              </label>
              <textarea
                value={moderationReason}
                onChange={e => setModerationReason(e.target.value)}
                rows={3}
                placeholder={
                  moderationAction === 'WARN'
                    ? 'Enter warning reason that the user will see in their notification...'
                    : moderationAction === 'SUSPEND'
                      ? 'Enter detailed reason for suspension...'
                      : 'Optional notes for audit logs...'
                }
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-400 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModerationModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUserModeration}
                disabled={moderationLoading || (moderationAction !== 'UNSUSPEND' && !moderationReason.trim())}
                className={`px-5 py-2 rounded-xl font-bold text-xs transition disabled:opacity-50 cursor-pointer ${
                  moderationAction === 'WARN'
                    ? 'bg-amber-400 hover:bg-amber-500 text-slate-950'
                    : moderationAction === 'SUSPEND'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                }`}
              >
                {moderationLoading ? 'Processing...' : (
                  moderationAction === 'WARN' ? 'Confirm & Send Warning' :
                  moderationAction === 'SUSPEND' ? 'Confirm & Suspend User' :
                  'Lift Suspension Now'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

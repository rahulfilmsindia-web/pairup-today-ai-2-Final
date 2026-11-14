import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { AdminRole, KYCStatus } from '../types';
import { apiFetch } from '../utils/api';
import { 
  ShieldAlert, Lock, KeyRound, CheckCircle, AlertCircle, 
  Users, DollarSign, FileCheck, Shield, Eye, EyeOff, 
  Search, RefreshCw, Send, Check, X, LogOut, ChevronRight,
  UserCheck, CreditCard, Calendar, Clock, Sliders, Settings,
  CheckCircle2, AlertTriangle, FileText, Landmark
} from 'lucide-react';

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

  // 16 Admin Modules (Support Center added)
  type AdminModule =
    | 'overview'
    | 'clients'
    | 'companions'
    | 'client-kyc'
    | 'companion-kyc'
    | 'pending-approvals'
    | 'approved-rejected'
    | 'memberships'
    | 'bookings'
    | 'payments'
    | 'finance'
    | 'manual-payout'
    | 'support'
    | 'audit'
    | 'staff'
    | 'security';

  const [currentSection, setCurrentSection] = useState<AdminModule>('overview');

  // Overview stats
  const [stats, setStats] = useState<any | null>(null);

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
  const [paymentsList, setPaymentsList] = useState<any[]>([]);

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

  // Fetch all admin data
  const loadAdminData = async () => {
    if (!isAdminAuthenticated || !adminToken) return;
    const authHeaders = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };
    try {
      const [
        resOverview, resClientsKyc, resCompsKyc, resFin, resStaff, resLogs,
        resClients, resComps, resMems, resBks, resPays, resSupport
      ] = await Promise.all([
        apiFetch('/api/admin/overview', { headers: authHeaders }),
        apiFetch('/api/admin/kyc/list?userType=CLIENT', { headers: authHeaders }),
        apiFetch('/api/admin/kyc/list?userType=COMPANION', { headers: authHeaders }),
        apiFetch('/api/admin/finance/settlements', { headers: authHeaders }),
        apiFetch('/api/admin/staff', { headers: authHeaders }),
        apiFetch('/api/admin/audit-logs', { headers: authHeaders }),
        apiFetch('/api/admin/clients', { headers: authHeaders }),
        apiFetch('/api/admin/companions', { headers: authHeaders }),
        apiFetch('/api/admin/memberships', { headers: authHeaders }),
        apiFetch('/api/admin/bookings', { headers: authHeaders }),
        apiFetch('/api/admin/payments', { headers: authHeaders }),
        apiFetch('/api/admin/support/conversations', { headers: authHeaders })
      ]);

      if (resOverview.ok) setStats(await resOverview.json());
      if (resClientsKyc.ok) {
        const d = await resClientsKyc.json();
        setClientKycs(d.submissions || []);
      }
      if (resCompsKyc.ok) {
        const d = await resCompsKyc.json();
        setCompanionKycs(d.submissions || []);
      }
      if (resFin.ok) {
        const d = await resFin.json();
        setSettlements(d.settlements || []);
      }
      if (resStaff.ok) {
        const d = await resStaff.json();
        setStaffList(d.staff || []);
      }
      if (resLogs.ok) {
        const d = await resLogs.json();
        setAuditLogs(d.logs || []);
      }
      if (resClients.ok) {
        const d = await resClients.json();
        setClientsList(d.clients || []);
      }
      if (resComps.ok) {
        const d = await resComps.json();
        setCompanionsList(d.companions || []);
      }
      if (resMems.ok) {
        const d = await resMems.json();
        setMembershipsList(d.memberships || []);
      }
      if (resBks.ok) {
        const d = await resBks.json();
        setBookingsList(d.bookings || []);
      }
      if (resPays.ok) {
        const d = await resPays.json();
        setPaymentsList(d.payments || []);
      }
      if (resSupport.ok) {
        const d = await resSupport.json();
        setSupportConversations(d.conversations || []);
      }
    } catch (err) {
      console.error('Error fetching admin data', err);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      loadAdminData();
      const interval = setInterval(loadAdminData, 8000);
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
            onClick={loadAdminData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
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
        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Select Admin Module:</label>
        <select
          value={currentSection}
          onChange={e => setCurrentSection(e.target.value as AdminModule)}
          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400"
        >
          <option value="overview">Overview</option>
          <option value="clients">Client Management ({clientsList.length})</option>
          <option value="companions">Companion Management ({companionsList.length})</option>
          <option value="client-kyc">Client Documents / KYC ({clientKycs.length})</option>
          <option value="companion-kyc">Companion Documents / KYC ({companionKycs.length})</option>
          <option value="pending-approvals">Pending Approvals ({pendingApprovals.length})</option>
          <option value="approved-rejected">Approved / Rejected Records ({decidedRecords.length})</option>
          <option value="memberships">Membership Records ({membershipsList.length})</option>
          <option value="bookings">Booking Management ({bookingsList.length})</option>
          <option value="payments">Payment Records ({paymentsList.length})</option>
          <option value="finance">Finance & Settlement</option>
          <option value="manual-payout">Manual Payout</option>
          <option value="audit">Audit Logs</option>
          {admin.role === 'SUPER_ADMIN' && <option value="staff">Staff Management (Super Admin)</option>}
          <option value="security">Security Settings</option>
        </select>
      </div>

      {/* Main Admin Body */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        
        {/* Sidebar Nav: All 15 Explicit Modules per Section 11 (Desktop) */}
        <aside className="hidden md:block w-64 bg-slate-900/60 border-r border-slate-800 p-4 space-y-1 text-xs font-semibold overflow-y-auto shrink-0">
          <button
            onClick={() => setCurrentSection('overview')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
              currentSection === 'overview' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Overview</span>
          </button>

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

          <button
            onClick={() => setCurrentSection('finance')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
              currentSection === 'finance' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>Finance & Settlement</span>
          </button>

          <button
            onClick={() => setCurrentSection('manual-payout')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
              currentSection === 'manual-payout' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Manual Payout</span>
          </button>

          <button
            onClick={() => setCurrentSection('audit')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
              currentSection === 'audit' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Audit Logs</span>
          </button>

          {admin.role === 'SUPER_ADMIN' && (
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

          <button
            onClick={() => setCurrentSection('security')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
              currentSection === 'security' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Security Settings</span>
          </button>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          
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

          {/* 2. CLIENT MANAGEMENT */}
          {currentSection === 'clients' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100">Client Management</h2>
              <p className="text-xs text-slate-400">All registered clients on PairUpToday. Client membership is strictly 100% Free.</p>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Client Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">City</th>
                      <th className="p-3">KYC Status</th>
                      <th className="p-3">Total Bookings</th>
                      <th className="p-3">Membership Fee</th>
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
                        <td className="p-3 font-mono">{c.totalBookings || 0}</td>
                        <td className="p-3 text-emerald-400 font-bold">FREE (₹0)</td>
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
                      <th className="p-3">Gate 1: KYC</th>
                      <th className="p-3">Gate 2: Membership</th>
                      <th className="p-3">Gate 3: Bank</th>
                      <th className="p-3">Total Settled</th>
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
                        <td className="p-3">{c.kycStatus === 'APPROVED' ? '✓ Approved' : 'Pending'}</td>
                        <td className="p-3">{c.membershipActive ? `✓ ${c.membershipTier}` : 'No Plan'}</td>
                        <td className="p-3">{c.bankVerified ? '✓ Verified' : 'Unverified'}</td>
                        <td className="p-3 font-bold text-emerald-400">₹{(c.totalSettledPaise / 100).toFixed(2)}</td>
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
                    {membershipsList.map(m => (
                      <tr key={m.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-amber-400">{m.id}</td>
                        <td className="p-3 font-bold text-slate-200">{m.userName}</td>
                        <td className="p-3 font-semibold text-pink-400">{m.plan}</td>
                        <td className="p-3 font-bold text-emerald-400">₹{(m.pricePaise / 100).toFixed(2)}</td>
                        <td className="p-3 font-mono text-slate-400">{new Date(m.startDate).toLocaleDateString()}</td>
                        <td className="p-3 font-mono text-slate-400">{new Date(m.expiryDate).toLocaleDateString()}</td>
                        <td className="p-3">{m.isActive ? '✓ Active' : 'Expired'}</td>
                      </tr>
                    ))}
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

          {/* 10. PAYMENT RECORDS */}
          {currentSection === 'payments' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100">Payment Records & Escrow Ledger</h2>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Payment ID</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Payer</th>
                      <th className="p-3">Recipient</th>
                      <th className="p-3">Gross Amount</th>
                      <th className="p-3">Admin Fee (15%)</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {paymentsList.map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-amber-400">{p.id}</td>
                        <td className="p-3">{p.type}</td>
                        <td className="p-3 font-semibold text-slate-200">{p.payerName}</td>
                        <td className="p-3 text-slate-300">{p.recipientName}</td>
                        <td className="p-3 font-bold text-emerald-400">₹{(p.grossAmountPaise / 100).toFixed(2)}</td>
                        <td className="p-3 text-amber-400">₹{(p.adminFeePaise / 100).toFixed(2)}</td>
                        <td className="p-3 font-bold text-emerald-400">{p.status}</td>
                      </tr>
                    ))}
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
                      <th className="p-3">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {staffList.map(s => (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-200">{s.name}</td>
                        <td className="p-3 font-mono">{s.email}</td>
                        <td className="p-3 font-mono text-slate-400">{s.phone}</td>
                        <td className="p-3 font-semibold text-amber-300">{s.role}</td>
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
              <input
                type="text"
                value={rejectionReasonInput}
                onChange={e => setRejectionReasonInput(e.target.value)}
                placeholder="e.g. Identity photo does not match live selfie"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
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

    </div>
  );
};

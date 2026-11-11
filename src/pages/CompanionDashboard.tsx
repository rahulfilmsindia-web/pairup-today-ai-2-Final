import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PAIRUP_SERVICES } from '../constants/services';
import { MembershipPlanType } from '../types';
import { 
  Sparkles, ShieldCheck, CheckCircle2, Clock, AlertCircle, 
  CreditCard, Landmark, Wallet, Play, Check, ChevronRight, 
  MessageSquare, Navigation, AlertTriangle, PhoneCall, RefreshCw, X,
  User, Calendar, DollarSign, Bell, Settings, LifeBuoy, LogOut,
  Pause, Power, Shield, FileText, CheckSquare, Star
} from 'lucide-react';

export const CompanionDashboard: React.FC = () => {
  const { user, refreshUserData, logout } = useAuth();
  const { t } = useLanguage();

  // Complete Visible Navigation Tabs per Section 8
  type CompanionTab =
    | 'overview'
    | 'profile'
    | 'kyc-status'
    | 'services'
    | 'rates'
    | 'availability'
    | 'membership'
    | 'bank'
    | 'requests'
    | 'upcoming'
    | 'history'
    | 'chat'
    | 'wallet'
    | 'locked-earnings'
    | 'notifications'
    | 'help-safety'
    | 'settings';

  const [activeTab, setActiveTab] = useState<CompanionTab>('overview');
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<any | null>(null);

  // Step A: Services & Rates state
  const [selectedServices, setSelectedServices] = useState<number[]>([1, 2, 4, 6]);
  const [hourlyRate, setHourlyRate] = useState(499);
  const [halfDayRate, setHalfDayRate] = useState(1699);
  const [fullDayRate, setFullDayRate] = useState(2999);
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('21:00');
  const [isAvailabilityPaused, setIsAvailabilityPaused] = useState(false);

  // Step B: Membership state
  const [subscribingPlan, setSubscribingPlan] = useState<MembershipPlanType | null>(null);

  // Step C: Bank Verification state
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolderName, setAccountHolderName] = useState(user?.legalName || '');
  const [bankName, setBankName] = useState('State Bank of India');
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bankMsg, setBankMsg] = useState<string | null>(null);

  // Bookings state
  const [bookings, setBookings] = useState<any[]>([]);
  const [startOtpInputs, setStartOtpInputs] = useState<Record<string, string>>({});
  const [delayMinutesInputs, setDelayMinutesInputs] = useState<Record<string, number>>({});
  const [endOtpInputs, setEndOtpInputs] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Active chat state
  const [activeChatBooking, setActiveChatBooking] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatText, setNewChatText] = useState('');

  const fetchCompanionStatus = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/companion/status/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
        if (data.profile) {
          setSelectedServices(data.profile.services || [1, 2]);
          setIsAvailabilityPaused(Boolean(data.profile.isPaused));
          if (data.profile.rates) {
            setHourlyRate(data.profile.rates.hourlyPaise / 100);
            setHalfDayRate(data.profile.rates.halfDayPaise / 100);
            setFullDayRate(data.profile.rates.fullDayPaise / 100);
          }
          if (data.profile.availability) {
            setSelectedDays(data.profile.availability.days || []);
            setStartTime(data.profile.availability.startTime || '09:00');
            setEndTime(data.profile.availability.endTime || '21:00');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load companion status', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/bookings/my/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch (err) {
      console.error('Failed to load bookings', err);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/notifications/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  useEffect(() => {
    fetchCompanionStatus();
    fetchBookings();
    fetchNotifications();
    const interval = setInterval(() => {
      fetchBookings();
      fetchNotifications();
    }, 6000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle chat messages polling
  useEffect(() => {
    if (!activeChatBooking) return;
    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/chat/${activeChatBooking.id}`);
        if (res.ok) {
          const data = await res.json();
          setChatMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load chat', err);
      }
    };
    fetchChat();
    const chatInterval = setInterval(fetchChat, 4000);
    return () => clearInterval(chatInterval);
  }, [activeChatBooking]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatBooking || !newChatText.trim() || !user) return;

    try {
      const res = await fetch(`/api/chat/${activeChatBooking.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          message: newChatText.trim()
        })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, data.message]);
        setNewChatText('');
      }
    } catch (err) {
      console.error('Failed to post message', err);
    }
  };

  // Step A: Save Services & Rates
  const handleSaveServicesAndRates = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/companion/services-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          services: selectedServices,
          rates: {
            hourlyPaise: hourlyRate * 100,
            halfDayPaise: halfDayRate * 100,
            fullDayPaise: fullDayRate * 100
          },
          availability: {
            days: selectedDays,
            startTime,
            endTime
          }
        })
      });
      if (res.ok) {
        fetchCompanionStatus();
        setActionMsg('Services, rates and availability schedule updated successfully.');
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error saving services', err);
    }
  };

  // Step B: Membership subscription (Authoritative: STARTER ₹449, PROFESSIONAL ₹1,099, PREMIUM ₹5,999)
  const handleSubscribePlan = async (plan: MembershipPlanType) => {
    if (!user) return;
    setSubscribingPlan(plan);
    try {
      const res = await fetch('/api/companion/membership/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, plan })
      });
      if (res.ok) {
        fetchCompanionStatus();
        setActionMsg(`${plan} membership activated successfully via PairUp Secure Vault!`);
        setTimeout(() => setActionMsg(null), 3500);
      }
    } catch (err) {
      console.error('Error subscribing', err);
    } finally {
      setSubscribingPlan(null);
    }
  };

  // Step C: Bank Verification
  const handleVerifyBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBankSubmitting(true);
    setBankMsg(null);
    try {
      const res = await fetch('/api/companion/bank/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          accountNumber,
          ifsc,
          accountHolderName,
          bankName
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBankMsg('Bank account verified successfully by PairUp Verified Network.');
        fetchCompanionStatus();
      } else {
        setBankMsg(data.error || 'Bank verification failed.');
      }
    } catch (err: any) {
      setBankMsg(err.message || 'Network error during bank verification.');
    } finally {
      setBankSubmitting(false);
    }
  };

  // Toggle Pause/Resume Availability
  const handleToggleAvailabilityPause = async () => {
    if (!user) return;
    try {
      const nextPaused = !isAvailabilityPaused;
      const res = await fetch('/api/companion/availability/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, isPaused: nextPaused })
      });
      if (res.ok) {
        setIsAvailabilityPaused(nextPaused);
        setActionMsg(nextPaused ? 'Availability paused. You will not receive new booking requests.' : 'Availability resumed. You are active for new bookings.');
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error toggling availability pause', err);
    }
  };

  // MEETING ARRIVED slide action
  const handleSlideMeetingArrived = async (bookingId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}/arrived`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId: user.id })
      });
      if (res.ok) {
        fetchBookings();
        setActionMsg('Arrival recorded! 6-digit Start OTP dispatched to Client.');
        setTimeout(() => setActionMsg(null), 4000);
      }
    } catch (err) {
      console.error('Error marking arrival', err);
    }
  };

  // VERIFY START OTP (Companion enters OTP told by Client)
  const handleVerifyStartOtp = async (bookingId: string) => {
    const otp = startOtpInputs[bookingId];
    const delay = delayMinutesInputs[bookingId] || 0;
    if (!otp || otp.length !== 6) {
      alert('Please enter the exact 6-digit Start OTP from the Client.');
      return;
    }

    try {
      const res = await fetch(`/api/bookings/${bookingId}/verify-start-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp, delayMinutes: delay })
      });
      const data = await res.json();
      if (res.ok) {
        fetchBookings();
        setActionMsg('Meeting Start verified! Official session countdown active.');
        setTimeout(() => setActionMsg(null), 3000);
      } else {
        alert(data.error || 'Failed to verify Start OTP.');
      }
    } catch (err) {
      console.error('Error verifying start otp', err);
    }
  };

  // COMPLETE BOOKING WITH FINAL OTP (Companion enters Completion OTP told by Client)
  const handleCompleteBooking = async (bookingId: string) => {
    const completionOtp = endOtpInputs[bookingId];
    if (!completionOtp || completionOtp.length !== 6) {
      alert('Please enter the exact 6-digit Completion OTP from the Client.');
      return;
    }

    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completionOtp })
      });
      const data = await res.json();
      if (res.ok) {
        fetchBookings();
        fetchCompanionStatus();
        setActionMsg('Booking completed! 85% companion share locked under 48-hour UTC hold.');
        setTimeout(() => setActionMsg(null), 4000);
      } else {
        alert(data.error || 'Failed to complete booking.');
      }
    } catch (err) {
      console.error('Error completing booking', err);
    }
  };

  const isLive = statusData?.isLive;
  const conditions = statusData?.conditions || {
    kycApproved: user?.kycStatus === 'APPROVED',
    membershipValid: Boolean(statusData?.profile?.membership?.isActive),
    bankVerified: Boolean(statusData?.profile?.bankDetails?.isVerified)
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Bookings breakdown
  const upcomingBookings = bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'COMPANION_ARRIVED' || b.status === 'IN_PROGRESS');
  const pastBookings = bookings.filter(b => b.status === 'COMPLETED' || b.status === 'CANCELLED');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header Card */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={user?.profilePhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'}
                alt={user?.legalName}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-pink-500"
              />
              <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ring-2 ring-slate-900 ${isLive ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'}`} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-100">
                  {user?.legalName || 'Companion Host'}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/30 font-semibold">
                  Companion Host
                </span>
                {isAvailabilityPaused && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                    PAUSED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {user?.phone} · Region: {user?.city || 'India'}
              </p>
            </div>
          </div>

          {/* EXACT 3 ACTIVATION GATES BADGES (SECTION 8) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
              conditions.kycApproved
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {conditions.kycApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              <span>1. KYC: {conditions.kycApproved ? 'APPROVED' : 'PENDING'}</span>
            </div>

            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
              conditions.membershipValid
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {conditions.membershipValid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>2. MEMBERSHIP: {conditions.membershipValid ? 'PAID & VALID' : 'INACTIVE'}</span>
            </div>

            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
              conditions.bankVerified
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {conditions.bankVerified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>3. BANK: {conditions.bankVerified ? 'VERIFIED' : 'UNVERIFIED'}</span>
            </div>
          </div>
        </div>

        {/* Global Action Banner */}
        {actionMsg && (
          <div className="p-3.5 rounded-xl bg-pink-500/10 border border-pink-500/30 text-xs text-pink-300 flex items-center justify-between">
            <span>{actionMsg}</span>
            <button onClick={() => setActionMsg(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* 18 Visible Navigation Tabs Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 overflow-x-auto shadow-lg scrollbar-none">
          <div className="flex items-center gap-1.5 min-w-max text-xs font-medium">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'overview' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'profile' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>My Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('kyc-status')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'kyc-status' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>KYC Status</span>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'services' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Service Management</span>
            </button>

            <button
              onClick={() => setActiveTab('rates')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'rates' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Rate Management</span>
            </button>

            <button
              onClick={() => setActiveTab('availability')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'availability' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Availability Calendar</span>
            </button>

            <button
              onClick={() => setActiveTab('membership')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'membership' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Membership</span>
            </button>

            <button
              onClick={() => setActiveTab('bank')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'bank' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Bank Verification</span>
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'requests' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Booking Requests ({upcomingBookings.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'upcoming' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Upcoming Sessions</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'history' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Booking History ({pastBookings.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'chat' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Secure Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('wallet')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'wallet' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Secure Wallet</span>
            </button>

            <button
              onClick={() => setActiveTab('locked-earnings')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'locked-earnings' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Locked Earnings (48h UTC)</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'notifications' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notifications</span>
            </button>

            <button
              onClick={() => setActiveTab('help-safety')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'help-safety' ? 'bg-rose-500 text-slate-950 font-bold shadow' : 'text-rose-300 hover:bg-rose-950/40'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Help & Safety</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'settings' ? 'bg-pink-600 text-white font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>

            <button
              onClick={handleToggleAvailabilityPause}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 font-bold ${
                isAvailabilityPaused ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
              }`}
            >
              {isAvailabilityPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isAvailabilityPaused ? 'Resume Availability' : 'Pause Availability'}</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm('Log out of PairUpToday Companion portal?')) {
                  logout();
                }
              }}
              className="px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-xs">Platform Status</span>
                <div className={`text-xl font-bold mt-1 ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isLive ? 'LIVE & AVAILABLE' : 'ONBOARDING INCOMPLETE'}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">3 Activation Gates Required</span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-xs">Locked Settlement (48h UTC)</span>
                <div className="text-2xl font-bold text-amber-400 mt-1">
                  ₹{((statusData?.wallet?.lockedSettlementBalancePaise || 0) / 100).toFixed(2)}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Auto-unlocks after safety hold</span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-xs">Total Settled Earnings</span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  ₹{((statusData?.wallet?.totalSettledPaise || 0) / 100).toFixed(2)}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Disbursed via bank transfer</span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-xs">Completed Sessions</span>
                <div className="text-2xl font-bold text-slate-100 mt-1">
                  {statusData?.profile?.totalBookings || pastBookings.length}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Rating: ★ {statusData?.profile?.rating || '5.0'}</span>
              </div>
            </div>

            {/* Missing Condition Action Cards if not live */}
            {!isLive && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Action Required to Go LIVE
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className={`p-4 rounded-xl border ${conditions.kycApproved ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-950 border-amber-500/30'}`}>
                    <span className="font-bold text-slate-200 block mb-1">Gate 1: KYC Approval</span>
                    <p className="text-slate-400 mb-3">{conditions.kycApproved ? 'Approved by Admin ✓' : 'Govt ID & selfie currently in audit.'}</p>
                    <button onClick={() => setActiveTab('kyc-status')} className="text-pink-400 font-semibold hover:underline">View KYC Status →</button>
                  </div>

                  <div className={`p-4 rounded-xl border ${conditions.membershipValid ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-950 border-rose-500/30'}`}>
                    <span className="font-bold text-slate-200 block mb-1">Gate 2: Active Membership</span>
                    <p className="text-slate-400 mb-3">{conditions.membershipValid ? 'Membership active & valid ✓' : 'Subscribe to Starter, Pro, or Premium.'}</p>
                    <button onClick={() => setActiveTab('membership')} className="text-pink-400 font-semibold hover:underline">Choose Membership →</button>
                  </div>

                  <div className={`p-4 rounded-xl border ${conditions.bankVerified ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-950 border-rose-500/30'}`}>
                    <span className="font-bold text-slate-200 block mb-1">Gate 3: Bank Verification</span>
                    <p className="text-slate-400 mb-3">{conditions.bankVerified ? 'Bank verified & ready for payouts ✓' : 'Submit Account No & IFSC for verification.'}</p>
                    <button onClick={() => setActiveTab('bank')} className="text-pink-400 font-semibold hover:underline">Verify Bank Account →</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY PROFILE */}
        {activeTab === 'profile' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-100">Companion Host Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">Legal Name</span>
                <span className="text-sm font-bold text-slate-200">{user?.legalName}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">Registered Phone</span>
                <span className="text-sm font-bold text-slate-200">{user?.phone}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">City Region</span>
                <span className="text-sm font-bold text-slate-200">{user?.city || 'India'}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">Date of Birth (Locked at KYC)</span>
                <span className="text-sm font-bold text-slate-200">{user?.dob || 'Verified at KYC'} ({user?.age || 26} yrs)</span>
              </div>
              <div className="md:col-span-2 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">Bio / Companion Intro</span>
                <p className="text-slate-300 leading-relaxed">{user?.bio || 'Passionate companion host offering city tours, cafe companionship, and friendly conversation.'}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: KYC STATUS */}
        {activeTab === 'kyc-status' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-pink-400" />
              Government KYC Verification
            </h3>
            <div className={`p-4 rounded-xl border ${conditions.kycApproved ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' : 'bg-amber-950/20 border-amber-500/30 text-amber-300'}`}>
              <span className="font-bold block mb-1">
                Status: {conditions.kycApproved ? 'APPROVED ✓' : 'UNDER AUDIT'}
              </span>
              <p className="text-slate-300">
                {conditions.kycApproved 
                  ? 'Your identity documents and live selfie are fully approved by PairUp Security Network.' 
                  : 'Your submission is undergoing security inspection. Approval typically takes 24-48 hours.'}
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: SERVICE MANAGEMENT */}
        {activeTab === 'services' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100">Select Companionship Services</h3>
                <p className="text-slate-400 text-xs">Check all services you are willing to host.</p>
              </div>
              <button
                onClick={handleSaveServicesAndRates}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl"
              >
                Save Services
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PAIRUP_SERVICES.map(s => {
                const isSelected = selectedServices.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedServices(selectedServices.filter(id => id !== s.id));
                      } else {
                        setSelectedServices([...selectedServices, s.id]);
                      }
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-pink-950/30 border-pink-500 text-slate-100' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs mb-1">
                      <span>{s.id}. {s.name}</span>
                      <input type="checkbox" checked={isSelected} readOnly className="accent-pink-500" />
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{s.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: RATE MANAGEMENT */}
        {activeTab === 'rates' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-xs">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Set Your Hourly & Daily Pricing
            </h3>
            <p className="text-slate-400">Clients book your time according to these transparent rates. 85% companion gross share applies to all completed sessions.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <label className="block text-slate-400 font-semibold mb-1">Hourly Rate (₹)</label>
                <input
                  type="number"
                  min={300}
                  max={5000}
                  value={hourlyRate}
                  onChange={e => setHourlyRate(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-400 font-bold text-sm"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Your 85% gross share: ₹{Math.round(hourlyRate * 0.85)}/hr</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <label className="block text-slate-400 font-semibold mb-1">Half-Day Rate (4 Hours) (₹)</label>
                <input
                  type="number"
                  min={1000}
                  max={15000}
                  value={halfDayRate}
                  onChange={e => setHalfDayRate(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-400 font-bold text-sm"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Your 85% gross share: ₹{Math.round(halfDayRate * 0.85)}</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <label className="block text-slate-400 font-semibold mb-1">Full-Day Rate (8 Hours) (₹)</label>
                <input
                  type="number"
                  min={2000}
                  max={30000}
                  value={fullDayRate}
                  onChange={e => setFullDayRate(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-400 font-bold text-sm"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Your 85% gross share: ₹{Math.round(fullDayRate * 0.85)}</span>
              </div>
            </div>

            <button
              onClick={handleSaveServicesAndRates}
              className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl"
            >
              Update Pricing
            </button>
          </div>
        )}

        {/* TAB 6: AVAILABILITY CALENDAR */}
        {activeTab === 'availability' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-sky-400" />
                  Weekly Availability Schedule
                </h3>
                <p className="text-slate-400 mt-0.5">Select days and hours you are available. Overlapping bookings are prevented automatically.</p>
              </div>
              <button
                onClick={handleToggleAvailabilityPause}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 ${
                  isAvailabilityPaused ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {isAvailabilityPaused ? 'Resume Availability' : 'Pause Availability'}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block font-semibold text-slate-300">Available Days of the Week</label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map(day => {
                  const isDaySelected = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        if (isDaySelected) {
                          setSelectedDays(selectedDays.filter(d => d !== day));
                        } else {
                          setSelectedDays([...selectedDays, day]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        isDaySelected ? 'bg-pink-600 border-pink-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="block text-slate-400 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                />
              </div>
            </div>

            <button
              onClick={handleSaveServicesAndRates}
              className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl"
            >
              Save Schedule
            </button>
          </div>
        )}

        {/* TAB 7: MEMBERSHIP */}
        {activeTab === 'membership' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-xs">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                Companion Membership Plans
              </h3>
              <p className="text-slate-400 mt-0.5">Activation Gate 2: A valid paid membership is mandatory for companions to receive bookings.</p>
            </div>

            {/* Current Membership status banner */}
            {statusData?.profile?.membership?.isActive ? (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm block">Active Plan: {statusData.profile.membership.plan}</span>
                  <span className="text-[11px] text-slate-400">
                    Valid from {new Date(statusData.profile.membership.startDate).toLocaleDateString()} to {new Date(statusData.profile.membership.expiryDate).toLocaleDateString()}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold">Active ✓</span>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300">
                No active membership on record. Select a plan below to activate your hosting capabilities.
              </div>
            )}

            {/* Exact authoritative 3 plans */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* STARTER */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between hover:border-pink-500/50 transition-colors">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400">Starter</span>
                  <div className="text-2xl font-extrabold text-amber-400 my-2">₹449 <span className="text-xs font-normal text-slate-400">/ 1 month</span></div>
                  <p className="text-slate-400 text-[11px]">Ideal for beginning companion hosts. 30 days active hosting profile on PairUp Verified Network.</p>
                </div>
                <button
                  onClick={() => handleSubscribePlan('STARTER')}
                  disabled={subscribingPlan !== null}
                  className="mt-4 w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold"
                >
                  {subscribingPlan === 'STARTER' ? 'Processing...' : 'Subscribe STARTER'}
                </button>
              </div>

              {/* PROFESSIONAL */}
              <div className="p-5 rounded-2xl bg-slate-950 border-2 border-pink-500/60 flex flex-col justify-between shadow-lg shadow-pink-500/10">
                <div>
                  <span className="text-xs uppercase font-bold text-pink-400">Professional (Popular)</span>
                  <div className="text-2xl font-extrabold text-amber-400 my-2">₹1,099 <span className="text-xs font-normal text-slate-400">/ 3 months</span></div>
                  <p className="text-slate-400 text-[11px]">Best value for active hosts. 90 days active hosting with priority discovery placement.</p>
                </div>
                <button
                  onClick={() => handleSubscribePlan('PROFESSIONAL')}
                  disabled={subscribingPlan !== null}
                  className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-500 hover:to-rose-500 text-slate-950 font-extrabold"
                >
                  {subscribingPlan === 'PROFESSIONAL' ? 'Processing...' : 'Subscribe PROFESSIONAL'}
                </button>
              </div>

              {/* PREMIUM */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between hover:border-pink-500/50 transition-colors">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400">Premium</span>
                  <div className="text-2xl font-extrabold text-amber-400 my-2">₹5,999 <span className="text-xs font-normal text-slate-400">/ 1 year</span></div>
                  <p className="text-slate-400 text-[11px]">365 days unlimited hosting, VIP verification badge, zero platform renewal interruption.</p>
                </div>
                <button
                  onClick={() => handleSubscribePlan('PREMIUM')}
                  disabled={subscribingPlan !== null}
                  className="mt-4 w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold"
                >
                  {subscribingPlan === 'PREMIUM' ? 'Processing...' : 'Subscribe PREMIUM'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: BANK VERIFICATION */}
        {activeTab === 'bank' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-xs max-w-2xl">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-sky-400" />
                Bank Account Verification (Gate 3)
              </h3>
              <p className="text-slate-400 mt-0.5">Required for companion payouts. Verified through PairUp Verified Network.</p>
            </div>

            {statusData?.profile?.bankDetails?.isVerified && (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300">
                <span className="font-bold block mb-1">Bank Account Verified ✓</span>
                <span className="font-mono text-slate-300">
                  Account: {statusData.profile.bankDetails.accountNumberMasked} · IFSC: {statusData.profile.bankDetails.ifsc}
                </span>
              </div>
            )}

            {bankMsg && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
                {bankMsg}
              </div>
            )}

            <form onSubmit={handleVerifyBank} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1">Account Holder Legal Name</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={e => setAccountHolderName(e.target.value)}
                  placeholder="Full name as printed in passbook"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Bank Account Number</label>
                <input
                  type="password"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="Enter 9 to 18 digit bank account number"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Bank IFSC Code</label>
                <input
                  type="text"
                  value={ifsc}
                  onChange={e => setIfsc(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234, HDFC0001234"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={bankSubmitting}
                className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold"
              >
                {bankSubmitting ? 'Verifying Account...' : 'Submit Bank Verification'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 9: BOOKING REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-100">Pending & Confirmed Booking Requests</h3>
            {upcomingBookings.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
                No active booking requests currently waiting.
              </div>
            ) : (
              upcomingBookings.map(b => (
                <div key={b.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-100 block">{b.serviceName} ({b.bookingCode})</span>
                      <span className="text-slate-400">Client: {b.clientName} · Date: {b.date} ({b.startTime} - {b.endTime})</span>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-bold">{b.status}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span>Meeting Venue: <strong>{b.meetingLocation}</strong></span>
                    <span className="text-emerald-400 font-bold">Your Share: ₹{(b.companionNetSharePaise / 100).toFixed(2)}</span>
                  </div>

                  {b.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleSlideMeetingArrived(b.id)}
                      className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-500"
                    >
                      Slide: MEETING ARRIVED (Dispatch 6-Digit Start OTP)
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 10: UPCOMING SESSIONS (OTP VERIFICATION WORKFLOW) */}
        {activeTab === 'upcoming' && (
          <div className="space-y-6 text-xs">
            <h3 className="text-base font-bold text-slate-100">Live Meeting Execution & OTP Verification</h3>
            {upcomingBookings.map(b => (
              <div key={b.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-100 text-sm block">{b.serviceName} ({b.bookingCode})</span>
                    <span className="text-slate-400">Meeting with {b.clientName} · Venue: {b.meetingLocation}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 font-bold">{b.status}</span>
                </div>

                {/* 0. ARRIVAL TRIGGER (If still in CONFIRMED status) */}
                {b.status === 'CONFIRMED' && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                    <span className="text-xs text-amber-300">
                      Have you arrived at the venue? Confirm arrival to dispatch the 6-digit Start OTP to the client.
                    </span>
                    <button
                      onClick={() => handleSlideMeetingArrived(b.id)}
                      className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-500 shrink-0 text-xs"
                    >
                      Confirm Arrival
                    </button>
                  </div>
                )}

                {/* 1. START OTP INPUT FORM */}
                {!b.startOtpVerified && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3">
                    <span className="font-bold text-amber-300 block">Step 1: Verify Start OTP</span>
                    <p className="text-slate-400 text-[11px]">
                      Ask the client for their 6-digit Start OTP when meeting in person. Enter it below to start the official session.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="6-digit Start OTP"
                        value={startOtpInputs[b.id] || ''}
                        onChange={e => setStartOtpInputs({ ...startOtpInputs, [b.id]: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-center font-mono font-bold text-amber-400 text-sm"
                      />
                      <input
                        type="number"
                        min={0}
                        max={180}
                        placeholder="Late delay mins (0 if on time)"
                        value={delayMinutesInputs[b.id] ?? ''}
                        onChange={e => setDelayMinutesInputs({ ...delayMinutesInputs, [b.id]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-center font-mono text-slate-200 text-xs"
                      />
                      <button
                        onClick={() => handleVerifyStartOtp(b.id)}
                        className="px-4 py-2 bg-amber-400 text-slate-950 font-bold rounded-xl text-xs hover:bg-amber-500 transition-colors"
                      >
                        Verify & Start
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. COMPLETION OTP INPUT FORM */}
                {b.startOtpVerified && !b.endOtpVerified && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
                    <span className="font-bold text-emerald-300 block">Step 2: Verify Completion OTP</span>
                    <p className="text-slate-400 text-[11px]">
                      At the end of the meeting, ask the client for the final 6-digit Completion OTP to lock your earnings.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="6-digit Completion OTP"
                        value={endOtpInputs[b.id] || ''}
                        onChange={e => setEndOtpInputs({ ...endOtpInputs, [b.id]: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-center font-mono font-bold text-emerald-400 text-sm"
                      />
                      <button
                        onClick={() => handleCompleteBooking(b.id)}
                        className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl"
                      >
                        Complete Session
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB 11: BOOKING HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-100">Past Completed Sessions</h3>
            {pastBookings.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
                No past bookings found.
              </div>
            ) : (
              pastBookings.map(b => (
                <div key={b.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-100 block">{b.serviceName} ({b.bookingCode})</span>
                    <span className="text-slate-400">Client: {b.clientName} · {b.date}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold block">Earned: ₹{(b.companionNetSharePaise / 100).toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500">Status: {b.settlementStatus}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 12: SECURE CHAT */}
        {activeTab === 'chat' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-pink-400" />
              Secure Client Chat Channels
            </h3>
            {bookings.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No active client chats.</div>
            ) : (
              <div className="space-y-2">
                {bookings.map(b => (
                  <div key={b.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-200 block">{b.clientName}</span>
                      <span className="text-slate-500">Booking {b.bookingCode} · {b.serviceName}</span>
                    </div>
                    <button
                      onClick={() => setActiveChatBooking(b)}
                      className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold"
                    >
                      Open Chat
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 13: SECURE WALLET */}
        {activeTab === 'wallet' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-xs">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              Companion Secure Wallet
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">Locked Safety Escrow (48h UTC)</span>
                <span className="text-xl font-bold text-amber-400">
                  ₹{((statusData?.wallet?.lockedSettlementBalancePaise || 0) / 100).toFixed(2)}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">Total Payouts Settled</span>
                <span className="text-xl font-bold text-emerald-400">
                  ₹{((statusData?.wallet?.totalSettledPaise || 0) / 100).toFixed(2)}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">Platform Share</span>
                <span className="text-xl font-bold text-slate-300">85% Net Share</span>
              </div>
            </div>

            <p className="text-slate-400 leading-relaxed">
              Payouts are disbursed directly into your verified bank account by Finance Administration via bank transfer with UTR tracking after the 48-hour safety hold elapses.
            </p>
          </div>
        )}

        {/* TAB 14: LOCKED EARNINGS (48H UTC) */}
        {activeTab === 'locked-earnings' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              48-Hour UTC Settlement Safety Hold Ledger
            </h3>
            <p className="text-slate-400">
              Each session's net earning is held securely under a 48-hour UTC lock to guarantee dispute-free settlement for both clients and companions.
            </p>
            {bookings.filter(b => b.status === 'COMPLETED').map(b => (
              <div key={b.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 block">{b.bookingCode} · {b.serviceName}</span>
                  <span className="text-slate-500 text-[11px]">Unlocks at: {b.settlementUnlockUtc ? new Date(b.settlementUnlockUtc).toUTCString() : 'Pending'}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-amber-400">₹{(b.companionNetSharePaise / 100).toFixed(2)}</span>
                  <span className="text-[10px] text-slate-500 block">{b.settlementStatus}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 15: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              Companion Host Notifications
            </h3>
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No new alerts.</div>
            ) : (
              <div className="space-y-2">
                {notifications.map(n => (
                  <div key={n.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="font-bold text-slate-200 block mb-0.5">{n.title}</span>
                    <p className="text-slate-400">{n.message}</p>
                    <span className="text-[10px] text-slate-600 mt-1 block font-mono">
                      {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 16: HELP & SAFETY */}
        {activeTab === 'help-safety' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-xs">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-400" />
              Host Safety & Emergency Hotlines
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a href="tel:100" className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-center hover:bg-rose-950/60 transition-colors">
                <span className="text-lg font-bold text-rose-400 block mb-1">Police: 100</span>
                <span className="text-slate-300">National Emergency Response</span>
              </a>
              <a href="tel:112" className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-center hover:bg-amber-950/60 transition-colors">
                <span className="text-lg font-bold text-amber-400 block mb-1">SOS: 112</span>
                <span className="text-slate-300">All-in-One Helpline</span>
              </a>
              <a href="tel:1091" className="p-4 rounded-xl bg-sky-950/40 border border-sky-500/30 text-center hover:bg-sky-950/60 transition-colors">
                <span className="text-lg font-bold text-sky-400 block mb-1">Helpline: 1091</span>
                <span className="text-slate-300">Women Host Safety Helpline</span>
              </a>
            </div>
          </div>
        )}

        {/* TAB 17: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-xs">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              Companion Host Preferences
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">Instant SMS Request Notifications</span>
                  <span className="text-slate-500 text-[11px]">Receive SMS whenever a client schedules a booking</span>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-pink-500" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">Availability Pause Toggle</span>
                  <span className="text-slate-500 text-[11px]">Temporarily stop receiving requests</span>
                </div>
                <button
                  onClick={handleToggleAvailabilityPause}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-bold hover:bg-slate-700"
                >
                  {isAvailabilityPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* SECURE CHAT DRAWER */}
      {activeChatBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 flex flex-col justify-between text-slate-100">
            
            {/* Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-100">
                  Secure Chat · {activeChatBooking.clientName}
                </h4>
                <p className="text-[10px] text-emerald-400">
                  Encrypted Session · Booking {activeChatBooking.bookingCode}
                </p>
              </div>
              <button
                onClick={() => setActiveChatBooking(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Body */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  No messages yet. Send a greeting to coordinate your meeting!
                </div>
              ) : (
                chatMessages.map(m => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.senderId === user?.id ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl text-xs ${
                        m.senderId === user?.id
                          ? 'bg-pink-600 text-white font-medium rounded-br-none'
                          : 'bg-slate-800 text-slate-200 rounded-bl-none'
                      }`}
                    >
                      <p>{m.message}</p>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 px-1">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={newChatText}
                onChange={e => setNewChatText(e.target.value)}
                placeholder="Type secure message..."
                className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-pink-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold text-xs"
              >
                Send
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

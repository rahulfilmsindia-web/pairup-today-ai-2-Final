import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';
import { openRazorpayCheckout } from '../utils/razorpay';
import { PAIRUP_SERVICES } from '../constants/services';
import { compressImageFile, compressBase64 } from '../utils/image';
import { MembershipPlanType } from '../types';
import { 
  Sparkles, ShieldCheck, CheckCircle2, CheckCircle, Clock, AlertCircle, 
  CreditCard, Landmark, Wallet, Play, Check, ChevronRight, ChevronLeft,
  MessageSquare, Navigation, AlertTriangle, PhoneCall, RefreshCw, X,
  User, Calendar, DollarSign, Bell, Settings, LifeBuoy, LogOut,
  Pause, Power, Shield, FileText, CheckSquare, Star, ArrowLeft,
  Upload, Lock, Trash2, Camera, ShieldAlert, MapPin, KeyRound, Menu, Heart, UserCheck, Home,
  TrendingUp, CalendarCheck
} from 'lucide-react';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { TimeframeFilter, TimeframeFilterBar, matchesTimeframe, formatFullDateTime } from '../utils/timeframeFilters';

const MeetingCountdown: React.FC<{ booking: any }> = ({ booking }) => {
  const alertedRef = useRef(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const started = new Date(booking?.startedAt || booking?.meetingStartedAt || booking?.updatedAt || Date.now()).getTime();
    const durationMs = (booking?.durationHours || 1) * 3600 * 1000;
    const end = started + durationMs;
    return Math.max(0, Math.floor((end - Date.now()) / 1000));
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const started = new Date(booking?.startedAt || booking?.meetingStartedAt || booking?.updatedAt || Date.now()).getTime();
      const durationMs = (booking?.durationHours || 1) * 3600 * 1000;
      const end = started + durationMs;
      const rem = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setSecondsRemaining(rem);
      if (rem === 0 && !alertedRef.current) {
        alertedRef.current = true;
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.6);
        } catch (e) {}
        triggerSystemNotification('⏰ Session Completed! Ask Client for Ending OTP', {
          body: 'Scheduled slot time finished. Collect the 6-digit Completion OTP from the client to claim your 85% earnings.'
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [booking?.startedAt, booking?.meetingStartedAt, booking?.updatedAt, booking?.durationHours]);

  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isFinished = secondsRemaining === 0;

  return (
    <div className={`p-4 rounded-xl border text-center space-y-1.5 ${isFinished ? 'bg-amber-500/10 border-amber-500/40' : 'bg-pink-500/10 border-pink-500/30'}`}>
      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
        {isFinished ? '⏰ Scheduled Slot Completed — Ready to End Session' : '⏱️ Official Meeting in Progress'}
      </span>
      <div className="font-mono text-2xl font-black text-pink-400">
        {timeFormatted}
      </div>
      <p className="text-[10px] text-slate-400">
        {isFinished 
          ? 'Slot duration reached. The Ending OTP has been unlocked on client’s dashboard and dispatched. Enter it below to complete and lock earnings.'
          : `Session active for ${booking.durationHours || 1} hour(s). Live synchronized countdown timer.`}
      </p>
    </div>
  );
};

// Safe system notification helper that never throws "Illegal constructor" on Android/Mobile Chrome
const triggerSystemNotification = (title: string, options?: any) => {
  try {
    if (typeof window === 'undefined') return;
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return;

    const notifOptions = {
      icon: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
      badge: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
      tag: options?.tag || 'incoming-booking-call',
      renotify: true,
      requireInteraction: true,
      silent: false,
      category: 'call',
      vibrate: [800, 300, 800, 300, 800],
      actions: [
        { action: 'open', title: '📞 ANSWER / VIEW' },
        { action: 'decline', title: '❌ DECLINE' }
      ],
      ...(options || {})
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const showViaSw = (reg: ServiceWorkerRegistration) => {
        if (reg && typeof reg.showNotification === 'function') {
          reg.showNotification(title, notifOptions).catch(() => {});
        }
      };
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          showViaSw(reg);
        } else {
          navigator.serviceWorker.ready.then(showViaSw).catch(() => {});
        }
      }).catch(() => {
        navigator.serviceWorker.ready.then(showViaSw).catch(() => {});
      });
      return;
    }
  } catch (err) {
    console.warn('System notification suppressed:', err);
  }
};

interface CompanionDashboardProps {
  onNavigateToPage?: (page: string) => void;
}

export const CompanionDashboard: React.FC<CompanionDashboardProps> = ({ onNavigateToPage }) => {
  const { user, activeRole, selectActiveRole, refreshUserData, logout, updateProfile, requestOtp, changePassword, deleteAccount, openKycWizard } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    if (user && activeRole !== 'COMPANION') {
      selectActiveRole('COMPANION').catch(() => {});
    }
  }, [user?.id]);

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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<any | null>(null);
  const hasAutoNavigatedRef = useRef(false);

  // In-app Back Navigation Handler (prevents unexpected page exits)
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const isMobileSidebarOpenRef = useRef(isMobileSidebarOpen);
  isMobileSidebarOpenRef.current = isMobileSidebarOpen;
  const activeChatBookingRef = useRef<any>(null);
  const reportModalOpenRef = useRef(false);

  useEffect(() => {
    const handleInAppEvent = (e: Event) => {
      if (reportModalOpenRef.current) {
        e.preventDefault();
        setReportModalOpen(false);
        return;
      }
      if (activeChatBookingRef.current) {
        e.preventDefault();
        setActiveChatBooking(null);
        return;
      }
      if (isMobileSidebarOpenRef.current) {
        e.preventDefault();
        setIsMobileSidebarOpen(false);
        return;
      }
      if (activeTabRef.current !== 'overview') {
        e.preventDefault();
        setActiveTab('overview');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('pairup:inapp_back', handleInAppEvent);
    return () => window.removeEventListener('pairup:inapp_back', handleInAppEvent);
  }, []);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (reportModalOpenRef.current) {
        setReportModalOpen(false);
        return;
      }
      if (activeChatBookingRef.current) {
        setActiveChatBooking(null);
        return;
      }
      if (isMobileSidebarOpenRef.current) {
        setIsMobileSidebarOpen(false);
        return;
      }
      if (activeTabRef.current !== 'overview') {
        setActiveTab('overview');
        window.history.pushState({ companionTab: 'overview' }, '', window.location.pathname);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Tab scroll ref for desktop Left/Right arrow navigation
  const tabsNavRef = useRef<HTMLDivElement>(null);
  const scrollTabs = (dir: 'left' | 'right') => {
    tabsNavRef.current?.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  };

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

  // Change Password state (Companion)
  const [cpOtpSent, setCpOtpSent] = useState(false);
  const [cpOtp, setCpOtp] = useState('');
  const [cpNewPassword, setCpNewPassword] = useState('');
  const [cpConfirmPassword, setCpConfirmPassword] = useState('');
  const [cpLoading, setCpLoading] = useState(false);
  const [cpMsg, setCpMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cpCountdown, setCpCountdown] = useState(0);

  // Delete Account state (Companion)
  const [daOtpSent, setDaOtpSent] = useState(false);
  const [daOtp, setDaOtp] = useState('');
  const [daConfirm, setDaConfirm] = useState(false);
  const [daLoading, setDaLoading] = useState(false);
  const [daMsg, setDaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [daCountdown, setDaCountdown] = useState(0);

  // Incident Report state (from Secure Chat)
  const [reportModalOpen, setReportModalOpen] = useState(false);
  reportModalOpenRef.current = reportModalOpen;
  const [reportBooking, setReportBooking] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const openReportModal = (booking: any) => {
    setReportBooking(booking);
    setReportReason('');
    setReportDetails('');
    setReportFeedback(null);
    setReportModalOpen(true);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportBooking) return;
    if (!reportReason) {
      setReportFeedback({ type: 'error', message: 'Please select a reason for the report.' });
      return;
    }
    if (!reportDetails || reportDetails.trim().length < 5) {
      setReportFeedback({ type: 'error', message: 'Please provide details of the incident (at least 5 characters).' });
      return;
    }
    setReportLoading(true);
    setReportFeedback(null);
    try {
      const res = await apiFetch('/api/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: reportBooking.id,
          reason: reportReason,
          details: reportDetails.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report.');
      }
      setReportFeedback({
        type: 'success',
        message: 'Your report has been submitted to the platform safety team. We will review this promptly and take necessary action.'
      });
      setTimeout(() => {
        setReportModalOpen(false);
        setReportFeedback(null);
        setReportReason('');
        setReportDetails('');
      }, 2500);
    } catch (err: any) {
      setReportFeedback({ type: 'error', message: err.message || 'Could not submit report.' });
    } finally {
      setReportLoading(false);
    }
  };

  // Countdown timers
  useEffect(() => {
    if (cpCountdown > 0) {
      const t = setTimeout(() => setCpCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [cpCountdown]);
  useEffect(() => {
    if (daCountdown > 0) {
      const t = setTimeout(() => setDaCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [daCountdown]);

  const handleSendCpOtp = async () => {
    if (!user?.phone) return;
    setCpMsg(null);
    setCpLoading(true);
    const result = await requestOtp(user.phone, 'change-password');
    setCpLoading(false);
    if (result.success) { setCpOtpSent(true); setCpCountdown(60); }
    else { setCpMsg({ type: 'error', text: result.error || 'Failed to send OTP.' }); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpMsg(null);
    if (!cpOtp || cpOtp.length !== 6) { setCpMsg({ type: 'error', text: 'Enter the 6-digit OTP.' }); return; }
    if (!cpNewPassword || cpNewPassword.length < 6) { setCpMsg({ type: 'error', text: 'Password must be at least 6 characters.' }); return; }
    if (cpNewPassword !== cpConfirmPassword) { setCpMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
    setCpLoading(true);
    const result = await changePassword(cpOtp, cpNewPassword);
    setCpLoading(false);
    if (result.success) { setCpMsg({ type: 'success', text: result.message || 'Password changed! Please log in again.' }); }
    else { setCpMsg({ type: 'error', text: result.error || 'Failed to change password.' }); }
  };

  const handleSendDaOtp = async () => {
    if (!user?.phone) return;
    setDaMsg(null);
    setDaLoading(true);
    const result = await requestOtp(user.phone, 'delete-account');
    setDaLoading(false);
    if (result.success) { setDaOtpSent(true); setDaCountdown(60); }
    else { setDaMsg({ type: 'error', text: result.error || 'Failed to send OTP.' }); }
  };

  const handleDeleteAccount = async () => {
    setDaMsg(null);
    if (!daOtp || daOtp.length !== 6) { setDaMsg({ type: 'error', text: 'Enter the 6-digit OTP.' }); return; }
    if (!daConfirm) { setDaMsg({ type: 'error', text: 'Please confirm you understand all data will be deleted.' }); return; }
    setDaLoading(true);
    const result = await deleteAccount(daOtp);
    setDaLoading(false);
    if (result.success) { setDaMsg({ type: 'success', text: 'Account deleted successfully.' }); }
    else { setDaMsg({ type: 'error', text: result.error || 'Failed to delete account.' }); }
  };

  // Step B: Membership state
  const [subscribingPlan, setSubscribingPlan] = useState<MembershipPlanType | null>(null);

  // Step C: Bank Verification state
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolderName, setAccountHolderName] = useState(user?.legalName || '');
  const [bankName, setBankName] = useState('State Bank of India');
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bankMsg, setBankMsg] = useState<string | null>(null);

  // Bookings state & incoming request alerts
  const [bookings, setBookings] = useState<any[]>([]);
  const [incomingBookingRequest, setIncomingBookingRequest] = useState<any | null>(null);
  const audioContextRef = useRef<any>(null);
  const ringtoneTimerRef = useRef<any>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);

  // Floating Picture-in-Picture (PiP) Overlay Window refs & state
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);
  const pipRenderTimerRef = useRef<any>(null);

  // Close any outstanding system notifications in shade
  const closeAllActiveBookingNotifications = () => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && typeof reg.getNotifications === 'function') {
          reg.getNotifications().then(list => {
            list.forEach(n => {
              if (n.tag && (n.tag.includes('booking') || n.tag === 'incoming-booking-call')) {
                n.close();
              }
            });
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  };

  const stopRingtone = () => {
    try {
      if (ringtoneTimerRef.current) {
        clearInterval(ringtoneTimerRef.current);
        ringtoneTimerRef.current = null;
      }
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0);
      }
      if (backgroundAudioRef.current) {
        try {
          if (!isAvailabilityPaused) {
            // Restore silent audio keepalive so background process remains active
            backgroundAudioRef.current.src = '/assets/silent.wav';
            backgroundAudioRef.current.loop = true;
            backgroundAudioRef.current.volume = 0.01;
            const p = backgroundAudioRef.current.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } else {
            backgroundAudioRef.current.pause();
          }
        } catch {}
      }
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try {
          if (!isAvailabilityPaused) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: 'PairUpToday Companion Online',
              artist: 'Ready for Instant Booking Alerts',
              album: 'PairUpToday Host Portal',
              artwork: [
                { src: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png', sizes: '192x192', type: 'image/png' }
              ]
            });
            navigator.mediaSession.playbackState = 'playing';
          } else {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = 'none';
          }
        } catch {}
      }
      closeAllActiveBookingNotifications();
    } catch (e) {
      console.warn('stopRingtone error', e);
    }
  };

  const startRingtone = () => {
    try {
      stopRingtone();

      // 1. Play loud looping ringtone via HTML5 Audio element.
      // Since this element has active media permissions/session, it rings LOUDLY in background even when user is using WhatsApp/Facebook/Instagram or on a phone call!
      if (!backgroundAudioRef.current && typeof window !== 'undefined') {
        const audio = new Audio('/assets/ringtone.wav');
        audio.loop = true;
        backgroundAudioRef.current = audio;
      }
      if (backgroundAudioRef.current) {
        try {
          backgroundAudioRef.current.src = '/assets/ringtone.wav';
          backgroundAudioRef.current.loop = true;
          backgroundAudioRef.current.volume = 1.0;
          const p = backgroundAudioRef.current.play();
          if (p && typeof p.catch === 'function') {
            p.catch((err) => {
              console.warn('Background audio ringtone play rejected', err);
            });
          }
        } catch (audioErr) {
          console.warn('Background audio ringtone error', audioErr);
        }
      }

      // Update MediaSession so Android notification center shows active call-style ringing banner
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: '🚨 INCOMING BOOKING CALL!',
            artist: 'PairUpToday Companion Alert',
            album: 'Loud Ringing • Tap to Open & Accept',
            artwork: [
              { src: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png', sizes: '192x192', type: 'image/png' }
            ]
          });
          navigator.mediaSession.playbackState = 'playing';
        } catch {}
      }

      const playBurst = () => {
        try {
          if (typeof window === 'undefined') return;
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioCtx) return;
          const ctx = audioContextRef.current || new AudioCtx();
          audioContextRef.current = ctx;
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          const now = ctx.currentTime || 0;

          // Tone 1: High energetic chime
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(784, now); // G5
          osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.18); // C6
          gain1.gain.setValueAtTime(0.35, now);
          gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.35);

          // Tone 2: Harmonious ascending pulse
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(1046.5, now + 0.2); // C6
          osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.45); // E6
          gain2.gain.setValueAtTime(0.3, now + 0.2);
          gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.2);
          osc2.stop(now + 0.55);

          // Tone 3: Urgent telephone dual-strike
          const osc3 = ctx.createOscillator();
          const gain3 = ctx.createGain();
          osc3.type = 'sine';
          osc3.frequency.setValueAtTime(880, now + 0.65); // A5
          osc3.frequency.exponentialRampToValueAtTime(1318.51, now + 0.95); // E6
          gain3.gain.setValueAtTime(0.35, now + 0.65);
          gain3.gain.exponentialRampToValueAtTime(0.01, now + 1.1);
          osc3.connect(gain3);
          gain3.connect(ctx.destination);
          osc3.start(now + 0.65);
          osc3.stop(now + 1.1);

          // Mobile device vibration pattern
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
            navigator.vibrate([600, 250, 600, 250, 600]);
          }
        } catch (e) {
          console.warn('Ringtone playback error', e);
        }
      };

      playBurst();
      ringtoneTimerRef.current = setInterval(playBurst, 1800);
    } catch (outerErr) {
      console.warn('startRingtone setup error', outerErr);
    }
  };

  // Picture-in-Picture Floating Window Renderer
  const drawPipFrame = useCallback(() => {
    const canvas = pipCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    if (incomingBookingRequest) {
      const isRed = Math.floor(Date.now() / 400) % 2 === 0;
      ctx.fillStyle = isRed ? '#dc2626' : '#7c2d12';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚨 NEW BOOKING REQUEST!', w / 2, 40);

      const price = Math.round(incomingBookingRequest.totalAmount || 1000);
      const srv = incomingBookingRequest.serviceName || 'Session';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`₹${price} • ${srv}`, w / 2, 80);

      const client = incomingBookingRequest.clientName || 'Client';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`Client: ${client}`, w / 2, 116);

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(30, 136, w - 60, 42, 10);
      } else {
        ctx.rect(30, 136, w - 60, 42);
      }
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('👉 TAP TO OPEN & ACCEPT', w / 2, 163);
    } else {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = !isAvailabilityPaused ? '#10b981' : '#64748b';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);

      ctx.fillStyle = !isAvailabilityPaused ? '#10b981' : '#64748b';
      ctx.beginPath();
      ctx.arc(36, 42, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(!isAvailabilityPaused ? 'PairUp Live: ONLINE' : 'PairUp: OFFLINE', 58, 48);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '15px sans-serif';
      ctx.fillText(!isAvailabilityPaused ? 'Waiting for bookings...' : 'Offline (Paused)', 58, 80);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px sans-serif';
      ctx.fillText('Floating Overlay Active across Apps', 30, 128);

      ctx.fillStyle = '#ec4899';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('PairUpToday Host Portal', 30, 160);
    }
  }, [incomingBookingRequest, isAvailabilityPaused]);

  const activatePipOverlay = async () => {
    try {
      startBackgroundKeepalive();
      if (!pipVideoRef.current || !pipCanvasRef.current) return;

      drawPipFrame();

      if (!pipVideoRef.current.srcObject) {
        const stream = (pipCanvasRef.current as any).captureStream ? (pipCanvasRef.current as any).captureStream(15) : null;
        if (stream) {
          pipVideoRef.current.srcObject = stream;
        }
      }

      await pipVideoRef.current.play().catch(() => {});
      if (typeof pipVideoRef.current.requestPictureInPicture === 'function') {
        if (!document.pictureInPictureElement) {
          await pipVideoRef.current.requestPictureInPicture();
          setIsPipActive(true);
        }
      }
    } catch (err: any) {
      console.warn('PiP auto-activation notice:', err);
    }
  };

  const deactivatePipOverlay = async () => {
    try {
      if (typeof document !== 'undefined' && document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(() => {});
      }
      setIsPipActive(false);
    } catch (err: any) {
      console.warn('PiP auto-deactivation notice:', err);
    }
  };

  useEffect(() => {
    drawPipFrame();
    pipRenderTimerRef.current = setInterval(drawPipFrame, 400);
    return () => {
      if (pipRenderTimerRef.current) clearInterval(pipRenderTimerRef.current);
    };
  }, [drawPipFrame]);

  const [completedBookingEarned, setCompletedBookingEarned] = useState<{ id: string; amountPaise: number; code: string } | null>(null);
  const [startOtpInputs, setStartOtpInputs] = useState<Record<string, string>>({});
  const [delayMinutesInputs, setDelayMinutesInputs] = useState<Record<string, number>>({});
  const [endOtpInputs, setEndOtpInputs] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Date & Timeframe filters (All Time, Today, Last 7 Days, This Month)
  const [companionHistoryTimeframe, setCompanionHistoryTimeframe] = useState<TimeframeFilter>('all');
  const [walletTimeframe, setWalletTimeframe] = useState<TimeframeFilter>('all');
  const [lockedEarningsTimeframe, setLockedEarningsTimeframe] = useState<TimeframeFilter>('all');
  const [isEditingBank, setIsEditingBank] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'granted';
  });

  const startBackgroundKeepalive = () => {
    try {
      if (typeof window === 'undefined') return;
      if (!backgroundAudioRef.current) {
        const audio = new Audio('/assets/silent.wav');
        audio.loop = true;
        audio.volume = 0.01;
        backgroundAudioRef.current = audio;
      }
      const p = backgroundAudioRef.current.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'PairUpToday Companion Online',
            artist: 'Ready for Instant Booking Alerts',
            album: 'PairUpToday Host Portal',
            artwork: [
              { src: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png', sizes: '192x192', type: 'image/png' }
            ]
          });
          navigator.mediaSession.playbackState = 'playing';
        } catch {}
      }
    } catch (e) {
      console.warn('Background keepalive error', e);
    }
  };

  const stopBackgroundKeepalive = () => {
    try {
      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.pause();
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      }
    } catch {}
  };

  const handleRequestNotificationPermission = async () => {
    startBackgroundKeepalive();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const p = await Notification.requestPermission();
        setNotificationPermission(p);
        if (p === 'granted') {
          setActionMsg('🔔 Alerts enabled! You will now receive instant overlay notifications.');
          setTimeout(() => setActionMsg(null), 4000);
        }
      } catch (e) {
        console.warn('Notification permission error', e);
      }
    }
  };

  // Active chat state
  const [activeChatBooking, setActiveChatBooking] = useState<any | null>(null);
  activeChatBookingRef.current = activeChatBooking;
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatText, setNewChatText] = useState('');
  const [confirmedBookingAlert, setConfirmedBookingAlert] = useState<any | null>(null);

  // Profile editing state
  const [profileNameInput, setProfileNameInput] = useState(user?.profileName || user?.legalName || '');
  const [bioInput, setBioInput] = useState(user?.bio || '');
  const [userPhotos, setUserPhotos] = useState<string[]>(() => {
    if (Array.isArray(user?.photos) && user.photos.length > 0) return user.photos;
    if (user?.profilePhoto) return [user.profilePhoto];
    return [];
  });
  const [activeProfilePhoto, setActiveProfilePhoto] = useState<string>(user?.profilePhoto || '');
  const [companionLocationInput, setCompanionLocationInput] = useState(user?.city || user?.address || '');
  const [companionCity, setCompanionCity] = useState(user?.city || '');
  const [companionState, setCompanionState] = useState(user?.state || '');
  const [companionCoords, setCompanionCoords] = useState<{ lat?: number; lng?: number } | null>(
    user?.latitude && user?.longitude ? { lat: user.latitude, lng: user.longitude } : null
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setProfileNameInput(user.profileName || user.legalName || '');
      setBioInput(user.bio || '');
      setCompanionLocationInput(user.city || user.address || '');
      setCompanionCity(user.city || '');
      setCompanionState(user.state || '');
      if (user.latitude && user.longitude) {
        setCompanionCoords({ lat: user.latitude, lng: user.longitude });
      }
      const photos = Array.isArray(user.photos) && user.photos.length > 0 
        ? user.photos 
        : (user.profilePhoto ? [user.profilePhoto] : []);
      setUserPhotos(photos);
      setActiveProfilePhoto(user.profilePhoto || photos[0] || '');
    }
  }, [user?.profileName, user?.profilePhoto, JSON.stringify(user?.photos || []), user?.bio, user?.city, user?.address, user?.latitude, user?.longitude]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (userPhotos.length >= 6) {
      setProfileErrorMsg('Maximum 6 photos allowed.');
      return;
    }
    try {
      const b64 = await compressImageFile(file, 900, 900, 0.75);
      if (b64) {
        const updated = [...userPhotos, b64].slice(0, 6);
        const mainPhoto = activeProfilePhoto || updated[0] || '';
        setUserPhotos(updated);
        if (!activeProfilePhoto) {
          setActiveProfilePhoto(b64);
        }
        // Auto-persist uploaded photo immediately so it is never removed automatically
        updateProfile({
          photos: updated,
          profilePhoto: mainPhoto
        }).then(res => {
          if (res.success) {
            setProfileSuccessMsg('Photo uploaded and saved!');
            setTimeout(() => setProfileSuccessMsg(null), 3000);
          }
        }).catch(err => {
          console.warn('Auto-save photo error:', err);
        });
      }
    } catch (err: any) {
      setProfileErrorMsg('Failed to process image: ' + (err.message || 'Unknown error'));
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (photoToRemove: string) => {
    const updated = userPhotos.filter(p => p !== photoToRemove);
    const mainPhoto = activeProfilePhoto === photoToRemove ? (updated[0] || '') : activeProfilePhoto;
    setUserPhotos(updated);
    if (activeProfilePhoto === photoToRemove) {
      setActiveProfilePhoto(updated[0] || '');
    }
    // Auto-persist photo deletion immediately
    updateProfile({
      photos: updated,
      profilePhoto: mainPhoto
    }).catch(err => {
      console.warn('Auto-save remove photo error:', err);
    });
  };

  const handleSetMainPhoto = (photo: string) => {
    setActiveProfilePhoto(photo);
    const reordered = [photo, ...userPhotos.filter(p => p !== photo)];
    setUserPhotos(reordered);
    updateProfile({
      profilePhoto: photo,
      photos: reordered
    }).catch(err => {
      console.warn('Auto-save main photo error:', err);
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    try {
      const currentMain = activeProfilePhoto || userPhotos[0] || '';
      let allPhotos = [...userPhotos];
      if (currentMain && !allPhotos.includes(currentMain)) {
        allPhotos = [currentMain, ...allPhotos];
      }
      const compressedMain = currentMain ? await compressBase64(currentMain) : '';
      const compressedPhotos = await Promise.all(
        allPhotos.slice(0, 6).map(photo => compressBase64(photo))
      );
      const result = await updateProfile({
        profileName: profileNameInput.trim(),
        bio: bioInput.trim(),
        profilePhoto: compressedMain,
        photos: compressedPhotos,
        city: companionCity || companionLocationInput.trim(),
        state: companionState,
        address: companionLocationInput.trim(),
        latitude: companionCoords?.lat,
        longitude: companionCoords?.lng
      });
      if (result.success) {
        setProfileSuccessMsg(t.profileSuccessMsg || 'Profile updated successfully!');
        setTimeout(() => setProfileSuccessMsg(null), 4000);
      } else {
        setProfileErrorMsg(result.error || 'Failed to update profile.');
      }
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Error updating profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const fetchCompanionStatus = async () => {
    if (!user) return;
    try {
      const res = await apiFetch(`/api/companion/status/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
        if (data.profile) {
          setSelectedServices(data.profile.services || [1, 2]);
          const isPaused = Boolean(data.profile.isPaused);
          setIsAvailabilityPaused(isPaused);
          const isLiveNow = Boolean(!isPaused && data.isLive);
          localStorage.setItem('pairup_companion_online', isLiveNow ? 'true' : 'false');
          if (!isPaused && data.isLive) {
            startBackgroundKeepalive();
          }
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

        // Automatic smart gate navigation on initial companion portal entry
        if (!hasAutoNavigatedRef.current) {
          hasAutoNavigatedRef.current = true;
          const membershipValid = Boolean(
            data.conditions?.membershipValid ?? data.profile?.membership?.isActive
          );
          const bankVerified = Boolean(
            data.conditions?.bankVerified ?? data.profile?.bankDetails?.isVerified
          );

          if (!membershipValid) {
            // Gate 2: Membership unpaid -> open membership page
            setActiveTab('membership');
          } else if (!bankVerified) {
            // Gate 2 paid, Gate 3: Bank verification remaining -> open bank verify page
            setActiveTab('bank');
          } else {
            // All verified -> direct login to overview according to previous flow
            setActiveTab('overview');
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
      const res = await apiFetch(`/api/bookings/my/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        const list = data.bookings || [];
        setBookings(list);

        // Keep active booking status synchronized in storage for safe navigation lock
        const hasActive = list.some((b: any) =>
          ['PENDING', 'CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(b.status)
        );
        localStorage.setItem('pairup_has_active_booking', hasActive ? 'true' : 'false');

        // Detect real-time booking requests waiting for companion acceptance
        const pendingRequest = list.find((b: any) => 
          b.companionId === user.id && 
          b.status === 'PENDING' && 
          !b.companionAccepted && 
          b.cancellationReason !== 'COMPANION_BUSY'
        );

        if (pendingRequest) {
          setIncomingBookingRequest((prev: any) => {
            if (!prev || prev.id !== pendingRequest.id) {
              triggerSystemNotification('🚨 URGENT: New Booking Request!', {
                body: `${pendingRequest.clientName || 'A Client'} requested a ${pendingRequest.serviceName} session on ${pendingRequest.date} at ${pendingRequest.startTime}. Tap to review!`,
                icon: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
                tag: `booking-${pendingRequest.id}`,
                data: { bookingId: pendingRequest.id, url: '/companion-dashboard' }
              });
            }
            return pendingRequest;
          });
          startRingtone();
        } else {
          setIncomingBookingRequest(null);
          stopRingtone();
        }

        // Detect newly confirmed/paid booking to surface active alert if companion hasn't acknowledged it yet
        const unhandledConfirmed = list.find((b: any) =>
          b.companionId === user.id &&
          (b.status === 'CONFIRMED' || b.status === 'CONFIRMED_PAID' || b.paymentStatus === 'PAID') &&
          b.status !== 'COMPLETED' &&
          b.status !== 'CANCELLED' &&
          b.status !== 'REJECTED' &&
          !b.companionArrivedAt &&
          !b.startOtpVerified
        );
        if (unhandledConfirmed) {
          setConfirmedBookingAlert((prev: any) => {
            if (!prev || prev.id !== unhandledConfirmed.id) {
              setActiveTab('upcoming');
              return unhandledConfirmed;
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error('Failed to load bookings', err);
    }
  };

  const handleAcceptIncomingBooking = async (bookingId: string) => {
    stopRingtone();
    try {
      const res = await apiFetch(`/api/bookings/${bookingId}/accept`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIncomingBookingRequest(null);
        setActionMsg('Booking Accepted! Waiting for client to complete payment.');
        setTimeout(() => setActionMsg(null), 4000);
        fetchBookings();
      } else {
        setIncomingBookingRequest(null);
        if (data.canceledByClient || (data.error && /canceled by client/i.test(data.error))) {
          setActionMsg('⚠️ Canceled by client. This booking request is no longer available.');
        } else {
          setActionMsg(data.error || 'Failed to accept booking.');
        }
        setTimeout(() => setActionMsg(null), 5000);
        fetchBookings();
      }
    } catch (err: any) {
      setIncomingBookingRequest(null);
      setActionMsg(err.message || 'Failed to accept booking.');
    }
  };

  const handleRejectIncomingBooking = async (bookingId: string) => {
    stopRingtone();
    try {
      const res = await apiFetch(`/api/bookings/${bookingId}/reject`, { method: 'POST' });
      if (res.ok) {
        setIncomingBookingRequest(null);
        setActionMsg('Booking request declined.');
        setTimeout(() => setActionMsg(null), 3000);
        fetchBookings();
      }
    } catch (err: any) {
      setActionMsg(err.message || 'Failed to decline booking.');
    }
  };

  useEffect(() => {
    let alertPulseTimer: any = null;
    if (incomingBookingRequest) {
      startRingtone();
      // Send persistent heads-up notification pulse every 3.5s so it stays displayed over Facebook, WhatsApp, or phone calls
      const triggerCallAlert = () => {
        triggerSystemNotification(`🚨 URGENT BOOKING: ₹${Math.round(incomingBookingRequest.totalAmount || 1000)} - ${incomingBookingRequest.serviceName || 'Session'}`, {
          body: `From ${incomingBookingRequest.clientName || 'A Client'}. Tap to open PairUp and accept now!`,
          icon: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
          tag: 'incoming-booking-call',
          category: 'call',
          renotify: true,
          requireInteraction: true,
          data: { bookingId: incomingBookingRequest.id, url: '/companion-dashboard' }
        });
      };
      triggerCallAlert();
      alertPulseTimer = setInterval(triggerCallAlert, 3500);
    } else {
      stopRingtone();
      if (!isAvailabilityPaused) {
        startBackgroundKeepalive();
      }
    }
    return () => {
      if (alertPulseTimer) clearInterval(alertPulseTimer);
      stopRingtone();
    };
  }, [incomingBookingRequest?.id, isAvailabilityPaused]);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await apiFetch(`/api/notifications/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.notifications || [];
        setNotifications(items);
        if (items.some((item: any) => 
          item.type === 'KYC_REJECTED' || 
          item.type === 'KYC_APPROVED' || 
          (typeof item.title === 'string' && /kyc/i.test(item.title))
        )) {
          refreshUserData();
        }
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  useEffect(() => {
    fetchCompanionStatus();
    fetchBookings();
    fetchNotifications();
    refreshUserData();

    // Auto-prompt notification permission when dashboard mounts so background overlay alerts work
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().then(p => setNotificationPermission(p)).catch(() => {});
      } catch {}
    }

    // Connect to real-time Companion Alerts SSE Stream (<50ms delivery) with Bearer token authentication
    let eventSource: EventSource | null = null;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('pairup_token') || '' : '';
      const sseUrl = token 
        ? `/api/companion/alerts/stream?token=${encodeURIComponent(token)}`
        : '/api/companion/alerts/stream';
      eventSource = new EventSource(sseUrl);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_BOOKING_REQUEST' && data.booking) {
            if (data.booking.status === 'CONFIRMED' || data.booking.paymentStatus === 'PAID') {
              stopRingtone();
              setIncomingBookingRequest(null);
              triggerSystemNotification('🎉 Payment Confirmed! New Session Ready', {
                body: `${data.booking.clientName || 'Client'} has paid for ${data.booking.serviceName || 'Session'}. Tap to chat and view meeting venue!`,
                icon: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
                tag: `confirmed-${data.booking.id}`,
                requireInteraction: true,
                data: { bookingId: data.booking.id, url: '/companion-dashboard' }
              });
              setActionMsg(`🎉 Booking payment confirmed by ${data.booking.clientName || 'Client'}! Chat and meeting venue are unlocked.`);
              setTimeout(() => setActionMsg(null), 6000);
              fetchBookings();
              fetchCompanionStatus();
            } else {
              setIncomingBookingRequest(data.booking);
              startRingtone();
              triggerSystemNotification('🚨 URGENT: New Booking Request!', {
                body: `${data.booking.clientName || 'A Client'} requested a ${data.booking.serviceName || 'Social'} session. Tap to review!`,
                icon: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
                tag: `booking-${data.booking.id}`,
                requireInteraction: true,
                data: { bookingId: data.booking.id, url: '/companion-dashboard' }
              });
              fetchBookings();
            }
          } else if (data.type === 'BOOKING_CONFIRMED' || data.type === 'BOOKING_PAID') {
            stopRingtone();
            setIncomingBookingRequest(null);
            if (data.booking) {
              setConfirmedBookingAlert(data.booking);
              setActiveTab('upcoming');
            }
            triggerSystemNotification('🎉 Payment Confirmed! New Session Ready', {
              body: `${data.booking?.clientName || 'Client'} has paid for ${data.booking?.serviceName || 'Session'}. Tap to chat and view meeting venue!`,
              icon: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
              tag: `confirmed-${data.booking?.id || Date.now()}`,
              requireInteraction: true,
              data: { bookingId: data.booking?.id, url: '/companion-dashboard' }
            });
            setActionMsg(`🎉 Booking payment confirmed by ${data.booking?.clientName || 'Client'}! Chat and meeting venue are unlocked.`);
            setTimeout(() => setActionMsg(null), 6000);
            fetchBookings();
            fetchCompanionStatus();
          } else if (data.type === 'BOOKING_CANCELLED') {
            stopRingtone();
            setIncomingBookingRequest((current: any) => {
              if (current && current.id === data.bookingId) return null;
              return current;
            });
            setActionMsg('⚠️ Booking Request was Canceled by Client.');
            setTimeout(() => setActionMsg(null), 4000);
            fetchBookings();
          } else if (data.type === 'BOOKING_ACCEPTED') {
            stopRingtone();
            setIncomingBookingRequest(null);
            fetchBookings();
          }
        } catch (parseErr) {
          console.warn('Companion SSE parse error:', parseErr);
        }
      };
      eventSource.onerror = () => {
        // Fallback to polling if SSE disconnected
      };
    } catch (sseErr) {
      console.warn('Failed to initialize SSE EventSource:', sseErr);
    }

    // Heartbeat background sync every 60s (live alerts delivered instantly via SSE/Firebase)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchBookings();
        fetchNotifications();
      }
    }, 60000);

    // Also listen for Service Worker postMessage actions (e.g. from notification clicks)
    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'NOTIFICATION_ACTION') {
        const { action, bookingId } = e.data;
        if (action === 'decline') {
          handleRejectIncomingBooking(bookingId);
        } else {
          window.focus();
        }
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    // Re-check bookings immediately whenever user returns to the tab or screen wakes up
    const handleVisibilityOrFocus = () => {
      fetchBookings();
      fetchNotifications();
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Sync with global incoming booking event for Picture-in-Picture floating overlay
    const handleGlobalBooking = (e: any) => {
      setIncomingBookingRequest(e.detail);
    };
    window.addEventListener('pairup:incoming-booking', handleGlobalBooking);

    // Sync with global confirmed booking event (automatically transitions to active session tab)
    const handleGlobalBookingConfirmed = (e: any) => {
      if (e.detail) {
        stopRingtone();
        setIncomingBookingRequest(null);
        setConfirmedBookingAlert(e.detail);
        setActiveTab('upcoming');
        fetchBookings();
      }
    };
    window.addEventListener('pairup:booking-confirmed', handleGlobalBookingConfirmed);

    return () => {
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('pairup:incoming-booking', handleGlobalBooking);
      window.removeEventListener('pairup:booking-confirmed', handleGlobalBookingConfirmed);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [user?.id]);

  // Live GPS broadcaster for active bookings (enables privacy-protected client ETA updates)
  useEffect(() => {
    // Only broadcast while booking is confirmed transit; stop immediately when ongoing/completed
    const activeBooking = bookings.find(b => ['CONFIRMED', 'CONFIRMED_PAID', 'COMPANION_ARRIVED'].includes(b.status));
    if (!activeBooking || !user || typeof navigator === 'undefined' || !navigator.geolocation) return;

    let watchId: number | null = null;
    const sendCoords = (lat: number, lng: number, acc: number = 8) => {
      // 1. Send to companion/live-coords for privacy-preserving reverse geocoded ETA calculation
      apiFetch('/api/companion/live-coords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          accuracy: acc,
          bookingId: activeBooking.id
        })
      }).catch(() => {});

      // 2. Also keep location service updated
      apiFetch('/api/location/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          bookingId: activeBooking.id
        })
      }).catch(() => {});
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          sendCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy || 6);
        },
        (err) => {
          console.warn('Geolocation watch notice:', err.message);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 }
      );
    } catch {}

    const locInterval = setInterval(() => {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => sendCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy || 6),
          () => {},
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 4000 }
        );
      } catch {}
    }, 4000);

    return () => {
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {}
      }
      clearInterval(locInterval);
    };
  }, [bookings, user?.id]);

  // Handle chat messages polling
  useEffect(() => {
    if (!activeChatBooking) return;
    const fetchChat = async () => {
      try {
        const res = await apiFetch(`/api/chat/${activeChatBooking.id}`);
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
    if (activeChatBooking.status === 'COMPLETED' || activeChatBooking.status === 'CANCELLED' || activeChatBooking.status === 'REJECTED') {
      return;
    }

    const messageText = newChatText.trim();

    // Enforce Chat Safety Filter (block phone numbers, emails, URLs)
    const phoneRegex = /(?:\+?91[\-\s]?)?[6-9]\d{9}|\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{5}[\-\s]?\d{5}\b/;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const urlRegex = /(?:https?:\/\/|www\.)\S+/i;
    if (phoneRegex.test(messageText) || emailRegex.test(messageText) || urlRegex.test(messageText)) {
      alert('⚠️ For platform safety, contact phone numbers, emails, and external links are prohibited in chat.');
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      bookingId: activeChatBooking.id,
      senderId: user.id,
      senderName: (user as any)?.name || (user as any)?.profileName || user.legalName || 'Companion',
      senderRole: 'COMPANION',
      message: messageText,
      timestamp: new Date().toISOString()
    };

    // Optimistically show message immediately in chat
    setChatMessages(prev => [...prev, optimisticMsg]);
    setNewChatText('');

    try {
      const res = await apiFetch(`/api/bookings/${activeChatBooking.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setChatMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
        }
      } else {
        // Fallback to legacy chat endpoint
        await apiFetch(`/api/chat/${activeChatBooking.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ senderId: user.id, message: messageText })
        });
      }
    } catch (err) {
      console.error('Failed to post message', err);
    }
  };

  // Step A: Save Services & Rates
  const [savingServicesAndRates, setSavingServicesAndRates] = useState(false);
  const handleSaveServicesAndRates = async () => {
    if (!user || savingServicesAndRates) return;
    setSavingServicesAndRates(true);
    try {
      const res = await apiFetch('/api/companion/services-rates', {
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
      const data = await res.json();
      if (res.ok) {
        await fetchCompanionStatus();
        setActionMsg('✅ Services, rates and availability schedule saved and updated successfully.');
        setTimeout(() => setActionMsg(null), 3500);
      } else {
        setActionMsg(data.error || 'Could not save settings. Please try again.');
        setTimeout(() => setActionMsg(null), 4000);
      }
    } catch (err) {
      console.error('Error saving services', err);
      setActionMsg('Network error — settings could not be saved.');
      setTimeout(() => setActionMsg(null), 4000);
    } finally {
      setSavingServicesAndRates(false);
    }
  };

  // Step B: Membership subscription (Authoritative: STARTER ₹449, PROFESSIONAL ₹1,099, PREMIUM ₹5,999)
  const handleSubscribePlan = async (plan: MembershipPlanType) => {
    if (!user) return;
    setSubscribingPlan(plan);
    try {
      if (activeRole !== 'COMPANION') {
        await selectActiveRole('COMPANION').catch(() => {});
      }
      const res = await apiFetch('/api/companion/membership/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, plan })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create membership payment order.');
      let checkoutResult: any;
      try {
        checkoutResult = await openRazorpayCheckout(
          data.payment,
          `${plan} Companion membership`,
          { name: user.legalName, contact: user.phone }
        );
      } catch (checkoutErr: any) {
        if (data?.payment?.orderId) {
          const isCancelled = checkoutErr?.message?.includes('closed') || checkoutErr?.message?.includes('dismiss') || checkoutErr?.message?.includes('cancel');
          apiFetch(isCancelled ? '/api/payments/razorpay/cancel-order' : '/api/payments/razorpay/fail-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: data.payment.orderId,
              reason: checkoutErr?.message
            })
          }).catch(() => {});
        }
        throw checkoutErr;
      }
      const verifyRes = await apiFetch('/api/payments/razorpay/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipPlan: plan,
          orderId: checkoutResult.razorpay_order_id,
          paymentId: checkoutResult.razorpay_payment_id,
          signature: checkoutResult.razorpay_signature
        })
      });
      const verification = await verifyRes.json();
      if (!verifyRes.ok || !verification.success) {
        throw new Error(verification.error || 'Membership payment was not confirmed by the backend.');
      }
      await fetchCompanionStatus();
      setActionMsg(`${plan} membership payment was verified.`);
      setTimeout(() => setActionMsg(null), 3500);
      setActiveTab('bank');
    } catch (err) {
      console.error('Error subscribing', err);
      setActionMsg(err instanceof Error ? err.message : 'Membership checkout failed.');
      setTimeout(() => setActionMsg(null), 5000);
    } finally {
      setSubscribingPlan(null);
    }
  };

  // Step C: Bank Verification
  const handleVerifyBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Strict Rule: Companion Govt ID KYC Name must match Bank Beneficiary Name
    const legalGovtName = (user.legalName || user.name || '').trim();
    if (legalGovtName) {
      const clean = (str: string) => str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
      const kTokens = clean(legalGovtName);
      const bTokens = clean(accountHolderName);
      const matched = kTokens.filter(t => bTokens.includes(t));
      if (matched.length === 0) {
        setBankMsg(`Bank beneficiary name ("${accountHolderName}") must strictly match your Government ID KYC legal name ("${legalGovtName}"). Third-party bank accounts are strictly prohibited.`);
        return;
      }
    }

    setBankSubmitting(true);
    setBankMsg(null);
    try {
      const res = await apiFetch('/api/companion/bank/verify', {
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
        setTimeout(() => setActiveTab('overview'), 1500);
      } else {
        setBankMsg(data.error || 'Bank verification failed.');
      }
    } catch (err: any) {
      setBankMsg(err.message || 'Network error during bank verification.');
    } finally {
      setBankSubmitting(false);
    }
  };

  // Toggle Online/Offline (Pause/Resume) Availability
  const [togglingOnline, setTogglingOnline] = useState(false);
  const handleToggleAvailabilityPause = async () => {
    if (!user || togglingOnline) return;

    // Guard: Prevent going offline while a booking is active or pending
    const hasActiveBooking = bookings.some((b: any) =>
      ['PENDING', 'CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(b.status)
    ) || Boolean(incomingBookingRequest) || localStorage.getItem('pairup_has_active_booking') === 'true';

    if (!isAvailabilityPaused && hasActiveBooking) {
      setActionMsg('⚠️ Booking active in progress. You cannot go offline until this session is completed or cancelled.');
      setTimeout(() => setActionMsg(null), 5000);
      return;
    }

    setTogglingOnline(true);
    try {
      const nextPaused = !isAvailabilityPaused;
      const res = await apiFetch('/api/companion/availability/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, isPaused: nextPaused })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data.error || 'Failed to update availability status.');
        setTimeout(() => setActionMsg(null), 5000);
        return;
      }
      if (res.ok) {
        setIsAvailabilityPaused(nextPaused);
        localStorage.setItem('pairup_companion_online', !nextPaused ? 'true' : 'false');
        await fetchCompanionStatus();
        if (!nextPaused) {
          startBackgroundKeepalive();
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission().then(p => setNotificationPermission(p)).catch(() => {});
          }
          // Automatically activate floating overlay window when companion goes online
          activatePipOverlay();
        } else {
          stopBackgroundKeepalive();
          // Automatically deactivate floating overlay window when companion goes offline
          deactivatePipOverlay();
        }
        setActionMsg(
          nextPaused
            ? '🔴 You are now OFFLINE — not visible to nearby clients.'
            : '🟢 You are now ONLINE — visible to nearby clients in your area!'
        );
        setTimeout(() => setActionMsg(null), 4000);
      } else {
        setActionMsg(data.error || 'Could not update online status. Please try again.');
        setTimeout(() => setActionMsg(null), 5000);
      }
    } catch (err) {
      console.error('Error toggling availability pause', err);
      setActionMsg('Network error — could not update online status.');
      setTimeout(() => setActionMsg(null), 4000);
    } finally {
      setTogglingOnline(false);
    }
  };

  // Point 8: Companion to Client switch safety check
  const handleSwitchToClientWithCheck = async () => {
    // If companion is currently ONLINE (!isAvailabilityPaused), alert them to go OFFLINE first!
    if (!isAvailabilityPaused) {
      const confirmSwitch = window.confirm(
        language === 'bn'
          ? '⚠️ আপনি বর্তমানে ONLINE আছেন এবং ক্লায়েন্ট বুকিংয়ের জন্য সক্রিয়। ক্লায়েন্ট মোডে যাওয়ার আগে দয়া করে Offline হয়ে নিন। আপনি কি এখনই Offline হয়ে ক্লায়েন্ট মোডে যেতে চান?'
          : language === 'hi'
          ? '⚠️ आप वर्तमान में ONLINE हैं। क्लाइंट मोड पर स्विच करने से पहले कृपया Offline हो जाएं। क्या आप अभी Offline होकर स्विच करना चाहते हैं?'
          : '⚠️ You are currently ONLINE and live for client bookings. Please go OFFLINE before switching to Client Mode. Would you like to go Offline and switch now?'
      );
      if (!confirmSwitch) return;

      try {
        await handleToggleAvailabilityPause();
      } catch (e) {
        console.warn('Auto offline error', e);
      }
    }

    // Offline companions switch directly without notice (0ms instant transition)
    selectActiveRole('CLIENT').catch(() => {});
    if (onNavigateToPage) {
      onNavigateToPage('client-dashboard');
    } else {
      window.dispatchEvent(new CustomEvent('pairup:navigate', { detail: { page: 'client-dashboard' } }));
    }
  };

  // User Requirement: Companion cannot navigate to Home while logged in without logging out
  // Case 2 (ONLINE): Alert to go offline and logout first. If OK -> offline, logout, redirect to home. If Cancel -> stay.
  // Case 1 (OFFLINE): Alert that logout is required first. If OK -> logout, redirect to home. If Cancel -> stay.
  const handleNavigateToHomeWithCheck = async () => {
    const isOnline = !isAvailabilityPaused;

    if (isOnline) {
      const confirmOnlineExit = window.confirm(
        language === 'bn'
          ? '⚠️ আপনি বর্তমানে অনলাইনে আছেন!\n\nহোমপেজে যেতে হলে প্রথমে অফলাইন হতে হবে এবং লগআউট করতে হবে।\n\nঅফলাইন ও লগআউট হয়ে হোমপেজে যেতে "OK" ক্লিক করুন, অথবা ড্যাশবোর্ডে থাকতে "Cancel" ক্লিক করুন।'
          : language === 'hi'
          ? '⚠️ आप वर्तमान में ऑनलाइन हैं!\n\nहोमपेज पर जाने के लिए पहले ऑफलाइन होना और लॉगआउट करना होगा।\n\nलॉगआउट होकर होमपेज पर जाने के लिए "OK" पर क्लिक करें या डैशबोर्ड पर बने रहने के लिए "Cancel" करें।'
          : '⚠️ You are currently ONLINE.\n\nYou must go OFFLINE and LOG OUT before visiting the Home page.\n\nClick "OK" to go offline, log out, and return to Home; or click "Cancel" to stay on your Dashboard.'
      );
      if (!confirmOnlineExit) return;

      try {
        await handleToggleAvailabilityPause();
      } catch (e) {
        console.warn('Auto offline error', e);
      }

      await logout();
      if (onNavigateToPage) {
        onNavigateToPage('home');
      } else {
        window.location.href = '/';
      }
      return;
    }

    // When companion is OFFLINE:
    const confirmOfflineExit = window.confirm(
      language === 'bn'
        ? 'বিজ্ঞপ্তি: আপনি কম্প্যানিয়ন অ্যাকাউন্টে লগইন অবস্থায় আছেন।\n\nহোমপেজে যেতে হলে প্রথমে লগআউট করতে হবে।\n\nলগআউট করে হোমপেজে যেতে "OK" ক্লিক করুন, অথবা ড্যাশবোর্ডে থাকতে "Cancel" ক্লিক করুন।'
        : language === 'hi'
        ? 'सूचना: आप अपने कंपैनियन खाते में लॉग इन हैं।\n\nहोमपेज पर जाने के लिए पहले लॉगआउट करना होगा।\n\nलॉगआउट करके होमपेज पर जाने के लिए "OK" पर क्लिक करें, या डैशबोर्ड पर बने रहने के लिए "Cancel" करें।'
        : 'Notice: You are logged into your Companion account.\n\nYou must log out before visiting the Home page.\n\nClick "OK" to log out and go to Home, or click "Cancel" to stay on your Dashboard.'
    );
    if (!confirmOfflineExit) return;

    await logout();
    if (onNavigateToPage) {
      onNavigateToPage('home');
    } else {
      window.location.href = '/';
    }
  };

  // Point 9: Direct logout to home page
  const handleCompanionLogout = async () => {
    if (window.confirm(language === 'bn' ? 'আপনি কি PairUpToday থেকে লগআউট করতে চান?' : language === 'hi' ? 'क्या आप लॉगआउट करना चाहते हैं?' : 'Log out of PairUpToday Companion portal?')) {
      await logout();
      if (onNavigateToPage) {
        onNavigateToPage('home');
      } else {
        window.location.href = '/';
      }
    }
  };

  // MEETING ARRIVED slide action
  const handleSlideMeetingArrived = async (bookingId: string) => {
    if (!user) return;
    try {
      const res = await apiFetch(`/api/bookings/${bookingId}/arrived`, {
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

  // VERIFY SESSION OTP / START OTP (Companion enters OTP told by Client)
  const handleVerifyStartOtp = async (bookingId: string) => {
    const otp = (startOtpInputs[bookingId] || '').trim();
    const delay = delayMinutesInputs[bookingId] || 0;
    if (!otp || (otp.length !== 4 && otp.length !== 6)) {
      alert('Please enter the 4-digit Session OTP (or 6-digit OTP) from the Client.');
      return;
    }

    try {
      // 1. First attempt verify-session-otp (for 4-digit session OTP)
      let res = await apiFetch(`/api/bookings/${bookingId}/verify-session-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enteredOtp: otp })
      });

      // 2. Fallback to verify-start-otp if 6-digit
      if (!res.ok && otp.length === 6) {
        res = await apiFetch(`/api/bookings/${bookingId}/verify-start-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otp, delayMinutes: delay })
        });
      }

      const data = await res.json();
      if (res.ok) {
        fetchBookings();
        setActionMsg('Meeting Start verified! Live location tracking stopped. Official session countdown active.');
        setTimeout(() => setActionMsg(null), 4000);
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
      const res = await apiFetch(`/api/bookings/${bookingId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completionOtp })
      });
      const data = await res.json();
      if (res.ok) {
        setCompletedBookingEarned({
          id: bookingId,
          amountPaise: data.booking?.companionNetSharePaise || 0,
          code: data.booking?.bookingCode || ''
        });
        fetchBookings();
        fetchCompanionStatus();
        setActionMsg(`Meeting Completed! Great! You Earned: ₹${((data.booking?.companionNetSharePaise || 0) / 100).toFixed(2)}`);
        setTimeout(() => setActionMsg(null), 6000);
      } else {
        alert(data.error || 'Failed to complete booking.');
      }
    } catch (err) {
      console.error('Error completing booking', err);
    }
  };

  const isLive = statusData?.isLive;
  const rawConditions = statusData?.conditions || {
    kycApproved: user?.kycStatus === 'APPROVED',
    membershipValid: Boolean(statusData?.profile?.membership?.isActive),
    bankVerified: Boolean(statusData?.profile?.bankDetails?.isVerified)
  };
  const kycApproved = Boolean(rawConditions.kycApproved);
  const membershipValid = Boolean(rawConditions.membershipValid);
  const bankVerified = Boolean(rawConditions.bankVerified);
  const allSatisfied = Boolean(rawConditions.allSatisfied ?? (kycApproved && membershipValid && bankVerified));
  const conditions = {
    kycApproved,
    membershipValid,
    bankVerified,
    allSatisfied
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Bookings breakdown - strictly separate completed sessions from cancelled/pending
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const completedBookings = safeBookings.filter(b => b && b.status === 'COMPLETED');
  const pendingRequests = safeBookings.filter(b => b && b.status === 'PENDING' && !b.companionAccepted && b.cancellationReason !== 'COMPANION_BUSY');
  const pendingBookings = pendingRequests;
  const upcomingBookings = safeBookings.filter(b => b && (b.status === 'CONFIRMED' || b.status === 'CONFIRMED_PAID' || b.status === 'ONGOING' || b.status === 'COMPANION_ARRIVED' || b.status === 'IN_PROGRESS' || (b.paymentStatus === 'PAID' && b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && b.status !== 'REJECTED')));
  const pastBookings = safeBookings.filter(b => b && (b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'REJECTED'));

  if (loading && !statusData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Opening Companion Workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Verifying Session...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GATE 2: Membership not yet paid → show ONLY the isolated Membership screen.
  // Dashboard tabs, sidebar, and all other content are completely hidden.
  // ─────────────────────────────────────────────────────────────────────────────
  if (!conditions.membershipValid) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Minimal top bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                await logout();
                if (onNavigateToPage) {
                  onNavigateToPage('home');
                } else {
                  window.location.href = '/';
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold shadow-sm active:scale-95"
              title="Return to Home"
              aria-label="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-pink-400" />
              <span>Back</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-pink-400 text-sm tracking-wide">PairUpToday</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 font-semibold">
              Companion Portal
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleSwitchToClientWithCheck}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:text-white transition-all text-xs font-semibold shadow-sm active:scale-95"
              title="Switch to Client Mode"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>Client Mode ⇄</span>
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200">{user?.legalName}</p>
              <p className="text-[11px] text-slate-500">{user?.phone}</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                if (onNavigateToPage) {
                  onNavigateToPage('home');
                } else {
                  window.location.href = '/';
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Activation progress steps */}
        <div className="max-w-3xl mx-auto w-full px-4 pt-8 pb-2">
          <div className="flex items-center gap-2 text-xs mb-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>KYC Submitted</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold animate-pulse">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Membership Required ←</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500 font-semibold">
              <Landmark className="w-3.5 h-3.5" />
              <span>Bank Verification</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-xl font-extrabold text-slate-100 mb-1">Choose Your Membership Plan</h2>
            <p className="text-slate-400 text-xs max-w-md mx-auto">
              A paid membership is mandatory before you can receive bookings. Select a plan below to activate your Companion profile on PairUp Verified Network.
            </p>
          </div>

          {actionMsg && (
            <div className="mb-4 p-3 rounded-xl bg-pink-500/10 border border-pink-500/30 text-xs text-pink-300 flex items-center justify-between">
              <span>{actionMsg}</span>
              <button onClick={() => setActionMsg(null)}><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* 3 membership plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* STARTER */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-pink-500/50 transition-colors">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400">Starter</span>
                <div className="text-2xl font-extrabold text-amber-400 my-2">₹449 <span className="text-xs font-normal text-slate-400">/ 1 month</span></div>
                <ul className="text-[11px] text-slate-400 space-y-1.5 mt-3">
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> 30 days active hosting profile</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> Listed on PairUp Verified Network</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> 85% gross earning share</li>
                </ul>
              </div>
              <button
                onClick={() => handleSubscribePlan('STARTER')}
                disabled={subscribingPlan !== null}
                className="mt-5 w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold disabled:opacity-60 transition-colors"
              >
                {subscribingPlan === 'STARTER' ? 'Processing...' : 'Subscribe STARTER'}
              </button>
            </div>

            {/* PROFESSIONAL (highlighted) */}
            <div className="p-5 rounded-2xl bg-slate-900 border-2 border-pink-500/60 flex flex-col justify-between shadow-xl shadow-pink-500/10 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-400 to-rose-400 text-slate-950">
                  MOST POPULAR
                </span>
              </div>
              <div>
                <span className="text-xs uppercase font-bold text-pink-400">Professional</span>
                <div className="text-2xl font-extrabold text-amber-400 my-2">₹1,099 <span className="text-xs font-normal text-slate-400">/ 3 months</span></div>
                <ul className="text-[11px] text-slate-400 space-y-1.5 mt-3">
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> 90 days active hosting</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> Priority discovery placement</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> 85% gross earning share</li>
                </ul>
              </div>
              <button
                onClick={() => handleSubscribePlan('PROFESSIONAL')}
                disabled={subscribingPlan !== null}
                className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-500 hover:to-rose-500 text-slate-950 font-extrabold disabled:opacity-60 transition-colors"
              >
                {subscribingPlan === 'PROFESSIONAL' ? 'Processing...' : 'Subscribe PROFESSIONAL'}
              </button>
            </div>

            {/* PREMIUM */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-pink-500/50 transition-colors">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400">Premium</span>
                <div className="text-2xl font-extrabold text-amber-400 my-2">₹5,999 <span className="text-xs font-normal text-slate-400">/ 1 year</span></div>
                <ul className="text-[11px] text-slate-400 space-y-1.5 mt-3">
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> 365 days unlimited hosting</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> VIP verification badge</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> Zero renewal interruption</li>
                </ul>
              </div>
              <button
                onClick={() => handleSubscribePlan('PREMIUM')}
                disabled={subscribingPlan !== null}
                className="mt-5 w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold disabled:opacity-60 transition-colors"
              >
                {subscribingPlan === 'PREMIUM' ? 'Processing...' : 'Subscribe PREMIUM'}
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-600 mt-6">
            All payments are processed securely via Razorpay. Your profile will be activated immediately after payment confirmation.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GATE 3: Membership paid, but Bank Verification not done.
  // Dashboard tabs and sidebar are completely hidden.
  // ─────────────────────────────────────────────────────────────────────────────
  if (!conditions.bankVerified) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Minimal top bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                await logout();
                if (onNavigateToPage) {
                  onNavigateToPage('home');
                } else {
                  window.location.href = '/';
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold shadow-sm active:scale-95"
              title="Return to Home"
              aria-label="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-pink-400" />
              <span>Back</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-pink-400 text-sm tracking-wide">PairUpToday</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 font-semibold">
              Companion Portal
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleSwitchToClientWithCheck}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:text-white transition-all text-xs font-semibold shadow-sm active:scale-95"
              title="Switch to Client Mode"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>Client Mode ⇄</span>
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200">{user?.legalName}</p>
              <p className="text-[11px] text-slate-500">{user?.phone}</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                if (onNavigateToPage) {
                  onNavigateToPage('home');
                } else {
                  window.location.href = '/';
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Activation progress steps */}
        <div className="max-w-2xl mx-auto w-full px-4 pt-8 pb-2">
          <div className="flex items-center gap-2 text-xs mb-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>KYC Submitted</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Membership Active ✓</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold animate-pulse">
              <Landmark className="w-3.5 h-3.5" />
              <span>Bank Verification Required ←</span>
            </div>
          </div>

          {/* Membership active badge */}
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-300">
                Membership Plan Active ✓ — {statusData?.profile?.membership?.plan || 'Plan'}
              </p>
              <p className="text-[11px] text-slate-400">
                {statusData?.profile?.membership?.expiryDate
                  ? `Valid until ${new Date(statusData.profile.membership.expiryDate).toLocaleDateString()}`
                  : 'Your membership is active and paid.'}
              </p>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-extrabold text-slate-100 mb-1">Verify Your Bank Account</h2>
            <p className="text-slate-400 text-xs max-w-md mx-auto">
              One final step — add your bank details to receive earnings from completed sessions. Your account information is encrypted and never shared.
            </p>
          </div>

          {bankMsg && (
            <div className={`mb-4 p-3 rounded-xl border text-xs ${bankMsg.includes('success') || bankMsg.includes('verified') ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-200'}`}>
              {bankMsg}
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-5">
              <Landmark className="w-4 h-4 text-sky-400" />
              Bank Account Details (Gate 3)
            </h3>
            <form onSubmit={handleVerifyBank} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Account Holder Legal Name</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={e => setAccountHolderName(e.target.value)}
                  placeholder="Full name as printed in passbook"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:border-pink-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Bank Name</label>
                <select
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:border-pink-500 outline-none"
                >
                  {['State Bank of India','HDFC Bank','ICICI Bank','Axis Bank','Kotak Mahindra Bank','Punjab National Bank','Bank of Baroda','Canara Bank','Union Bank of India','IndusInd Bank','Yes Bank','IDFC First Bank','Federal Bank','South Indian Bank','Other'].map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Bank Account Number</label>
                <input
                  type="password"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="Enter 9 to 18 digit account number"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:border-pink-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">IFSC Code</label>
                <input
                  type="text"
                  value={ifsc}
                  onChange={e => setIfsc(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono focus:border-pink-500 outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={bankSubmitting}
                className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold disabled:opacity-60 transition-colors"
              >
                {bankSubmitting ? 'Verifying Account...' : 'Submit Bank Verification'}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-slate-600 mt-4">
            Your bank details are verified through PairUp Verified Network and secured with 256-bit encryption.
          </p>
        </div>
      </div>
    );
  }

  // All 3 gates satisfied → render full Companion Dashboard below.
  const userFirstName = user?.profileName?.trim()?.split(' ')[0] || user?.legalName?.trim()?.split(' ')[0] || 'Companion';

  const companionNavSections = [
    {
      title: 'Host Operations',
      items: [
        { id: 'overview' as CompanionTab, label: 'Overview', icon: Sparkles },
        { id: 'requests' as CompanionTab, label: 'Booking Requests', icon: Clock, badge: pendingBookings.length || undefined, badgeColor: 'bg-amber-500' },
        { id: 'upcoming' as CompanionTab, label: 'Active Sessions', icon: Navigation, badge: upcomingBookings.length || undefined, badgeColor: 'bg-emerald-500' },
        { id: 'chat' as CompanionTab, label: 'Client Chat', icon: MessageSquare, badge: 2, badgeColor: 'bg-pink-500' },
      ]
    },
    {
      title: 'Services & Schedule',
      items: [
        { id: 'services' as CompanionTab, label: '36 Services Offered', icon: CheckSquare },
        { id: 'rates' as CompanionTab, label: 'Rate Management', icon: DollarSign },
        { id: 'availability' as CompanionTab, label: 'Availability Schedule', icon: Calendar },
      ]
    },
    {
      title: 'Financials & Status',
      items: [
        { id: 'wallet' as CompanionTab, label: 'Earnings & Wallet', icon: Wallet },
        { id: 'locked-earnings' as CompanionTab, label: 'Locked Escrow (48h)', icon: Lock },
        { id: 'membership' as CompanionTab, label: 'Membership Plan', icon: CreditCard, badge: conditions.membershipValid ? undefined : 'Renew', badgeColor: 'bg-rose-500' },
        { id: 'bank' as CompanionTab, label: 'Bank Verification', icon: Landmark, badge: conditions.bankVerified ? undefined : 'Unverified', badgeColor: 'bg-rose-500' },
        { id: 'kyc-status' as CompanionTab, label: 'KYC Status', icon: ShieldCheck, badge: conditions.kycApproved ? undefined : 'Pending', badgeColor: 'bg-amber-500' },
      ]
    },
    {
      title: 'Account & Safety',
      items: [
        { id: 'profile' as CompanionTab, label: 'My Host Profile', icon: User },
        { id: 'history' as CompanionTab, label: 'Booking History', icon: FileText },
        { id: 'notifications' as CompanionTab, label: 'Notifications', icon: Bell, badge: notifications.length || undefined, badgeColor: 'bg-rose-500' },
        { id: 'help-safety' as CompanionTab, label: '24/7 Safety & SOS', icon: ShieldAlert },
        { id: 'settings' as CompanionTab, label: 'Account Settings', icon: Settings },
      ]
    }
  ];

  return (
    <ErrorBoundary fallbackTitle="Companion Dashboard">
      <div className="h-screen w-screen max-w-full bg-[#F4F2FA] text-slate-800 flex overflow-hidden relative font-sans">
        
        {/* ============================================================== */}
        {/* 1. DESKTOP / TABLET DOCKED SIDEBAR (LOCKED ROYAL INDIGO GRADIENT) */}
        {/* ============================================================== */}
        <aside className="w-64 xl:w-72 bg-gradient-to-b from-[#1A135E] via-[#241461] to-[#701A75] text-white shrink-0 h-screen border-r border-[#261b5c]/50 hidden lg:flex flex-col select-none relative overflow-y-auto scrollbar-none z-20 shadow-2xl p-4 justify-between">
          <div className="space-y-4 overflow-y-auto scrollbar-none pr-1">
            {/* Desktop Top-Left: Dedicated Home Navigation Button */}
            <div className="flex items-center justify-start pb-1">
              <button
                type="button"
                onClick={handleNavigateToHomeWithCheck}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all shadow-sm cursor-pointer group"
                title="Return to Home"
              >
                <Home className="w-3.5 h-3.5 text-pink-300 group-hover:text-white" />
                <span>← Home</span>
              </button>
            </div>

            {/* Brand Header: Official Home Page Logo */}
            <div className="w-full flex flex-col items-center gap-1.5 py-1 border-b border-white/10 select-none">
              <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-amber-400/80 shadow-lg shadow-pink-500/30 transition-transform group-hover:scale-105">
                <img
                  src="/assets/aistudio/image_AIIEuv.png_bc62f6e1.png"
                  alt="PairUpToday Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-pink-400 to-sky-400 bg-clip-text text-transparent">
                  PairUpToday
                </span>
                <span className="text-[9px] text-pink-300 uppercase tracking-widest font-semibold">
                  Companion Host Station
                </span>
              </div>
            </div>

            {/* Grouped Navigation Sections */}
            <nav className="space-y-4">
              {companionNavSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/60 px-3 py-1">
                    {section.title}
                  </div>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full px-3.5 py-2 rounded-xl transition-all flex items-center justify-between text-xs font-semibold cursor-pointer ${
                          isActive
                            ? 'bg-[#6D28D9] text-white font-bold shadow-lg shadow-purple-900/40 ring-1 ring-purple-400/30'
                            : 'text-purple-100/80 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-200'}`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm ${item.badgeColor || 'bg-pink-500'}`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Switch to Client & Logout Buttons */}
            <div className="pt-2 border-t border-white/10 space-y-1">
              <button
                type="button"
                onClick={handleSwitchToClientWithCheck}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:text-white hover:bg-amber-500/20 transition-all cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span>{language === 'bn' ? 'ক্লায়েন্ট মোডে যান ⇄' : language === 'hi' ? 'क्लाइंट मोड में जाएँ ⇄' : 'Switch to Client Mode ⇄'}</span>
              </button>

              <button
                type="button"
                onClick={handleCompanionLogout}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-500/20 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{language === 'bn' ? 'লগআউট' : language === 'hi' ? 'लॉगआउट' : 'Logout'}</span>
              </button>
            </div>
          </div>

          {/* Couple Silhouette Artwork with Neon Glow at Bottom */}
          <div className="relative pt-4 pb-1 mt-3 border-t border-white/10 flex items-end justify-between overflow-hidden">
            <div className="space-y-0.5 z-10">
              <p className="text-[9px] text-pink-200/80 uppercase font-mono tracking-wider">Host Status</p>
              <p className="text-xs text-white font-bold">{!isAvailabilityPaused ? '🟢 Live GPS Active' : '⚪ Availability Paused'}</p>
            </div>
            <div className="relative text-pink-300">
              <Heart className="w-5 h-5 fill-pink-400 text-pink-400 opacity-80 animate-pulse absolute -top-4 right-2" />
              <Heart className="w-3.5 h-3.5 fill-pink-300 text-pink-300 opacity-60 absolute -top-1 right-7" />
              <Sparkles className="w-8 h-8 text-white/30" />
            </div>
          </div>
        </aside>

        {/* ============================================================== */}
        {/* 2. MOBILE SLIDE-OVER DRAWER SIDEBAR                            */}
        {/* ============================================================== */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <aside className="relative w-72 max-w-[80vw] bg-gradient-to-b from-[#1A135E] via-[#241461] to-[#701A75] text-white flex flex-col justify-between z-10 shadow-2xl h-full p-4 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileSidebarOpen(false);
                      handleNavigateToHomeWithCheck();
                    }}
                    className="flex items-center gap-2 cursor-pointer text-left"
                  >
                    <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-amber-400/80 shadow-md">
                      <img
                        src="/assets/aistudio/image_AIIEuv.png_bc62f6e1.png"
                        alt="PairUpToday"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <span className="font-extrabold text-white text-sm block">PairUpToday</span>
                      <span className="text-[8px] text-pink-300 uppercase tracking-wider block">Companion Host</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Mobile Drawer Language Selector */}
                <div className="flex items-center justify-center bg-white/10 p-1 rounded-xl text-xs">
                  <button onClick={() => setLanguage('en')} className={`flex-1 py-1 rounded-lg ${language === 'en' ? 'bg-[#6D28D9] font-bold' : 'text-slate-300'}`}>EN</button>
                  <button onClick={() => setLanguage('bn')} className={`flex-1 py-1 rounded-lg ${language === 'bn' ? 'bg-[#6D28D9] font-bold' : 'text-slate-300'}`}>বাংলা</button>
                  <button onClick={() => setLanguage('hi')} className={`flex-1 py-1 rounded-lg ${language === 'hi' ? 'bg-[#6D28D9] font-bold' : 'text-slate-300'}`}>हिंदी</button>
                </div>

                {/* Grouped Links in Mobile Drawer */}
                <nav className="space-y-3">
                  {companionNavSections.map((section) => (
                    <div key={section.title} className="space-y-1">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-purple-300/60 px-2.5">
                        {section.title}
                      </div>
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id);
                              setIsMobileSidebarOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl transition-all flex items-center justify-between text-xs font-semibold ${
                              isActive
                                ? 'bg-[#6D28D9] text-white font-bold shadow-md'
                                : 'text-purple-100/80 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className="w-4 h-4 text-purple-200" />
                              <span>{item.label}</span>
                            </div>
                            {item.badge && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${item.badgeColor || 'bg-pink-500'}`}>
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </nav>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileSidebarOpen(false);
                    handleSwitchToClientWithCheck();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:text-white hover:bg-amber-500/20"
                >
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>{language === 'bn' ? 'ক্লায়েন্ট মোডে যান ⇄' : language === 'hi' ? 'क्लाइंट मोड में जाएँ ⇄' : 'Switch to Client Mode ⇄'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsMobileSidebarOpen(false);
                    handleCompanionLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-500/20"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{language === 'bn' ? 'লগআউট' : language === 'hi' ? 'लॉगआउट' : 'Logout'}</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. MAIN COMPANION DASHBOARD CONTENT AREA (SCROLLS INDEPENDENTLY) */}
        {/* ============================================================== */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bg-[#F4F2FA]">
          
          {/* Topbar Header */}
          <header className="bg-white/90 backdrop-blur-md border-b border-purple-100/80 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Button */}
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl text-[#1A135E] hover:bg-purple-50 transition-colors cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Clean Single Back to Overview button when on subtab */}
              {activeTab !== 'overview' && (
                <button
                  onClick={() => setActiveTab('overview')}
                  className="px-3.5 py-1.5 rounded-full bg-purple-50 hover:bg-purple-100 text-[#4C1D95] text-xs font-bold flex items-center gap-1.5 border border-purple-200 transition-colors shadow-sm cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Overview</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* GO LIVE ONLINE/OFFLINE TOGGLE SWITCH (Auto PiP Overlay) */}
              <button
                type="button"
                onClick={handleToggleAvailabilityPause}
                disabled={togglingOnline}
                title={!isAvailabilityPaused ? 'Status: ONLINE — Click to go Offline' : 'Status: OFFLINE — Click to go Online'}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
                  !isAvailabilityPaused
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 ring-2 ring-emerald-400/20'
                    : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  {!isAvailabilityPaused && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${!isAvailabilityPaused ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                </span>
                <span className="font-extrabold">{!isAvailabilityPaused ? 'LIVE' : 'OFFLINE'}</span>
              </button>

              {/* Switch to Client Mode Button (Checks if Online first) */}
              <button
                type="button"
                onClick={handleSwitchToClientWithCheck}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-purple-600/25 transition-all cursor-pointer active:scale-95 shrink-0"
                title="Switch to Client Mode"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-200" />
                <span className="hidden sm:inline">Client Mode</span>
                <span>⇄</span>
              </button>

              {/* 1-Click Language Switcher */}
              <div className="flex items-center bg-purple-50 p-1 rounded-full border border-purple-200 text-xs font-semibold">
                <button onClick={() => setLanguage('en')} className={`px-2 py-0.5 rounded-full transition-colors ${language === 'en' ? 'bg-[#4C1D95] text-white font-bold shadow-sm' : 'text-slate-600 hover:text-purple-700'}`}>EN</button>
                <button onClick={() => setLanguage('bn')} className={`px-2 py-0.5 rounded-full transition-colors ${language === 'bn' ? 'bg-[#4C1D95] text-white font-bold shadow-sm' : 'text-slate-600 hover:text-purple-700'}`}>বা</button>
                <button onClick={() => setLanguage('hi')} className={`px-2 py-0.5 rounded-full transition-colors ${language === 'hi' ? 'bg-[#4C1D95] text-white font-bold shadow-sm' : 'text-slate-600 hover:text-purple-700'}`}>हि</button>
              </div>

              {/* Notification Bell */}
              <button
                onClick={() => setActiveTab('notifications')}
                title="Notifications"
                className="relative p-2 rounded-full bg-white border border-purple-100 text-slate-700 hover:text-purple-700 shadow-sm transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4 text-[#1A135E]" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-extrabold px-1 shadow">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>

              {/* Companion Profile Avatar Pill */}
              <button
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white border border-purple-200 shadow-sm hover:border-purple-300 transition-colors cursor-pointer"
              >
                <div className="relative">
                  <img
                    src={user?.profilePhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'}
                    alt={user?.legalName}
                    className="w-7 h-7 rounded-full object-cover ring-2 ring-purple-400"
                  />
                  <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-1 ring-white ${!isAvailabilityPaused ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                </div>
                <span className="text-xs font-bold text-slate-800 hidden md:inline truncate max-w-[120px]">
                  {user?.profileName || user?.legalName || 'Companion Host'}
                </span>
              </button>
            </div>
          </header>

          {/* Hidden elements for Background Picture-in-Picture Floating Overlay */}
          <canvas ref={pipCanvasRef} width={400} height={225} style={{ display: 'none' }} />
          <video
            ref={pipVideoRef}
            playsInline
            muted
            autoPlay
            style={{ position: 'fixed', bottom: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          />

          {/* Scrollable Main Container */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
        
        {/* Persistent Account Suspension Alert */}
        {user?.isSuspended && (
          <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/60 text-rose-200 flex items-start gap-3 shadow-lg shadow-rose-950/60 animate-fade-in">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-rose-300">
                Account Suspended by Administration
              </h4>
              <p className="text-xs text-rose-200 font-medium">
                Reason: {user?.suspendedReason || 'Terms of service violation'}.
              </p>
              <p className="text-[11px] text-slate-300">
                Companion profile visibility, booking coordination, and messaging are temporarily restricted. Please contact customer support for appeal.
              </p>
            </div>
          </div>
        )}

        {/* Persistent Account Warning Alert */}
        {Boolean(!user?.isSuspended && user?.warningCount && user.warningCount > 0) && (
          <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 text-amber-200 flex items-start gap-3 shadow-lg shadow-amber-950/50 animate-fade-in">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-amber-300">
                Official Account Warning #{user?.warningCount}
              </h4>
              <p className="text-xs text-amber-200 font-medium">
                Notice: {user?.lastWarningReason || 'Policy compliance reminder'}.
              </p>
              <p className="text-[11px] text-slate-300">
                Please ensure full compliance with client safety and platform terms. Repeated violations will result in account suspension.
              </p>
            </div>
          </div>
        )}

        {/* Persistent KYC Action Required Banner if rejected */}
        {(user?.kycStatus === 'REJECTED' || user?.kycRejectionReason) && (
          <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/50 text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-red-950/50 animate-fade-in">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0 mt-0.5 sm:mt-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-sm text-red-300 block">
                  KYC Verification Action Required
                </span>
                <span className="text-xs text-amber-300 block font-medium">
                  Reason: {user?.kycRejectionReason || 'Document photo blur or unreadable. Please re-upload clear photos.'}
                </span>
                <span className="text-[11px] text-slate-300 block">
                  Please fix the issue and submit clear documents to activate your companion host profile.
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                refreshUserData();
                setActiveTab('kyc-status');
                openKycWizard();
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-amber-500 hover:from-pink-500 hover:to-amber-400 text-white font-extrabold text-xs shadow-md shadow-pink-600/30 whitespace-nowrap transition-transform active:scale-95 cursor-pointer"
            >
              Fix & Re-upload KYC Documents →
            </button>
          </div>
        )}

        {/* Global Action Banner */}
        {actionMsg && (
          <div className="p-3.5 rounded-xl bg-pink-500/10 border border-pink-500/30 text-xs text-pink-700 flex items-center justify-between">
            <span>{actionMsg}</span>
            <button onClick={() => setActionMsg(null)}><X className="w-4 h-4" /></button>
          </div>
        )}



        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 1: OVERVIEW (COMPANION HOST COMMAND STATION)           */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* 1. HERO WELCOME BANNER (3:1 Panoramic Couple Artwork + Round Profile + Spread Happiness) */}
            <div className="w-full">
              {/* DESKTOP & TABLET VIEW (sm and above): Full-width Panoramic with Text & Round Profile floating on right */}
              <div 
                className="hidden sm:flex relative w-full min-h-[290px] md:min-h-[310px] lg:min-h-[330px] rounded-3xl overflow-hidden shadow-xl border border-pink-200/80 items-center justify-end p-6 md:p-8 lg:p-10"
                style={{
                  backgroundImage: "url('/assets/companion_welcome_banner.png')",
                  backgroundPosition: "left center",
                  backgroundSize: "cover",
                  backgroundRepeat: "no-repeat"
                }}
              >
                {/* Right-Side "Spread Happiness ❤️🌹" Floating Badge */}
                <div className="absolute top-4 right-4 sm:top-5 sm:right-6 z-20">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-pink-500/85 backdrop-blur-md border border-white/40 text-white text-xs font-extrabold shadow-lg shadow-pink-500/30 animate-pulse">
                    <span>{language === 'bn' ? 'আনন্দ ছড়ান ❤️🌹' : language === 'hi' ? 'खुशियां फैलाएं ❤️🌹' : 'Spread Happiness ❤️🌹'}</span>
                  </div>
                </div>

                {/* Right-aligned Sheer Glass Card with Round Profile Photo on Left & Details on Right (Leaves roses & couple 100% visible) */}
                <div className="relative z-10 w-full max-w-lg lg:max-w-xl bg-black/20 sm:bg-black/15 backdrop-blur-[2px] border border-white/30 rounded-3xl p-5 sm:p-6 shadow-xl flex items-center gap-4 sm:gap-5 text-left">
                  
                  {/* Left: User Round Profile Photo */}
                  <div className="relative shrink-0">
                    <img
                      src={user?.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                      alt={user?.legalName}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-pink-400 shadow-xl"
                    />
                    <span className={`absolute bottom-0 right-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold shadow-md border-2 border-slate-900 ${!isAvailabilityPaused ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-slate-200'}`}>
                      {!isAvailabilityPaused ? 'LIVE' : 'OFF'}
                    </span>
                  </div>

                  {/* Right: Text Details & Status */}
                  <div className="flex-1 space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-500/80 border border-white/40 text-white text-[10px] font-bold tracking-wide shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      <span>{language === 'bn' ? '✨ ভেরিফাইড কম্প্যানিয়ন হোস্ট' : language === 'hi' ? '✨ सत्यापित साथी होस्ट' : '✨ Verified Companion Host'}</span>
                    </div>

                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-snug flex items-center gap-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                      <span>{language === 'bn' ? 'স্বাগতম, ' : language === 'hi' ? 'स्वागत है, ' : 'Welcome Back, '}<span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-rose-200 to-amber-200">{userFirstName}!</span></span>
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-black shadow-sm" title="Verified Companion">✓</span>
                    </h1>

                    <p className="text-xs sm:text-sm text-white font-medium leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                      {language === 'bn' ? 'আপনি একজন অসাধারণ কম্প্যানিয়ন। ইতিবাচকতা ছড়াতে থাকুন!' : language === 'hi' ? 'आप एक अद्भुत साथी हैं। सकारात्मकता फैलाते रहें!' : "You're an amazing companion. Keep spreading positivity!"}
                    </p>

                    {/* Status & Buttons */}
                    <div className="pt-1.5 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 text-xs font-black text-white bg-slate-950/85 px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg">
                        <span className="text-slate-200">{language === 'bn' ? 'আমার স্ট্যাটাস:' : language === 'hi' ? 'मेरी स्थिति:' : 'My Status:'}</span>
                        <span className={!isAvailabilityPaused ? 'text-emerald-400 font-black tracking-wide' : 'text-slate-200 font-bold'}>
                          {!isAvailabilityPaused ? (language === 'bn' ? 'অনলাইন 🟢' : language === 'hi' ? 'ऑनलाइन 🟢' : 'Online 🟢') : (language === 'bn' ? 'অফলাইন ⚪' : language === 'hi' ? 'ऑफलाइन ⚪' : 'Offline ⚪')}
                        </span>
                      </div>

                      <button
                        onClick={handleToggleAvailabilityPause}
                        disabled={togglingOnline}
                        className={`px-3 py-1 rounded-xl text-xs font-extrabold shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
                          !isAvailabilityPaused
                            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
                        }`}
                      >
                        {!isAvailabilityPaused ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{!isAvailabilityPaused ? (language === 'bn' ? 'অফলাইন হন' : language === 'hi' ? 'ऑफलाइन हों' : 'Go Offline') : (language === 'bn' ? 'অনলাইন হন' : language === 'hi' ? 'Go Online (Live)' : 'Go Online (Live)')}</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('requests')}
                        className="px-3 py-1 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-extrabold shadow-md shadow-pink-500/25 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      >
                        <span>{language === 'bn' ? 'অনুরোধ' : language === 'hi' ? 'अनुरोध' : 'Requests'} ({pendingBookings.length})</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* MOBILE VIEW (< sm): Clean Stack so the Artwork is 100% visible & faces are NEVER covered */}
              <div className="sm:hidden space-y-3">
                <div className="relative w-full rounded-2xl overflow-hidden shadow-md border border-pink-200/60 bg-pink-50">
                  <img
                    src="/assets/companion_welcome_banner.png"
                    alt="Companion Welcome Artwork"
                    className="w-full aspect-[3/1] object-cover object-left"
                  />
                  <div className="absolute top-2 right-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-pink-500/90 text-white text-[10px] font-extrabold shadow">
                      {language === 'bn' ? 'আনন্দ ছড়ান ❤️🌹' : language === 'hi' ? 'खुशियां फैलाएं ❤️🌹' : 'Spread Happiness ❤️🌹'}
                    </span>
                  </div>
                </div>

                <div className="bg-white/95 backdrop-blur-md border border-purple-100/80 rounded-2xl p-4 shadow-sm space-y-3 text-left">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={user?.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                        alt={user?.legalName}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-pink-400 shadow-md"
                      />
                      <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${!isAvailabilityPaused ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-extrabold text-[#191040] flex items-center gap-1 truncate">
                        <span>{language === 'bn' ? 'স্বাগতম, ' : language === 'hi' ? 'स्वागत है, ' : 'Welcome Back, '}<span className="text-pink-600">{userFirstName}!</span></span>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500 text-white text-[9px] font-bold">✓</span>
                      </h2>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {language === 'bn' ? 'আপনি একজন অসাধারণ কম্প্যানিয়ন। ইতিবাচকতা ছড়াতে থাকুন!' : language === 'hi' ? 'आप एक अद्भुत साथी हैं। सकारात्मकता फैलाते रहें!' : "You're an amazing companion. Keep spreading positivity!"}
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between gap-2 border-t border-purple-50">
                    <div className="inline-flex items-center gap-1.5 text-xs font-black text-white bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-700 shadow-sm">
                      <span className="text-slate-300">{language === 'bn' ? 'আমার স্ট্যাটাস:' : language === 'hi' ? 'मेरी स्थिति:' : 'My Status:'}</span>
                      <span className={!isAvailabilityPaused ? 'text-emerald-400 font-black' : 'text-slate-300 font-bold'}>
                        {!isAvailabilityPaused ? (language === 'bn' ? 'অনলাইন 🟢' : language === 'hi' ? 'ऑनलाइन 🟢' : 'Online 🟢') : (language === 'bn' ? 'অফলাইন ⚪' : language === 'hi' ? 'ऑफलाइन ⚪' : 'Offline ⚪')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleToggleAvailabilityPause}
                        disabled={togglingOnline}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold shadow-sm ${
                          !isAvailabilityPaused
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {!isAvailabilityPaused ? (language === 'bn' ? 'অফলাইন' : 'Offline') : (language === 'bn' ? 'অনলাইন' : 'Online')}
                      </button>
                      <button
                        onClick={() => setActiveTab('requests')}
                        className="px-3 py-1.5 rounded-xl bg-purple-700 text-white text-[11px] font-bold"
                      >
                        {language === 'bn' ? 'অনুরোধ' : 'Requests'} ({pendingBookings.length})
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 4 KPI Metric Cards (2x2 Mobile, 4 Columns Desktop) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {/* 1. Settled Earnings */}
              <div 
                onClick={() => setActiveTab('wallet')}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer min-h-[120px]"
              >
                <div className="space-y-1">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#191040]">
                    ₹{((statusData?.wallet?.totalSettledPaise || 0) / 100).toFixed(0)}
                  </div>
                  <div className="text-xs font-bold text-slate-700">Settled Earnings</div>
                  <div className="text-[11px] font-bold text-emerald-600">Disbursed to Bank</div>
                </div>
                <div className="hidden sm:block shrink-0">
                  <svg className="w-16 h-8 text-emerald-500 overflow-visible" viewBox="0 0 80 40" fill="none">
                    <path d="M0 35 C 20 30, 25 15, 45 25 C 60 32, 65 5, 80 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              {/* 2. Locked Escrow */}
              <div 
                onClick={() => setActiveTab('locked-earnings')}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer min-h-[120px]"
              >
                <div className="space-y-1">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#191040]">
                    ₹{((statusData?.wallet?.lockedSettlementBalancePaise || 0) / 100).toFixed(0)}
                  </div>
                  <div className="text-xs font-bold text-slate-700">Locked Escrow</div>
                  <div className="text-[11px] font-bold text-amber-600">48h UTC Safety Hold</div>
                </div>
                <div className="hidden sm:block shrink-0">
                  <svg className="w-16 h-8 text-amber-500 overflow-visible" viewBox="0 0 80 40" fill="none">
                    <path d="M0 35 C 25 32, 35 18, 50 24 C 62 28, 68 10, 80 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              {/* 3. Completed Sessions */}
              <div 
                onClick={() => setActiveTab('history')}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-purple-300 hover:shadow-md transition-all group min-h-[120px]"
              >
                <div className="space-y-1">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#191040]">
                    {completedBookings.length}
                  </div>
                  <div className="text-xs font-bold text-slate-700">Sessions Handled</div>
                  <div className="text-[11px] font-bold text-purple-600 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{statusData?.profile?.rating || '5.0'} Rating</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 shadow-sm">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* 4. 3-Gate Activation Status Card */}
              <div 
                onClick={() => {
                  if (!conditions.allSatisfied) {
                    setActiveTab(!conditions.kycApproved ? 'kyc-status' : !conditions.membershipValid ? 'membership' : 'bank');
                  }
                }}
                className={`p-4 sm:p-5 rounded-2xl bg-white border shadow-sm flex items-center justify-between cursor-pointer transition-all group min-h-[120px] ${
                  conditions.allSatisfied 
                    ? 'border-emerald-200 hover:border-emerald-300 hover:shadow-md' 
                    : 'border-rose-200 hover:border-rose-300 hover:shadow-md'
                }`}
              >
                <div className="space-y-1">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1 ${
                    conditions.allSatisfied ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {conditions.allSatisfied ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-[#191040]">
                    {conditions.allSatisfied ? '3-Gates Complete ✓' : 'Gate Incomplete'}
                  </div>
                  <div className="text-xs text-slate-600 font-medium line-clamp-1">
                    {conditions.allSatisfied 
                      ? 'Account Fully Verified' 
                      : `Pending: ${!conditions.kycApproved ? 'KYC Approval' : !conditions.membershipValid ? 'Membership Plan' : 'Bank Verification'}`}
                  </div>
                  <div className={`text-[11px] font-bold ${conditions.allSatisfied ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {conditions.allSatisfied ? 'KYC · Plan · Bank Verified' : 'Click to Complete Required Gate'}
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                  conditions.allSatisfied ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* 3. INCOMING BOOKING REQUESTS (Direct Acceptance on Overview) */}
            {pendingRequests.length > 0 && (
              <div className="p-5 sm:p-6 rounded-3xl bg-white border-2 border-amber-400 shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-amber-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-700 animate-pulse">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">Incoming Booking Requests</h3>
                      <p className="text-xs text-slate-500">Clients waiting for your immediate confirmation ({pendingRequests.length})</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="text-xs font-bold text-purple-700 hover:underline"
                  >
                    View All →
                  </button>
                </div>

                <div className="space-y-3">
                  {pendingRequests.slice(0, 3).map((b) => (
                    <div key={b.id} className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="font-extrabold text-sm text-[#191040] block">{b.serviceName} ({b.bookingCode})</span>
                          <span className="text-xs text-slate-600">
                            Client: <strong className="text-[#db2777]">{b.clientName}</strong> · Date: {b.date} ({b.startTime} - {b.endTime})
                          </span>
                        </div>
                        <span className="text-emerald-700 font-extrabold text-sm self-start sm:self-center">
                          Net Earnings (85%): ₹{(((Number(b.companionNetSharePaise) || Math.round((Number(b.amountPaise || b.baseAmountPaise) || 49900) * 0.85)) / 100)).toFixed(2)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                        <span>Venue: <strong>{b.meetingLocation}</strong></span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleRejectIncomingBooking(b.id)}
                          className="flex-1 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 font-bold border border-rose-200 transition-colors flex items-center justify-center gap-1 text-xs cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAcceptIncomingBooking(b.id)}
                          className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1 text-xs active:scale-95 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept Booking</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. ACTIVE & UPCOMING SESSIONS (Direct Access on Overview) */}
            {upcomingBookings.length > 0 && (
              <div className="p-5 sm:p-6 rounded-3xl bg-white border border-purple-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-purple-50">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                      <Navigation className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">Active & Upcoming Sessions</h3>
                      <p className="text-xs text-slate-500">Scheduled client meetings in progress ({upcomingBookings.length})</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('upcoming')}
                    className="text-xs font-bold text-purple-700 hover:underline cursor-pointer"
                  >
                    Open Live Session Tracker →
                  </button>
                </div>

                <div className="space-y-4">
                  {upcomingBookings.slice(0, 3).map((b) => (
                    <div key={b.id} className="p-5 rounded-3xl bg-gradient-to-br from-purple-50/70 via-white to-pink-50/40 border-2 border-purple-200/80 shadow-md space-y-4">
                      {/* Top Header: Client Info + Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-100">
                        <div className="flex items-center gap-3.5">
                          <img
                            src={b.clientPhoto || '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png'}
                            alt={b.clientName}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-400 shadow-sm shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm sm:text-base text-[#191040]">{b.clientName || 'Client'}</span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] border border-emerald-300">
                                {b.status}
                              </span>
                            </div>
                            <span className="text-xs text-purple-700 font-semibold">{b.serviceName} · Booking #{b.bookingCode || b.id?.slice(0, 8)}</span>
                          </div>
                        </div>

                        {/* 85% Guaranteed Payout */}
                        <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-2xl self-start sm:self-center text-right">
                          <span className="text-[10px] uppercase font-bold text-emerald-700 block">Your Net Earnings (85%)</span>
                          <span className="text-sm sm:text-base font-black text-emerald-600">
                            ₹{(((Number(b.companionNetSharePaise) || Math.round((Number(b.bookingAmountPaise || b.amountPaise || b.baseAmountPaise) || 49900) * 0.85)) / 100)).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Schedule and Venue Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
                        <div className="p-3 rounded-2xl bg-white border border-purple-100 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Scheduled Slot</span>
                            <span className="font-bold text-[#191040]">{b.date} • {b.startTime} - {b.endTime} ({b.durationHours || 1} hr)</span>
                          </div>
                        </div>

                        <div className="p-3 rounded-2xl bg-white border border-purple-100 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-pink-600 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Agreed Meeting Venue</span>
                            <span className="font-bold text-[#191040] truncate block">{b.meetingLocation || 'Specified Meeting Venue'}</span>
                          </div>
                        </div>
                      </div>

                      {/* 3 Action Buttons (Chat with Client, Get Booking Location, Enter OTP) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChatBooking(b);
                            setActiveTab('chat');
                          }}
                          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs shadow-md shadow-pink-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>💬 Chat with {(b.clientName || 'Client').split(' ')[0]}</span>
                        </button>

                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.meetingLocation || 'Meeting Venue')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-center"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>📍 Get Booking Location</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => setActiveTab('upcoming')}
                          className="py-2.5 px-3 rounded-xl bg-[#6D28D9] hover:bg-purple-800 text-white font-extrabold text-xs shadow-md shadow-purple-900/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>🚶 Enter OTP & Start</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. QUICK SNAPSHOT: ACTIVE RATES & 24 SERVICES */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-purple-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-purple-50">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#6D28D9]" />
                  <h3 className="font-extrabold text-slate-900 text-base">Active Rates & Services Snapshot</h3>
                </div>
                <button
                  onClick={() => setActiveTab('rates')}
                  className="text-xs font-bold text-purple-700 hover:underline cursor-pointer"
                >
                  Edit Rates & Services →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">Hourly Rate</span>
                  <div className="text-lg font-extrabold text-[#191040]">₹{hourlyRate}/hr</div>
                  <span className="text-[10px] text-slate-500">Per hour standard</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">Half-Day Rate</span>
                  <div className="text-lg font-extrabold text-[#191040]">₹{halfDayRate}</div>
                  <span className="text-[10px] text-slate-500">4 Hours session</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">Full-Day Rate</span>
                  <div className="text-lg font-extrabold text-[#191040]">₹{fullDayRate}</div>
                  <span className="text-[10px] text-slate-500">8 Hours session</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">Services Active</span>
                  <div className="text-lg font-extrabold text-[#191040]">{selectedServices.length} of 36</div>
                  <span className="text-[10px] text-slate-500">Offered in your area</span>
                </div>
              </div>
            </div>

            {/* 6. Missing Condition Action Cards: Strictly displayed only when ANY gate is incomplete */}
            {!conditions.allSatisfied && (
              <div className="p-6 rounded-3xl bg-white border border-purple-100 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Action Required to Go LIVE
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {!conditions.kycApproved && (
                    <div className="p-4 rounded-2xl border bg-amber-50/60 border-amber-200">
                      <span className="font-bold text-slate-800 block mb-1">Gate 1: KYC Approval</span>
                      <p className="text-slate-600 mb-3">Govt ID & selfie currently in audit.</p>
                      <button onClick={() => setActiveTab('kyc-status')} className="text-purple-700 font-semibold hover:underline cursor-pointer">View KYC Status →</button>
                    </div>
                  )}

                  {!conditions.membershipValid && (
                    <div className="p-4 rounded-2xl border bg-rose-50/60 border-rose-200">
                      <span className="font-bold text-slate-800 block mb-1">Gate 2: Active Membership</span>
                      <p className="text-slate-600 mb-3">Subscribe to Starter, Pro, or Premium.</p>
                      <button onClick={() => setActiveTab('membership')} className="text-purple-700 font-semibold hover:underline cursor-pointer">Choose Membership →</button>
                    </div>
                  )}

                  {!conditions.bankVerified && (
                    <div className="p-4 rounded-2xl border bg-rose-50/60 border-rose-200">
                      <span className="font-bold text-slate-800 block mb-1">Gate 3: Bank Verification</span>
                      <p className="text-slate-600 mb-3">Submit Account No & IFSC for verification.</p>
                      <button onClick={() => setActiveTab('bank')} className="text-purple-700 font-semibold hover:underline cursor-pointer">Verify Bank Account →</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY PROFILE */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <User className="w-5 h-5 text-pink-400" />
                  {t.profileSectionTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t.profileSectionSubtitle}
                </p>
              </div>
              <button
                type="submit"
                disabled={profileSaving}
                className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md shadow-pink-600/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {profileSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t.profileSavingBtn}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t.profileSaveBtn}
                  </>
                )}
              </button>
            </div>

            {/* Notification messages */}
            {profileSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}
            {profileErrorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            {/* 1. PUBLIC DISPLAY NAME & BIO (NAME EDIT/ADD AT TOP) */}
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-pink-400" />
                    {t.profileSectionTitle}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t.profileNameHelp}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  ✓ {t.profilePrivacyBadge}
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-200 block mb-1.5 font-bold text-xs">
                    {t.profileNameLabel}
                  </label>
                  <input
                    type="text"
                    value={profileNameInput}
                    onChange={(e) => setProfileNameInput(e.target.value)}
                    placeholder={t.profileNamePlaceholder}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500 font-semibold text-sm shadow-inner"
                    required
                  />
                  <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                    <span>✓</span> {t.profileNameHelp}
                  </p>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1.5 font-medium">
                    {t.bioLabel}
                  </label>
                  <textarea
                    rows={3}
                    value={bioInput}
                    onChange={(e) => setBioInput(e.target.value)}
                    placeholder={t.bioPlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500 text-xs leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t.bioPlaceholder}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="text-slate-200 block mb-1.5 font-bold text-xs flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-pink-400" />
                    <span>Your Operational City / Area Location</span>
                  </label>
                  <LocationAutocomplete
                    value={companionLocationInput}
                    onChange={(val) => setCompanionLocationInput(val)}
                    onSelectLocation={(item: any) => {
                      setCompanionLocationInput(item.fullAddress || item.address || item.cityValue || item.city || item.label || '');
                      setCompanionCity(item.cityValue || item.city || '');
                      setCompanionState(item.state || '');
                      if (item.lat !== undefined && item.lng !== undefined) {
                        setCompanionCoords({ lat: item.lat, lng: item.lng });
                      }
                    }}
                    placeholder="Search and select your city or area (e.g. Golf Garden, Kolkata)..."
                    accentColor="pink"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Nearby clients searching in this area will see your profile sorted by closest distance.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. PHOTOS MANAGEMENT (MAX 6 PHOTOS) */}
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4 text-pink-400" />
                    {t.profilePhotosSection} ({userPhotos.length}/6)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t.profilePhotosHelp}
                  </p>
                </div>
                {(Array.isArray(userPhotos) ? userPhotos : []).length < 6 && (
                  <label className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-pink-300 border border-slate-700 font-semibold text-xs cursor-pointer flex items-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t.profileUploadBtn}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                )}
              </div>

              {/* Photos Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {(Array.isArray(userPhotos) ? userPhotos : []).map((photo, idx) => {
                  const isMain = photo === activeProfilePhoto || (!activeProfilePhoto && idx === 0);
                  return (
                    <div 
                      key={idx} 
                      className={`relative group rounded-xl overflow-hidden aspect-square border-2 transition-all ${
                        isMain ? 'border-pink-500 shadow-md shadow-pink-500/20' : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <img 
                        src={photo} 
                        alt={`Photo ${idx + 1}`} 
                        className="w-full h-full object-cover" 
                      />
                      {isMain ? (
                        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-pink-600 text-white text-[10px] font-bold shadow">
                          {t.profileMainBadge}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetMainPhoto(photo)}
                          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/80 hover:bg-pink-600 hover:text-white text-slate-300 text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-all"
                        >
                          {t.profileSetMainBtn}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-md bg-rose-600/90 text-white hover:bg-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}

                {userPhotos.length < 6 && (
                  <label className="border-2 border-dashed border-slate-800 hover:border-pink-500/60 rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer aspect-square bg-slate-900/40 hover:bg-slate-900/80 transition-colors">
                    <Upload className="w-5 h-5 text-slate-400 mb-1" />
                    <span className="text-[11px] text-slate-400 font-medium">+ {t.profileUploadBtn}</span>
                    <span className="text-[9px] text-slate-500">Max 6</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* 3. LOCKED IDENTITY CREDENTIALS */}
            <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {t.profileLockedIdentityTitle}
                </h4>
              </div>
              <p className="text-[11px] text-slate-400">
                {t.profileLockedIdentityHelp}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <span className="text-slate-500 text-[11px] mb-1 flex items-center justify-between">
                    {t.profileLegalNameLocked}
                    <Lock className="w-3 h-3 text-slate-500" />
                  </span>
                  <span className="font-semibold text-slate-300">{user?.legalName}</span>
                  <span className="text-[10px] text-pink-400/80 mt-1">KYC Verified · Hidden from clients</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <span className="text-slate-500 text-[11px] mb-1 flex items-center justify-between">
                    {t.profileDobLocked}
                    <Lock className="w-3 h-3 text-slate-500" />
                  </span>
                  <span className="font-semibold text-slate-300">{user?.dob || 'Verified at KYC'} ({user?.age || 26} yrs)</span>
                  <span className="text-[10px] text-emerald-400/80 mt-1">Age 18+ Locked</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <span className="text-slate-500 text-[11px] mb-1 flex items-center justify-between">
                    {t.profilePhoneLocked}
                    <Lock className="w-3 h-3 text-slate-500" />
                  </span>
                  <span className="font-semibold text-slate-300 font-mono">{user?.phone}</span>
                  <span className="text-[10px] text-slate-500 mt-1">OTP Verified</span>
                </div>
              </div>
            </div>

            {/* Bottom Save Action */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={profileSaving}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-600/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {profileSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t.profileSavingBtn}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t.profileSaveBtn}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: KYC STATUS */}
        {activeTab === 'kyc-status' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-pink-400" />
              Government KYC Verification
            </h3>

            {(user?.kycStatus === 'REJECTED' || user?.kycRejectionReason) ? (
              <div className="p-5 rounded-xl border bg-red-950/30 border-red-500/40 text-red-200 space-y-3">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <div>
                    <span className="font-bold text-red-300 block text-sm">
                      KYC Verification Rejected
                    </span>
                    <span className="text-[11px] text-red-400">
                      Action required to activate your companion host profile.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/80 border border-red-500/30 space-y-1">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">
                    Reason for Rejection:
                  </span>
                  <p className="text-amber-300 font-medium text-xs">
                    {user?.kycRejectionReason || 'Document photo blur or unreadable. Please re-upload clear photos.'}
                  </p>
                </div>

                <button
                  onClick={() => {
                    refreshUserData();
                    openKycWizard();
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold text-xs hover:from-pink-500 hover:to-rose-500 transition-all cursor-pointer"
                >
                  Fix & Re-upload KYC Documents
                </button>
              </div>
            ) : (
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
            )}
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
                disabled={savingServicesAndRates}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {savingServicesAndRates ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Services</span>
                )}
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
              disabled={savingServicesAndRates}
              className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {savingServicesAndRates ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating Pricing...</span>
                </>
              ) : (
                <span>Update Pricing</span>
              )}
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
                disabled={togglingOnline}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isAvailabilityPaused ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                }`}
              >
                {isAvailabilityPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isAvailabilityPaused ? 'Go Online (Resume)' : 'Go Offline (Pause)'}</span>
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
              disabled={savingServicesAndRates}
              className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {savingServicesAndRates ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Schedule...</span>
                </>
              ) : (
                <span>Save Schedule</span>
              )}
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

            {statusData?.profile?.bankDetails?.isVerified && !isEditingBank ? (
              <div className="p-6 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base shadow-sm">
                      ✓
                    </div>
                    <div>
                      <span className="font-extrabold text-sm text-slate-100 block">Bank Account Verified & Active (Gate 3)</span>
                      <span className="text-[11px] text-emerald-400">All session payouts are routed to this verified account after 48h UTC hold.</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                    GATE 3 COMPLETE
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Account Holder</span>
                    <span className="text-slate-100 font-bold block mt-0.5">
                      {statusData.profile.bankDetails.accountHolderName || user?.legalName || 'Verified Companion'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Account Number</span>
                    <span className="text-slate-100 font-mono font-bold block mt-0.5">
                      {statusData.profile.bankDetails.accountNumberMasked || '••••••••' + (statusData.profile.bankDetails.accountNumber?.slice(-4) || '1234')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">IFSC Code</span>
                    <span className="text-slate-100 font-mono font-bold block mt-0.5">
                      {statusData.profile.bankDetails.ifsc || 'Verified'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800/80">
                  <p className="text-[11px] text-slate-400">
                    Need to change your payout destination bank account?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingBank(true);
                      setAccountHolderName(statusData.profile.bankDetails.accountHolderName || user?.legalName || '');
                      setIfsc(statusData.profile.bankDetails.ifsc || '');
                      setAccountNumber('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                  >
                    <span>Change Bank Account</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyBank} className="space-y-4">
                {isEditingBank && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 text-sky-200">
                    <span>Updating bank payout details. Existing verified account remains active until new details are verified.</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingBank(false)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}

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

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={bankSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold"
                  >
                    {bankSubmitting ? 'Verifying Account...' : (isEditingBank ? 'Save & Re-Verify Bank Account' : 'Submit Bank Verification')}
                  </button>
                  {isEditingBank && (
                    <button
                      type="button"
                      onClick={() => setIsEditingBank(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 9: BOOKING REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-100">Pending & Confirmed Booking Requests</h3>
            
            {/* 1. Pending Requests Waiting for Companion Decision */}
            {pendingRequests.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Awaiting Your Response ({pendingRequests.length})</span>
                </h4>
                {pendingRequests.map(b => (
                  <div key={b.id} className="p-4 rounded-2xl bg-slate-900 border-2 border-amber-500/50 space-y-3 shadow-lg shadow-amber-500/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-sm text-slate-100 block">{b.serviceName} ({b.bookingCode})</span>
                        {(() => {
                          const { formattedDate, formattedTime } = formatFullDateTime(b.date || b.createdAt, b.startTime);
                          return (
                            <div className="flex flex-wrap items-center gap-2 text-slate-400 text-xs mt-1">
                              <span>Client: <strong className="text-pink-300">{b.clientName}</strong></span>
                              <span>·</span>
                              <span className="flex items-center gap-1 text-slate-300">
                                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                                <strong>{formattedDate}</strong>
                              </span>
                              {formattedTime && (
                                <span className="flex items-center gap-1 text-amber-300">
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{formattedTime} {b.endTime ? `- ${b.endTime}` : ''} ({b.durationHours || 1} hr)</span>
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-bold animate-pulse">ACTION REQUIRED</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span>Venue: <strong className="text-slate-200">{b.meetingLocation}</strong></span>
                      <span className="text-emerald-400 font-bold">Your Share: ₹{(((Number(b.companionNetSharePaise) || Math.round((Number(b.amountPaise || b.baseAmountPaise) || 49900) * 0.85)) / 100)).toFixed(2)}</span>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleRejectIncomingBooking(b.id)}
                        className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5 text-rose-400" />
                        <span>Decline</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAcceptIncomingBooking(b.id)}
                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-extrabold shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept Booking</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. Confirmed & Upcoming Requests */}
            {upcomingBookings.length === 0 && pendingRequests.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
                No active booking requests currently waiting.
              </div>
            ) : (
              upcomingBookings.map(b => (
                <div key={b.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-100 block">{b.serviceName} ({b.bookingCode})</span>
                      {(() => {
                        const { formattedDate, formattedTime } = formatFullDateTime(b.date || b.createdAt, b.startTime);
                        return (
                          <div className="flex flex-wrap items-center gap-2 text-slate-400 text-xs mt-1">
                            <span>Client: <strong className="text-pink-300">{b.clientName}</strong></span>
                            <span>·</span>
                            <span className="flex items-center gap-1 text-slate-300">
                              <Calendar className="w-3.5 h-3.5 text-purple-400" />
                              <strong>{formattedDate}</strong>
                            </span>
                            {formattedTime && (
                              <span className="flex items-center gap-1 text-amber-300">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span>{formattedTime} {b.endTime ? `- ${b.endTime}` : ''} ({b.durationHours || 1} hr)</span>
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 font-bold">{b.status}</span>
                      <button
                        onClick={() => {
                          setActiveChatBooking(b);
                          setActiveTab('chat');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold flex items-center gap-1 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Chat</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 gap-2">
                    <div>
                      <span className="text-slate-400">Meeting Venue: </span>
                      <strong className="text-slate-200">{b.meetingLocation}</strong>
                      {b.meetingLocation && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.meetingLocation)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 ml-2 text-sky-400 hover:text-sky-300 font-semibold underline text-xs"
                        >
                          <Navigation className="w-3 h-3 inline" />
                          <span>Map Directions</span>
                        </a>
                      )}
                    </div>
                    <span className="text-emerald-400 font-bold">Your Share: ₹{(((Number(b.companionNetSharePaise) || Math.round((Number(b.amountPaise || b.baseAmountPaise) || 49900) * 0.85)) / 100)).toFixed(2)}</span>
                  </div>

                  {b.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleSlideMeetingArrived(b.id)}
                      className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-500 transition-colors"
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

            {/* CELEBRATION EARNINGS MODAL OVERLAY */}
            {completedBookingEarned && (
              <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
                <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/80 border-2 border-emerald-500/60 shadow-2xl shadow-emerald-500/20 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/30">
                    🎉
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-100">
                      Congratulations, {user?.profileName || user?.legalName || 'Companion'}!
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Session Completed Successfully • Booking #{completedBookingEarned.code}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">
                      Your Net Share (85%)
                    </span>
                    <span className="text-3xl font-black text-emerald-400 block my-1">
                      ₹{(completedBookingEarned.amountPaise / 100).toFixed(2)}
                    </span>
                    <span className="text-[11px] text-emerald-300/90 font-medium">
                      ✓ Credited to your Escrow / Wallet balance
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    According to platform safety policy, your earnings are secured in 48-hour UTC Escrow and will automatically settle to your verified bank account.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      onClick={() => {
                        setCompletedBookingEarned(null);
                        setActiveTab('wallet');
                      }}
                      className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/25 cursor-pointer"
                    >
                      View Wallet Balance 💳
                    </button>
                    <button
                      onClick={() => setCompletedBookingEarned(null)}
                      className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Done / Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {upcomingBookings.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
                No active or upcoming meetings found. Confirmed bookings will appear here once accepted and paid.
              </div>
            ) : (
              upcomingBookings.map(b => (
                <div key={b.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  {/* CLIENT PROFILE & BOOKING HEADER */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={b.clientPhoto || '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png'}
                        alt={b.clientName || 'Client'}
                        className="w-12 h-12 rounded-full object-cover border-2 border-pink-500 shadow-md shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-100 text-sm">{b.clientName || 'Client'}</span>
                          <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold text-[10px] border border-pink-500/30">
                            {b.serviceName}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block font-mono">
                          Booking ID: {b.bookingCode || b.id?.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 font-extrabold text-xs border border-sky-500/30">
                        {b.status}
                      </span>
                    </div>
                  </div>

                  {/* SCHEDULE TIME, DURATION & CLIENT DETAILS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-pink-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Schedule Slot</span>
                        <span className="font-bold text-slate-200">{b.date} • {b.startTime} - {b.endTime}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Duration</span>
                        <span className="font-bold text-slate-200">{b.durationHours || 1} Hour(s) Session</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Your Net Earnings (85%)</span>
                        <span className="font-bold text-emerald-400">
                          ₹{(((Number(b.companionNetSharePaise) || Math.round((Number(b.bookingAmountPaise || b.amountPaise || b.baseAmountPaise) || 49900) * 0.85)) / 100)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {b.notes && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 italic">
                      <span className="font-semibold text-slate-400 not-italic block text-[10px] uppercase mb-0.5">Client Note:</span>
                      "{b.notes}"
                    </div>
                  )}

                  {/* ACTION TABS: GET BOOKING LOCATION & CHAT WITH CLIENT */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Booked Meeting Venue</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <MapPin className="w-4 h-4 text-pink-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-100 truncate">{b.meetingLocation || b.bookingLocationName || b.booking_location_name || 'Specified Meeting Venue'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(b.meetingLocation || b.bookingLocationName || b.booking_location_name) && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.meetingLocation || b.bookingLocationName || b.booking_location_name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Get Booking Location</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActiveChatBooking(b);
                          setActiveTab('chat');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-pink-500/20 transition-all cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat with Client</span>
                      </button>
                    </div>
                  </div>

                  {/* 0. ARRIVAL TRIGGER (If still in CONFIRMED status) */}
                  {b.status === 'CONFIRMED' && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-xs text-amber-300">
                        Have you arrived at the venue? Click to record your arrival and dispatch the 6-digit Start OTP to the client's registered phone.
                      </span>
                      <button
                        onClick={() => handleSlideMeetingArrived(b.id)}
                        className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-500 shrink-0 text-xs transition-colors"
                      >
                        I Have Arrived at Location
                      </button>
                    </div>
                  )}

                  {/* 1. START OTP INPUT FORM */}
                  {!b.startOtpVerified && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-amber-300 text-sm">Step 1: Enter 4-Digit Session OTP</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        The client displays this 4-digit security OTP on their live dashboard. Enter the code below to verify arrival, stop live tracking, and start the official session timer.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="4-digit Session OTP"
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
                          Verify & Start Session
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. IN-PROGRESS COUNTDOWN & COMPLETION OTP FORM */}
                  {b.startOtpVerified && !b.endOtpVerified && (
                    <div className="space-y-4">
                      {/* LIVE COUNTDOWN TIMER */}
                      <MeetingCountdown booking={b} />

                      {/* COMPLETION OTP INPUT FORM */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-emerald-400" />
                          <span className="font-bold text-emerald-300 text-sm">Step 2: Enter Meeting Ending OTP</span>
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          Once the scheduled slot finishes, ask the client for their 6-digit Completion OTP (unlocked automatically on their dashboard) to finalize the session and claim your earnings.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit Ending OTP"
                            value={endOtpInputs[b.id] || ''}
                            onChange={e => setEndOtpInputs({ ...endOtpInputs, [b.id]: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-center font-mono font-bold text-emerald-400 text-sm max-w-[200px]"
                          />
                          <button
                            onClick={() => handleCompleteBooking(b.id)}
                            className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition-colors"
                          >
                            Complete Session & Claim Earnings
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 11: BOOKING HISTORY with DATE & TIME FILTERS */}
        {activeTab === 'history' && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-emerald-400" />
                  <span>Past Completed Sessions</span>
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Filtered by schedule date and completion timestamp with 85% companion payout breakdown.
                </p>
              </div>

              {/* Timeframe Filter Bar */}
              <TimeframeFilterBar
                selected={companionHistoryTimeframe}
                onChange={setCompanionHistoryTimeframe}
                counts={{
                  all: pastBookings.length,
                  today: pastBookings.filter(b => matchesTimeframe(b.date || b.createdAt, 'today')).length,
                  '7days': pastBookings.filter(b => matchesTimeframe(b.date || b.createdAt, '7days')).length,
                  monthly: pastBookings.filter(b => matchesTimeframe(b.date || b.createdAt, 'monthly')).length,
                }}
                theme="purple"
              />
            </div>

            {(() => {
              const filteredPastBookings = pastBookings.filter(b => {
                const dateToCheck = b.date || b.createdAt || b.created_at;
                return matchesTimeframe(dateToCheck, companionHistoryTimeframe);
              });

              const totalEarnedPeriodPaise = filteredPastBookings
                .filter(b => b.status === 'COMPLETED')
                .reduce((acc, b) => acc + (Number(b.companionNetSharePaise) || Math.round((Number(b.amountPaise || b.baseAmountPaise) || 49900) * 0.85)), 0);

              return (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-950 to-pink-950/30 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block">
                        Net Earnings ({companionHistoryTimeframe === 'all' ? 'All Time' : companionHistoryTimeframe === 'today' ? 'Today' : companionHistoryTimeframe === '7days' ? 'Last 7 Days' : 'This Month'})
                      </span>
                      <span className="text-2xl font-black text-emerald-400">
                        ₹{(totalEarnedPeriodPaise / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-slate-400 sm:text-right">
                      <span className="font-bold text-slate-200 block text-sm">
                        {filteredPastBookings.filter(b => b.status === 'COMPLETED').length} Session{filteredPastBookings.filter(b => b.status === 'COMPLETED').length !== 1 ? 's' : ''} Completed
                      </span>
                      <span className="text-[10px] text-purple-300">85% Guaranteed Host Share</span>
                    </div>
                  </div>

                  {filteredPastBookings.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-300">No past sessions found for the selected timeframe.</p>
                      <p className="text-[11px] text-slate-500">Change filter to "All Time" to view your complete record.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredPastBookings.map(b => {
                        const { formattedDate, formattedTime } = formatFullDateTime(b.date || b.createdAt, b.startTime);
                        const netEarned = (((Number(b.companionNetSharePaise) || Math.round((Number(b.amountPaise || b.baseAmountPaise) || 49900) * 0.85)) / 100)).toFixed(2);
                        const isCompleted = b.status === 'COMPLETED';

                        return (
                          <div key={b.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-slate-700 shadow-sm">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-100 text-sm">{b.serviceName || 'Session'}</span>
                                <span className="font-mono text-[10px] text-slate-400">#{b.bookingCode || b.id?.slice(0, 8)}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isCompleted ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' : 'bg-rose-950/60 text-rose-300 border-rose-500/40'}`}>
                                  {b.status}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-[11px]">
                                <span className="flex items-center gap-1 text-slate-300">
                                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                                  <span>{formattedDate}</span>
                                </span>
                                {formattedTime && (
                                  <span className="flex items-center gap-1 text-slate-300">
                                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{formattedTime} {b.endTime ? `- ${b.endTime}` : ''} ({b.durationHours || 1} hr)</span>
                                  </span>
                                )}
                                <span className="text-slate-400">
                                  Client: <strong className="text-pink-300">{b.clientName || 'Client'}</strong>
                                </span>
                              </div>

                              {b.meetingLocation && (
                                <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate max-w-md">
                                  <MapPin className="w-3 h-3 text-pink-400 shrink-0" />
                                  <span className="truncate">Venue: {b.meetingLocation}</span>
                                </div>
                              )}

                              {b.clientReview && (
                                <div className="mt-1.5 p-2 rounded-xl bg-slate-950/80 border border-amber-500/20 flex flex-wrap items-center gap-2 text-xs">
                                  <div className="flex items-center text-amber-400">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star key={i} className={`w-3 h-3 ${i < b.clientReview.rating ? 'fill-amber-400' : 'text-slate-600'}`} />
                                    ))}
                                  </div>
                                  <span className="text-amber-300 font-bold">{b.clientReview.rating}.0★</span>
                                  {b.clientReview.comment && (
                                    <span className="text-slate-300 italic text-[11px]">"{b.clientReview.comment}"</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 flex sm:flex-col items-center sm:items-end justify-between">
                              {isCompleted ? (
                                <>
                                  <span className="text-emerald-400 font-black text-base block">
                                    Earned: +₹{netEarned}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                                    Settlement: <strong className={b.settlementStatus === 'SETTLED' ? 'text-emerald-400' : 'text-amber-400'}>{b.settlementStatus || '48h UTC Hold'}</strong>
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-rose-400 font-black text-base block">
                                    Missed Earning: -₹{netEarned}
                                  </span>
                                  <span className="text-[10px] text-rose-400/90 block font-mono mt-0.5">
                                    {b.cancellationReason || 'Cancelled / Incomplete (₹0.00 Earned)'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 12: SECURE CHAT */}
        {activeTab === 'chat' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-pink-400" />
              Secure Client Chat Channels
            </h3>
            <p className="text-slate-400 text-[11px]">
              Encrypted chat is unlocked once the client completes session booking payment.
            </p>
            {(() => {
              const paidBookings = bookings.filter(b =>
                b.paymentStatus === 'PAID' || b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'COMPLETED'
              );

              if (paidBookings.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-500 rounded-xl bg-slate-950 border border-slate-800">
                    No active client chats. Incoming chats appear once clients complete booking payment.
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {paidBookings.map(b => {
                    const isCompleted = b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'REJECTED';
                    return (
                      <div key={b.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between transition-all hover:border-slate-700">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">{b.clientName || 'Client'}</span>
                            {isCompleted ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-semibold">Session Ended (Read-Only)</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold">Active Chat</span>
                            )}
                          </div>
                          <span className="text-slate-500 block text-[11px] mt-0.5">Booking {b.bookingCode} · {b.serviceName || 'Session'}</span>
                        </div>
                        <button
                          onClick={() => setActiveChatBooking(b)}
                          className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                            isCompleted ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-pink-600 hover:bg-pink-500 text-white'
                          }`}
                        >
                          {isCompleted ? 'View History' : 'Open Chat'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 13: SECURE WALLET with DATE & TIMEFRAME FILTERS */}
        {activeTab === 'wallet' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <span>Companion Secure Wallet & Payout Ledger</span>
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Track your period earnings, 48h safety escrow, and verified bank payouts.
                </p>
              </div>

              {/* Timeframe Filter Bar */}
              {(() => {
                const completedBookings = (Array.isArray(bookings) ? bookings : []).filter(b => b && b.status === 'COMPLETED');
                return (
                  <TimeframeFilterBar
                    selected={walletTimeframe}
                    onChange={setWalletTimeframe}
                    counts={{
                      all: completedBookings.length,
                      today: completedBookings.filter(b => matchesTimeframe(b.date || b.createdAt || b.created_at, 'today')).length,
                      '7days': completedBookings.filter(b => matchesTimeframe(b.date || b.createdAt || b.created_at, '7days')).length,
                      monthly: completedBookings.filter(b => matchesTimeframe(b.date || b.createdAt || b.created_at, 'monthly')).length,
                    }}
                    theme="emerald"
                  />
                );
              })()}
            </div>

            {(() => {
              const completedBookings = (Array.isArray(bookings) ? bookings : []).filter(b => b && b.status === 'COMPLETED');
              const filteredWalletBookings = completedBookings.filter(b => {
                const dateToCheck = b.date || b.createdAt || b.created_at;
                return matchesTimeframe(dateToCheck, walletTimeframe);
              });

              const periodTotalEarnedPaise = filteredWalletBookings.reduce((acc, b) => {
                const share = Number(b.companionNetSharePaise) || Math.round((Number(b.amountPaise || b.baseAmountPaise) || 49900) * 0.85);
                return acc + share;
              }, 0);

              const periodTotalSettledPaise = filteredWalletBookings
                .filter(b => b.settlementStatus === 'SETTLED')
                .reduce((acc, b) => {
                  const share = Number(b.companionNetSharePaise) || Math.round((Number(b.amountPaise || b.baseAmountPaise) || 49900) * 0.85);
                  return acc + share;
                }, 0);

              const periodPendingEscrowPaise = filteredWalletBookings
                .filter(b => b.settlementStatus !== 'SETTLED')
                .reduce((acc, b) => {
                  const share = Number(b.companionNetSharePaise) || Math.round((Number(b.amountPaise || b.baseAmountPaise) || 49900) * 0.85);
                  return acc + share;
                }, 0);

              return (
                <div className="space-y-6">
                  {/* Period Stats Overview Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block mb-1 text-[11px]">Period Total Earnings</span>
                      <span className="text-xl font-black text-emerald-400">
                        ₹{(periodTotalEarnedPaise / 100).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">85% Net Partner Share</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block mb-1 text-[11px]">In 48h UTC Safety Hold</span>
                      <span className="text-xl font-bold text-amber-400">
                        ₹{(periodPendingEscrowPaise / 100).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-amber-500/80 block mt-0.5">Awaiting hold expiration</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block mb-1 text-[11px]">Period Settled Payouts</span>
                      <span className="text-xl font-bold text-sky-400">
                        ₹{(periodTotalSettledPaise / 100).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-sky-500/80 block mt-0.5">Disbursed to Bank</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block mb-1 text-[11px]">Sessions in Filter</span>
                      <span className="text-xl font-bold text-slate-100">
                        {filteredWalletBookings.length}
                      </span>
                      <span className="text-[10px] text-purple-400 block mt-0.5">
                        {walletTimeframe === 'all' ? 'All Time Total' : walletTimeframe === 'today' ? 'Today Only' : walletTimeframe === '7days' ? 'Past 7 Days' : 'This Month'}
                      </span>
                    </div>
                  </div>

                  {/* Itemized Session Earnings with Explicit Date & Time */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Itemized Session Earnings ({filteredWalletBookings.length})</span>
                      </h4>
                      <span className="text-[11px] text-slate-400">Calculated in real-time</span>
                    </div>

                    {filteredWalletBookings.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 rounded-xl bg-slate-950 border border-slate-800">
                        No completed sessions found in this timeframe. Switch to "All Time" to view all records.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredWalletBookings.map(b => {
                          const { formattedDate, formattedTime } = formatFullDateTime(b.date || b.createdAt, b.startTime);
                          const netShare = (((Number(b.companionNetSharePaise) || Math.round((Number(b.amountPaise || b.baseAmountPaise) || 49900) * 0.85)) / 100)).toFixed(2);
                          const isSettled = b.settlementStatus === 'SETTLED';

                          return (
                            <div key={b.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all hover:border-slate-700">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-200">{b.serviceName || 'Session'}</span>
                                  <span className="font-mono text-[10px] text-slate-500">#{b.bookingCode}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isSettled ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                    {isSettled ? 'BANK SETTLED' : '48H UTC ESCROW'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-[11px]">
                                  <span className="flex items-center gap-1 text-slate-300">
                                    <Calendar className="w-3 h-3 text-purple-400" />
                                    <span>{formattedDate}</span>
                                  </span>
                                  {formattedTime && (
                                    <span className="flex items-center gap-1 text-slate-300">
                                      <Clock className="w-3 h-3 text-amber-400" />
                                      <span>{formattedTime}</span>
                                    </span>
                                  )}
                                  <span>Client: <strong className="text-pink-300">{b.clientName || 'Client'}</strong></span>
                                </div>
                              </div>

                              <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 flex sm:flex-col items-center sm:items-end justify-between">
                                <span className="text-emerald-400 font-extrabold text-sm block">
                                  +₹{netShare}
                                </span>
                                <span className="text-[10px] text-slate-500 block font-mono">
                                  {isSettled ? 'Paid via Bank Transfer' : 'Auto-unlocks after 48h UTC'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Payout Policy Explainer */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-slate-400 leading-relaxed text-[11px] flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-200 block mb-0.5">Automated Safety Escrow Protocol</strong>
                      Payouts are held in 48-hour UTC escrow to ensure safety and dispute resolution for both parties. Upon lock expiration, the platform disburses 85% companion earnings directly into your verified bank account with automated UTR confirmation.
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 14: LOCKED EARNINGS (48H UTC) with DATE & TIMEFRAME FILTERS */}
        {activeTab === 'locked-earnings' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>48-Hour UTC Settlement Safety Hold Ledger</span>
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Each session's net earning is held securely under a 48-hour UTC lock to guarantee dispute-free settlement.
                </p>
              </div>

              {/* Timeframe Filter Bar */}
              {(() => {
                const completedBookings = (Array.isArray(bookings) ? bookings : []).filter(b => b && b.status === 'COMPLETED');
                return (
                  <TimeframeFilterBar
                    selected={lockedEarningsTimeframe}
                    onChange={setLockedEarningsTimeframe}
                    counts={{
                      all: completedBookings.length,
                      today: completedBookings.filter(b => matchesTimeframe(b.date || b.createdAt || b.created_at, 'today')).length,
                      '7days': completedBookings.filter(b => matchesTimeframe(b.date || b.createdAt || b.created_at, '7days')).length,
                      monthly: completedBookings.filter(b => matchesTimeframe(b.date || b.createdAt || b.created_at, 'monthly')).length,
                    }}
                    theme="dark"
                  />
                );
              })()}
            </div>

            {(() => {
              const completedBookings = (Array.isArray(bookings) ? bookings : []).filter(b => b && b.status === 'COMPLETED');
              const filteredLockedBookings = completedBookings.filter(b => {
                const dateToCheck = b.date || b.createdAt || b.created_at;
                return matchesTimeframe(dateToCheck, lockedEarningsTimeframe);
              });

              const totalLockedPeriodPaise = filteredLockedBookings
                .filter(b => b.settlementStatus !== 'SETTLED')
                .reduce((acc, b) => acc + (Number(b.companionNetSharePaise) || Math.round((Number(b.amountPaise || b.baseAmountPaise) || 49900) * 0.85)), 0);

              return (
                <div className="space-y-4">
                  {/* Summary Banner */}
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-amber-300 font-bold block text-sm">Escrow Hold Balance</span>
                      <span className="text-[11px] text-amber-400/80">Pending completion of 48-hour UTC hold for selected timeframe</span>
                    </div>
                    <span className="text-xl font-black text-amber-400">
                      ₹{(totalLockedPeriodPaise / 100).toFixed(2)}
                    </span>
                  </div>

                  {filteredLockedBookings.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 rounded-xl bg-slate-950 border border-slate-800">
                      No escrow records found for the selected timeframe.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredLockedBookings.map(b => {
                        const { formattedDate, formattedTime } = formatFullDateTime(b.date || b.createdAt, b.startTime);
                        const netAmount = (((Number(b.companionNetSharePaise) || Math.round((Number(b.amountPaise || b.baseAmountPaise) || 49900) * 0.85)) / 100)).toFixed(2);
                        const unlockUtcDate = b.settlementUnlockUtc ? new Date(b.settlementUnlockUtc) : null;
                        const isUnlocked = unlockUtcDate ? unlockUtcDate.getTime() <= Date.now() : false;
                        const localUnlockStr = unlockUtcDate ? unlockUtcDate.toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        }) : 'Pending Verification';

                        return (
                          <div key={b.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-slate-700">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-200">{b.serviceName}</span>
                                <span className="font-mono text-[10px] text-slate-500">#{b.bookingCode}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  b.settlementStatus === 'SETTLED'
                                    ? 'bg-sky-500/20 text-sky-300'
                                    : isUnlocked
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {b.settlementStatus === 'SETTLED' ? 'SETTLED TO BANK' : isUnlocked ? 'HOLD ELAPSED (READY FOR DISBURSAL)' : 'UNDER 48H UTC HOLD'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-[11px]">
                                <span className="flex items-center gap-1 text-slate-300">
                                  <Calendar className="w-3 h-3 text-purple-400" />
                                  <span>Session: {formattedDate} {formattedTime ? `(${formattedTime})` : ''}</span>
                                </span>
                                <span>Client: <strong className="text-pink-300">{b.clientName || 'Client'}</strong></span>
                              </div>

                              <div className="flex items-center gap-1 text-[11px] text-amber-300/90 font-mono">
                                <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>Unlocks: {localUnlockStr} (UTC: {unlockUtcDate ? unlockUtcDate.toUTCString().slice(0, 22) : 'Pending'})</span>
                              </div>
                            </div>

                            <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 flex sm:flex-col items-center sm:items-end justify-between">
                              <span className="font-extrabold text-amber-400 text-sm block">
                                ₹{netAmount}
                              </span>
                              <span className="text-[10px] text-slate-500 block font-mono">
                                Status: {b.settlementStatus || '48h Hold'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 15: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-pink-400" />
                Companion Host Notifications
              </h3>
              <span className="text-xs text-slate-400 font-medium">{notifications.length} alerts</span>
            </div>

            {/* Quick Go Live (Online / Offline) Card */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
              !isAvailabilityPaused
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-start sm:items-center gap-3">
                <span className="relative flex h-3 w-3 shrink-0 mt-1 sm:mt-0">
                  {!isAvailabilityPaused && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${!isAvailabilityPaused ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                </span>
                <div>
                  <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <span>Live Discovery Status:</span>
                    <span className={!isAvailabilityPaused ? 'text-emerald-400' : 'text-amber-400'}>
                      {!isAvailabilityPaused ? 'ONLINE (Accepting Bookings)' : 'OFFLINE (Paused)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {!isAvailabilityPaused
                      ? 'You are active & visible to nearby clients searching for companions in your area.'
                      : 'You are currently offline and hidden from search results. Go online to receive bookings.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleAvailabilityPause}
                disabled={togglingOnline}
                className={`px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                  !isAvailabilityPaused
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                {!isAvailabilityPaused ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{!isAvailabilityPaused ? 'Switch to Offline' : 'Go Live / Online Now'}</span>
              </button>
            </div>

            {(Array.isArray(notifications) ? notifications : []).length === 0 ? (
              <div className="p-8 text-center text-slate-500">No new alerts.</div>
            ) : (
              <div className="space-y-2.5">
                {(Array.isArray(notifications) ? notifications : []).map(n => {
                  const isKycReject = 
                    n.type === 'KYC_REJECTED' || 
                    n.data?.type === 'KYC_REJECTED' || 
                    n.data?.action === 'OPEN_KYC_WIZARD' || 
                    (typeof n.title === 'string' && /kyc|verification|document/i.test(n.title)) || 
                    (typeof n.message === 'string' && /kyc|re-upload|rejection|blur|rejected/i.test(n.message));
                  const isBooking = n.type?.includes('BOOKING') || n.title?.includes('Booking') || n.title?.includes('Session');
                  const isMembership = n.type?.includes('MEMBERSHIP') || n.title?.includes('Membership');
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (isKycReject) {
                          refreshUserData();
                          setActiveTab('kyc-status');
                          openKycWizard();
                        } else if (isBooking) {
                          setActiveTab('upcoming');
                        } else if (isMembership) {
                          setActiveTab('membership');
                        }
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isKycReject
                          ? 'bg-red-950/25 border-red-500/40 hover:border-red-400 shadow-sm'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold block ${isKycReject ? 'text-red-300' : 'text-slate-200'}`}>
                          {n.title}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(n.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{n.message}</p>
                      {isKycReject && (
                        <div className="mt-2.5 pt-2 border-t border-red-500/20 flex items-center justify-between">
                          <span className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                            ⚠️ Tap to Fix & Re-upload Documents
                          </span>
                          <span className="text-[10px] text-pink-400 underline font-bold">Open KYC Wizard →</span>
                        </div>
                      )}
                      {isBooking && (
                        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                          <span className="text-[11px] text-pink-400">Tap to manage bookings</span>
                          <span className="text-[10px] text-slate-400 font-bold">View →</span>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                  <span className="font-bold text-slate-200 block">Go Live (Online / Offline) Status</span>
                  <span className="text-slate-500 text-[11px]">
                    Current status: <strong className={!isAvailabilityPaused ? 'text-emerald-400' : 'text-amber-400'}>
                      {!isAvailabilityPaused ? 'ONLINE (Live to clients)' : 'OFFLINE (Paused)'}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAvailabilityPause}
                  disabled={togglingOnline}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    isAvailabilityPaused ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {isAvailabilityPaused ? 'Go Online' : 'Go Offline'}
                </button>
              </div>
            </div>

            {/* ── CHANGE PASSWORD ── */}
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3">
              <h4 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4 text-pink-400" />
                Change Password
              </h4>
              <p className="text-slate-500 text-[11px]">
                Registered number: <span className="text-slate-300 font-mono">{user?.phone || '—'}</span>
              </p>

              {cpMsg && (
                <div className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${cpMsg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'}`}>
                  {cpMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{cpMsg.text}</span>
                </div>
              )}

              {!cpOtpSent ? (
                <button
                  onClick={handleSendCpOtp}
                  disabled={cpLoading || cpCountdown > 0}
                  className="w-full py-2.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 font-bold border border-pink-500/30 disabled:opacity-50 transition-colors"
                >
                  {cpLoading ? 'Sending OTP...' : cpCountdown > 0 ? `Resend in ${cpCountdown}s` : 'Send OTP to Change Password'}
                </button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Enter OTP</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔑</span>
                      <input
                        type="text"
                        value={cpOtp}
                        onChange={e => setCpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        placeholder="6-digit OTP"
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono tracking-widest text-sm focus:outline-none focus:border-pink-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="password"
                        value={cpNewPassword}
                        onChange={e => setCpNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-pink-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="password"
                        value={cpConfirmPassword}
                        onChange={e => setCpConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-pink-400"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setCpOtpSent(false); setCpOtp(''); setCpNewPassword(''); setCpConfirmPassword(''); setCpMsg(null); setCpCountdown(0); }}
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={cpLoading}
                      className="flex-1 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-xs disabled:opacity-50"
                    >
                      {cpLoading ? 'Saving...' : 'Save New Password'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendCpOtp}
                    disabled={cpCountdown > 0 || cpLoading}
                    className="text-[11px] text-pink-400 hover:text-pink-300 underline disabled:opacity-50"
                  >
                    {cpCountdown > 0 ? `Resend OTP in ${cpCountdown}s` : 'Resend OTP'}
                  </button>
                </form>
              )}
            </div>

            {/* ── DELETE ACCOUNT ── */}
            <div className="rounded-xl bg-red-950/30 border border-red-500/30 p-4 space-y-3">
              <h4 className="font-bold text-red-300 flex items-center gap-2 text-sm">
                <Trash2 className="w-4 h-4 text-red-400" />
                Delete Account
              </h4>

              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> ATTENTION: This action is permanent and cannot be undone.
                </p>
                <p className="text-red-400/80">Deleting your account will permanently erase all your KYC documents, membership records, bank verifications, chat history, booking records, wallet data, and all associated platform data.</p>
              </div>

              {daMsg && (
                <div className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${daMsg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'}`}>
                  {daMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{daMsg.text}</span>
                </div>
              )}

              {!daOtpSent ? (
                <button
                  onClick={handleSendDaOtp}
                  disabled={daLoading || daCountdown > 0}
                  className="w-full py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold border border-red-500/30 disabled:opacity-50 transition-colors"
                >
                  {daLoading ? 'Sending OTP...' : daCountdown > 0 ? `Resend in ${daCountdown}s` : 'Request Deletion OTP'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Enter OTP</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔑</span>
                      <input
                        type="text"
                        value={daOtp}
                        onChange={e => setDaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        placeholder="6-digit OTP"
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-red-500/30 rounded-lg text-slate-100 font-mono tracking-widest text-sm focus:outline-none focus:border-red-400"
                      />
                    </div>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={daConfirm}
                      onChange={e => setDaConfirm(e.target.checked)}
                      className="w-4 h-4 mt-0.5 accent-red-500 shrink-0"
                    />
                    <span className="text-[11px] text-slate-400">I understand that all my data will be <strong className="text-red-400">permanently and irreversibly erased</strong>.</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setDaOtpSent(false); setDaOtp(''); setDaConfirm(false); setDaMsg(null); setDaCountdown(0); }}
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={daLoading || !daConfirm || daOtp.length !== 6}
                      className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs disabled:opacity-50 transition-colors"
                    >
                      {daLoading ? 'Deleting...' : 'Permanently Delete'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendDaOtp}
                    disabled={daCountdown > 0 || daLoading}
                    className="text-[11px] text-red-400 hover:text-red-300 underline disabled:opacity-50"
                  >
                    {daCountdown > 0 ? `Resend OTP in ${daCountdown}s` : 'Resend OTP'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        </main>

        {/* ─── MOBILE FIXED BOTTOM NAV ─── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-purple-100 z-40 px-3 py-2 flex items-center justify-around shadow-lg">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'text-[#6D28D9]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`relative flex flex-col items-center gap-1 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === 'requests' ? 'text-[#6D28D9]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>Requests</span>
            {pendingBookings.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-extrabold px-1">
                {pendingBookings.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('upcoming')}
            className={`relative flex flex-col items-center gap-1 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === 'upcoming' ? 'text-[#6D28D9]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Navigation className="w-5 h-5" />
            <span>Sessions</span>
            {upcomingBookings.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === 'wallet' ? 'text-[#6D28D9]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span>Earnings</span>
          </button>

          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
            <span>Menu</span>
          </button>
        </nav>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openReportModal(activeChatBooking)}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Report incident to Admin"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Report Us</span>
                </button>
                <button
                  onClick={() => setActiveChatBooking(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Body */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {(Array.isArray(chatMessages) ? chatMessages : []).length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  No messages yet. Send a greeting to coordinate your meeting!
                </div>
              ) : (
                (Array.isArray(chatMessages) ? chatMessages : []).map(m => (
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
            {user?.isSuspended ? (
              <div className="p-3 bg-slate-950 border-t border-slate-800 text-center text-xs text-rose-400 font-medium">
                🚫 Your account is suspended. Messaging has been disabled.
              </div>
            ) : (activeChatBooking.status === 'COMPLETED' || activeChatBooking.status === 'CANCELLED' || activeChatBooking.status === 'REJECTED') ? (
              <div className="p-3.5 bg-slate-950 border-t border-slate-800 text-center text-xs text-amber-400 font-semibold flex items-center justify-center gap-2">
                <span>🔒</span>
                <span>Meeting Completed (Session Ended) — Chat is read-only.</span>
              </div>
            ) : (
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
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold text-xs cursor-pointer"
                >
                  Send
                </button>
              </form>
            )}

          </div>
        </div>
      )}

      {/* REPORT US MODAL */}
      {reportModalOpen && reportBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Report Us · Incident Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div>Booking Code: <strong className="text-pink-400">#{reportBooking.bookingCode}</strong></div>
              <div>Reported Party: <strong className="text-slate-200">{reportBooking.clientName || 'Client'}</strong></div>
              <p className="text-[11px] text-slate-400 pt-1">
                Your report is confidential and delivered straight to the Platform Safety & Admin Desk.
              </p>
            </div>

            {reportFeedback && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                reportFeedback.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {reportFeedback.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{reportFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReport} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Select Reason *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Inappropriate behavior / misconduct',
                    'Demand for off-platform payment',
                    'Safety or comfort rule violation',
                    'Abusive or threatening language',
                    'Did not arrive / Misleading client',
                    'Other platform policy breach'
                  ].map(reason => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setReportReason(reason)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer ${
                        reportReason === reason
                          ? 'bg-rose-500 text-white font-bold shadow'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Describe what happened *
                </label>
                <textarea
                  rows={4}
                  required
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  placeholder="Please describe the incident in detail so our safety admins can investigate..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportLoading || !reportReason || !reportDetails.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer shadow-md shadow-rose-600/30"
                >
                  {reportLoading ? 'Sending Report...' : 'Submit Incident Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMED BOOKING PAYMENT INSTANT ALERT MODAL */}
      {confirmedBookingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-6 text-slate-100 space-y-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <CheckCircle2 className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-1.5">
                    <span>🎉</span>
                    <span>Booking Confirmed & Paid!</span>
                  </h3>
                  <p className="text-[11px] text-emerald-400 font-semibold">
                    Client payment is confirmed. Secure chat and venue are unlocked.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmedBookingAlert(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Client Profile & Service Card */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <img
                src={confirmedBookingAlert.clientPhoto || '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png'}
                alt={confirmedBookingAlert.clientName || 'Client'}
                className="w-14 h-14 rounded-full object-cover border-2 border-pink-500 shadow-md shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-slate-100 text-sm truncate">{confirmedBookingAlert.clientName || 'Client'}</h4>
                  <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold text-[10px] border border-pink-500/30 shrink-0">
                    {confirmedBookingAlert.serviceName || 'Social Companionship'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Booking Code: <strong className="text-pink-400 font-mono font-bold">#{confirmedBookingAlert.bookingCode}</strong>
                </p>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-800/80 px-3 py-1.5 rounded-xl text-right shrink-0">
                <span className="text-[9px] uppercase font-bold text-emerald-400 block">Your 85% Earning</span>
                <span className="text-sm font-black text-emerald-300">
                  ₹{(((Number(confirmedBookingAlert.companionNetSharePaise) || Math.round((Number(confirmedBookingAlert.bookingAmountPaise || confirmedBookingAlert.amountPaise || confirmedBookingAlert.baseAmountPaise) || 49900) * 0.85)) / 100)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Schedule Slot & Meeting Venue */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Scheduled Time</span>
                  <span className="font-bold text-slate-200">
                    {confirmedBookingAlert.date || 'Today'} • {confirmedBookingAlert.startTime || 'Scheduled'} - {confirmedBookingAlert.endTime || ''} ({confirmedBookingAlert.durationHours || 1} hr)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Booking Location Venue</span>
                  <span className="font-bold text-slate-200 truncate block">
                    {confirmedBookingAlert.meetingLocation || 'Specified Meeting Venue'}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Action Buttons: Chat & Get Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveChatBooking(confirmedBookingAlert);
                  setConfirmedBookingAlert(null);
                }}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-pink-500 hover:from-pink-500 hover:to-rose-400 text-white font-extrabold text-xs shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>💬 Chat with {(confirmedBookingAlert.clientName || 'Client').split(' ')[0]}</span>
              </button>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(confirmedBookingAlert.meetingLocation || 'Meeting Venue')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all text-center"
              >
                <Navigation className="w-4 h-4" />
                <span>📍 Get Booking Location</span>
              </a>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('upcoming');
                setConfirmedBookingAlert(null);
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <Navigation className="w-3.5 h-3.5 text-purple-400" />
              <span>Go to Active Session Tracker (Arrival & OTP) →</span>
            </button>
          </div>
        </div>
      )}

      {/* Incoming booking alert & modal managed globally via GlobalCompanionAlertManager */}
      </div>
    </ErrorBoundary>
  );
};

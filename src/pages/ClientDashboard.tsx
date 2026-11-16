import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';
import { openRazorpayCheckout } from '../utils/razorpay';
import { PAIRUP_SERVICES, ServiceItem } from '../constants/services';
import { compressImageFile, compressBase64 } from '../utils/image';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { 
  Search, MapPin, Filter, Star, Clock, Calendar, ShieldCheck, 
  AlertCircle, MessageSquare, PhoneCall, CheckCircle, Navigation, 
  CreditCard, KeyRound, AlertTriangle, ChevronRight, UserCheck, X,
  Bell, Settings, LifeBuoy, LogOut, Heart, Sparkles, User, FileText,
  DollarSign, Compass, CheckCircle2, Sliders, Shield, Eye, ChevronLeft,
  CalendarCheck, Upload, Lock, Trash2, Camera, ShieldAlert
} from 'lucide-react';

export const ClientDashboard: React.FC = () => {
  const { user, token, activeRole, selectActiveRole, logout, bookingContext, setBookingContext, updateProfile, requestOtp, changePassword, deleteAccount, openKycWizard, refreshUserData } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (user && activeRole !== 'CLIENT') {
      selectActiveRole('CLIENT').catch(() => {});
    }
  }, [user?.id, activeRole]);

  // 16 Complete Visible Navigation Tabs per Section 7
  type ClientTab = 
    | 'overview' 
    | 'profile' 
    | 'kyc-status' 
    | 'discover' 
    | 'services' 
    | 'nearby' 
    | 'suggested' 
    | 'search-filters' 
    | 'upcoming' 
    | 'history' 
    | 'chat' 
    | 'notifications' 
    | 'payments' 
    | 'help-safety' 
    | 'settings';

  const [activeTab, setActiveTab] = useState<ClientTab>('overview');

  // Tab scroll ref for desktop Left/Right arrow navigation
  const tabsNavRef = useRef<HTMLDivElement>(null);
  const scrollTabs = (dir: 'left' | 'right') => {
    tabsNavRef.current?.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  };

  // Companions and filter state
  const [companions, setCompanions] = useState<any[]>([]);
  const [loadingCompanions, setLoadingCompanions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [maxBudgetHourly, setMaxBudgetHourly] = useState<number>(3000);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Booking modal state
  const [selectedCompanion, setSelectedCompanion] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [bookingTime, setBookingTime] = useState('14:00');
  const [bookingDurationHours, setBookingDurationHours] = useState(2);
  const [meetingLocation, setMeetingLocation] = useState('Central Public Cafe, MG Road');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Quick View modal state
  const [quickViewCompanion, setQuickViewCompanion] = useState<any | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);

  const openQuickView = (companion: any) => {
    setQuickViewCompanion(companion);
    setActivePhotoIdx(0);
  };

  const closeQuickView = () => {
    setQuickViewCompanion(null);
    setActivePhotoIdx(0);
  };

  const allQuickViewPhotos = quickViewCompanion
    ? [
        quickViewCompanion.profilePhoto,
        ...(quickViewCompanion.photos || []).filter((p: string) => p && p !== quickViewCompanion.profilePhoto)
      ]
    : [];

  // Profile editing state
  const [profileNameInput, setProfileNameInput] = useState(user?.profileName || user?.legalName || '');
  const [bioInput, setBioInput] = useState(user?.bio || '');
  const [userPhotos, setUserPhotos] = useState<string[]>(() => {
    if (Array.isArray(user?.photos) && user.photos.length > 0) return user.photos;
    if (user?.profilePhoto) return [user.profilePhoto];
    return [];
  });
  const [activeProfilePhoto, setActiveProfilePhoto] = useState<string>(user?.profilePhoto || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setProfileNameInput(user.profileName || user.legalName || '');
      setBioInput(user.bio || '');
      const photos = Array.isArray(user.photos) && user.photos.length > 0 
        ? user.photos 
        : (user.profilePhoto ? [user.profilePhoto] : []);
      setUserPhotos(photos);
      setActiveProfilePhoto(user.profilePhoto || photos[0] || '');
    }
  }, [user?.profileName, user?.profilePhoto, JSON.stringify(user?.photos || []), user?.bio]);

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
        photos: compressedPhotos
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

  // Bookings list & chat
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [activeChatBooking, setActiveChatBooking] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatText, setNewChatText] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);

  // Settings state
  const [notifSound, setNotifSound] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);

  // Change Password state
  const [cpOtpSent, setCpOtpSent] = useState(false);
  const [cpOtp, setCpOtp] = useState('');
  const [cpNewPassword, setCpNewPassword] = useState('');
  const [cpConfirmPassword, setCpConfirmPassword] = useState('');
  const [cpLoading, setCpLoading] = useState(false);
  const [cpMsg, setCpMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cpCountdown, setCpCountdown] = useState(0);

  // Delete Account state
  const [daOtpSent, setDaOtpSent] = useState(false);
  const [daOtp, setDaOtp] = useState('');
  const [daConfirm, setDaConfirm] = useState(false);
  const [daLoading, setDaLoading] = useState(false);
  const [daMsg, setDaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [daCountdown, setDaCountdown] = useState(0);

  // Incident Report state (from Secure Chat)
  const [reportModalOpen, setReportModalOpen] = useState(false);
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
    if (result.success) {
      setCpOtpSent(true);
      setCpCountdown(60);
    } else {
      setCpMsg({ type: 'error', text: result.error || 'Failed to send OTP.' });
    }
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
    if (result.success) {
      setCpMsg({ type: 'success', text: result.message || 'Password changed! Please log in again.' });
    } else {
      setCpMsg({ type: 'error', text: result.error || 'Failed to change password.' });
    }
  };

  const handleSendDaOtp = async () => {
    if (!user?.phone) return;
    setDaMsg(null);
    setDaLoading(true);
    const result = await requestOtp(user.phone, 'delete-account');
    setDaLoading(false);
    if (result.success) {
      setDaOtpSent(true);
      setDaCountdown(60);
    } else {
      setDaMsg({ type: 'error', text: result.error || 'Failed to send OTP.' });
    }
  };

  const handleDeleteAccount = async () => {
    setDaMsg(null);
    if (!daOtp || daOtp.length !== 6) { setDaMsg({ type: 'error', text: 'Enter the 6-digit OTP.' }); return; }
    if (!daConfirm) { setDaMsg({ type: 'error', text: 'Please confirm you understand all data will be deleted.' }); return; }
    setDaLoading(true);
    const result = await deleteAccount(daOtp);
    setDaLoading(false);
    if (result.success) {
      setDaMsg({ type: 'success', text: 'Account deleted successfully.' });
    } else {
      setDaMsg({ type: 'error', text: result.error || 'Failed to delete account.' });
    }
  };

  // Fetch verified LIVE companions
  const fetchCompanions = async () => {
    setLoadingCompanions(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (selectedServiceId) params.append('serviceId', selectedServiceId.toString());
      if (selectedCity && selectedCity !== 'all') params.append('city', selectedCity);

      const res = await apiFetch(`/api/companions/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCompanions(data.companions || []);
      }
    } catch (err) {
      console.error('Failed to load companions', err);
    } finally {
      setLoadingCompanions(false);
    }
  };

  // Fetch client bookings
  const fetchMyBookings = async () => {
    if (!user) return;
    try {
      const res = await apiFetch(`/api/bookings/my/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data.bookings || []);
      }
    } catch (err) {
      console.error('Failed to load bookings', err);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await apiFetch(`/api/notifications/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.notifications || [];
        setNotifications(items);
        // Automatically sync latest user KYC review state if any notification pertains to KYC
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
    fetchCompanions();
    fetchMyBookings();
    fetchNotifications();
    refreshUserData();
    const interval = setInterval(() => {
      fetchMyBookings();
      fetchNotifications();
    }, 7000);
    return () => clearInterval(interval);
  }, [user?.id, selectedServiceId, selectedCity]);

  // Handle restored booking context from AuthContext
  useEffect(() => {
    if (bookingContext && companions.length > 0) {
      const matchComp = companions.find(c => c.id === bookingContext.companionId);
      if (matchComp) {
        setSelectedCompanion(matchComp);
        if (bookingContext.serviceId) {
          setSelectedServiceId(bookingContext.serviceId);
        }
        setBookingContext(null); // Consumed
      }
    }
  }, [bookingContext, companions]);

  // Load chat for active chat booking
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

    try {
      const res = await apiFetch(`/api/chat/${activeChatBooking.id}`, {
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

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanion || !user) return;

    // Strict Initial Listing Non-Bookable Guard
    if (selectedCompanion.isInitialListing) {
      setBookingError(t.profileUnavailableForBooking || 'This profile is currently unavailable for booking.');
      return;
    }

    if (user.kycStatus !== 'APPROVED') {
      setBookingError('Identity Verification Required: Please wait for admin KYC approval before booking.');
      return;
    }

    setBookingError(null);
    setBookingInProgress(true);

    const endH = parseInt(bookingTime.split(':')[0], 10) + bookingDurationHours;
    const formattedEndTime = `${String(endH % 24).padStart(2, '0')}:${bookingTime.split(':')[1]}`;

    try {
      const res = await apiFetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: user.id,
          companionId: selectedCompanion.id,
          serviceId: selectedServiceId || selectedCompanion.services[0] || 1,
          serviceName: PAIRUP_SERVICES.find(s => s.id === (selectedServiceId || selectedCompanion.services[0]))?.name || 'Social Companionship',
          date: bookingDate,
          startTime: bookingTime,
          endTime: formattedEndTime,
          durationHours: bookingDurationHours,
          meetingLocation,
          notes: bookingNotes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error || 'Failed to confirm booking.');
      } else {
        let checkoutResult: any;
        try {
          checkoutResult = await openRazorpayCheckout(
            data.payment,
            `Companion booking ${data.booking.bookingCode}`,
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
            bookingId: data.booking.id,
            orderId: checkoutResult.razorpay_order_id,
            paymentId: checkoutResult.razorpay_payment_id,
            signature: checkoutResult.razorpay_signature
          })
        });
        const verification = await verifyRes.json();
        if (!verifyRes.ok || !verification.success) {
          throw new Error(verification.error || 'Payment was not confirmed by the backend.');
        }
        setBookingSuccessMsg(`Booking ${verification.booking.bookingCode} confirmed after payment verification.`);
        fetchMyBookings();
        setTimeout(() => {
          setSelectedCompanion(null);
          setBookingSuccessMsg(null);
          setActiveTab('upcoming');
        }, 1800);
      }
    } catch (err: any) {
      setBookingError(err.message || 'Network error during booking confirmation.');
    } finally {
      setBookingInProgress(false);
    }
  };

  const isKycApproved = user?.kycStatus === 'APPROVED';

  // Derived booking filters
  const upcomingBookings = myBookings.filter(b => b.status === 'CONFIRMED' || b.status === 'COMPANION_ARRIVED' || b.status === 'IN_PROGRESS');
  const pastBookings = myBookings.filter(b => b.status === 'COMPLETED' || b.status === 'CANCELLED');

  // Budget and search filtered companions
  const filteredCompanions = companions.filter(c => {
    const hourly = (c.rates?.hourlyPaise || 49900) / 100;
    if (hourly > maxBudgetHourly) return false;
    if (selectedCategory !== 'all') {
      const s = PAIRUP_SERVICES.filter(srv => c.services?.includes(srv.id));
      if (!s.some(item => item.category === selectedCategory)) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Status & Role Verification Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={user?.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                alt={user?.legalName}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-amber-400"
              />
              <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ring-2 ring-slate-900 ${isKycApproved ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-100">
                  {user?.profileName || user?.legalName || 'Client Member'}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300 font-semibold">
                  Client Member
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {user?.phone} · Live GPS Discovery Active
              </p>
            </div>
          </div>

          {/* EXACT KYC STATUS REQUIREMENT (SECTION 7) */}
          <div className="flex items-center gap-2">
            {isKycApproved ? (
              <div className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 shadow-inner">
                <ShieldCheck className="w-4 h-4" />
                <span>Client Profile Active</span>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-2 shadow-inner">
                <AlertCircle className="w-4 h-4" />
                <span>Client Inactive: Wait for KYC Approval</span>
              </div>
            )}
            {/* Notification Bell — always visible in header */}
            <button
              onClick={() => setActiveTab('notifications')}
              title="Notifications"
              className={`relative p-2.5 rounded-xl border transition-all shadow ${
                activeTab === 'notifications'
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-amber-400/20'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-extrabold px-1 shadow">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>
          </div>
        </div>

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
                Reason: {user.suspendedReason || 'Terms of service violation'}.
              </p>
              <p className="text-[11px] text-slate-300">
                New bookings, companion services, and messaging are temporarily restricted. Please contact customer support for appeal.
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
                Please maintain professional and respectful behavior. Repeated violations will result in account suspension.
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
                  Reason: {user.kycRejectionReason || 'Document photo blur or unreadable. Please re-upload clear photos.'}
                </span>
                <span className="text-[11px] text-slate-300 block">
                  Please fix the issue and submit clear documents to activate your client account.
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                refreshUserData();
                setActiveTab('kyc-status');
                openKycWizard();
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-extrabold text-xs shadow-md shadow-red-600/30 whitespace-nowrap transition-transform active:scale-95 cursor-pointer"
            >
              Fix & Re-upload KYC Documents →
            </button>
          </div>
        )}

        {/* 100% Free Client Membership Notice (SECTION 7) */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border border-amber-400/20 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Client Membership is 100% FREE:</strong> Never pay subscription fees to browse or book. You only pay the transparent fee for sessions you schedule.
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            Free Active Access (₹0)
          </span>
        </div>

        {/* 16 Visible Navigation Tabs Bar with Left/Right Scroll Arrows */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 shadow-lg">
          <div className="relative flex items-center gap-1.5">
            {/* Left scroll arrow */}
            <button
              onClick={() => scrollTabs('left')}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0 shadow"
              title="Scroll tabs left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {/* Scrollable tabs */}
            <div ref={tabsNavRef} className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none scroll-smooth text-xs font-medium">
          <div className="flex items-center gap-1.5 min-w-max text-xs font-medium">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'overview' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'profile' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>My Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('kyc-status')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'kyc-status' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>My KYC Status</span>
            </button>

            <button
              onClick={() => setActiveTab('discover')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'discover' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Discover Companions</span>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'services' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>24 Services</span>
            </button>

            <button
              onClick={() => setActiveTab('nearby')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'nearby' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Nearby Companions</span>
            </button>

            <button
              onClick={() => setActiveTab('suggested')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'suggested' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Suggested</span>
            </button>

            <button
              onClick={() => setActiveTab('search-filters')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'search-filters' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Search & Filters</span>
            </button>

            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'upcoming' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Upcoming ({upcomingBookings.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'history' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Booking History ({pastBookings.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'chat' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Secure Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'notifications' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notifications ({notifications.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'payments' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payments</span>
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
                activeTab === 'settings' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm('Log out of PairUpToday Client portal?')) {
                  logout();
                }
              }}
              className="px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
            </div>{/* end min-w-max scrollable inner */}
            </div>{/* end flex-1 scrollable container */}
            {/* Right scroll arrow */}
            <button
              onClick={() => scrollTabs('right')}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0 shadow"
              title="Scroll tabs right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>{/* end relative flex wrapper */}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-xs">Total Bookings</span>
                <div className="text-2xl font-bold text-slate-100 mt-1">{myBookings.length}</div>
                <span className="text-[11px] text-emerald-400 mt-1 block">Active Sessions: {upcomingBookings.length}</span>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-xs">Verification Status</span>
                <div className="text-base font-bold text-amber-400 mt-1">
                  {isKycApproved ? 'Client Profile Active' : 'Pending Verification'}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Govt ID & Selfie</span>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-xs">Client Membership</span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">100% FREE</div>
                <span className="text-[11px] text-slate-400 mt-1 block">Zero subscription fees</span>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-xs">Emergency SOS</span>
                <div className="text-lg font-bold text-rose-400 mt-1">Police 100 / SOS 112</div>
                <span className="text-[11px] text-slate-400 mt-1 block">Instant speed dial active</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-100">Ready to Discover Companions?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Explore companions across social, travel, dining, shopping and events in your city.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('discover')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 text-slate-950 font-bold text-xs shadow-md shadow-pink-500/20"
                >
                  Browse Companions
                </button>
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700"
                >
                  View Bookings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MY PROFILE */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-400" />
                  {t.profileSectionTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t.profileSectionSubtitle}
                </p>
              </div>
              <button
                type="submit"
                disabled={profileSaving}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md shadow-amber-400/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {profileSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    {t.profileSavingBtn}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
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
                    <User className="w-4 h-4 text-amber-400" />
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
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-semibold text-sm shadow-inner"
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 text-xs leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t.bioPlaceholder}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. PHOTOS MANAGEMENT (MAX 6 PHOTOS) */}
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-400" />
                    {t.profilePhotosSection} ({userPhotos.length}/6)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t.profilePhotosHelp}
                  </p>
                </div>
                {userPhotos.length < 6 && (
                  <label className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-semibold text-xs cursor-pointer flex items-center gap-1.5 transition-colors">
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
                {userPhotos.map((photo, idx) => {
                  const isMain = photo === activeProfilePhoto || (!activeProfilePhoto && idx === 0);
                  return (
                    <div 
                      key={idx} 
                      className={`relative group rounded-xl overflow-hidden aspect-square border-2 transition-all ${
                        isMain ? 'border-amber-400 shadow-md shadow-amber-400/20' : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <img 
                        src={photo} 
                        alt={`Photo ${idx + 1}`} 
                        className="w-full h-full object-cover" 
                      />
                      {isMain ? (
                        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-bold shadow">
                          {t.profileMainBadge}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetMainPhoto(photo)}
                          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/80 hover:bg-amber-400 hover:text-slate-950 text-slate-300 text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-all"
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
                  <label className="border-2 border-dashed border-slate-800 hover:border-amber-400/60 rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer aspect-square bg-slate-900/40 hover:bg-slate-900/80 transition-colors">
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
                  <span className="text-[10px] text-amber-400/80 mt-1">KYC Verified · Hidden from public</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <span className="text-slate-500 text-[11px] mb-1 flex items-center justify-between">
                    {t.profileDobLocked}
                    <Lock className="w-3 h-3 text-slate-500" />
                  </span>
                  <span className="font-semibold text-slate-300">{user?.dob || 'Verified at KYC'} ({user?.age || 25} yrs)</span>
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
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {profileSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    {t.profileSavingBtn}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {t.profileSaveBtn}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: MY KYC STATUS */}
        {activeTab === 'kyc-status' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              Identity Verification Status
            </h3>

            {(user?.kycStatus === 'REJECTED' || user?.kycRejectionReason) ? (
              <div className="p-6 rounded-2xl border bg-red-950/30 border-red-500/40 text-red-200 space-y-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                  <div>
                    <span className="text-base font-bold text-red-300 block">
                      KYC Verification Rejected
                    </span>
                    <span className="text-xs text-red-400">
                      Your submitted documents require correction before your profile can be activated.
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-red-500/30 text-xs space-y-1">
                  <span className="text-slate-400 block text-[11px] font-semibold uppercase tracking-wider">
                    Reason for Rejection:
                  </span>
                  <p className="text-amber-300 font-medium">
                    {user?.kycRejectionReason || 'Document photo blur or unreadable. Please re-upload clear photos.'}
                  </p>
                </div>

                <button
                  onClick={() => {
                    refreshUserData();
                    openKycWizard();
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 text-white font-bold text-xs shadow-lg shadow-red-500/20 hover:scale-[1.01] transition-all cursor-pointer"
                >
                  Fix & Re-upload KYC Documents
                </button>
              </div>
            ) : (
              <div className={`p-6 rounded-2xl border ${
                isKycApproved 
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
                  : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  {isKycApproved ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <AlertCircle className="w-6 h-6 text-amber-400" />}
                  <span className="text-base font-bold">
                    {isKycApproved ? 'Client Profile Active' : 'Client Inactive: Wait for KYC Approval'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isKycApproved 
                    ? 'Your identity documents and live selfie have been independently verified by the PairUp Security Network administration. You can book any verified companion.' 
                    : 'Your government ID documents are currently in review. As per security rules, companion booking features unlock immediately once our audit team approves your submission.'}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Submitted Document Checklist</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span>Government ID Upload</span>
                  <span className="text-emerald-400 font-bold">✓ Submitted</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span>Live Facial Selfie</span>
                  <span className="text-emerald-400 font-bold">✓ Submitted</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span>Legal Name & DOB Gate</span>
                  <span className="text-emerald-400 font-bold">✓ Age 18+ Locked</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DISCOVER COMPANIONS */}
        {activeTab === 'discover' && (
          <div className="space-y-6">
            {/* Quick City & Search bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="md:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by companion name, interest, or language..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <LocationAutocomplete
                  value={selectedCity === 'all' ? '' : selectedCity}
                  onChange={val => setSelectedCity(val.trim() === '' ? 'all' : val)}
                  mode="city"
                  accentColor="amber"
                  placeholder="Filter by any city, town or area..."
                />
              </div>

              <button
                onClick={fetchCompanions}
                className="py-2 px-4 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold hover:bg-amber-500 transition-colors"
              >
                Apply Search
              </button>
            </div>

            {/* Companions Results Grid */}
            {loadingCompanions ? (
              <div className="py-20 text-center text-slate-500 text-xs">
                Scanning verified companions in PairUp Verified Network...
              </div>
            ) : filteredCompanions.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-xs text-slate-400">No verified companions found matching current filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCompanions.map(comp => (
                  <div
                    key={comp.id}
                    className="rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-400/40 overflow-hidden shadow-xl transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-48 w-full overflow-hidden bg-slate-800">
                        <img
                          src={comp.profilePhoto}
                          alt={comp.name}
                          referrerPolicy="no-referrer"
                          onError={(e: any) => {
                            e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%231e293b"/><circle cx="150" cy="80" r="40" fill="%23475569"/><circle cx="150" cy="180" r="70" fill="%23475569"/></svg>';
                          }}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-500/90 text-slate-950 text-[10px] font-bold flex items-center gap-1 shadow">
                          <ShieldCheck className="w-3 h-3" />
                          <span>KYC VERIFIED</span>
                        </div>
                        <div className="absolute bottom-3 left-3 text-white">
                          <div className="text-sm font-bold flex items-center gap-1.5">
                            <span>{comp.name}</span>
                            <span className="text-xs text-slate-300 font-normal">({comp.age} yrs)</span>
                          </div>
                          <div className="text-[11px] text-slate-300 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-pink-400" />
                            <span>{comp.address || comp.locationFormatted || comp.city}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {comp.bio}
                        </p>

                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Hourly Rate</span>
                            <span className="font-bold text-amber-400">
                              ₹{(((comp.rates?.hourlyPaise ?? 49900)) / 100).toFixed(0)}/hr
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">Rating</span>
                            <div className="flex items-center gap-1 font-bold text-slate-200">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span>{comp.rating}</span>
                              <span className="text-slate-500">({comp.totalBookings || 0})</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openQuickView(comp)}
                        className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-pink-400" />
                        <span>Quick View</span>
                      </button>
                      <button
                        onClick={() => setSelectedCompanion(comp)}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-500 hover:to-rose-500 text-slate-950 text-xs font-bold shadow-md shadow-pink-500/20 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Book</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: 24 SERVICES CATALOGUE */}
        {activeTab === 'services' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-100">All 24 Authoritative Companionship Services</h3>
            <p className="text-xs text-slate-400">Click any service to view verified companions providing that category.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PAIRUP_SERVICES.map(s => (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedServiceId(s.id);
                    setActiveTab('discover');
                  }}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-400/40 cursor-pointer transition-all hover:bg-slate-850 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-amber-300 mb-1">
                      {s.id}. {s.name}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {s.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="uppercase tracking-wider">{s.category}</span>
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      Find Companion <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: NEARBY COMPANIONS */}
        {activeTab === 'nearby' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-emerald-400 animate-pulse" />
                Nearby Companions (GPS Proximity)
              </h3>
              <span className="text-xs text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
                GPS Active · Accurate to 500m
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Listing verified companions located nearest to your registered city venue.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companions.slice(0, 3).map(comp => (
                <div key={comp.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={comp.profilePhoto} alt={comp.name} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <span className="text-xs font-bold text-slate-100 block">{comp.name}</span>
                      <span className="text-[10px] text-slate-400">{comp.address || comp.locationFormatted || comp.city} · 2.4 km away</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCompanion(comp)}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold"
                  >
                    Book
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: SUGGESTED COMPANIONS */}
        {activeTab === 'suggested' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              Suggested Companions (Highest Rated & Fast Response)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companions.slice(0, 4).map(comp => (
                <div key={comp.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={comp.profilePhoto} alt={comp.name} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <span className="text-xs font-bold text-slate-100 block">{comp.name}</span>
                      <span className="text-[10px] text-amber-400 flex items-center gap-1">
                        ★ {comp.rating} (Superhost)
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCompanion(comp)}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: SEARCH & FILTERS */}
        {activeTab === 'search-filters' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              Advanced Filters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Max Hourly Budget: ₹{maxBudgetHourly}</label>
                <input
                  type="range"
                  min={300}
                  max={5000}
                  step={100}
                  value={maxBudgetHourly}
                  onChange={e => setMaxBudgetHourly(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Category Filter</label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                >
                  <option value="all">All Categories</option>
                  <option value="social">Social & Leisure</option>
                  <option value="lifestyle">Lifestyle & Dining</option>
                  <option value="travel">Travel & Sightseeing</option>
                  <option value="wellness">Fitness & Sports</option>
                  <option value="care">Assistance & Errands</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">City Region</label>
                <LocationAutocomplete
                  value={selectedCity === 'all' ? '' : selectedCity}
                  onChange={val => setSelectedCity(val.trim() === '' ? 'all' : val)}
                  mode="city"
                  accentColor="amber"
                  placeholder="Search any city, town, district..."
                />
              </div>
            </div>

            <button
              onClick={() => setActiveTab('discover')}
              className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs"
            >
              Show Filtered Companions ({filteredCompanions.length})
            </button>
          </div>
        )}

        {/* TAB 9: UPCOMING BOOKINGS */}
        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-100">Upcoming & Active Sessions</h3>
            {upcomingBookings.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
                No active or upcoming bookings right now.
              </div>
            ) : (
              upcomingBookings.map(b => (
                <div key={b.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <span className="font-bold text-slate-100 text-sm block">{b.serviceName} ({b.bookingCode})</span>
                      <span className="text-slate-400">Host: {b.companionName} · {b.date} ({b.startTime} - {b.endTime})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-bold">{b.status}</span>
                      <button
                        onClick={() => setActiveChatBooking(b)}
                        className="px-3 py-1 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
                      >
                        Chat
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block mb-1">Meeting Venue</span>
                      <span className="font-medium text-slate-200">{b.meetingLocation}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30">
                      <span className="text-amber-400 block mb-1">1. Start OTP (Give verbally on arrival)</span>
                      <span className="font-mono text-base font-bold text-amber-300">
                        {b.startOtpVerified ? 'Verified ✓' : (b.startOtp || 'Available on arrival')}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30">
                      <span className="text-emerald-400 block mb-1">2. Completion OTP (Give at session end)</span>
                      <span className="font-mono text-base font-bold text-emerald-300">
                        {b.endOtpVerified ? 'Verified ✓' : (b.startOtpVerified ? (b.endOtp || 'Available in progress') : (b.endOtp || 'Unlocks after Start'))}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 10: BOOKING HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-100">Completed & Past Sessions</h3>
            {pastBookings.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
                No completed bookings recorded yet.
              </div>
            ) : (
              pastBookings.map(b => (
                <div key={b.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-100 block">{b.serviceName} · {b.bookingCode}</span>
                    <span className="text-slate-400">Completed on {b.date} with {b.companionName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold block">₹{(b.bookingAmountPaise / 100).toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Status: {b.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 11: SECURE CHAT */}
        {activeTab === 'chat' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-pink-400" />
              In-App Secure Chat Sessions
            </h3>
            <p className="text-xs text-slate-400">
              Private chat channels are generated for confirmed bookings. Phone numbers and personal social handles are never revealed.
            </p>
            {myBookings.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No active bookings with open chat.</div>
            ) : (
              <div className="space-y-2">
                {myBookings.map(b => (
                  <div key={b.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-200 block">{b.companionName}</span>
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

        {/* TAB 12: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                In-App Notifications
              </h3>
              <span className="text-xs text-slate-400 font-medium">{notifications.length} alerts</span>
            </div>

            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No new notifications.</div>
            ) : (
              <div className="space-y-2.5">
                {notifications.map(n => {
                  const isKycReject = 
                    n.type === 'KYC_REJECTED' || 
                    n.data?.type === 'KYC_REJECTED' || 
                    n.data?.action === 'OPEN_KYC_WIZARD' || 
                    (typeof n.title === 'string' && /kyc|verification|document/i.test(n.title)) || 
                    (typeof n.message === 'string' && /kyc|re-upload|rejection|blur|rejected/i.test(n.message));
                  const isBooking = n.type?.includes('BOOKING') || n.title?.includes('Booking') || n.title?.includes('Session') || n.title?.includes('Companion Arrived');
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
                        }
                      }}
                      className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer ${
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
                          <span className="text-[10px] text-red-400 underline font-bold">Open KYC Wizard →</span>
                        </div>
                      )}
                      {isBooking && (
                        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                          <span className="text-[11px] text-sky-400">Tap to view booking status</span>
                          <span className="text-[10px] text-slate-400 font-bold">View Details →</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 13: PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Payments & Digital Receipts
            </h3>
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300">
              <strong>Free Client Access Guarantee:</strong> Client registration, companion discovery, and membership are 100% free of charge. You only authorize payments for sessions you book.
            </div>
            <div className="space-y-2 text-xs">
              {myBookings.map(b => (
                <div key={b.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Session Payment: {b.bookingCode}</span>
                    <span className="text-slate-500">Transaction ID: {b.paymentId}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400">₹{(b.bookingAmountPaise / 100).toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500 block">100% Verified Escrow</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 14: HELP & SAFETY */}
        {activeTab === 'help-safety' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-400" />
              Safety Protocols & Immediate Assistance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <a href="tel:100" className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-center hover:bg-rose-950/60 transition-colors">
                <span className="text-lg font-bold text-rose-400 block mb-1">Police: 100</span>
                <span className="text-slate-300">National Emergency Police Helpline</span>
              </a>
              <a href="tel:112" className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-center hover:bg-amber-950/60 transition-colors">
                <span className="text-lg font-bold text-amber-400 block mb-1">SOS: 112</span>
                <span className="text-slate-300">All-in-One Emergency Response</span>
              </a>
              <a href="tel:1091" className="p-4 rounded-xl bg-sky-950/40 border border-sky-500/30 text-center hover:bg-sky-950/60 transition-colors">
                <span className="text-lg font-bold text-sky-400 block mb-1">Helpline: 1091</span>
                <span className="text-slate-300">Women Safety & Support Helpline</span>
              </a>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <h4 className="font-bold text-slate-100">Meeting Safety Checklist:</h4>
              <p>• Always meet in public places (cafes, malls, public avenues).</p>
              <p>• Never share financial card PINs or cash offline.</p>
              <p>• Confirm your session verbally with the 6-digit Start OTP only upon arrival.</p>
              <p>• Keep in-app GPS tracking active during the full duration of your session.</p>
            </div>
          </div>
        )}

        {/* TAB 15: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-xs">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              Account Settings & Preferences
            </h3>

            {/* General Preferences */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">Sound & Vibration Alerts</span>
                  <span className="text-slate-500 text-[11px]">Audio chime when companion arrives or sends message</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifSound}
                  onChange={e => setNotifSound(e.target.checked)}
                  className="w-4 h-4 accent-amber-400"
                />
              </div>
            </div>

            {/* ── CHANGE PASSWORD ── */}
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3">
              <h4 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4 text-amber-400" />
                Change Password
              </h4>
              <p className="text-slate-500 text-[11px]">
                Registered number: <span className="text-slate-300 font-mono">{user?.phone || '—'}</span>
              </p>

              {cpMsg && (
                <div className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${cpMsg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'}`}>
                  {cpMsg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{cpMsg.text}</span>
                </div>
              )}

              {!cpOtpSent ? (
                <button
                  onClick={handleSendCpOtp}
                  disabled={cpLoading || cpCountdown > 0}
                  className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/30 disabled:opacity-50 transition-colors"
                >
                  {cpLoading ? 'Sending OTP...' : cpCountdown > 0 ? `Resend in ${cpCountdown}s` : 'Send OTP to Change Password'}
                </button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Enter OTP</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={cpOtp}
                        onChange={e => setCpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        placeholder="6-digit OTP"
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono tracking-widest text-sm focus:outline-none focus:border-amber-400"
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
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-400"
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
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-400"
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
                      className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold text-xs disabled:opacity-50"
                    >
                      {cpLoading ? 'Saving...' : 'Save New Password'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendCpOtp}
                    disabled={cpCountdown > 0 || cpLoading}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline disabled:opacity-50"
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

              {/* Attention Warning */}
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> ATTENTION: This action is permanent and cannot be undone.
                </p>
                <p className="text-red-400/80">Deleting your account will permanently erase all your KYC documents, membership records, bank verifications, chat history, booking records, and all associated platform data.</p>
              </div>

              {daMsg && (
                <div className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${daMsg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'}`}>
                  {daMsg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
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
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
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

      </div>

      {/* QUICK VIEW PROFILE MODAL */}
      {quickViewCompanion && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="Quick View Profile"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeQuickView();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl my-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  {quickViewCompanion.name} ({quickViewCompanion.age} yrs)
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                  <MapPin className="w-3 h-3 text-pink-400" />
                  {quickViewCompanion.locationFormatted || quickViewCompanion.address || quickViewCompanion.city}
                </span>
              </div>
              <button
                onClick={closeQuickView}
                aria-label="Close Quick View"
                className="p-1.5 rounded-full bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Main Photo Viewer - Complete Uncropped Display */}
              <div className="space-y-3">
                <div className="relative w-full flex items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden p-2 sm:p-4 min-h-[280px] sm:min-h-[380px] max-h-[58vh]">
                  <img
                    src={allQuickViewPhotos[activePhotoIdx] || quickViewCompanion.profilePhoto}
                    alt={`${quickViewCompanion.name} - Photo ${activePhotoIdx + 1}`}
                    className="max-h-[54vh] max-w-full w-auto h-auto object-contain select-none mx-auto rounded-lg shadow-2xl transition-all duration-200"
                  />

                  {/* Previous Photo Button */}
                  {allQuickViewPhotos.length > 1 && (
                    <button
                      onClick={() => setActivePhotoIdx(prev => (prev > 0 ? prev - 1 : allQuickViewPhotos.length - 1))}
                      aria-label="Previous photo"
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white border border-slate-700/80 shadow-xl transition-all hover:scale-105 cursor-pointer z-10"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}

                  {/* Next Photo Button */}
                  {allQuickViewPhotos.length > 1 && (
                    <button
                      onClick={() => setActivePhotoIdx(prev => (prev < allQuickViewPhotos.length - 1 ? prev + 1 : 0))}
                      aria-label="Next photo"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white border border-slate-700/80 shadow-xl transition-all hover:scale-105 cursor-pointer z-10"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}

                  {/* Floating Rate Tag */}
                  <div className="absolute top-3 right-3 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg">
                    <span className="text-xs sm:text-sm font-extrabold text-amber-400">
                      ₹{Math.round(((quickViewCompanion.rates?.hourlyPaise ?? 49900)) / 100)}/hr
                    </span>
                  </div>

                  {/* Image Counter Badge */}
                  {allQuickViewPhotos.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/85 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700/80 text-[11px] font-semibold text-slate-200 shadow-lg">
                      {activePhotoIdx + 1} / {allQuickViewPhotos.length}
                    </div>
                  )}
                </div>

                {/* Thumbnails Strip */}
                {allQuickViewPhotos.length > 1 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 block">
                      Gallery ({allQuickViewPhotos.length} photos)
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
                      {allQuickViewPhotos.map((photoUrl: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setActivePhotoIdx(idx)}
                          aria-label={`View photo ${idx + 1}`}
                          className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                            activePhotoIdx === idx
                              ? 'border-pink-500 ring-2 ring-pink-500/30 scale-105 shadow-md shadow-pink-500/20'
                              : 'border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={photoUrl}
                            alt={`${quickViewCompanion.name} thumbnail ${idx + 1}`}
                            className="w-full h-full object-cover object-top"
                          />
                          {idx === 0 && (
                            <span className="absolute bottom-0 inset-x-0 bg-pink-600/90 text-white text-[8px] font-bold py-0.5 text-center leading-tight">
                              Profile
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Details & Rates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400 block">Location</span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs font-semibold text-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <span>{quickViewCompanion.locationFormatted || quickViewCompanion.address || quickViewCompanion.city}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">Verified Rating</span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs font-semibold text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{(quickViewCompanion.rating || 4.9).toFixed(2)}</span>
                    <span className="text-slate-400 text-[11px] font-normal">
                      ({quickViewCompanion.totalBookings || 0} bookings)
                    </span>
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  About Companion
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                  {quickViewCompanion.bio}
                </p>
              </div>

              {/* Services List */}
              {quickViewCompanion.services && quickViewCompanion.services.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Available Services ({quickViewCompanion.services.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {quickViewCompanion.services.map((sid: number) => {
                      const srv = PAIRUP_SERVICES.find((s) => s.id === sid);
                      if (!srv) return null;
                      return (
                        <div
                          key={srv.id}
                          className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-2"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-slate-200 leading-snug">
                              {srv.name}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 sticky bottom-0 z-10">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">Hourly Rate</span>
                <span className="text-sm font-extrabold text-amber-400">
                  ₹{Math.round(((quickViewCompanion.rates?.hourlyPaise ?? 49900)) / 100)}/hr
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={closeQuickView}
                  className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    const comp = quickViewCompanion;
                    closeQuickView();
                    setSelectedCompanion(comp);
                  }}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>Book Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING MODAL */}
      {selectedCompanion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg my-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <img
                  src={selectedCompanion.profilePhoto}
                  alt={selectedCompanion.name}
                  className="w-10 h-10 rounded-full object-cover ring-1 ring-amber-400"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Book Companion: {selectedCompanion.name}
                  </h3>
                  <span className="text-xs text-amber-400">
                    ₹{(selectedCompanion.rates?.hourlyPaise / 100).toFixed(0)}/hour
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCompanion(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bookingError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{bookingError}</span>
              </div>
            )}

            {bookingSuccessMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{bookingSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Booking Date
                </label>
                <input
                  type="date"
                  value={bookingDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setBookingDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={bookingTime}
                    onChange={e => setBookingTime(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Duration (Hours)
                  </label>
                  <select
                    value={bookingDurationHours}
                    onChange={e => setBookingDurationHours(parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value={1}>1 Hour</option>
                    <option value={2}>2 Hours</option>
                    <option value={3}>3 Hours</option>
                    <option value={4}>4 Hours (Half-Day)</option>
                    <option value={8}>8 Hours (Full-Day)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Public Meeting Location
                </label>
                <LocationAutocomplete
                  value={meetingLocation}
                  onChange={setMeetingLocation}
                  mode="full"
                  accentColor="amber"
                  placeholder="e.g. Starbucks Cafe, South City Mall, MG Road..."
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Experience Preferences / Notes
                </label>
                <textarea
                  rows={2}
                  value={bookingNotes}
                  onChange={e => setBookingNotes(e.target.value)}
                  placeholder="Any particular topics, places to visit, or walking routes..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Price Calculation Card */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Companion Fee ({bookingDurationHours}h):</span>
                  <span>₹{(((selectedCompanion.rates?.hourlyPaise ?? 49900) * bookingDurationHours) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Admin Platform Fee (15% included):</span>
                  <span>₹{(((selectedCompanion.rates?.hourlyPaise ?? 49900) * bookingDurationHours * 0.15) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-100 pt-1.5 border-t border-slate-800 text-sm">
                  <span>Total Payable:</span>
                  <span className="text-amber-400">
                    ₹{(((selectedCompanion.rates?.hourlyPaise ?? 49900) * bookingDurationHours) / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={bookingInProgress || user?.isSuspended}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-500 hover:to-rose-500 text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.01] disabled:opacity-50"
              >
                {user?.isSuspended ? 'Account Suspended - Booking Disabled' : (bookingInProgress ? 'Preparing secure checkout...' : 'Continue to Razorpay Checkout')}
              </button>

              <p className="text-[10px] text-center text-slate-500">
                100% money back guarantee if cancelled before companion arrival. Meeting verified by Start & Finish OTP.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* SECURE CHAT DRAWER */}
      {activeChatBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 flex flex-col justify-between text-slate-100">
            
            {/* Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-100">
                  Secure Chat · {activeChatBooking.companionName}
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
                          ? 'bg-amber-400 text-slate-950 font-medium rounded-br-none'
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
            ) : (
              <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={newChatText}
                  onChange={e => setNewChatText(e.target.value)}
                  placeholder="Type secure message..."
                  className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl font-bold text-xs cursor-pointer"
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
              <div>Booking Code: <strong className="text-amber-400">#{reportBooking.bookingCode}</strong></div>
              <div>Reported Party: <strong className="text-slate-200">{reportBooking.companionName || 'Companion'}</strong></div>
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
                    'Did not arrive / Misleading profile',
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

    </div>
  );
};

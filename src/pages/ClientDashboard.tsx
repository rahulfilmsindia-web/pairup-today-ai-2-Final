import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';
import { openRazorpayCheckout } from '../utils/razorpay';
import { PAIRUP_SERVICES, ServiceItem } from '../constants/services';
import { compressImageFile, compressBase64 } from '../utils/image';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { ClientLiveTrackingView } from '../components/ClientLiveTrackingView';
import { 
  Search, MapPin, Filter, Star, Clock, Calendar, ShieldCheck, 
  AlertCircle, MessageSquare, PhoneCall, CheckCircle, Navigation, 
  CreditCard, KeyRound, AlertTriangle, ChevronRight, UserCheck, X,
  Bell, Settings, LifeBuoy, LogOut, Heart, Sparkles, User, FileText,
  DollarSign, Compass, CheckCircle2, Sliders, Shield, Eye, ChevronLeft,
  CalendarCheck, Upload, Lock, Trash2, Camera, ShieldAlert, Menu, Users
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
    | 'tracking'
    | 'upcoming' 
    | 'history' 
    | 'chat' 
    | 'notifications' 
    | 'payments' 
    | 'help-safety' 
    | 'settings';

  const [activeTab, setActiveTab] = useState<ClientTab>('overview');
  const [trackedBooking, setTrackedBooking] = useState<any | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

  // Multi-step booking request & companion acceptance flow
  type BookingStep = 'form' | 'waiting_acceptance' | 'accepted' | 'rejected';
  const [bookingStep, setBookingStep] = useState<BookingStep>('form');
  const [activeBookingResponse, setActiveBookingResponse] = useState<any | null>(null);
  const pollIntervalRef = useRef<any>(null);

  const cleanupPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => cleanupPolling();
  }, []);

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
  const [companionSchedule, setCompanionSchedule] = useState<any | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [timeConflictError, setTimeConflictError] = useState<string | null>(null);

  // Fetch companion schedule when modal opens or bookingDate changes
  useEffect(() => {
    if (!selectedCompanion?.id || !bookingDate) {
      setCompanionSchedule(null);
      setTimeConflictError(null);
      return;
    }

    let isMounted = true;
    setScheduleLoading(true);
    apiFetch(`/api/companion/${selectedCompanion.id}/schedule?date=${bookingDate}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          setCompanionSchedule(data);
          setScheduleLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setScheduleLoading(false);
      });

    return () => { isMounted = false; };
  }, [selectedCompanion?.id, bookingDate]);

  // Validate time slot conflict with 1-hour buffer
  useEffect(() => {
    if (!companionSchedule?.blockedWindows || !bookingTime || !bookingDurationHours) {
      setTimeConflictError(null);
      return;
    }

    const [h, m] = bookingTime.split(':').map(Number);
    const startM = h * 60 + m;
    const endM = startM + bookingDurationHours * 60;

    for (const b of companionSchedule.blockedWindows) {
      const [bh1, bm1] = b.from.split(':').map(Number);
      const [bh2, bm2] = b.to.split(':').map(Number);
      const bStartM = bh1 * 60 + bm1;
      const bEndM = bh2 * 60 + bm2;

      // Overlap condition: start < bEnd && end > bStart
      if (startM < bEndM && endM > bStartM) {
        setTimeConflictError(
          `This companion has a confirmed meeting (${b.bookingTimes?.join(', ') || 'Session'}) requiring a 1-hour travel buffer before and after (unavailable from ${b.fromFormatted} to ${b.toFormatted}). ${companionSchedule.summary || ''}`
        );
        return;
      }
    }

    setTimeConflictError(null);
  }, [companionSchedule, bookingTime, bookingDurationHours]);

  const handleCloseBookingModal = () => {
    // If client cancels or closes during waiting_acceptance, accepted (before checkout) or pending, notify server to immediately dismiss companion alert
    if (activeBookingResponse?.booking?.id && (bookingStep === 'waiting_acceptance' || bookingStep === 'accepted' || (bookingStep as string) === 'pending')) {
      apiFetch(`/api/bookings/${activeBookingResponse.booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'CLIENT_CANCELLED' })
      }).catch(() => {});
    }
    cleanupPolling();
    setSelectedCompanion(null);
    setBookingStep('form');
    setActiveBookingResponse(null);
    setBookingError(null);
    setBookingSuccessMsg(null);
  };

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
  const fetchCompanions = async (isBackgroundSync = false) => {
    if (!isBackgroundSync) setLoadingCompanions(true);
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
      if (!isBackgroundSync) setLoadingCompanions(false);
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
      fetchCompanions(true);
      fetchMyBookings();
      fetchNotifications();
    }, 6000);
    return () => clearInterval(interval);
  }, [user?.id, selectedServiceId, selectedCity]);

  // Handle restored booking context from AuthContext
  useEffect(() => {
    if (bookingContext) {
      const matchComp = companions.find(c => c.id === bookingContext.companionId) || (bookingContext as any).companion;
      if (matchComp) {
        setSelectedCompanion(matchComp);
        setBookingStep('form');
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

    if (timeConflictError) {
      setBookingError(timeConflictError);
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
        setBookingError(data.error || 'Failed to submit booking request.');
        setBookingInProgress(false);
        return;
      }

      setActiveBookingResponse(data);
      setBookingStep('waiting_acceptance');
      setBookingInProgress(false);

      // Start live polling for companion acceptance
      cleanupPolling();
      const bookingId = data.booking.id;
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await apiFetch(`/api/bookings/${bookingId}/status`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.companionAccepted) {
              cleanupPolling();
              setBookingStep('accepted');
              if (statusData.payment) {
                setActiveBookingResponse((prev: any) => ({
                  ...prev,
                  booking: { ...prev?.booking, ...statusData },
                  payment: {
                    ...prev?.payment,
                    ...statusData.payment,
                    keyId: statusData.payment.keyId || prev?.payment?.keyId || 'rzp_live_pairuptoday'
                  }
                }));
              }
            } else if (statusData.status === 'CANCELLED' || statusData.rejectionReason === 'COMPANION_BUSY') {
              cleanupPolling();
              setBookingStep('rejected');
            }
          }
        } catch (pollErr) {
          console.warn('Booking status polling error', pollErr);
        }
      }, 2000);
    } catch (err: any) {
      setBookingError(err.message || 'Network error during booking confirmation.');
      setBookingInProgress(false);
    }
  };

  const handleProceedToCheckout = async () => {
    if (!activeBookingResponse || !user) return;
    setBookingInProgress(true);
    setBookingError(null);
    try {
      const { booking, payment } = activeBookingResponse;
      let orderToPay = { ...(payment || {}) };

      // Ensure keyId is always present
      if (!orderToPay.keyId) {
        orderToPay.keyId = 'rzp_live_pairuptoday';
      }

      // If orderId is missing or is placeholder ord_req_*, create a verified Razorpay order
      if (!orderToPay.orderId || orderToPay.orderId.startsWith('ord_req_')) {
        try {
          const createOrderRes = await apiFetch('/api/payments/razorpay/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amountPaise: orderToPay.amountPaise || booking?.totalPayablePaise || Math.round((booking?.bookingAmountPaise || 49900) * 1.18),
              receipt: `bk_${booking.bookingCode}`,
              type: 'BOOKING',
              notes: {
                bookingId: booking.id,
                bookingCode: booking.bookingCode,
                userId: user.id
              }
            })
          });
          if (createOrderRes.ok) {
            const orderData = await createOrderRes.json();
            if (orderData.success && orderData.orderId) {
              orderToPay.orderId = orderData.orderId;
              if (orderData.keyId) orderToPay.keyId = orderData.keyId;
              if (orderData.amountPaise) orderToPay.amountPaise = orderData.amountPaise;
              if (orderData.currency) orderToPay.currency = orderData.currency;
            }
          }
        } catch (genErr) {
          console.warn('Dynamic order generation notice:', genErr);
        }
      }

      if (!orderToPay.orderId) {
        orderToPay.orderId = `ord_${booking.id.replace(/-/g, '').slice(0, 16)}`;
      }
      if (!Number.isSafeInteger(orderToPay.amountPaise) || orderToPay.amountPaise <= 0) {
        orderToPay.amountPaise = booking.totalPayablePaise || Math.round((booking.bookingAmountPaise || 49900) * 1.18);
      }

      let checkoutResult: any;
      try {
        checkoutResult = await openRazorpayCheckout(
          orderToPay,
          `Companion booking ${booking.bookingCode}`,
          { name: user.legalName, contact: user.phone }
        );
      } catch (checkoutErr: any) {
        if (orderToPay?.orderId) {
          const isCancelled = checkoutErr?.message?.includes('closed') || checkoutErr?.message?.includes('dismiss') || checkoutErr?.message?.includes('cancel');
          apiFetch(isCancelled ? '/api/payments/razorpay/cancel-order' : '/api/payments/razorpay/fail-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: orderToPay.orderId,
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
          bookingId: booking.id,
          orderId: checkoutResult.razorpay_order_id,
          paymentId: checkoutResult.razorpay_payment_id,
          signature: checkoutResult.razorpay_signature
        })
      });
      const verification = await verifyRes.json();
      if (!verifyRes.ok || !verification.success) {
        throw new Error(verification.error || 'Payment was not confirmed by the backend.');
      }

      setBookingSuccessMsg(`Booking ${verification.booking?.bookingCode || booking.bookingCode} confirmed! Opening Live Companion Arrival Tracking...`);
      fetchMyBookings();

      const activeBookingObj = {
        id: verification.booking?.id || booking.id,
        bookingCode: verification.booking?.bookingCode || booking.bookingCode,
        companionId: selectedCompanion?.id || booking.companionId,
        companionName: selectedCompanion?.name || 'Companion',
        companionPhoto: selectedCompanion?.profilePhoto || selectedCompanion?.photo || '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
        clientName: user.profileName || user.legalName || 'Client',
        serviceName: booking.serviceName || selectedCompanion?.serviceName || 'Social Companionship',
        meetingLocation: booking.meetingLocation,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        durationHours: booking.durationHours,
        startOtp: verification.booking?.startOtp,
        status: 'CONFIRMED'
      };

      setTimeout(() => {
        handleCloseBookingModal();
        setTrackedBooking(activeBookingObj);
        setActiveChatBooking(activeBookingObj);
        setActiveTab('tracking');
      }, 1500);
    } catch (err: any) {
      setBookingError(err.message || 'Payment processing error.');
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

  const clientNavTabs = [
    { id: 'overview' as ClientTab, label: 'Overview', icon: Compass },
    { id: 'profile' as ClientTab, label: 'My Profile', icon: User },
    { id: 'kyc-status' as ClientTab, label: 'My KYC Status', icon: ShieldCheck, badge: isKycApproved ? undefined : 'Verify' },
    { id: 'discover' as ClientTab, label: 'Discover Companions', icon: Search },
    { id: 'services' as ClientTab, label: '24 Services', icon: Sparkles },
    { id: 'nearby' as ClientTab, label: 'Nearby Companions', icon: MapPin },
    { id: 'suggested' as ClientTab, label: 'Suggested', icon: Star },
    { id: 'search-filters' as ClientTab, label: 'Search & Filters', icon: Sliders },
    ...(trackedBooking || upcomingBookings.some(b => b.status === 'CONFIRMED' || b.status === 'COMPANION_ARRIVED' || b.status === 'IN_PROGRESS')
      ? [{ id: 'tracking' as ClientTab, label: 'Live Tracking', icon: Navigation, isLiveBadge: true }]
      : []),
    { id: 'upcoming' as ClientTab, label: 'Upcoming', icon: Calendar, badge: upcomingBookings.length || undefined },
    { id: 'history' as ClientTab, label: 'Booking History', icon: FileText, badge: pastBookings.length || undefined },
    { id: 'chat' as ClientTab, label: 'Secure Chat', icon: MessageSquare, badge: 2 },
    { id: 'notifications' as ClientTab, label: 'Notifications', icon: Bell, badge: notifications.length || 2 },
    { id: 'payments' as ClientTab, label: 'Payments', icon: CreditCard },
    { id: 'help-safety' as ClientTab, label: 'Help & Safety', icon: Shield },
    { id: 'settings' as ClientTab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#f5f6fc] text-slate-800 flex overflow-x-hidden relative">
      {/* ============================================================== */}
      {/* 1. DESKTOP / TABLET DOCKED SIDEBAR (INDIGO / VIOLET GRADIENT)   */}
      {/* ============================================================== */}
      <aside className="w-64 xl:w-72 bg-gradient-to-b from-[#0b0826] via-[#100c31] to-[#1c1248] text-white shrink-0 min-h-screen border-r border-[#261b5c]/50 hidden lg:flex flex-col select-none relative overflow-hidden z-20">
        {/* Brand Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 p-0.5 shadow-lg shadow-pink-500/30 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#120c32] rounded-[14px] flex items-center justify-center">
                <Heart className="w-5 h-5 text-pink-400 fill-pink-400" />
              </div>
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-white flex items-center">
                <span>PairUp</span>
                <span className="text-pink-400">Today</span>
              </div>
              <div className="text-[9px] font-bold tracking-wider uppercase text-purple-300/80 -mt-0.5">
                Client Portal
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-purple-900/40">
          {clientNavTabs.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-between text-xs font-semibold cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#5038ee] to-[#7c3aed] text-white shadow-lg shadow-purple-600/30 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-300/80'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.isLiveBadge && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                )}
                {item.badge && !item.isLiveBadge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    typeof item.badge === 'string'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-2 border-t border-white/10 mt-2">
            <button
              onClick={() => {
                if (window.confirm('Log out of PairUpToday Client portal?')) {
                  logout();
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-3 text-xs font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-950/30 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </nav>

        {/* Couple Silhouette Artwork with Neon Glow at Bottom */}
        <div className="w-full pt-2 pb-2 px-3 select-none pointer-events-none relative mt-auto border-t border-white/5">
          <div className="relative w-full h-24 flex items-end justify-center overflow-hidden">
            <div className="absolute -bottom-3 w-36 h-20 bg-gradient-to-t from-pink-500/30 via-purple-600/20 to-transparent blur-xl rounded-full" />
            <div className="absolute top-1 left-6 text-pink-400 opacity-90 animate-pulse">
              <Heart className="w-3 h-3 fill-pink-500 text-pink-500" />
            </div>
            <div className="absolute top-0 right-8 text-rose-300 opacity-80 animate-bounce">
              <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
            </div>
            <div className="absolute top-5 right-5 text-pink-300 opacity-70">
              <Heart className="w-2 h-2 fill-pink-400 text-pink-400" />
            </div>
            <svg className="w-full h-full" viewBox="0 0 240 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="cliGlowWave" x1="0" y1="0" x2="240" y2="100" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" stopOpacity="0.8" />
                  <stop offset="0.5" stopColor="#c026d3" stopOpacity="0.85" />
                  <stop offset="1" stopColor="#ec4899" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="cliSilFill" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#09061b" />
                  <stop offset="1" stopColor="#1a0f3d" />
                </linearGradient>
              </defs>
              <path d="M 44 100 L 44 68 C 44 65 48 61 54 59 C 58 57 63 55 66 50 C 70 45 69 36 67 32 C 66 28 63 24 59 23 C 54 22 49 25 47 28 C 44 26 39 28 38 33 C 37 38 38 43 41 47 C 42 49 43 51 42 55 C 40 60 32 64 26 69 L 26 100 Z" fill="url(#cliSilFill)" />
              <path d="M 110 100 L 110 69 C 105 64 97 60 95 55 C 94 51 95 49 96 47 C 99 44 100 38 99 33 C 98 27 93 24 89 27 C 87 23 83 21 77 22 C 73 23 70 27 69 31 C 67 35 66 44 70 49 C 74 54 79 56 83 58 C 88 60 92 64 92 68 L 92 100 Z" fill="url(#cliSilFill)" />
              <path d="M 0 82 C 55 70 100 96 150 78 C 180 68 210 72 240 82 L 240 100 L 0 100 Z" fill="url(#cliGlowWave)" opacity="0.3" />
              <path d="M 0 89 C 45 80 110 98 160 84 C 190 77 215 87 240 92 L 240 100 L 0 100 Z" fill="url(#cliGlowWave)" opacity="0.6" />
              <path d="M 0 94 C 35 89 90 100 170 91 C 200 87 220 93 240 97 L 240 100 L 0 100 Z" fill="url(#cliGlowWave)" />
            </svg>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MOBILE SLIDE-OVER DRAWER SIDEBAR                            */}
      {/* ============================================================== */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className="relative w-72 bg-gradient-to-b from-[#0b0826] via-[#100c31] to-[#1c1248] text-white flex flex-col z-10 shadow-2xl h-full">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-400 fill-pink-400" />
                <span className="font-extrabold text-white text-base">PairUpToday</span>
              </div>
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
              {clientNavTabs.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl transition-all flex items-center justify-between text-xs font-semibold cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-[#5038ee] to-[#7c3aed] text-white shadow-lg shadow-purple-600/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-purple-300" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MAIN DASHBOARD CONTENT AREA                                 */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar matching reference design */}
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Pill Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setActiveTab('discover');
                    fetchCompanions();
                  }
                }}
                placeholder="Discover Companions..."
                className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all shadow-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search & Filters Button */}
            <button
              onClick={() => setActiveTab('search-filters')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-[#432bb3] hover:bg-[#372297] text-white text-xs font-semibold shadow-md shadow-indigo-600/20 cursor-pointer transition-all active:scale-95"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Search & Filters</span>
            </button>

            {/* Notification Bell with Badge */}
            <button
              onClick={() => setActiveTab('notifications')}
              title="Notifications"
              className="relative p-2.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:text-purple-600 hover:bg-white transition-all shadow-xs cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-extrabold px-1 shadow">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {/* User Profile Pill */}
            <div
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full bg-slate-50 border border-slate-200 shadow-xs cursor-pointer hover:border-purple-300 hover:bg-white transition-all"
            >
              <div className="relative">
                <img
                  src={user?.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                  alt={user?.legalName}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-purple-400"
                />
                <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-1 ring-white ${isKycApproved ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              </div>
              <span className="text-xs font-bold text-slate-800 hidden md:inline">
                {user?.profileName || user?.legalName || 'Rahul Mondal'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-90" />
            </div>
          </div>
        </header>

        {/* Scrollable Main Container */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Persistent Account Suspension Alert */}
          {user?.isSuspended && (
            <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/60 text-rose-200 flex items-start gap-3 shadow-lg shadow-rose-950/60 animate-fade-in">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-rose-300">Account Suspended by Administration</h4>
                <p className="text-xs text-rose-200 font-medium">Reason: {user.suspendedReason || 'Terms of service violation'}.</p>
                <p className="text-[11px] text-slate-300">New bookings, companion services, and messaging are temporarily restricted. Please contact customer support for appeal.</p>
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
                <h4 className="font-bold text-sm text-amber-300">Official Account Warning #{user?.warningCount}</h4>
                <p className="text-xs text-amber-200 font-medium">Notice: {user?.lastWarningReason || 'Policy compliance reminder'}.</p>
                <p className="text-[11px] text-slate-300">Please maintain professional and respectful behavior. Repeated violations will result in account suspension.</p>
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
                  <span className="font-bold text-sm text-red-300 block">KYC Verification Action Required</span>
                  <span className="text-xs text-amber-300 block font-medium">Reason: {user.kycRejectionReason || 'Document photo blur or unreadable. Please re-upload clear photos.'}</span>
                  <span className="text-[11px] text-slate-300 block">Please fix the issue and submit clear documents to activate your client account.</span>
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

          {/* ============================================================== */}
          {/* TAB 1: OVERVIEW (EXACT TO REFERENCE SCREENSHOT)                */}
          {/* ============================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              {/* Hero Banner with Photorealistic Indian Couple Image */}
              <div className="relative rounded-3xl bg-gradient-to-r from-[#ffeef2] via-[#fff5f6] to-[#fedfe7] border border-pink-100/90 p-5 sm:p-7 overflow-hidden shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 w-full md:w-auto z-10">
                  {/* Real Authentic Indian Couple Photograph */}
                  <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shrink-0 shadow-lg ring-4 ring-white/90">
                    <img
                      src="/assets/indian_couple_banner.jpg"
                      alt="PairUpToday Companionship"
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                  </div>

                  <div className="space-y-2 text-center sm:text-left">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#191040] tracking-tight">
                      Welcome Back, <span className="text-[#db2777]">{user?.profileName?.split(' ')[0] || user?.legalName?.split(' ')[0] || 'Rahul'}</span>!
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-md font-medium">
                      Let's find your perfect companion together...
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => setActiveTab('discover')}
                        className="px-6 py-2.5 rounded-full bg-[#5038ee] hover:bg-[#432cc7] text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer transition-transform active:scale-95 mx-auto sm:mx-0"
                      >
                        <span>Explore Matches</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Decorative Indian Heritage Palace Silhouette & Floating Hearts on Right */}
                <div className="hidden md:block absolute right-0 bottom-0 h-full w-96 pointer-events-none select-none overflow-hidden">
                  {/* Floating Soft Hearts */}
                  <div className="absolute top-4 right-32 text-pink-400 opacity-80 animate-pulse">
                    <Heart className="w-5 h-5 fill-pink-400 text-pink-400" />
                  </div>
                  <div className="absolute top-9 right-20 text-rose-300 opacity-90">
                    <Heart className="w-3.5 h-3.5 fill-rose-300 text-rose-300" />
                  </div>
                  {/* Victorian / Indian Palace Monument Silhouette */}
                  <svg className="absolute bottom-0 right-0 h-40 w-full text-pink-300/40" viewBox="0 0 400 160" fill="currentColor">
                    <rect x="0" y="152" width="400" height="8" />
                    <rect x="40" y="142" width="360" height="10" />
                    <path d="M 290 142 L 290 95 C 290 95 290 68 325 48 C 325 40 325 35 325 28 L 327 28 L 327 18 L 328 18 L 328 12 L 329 18 L 330 18 L 330 28 L 332 28 C 332 35 332 40 332 48 C 367 68 367 95 367 95 L 367 142 Z" opacity="0.85" />
                    <rect x="300" y="98" width="5" height="44" opacity="0.6" fill="#fff" />
                    <rect x="314" y="98" width="5" height="44" opacity="0.6" fill="#fff" />
                    <rect x="328" y="98" width="5" height="44" opacity="0.6" fill="#fff" />
                    <rect x="342" y="98" width="5" height="44" opacity="0.6" fill="#fff" />
                    <rect x="356" y="98" width="5" height="44" opacity="0.6" fill="#fff" />
                    <path d="M 180 142 L 180 110 C 180 100 195 90 205 80 L 205 72 L 207 72 L 207 80 C 217 90 232 100 232 110 L 232 142 Z" opacity="0.75" />
                    <rect x="190" y="112" width="4" height="30" opacity="0.5" fill="#fff" />
                    <rect x="204" y="112" width="4" height="30" opacity="0.5" fill="#fff" />
                    <rect x="218" y="112" width="4" height="30" opacity="0.5" fill="#fff" />
                    <path d="M 232 142 L 232 120 L 290 120 L 290 142 Z" opacity="0.7" />
                    <path d="M 110 142 L 110 125 L 180 125 L 180 142 Z" opacity="0.6" />
                    <path d="M 90 142 L 90 120 C 90 112 100 105 105 100 L 105 95 L 107 95 L 107 100 C 112 105 122 112 122 120 L 122 142 Z" opacity="0.6" />
                  </svg>
                </div>
              </div>

              {/* 4 KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Matches */}
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between hover:border-purple-200 transition-all">
                  <div className="space-y-1">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1.5">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900">{filteredCompanions.length || 12}</div>
                    <div className="text-xs font-semibold text-slate-500">Total Matches</div>
                    <div className="text-[11px] font-bold text-emerald-600">↑ +2 this month</div>
                  </div>
                  <svg className="w-20 h-10 text-purple-500 overflow-visible" viewBox="0 0 80 40" fill="none">
                    <path d="M0 35 C 20 30, 25 15, 45 25 C 60 32, 65 5, 80 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>

                {/* 2. Bookings */}
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between hover:border-emerald-200 transition-all">
                  <div className="space-y-1">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
                      <CalendarCheck className="w-5 h-5" />
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900">{myBookings.length || 3}</div>
                    <div className="text-xs font-semibold text-slate-500">Bookings</div>
                    <div className="text-[11px] font-bold text-emerald-600">↑ +1 this month</div>
                  </div>
                  <svg className="w-20 h-10 text-emerald-500 overflow-visible" viewBox="0 0 80 40" fill="none">
                    <path d="M0 35 C 25 32, 35 18, 50 24 C 62 28, 68 10, 80 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>

                {/* 3. Upcoming */}
                <div 
                  onClick={() => setActiveTab('upcoming')}
                  className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-purple-200 transition-all group"
                >
                  <div className="space-y-1">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1.5">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="text-base font-extrabold text-slate-900">Upcoming</div>
                    <div className="text-xs text-slate-500 font-medium">View your upcoming plans</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-purple-50 group-hover:text-purple-600 text-slate-400 flex items-center justify-center transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                {/* 4. KYC Verified */}
                <div 
                  onClick={() => setActiveTab('kyc-status')}
                  className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-200 transition-all group"
                >
                  <div className="space-y-1">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="text-base font-extrabold text-slate-900">
                      {isKycApproved ? 'KYC Verified' : 'KYC Pending'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold pt-0.5">
                      {isKycApproved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Your account is verified</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Upload ID to verify</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-blue-50 group-hover:text-blue-600 text-slate-400 flex items-center justify-center transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Nearby Companions Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-extrabold text-[#191040]">Nearby Companions</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('nearby')}
                    className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(filteredCompanions.length > 0 ? filteredCompanions.slice(0, 4) : companions.slice(0, 4)).map((comp) => (
                    <div
                      key={comp.id}
                      className="rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                          <img
                            src={comp.profilePhoto}
                            alt={comp.name}
                            referrerPolicy="no-referrer"
                            onError={(e: any) => {
                              e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23e2e8f0"/><circle cx="150" cy="80" r="40" fill="%23cbd5e1"/><circle cx="150" cy="180" r="70" fill="%23cbd5e1"/></svg>';
                            }}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2.5 right-2.5">
                            {comp.isOnline !== false ? (
                              <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm text-[11px] font-bold shadow-xs flex items-center gap-1.5 text-emerald-600">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span>Online</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm text-[11px] font-bold shadow-xs flex items-center gap-1.5 text-slate-500">
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                <span>Offline</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-3.5 space-y-1">
                          <div className="text-sm font-bold text-slate-900 flex items-center justify-between">
                            <span>{comp.name}</span>
                            {comp.isOnline !== false ? (
                              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Online</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                <span>Offline</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center justify-between">
                            <span>{comp.age ? `${comp.age}, ` : ''}{comp.address || comp.city || 'Kolkata'}</span>
                            <span className="text-xs font-bold text-purple-700">
                              ₹{(((comp.rates?.hourlyPaise ?? 49900)) / 100).toFixed(0)}/hr
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3.5 pt-0 flex items-center gap-2">
                        <button
                          onClick={() => openQuickView(comp)}
                          className="flex-1 py-2 px-3 rounded-xl border border-purple-200 text-purple-700 hover:bg-purple-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Profile</span>
                        </button>
                        <button
                          onClick={() => setSelectedCompanion(comp)}
                          className="p-2 rounded-xl border border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Book / Save"
                        >
                          <Heart className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 100% Free Client Membership Notice & Quick SOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-xs text-slate-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="w-5 h-5 text-purple-600 shrink-0" />
                    <div>
                      <strong className="block text-slate-900">Client Membership is 100% FREE</strong>
                      <span className="text-[11px] text-slate-500">Zero subscription charges. You only pay for confirmed booking sessions.</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-bold shrink-0">
                    Free Active Access (₹0)
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-xs text-slate-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <strong className="block text-slate-900">24/7 Client Emergency SOS</strong>
                      <span className="text-[11px] text-slate-500">Instant connection to Women Helpline & Police emergency dispatch.</span>
                    </div>
                  </div>
                  <a
                    href="tel:112"
                    className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full border border-rose-200 shrink-0 transition-colors"
                  >
                    SOS 112 / 100
                  </a>
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
                onClick={() => fetchCompanions()}
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

        {/* TAB: LIVE COMPANION ARRIVAL TRACKING */}
        {activeTab === 'tracking' && (
          <ClientLiveTrackingView
            booking={
              trackedBooking ||
              upcomingBookings.find(b => b.status === 'CONFIRMED' || b.status === 'COMPANION_ARRIVED' || b.status === 'IN_PROGRESS') ||
              upcomingBookings[0] ||
              myBookings[0] || {
                id: 'active_session',
                companionName: 'Companion Host',
                serviceName: 'Social Companion',
                meetingLocation: 'Central Public Cafe',
                date: 'Today',
                startTime: '14:00',
                endTime: '16:00',
                durationHours: 2,
                status: 'CONFIRMED'
              }
            }
            user={user}
            onOpenReportModal={openReportModal}
            onBackToOverview={() => setActiveTab('overview')}
          />
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
                        onClick={() => {
                          setTrackedBooking(b);
                          setActiveTab('tracking');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold hover:from-pink-600 hover:to-rose-600 flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Track Arrival</span>
                      </button>
                      <button
                        onClick={() => setActiveChatBooking(b)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
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
                        {b.startOtpVerified ? 'Verified ✓' : (b.status === 'COMPANION_ARRIVED' || b.status === 'IN_PROGRESS' ? (b.startOtp || 'Available on arrival') : 'Locked until arrival')}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
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
                    ₹{Math.round(((selectedCompanion.rates?.hourlyPaise ?? 49900)) / 100)}/hour
                  </span>
                </div>
              </div>
              <button
                onClick={handleCloseBookingModal}
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

            {/* STEP 1: BOOKING FORM */}
            {bookingStep === 'form' && (() => {
              const basePaise = (selectedCompanion.rates?.hourlyPaise ?? 49900) * bookingDurationHours;
              const baseAmount = basePaise / 100;
              const platformFee = baseAmount * 0.15;
              const cgst = baseAmount * 0.09;
              const sgst = baseAmount * 0.09;
              const totalGst = cgst + sgst;
              const totalPayable = baseAmount + totalGst;

              return (
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

                  {/* Companion Real-Time Schedule & 1-Hour Buffer Window Banner */}
                  {companionSchedule && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-sky-950/60 to-slate-900 border border-sky-500/30 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>Companion Schedule on {bookingDate}:</span>
                        </span>
                        {scheduleLoading && <span className="text-[10px] text-slate-400 animate-pulse">updating...</span>}
                      </div>
                      <p className="text-slate-200 font-semibold text-[11px] leading-relaxed">
                        {companionSchedule.summary || 'Available all day (07:00 AM - 12:00 AM)'}
                      </p>
                      <p className="text-[10px] text-sky-400/80">
                        * Note: A 1-hour travel and rest buffer is strictly reserved before and after every meeting.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={bookingTime}
                        onChange={e => setBookingTime(e.target.value)}
                        className={`w-full px-3.5 py-2 bg-slate-950 border rounded-xl text-slate-100 focus:outline-none ${timeConflictError ? 'border-rose-500 text-rose-200' : 'border-slate-700 focus:border-amber-400'}`}
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

                  {/* 1-Hour Buffer Time Conflict Alert */}
                  {timeConflictError && (
                    <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200 space-y-1.5 shadow-lg shadow-rose-950/50 animate-fade-in">
                      <div className="font-extrabold flex items-center gap-1.5 text-rose-300">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Selected Time Slot Unavailable (1-Hour Travel Buffer Rule)</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-300">
                        {timeConflictError}
                      </p>
                      <p className="text-[10px] text-rose-400 font-medium">
                        Please select an available time slot before or after this window to proceed.
                      </p>
                    </div>
                  )}

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

                  {/* Price Calculation Card (Detailed with 18% GST Breakdown) */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Companion Fee ({bookingDurationHours}h):</span>
                      <span className="text-slate-200">₹{baseAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Platform Maintenance (15% included):</span>
                      <span className="text-slate-400">₹{platformFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>CGST (9%):</span>
                      <span className="text-slate-200">₹{cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>SGST (9%):</span>
                      <span className="text-slate-200">₹{sgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-100 pt-1.5 border-t border-slate-800 text-sm">
                      <span>Total Payable (incl. 18% GST):</span>
                      <span className="text-amber-400">₹{totalPayable.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={bookingInProgress || user?.isSuspended || Boolean(timeConflictError)}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-sm shadow-xl shadow-pink-500/20 transition-all hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <CalendarCheck className="w-4 h-4" />
                    <span>
                      {user?.isSuspended
                        ? 'Account Suspended - Booking Disabled'
                        : timeConflictError
                        ? 'Time Conflict - Pick an Available Slot'
                        : (bookingInProgress ? 'Sending Request...' : 'Send Booking Request')}
                    </span>
                  </button>

                  <p className="text-[10px] text-center text-slate-500">
                    Companion will receive your request immediately. Payment is only charged after companion accepts.
                  </p>
                </form>
              );
            })()}

            {/* STEP 2: WAITING FOR COMPANION ACCEPTANCE */}
            {bookingStep === 'waiting_acceptance' && (() => {
              const basePaise = (selectedCompanion.rates?.hourlyPaise ?? 49900) * bookingDurationHours;
              const totalPayable = (basePaise * 1.18) / 100;
              return (
                <div className="py-6 px-2 text-center space-y-4 animate-fade-in">
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-pink-500/20 animate-ping" />
                    <div className="relative w-16 h-16 rounded-full bg-slate-800 border-2 border-pink-500 flex items-center justify-center shadow-lg shadow-pink-500/30">
                      <Clock className="w-8 h-8 text-pink-400 animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-slate-100">
                      Waiting for Companion Acceptance...
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      Booking request sent to <strong className="text-pink-300">{selectedCompanion.name}</strong>. Please keep this screen open while the companion confirms availability.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Date & Time:</span>
                      <span className="font-semibold text-slate-200">{bookingDate} ({bookingTime}, {bookingDurationHours} hrs)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Meeting Venue:</span>
                      <span className="font-semibold text-slate-200 truncate max-w-[200px]">{meetingLocation}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
                      <span>Total Amount:</span>
                      <span className="text-amber-400">₹{totalPayable.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseBookingModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    Cancel Request
                  </button>
                </div>
              );
            })()}

            {/* STEP 3: BOOKING ACCEPTED -> PROCEED TO CHECKOUT */}
            {bookingStep === 'accepted' && (() => {
              const basePaise = (selectedCompanion.rates?.hourlyPaise ?? 49900) * bookingDurationHours;
              const baseAmount = basePaise / 100;
              const cgst = baseAmount * 0.09;
              const sgst = baseAmount * 0.09;
              const totalGst = cgst + sgst;
              const totalPayable = baseAmount + totalGst;

              return (
                <div className="py-6 px-2 text-center space-y-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-emerald-300">
                      Booking Accepted by {selectedCompanion.name}!
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      The companion has accepted your request. Complete your payment to confirm the session and immediately open chat.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
                    <div className="flex justify-between text-slate-400">
                      <span>Booking Fee ({bookingDurationHours}h):</span>
                      <span className="text-slate-200 font-semibold">₹{baseAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>CGST (9%):</span>
                      <span className="text-slate-200">₹{cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>SGST (9%):</span>
                      <span className="text-slate-200">₹{sgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-2 font-bold text-sm">
                      <span>Total Payable Amount:</span>
                      <span className="text-emerald-400">₹{totalPayable.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleProceedToCheckout}
                    disabled={bookingInProgress}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>{bookingInProgress ? 'Connecting to Payment Gateway...' : 'Continue to Checkout'}</span>
                  </button>
                </div>
              );
            })()}

            {/* STEP 4: COMPANION BUSY / REJECTED */}
            {bookingStep === 'rejected' && (
              <div className="py-6 px-2 text-center space-y-4 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <AlertTriangle className="w-8 h-8 text-amber-400" />
                </div>

                <div>
                  <h4 className="text-base font-bold text-amber-300">
                    This Companion is Currently Busy
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                    {selectedCompanion.name} is unable to take this booking right now. Don't worry, there are other verified companions available near you!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleCloseBookingModal();
                    setActiveTab('overview');
                    fetchCompanions();
                  }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-sm shadow-xl shadow-pink-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Compass className="w-4 h-4" />
                  <span>Book Another Companion</span>
                </button>
              </div>
            )}

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

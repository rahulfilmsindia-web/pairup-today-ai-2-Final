import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';
import { openRazorpayCheckout } from '../utils/razorpay';
import { PAIRUP_SERVICES, ServiceItem } from '../constants/services';
import { PAN_INDIA_CITIES } from '../constants/cities';
import { compressImageFile, compressBase64 } from '../utils/image';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { ClientLiveTrackingView } from '../components/ClientLiveTrackingView';
import { TimeframeFilter, TimeframeFilterBar, matchesTimeframe, formatFullDateTime } from '../utils/timeframeFilters';
import { 
  Search, MapPin, Filter, Star, Clock, Calendar, ShieldCheck, 
  AlertCircle, MessageSquare, PhoneCall, CheckCircle, Navigation, 
  CreditCard, KeyRound, AlertTriangle, ChevronRight, UserCheck, X,
  Bell, Settings, LifeBuoy, LogOut, Heart, Sparkles, User, FileText,
  DollarSign, Compass, CheckCircle2, Sliders, Shield, Eye, ChevronLeft,
  CalendarCheck, Upload, Lock, Trash2, Camera, ShieldAlert, Menu, Users, ChevronDown, Home
} from 'lucide-react';

interface ClientDashboardProps {
  onNavigateToPage?: (page: string) => void;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ onNavigateToPage }) => {
  const { user, token, activeRole, selectActiveRole, logout, bookingContext, setBookingContext, updateProfile, requestOtp, changePassword, deleteAccount, openKycWizard, refreshUserData } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  // Role switch helper: smoothly switch to Companion Dashboard
  const handleSwitchToCompanion = async () => {
    try {
      await selectActiveRole('COMPANION');
      if (onNavigateToPage) {
        onNavigateToPage('companion-dashboard');
      } else {
        window.location.href = '/companion-dashboard';
      }
    } catch (e) {
      console.warn('Switch to companion error', e);
    }
  };

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [smartFilter, setSmartFilter] = useState<'all' | 'online' | 'suggested'>('all');
  const [showAllCompanions, setShowAllCompanions] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (user && activeRole !== 'CLIENT') {
      selectActiveRole('CLIENT').catch(() => {});
    }
  }, [user?.id]);

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
  const isSubmittingBookingRef = useRef<boolean>(false);

  const cleanupPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => cleanupPolling();
  }, []);

  // Booking modal state & auto-date/time helpers
  const getTodayDateStr = (): string => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getInitialBookingDateTime = () => {
    const future30 = new Date(Date.now() + 30 * 60 * 1000);
    const yyyy = future30.getFullYear();
    const mm = String(future30.getMonth() + 1).padStart(2, '0');
    const dd = String(future30.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const hours = String(future30.getHours()).padStart(2, '0');
    const minutes = String(future30.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    return { dateStr, timeStr };
  };

  const getMinAllowedTimeForToday = (): string => {
    const future30 = new Date(Date.now() + 30 * 60 * 1000);
    const hours = String(future30.getHours()).padStart(2, '0');
    const minutes = String(future30.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatTimeAmPm = (timeStr: string): string => {
    if (!timeStr || !timeStr.includes(':')) return timeStr;
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  };

  const [selectedCompanion, setSelectedCompanion] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState(() => getTodayDateStr());
  const [bookingTime, setBookingTime] = useState(() => getInitialBookingDateTime().timeStr);
  const [bookingDurationHours, setBookingDurationHours] = useState(1);
  const [meetingLocation, setMeetingLocation] = useState('Central Public Cafe, MG Road');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [companionSchedule, setCompanionSchedule] = useState<any | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [timeConflictError, setTimeConflictError] = useState<string | null>(null);

  const todayDateStr = getTodayDateStr();
  const isBookingToday = bookingDate === todayDateStr;
  const minAllowedTimeToday = getMinAllowedTimeForToday();
  const isPastMinTimeToday = isBookingToday && bookingTime < minAllowedTimeToday;

  const handleBookingDateChange = (newDate: string) => {
    setBookingDate(newDate);
    if (newDate === todayDateStr) {
      const minTime = getMinAllowedTimeForToday();
      if (bookingTime < minTime) {
        setBookingTime(minTime);
      }
    }
  };

  const handleBookingTimeChange = (newTime: string) => {
    setBookingTime(newTime);
  };

  // Automatically auto-select current date and (current time + 30 mins) whenever a companion is selected
  useEffect(() => {
    if (selectedCompanion?.id) {
      const init = getInitialBookingDateTime();
      setBookingDate(init.dateStr);
      setBookingTime(init.timeStr);
      setBookingDurationHours(1);
      setBookingError(null);
      setTimeConflictError(null);
    }
  }, [selectedCompanion?.id]);

  // Review & Rating Modal state
  const [reviewingBooking, setReviewingBooking] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewHoverRating, setReviewHoverRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);
  const [reviewErrorMsg, setReviewErrorMsg] = useState<string | null>(null);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingBooking) return;
    setSubmittingReview(true);
    setReviewErrorMsg(null);
    setReviewSuccessMsg(null);
    try {
      const res = await apiFetch(`/api/bookings/${reviewingBooking.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewErrorMsg(data.error || 'Failed to submit review.');
        setSubmittingReview(false);
        return;
      }
      setReviewSuccessMsg('Thank you! Your feedback and rating have been recorded.');
      setMyBookings(prev => prev.map(b => b.id === reviewingBooking.id ? { ...b, clientReview: data.review } : b));
      setTimeout(() => {
        setReviewingBooking(null);
        setReviewSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setReviewErrorMsg(err.message || 'Error submitting review.');
    } finally {
      setSubmittingReview(false);
    }
  };

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

  const handleCloseBookingModal = (isConfirmedPaid = false) => {
    // If client cancels or closes during waiting_acceptance or pending, notify server to immediately dismiss companion alert
    // CRITICAL: NEVER cancel if booking is confirmed/paid or if client is just closing the modal after successful payment!
    const isAlreadyPaidOrConfirmed = isConfirmedPaid || 
      activeBookingResponse?.booking?.paymentStatus === 'PAID' ||
      ['CONFIRMED', 'CONFIRMED_PAID', 'ONGOING', 'IN_PROGRESS', 'COMPLETED'].includes(activeBookingResponse?.booking?.status);

    if (!isAlreadyPaidOrConfirmed && activeBookingResponse?.booking?.id && (bookingStep === 'waiting_acceptance' || (bookingStep as string) === 'pending')) {
      apiFetch(`/api/bookings/${activeBookingResponse.booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'CLIENT_CANCELLED' })
      }).catch(() => {});
    }
    cleanupPolling();
    isSubmittingBookingRef.current = false;
    setBookingInProgress(false);
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

  // In-app Back Navigation Handler (prevents unexpected page exits)
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const quickViewCompanionRef = useRef<any>(null);
  quickViewCompanionRef.current = quickViewCompanion;
  const selectedCompanionRef = useRef<any>(null);
  selectedCompanionRef.current = selectedCompanion;

  const handleDashboardBack = () => {
    if (selectedCompanionRef.current) {
      handleCloseBookingModal();
      return true;
    }
    if (quickViewCompanionRef.current) {
      closeQuickView();
      return true;
    }
    if (activeTabRef.current !== 'overview') {
      setActiveTab('overview');
      return true;
    }
    return false;
  };

  useEffect(() => {
    const handlePopState = () => {
      if (quickViewCompanionRef.current || selectedCompanionRef.current || activeTabRef.current !== 'overview') {
        handleDashboardBack();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  // Date & Timeframe filters (All Time, Today, Last 7 Days, This Month)
  const [historyTimeframe, setHistoryTimeframe] = useState<TimeframeFilter>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'successful' | 'cancelled'>('all');
  const [paymentsTimeframe, setPaymentsTimeframe] = useState<TimeframeFilter>('all');

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
  const fetchCompanions = async (silent = false) => {
    if (!silent) setLoadingCompanions(true);
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
      if (!silent) setLoadingCompanions(false);
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
    fetchCompanions(false);
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
    if (activeChatBooking.status === 'COMPLETED' || activeChatBooking.status === 'CANCELLED' || activeChatBooking.status === 'REJECTED') {
      return;
    }

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
    if (isSubmittingBookingRef.current || bookingInProgress) return;

    // Strict Initial Listing Non-Bookable Guard
    if (selectedCompanion.isInitialListing) {
      setBookingError(t.profileUnavailableForBooking || 'This profile is currently unavailable for booking.');
      return;
    }

    if (user.kycStatus === 'REJECTED') {
      setBookingError('Identity Verification Rejected: Please update your KYC documents in Profile settings.');
      return;
    }

    if (timeConflictError) {
      setBookingError(timeConflictError);
      return;
    }

    // Minimum 30 minutes in advance enforcement for today's bookings
    if (isBookingToday && bookingTime < minAllowedTimeToday) {
      setBookingError(`For today's bookings, start time must be at least 30 minutes in advance (minimum: ${formatTimeAmPm(minAllowedTimeToday)}).`);
      return;
    }

    isSubmittingBookingRef.current = true;
    setBookingError(null);
    setBookingInProgress(true);

    const endH = parseInt(bookingTime.split(':')[0], 10) + bookingDurationHours;
    const formattedEndTime = `${String(endH % 24).padStart(2, '0')}:${bookingTime.split(':')[1]}`;

    let lastErrorMsg = '';
    for (let attempt = 1; attempt <= 2; attempt++) {
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

        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        if (!res.ok) {
          setBookingError(data.error || 'Failed to submit booking request.');
          isSubmittingBookingRef.current = false;
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
        return; // Success!
      } catch (err: any) {
        lastErrorMsg = err?.message || 'Network error';
        if (attempt === 1 && (lastErrorMsg === 'Failed to fetch' || /fetch/i.test(lastErrorMsg))) {
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
      }
    }

    if (lastErrorMsg === 'Failed to fetch' || /fetch/i.test(lastErrorMsg)) {
      setBookingError('Unable to connect to server. Please check your internet connection and try sending the request again.');
    } else {
      setBookingError(lastErrorMsg || 'Network error during booking confirmation.');
    }
    isSubmittingBookingRef.current = false;
    setBookingInProgress(false);
  };

  const handleProceedToCheckout = async (forceTestMode = false) => {
    if (!activeBookingResponse || !user) return;
    setBookingInProgress(true);
    setBookingError(null);
    try {
      const { booking, payment } = activeBookingResponse;
      let orderToPay: any = { ...(payment || {}) };

      if (forceTestMode) {
        orderToPay.isTestMode = true;
        orderToPay.keyId = 'rzp_test_pairuptoday';
        orderToPay.orderId = `ord_test_${booking.id.replace(/-/g, '').slice(0, 16)}`;
        orderToPay.amountPaise = booking.totalPayablePaise || Math.round((booking.bookingAmountPaise || 49900) * 1.18);
        orderToPay.currency = 'INR';
      } else {
        // Ensure keyId is always present
        if (!orderToPay.keyId) {
          orderToPay.keyId = 'rzp_test_pairuptoday';
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
          orderToPay.orderId = `ord_test_${booking.id.replace(/-/g, '').slice(0, 16)}`;
          orderToPay.isTestMode = true;
        }
        if (!Number.isSafeInteger(orderToPay.amountPaise) || orderToPay.amountPaise <= 0) {
          orderToPay.amountPaise = booking.totalPayablePaise || Math.round((booking.bookingAmountPaise || 49900) * 1.18);
        }
      }

      let checkoutResult: any;
      try {
        checkoutResult = await openRazorpayCheckout(
          orderToPay,
          `Companion booking ${booking.bookingCode}`,
          { name: user.legalName, contact: user.phone }
        );
      } catch (checkoutErr: any) {
        console.warn('Razorpay checkout error notice:', checkoutErr);
        setBookingError(`Payment gateway notice: ${checkoutErr?.message || 'Gateway connection issue'}. You can click "Pay (Test Mode / Sandbox)" to complete and confirm your booking instantly.`);
        setBookingInProgress(false);
        return;
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
        sessionOtp: verification.booking?.sessionOtp || verification.booking?.startOtp || '7492',
        status: 'CONFIRMED_PAID'
      };

      setTimeout(() => {
        handleCloseBookingModal(true);
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
  const successfulBookings = myBookings.filter(b => 
    (b.paymentStatus === 'PAID' || b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.status === 'IN_PROGRESS' || b.status === 'COMPANION_ARRIVED') &&
    b.status !== 'CANCELLED' && b.status !== 'REJECTED'
  );
  const upcomingBookings = myBookings.filter(b => 
    (b.status === 'CONFIRMED' || b.status === 'COMPANION_ARRIVED' || b.status === 'IN_PROGRESS' || (b.paymentStatus === 'PAID' && b.status !== 'COMPLETED')) &&
    b.status !== 'CANCELLED' && b.status !== 'REJECTED'
  );
  const pastBookings = myBookings.filter(b => b.status === 'COMPLETED' || b.status === 'CANCELLED');
  const paidChatBookingsCount = myBookings.filter(b => 
    (b.paymentStatus === 'PAID' || b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'COMPLETED') &&
    b.status !== 'CANCELLED' && b.status !== 'REJECTED'
  ).length;

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

  // Unified companions filtering for search, category, city, budget, and smart filter
  // Requirement 3: Strictly show ONLY active and online companions who are NOT busy
  const displayCompanions = companions.filter(c => {
    // Companion must be active/online (not paused, not offline) and not currently busy
    const isOnline = Boolean(c.isOnline || (c.isLive && !c.isPaused));
    const isBusy = Boolean(c.isBusy) || c.status === 'busy';
    if (!isOnline || isBusy) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchBio = c.bio?.toLowerCase().includes(q);
      const matchCity = c.city?.toLowerCase().includes(q);
      if (!matchName && !matchBio && !matchCity) return false;
    }
    if (selectedCity !== 'all') {
      const cCity = (c.city || '').toLowerCase();
      const sCity = selectedCity.toLowerCase();
      const match = cCity.includes(sCity) || sCity.includes(cCity) ||
        (sCity === 'bengaluru' && cCity.includes('bangalore')) ||
        (sCity === 'bangalore' && cCity.includes('bengaluru')) ||
        (sCity === 'kolkata' && cCity.includes('calcutta')) ||
        (sCity === 'mumbai' && cCity.includes('bombay')) ||
        (sCity === 'gurugram' && cCity.includes('gurgaon')) ||
        (sCity === 'gurgaon' && cCity.includes('gurugram')) ||
        (sCity === 'prayagraj' && cCity.includes('allahabad')) ||
        (sCity === 'chennai' && cCity.includes('madras'));
      if (!match) return false;
    }
    if (smartFilter === 'suggested' && (c.rating || 0) < 4.8) {
      return false;
    }
    const hourly = (c.rates?.hourlyPaise || 49900) / 100;
    if (hourly > maxBudgetHourly) return false;
    if (selectedCategory !== 'all') {
      const s = PAIRUP_SERVICES.filter(srv => c.services?.includes(srv.id));
      if (!s.some(item => item.category === selectedCategory)) return false;
    }
    return true;
  });

  const onlineCompanionsCount = companions.filter(c => Boolean(c.isOnline || (c.isLive && !c.isPaused)) && !c.isBusy).length;
  const userFirstName = user?.profileName?.trim()?.split(' ')[0] || user?.legalName?.trim()?.split(' ')[0] || 'Rahul';
  const visibleCompanions = showAllCompanions ? displayCompanions : displayCompanions.slice(0, 8);

  const navMenuItems: { id: ClientTab; label: string; icon: React.FC<{ className?: string }>; badge?: string | number; badgeColor?: string }[] = [
    { id: 'overview', label: 'Overview', icon: Compass },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'kyc-status', label: 'My KYC Status', icon: ShieldCheck, badge: isKycApproved ? '✓' : 'Pending', badgeColor: isKycApproved ? 'bg-emerald-500' : 'bg-amber-500' },
    { id: 'services', label: '24 Services', icon: Sparkles },
    { id: 'upcoming', label: 'Upcoming Plans', icon: CalendarCheck, badge: upcomingBookings.length > 0 ? upcomingBookings.length : undefined, badgeColor: 'bg-violet-600' },
    { id: 'history', label: 'Booking History', icon: Calendar, badge: successfulBookings.length > 0 ? successfulBookings.length : undefined, badgeColor: 'bg-emerald-500' },
    { id: 'chat', label: 'Secure Chat', icon: MessageSquare, badge: paidChatBookingsCount > 0 ? (paidChatBookingsCount > 9 ? '9+' : paidChatBookingsCount) : undefined, badgeColor: 'bg-pink-500' },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: notifications.length > 0 ? (notifications.length > 9 ? '9+' : notifications.length) : undefined, badgeColor: 'bg-rose-500' },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'help-safety', label: 'Help & Safety', icon: ShieldAlert },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="h-screen w-screen max-w-full bg-[#F4F2FA] text-slate-800 flex overflow-hidden relative font-sans">
      
      {/* ─── DESKTOP LEFT FIXED SIDEBAR (Permanently locked on lg+ screens >= 1024px) ─── */}
      <aside className="hidden lg:flex lg:w-64 xl:w-72 bg-gradient-to-b from-[#1A135E] via-[#241461] to-[#701A75] text-white flex-col justify-between h-screen shrink-0 z-30 shadow-2xl p-5 overflow-y-auto scrollbar-none select-none">
        <div className="space-y-4">
          {/* Top-Left: Dedicated Desktop Home Navigation Button */}
          <div className="flex items-center justify-start pb-1">
            <button
              type="button"
              onClick={() => onNavigateToPage ? onNavigateToPage('home') : (window.location.href = '/')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all shadow-sm cursor-pointer group"
              title="Return to Home"
            >
              <Home className="w-3.5 h-3.5 text-pink-300 group-hover:text-white" />
              <span>← Home</span>
            </button>
          </div>

          {/* Top Logo Branding: Identical to Home Page */}
          <div className="w-full flex flex-col items-center gap-1.5 py-1 select-none">
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
                Connect · Match · Belong
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {navMenuItems.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#6D28D9] text-white font-bold shadow-lg shadow-purple-900/40 ring-1 ring-purple-400/30'
                      : 'text-purple-100/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComp className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-200'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm ${item.badgeColor || 'bg-pink-500'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Action Links: Switch to Companion & Logout */}
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            <button
              type="button"
              onClick={handleSwitchToCompanion}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-amber-300 hover:text-white hover:bg-amber-500/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{language === 'bn' ? 'কম্প্যানিয়ন মোডে যান ⇄' : language === 'hi' ? 'कंपैनियन मोड में जाएँ ⇄' : 'Switch to Companion ⇄'}</span>
            </button>

            <button
              onClick={async () => {
                if (window.confirm(language === 'bn' ? 'আপনি কি PairUpToday থেকে লগআউট করতে চান?' : language === 'hi' ? 'क्या आप लॉगआउट करना चाहते हैं?' : 'Log out of PairUpToday?')) {
                  await logout();
                  if (onNavigateToPage) {
                    onNavigateToPage('home');
                  } else {
                    window.location.href = '/';
                  }
                }
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-500/20 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{language === 'bn' ? 'লগআউট' : language === 'hi' ? 'लॉगआउट' : 'Logout'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Silhouette & Hearts Artwork */}
        <div className="relative pt-6 pb-2 mt-4 border-t border-white/10 flex items-end justify-between overflow-hidden">
          <div className="space-y-1 z-10">
            <p className="text-[10px] text-pink-200/80 uppercase font-mono tracking-wider">Client Safe Portal</p>
            <p className="text-xs text-white font-bold">100% Free Membership</p>
          </div>
          <div className="relative text-pink-300">
            <Heart className="w-5 h-5 fill-pink-400 text-pink-400 opacity-80 animate-pulse absolute -top-4 right-2" />
            <Heart className="w-3.5 h-3.5 fill-pink-300 text-pink-300 opacity-60 absolute -top-1 right-7" />
            <Users className="w-10 h-10 text-white/30" />
          </div>
        </div>
      </aside>

      {/* ─── MOBILE SLIDE-OVER DRAWER (For all screens < lg) ─── */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            onClick={() => setIsMobileSidebarOpen(false)} 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />
          <div className="relative w-72 max-w-[80vw] bg-gradient-to-b from-[#1A135E] via-[#241461] to-[#701A75] text-white p-5 flex flex-col justify-between shadow-2xl z-10">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileSidebarOpen(false);
                    onNavigateToPage ? onNavigateToPage('home') : (window.location.href = '/');
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
                    <span className="text-[8px] text-pink-300 uppercase tracking-widest block">Client Portal</span>
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

              {/* Mobile Nav Links */}
              <nav className="space-y-1">
                {navMenuItems.map((item) => {
                  const IconComp = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-[#6D28D9] text-white font-bold shadow-md'
                          : 'text-purple-100/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <IconComp className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-200'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${item.badgeColor || 'bg-pink-500'}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  handleSwitchToCompanion();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 hover:text-white hover:bg-amber-500/20"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{language === 'bn' ? 'কম্প্যানিয়ন মোডে যান ⇄' : language === 'hi' ? 'कंपैनियन मोड में जाएँ ⇄' : 'Switch to Companion ⇄'}</span>
              </button>

              <button
                onClick={async () => {
                  if (window.confirm(language === 'bn' ? 'আপনি কি PairUpToday থেকে লগআউট করতে চান?' : language === 'hi' ? 'क्या आप लॉगआउट करना चाहते हैं?' : 'Log out of PairUpToday?')) {
                    setIsMobileSidebarOpen(false);
                    await logout();
                    if (onNavigateToPage) {
                      onNavigateToPage('home');
                    } else {
                      window.location.href = '/';
                    }
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-500/20"
              >
                <LogOut className="w-4 h-4" />
                <span>{language === 'bn' ? 'লগআউট' : language === 'hi' ? 'लॉगआउट' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT AREA (RIGHT SIDE ON DESKTOP, SCROLLS INDEPENDENTLY) ─── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto max-w-full bg-[#F4F2FA]">
        
        {/* Mobile Header Bar (Active on all screens < lg) */}
        <header className="lg:hidden flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-white/95 backdrop-blur-md border-b border-purple-100 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Top-Left: Home Button */}
            <button
              onClick={() => onNavigateToPage ? onNavigateToPage('home') : (window.location.href = '/')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-purple-50 hover:bg-purple-100 text-[#1A135E] border border-purple-200 text-xs font-bold shadow-sm transition-all shrink-0 cursor-pointer"
              title="Return to Home"
            >
              <Home className="w-3.5 h-3.5 text-purple-700" />
              <span>Home</span>
            </button>

            {/* Menu Drawer Toggle */}
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl text-[#1A135E] hover:bg-purple-50 transition-colors cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo: Exact Home Page Logo */}
            <div className="flex items-center gap-1.5">
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden ring-2 ring-amber-400/80 shadow-sm shrink-0">
                <img
                  src="/assets/aistudio/image_AIIEuv.png_bc62f6e1.png"
                  alt="PairUpToday"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-extrabold text-[#1A135E] text-xs sm:text-sm truncate">PairUpToday</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Switch to Companion Button on Mobile */}
            <button
              onClick={handleSwitchToCompanion}
              className="px-2 sm:px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 text-white text-[10px] sm:text-xs font-bold flex items-center gap-1 shadow-sm shrink-0"
              title="Switch to Companion Mode"
            >
              <Sparkles className="w-3 h-3 text-yellow-200" />
              <span className="hidden sm:inline">Companion</span>
              <span>⇄</span>
            </button>

            {/* Quick Language switch on mobile */}
            <div className="flex items-center bg-purple-50 rounded-lg p-0.5 border border-purple-200 text-[10px] font-bold">
              <button onClick={() => setLanguage('en')} className={`px-1.5 py-0.5 rounded ${language === 'en' ? 'bg-[#4C1D95] text-white' : 'text-slate-600'}`}>EN</button>
              <button onClick={() => setLanguage('bn')} className={`px-1.5 py-0.5 rounded ${language === 'bn' ? 'bg-[#4C1D95] text-white' : 'text-slate-600'}`}>বা</button>
              <button onClick={() => setLanguage('hi')} className={`px-1.5 py-0.5 rounded ${language === 'hi' ? 'bg-[#4C1D95] text-white' : 'text-slate-600'}`}>हि</button>
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setActiveTab('notifications')}
              className="relative p-1.5 sm:p-2 rounded-full bg-white border border-purple-100 text-slate-700 shadow-sm"
            >
              <Bell className="w-4 h-4 text-[#1A135E]" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-extrabold px-1">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {/* Profile Avatar */}
            <button onClick={() => setActiveTab('profile')}>
              <img
                src={user?.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                alt={user?.legalName}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-purple-400"
              />
            </button>
          </div>
        </header>

        {/* Mobile Search & Filters Sub-Header */}
        <div className="lg:hidden px-3 sm:px-4 py-2 bg-white border-b border-purple-100 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Discover Companions..."
              className="w-full pl-9 pr-3 py-1.5 rounded-full bg-slate-50 border border-purple-100 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={() => setShowFilterDrawer(!showFilterDrawer)}
            className="px-3 py-1.5 rounded-xl bg-[#4C1D95] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>
        </div>

        {/* ─── DESKTOP TOPBAR HEADER (Active strictly on screens >= lg) ─── */}
        <header className="hidden lg:flex items-center justify-between px-6 lg:px-8 py-3.5 bg-white/95 backdrop-blur-md border-b border-purple-100/90 sticky top-0 z-20 shadow-sm shrink-0">
          {/* Left: Search input + Search & Filters Button */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Discover Companions..."
                className="w-64 lg:w-80 pl-11 pr-4 py-2 rounded-full bg-slate-50 hover:bg-white border border-purple-200 text-slate-800 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-inner focus:bg-white transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className="px-4 py-2 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Sliders className="w-4 h-4" />
              <span>Search & Filters</span>
            </button>
          </div>

          {/* Right: Companion Switcher + Language toggle + Bell badge + User chip */}
          <div className="flex items-center gap-3">
            {activeTab !== 'overview' && (
              <button
                onClick={() => setActiveTab('overview')}
                className="px-3.5 py-1.5 rounded-full bg-purple-50 hover:bg-purple-100 text-[#4C1D95] text-xs font-bold flex items-center gap-1.5 border border-purple-200 transition-colors shadow-sm cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Overview</span>
              </button>
            )}

            {/* Switch to Companion Mode (Available for all Clients & Companions) */}
            <button
              onClick={handleSwitchToCompanion}
              className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-pink-500/25 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Switch to Companion Portal"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
              <span>Companion Mode ⇄</span>
            </button>

            {/* 1-Click Language Switcher */}
            <div className="flex items-center bg-purple-50 p-1 rounded-full border border-purple-200 text-xs font-semibold">
              <button onClick={() => setLanguage('en')} className={`px-2.5 py-1 rounded-full transition-colors ${language === 'en' ? 'bg-[#4C1D95] text-white font-bold shadow-sm' : 'text-slate-600 hover:text-purple-700'}`}>EN</button>
              <button onClick={() => setLanguage('bn')} className={`px-2.5 py-1 rounded-full transition-colors ${language === 'bn' ? 'bg-[#4C1D95] text-white font-bold shadow-sm' : 'text-slate-600 hover:text-purple-700'}`}>বাংলা</button>
              <button onClick={() => setLanguage('hi')} className={`px-2.5 py-1 rounded-full transition-colors ${language === 'hi' ? 'bg-[#4C1D95] text-white font-bold shadow-sm' : 'text-slate-600 hover:text-purple-700'}`}>हिंदी</button>
            </div>

            {/* Notification Bell with Red Badge */}
            <button
              onClick={() => setActiveTab('notifications')}
              className="relative p-2.5 rounded-full bg-white border border-purple-100 text-slate-700 hover:text-purple-700 shadow-sm transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4 text-[#1A135E]" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-extrabold px-1 shadow">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {/* User Profile Chip */}
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full bg-white border border-purple-200 shadow-sm hover:border-purple-300 transition-colors cursor-pointer"
            >
              <img
                src={user?.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                alt={user?.legalName}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-400"
              />
              <span className="text-xs font-bold text-slate-800">{user?.profileName || user?.legalName || 'Rahul Mondal'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </header>

        {/* ─── COLLAPSIBLE SEARCH & FILTERS DRAWER / PANEL ─── */}
        {showFilterDrawer && (
          <div className="bg-white border-b border-purple-100 px-4 sm:px-6 lg:px-8 py-4 shadow-sm animate-fade-in">
            <div className="max-w-7xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4C1D95] flex items-center gap-2">
                  <Sliders className="w-4 h-4" /> Filter Companions
                </span>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCity('all');
                    setSelectedCategory('all');
                    setMaxBudgetHourly(3000);
                    setSmartFilter('all');
                  }}
                  className="text-xs text-rose-500 hover:underline font-semibold"
                >
                  Reset All Filters
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* City Selection */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">City Location</label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-purple-200 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="all">🌐 All Cities (Pan-India)</option>
                    {PAN_INDIA_CITIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label} ({c.state})</option>
                    ))}
                  </select>
                </div>

                {/* Max Hourly Rate Slider */}
                <div>
                  <div className="flex justify-between font-semibold text-slate-600 mb-1">
                    <span>Max Hourly Budget</span>
                    <span className="text-[#4C1D95] font-bold">₹{maxBudgetHourly}/hr</span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={5000}
                    step={100}
                    value={maxBudgetHourly}
                    onChange={(e) => setMaxBudgetHourly(Number(e.target.value))}
                    className="w-full accent-[#4C1D95]"
                  />
                </div>

                {/* Service Category */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Service Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-purple-200 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="all">All Categories</option>
                    <option value="social">Social & Public Gatherings</option>
                    <option value="travel">Travel & Sightseeing</option>
                    <option value="dining">Dining & Cafes</option>
                    <option value="shopping">Shopping & Style Guidance</option>
                    <option value="event">Corporate & Wedding Events</option>
                    <option value="cultural">Art & Cultural Exploration</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── SCROLLABLE MAIN CONTENT BODY ─── */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 max-w-7xl w-full mx-auto pb-24 md:pb-8">

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

          {/* Live Walking Tracker Banner (if confirmed booking exists) */}
          {trackedBooking && activeTab !== 'tracking' && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 border border-pink-500/30 flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-pink-500 text-white shadow-md shadow-pink-500/30 animate-pulse">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1A135E]">Live Companion Arrival in Progress</h4>
                  <p className="text-[11px] text-slate-500">{trackedBooking.companionName} is en route to {trackedBooking.meetingLocation}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('tracking')}
                className="px-4 py-2 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-bold shadow-md shadow-purple-900/20 whitespace-nowrap cursor-pointer"
              >
                Open Live Walking Tracker →
              </button>
            </div>
          )}



          {/* ═══════════════════════════════════════════════════════════ */}
          {/* TAB 1: OVERVIEW (MODERN UNIFIED DASHBOARD PER REFERENCE)   */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* 1. HERO WELCOME BANNER (3:1 Panoramic Couple Artwork + Right-Aligned Frosted Glass Content) */}
              <div className="w-full">
                {/* DESKTOP & TABLET VIEW (sm and above): Full-width Panoramic with Text floating on right sky area */}
                <div 
                  className="hidden sm:flex relative w-full min-h-[280px] md:min-h-[300px] lg:min-h-[320px] rounded-3xl overflow-hidden shadow-lg border border-pink-200/60 items-center justify-end p-6 md:p-8 lg:p-10"
                  style={{
                    backgroundImage: "url('/assets/client_welcome_banner.png')",
                    backgroundPosition: "left center",
                    backgroundSize: "cover",
                    backgroundRepeat: "no-repeat"
                  }}
                >
                  {/* Ultra-sheer glassmorphic container: Leaves 100% of the couple, sky & palace unblocked */}
                  <div className="relative z-10 w-full max-w-sm md:max-w-md lg:max-w-lg bg-black/20 sm:bg-black/15 backdrop-blur-[2px] border border-white/30 rounded-3xl p-5 sm:p-6 shadow-xl space-y-3 text-left">
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-pink-500/80 border border-white/40 text-white text-[11px] font-bold tracking-wide shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      <span>✨ Verified Social Companionship</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                      {language === 'bn' ? 'স্বাগতম, ' : language === 'hi' ? 'स्वागत है, ' : 'Welcome Back, '}
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-rose-200 to-amber-200">{userFirstName}!</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-white font-medium leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                      {language === 'bn' 
                        ? 'চলুন একসাথে আপনার আদর্শ কম্প্যানিয়ন খুঁজে নিই... আপনার শহরের ভেরিফাইড কম্প্যানিয়নদের এক্সপ্লোর করুন।'
                        : language === 'hi'
                        ? 'आइए मिलकर आपके लिए सही साथी खोजें... अपने शहर में सत्यापित साथियों को एक्सप्लोर करें।'
                        : "Let's find your perfect companion together... Explore verified companions across social, dining, events, and travel in your city."}
                    </p>
                    <div className="pt-1 flex items-center gap-3">
                      <button
                        onClick={() => {
                          const compSection = document.getElementById('nearby-companions-section');
                          if (compSection) {
                            compSection.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-pink-500/30 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                      >
                        <span>{language === 'bn' ? 'ম্যাচ এক্সপ্লোর করুন' : language === 'hi' ? 'मैच एक्सप्लोर करें' : 'Explore Matches'}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* MOBILE VIEW (< sm): Clean Stack so the Artwork is 100% visible & faces are NEVER covered */}
                <div className="sm:hidden space-y-3">
                  <div className="w-full rounded-2xl overflow-hidden shadow-md border border-pink-200/60 bg-pink-50">
                    <img
                      src="/assets/client_welcome_banner.png"
                      alt="PairUp Welcome Artwork"
                      className="w-full aspect-[3/1] object-cover object-left"
                    />
                  </div>
                  <div className="bg-white/95 backdrop-blur-md border border-purple-100/80 rounded-2xl p-4 shadow-sm space-y-2.5 text-left">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-[10px] font-bold">
                      <span>✨ Verified Social Companionship</span>
                    </div>
                    <h1 className="text-lg font-black text-[#19125E] tracking-tight">
                      {language === 'bn' ? 'স্বাগতম, ' : language === 'hi' ? 'स्वागत है, ' : 'Welcome Back, '}
                      <span className="text-pink-600">{userFirstName}!</span>
                    </h1>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {language === 'bn' 
                        ? 'চলুন একসাথে আপনার আদর্শ কম্প্যানিয়ন খুঁজে নিই... আপনার শহরের ভেরিফাইড কম্প্যানিয়নদের এক্সপ্লোর করুন।'
                        : language === 'hi'
                        ? 'आइए मिलकर आपके लिए सही साथी खोजें... अपने शहर में सत्यापित साथियों को एक्सप्लोर करें।'
                        : "Let's find your perfect companion together... Explore verified companions across social, dining, events, and travel in your city."}
                    </p>
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          const compSection = document.getElementById('nearby-companions-section');
                          if (compSection) {
                            compSection.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-extrabold shadow-md shadow-pink-500/20 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                      >
                        <span>{language === 'bn' ? 'ম্যাচ এক্সপ্লোর করুন' : language === 'hi' ? 'मैच एक्सप्लोर करें' : 'Explore Matches'}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. KPI & STATUS SUMMARY ROW (4 CARDS: 2x2 MOBILE, 4 COLS DESKTOP) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                
                {/* Card 1: Total Matches */}
                <div className="bg-white/95 border border-purple-100 rounded-2xl p-4 sm:p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="space-y-1">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#6D28D9] flex items-center justify-center mb-2">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-2xl font-extrabold text-[#19125E]">{companions.length || 12}</div>
                    <div className="text-xs font-bold text-slate-700">Total Matches</div>
                    <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <span>↑ +2 this month</span>
                    </div>
                  </div>
                  {/* Purple Sparkline Wave */}
                  <div className="hidden sm:block shrink-0">
                    <svg className="w-20 h-10 text-purple-500 overflow-visible" viewBox="0 0 100 40" fill="none">
                      <path d="M 0 32 Q 25 35 45 20 T 80 12 T 100 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                {/* Card 2: Bookings (Requirement 1: ONLY successful bookings count) */}
                <div 
                  onClick={() => setActiveTab('history')}
                  className="bg-white/95 border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-sm flex items-center justify-between hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="text-2xl font-extrabold text-[#19125E]">{successfulBookings.length}</div>
                    <div className="text-xs font-bold text-slate-700">Successful Bookings</div>
                    <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <span>{successfulBookings.length > 0 ? '✓ Confirmed on record' : 'No confirmed sessions yet'}</span>
                    </div>
                  </div>
                  {/* Green Sparkline Wave */}
                  <div className="hidden sm:block shrink-0">
                    <svg className="w-20 h-10 text-emerald-500 overflow-visible" viewBox="0 0 100 40" fill="none">
                      <path d="M 0 34 Q 20 28 40 30 T 70 16 T 100 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                {/* Card 3: Upcoming (Requirement 2: Shows scheduled upcoming bookings) */}
                <div 
                  onClick={() => setActiveTab('upcoming')}
                  className="bg-white/95 border border-purple-100 rounded-2xl p-4 sm:p-5 shadow-sm flex items-center justify-between hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="w-9 h-9 rounded-xl bg-violet-100 text-[#7C3AED] flex items-center justify-center mb-2">
                      <CalendarCheck className="w-5 h-5" />
                    </div>
                    <div className="text-2xl font-extrabold text-[#19125E]">{upcomingBookings.length}</div>
                    <div className="text-xs font-bold text-slate-700">Upcoming {upcomingBookings.length === 1 ? 'Session' : 'Sessions'}</div>
                    <div className="text-[11px] font-bold text-[#7C3AED] truncate max-w-[130px] sm:max-w-[170px]">
                      {upcomingBookings.length > 0 ? `${upcomingBookings[0].serviceName} · ${upcomingBookings[0].date}` : 'No upcoming plans'}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-purple-50 text-[#6D28D9] flex items-center justify-center shrink-0 shadow-sm">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 4: KYC Verified */}
                <div 
                  onClick={() => setActiveTab('kyc-status')}
                  className="bg-white/95 border border-blue-100 rounded-2xl p-4 sm:p-5 shadow-sm flex items-center justify-between hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="text-sm sm:text-base font-extrabold text-[#19125E]">
                      {isKycApproved ? 'KYC Verified' : 'KYC Pending'}
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                      <span>✓</span> {isKycApproved ? 'Your account is verified' : 'Upload ID to verify'}
                    </div>
                  </div>
                </div>

              </div>

              {/* 2.5 UPCOMING SCHEDULED SESSIONS BANNER (Requirement 2) */}
              {upcomingBookings.length > 0 && (
                <div className="bg-gradient-to-r from-[#241461] to-[#701A75] text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-purple-400/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/15 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-white/10 text-pink-300">
                        <CalendarCheck className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-white">Upcoming Confirmed Session</h3>
                        <p className="text-xs text-purple-200">You have {upcomingBookings.length} scheduled session{upcomingBookings.length > 1 ? 's' : ''} ready to go</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('upcoming')}
                      className="text-xs font-bold text-pink-200 hover:text-white underline cursor-pointer self-start sm:self-center"
                    >
                      View All Upcoming ({upcomingBookings.length}) →
                    </button>
                  </div>

                  <div className="space-y-3">
                    {upcomingBookings.slice(0, 2).map(b => (
                      <div key={b.id} className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={b.companionPhoto || '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png'}
                            alt={b.companionName}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-pink-400 shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-white">{b.companionName}</span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-[10px] font-bold border border-emerald-400/40">
                                {b.status}
                              </span>
                            </div>
                            <span className="text-xs text-purple-200 block">{b.serviceName} · Booking #{b.bookingCode || b.id?.slice(0, 8)}</span>
                            <span className="text-[11px] text-pink-200 block mt-0.5">
                              📅 {b.date} • {b.startTime} - {b.endTime} ({b.durationHours || 1} hr)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setTrackedBooking(b);
                              setActiveTab('tracking');
                            }}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-md shadow-pink-500/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Track Arrival</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveChatBooking(b)}
                            className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. UNIFIED "NEARBY COMPANIONS" & DISCOVERY SECTION */}
              <div id="nearby-companions-section" className="space-y-4 pt-2">
                
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#6D28D9]" />
                    <h2 className="text-lg font-extrabold text-[#19125E]">Nearby Companions</h2>
                    <span className="text-xs text-slate-500 font-medium">({displayCompanions.length} available)</span>
                  </div>

                  {/* Smart Filters (All / Online / Top Rated) + View All */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white p-1 rounded-full border border-purple-200 text-xs shadow-sm">
                      <button
                        onClick={() => setSmartFilter('all')}
                        className={`px-3 py-1 rounded-full font-semibold transition-colors ${smartFilter === 'all' ? 'bg-[#6D28D9] text-white shadow-sm' : 'text-slate-600 hover:text-purple-700'}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setSmartFilter('online')}
                        className={`px-3 py-1 rounded-full font-semibold transition-colors flex items-center gap-1.5 ${smartFilter === 'online' ? 'bg-[#6D28D9] text-white shadow-sm' : 'text-slate-600 hover:text-purple-700'}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Online</span>
                      </button>
                      <button
                        onClick={() => setSmartFilter('suggested')}
                        className={`px-3 py-1 rounded-full font-semibold transition-colors ${smartFilter === 'suggested' ? 'bg-[#6D28D9] text-white shadow-sm' : 'text-slate-600 hover:text-purple-700'}`}
                      >
                        ⭐ Top Rated
                      </button>
                    </div>

                    <button
                      onClick={() => setShowAllCompanions(!showAllCompanions)}
                      className="text-xs font-bold text-[#6D28D9] hover:text-[#5B21B6] flex items-center gap-1 px-2 py-1 cursor-pointer"
                    >
                      <span>{showAllCompanions ? 'Show Less' : 'View All'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Companions Cards Grid */}
                {loadingCompanions ? (
                  <div className="p-12 text-center bg-white rounded-3xl border border-purple-100">
                    <div className="w-8 h-8 border-3 border-[#6D28D9] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs text-slate-500 font-semibold">Loading verified companions near you...</p>
                  </div>
                ) : visibleCompanions.length === 0 ? (
                  <div className="p-10 text-center bg-white rounded-3xl border border-purple-100 space-y-3">
                    <Users className="w-10 h-10 text-purple-300 mx-auto" />
                    <p className="text-sm font-bold text-slate-700">No companions match your current filters</p>
                    <p className="text-xs text-slate-400">Try adjusting your budget, city or filter options above.</p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCity('all');
                        setSmartFilter('all');
                        setMaxBudgetHourly(3000);
                      }}
                      className="px-4 py-2 rounded-full bg-[#6D28D9] text-white text-xs font-bold"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[580px] lg:max-h-[calc(100vh-380px)] pr-1.5 scrollbar-thin scrollbar-thumb-purple-300">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5 pb-6">
                      {visibleCompanions.map((comp) => {
                      const hourly = (((comp.rates?.hourlyPaise ?? 49900)) / 100).toFixed(0);
                      const isFav = Boolean(favorites[comp.id]);
                      return (
                        <div
                          key={comp.id}
                          className="bg-white rounded-2xl p-3 shadow-sm hover:shadow-md border border-purple-50 transition-all flex flex-col justify-between group"
                        >
                          <div>
                            {/* Portrait Photo Container */}
                            <div className="relative rounded-xl overflow-hidden aspect-[4/5] bg-slate-100 mb-2.5">
                              <img
                                src={comp.profilePhoto}
                                alt={comp.name}
                                referrerPolicy="no-referrer"
                                onError={(e: any) => {
                                  e.currentTarget.src = '/assets/companions/priya_main.jpg';
                                }}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />

                              {/* Floating Top-Right Status Badge (Online / Offline) */}
                              <div className="absolute top-2 right-2">
                                {Boolean(comp.isOnline || (comp.isLive && !comp.isPaused)) ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur text-emerald-700 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>Online</span>
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur text-slate-500 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    <span>Offline</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Companion Name & Online Dot */}
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="font-extrabold text-sm sm:text-base text-[#19125E] truncate">
                                {comp.name}
                              </h3>
                              <span className={`w-2 h-2 rounded-full shrink-0 ${Boolean(comp.isOnline || (comp.isLive && !comp.isPaused)) ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            </div>

                            {/* Age & City */}
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              {comp.age || 25}, {comp.city || 'Kolkata'}
                            </p>

                            {/* Rate & Rating */}
                            <div className="flex items-center justify-between text-xs text-slate-600 mt-2 pb-2">
                              <span className="font-bold text-[#6D28D9]">₹{hourly}/hr</span>
                              <div className="flex items-center gap-1 font-semibold text-slate-700">
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                <span>{comp.rating || '4.9'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Card Action Buttons (View Profile + Book Now + Favorite) */}
                          <div className="pt-2 border-t border-purple-50 flex items-center gap-1.5">
                            <button
                              onClick={() => openQuickView(comp)}
                              className="flex-1 py-1.5 px-2 rounded-full border border-purple-300 text-[#6D28D9] hover:bg-purple-50 text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="truncate">View Profile</span>
                            </button>

                            <button
                              onClick={() => setSelectedCompanion(comp)}
                              className="py-1.5 px-3 rounded-full bg-gradient-to-r from-[#6D28D9] to-pink-600 hover:from-purple-800 hover:to-pink-700 text-white text-[11px] sm:text-xs font-bold shadow-sm transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
                            >
                              Book Now
                            </button>

                            <button
                              onClick={(e) => toggleFavorite(comp.id, e)}
                              className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                                isFav 
                                  ? 'border-pink-300 bg-pink-50 text-pink-600' 
                                  : 'border-purple-200 text-purple-400 hover:text-pink-500 hover:bg-pink-50'
                              }`}
                              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-pink-600' : ''}`} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
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

        {/* TAB: LIVE COMPANION ARRIVAL TRACKING */}
        {activeTab === 'tracking' && (
          <ClientLiveTrackingView
            booking={
              trackedBooking ||
              upcomingBookings.find(b => ['CONFIRMED', 'CONFIRMED_PAID', 'COMPANION_ARRIVED', 'IN_PROGRESS', 'ONGOING'].includes(b.status)) ||
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

        {/* TAB 10: BOOKING HISTORY with DATE & TIME FILTERS */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-emerald-400" />
                  <span>Booking History & Past Sessions</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Filtered by date and time with full schedule records and transaction status.
                </p>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    historyStatusFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({myBookings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('successful')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    historyStatusFilter === 'successful'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-emerald-400'
                  }`}
                >
                  Successful ({successfulBookings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('cancelled')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    historyStatusFilter === 'cancelled'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-rose-400'
                  }`}
                >
                  Cancelled ({myBookings.filter(b => b.status === 'CANCELLED' || b.status === 'REJECTED').length})
                </button>
              </div>
            </div>

            {/* Timeframe Filter Bar: All Time / Today / Last 7 Days / This Month */}
            <TimeframeFilterBar
              selected={historyTimeframe}
              onChange={setHistoryTimeframe}
              counts={{
                all: myBookings.length,
                today: myBookings.filter(b => matchesTimeframe(b.date || b.createdAt, 'today')).length,
                '7days': myBookings.filter(b => matchesTimeframe(b.date || b.createdAt, '7days')).length,
                monthly: myBookings.filter(b => matchesTimeframe(b.date || b.createdAt, 'monthly')).length,
              }}
              theme="purple"
            />

            {(() => {
              const filteredHistory = myBookings.filter(b => {
                const dateToCheck = b.date || b.createdAt || b.created_at;
                if (!matchesTimeframe(dateToCheck, historyTimeframe)) return false;
                if (historyStatusFilter === 'successful') {
                  return (b.paymentStatus === 'PAID' || b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.status === 'IN_PROGRESS' || b.status === 'COMPANION_ARRIVED') && b.status !== 'CANCELLED' && b.status !== 'REJECTED';
                }
                if (historyStatusFilter === 'cancelled') {
                  return b.status === 'CANCELLED' || b.status === 'REJECTED';
                }
                return true;
              });

              if (filteredHistory.length === 0) {
                return (
                  <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-300">No bookings found for the selected timeframe.</p>
                    <p className="text-[11px] text-slate-500">Try changing your filter to "All Time" to view your full history.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {filteredHistory.map(b => {
                    const isCancelled = b.status === 'CANCELLED' || b.status === 'REJECTED';
                    const isSuccess = b.status === 'COMPLETED' || b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.paymentStatus === 'PAID';
                    const amountColor = isCancelled ? 'text-rose-400' : isSuccess ? 'text-emerald-400' : 'text-amber-400';
                    const statusBadgeClass = isCancelled 
                      ? 'bg-rose-950/60 text-rose-300 border-rose-500/40' 
                      : isSuccess 
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' 
                      : 'bg-amber-950/60 text-amber-300 border-amber-500/40';

                    const { formattedDate, formattedTime } = formatFullDateTime(b.date || b.createdAt, b.startTime);
                    const amt = ((b.totalPayablePaise || b.bookingAmountPaise || b.amountPaise || 0) / 100).toFixed(2);

                    return (
                      <div key={b.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all hover:border-slate-700 shadow-sm">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-100 text-sm">{b.serviceName || 'Session'}</span>
                            <span className="font-mono text-[10px] text-slate-400">#{b.bookingCode || b.id?.slice(0, 8)}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClass}`}>
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
                              Host: <strong className="text-slate-200">{b.companionName || 'Companion'}</strong>
                            </span>
                          </div>

                          {b.meetingLocation && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate max-w-md">
                              <MapPin className="w-3 h-3 text-pink-400 shrink-0" />
                              <span className="truncate">Venue: {b.meetingLocation}</span>
                            </div>
                          )}

                          {b.status === 'COMPLETED' && (
                            <div className="pt-1.5 flex flex-wrap items-center gap-2">
                              {b.clientReview ? (
                                <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-500/30">
                                  <div className="flex items-center text-amber-400">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star key={i} className={`w-3 h-3 ${i < b.clientReview.rating ? 'fill-amber-400' : 'text-slate-600'}`} />
                                    ))}
                                  </div>
                                  <span className="font-bold text-[11px]">You rated {b.clientReview.rating}.0★</span>
                                  {b.clientReview.comment && (
                                    <span className="text-slate-300 italic text-[11px] truncate max-w-xs">"{b.clientReview.comment}"</span>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewingBooking(b);
                                    setReviewRating(5);
                                    setReviewHoverRating(0);
                                    setReviewComment('');
                                    setReviewErrorMsg(null);
                                    setReviewSuccessMsg(null);
                                  }}
                                  className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 font-bold text-[11px] border border-amber-500/40 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                                >
                                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                  <span>Rate & Review Companion</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 flex sm:flex-col items-center sm:items-end justify-between">
                          <span className={`${amountColor} font-black text-base`}>₹{amt}</span>
                          <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                            {isCancelled ? '✕ Cancelled' : b.paymentStatus === 'PAID' ? '✓ Paid' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
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
              Private chat channels are generated automatically once booking payment is confirmed. Phone numbers and personal social handles are never revealed.
            </p>
            {(() => {
              // Secure chat is strictly generated only after final booking payment is confirmed
              const paidChatBookings = myBookings.filter(b =>
                b.paymentStatus === 'PAID' || b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'COMPLETED'
              );

              if (paidChatBookings.length === 0) {
                return (
                  <div className="p-8 text-center text-xs text-slate-400 rounded-xl bg-slate-950 border border-slate-800">
                    No active paid bookings. Complete your booking payment to unlock secure companion chat.
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {paidChatBookings.map(b => {
                    const isCompleted = b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'REJECTED';
                    return (
                      <div key={b.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs transition-all hover:border-slate-700">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">{b.companionName || 'Companion'}</span>
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

        {/* TAB 13: PAYMENTS (Only successful confirmed payments with DATE & TIME FILTERS) */}
        {activeTab === 'payments' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  Payments & Digital Receipts
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Verified receipts for sessions with timestamp tracking and transaction IDs.
                </p>
              </div>

              {/* Timeframe Filter Bar */}
              <TimeframeFilterBar
                selected={paymentsTimeframe}
                onChange={setPaymentsTimeframe}
                counts={{
                  all: successfulBookings.filter(b => Boolean(b.paymentId)).length,
                  today: successfulBookings.filter(b => Boolean(b.paymentId) && matchesTimeframe(b.createdAt || b.date, 'today')).length,
                  '7days': successfulBookings.filter(b => Boolean(b.paymentId) && matchesTimeframe(b.createdAt || b.date, '7days')).length,
                  monthly: successfulBookings.filter(b => Boolean(b.paymentId) && matchesTimeframe(b.createdAt || b.date, 'monthly')).length,
                }}
                theme="emerald"
              />
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300">
              <strong>Free Client Access Guarantee:</strong> Client registration, companion discovery, and membership are 100% free of charge. You only authorize payments for sessions you book.
            </div>

            {(() => {
              const successfulPayments = successfulBookings.filter(b => Boolean(b.paymentId));
              const filteredPayments = successfulPayments.filter(b => {
                const dateToCheck = b.createdAt || b.created_at || b.date;
                return matchesTimeframe(dateToCheck, paymentsTimeframe);
              });

              const totalPaidPaise = filteredPayments.reduce((acc, b) => acc + (b.totalPayablePaise || b.bookingAmountPaise || b.amountPaise || 0), 0);

              return (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-teal-950/30 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                        Total Spent ({paymentsTimeframe === 'all' ? 'All Time' : paymentsTimeframe === 'today' ? 'Today' : paymentsTimeframe === '7days' ? 'Last 7 Days' : 'This Month'})
                      </span>
                      <span className="text-2xl font-black text-emerald-300">
                        ₹{(totalPaidPaise / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-slate-400 sm:text-right">
                      <span className="font-bold text-slate-200 block text-sm">{filteredPayments.length} Receipt{filteredPayments.length !== 1 ? 's' : ''}</span>
                      <span className="text-[10px] text-emerald-400">100% Verified Escrow</span>
                    </div>
                  </div>

                  {filteredPayments.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 rounded-xl bg-slate-950 border border-slate-800">
                      No completed payments on record for the selected timeframe.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredPayments.map(b => {
                        const { formattedDate, formattedTime } = formatFullDateTime(b.createdAt || b.date, b.startTime);
                        const amt = ((b.totalPayablePaise || b.bookingAmountPaise || b.amountPaise || 0) / 100).toFixed(2);

                        return (
                          <div key={b.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-slate-700">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-100 text-sm">Session Payment: {b.serviceName || 'Session'}</span>
                                <span className="font-mono text-[10px] text-slate-400">#{b.bookingCode}</span>
                              </div>
                              <span className="text-slate-400 block text-[11px] font-mono">
                                Transaction ID: <strong className="text-slate-300">{b.paymentId}</strong>
                              </span>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-500 text-[10px]">
                                <span className="text-slate-400">📅 Paid: <strong className="text-slate-300">{formattedDate} {formattedTime ? `at ${formattedTime}` : ''}</strong></span>
                                <span>Host: {b.companionName || 'Companion'}</span>
                              </div>
                            </div>
                            <div className="sm:text-right shrink-0">
                              <span className="font-black text-emerald-400 text-base block">₹{amt}</span>
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 sm:justify-end mt-0.5">
                                <span>✓</span> <span>Captured & Verified</span>
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

        </main>

        {/* ─── MOBILE FIXED BOTTOM NAV ─── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-purple-100 z-40 px-3 py-2 flex items-center justify-around shadow-lg">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'text-[#6D28D9]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('services')}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === 'services' ? 'text-[#6D28D9]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>Services</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === 'history' ? 'text-[#6D28D9]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarCheck className="w-5 h-5" />
            <span>Bookings</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`relative flex flex-col items-center gap-1 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === 'chat' ? 'text-[#6D28D9]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Chat</span>
            <span className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-pink-500" />
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

              const isDateUnavailable = companionSchedule?.isAvailableOnDate === false;
              const isOutsideWorkingHours = (() => {
                if (!companionSchedule?.availabilitySchedule?.startTime || !companionSchedule?.availabilitySchedule?.endTime || !bookingTime) return false;
                const startMin = Number(bookingTime.slice(0, 2)) * 60 + Number(bookingTime.slice(3, 5));
                const endMin = startMin + bookingDurationHours * 60;
                const availStart = Number(companionSchedule.availabilitySchedule.startTime.slice(0, 2)) * 60 + Number(companionSchedule.availabilitySchedule.startTime.slice(3, 5));
                const availEnd = Number(companionSchedule.availabilitySchedule.endTime.slice(0, 2)) * 60 + Number(companionSchedule.availabilitySchedule.endTime.slice(3, 5));
                return startMin < availStart || endMin > availEnd;
              })();

              return (
                <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-300 font-semibold">
                        Booking Date
                      </label>
                      <span className="text-[10px] text-amber-400 font-medium">
                        {isBookingToday ? 'Today (Auto Selected)' : ''}
                      </span>
                    </div>
                    <input
                      type="date"
                      value={bookingDate}
                      min={todayDateStr}
                      onChange={e => handleBookingDateChange(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  {/* Companion Real-Time Schedule & Availability Enforcement */}
                  {companionSchedule?.isAvailableOnDate === false ? (
                    <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200 space-y-1 shadow-lg shadow-rose-950/50 animate-fade-in">
                      <div className="font-extrabold flex items-center gap-1.5 text-rose-300">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Companion Unavailable on {companionSchedule.dayName || 'Selected Date'}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-300">
                        {companionSchedule.summary || 'This companion is not scheduled to work on this day.'}
                      </p>
                      <p className="text-[10px] text-rose-400 font-medium">
                        Please pick an active scheduled day from the companion's profile to book.
                      </p>
                    </div>
                  ) : companionSchedule ? (
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
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-300 font-semibold">
                          Start Time
                        </label>
                        {isBookingToday && (
                          <span className="text-[10px] text-emerald-400 font-mono font-medium">
                            Min: {formatTimeAmPm(minAllowedTimeToday)}
                          </span>
                        )}
                      </div>
                      <input
                        type="time"
                        value={bookingTime}
                        onChange={e => handleBookingTimeChange(e.target.value)}
                        className={`w-full px-3.5 py-2 bg-slate-950 border rounded-xl text-slate-100 focus:outline-none ${
                          timeConflictError || isPastMinTimeToday 
                            ? 'border-rose-500 text-rose-200' 
                            : 'border-slate-700 focus:border-amber-400'
                        }`}
                        required
                      />
                      {/* Mobile-Friendly Quick Time Presets */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          { label: '10 AM', time: '10:00' },
                          { label: '12 PM', time: '12:00' },
                          { label: '2 PM', time: '14:00' },
                          { label: '4 PM', time: '16:00' },
                          { label: '6 PM', time: '18:00' },
                          { label: '8 PM', time: '20:00' },
                        ].map(slot => (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => handleBookingTimeChange(slot.time)}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                              bookingTime === slot.time
                                ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                      {isPastMinTimeToday && (
                        <p className="text-[10px] text-rose-400 mt-1 leading-tight">
                          For today, start time must be at least 30 mins in advance (minimum: {formatTimeAmPm(minAllowedTimeToday)}).
                        </p>
                      )}
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

                  {/* Outside Working Hours Alert */}
                  {isOutsideWorkingHours && (
                    <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-xs text-amber-200 space-y-1 animate-fade-in">
                      <div className="font-extrabold flex items-center gap-1.5 text-amber-300">
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Selected Time Outside Companion Working Hours</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-300">
                        This companion is only available between {companionSchedule?.availabilitySchedule?.startTime || '09:00'} and {companionSchedule?.availabilitySchedule?.endTime || '21:00'}.
                      </p>
                      <p className="text-[10px] text-amber-400 font-medium">
                        Please choose a start time that completes within their available working hours.
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
                    disabled={bookingInProgress || user?.isSuspended || Boolean(timeConflictError) || isDateUnavailable || isOutsideWorkingHours || isPastMinTimeToday}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-sm shadow-xl shadow-pink-500/20 transition-all hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <CalendarCheck className="w-4 h-4" />
                    <span>
                      {user?.isSuspended
                        ? 'Account Suspended - Booking Disabled'
                        : isPastMinTimeToday
                        ? `Time Must Be After ${formatTimeAmPm(minAllowedTimeToday)}`
                        : isDateUnavailable
                        ? `Unavailable on ${companionSchedule?.dayName || 'Selected Date'}`
                        : isOutsideWorkingHours
                        ? 'Time Outside Working Hours'
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

              const isDateUnavailable = companionSchedule?.isAvailableOnDate === false;
              const isOutsideWorkingHours = (() => {
                if (!companionSchedule?.availabilitySchedule?.startTime || !companionSchedule?.availabilitySchedule?.endTime || !bookingTime) return false;
                const startMin = Number(bookingTime.slice(0, 2)) * 60 + Number(bookingTime.slice(3, 5));
                const endMin = startMin + bookingDurationHours * 60;
                const availStart = Number(companionSchedule.availabilitySchedule.startTime.slice(0, 2)) * 60 + Number(companionSchedule.availabilitySchedule.startTime.slice(3, 5));
                const availEnd = Number(companionSchedule.availabilitySchedule.endTime.slice(0, 2)) * 60 + Number(companionSchedule.availabilitySchedule.endTime.slice(3, 5));
                return startMin < availStart || endMin > availEnd;
              })();

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

                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleProceedToCheckout(true)}
                      disabled={bookingInProgress}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <span className="text-base">🧪</span>
                      <span>{bookingInProgress ? 'Processing Sandbox Payment...' : `Pay ₹${totalPayable.toFixed(2)} (Test Mode / Sandbox)`}</span>
                    </button>

                    <p className="text-[11px] text-cyan-300 text-center font-medium">
                      ⚡ Test Mode: Instant simulation without real card or UPI deduction.
                    </p>

                    <button
                      type="button"
                      onClick={() => handleProceedToCheckout(false)}
                      disabled={bookingInProgress}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{bookingInProgress ? 'Connecting...' : 'Standard Gateway Checkout'}</span>
                    </button>
                  </div>
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

      {/* COMPANION REVIEW & RATING MODAL */}
      {reviewingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Rate Your Experience with {reviewingBooking.companionName || 'Companion'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewingBooking(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div>Booking Code: <strong className="text-amber-400">#{reviewingBooking.bookingCode}</strong></div>
              <div>Service: <strong className="text-slate-200">{reviewingBooking.serviceName || 'Session'}</strong></div>
              <p className="text-[11px] text-slate-400 pt-1">
                Your genuine feedback helps companions build their real rating and ensures high quality for all clients.
              </p>
            </div>

            {reviewSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{reviewSuccessMsg}</span>
              </div>
            )}

            {reviewErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{reviewErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-2 text-center">
                  Select Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center justify-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map(star => {
                    const isFilled = star <= (reviewHoverRating || reviewRating);
                    return (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setReviewHoverRating(star)}
                        onMouseLeave={() => setReviewHoverRating(0)}
                        className="p-1 text-2xl transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                      >
                        <Star className={`w-8 h-8 ${isFilled ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                      </button>
                    );
                  })}
                </div>
                <div className="text-center font-bold text-amber-400 text-xs">
                  {reviewRating === 5 ? '⭐⭐⭐⭐⭐ 5.0 - Exceptional Experience!' :
                   reviewRating === 4 ? '⭐⭐⭐⭐ 4.0 - Very Good & Polite' :
                   reviewRating === 3 ? '⭐⭐⭐ 3.0 - Good Session' :
                   reviewRating === 2 ? '⭐⭐ 2.0 - Fair, Room for Improvement' :
                   '⭐ 1.0 - Poor Experience'}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Written Feedback / Compliments (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder="Share details about punctuality, friendliness, communication..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReviewingBooking(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-500 hover:to-rose-500 text-slate-950 font-extrabold text-xs transition disabled:opacity-50 cursor-pointer shadow-md shadow-pink-500/20 active:scale-95"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Official Review'}
                </button>
              </div>
            </form>
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

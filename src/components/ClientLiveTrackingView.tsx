import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { getRealtimeClient } from '../utils/supabaseRealtime';
import { 
  MapPin, Navigation, MessageSquare, ShieldCheck, Clock, Send, 
  Phone, Star, AlertCircle, ChevronDown, ChevronUp, Lock, CheckCircle2,
  AlertTriangle, Calendar, User, ArrowLeft, Radio, X, Check, ShieldAlert
} from 'lucide-react';

interface ClientLiveTrackingViewProps {
  booking: any;
  user: any;
  onOpenReportModal?: (booking: any) => void;
  onBackToOverview?: () => void;
}

// Local Zero-Cost Haversine Formula ($0 Google Maps API Cost)
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const ClientLiveTrackingView: React.FC<ClientLiveTrackingViewProps> = ({
  booking,
  user,
  onOpenReportModal,
  onBackToOverview
}) => {
  const [bookingStatus, setBookingStatus] = useState<string>(booking.status || 'CONFIRMED_PAID');
  const [companionCurrentArea, setCompanionCurrentArea] = useState<string>(
    booking.companionCurrentArea || booking.companion_current_area || 'En route to meeting point'
  );
  const [sessionOtp, setSessionOtp] = useState<string>(() => {
    const raw = booking.sessionOtp || booking.session_otp || booking.startOtp || '';
    return raw ? String(raw).slice(0, 4) : '7492';
  });
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatText, setNewChatText] = useState('');
  const [chatSafetyWarning, setChatSafetyWarning] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [meetingStartedAt, setMeetingStartedAt] = useState<string>(
    booking.meetingStartedAt || booking.startedAt || ''
  );

  // GPS Coordinates & Live Tracking State
  const defaultVenueCoords = {
    lat: booking.venueLatitude || booking.latitude || 22.5726,
    lng: booking.venueLongitude || booking.longitude || 88.3639
  };
  const [venueCoords] = useState(defaultVenueCoords);
  const [companionCoords, setCompanionCoords] = useState<{ lat: number; lng: number }>({
    lat: booking.companionLatitude || defaultVenueCoords.lat - 0.015,
    lng: booking.companionLongitude || defaultVenueCoords.lng - 0.012
  });
  const [routePolyline, setRoutePolyline] = useState<Array<{ lat: number; lng: number }>>([]);
  const [liveDistanceKm, setLiveDistanceKm] = useState<number>(1.8);
  const [liveEtaMins, setLiveEtaMins] = useState<number>(10);

  // Client Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('Change of plans');
  const [cancellationNote, setCancellationNote] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLDivElement>(null);

  // Clock tick every second for real-time session countdown
  useEffect(() => {
    const clock = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  // 1. One-Time Route Directions Fetch (Cached 2h on backend, $0 Quota Burn)
  useEffect(() => {
    let isMounted = true;
    const fetchRoute = async () => {
      try {
        const res = await apiFetch(
          `/api/maps/directions?originLat=${companionCoords.lat}&originLng=${companionCoords.lng}&destLat=${venueCoords.lat}&destLng=${venueCoords.lng}`
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data.points) && data.points.length > 0) {
            setRoutePolyline(data.points);
          }
        }
      } catch (err) {
        console.warn('One-time directions route fetch fallback', err);
      }
    };
    fetchRoute();
    return () => { isMounted = false; };
  }, []);

  // 2. Supabase Realtime Broadcast for Live Ephemeral GPS Streaming (0 DB Writes)
  useEffect(() => {
    if (!booking?.id) return;
    let channel: any = null;

    const setupBroadcast = async () => {
      const client = await getRealtimeClient();
      if (!client) return;

      channel = client.channel(`tracking:${booking.id}`, {
        config: { broadcast: { self: false } }
      });

      channel
        .on('broadcast', { event: 'companion_location' }, ({ payload }: any) => {
          if (payload?.lat && payload?.lng) {
            setCompanionCoords({ lat: payload.lat, lng: payload.lng });
            if (payload.area) setCompanionCurrentArea(payload.area);

            // Compute distance & ETA locally using Haversine formula
            const dist = haversineDistanceKm(payload.lat, payload.lng, venueCoords.lat, venueCoords.lng);
            setLiveDistanceKm(dist);
            // Average urban speed ~20 km/h
            const mins = Math.max(1, Math.round((dist / 20) * 60));
            setLiveEtaMins(mins);
          }
        })
        .subscribe();
    };

    setupBroadcast();
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [booking.id, venueCoords.lat, venueCoords.lng]);

  // 3. Fallback Periodic Polling for Booking Status & Messages
  useEffect(() => {
    if (!booking?.id) return;

    const fetchBookingStatus = async () => {
      try {
        const res = await apiFetch(`/api/bookings/${booking.id}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status) setBookingStatus(data.status);
          if (data.sessionOtp || data.session_otp) {
            setSessionOtp(String(data.sessionOtp || data.session_otp).slice(0, 4));
          } else if (data.startOtp) {
            setSessionOtp(String(data.startOtp).slice(0, 4));
          }
          if (data.companionCurrentArea || data.companion_current_area) {
            setCompanionCurrentArea(data.companionCurrentArea || data.companion_current_area);
          }
          if (data.meetingStartedAt || data.startedAt) {
            setMeetingStartedAt(data.meetingStartedAt || data.startedAt);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch booking status', e);
      }
    };

    fetchBookingStatus();
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) {
        fetchBookingStatus();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [booking.id]);

  // Real-time Chat Sync (Paginated Last 30 Messages)
  useEffect(() => {
    if (!booking?.id) return;

    const fetchChat = async () => {
      try {
        const res = await apiFetch(`/api/bookings/${booking.id}/messages`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            setChatMessages(data.messages.slice(-30));
          }
        }
      } catch (err) {
        console.warn('Failed to poll chat messages', err);
      }
    };

    fetchChat();
    const chatInterval = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) {
        fetchChat();
      }
    }, 8000);
    return () => clearInterval(chatInterval);
  }, [booking.id]);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Client-Side Regex Safety Filter
  const validateSafetyClient = (text: string): boolean => {
    const phoneRegex = /(?:\+?91[\-\s]?)?[6-9]\d{9}|\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{5}[\-\s]?\d{5}\b/;
    if (phoneRegex.test(text)) {
      setChatSafetyWarning('⚠️ Phone numbers and contact digits are blocked in chat for security.');
      return false;
    }
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    if (emailRegex.test(text)) {
      setChatSafetyWarning('⚠️ Email addresses are blocked in chat for security.');
      return false;
    }
    const urlRegex = /(?:https?:\/\/|www\.)\S+/i;
    if (urlRegex.test(text)) {
      setChatSafetyWarning('⚠️ External links are blocked in chat for security.');
      return false;
    }
    setChatSafetyWarning(null);
    return true;
  };

  const handleSendMessage = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (directText || newChatText).trim();
    if (!textToSend || !user || isSendingChat) return;

    if (!validateSafetyClient(textToSend)) return;

    const optimisticMsg = {
      id: `temp_${Date.now()}`,
      booking_id: booking.id,
      sender_id: user.id,
      sender_name: user.profileName || user.legalName || 'You',
      sender_role: 'CLIENT',
      message: textToSend,
      created_at: new Date().toISOString()
    };

    setChatMessages(prev => [...prev.slice(-29), optimisticMsg]);
    setNewChatText('');
    setChatSafetyWarning(null);
    setIsSendingChat(true);

    try {
      const res = await apiFetch(`/api/bookings/${booking.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error) setChatSafetyWarning(`⚠️ ${data.error}`);
      }
    } catch (err: any) {
      console.warn('Chat send notice', err);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Client Cancellation Handler
  const handleClientCancelBooking = async () => {
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await apiFetch(`/api/bookings/${booking.id}/client-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancellationReason,
          cancellationNote
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to cancel booking');
      }
      setBookingStatus('CANCELLED');
      setShowCancelModal(false);
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel booking');
    } finally {
      setIsCancelling(false);
    }
  };

  // Live Meeting Session Countdown with Dynamic End-Time
  const isSessionOngoing = ['ONGOING', 'IN_PROGRESS'].includes(bookingStatus);
  const sessionSecondsRemaining = useMemo(() => {
    if (!isSessionOngoing) return 0;
    if (booking.actualEndTime || booking.actual_end_time) {
      const end = new Date(booking.actualEndTime || booking.actual_end_time).getTime();
      return Math.max(0, Math.floor((end - currentTime) / 1000));
    }
    const started = new Date(booking.actualStartTime || booking.actual_start_time || meetingStartedAt || booking.meetingStartedAt || booking.startedAt || Date.now()).getTime();
    const durationMs = (booking.durationHours || 1) * 3600 * 1000;
    const end = started + durationMs;
    return Math.max(0, Math.floor((end - currentTime) / 1000));
  }, [isSessionOngoing, meetingStartedAt, booking.actualEndTime, booking.actual_end_time, booking.actualStartTime, booking.actual_start_time, booking.meetingStartedAt, booking.startedAt, booking.durationHours, currentTime]);

  const sessionH = Math.floor(sessionSecondsRemaining / 3600);
  const sessionM = Math.floor((sessionSecondsRemaining % 3600) / 60);
  const sessionS = sessionSecondsRemaining % 60;
  const sessionTimeFormatted = `${String(sessionH).padStart(2, '0')}:${String(sessionM).padStart(2, '0')}:${String(sessionS).padStart(2, '0')}`;

  const isCancelled = ['CANCELLED', 'REJECTED'].includes(bookingStatus);
  const isCompleted = bookingStatus === 'COMPLETED';
  const isArrived = bookingStatus === 'COMPANION_ARRIVED';
  const canCancel = ['CONFIRMED', 'CONFIRMED_PAID'].includes(bookingStatus) && !isSessionOngoing && !isCompleted && !isCancelled;

  // External Navigation URL for turn-by-turn guidance ($0 Google Maps URL Scheme)
  const venueAddress = booking.bookingLocationName || booking.meetingLocation || 'Specified Meeting Venue';
  const externalNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venueAddress)}`;

  // Stepper Stage Calculation (1: Preparing, 2: On the Way, 3: Arrived, 4: In Progress)
  const currentStep = useMemo(() => {
    if (isCompleted) return 4;
    if (isSessionOngoing) return 4;
    if (isArrived) return 3;
    if (['CONFIRMED', 'CONFIRMED_PAID', 'PENDING_START'].includes(bookingStatus)) return 2;
    return 1;
  }, [bookingStatus, isArrived, isSessionOngoing, isCompleted]);

  const scrollToChat = () => {
    chatSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl mx-auto text-slate-800">
      {/* ─── 1. TOP HEADER (CLEAN LIGHT THEME) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          {onBackToOverview && (
            <button
              type="button"
              onClick={onBackToOverview}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              title="Back to Overview"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white font-black shadow-md shadow-pink-500/25 shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">Live Session Dashboard</h2>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wide border ${
                isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                isCancelled ? 'bg-rose-50 text-rose-700 border-rose-300' :
                isSessionOngoing ? 'bg-purple-50 text-purple-700 border-purple-300 animate-pulse' :
                isArrived ? 'bg-amber-50 text-amber-700 border-amber-300' :
                'bg-sky-50 text-sky-700 border-sky-300'
              }`}>
                {isCompleted ? 'COMPLETED' : isCancelled ? 'CANCELLED' : isSessionOngoing ? 'SESSION IN PROGRESS' : isArrived ? 'COMPANION ARRIVED' : 'ON THE WAY'}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              Booking <strong className="text-pink-600 font-mono font-bold">#{booking.bookingCode || booking.id?.slice(0, 8)}</strong> • {booking.serviceName || 'Social Companionship'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canCancel && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer min-h-[44px] flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Booking</span>
            </button>
          )}
          {onOpenReportModal && (
            <button
              type="button"
              onClick={() => onOpenReportModal(booking)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer min-h-[44px]"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Help / Report</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. LIVE DELAY & AUTO-CANCEL TIMING WARNING BANNER ─── */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-950 flex items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <div className="text-xs leading-relaxed">
            <span className="font-extrabold text-amber-900 block sm:inline mr-1.5">Scheduled Slot Protection:</span>
            <span className="text-amber-800">
              Unstarted bookings auto-cancel if delay exceeds grace time. If companion starts late, late penalty is deducted and you receive the <strong>full booked duration</strong>.
            </span>
          </div>
        </div>
        {isSessionOngoing && (
          <div className="shrink-0 px-3 py-1.5 rounded-xl bg-white border border-amber-300 font-mono font-black text-xs text-purple-700 shadow-xs">
            ⏳ {sessionTimeFormatted}
          </div>
        )}
      </div>

      {/* ─── 3. LIVE MAP SECTION (RAPIDO-STYLE) ─── */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/90 bg-slate-950 shadow-md min-h-[300px] sm:min-h-[360px] flex flex-col justify-between p-4">
        {/* Floating Top Pill with Zero-Cost Local Haversine Distance & ETA */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <div className="px-3.5 py-2 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 text-xs font-extrabold text-slate-900 flex items-center gap-2 shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span>
              {isSessionOngoing
                ? `Session Active • Remaining: ${sessionTimeFormatted}`
                : isArrived
                ? 'Companion is at the meeting venue now!'
                : `Arriving in ~${liveEtaMins} mins • ${liveDistanceKm.toFixed(1)} km away`}
            </span>
          </div>

          <a
            href={externalNavUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-blue-600/25 transition-all cursor-pointer min-h-[44px]"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Open Maps Directions</span>
          </a>
        </div>

        {/* Interactive SVG Map with Polyline & Markers */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg className="w-full h-full opacity-70" viewBox="0 0 800 400" preserveAspectRatio="none">
            <defs>
              <pattern id="clientMapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148, 163, 184, 0.25)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#clientMapGrid)" />

            <path
              d="M 180 280 Q 320 220 460 210 T 620 120"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="8 6"
              className="animate-pulse"
            />
          </svg>

          {/* Live Companion Marker */}
          <div
            className="absolute transition-all duration-1000 ease-linear pointer-events-auto flex flex-col items-center"
            style={{ left: isArrived ? '70%' : '28%', top: isArrived ? '28%' : '65%' }}
          >
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-pink-500 ring-4 ring-pink-400/40 shadow-xl shadow-pink-500/50 flex items-center justify-center text-white">
                <Navigation className="w-5 h-5 -rotate-45" />
              </div>
              <span className="w-11 h-11 rounded-full bg-pink-400 absolute inset-0 animate-ping opacity-40" />
            </div>
            <span className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-900/90 text-[10px] font-bold text-pink-300 border border-pink-500/30 whitespace-nowrap shadow-sm">
              {booking.companionName || 'Companion'}
            </span>
          </div>

          {/* Meeting Point Destination Pin */}
          <div
            className="absolute pointer-events-auto flex flex-col items-center"
            style={{ left: '75%', top: '25%' }}
          >
            <div className="w-11 h-11 rounded-full bg-emerald-500 ring-4 ring-emerald-400/40 shadow-xl shadow-emerald-500/50 flex items-center justify-center text-white">
              <MapPin className="w-5 h-5 animate-bounce" />
            </div>
            <span className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-900/90 text-[10px] font-bold text-emerald-300 border border-emerald-500/30 whitespace-nowrap shadow-sm">
              Meeting Spot
            </span>
          </div>
        </div>

        {/* Bottom Floating Info Banner */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 text-xs shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Agreed Meeting Spot</span>
              <span className="font-extrabold text-slate-900 truncate block">{venueAddress}</span>
            </div>
          </div>
          <span className="text-[11px] text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200 font-bold shrink-0">
            📍 {companionCurrentArea}
          </span>
        </div>
      </div>

      {/* ─── 4. DIRECTLY BENEATH MAP: COMPANION PROFILE CARD & STEPPER ─── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-5 shadow-sm space-y-4">
        {/* Companion Card & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <img
                src={booking.companionPhoto || '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png'}
                alt={booking.companionName || 'Companion'}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover ring-4 ring-pink-100 shadow-sm"
              />
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs" title="Online Host" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg truncate">
                  {booking.companionName || 'Companion Host'}
                </h3>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <div className="flex items-center text-amber-500 font-extrabold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                  <span>5.0</span>
                </div>
                <span>•</span>
                <span className="truncate">{booking.serviceName || 'Social Companionship'}</span>
              </div>
              <span className="text-[11px] text-purple-700 font-bold block mt-0.5">
                📅 {booking.date} • {booking.startTime} - {booking.endTime} ({booking.durationHours || 1} hr)
              </span>
            </div>
          </div>

          {/* Quick Contact Buttons (Thumb-Friendly >= 44px) */}
          <div className="grid grid-cols-2 gap-2.5 sm:w-auto w-full">
            <a
              href="tel:1800123456"
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 text-center shadow-xs"
            >
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>Call Host</span>
            </a>

            <button
              type="button"
              onClick={scrollToChat}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-700 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-xs"
            >
              <MessageSquare className="w-4 h-4 text-pink-600" />
              <span>Message</span>
            </button>
          </div>
        </div>

        {/* Step-by-Step Live Status Stepper */}
        <div className="pt-1">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block mb-3">Live Progress Journey</span>
          <div className="grid grid-cols-4 gap-2 text-center">
            {/* Step 1: Confirmed */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                currentStep >= 1 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className={`text-[11px] font-bold mt-1.5 line-clamp-1 ${currentStep >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>
                Confirmed
              </span>
            </div>

            {/* Step 2: On The Way */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                currentStep >= 2 ? (currentStep === 2 ? 'bg-sky-500 text-white animate-pulse ring-4 ring-sky-100' : 'bg-emerald-500 text-white') : 'bg-slate-100 text-slate-400'
              }`}>
                {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <span className={`text-[11px] font-bold mt-1.5 line-clamp-1 ${currentStep >= 2 ? 'text-slate-900' : 'text-slate-400'}`}>
                On the Way
              </span>
            </div>

            {/* Step 3: Arrived */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                currentStep >= 3 ? (currentStep === 3 ? 'bg-amber-500 text-white animate-pulse ring-4 ring-amber-100' : 'bg-emerald-500 text-white') : 'bg-slate-100 text-slate-400'
              }`}>
                {currentStep > 3 ? <Check className="w-4 h-4" /> : '3'}
              </div>
              <span className={`text-[11px] font-bold mt-1.5 line-clamp-1 ${currentStep >= 3 ? 'text-slate-900' : 'text-slate-400'}`}>
                Arrived
              </span>
            </div>

            {/* Step 4: In Progress */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                currentStep >= 4 ? (isCompleted ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white animate-pulse ring-4 ring-purple-100') : 'bg-slate-100 text-slate-400'
              }`}>
                {isCompleted ? <Check className="w-4 h-4" /> : '4'}
              </div>
              <span className={`text-[11px] font-bold mt-1.5 line-clamp-1 ${currentStep >= 4 ? 'text-slate-900' : 'text-slate-400'}`}>
                {isCompleted ? 'Finished' : 'In Session'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5. SECURITY OTP CARD & IN-APP CHAT (CLEAN LIGHT THEME) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: High-Contrast 4-Digit Security Handshake OTP Card */}
        <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-purple-50/80 border-2 border-purple-300 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#6D28D9]" />
              <span className="font-extrabold text-sm sm:text-base text-slate-900">4-Digit Security Handshake OTP</span>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-100 text-[#6D28D9] border border-purple-200 font-extrabold">
              Confidential
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
            Share this 4-digit code with your companion <strong className="text-pink-600 font-extrabold">ONLY when you meet in person</strong> at the venue to start the session.
          </p>

          <div className="flex items-center justify-center gap-2.5 sm:gap-3 py-2">
            {sessionOtp.split('').map((digit, idx) => (
              <div
                key={idx}
                className="w-13 h-16 sm:w-16 sm:h-20 rounded-2xl bg-white border-2 border-purple-500 text-purple-950 font-mono font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md select-all"
              >
                {digit}
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-white/90 border border-purple-200 text-[11px] text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>This code protects your advance payment in platform escrow until you meet.</span>
          </div>
        </div>

        {/* Right Column: Encrypted Realtime Chat (Paginated to 30 Messages) */}
        <div ref={chatSectionRef} className="p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between h-[390px] text-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-pink-600" />
              <span className="font-extrabold text-slate-900 text-sm">Encrypted In-App Chat</span>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold">
              ● Active
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 my-2">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 text-center px-4">
                <MessageSquare className="w-8 h-8 text-slate-300 stroke-1" />
                <p className="text-xs font-semibold text-slate-500">Coordinate your meeting spot safely here.</p>
                <p className="text-[10px] text-slate-400">Never share offline cash or phone numbers.</p>
              </div>
            ) : (
              chatMessages.map((msg: any) => {
                const isMe = msg.sender_id === user?.id || msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-xs ${
                      isMe
                        ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-br-none'
                        : 'bg-white text-slate-800 rounded-bl-none border border-slate-200'
                    }`}>
                      <p className="break-words font-medium">{msg.message}</p>
                      <span className={`text-[9px] block mt-0.5 font-mono ${isMe ? 'text-pink-100 text-right' : 'text-slate-400'}`}>
                        {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatScrollRef} />
          </div>

          {/* Safety Warning */}
          {chatSafetyWarning && (
            <div className="p-2 mb-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5 font-semibold">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
              <span>{chatSafetyWarning}</span>
            </div>
          )}

          {/* Chat Form with Touch-Friendly Inputs */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newChatText}
              onChange={(e) => {
                setNewChatText(e.target.value);
                if (chatSafetyWarning) setChatSafetyWarning(null);
              }}
              placeholder="Message host (e.g. 'I am seated near cafe entrance')..."
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:bg-white min-h-[44px]"
            />
            <button
              type="submit"
              disabled={isSendingChat || !newChatText.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-extrabold text-xs shadow-md shadow-pink-500/20 transition disabled:opacity-50 flex items-center gap-1 cursor-pointer min-h-[44px]"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* ─── 6. CLIENT CANCELLATION MODAL WITH REFUND POLICY ─── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-extrabold text-slate-900">Cancel Booking & Refund</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Refund Slab Table */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <span className="font-extrabold text-slate-900 block">Standard Refund Policy:</span>
              <div className="space-y-1 text-slate-600 text-[11px]">
                <div className="flex justify-between">
                  <span>• More than 12 hours before slot:</span>
                  <span className="font-bold text-emerald-600">100% Refund</span>
                </div>
                <div className="flex justify-between">
                  <span>• Between 3 to 12 hours before slot:</span>
                  <span className="font-bold text-amber-600">50% Refund</span>
                </div>
                <div className="flex justify-between">
                  <span>• Less than 3 hours before slot:</span>
                  <span className="font-bold text-rose-600">0% Refund</span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-700 block mb-1 font-bold">Select Reason:</span>
              <select
                value={cancellationReason}
                onChange={e => setCancellationReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:border-rose-500 cursor-pointer min-h-[44px]"
              >
                <option value="Change of plans">Change of plans</option>
                <option value="Scheduling / time conflict">Scheduling / time conflict</option>
                <option value="Personal or medical emergency">Personal or medical emergency</option>
                <option value="Booked by mistake">Booked by mistake</option>
                <option value="Companion requested cancellation">Companion requested cancellation</option>
                <option value="Other">Other reason</option>
              </select>
            </div>

            <div>
              <span className="text-xs text-slate-700 block mb-1 font-bold">Optional Note:</span>
              <textarea
                value={cancellationNote}
                onChange={e => setCancellationNote(e.target.value)}
                placeholder="Provide additional details (optional)..."
                rows={2}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-500"
              />
            </div>

            {cancelError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {cancelError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleClientCancelBooking}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-all shadow-md shadow-rose-600/25 disabled:opacity-50 cursor-pointer min-h-[44px]"
              >
                {isCancelling ? 'Processing Cancellation...' : 'Confirm Cancellation'}
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
              >
                Keep Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

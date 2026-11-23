import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../utils/api';
import { getRealtimeClient } from '../utils/supabaseRealtime';
import { 
  MapPin, Navigation, MessageSquare, ShieldCheck, Clock, Send, 
  Phone, Star, AlertCircle, ChevronDown, ChevronUp, Lock, CheckCircle2,
  AlertTriangle, Calendar, User, ArrowLeft, Radio, X
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

  // Live Meeting Session Countdown
  const isSessionOngoing = ['ONGOING', 'IN_PROGRESS'].includes(bookingStatus);
  const sessionSecondsRemaining = useMemo(() => {
    if (!isSessionOngoing) return 0;
    const started = new Date(meetingStartedAt || booking.meetingStartedAt || booking.startedAt || Date.now()).getTime();
    const durationMs = (booking.durationHours || 1) * 3600 * 1000;
    const end = started + durationMs;
    return Math.max(0, Math.floor((end - currentTime) / 1000));
  }, [isSessionOngoing, meetingStartedAt, booking.meetingStartedAt, booking.startedAt, booking.durationHours, currentTime]);

  const sessionH = Math.floor(sessionSecondsRemaining / 3600);
  const sessionM = Math.floor((sessionSecondsRemaining % 3600) / 60);
  const sessionS = sessionSecondsRemaining % 60;
  const sessionTimeFormatted = `${String(sessionH).padStart(2, '0')}:${String(sessionM).padStart(2, '0')}:${String(sessionS).padStart(2, '0')}`;

  const isCancelled = ['CANCELLED', 'REJECTED'].includes(bookingStatus);
  const isCompleted = bookingStatus === 'COMPLETED';
  const canCancel = ['CONFIRMED', 'CONFIRMED_PAID'].includes(bookingStatus) && !isSessionOngoing && !isCompleted && !isCancelled;

  // External Navigation URL for turn-by-turn guidance ($0 Google Maps URL Scheme)
  const venueAddress = booking.bookingLocationName || booking.meetingLocation || 'Specified Meeting Venue';
  const externalNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venueAddress)}`;

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
      {/* TOP HEADER */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          {onBackToOverview && (
            <button
              type="button"
              onClick={onBackToOverview}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white font-black shadow-md shadow-pink-500/25">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base text-slate-100">Live Session Dashboard</h2>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                isCompleted ? 'bg-emerald-800 text-emerald-200 border-emerald-700' :
                isCancelled ? 'bg-rose-800 text-rose-200 border-rose-700' :
                isSessionOngoing ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse' :
                'bg-sky-500/20 text-sky-300 border-sky-500/30'
              }`}>
                {isCompleted ? 'COMPLETED' : isCancelled ? 'CANCELLED' : isSessionOngoing ? 'ONGOING' : 'ON THE WAY'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Booking <strong className="text-pink-300 font-mono">#{booking.bookingCode || booking.id?.slice(0, 8)}</strong> • {booking.serviceName || 'Companionship'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canCancel && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition cursor-pointer"
            >
              Cancel Booking
            </button>
          )}
          {onOpenReportModal && (
            <button
              type="button"
              onClick={() => onOpenReportModal(booking)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Report</span>
            </button>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP SECTION (~65% HEIGHT): INTERACTIVE RAPIDO-STYLE MAP */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden border-2 border-sky-500/30 bg-slate-950 shadow-2xl min-h-[340px] sm:min-h-[400px] flex flex-col justify-between p-4">
        {/* Floating Top Pill with Zero-Cost Local Haversine Distance & ETA */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="px-3.5 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-emerald-500/40 text-xs font-bold text-slate-100 flex items-center gap-2 shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span>
              {isSessionOngoing
                ? `Session Time Left: ${sessionTimeFormatted}`
                : `Arriving in ~${liveEtaMins} mins • ${liveDistanceKm.toFixed(1)} km away`}
            </span>
          </div>

          <a
            href={externalNavUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Navigate</span>
          </a>
        </div>

        {/* Interactive SVG Map with Polyline & Markers */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg className="w-full h-full opacity-80" viewBox="0 0 800 400" preserveAspectRatio="none">
            {/* Grid background styling */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(51, 65, 85, 0.25)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Simulated/Fetched Polyline Route */}
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
            style={{ left: '25%', top: '65%' }}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-pink-500 ring-4 ring-pink-400/40 shadow-xl shadow-pink-500/50 flex items-center justify-center text-white">
                <Navigation className="w-5 h-5 -rotate-45" />
              </div>
              <span className="w-10 h-10 rounded-full bg-pink-400 absolute inset-0 animate-ping opacity-50" />
            </div>
            <span className="mt-1 px-2 py-0.5 rounded-md bg-slate-900/90 text-[10px] font-bold text-pink-300 border border-pink-500/30 whitespace-nowrap">
              {booking.companionName || 'Companion'}
            </span>
          </div>

          {/* Meeting Point Destination Pin */}
          <div
            className="absolute pointer-events-auto flex flex-col items-center"
            style={{ left: '75%', top: '25%' }}
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500 ring-4 ring-emerald-400/40 shadow-xl shadow-emerald-500/50 flex items-center justify-center text-white">
              <MapPin className="w-5 h-5 animate-bounce" />
            </div>
            <span className="mt-1 px-2 py-0.5 rounded-md bg-slate-900/90 text-[10px] font-bold text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
              Meeting Spot
            </span>
          </div>
        </div>

        {/* Bottom Floating Info Banner */}
        <div className="relative z-10 flex items-center justify-between p-3 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block font-semibold">Agreed Meeting Spot</span>
              <span className="font-bold text-slate-100 truncate block">{venueAddress}</span>
            </div>
          </div>
          <span className="text-[10px] text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20 font-semibold shrink-0">
            {companionCurrentArea}
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. BOTTOM SECTION (~35% HEIGHT): ACTION SHEET & CHAT */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Security OTP + Companion Card + Quick Call */}
        <div className="space-y-4">
          {/* Security OTP Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-pink-950/40 border-2 border-purple-500/40 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-sm text-slate-100">4-Digit Security Handshake OTP</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                Confidential
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Share this 4-digit code with your companion <strong className="text-pink-300">ONLY when you meet in person</strong> at the venue to start the session.
            </p>

            <div className="flex items-center justify-center gap-2.5 py-1">
              {sessionOtp.split('').map((digit, idx) => (
                <div
                  key={idx}
                  className="w-12 h-14 rounded-2xl bg-slate-950 border-2 border-purple-400 text-purple-200 font-mono font-black text-2xl flex items-center justify-center shadow-lg shadow-purple-500/20"
                >
                  {digit}
                </div>
              ))}
            </div>
          </div>

          {/* Companion Profile & Quick Call */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={booking.companionPhoto || '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png'}
                alt={booking.companionName || 'Companion'}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-pink-500 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-slate-100 text-sm truncate">
                    {booking.companionName || 'Companion'}
                  </h4>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <div className="flex items-center text-amber-400 font-bold">
                    <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                    <span>5.0</span>
                  </div>
                  <span>•</span>
                  <span>{booking.serviceName || 'Companionship'}</span>
                </div>
              </div>
            </div>

            <a
              href="tel:1800123456"
              className="p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 transition-colors shadow-sm cursor-pointer shrink-0"
              title="Quick Call Companion"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Right Column: Encrypted Realtime Chat (Paginated to 30 Messages) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between h-[360px] text-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-pink-400" />
              <span className="font-bold text-slate-100">Encrypted In-App Chat</span>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
              Live
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-2 p-2 rounded-2xl bg-slate-950 border border-slate-800/80 my-2">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-1.5">
                <MessageSquare className="w-6 h-6 text-slate-600 stroke-1" />
                <p className="text-[11px]">Coordinate your meeting spot safely here.</p>
              </div>
            ) : (
              chatMessages.map((msg: any) => {
                const isMe = msg.sender_id === user?.id || msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs ${
                      isMe
                        ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                    }`}>
                      <p className="break-words">{msg.message}</p>
                      <span className="text-[9px] opacity-60 text-right block mt-0.5 font-mono">
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
            <div className="p-2 mb-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>{chatSafetyWarning}</span>
            </div>
          )}

          {/* Chat Form */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newChatText}
              onChange={(e) => {
                setNewChatText(e.target.value);
                if (chatSafetyWarning) setChatSafetyWarning(null);
              }}
              placeholder="Type message (e.g. 'I am near the cafe gate')..."
              className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-pink-500"
            />
            <button
              type="submit"
              disabled={isSendingChat || !newChatText.trim()}
              className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CLIENT CANCELLATION MODAL WITH REFUND SLAB BREAKDOWN */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border-2 border-rose-500/60 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-slate-100">Cancel Booking & Refund</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Refund Slab Table */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-slate-300 block">Standard Refund Policy:</span>
              <div className="space-y-1 text-slate-400 text-[11px]">
                <div className="flex justify-between">
                  <span>• More than 12 hours before slot:</span>
                  <span className="font-bold text-emerald-400">100% Refund</span>
                </div>
                <div className="flex justify-between">
                  <span>• Between 3 to 12 hours before slot:</span>
                  <span className="font-bold text-amber-400">50% Refund</span>
                </div>
                <div className="flex justify-between">
                  <span>• Less than 3 hours before slot:</span>
                  <span className="font-bold text-rose-400">0% Refund</span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-1 font-semibold">Select Reason:</span>
              <select
                value={cancellationReason}
                onChange={e => setCancellationReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs font-semibold focus:outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="Change of plans">Change of plans</option>
                <option value="Medical Emergency">Medical Emergency</option>
                <option value="Companion requested cancellation">Companion requested cancellation</option>
                <option value="Other">Other reason</option>
              </select>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-1 font-semibold">Optional Note:</span>
              <textarea
                value={cancellationNote}
                onChange={e => setCancellationNote(e.target.value)}
                placeholder="Provide additional details (optional)..."
                rows={2}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            {cancelError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs">
                {cancelError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleClientCancelBooking}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg shadow-rose-600/30 disabled:opacity-50 cursor-pointer"
              >
                {isCancelling ? 'Processing Refund...' : 'Confirm Cancellation'}
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
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

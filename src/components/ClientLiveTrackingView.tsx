import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';
import { 
  MapPin, Navigation, MessageSquare, ShieldCheck, Clock, Send, 
  Phone, Star, AlertCircle, ChevronDown, ChevronUp, Lock, CheckCircle2,
  AlertTriangle, Calendar, User, ArrowLeft, Radio
} from 'lucide-react';

interface ClientLiveTrackingViewProps {
  booking: any;
  user: any;
  onOpenReportModal?: (booking: any) => void;
  onBackToOverview?: () => void;
}

export const ClientLiveTrackingView: React.FC<ClientLiveTrackingViewProps> = ({
  booking,
  user,
  onOpenReportModal,
  onBackToOverview
}) => {
  const [bookingStatus, setBookingStatus] = useState<string>(booking.status || 'CONFIRMED_PAID');
  const [companionCurrentArea, setCompanionCurrentArea] = useState<string>(
    booking.companionCurrentArea || booking.companion_current_area || 'Preparing to leave...'
  );
  const [companionEtaText, setCompanionEtaText] = useState<string>(
    booking.companionEtaText || booking.companion_eta_text || '12-15 mins'
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
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Clock tick every second for real-time countdown
  useEffect(() => {
    const clock = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  // Poll booking status & privacy ETA updates (Clients do NOT receive raw GPS coords)
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
          if (data.companionEtaText || data.companion_eta_text) {
            setCompanionEtaText(data.companionEtaText || data.companion_eta_text);
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
    const interval = setInterval(fetchBookingStatus, 4000);
    return () => clearInterval(interval);
  }, [booking.id]);

  // Real-time Chat Sync via booking_messages
  useEffect(() => {
    if (!booking?.id) return;

    const fetchChat = async () => {
      try {
        const res = await apiFetch(`/api/bookings/${booking.id}/messages`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            setChatMessages(data.messages);
          }
        } else {
          // Fallback to legacy chat endpoint if needed
          const fallbackRes = await apiFetch(`/api/chat/${booking.id}`);
          if (fallbackRes.ok) {
            const fbData = await fallbackRes.json();
            if (Array.isArray(fbData.messages)) setChatMessages(fbData.messages);
          }
        }
      } catch (err) {
        console.warn('Failed to poll chat messages', err);
      }
    };

    fetchChat();
    const chatInterval = setInterval(fetchChat, 2500);
    return () => clearInterval(chatInterval);
  }, [booking.id]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Client-Side Regex Safety Validator
  const validateSafetyClient = (text: string): boolean => {
    const phoneRegex = /(?:\+?91[\-\s]?)?[6-9]\d{9}|\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{5}[\-\s]?\d{5}\b/;
    if (phoneRegex.test(text)) {
      setChatSafetyWarning('⚠️ Contact numbers, phone numbers, and digits are blocked in chat for your security.');
      return false;
    }
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    if (emailRegex.test(text)) {
      setChatSafetyWarning('⚠️ Email addresses are blocked in chat for your security.');
      return false;
    }
    const urlRegex = /(?:https?:\/\/|www\.)\S+/i;
    if (urlRegex.test(text)) {
      setChatSafetyWarning('⚠️ External links and URLs are blocked in chat for your security.');
      return false;
    }
    setChatSafetyWarning(null);
    return true;
  };

  const handleSendMessage = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (directText || newChatText).trim();
    if (!textToSend || !user || isSendingChat) return;

    if (!validateSafetyClient(textToSend)) {
      return;
    }

    const optimisticMsg = {
      id: `temp_${Date.now()}`,
      booking_id: booking.id,
      sender_id: user.id,
      sender_name: user.profileName || user.legalName || 'You',
      sender_role: 'CLIENT',
      message: textToSend,
      created_at: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, optimisticMsg]);
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

  // Live Meeting Session Countdown (when ONGOING or IN_PROGRESS)
  const isSessionOngoing = ['ONGOING', 'IN_PROGRESS'].includes(bookingStatus);
  const sessionSecondsRemaining = React.useMemo(() => {
    if (!isSessionOngoing) return 0;
    const started = new Date(meetingStartedAt || booking.meetingStartedAt || booking.startedAt || booking.updatedAt || Date.now()).getTime();
    const durationMs = (booking.durationHours || 1) * 3600 * 1000;
    const end = started + durationMs;
    return Math.max(0, Math.floor((end - currentTime) / 1000));
  }, [isSessionOngoing, meetingStartedAt, booking.meetingStartedAt, booking.startedAt, booking.durationHours, currentTime]);

  const sessionH = Math.floor(sessionSecondsRemaining / 3600);
  const sessionM = Math.floor((sessionSecondsRemaining % 3600) / 60);
  const sessionS = sessionSecondsRemaining % 60;
  const sessionTimeFormatted = `${String(sessionH).padStart(2, '0')}:${String(sessionM).padStart(2, '0')}:${String(sessionS).padStart(2, '0')}`;

  const isCompleted = ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(bookingStatus);

  // Status Badge Helper
  const renderStatusBadge = () => {
    if (isCompleted) {
      return (
        <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-extrabold text-xs border border-slate-700 flex items-center gap-1.5">
          <span>🔒</span>
          <span>SESSION COMPLETED</span>
        </span>
      );
    }
    if (isSessionOngoing) {
      return (
        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-xs border border-emerald-500/30 flex items-center gap-1.5 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>ONGOING SESSION</span>
        </span>
      );
    }
    if (bookingStatus === 'COMPANION_ARRIVED') {
      return (
        <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-xs border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span>ARRIVED AT VENUE</span>
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 font-extrabold text-xs border border-sky-500/30 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
        <span>ON THE WAY</span>
      </span>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
      {/* 1. TOP HEADER & BACK NAVIGATION */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          {onBackToOverview && (
            <button
              type="button"
              onClick={onBackToOverview}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Back to Overview"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white font-black shadow-lg shadow-pink-500/25">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base text-slate-100">Live Session Dashboard</h2>
              {renderStatusBadge()}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Booking <strong className="text-pink-300 font-mono">#{booking.bookingCode || booking.id?.slice(0, 8)}</strong> · {booking.serviceName || 'Social Companionship'}
            </p>
          </div>
        </div>

        {onOpenReportModal && (
          <button
            type="button"
            onClick={() => onOpenReportModal(booking)}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report Us</span>
          </button>
        )}
      </div>

      {/* 2. ASYMMETRIC PRIVACY LIVE STATUS CARD (NO MAP RENDERED) */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-sky-500/30 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-400 absolute inset-0 animate-ping"></span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Privacy-First Real-Time Status</span>
              <span className="font-black text-sm text-slate-100">
                {isSessionOngoing ? 'Session In Progress' : 'Companion En Route'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-sky-400 font-semibold bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Asymmetric Privacy Protected</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Current Area Text Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-pink-500/15 text-pink-400 shrink-0">
              <MapPin className="w-5 h-5 animate-bounce" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Current Location</span>
              <p className="font-extrabold text-sm sm:text-base text-slate-100 mt-0.5 truncate">
                {companionCurrentArea}
              </p>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Reverse Geocoded Landmark & Area
              </span>
            </div>
          </div>

          {/* ETA / Countdown Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 shrink-0">
              <Clock className="w-5 h-5 text-sky-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                {isSessionOngoing ? 'Meeting Time Remaining' : 'Estimated Arrival (ETA)'}
              </span>
              <p className="font-black text-sm sm:text-base text-emerald-400 mt-0.5">
                {isSessionOngoing ? sessionTimeFormatted : `Arriving in ${companionEtaText}`}
              </p>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {isSessionOngoing ? `${booking.durationHours || 1} Hour Session Ongoing` : 'Real-Time Drive/Walking Transit'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SECURITY OTP BADGE (4-DIGIT VERIFICATION) */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-pink-950/40 border-2 border-purple-500/40 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Lock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                <span>Security Handshake OTP</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Confidential</span>
              </h3>
              <p className="text-xs text-slate-400">
                Share this 4-digit code with your companion <strong className="text-pink-300">ONLY when you meet in person</strong> at the venue.
              </p>
            </div>
          </div>

          {/* 4-Digit Stylized OTP Display */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            {sessionOtp.split('').map((digit, idx) => (
              <div
                key={idx}
                className="w-11 h-13 sm:w-12 sm:h-14 rounded-2xl bg-slate-950 border-2 border-purple-400 text-purple-200 font-mono font-black text-2xl flex items-center justify-center shadow-lg shadow-purple-500/20"
              >
                {digit}
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Once your companion enters this code on their screen, the session starts and live location tracking will stop immediately.
          </span>
        </div>
      </div>

      {/* 4. COMPANION PROFILE & BOOKING SUMMARY CARD */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <img
              src={booking.companionPhoto || '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png'}
              alt={booking.companionName || 'Companion'}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-pink-500 shadow-md shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-slate-100 text-sm sm:text-base">
                  {booking.companionName || 'Companion'}
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Verified Host</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <div className="flex items-center text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 mr-0.5" />
                  <span>5.0</span>
                </div>
                <span>·</span>
                <span>{booking.serviceName || 'Social Companionship'}</span>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Scheduled Time Slot</span>
            <span className="font-extrabold text-xs sm:text-sm text-slate-200">
              {booking.date} · {booking.startTime} - {booking.endTime} ({booking.durationHours || 1} hr)
            </span>
          </div>
        </div>

        {/* Selected Public Meeting Spot Name */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
          <MapPin className="w-5 h-5 text-rose-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Agreed Meeting Spot Venue</span>
            <span className="font-bold text-xs sm:text-sm text-slate-100 truncate block">
              {booking.bookingLocationName || booking.meetingLocation || 'Specified Public Venue'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. REALTIME CHAT BOX (booking_messages with Regex Safety Filter) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-pink-400" />
            <h3 className="font-bold text-sm text-slate-100">
              Encrypted Chat with {booking.companionName || 'Companion'}
            </h3>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
            {isCompleted ? 'Locked (Read-Only)' : 'Active Channel'}
          </span>
        </div>

        {/* Chat Message Stream */}
        <div className="h-64 overflow-y-auto space-y-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
              <MessageSquare className="w-8 h-8 text-slate-600 stroke-1" />
              <p>Say hello! Coordinate your meetup spot safely in this encrypted chat.</p>
            </div>
          ) : (
            chatMessages.map((msg: any) => {
              const isMe = msg.sender_id === user?.id || msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    isMe
                      ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-br-none shadow-md shadow-pink-500/20'
                      : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                  }`}>
                    <div className="text-[9px] font-bold opacity-75 mb-0.5">
                      {isMe ? 'You' : msg.sender_name || msg.senderName || 'Companion'}
                    </div>
                    <p className="text-xs break-words">{msg.message}</p>
                    <div className="text-[9px] opacity-60 text-right mt-1 font-mono">
                      {new Date(msg.created_at || msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatScrollRef} />
        </div>

        {/* Chat Safety Notice */}
        {chatSafetyWarning && (
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{chatSafetyWarning}</span>
          </div>
        )}

        {/* Chat Input Form */}
        {isCompleted ? (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400 font-semibold">
            🔒 Meeting Completed (Session Ended) — Chat is read-only.
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newChatText}
              onChange={(e) => {
                setNewChatText(e.target.value);
                if (chatSafetyWarning) setChatSafetyWarning(null);
              }}
              placeholder="Type a safe message (e.g. 'I am standing near the main gate')..."
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-pink-500"
            />
            <button
              type="submit"
              disabled={isSendingChat || !newChatText.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-pink-500/25 transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

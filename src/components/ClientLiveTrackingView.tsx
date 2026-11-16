import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';
import { MapPin, Navigation, MessageSquare, ShieldCheck, Clock, Send, Phone, Star, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [companionLocation, setCompanionLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number>(12);
  const [distanceKm, setDistanceKm] = useState<number>(1.4);
  const [walkingProgress, setWalkingProgress] = useState<number>(0.15); // 0 to 1 along path
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatText, setNewChatText] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'map' | 'chat'>('map');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<string>(booking.status || 'CONFIRMED');
  const [startOtp, setStartOtp] = useState<string>(booking.startOtp || '******');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Poll companion's live GPS coordinates & booking status
  useEffect(() => {
    if (!booking?.id) return;

    const fetchLiveLocation = async () => {
      try {
        const res = await apiFetch(`/api/location/${booking.companionId}?bookingId=${booking.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.location) {
            setCompanionLocation(data.location);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch companion location', e);
      }
    };

    const fetchBookingStatus = async () => {
      try {
        const res = await apiFetch(`/api/bookings/${booking.id}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status) setBookingStatus(data.status);
          if (data.startOtp) setStartOtp(data.startOtp);
        }
      } catch (e) {
        console.warn('Failed to fetch booking status', e);
      }
    };

    fetchLiveLocation();
    fetchBookingStatus();

    const interval = setInterval(() => {
      fetchLiveLocation();
      fetchBookingStatus();
    }, 4000);

    return () => clearInterval(interval);
  }, [booking.id, booking.companionId]);

  // Animated walking progress simulation along route path (smooth Rapido-style progression)
  useEffect(() => {
    const timer = setInterval(() => {
      setWalkingProgress(prev => {
        if (bookingStatus === 'COMPANION_ARRIVED' || bookingStatus === 'IN_PROGRESS') return 1.0;
        const next = prev + 0.015;
        if (next >= 0.95) return 0.95;
        // Dynamically reduce remaining ETA as progress advances
        const remainingRatio = 1 - next;
        setEtaMinutes(Math.max(1, Math.round(14 * remainingRatio)));
        setDistanceKm(Math.max(0.1, Number((1.6 * remainingRatio).toFixed(1))));
        return next;
      });
    }, 2500);

    return () => clearInterval(timer);
  }, [bookingStatus]);

  // Chat polling & real-time sync
  useEffect(() => {
    if (!booking?.id) return;

    const fetchChat = async () => {
      try {
        const res = await apiFetch(`/api/chat/${booking.id}`);
        if (res.ok) {
          const data = await res.json();
          setChatMessages(data.messages || []);
        }
      } catch (err) {
        console.warn('Failed to poll chat', err);
      }
    };

    fetchChat();
    const chatInterval = setInterval(fetchChat, 3000);
    return () => clearInterval(chatInterval);
  }, [booking.id]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeSubTab]);

  // Handle sending chat message
  const handleSendMessage = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    const textToSend = directText || newChatText;
    if (!textToSend.trim() || !user || isSendingChat) return;

    const optimisticMsg = {
      id: `temp_${Date.now()}`,
      bookingId: booking.id,
      senderId: user.id,
      senderName: user.profileName || user.legalName || 'You',
      senderRole: 'CLIENT',
      message: textToSend.trim(),
      timestamp: new Date().toISOString()
    };

    // Optimistically update UI immediately
    setChatMessages(prev => [...prev, optimisticMsg]);
    setNewChatText('');
    setIsSendingChat(true);

    try {
      const res = await apiFetch(`/api/chat/${booking.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          message: textToSend.trim()
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setChatMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data.message : m));
        }
      }
    } catch (err) {
      console.warn('Chat send notice', err);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Open native Google Maps directions
  const handleOpenGoogleMaps = () => {
    const venue = booking.meetingLocation || 'Central Kolkata';
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venue)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Calculate coordinates on the curved SVG path
  // Path start: (80, 260), Curve point: (220, 140), End: (360, 60)
  const pathT = Math.min(1, Math.max(0, walkingProgress));
  // Quadratic Bezier interpolation: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
  const p0 = { x: 60, y: 240 };
  const p1 = { x: 220, y: 150 };
  const p2 = { x: 380, y: 70 };
  const walkerX = (1 - pathT) * (1 - pathT) * p0.x + 2 * (1 - pathT) * pathT * p1.x + pathT * pathT * p2.x;
  const walkerY = (1 - pathT) * (1 - pathT) * p0.y + 2 * (1 - pathT) * pathT * p1.y + pathT * pathT * p2.y;

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
            <Navigation className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-100">Live Companion Tracking</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                {bookingStatus === 'COMPANION_ARRIVED' ? '📍 ARRIVED AT VENUE' : bookingStatus === 'IN_PROGRESS' ? '⏱️ MEETING ACTIVE' : '🚶 WALKING TO VENUE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Booking #{booking.bookingCode || booking.id?.slice(0, 8)} • {booking.serviceName || 'Social Companion'}
            </p>
          </div>
        </div>

        {/* Toggle between Map and Chat on mobile */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('map')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'map'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Live Map</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('chat')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer relative ${
              activeSubTab === 'chat'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat ({chatMessages.length})</span>
          </button>

          {onBackToOverview && (
            <button
              type="button"
              onClick={onBackToOverview}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Back
            </button>
          )}
        </div>
      </div>

      {/* Main Container: Map & Chat side-by-side or tabbed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: Live Animated Route Map (Rapido / Uber style) */}
        <div className={`lg:col-span-7 space-y-4 ${activeSubTab === 'map' ? 'block' : 'hidden lg:block'}`}>
          <div className="relative rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl p-4">
            {/* Map Header Floating Overlay */}
            <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-between pointer-events-none">
              <div className="pointer-events-auto px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-slate-700 backdrop-blur-md shadow-lg flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Estimated Arrival</span>
                  <span className="text-sm font-extrabold text-emerald-400 leading-tight">
                    {bookingStatus === 'COMPANION_ARRIVED' ? 'Arrived at your spot!' : `~${etaMinutes} mins (${distanceKm} km away)`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenGoogleMaps}
                className="pointer-events-auto px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-amber-300 shadow-lg flex items-center gap-1.5 backdrop-blur-md transition cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>Google Maps</span>
              </button>
            </div>

            {/* Interactive SVG Road Map with Animated Walking Character */}
            <div className="w-full h-72 sm:h-96 rounded-2xl bg-[#0b1324] relative overflow-hidden border border-slate-800/80">
              {/* Background Street Grid & City Details */}
              <svg className="w-full h-full" viewBox="0 0 440 300" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="routeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="50%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Grid roads */}
                <path d="M 0 50 L 440 50 M 0 110 L 440 110 M 0 170 L 440 170 M 0 230 L 440 230" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
                <path d="M 70 0 L 70 300 M 150 0 L 150 300 M 230 0 L 230 300 M 310 0 L 310 300 M 390 0 L 390 300" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />

                {/* Major streets */}
                <path d="M 20 280 L 420 280" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
                <path d="M 120 20 L 120 280" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
                <path d="M 320 20 L 320 280" stroke="#334155" strokeWidth="8" strokeLinecap="round" />

                {/* Active Walking Route Path (Curved road connecting companion to destination) */}
                <path
                  d="M 60 240 Q 220 150 380 70"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M 60 240 Q 220 150 380 70"
                  fill="none"
                  stroke="url(#routeGradient)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  filter="url(#neonGlow)"
                  strokeDasharray="6 3"
                />

                {/* Client Destination Marker Pin (📍 Meeting Venue) */}
                <g transform="translate(380, 70)">
                  <circle r="18" fill="#10b981" fillOpacity="0.2" className="animate-ping" />
                  <circle r="10" fill="#10b981" />
                  <circle r="4" fill="#ffffff" />
                  {/* Pin Flag */}
                  <rect x="-35" y="-36" width="70" height="20" rx="6" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
                  <text x="0" y="-23" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">📍 Your Spot</text>
                </g>

                {/* Animated Walking Companion Avatar (Walking figure progressing along route) */}
                <g transform={`translate(${walkerX}, ${walkerY})`}>
                  {/* GPS Accuracy Radar Wave */}
                  <circle r="22" fill="#ec4899" fillOpacity="0.25" className="animate-pulse" />
                  <circle r="14" fill="#0f172a" stroke="#ec4899" strokeWidth="2" />

                  {/* Walking Human Character Emoji / Icon */}
                  <text x="0" y="5" textAnchor="middle" fontSize="16" className="select-none animate-bounce">
                    🚶
                  </text>

                  {/* Companion ETA Tag above head */}
                  <g transform="translate(0, -22)">
                    <rect x="-42" y="-12" width="84" height="17" rx="5" fill="#ec4899" />
                    <text x="0" y="0" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">
                      {booking.companionName?.split(' ')[0] || 'Companion'} (~{etaMinutes}m)
                    </text>
                  </g>
                </g>
              </svg>

              {/* Bottom Street Landmark Indicator */}
              <div className="absolute bottom-3 left-4 right-4 z-10 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md flex items-center justify-between text-xs text-slate-300">
                <span className="truncate max-w-[240px] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>Venue: <strong>{booking.meetingLocation || 'Central Public Cafe'}</strong></span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold shrink-0">GPS Connected</span>
              </div>
            </div>

            {/* Start OTP Safety Card */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-amber-500/10 border border-pink-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-pink-300 uppercase tracking-wider block">
                  Confidential Session Start OTP
                </span>
                <p className="text-xs text-slate-300 mt-0.5">
                  Share this 6-digit PIN with your companion only when they arrive at your location:
                </p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-slate-900 border-2 border-pink-500 text-pink-400 font-mono font-extrabold text-lg tracking-widest text-center shadow-lg">
                {startOtp}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Companion Details & Live Chat Drawer */}
        <div className={`lg:col-span-5 space-y-4 ${activeSubTab === 'chat' ? 'block' : 'hidden lg:block'}`}>
          {/* Companion Profile Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={booking.companionPhoto || '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png'}
                alt={booking.companionName || 'Companion'}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-pink-500/40 shadow-md shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-slate-100 truncate">{booking.companionName}</h4>
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" title="Identity Verified" />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="flex items-center text-amber-400 gap-0.5 font-bold">
                    <Star className="w-3 h-3 fill-amber-400" /> 4.9
                  </span>
                  <span>•</span>
                  <span>{booking.serviceName || 'Social Companion'}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                  <Clock className="w-3 h-3 text-pink-400" />
                  <span>{booking.date} ({booking.startTime || '14:00'} - {booking.endTime || '16:00'})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Connected Live Chat Session Box */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col h-[400px]">
            {/* Chat Box Header */}
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-pink-400" />
                <span className="font-bold text-xs text-slate-200">Chat with {booking.companionName?.split(' ')[0]}</span>
              </div>
              {onOpenReportModal && (
                <button
                  type="button"
                  onClick={() => onOpenReportModal(booking)}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold"
                >
                  Report Us
                </button>
              )}
            </div>

            {/* Quick Greeting Action Chips */}
            <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-300">
              <button
                type="button"
                onClick={() => handleSendMessage(undefined, "I'm waiting near the entrance.")}
                className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 transition"
              >
                Waiting at entrance 🚪
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage(undefined, "Where are you right now?")}
                className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 transition"
              >
                Where are you? 📍
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage(undefined, "I am wearing a black jacket.")}
                className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 transition"
              >
                Black jacket 🧥
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="p-3 flex-1 overflow-y-auto space-y-2.5 text-xs">
              {chatMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <MessageSquare className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                  <p>No messages yet.</p>
                  <p className="text-[10px] text-slate-600 mt-1">Send a greeting to coordinate your meeting!</p>
                </div>
              ) : (
                chatMessages.map(m => {
                  const isMe = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                          isMe
                            ? 'bg-pink-600 text-white rounded-br-none shadow-md shadow-pink-600/20'
                            : 'bg-slate-800 text-slate-200 rounded-bl-none'
                        }`}
                      >
                        {m.message}
                      </div>
                      <span className="text-[9px] text-slate-500 mt-0.5 px-1">
                        {new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatScrollRef} />
            </div>

            {/* Chat Input Form */}
            <form onSubmit={e => handleSendMessage(e)} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={newChatText}
                onChange={e => setNewChatText(e.target.value)}
                placeholder="Type a message to your companion..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
              />
              <button
                type="submit"
                disabled={isSendingChat || !newChatText.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

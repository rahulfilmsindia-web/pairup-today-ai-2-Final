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
  const [endOtp, setEndOtp] = useState<string>(booking.endOtp || '');
  const [meetingStartedAt, setMeetingStartedAt] = useState<string>(booking.meetingStartedAt || booking.startedAt || '');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [mapMode, setMapMode] = useState<'street' | 'radar'>('street');
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const companionMarkerRef = useRef<any>(null);
  const venueMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // Clock tick every second for real-time countdown
  useEffect(() => {
    const clock = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  // Determine companion gender for walking avatar
  const companionGender = (booking?.companionGender || booking?.companion?.gender || booking?.gender || '').toUpperCase();
  const isMale = companionGender === 'MALE' || (
    !companionGender && booking?.companionName &&
    /\b(Rahul|Amit|Rohit|Rohan|Vikram|Aditya|Suresh|Rajesh|Kunal|Abhishek|Rakesh|Deepak|Arjun|Dev|Subhash|Sanjay|Ajay|Anirban|Sourav|Arun|Vijay)\b/i.test(booking.companionName)
  );
  const isFemale = !isMale;

  // Live Meeting Session Countdown (when IN_PROGRESS)
  const sessionSecondsRemaining = React.useMemo(() => {
    if (bookingStatus !== 'IN_PROGRESS') return 0;
    const started = new Date(meetingStartedAt || booking.meetingStartedAt || booking.startedAt || booking.updatedAt || Date.now()).getTime();
    const durationMs = (booking.durationHours || 1) * 3600 * 1000;
    const end = started + durationMs;
    return Math.max(0, Math.floor((end - currentTime) / 1000));
  }, [bookingStatus, meetingStartedAt, booking.meetingStartedAt, booking.startedAt, booking.durationHours, currentTime]);

  const sessionH = Math.floor(sessionSecondsRemaining / 3600);
  const sessionM = Math.floor((sessionSecondsRemaining % 3600) / 60);
  const sessionS = sessionSecondsRemaining % 60;
  const sessionTimeFormatted = `${String(sessionH).padStart(2, '0')}:${String(sessionM).padStart(2, '0')}:${String(sessionS).padStart(2, '0')}`;
  const isSessionFinished = bookingStatus === 'IN_PROGRESS' && sessionSecondsRemaining === 0;

  // 30-Minute Privacy Lock Calculation:
  // Companion's live GPS location only activates 30 mins before the scheduled start time
  const scheduledStartMs = React.useMemo(() => {
    if (!booking?.date || !booking?.startTime) return Date.now();
    const parsed = new Date(`${booking.date}T${booking.startTime}:00`).getTime();
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }, [booking?.date, booking?.startTime]);

  const thirtyMinsBeforeMs = scheduledStartMs - (30 * 60 * 1000);
  const isLocationUnlocked = currentTime >= thirtyMinsBeforeMs || ['COMPANION_ARRIVED', 'IN_PROGRESS'].includes(bookingStatus);
  const timeUntilUnlockMs = Math.max(0, thirtyMinsBeforeMs - currentTime);

  const formatRemainingUnlock = () => {
    const totalSecs = Math.floor(timeUntilUnlockMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remH = hours % 24;
      return `${days}d ${remH}h ${mins}m`;
    }
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Poll companion's live GPS coordinates & booking status
  useEffect(() => {
    if (!booking?.id) return;

    const fetchLiveLocation = async () => {
      // Respect companion privacy until 30 minutes before booking start
      if (!isLocationUnlocked) return;
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
          if (data.endOtp) setEndOtp(data.endOtp);
          if (data.meetingStartedAt) setMeetingStartedAt(data.meetingStartedAt);
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
    const origin = `${liveCompanionCoords.lat},${liveCompanionCoords.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(venue)}&travelmode=walking`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const venueCoords = React.useMemo(() => {
    const loc = (booking.meetingLocation || '').toLowerCase();
    if (loc.includes('kolkata') || loc.includes('calcutta') || loc.includes('park street') || loc.includes('salt lake') || loc.includes('new town') || loc.includes('esplanade')) {
      return { lat: 22.5535, lng: 88.3518 };
    }
    if (loc.includes('delhi') || loc.includes('connaught') || loc.includes('noida') || loc.includes('gurgaon') || loc.includes('gurugram')) {
      return { lat: 28.6315, lng: 77.2167 };
    }
    if (loc.includes('mumbai') || loc.includes('bombay') || loc.includes('bandra') || loc.includes('andheri')) {
      return { lat: 19.0596, lng: 72.8295 };
    }
    if (loc.includes('bangalore') || loc.includes('bengaluru') || loc.includes('koramangala') || loc.includes('indiranagar')) {
      return { lat: 12.9352, lng: 77.6245 };
    }
    if (loc.includes('hyderabad') || loc.includes('hitec') || loc.includes('banjara')) {
      return { lat: 17.4399, lng: 78.3908 };
    }
    if (loc.includes('chennai') || loc.includes('madras')) {
      return { lat: 13.0827, lng: 80.2707 };
    }
    if (loc.includes('pune')) {
      return { lat: 18.5204, lng: 73.8567 };
    }
    if (loc.includes('ahmedabad')) {
      return { lat: 23.0225, lng: 72.5714 };
    }
    if (loc.includes('jaipur')) {
      return { lat: 26.9124, lng: 75.7873 };
    }
    if (loc.includes('burdwan') || loc.includes('bardhaman')) {
      return { lat: 23.2324, lng: 87.8615 };
    }
    if (loc.includes('siliguri')) {
      return { lat: 26.7271, lng: 88.3953 };
    }
    if (loc.includes('howrah')) {
      return { lat: 22.5958, lng: 88.2636 };
    }
    if (loc.includes('durgapur')) {
      return { lat: 23.5204, lng: 87.3119 };
    }
    if (loc.includes('asansol')) {
      return { lat: 23.6739, lng: 86.9524 };
    }
    return { lat: 22.5535, lng: 88.3518 };
  }, [booking.meetingLocation]);

  const liveCompanionCoords = React.useMemo(() => {
    if (companionLocation?.latitude && companionLocation?.longitude) {
      return { lat: companionLocation.latitude, lng: companionLocation.longitude };
    }
    const distOffset = (1 - walkingProgress) * 0.007;
    return {
      lat: venueCoords.lat - distOffset,
      lng: venueCoords.lng - (distOffset * 0.8)
    };
  }, [companionLocation, venueCoords, walkingProgress]);

  // Real Street Map Leaflet Renderer
  useEffect(() => {
    if (mapMode !== 'street' || !mapContainerRef.current) return;
    let isCancelled = false;

    const loadLeaflet = () => {
      return new Promise<any>((resolve, reject) => {
        if ((window as any).L) return resolve((window as any).L);
        const existing = document.querySelector('script[data-leaflet="true"]') as HTMLScriptElement;
        if (existing) {
          if ((window as any).L) return resolve((window as any).L);
          existing.addEventListener('load', () => resolve((window as any).L));
          return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.dataset.leaflet = 'true';
        script.onload = () => resolve((window as any).L);
        script.onerror = () => reject(new Error('Leaflet map failed to load'));
        document.head.appendChild(script);
      });
    };

    loadLeaflet()
      .then((L) => {
        if (isCancelled || !mapContainerRef.current) return;
        setLeafletLoaded(true);

        if (!leafletMapRef.current) {
          const map = L.map(mapContainerRef.current, {
            zoomControl: true,
            attributionControl: false
          }).setView([liveCompanionCoords.lat, liveCompanionCoords.lng], 15);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          }).addTo(map);

          const venueIcon = L.divIcon({
            className: 'custom-venue-pin',
            html: `<div style="background:#10b981; color:#fff; border:2px solid #fff; border-radius:50%; width:34px; height:34px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(16,185,129,0.5); font-weight:bold; font-size:16px;">📍</div><div style="background:#0f172a; color:#fff; padding:2px 8px; border-radius:6px; border:1px solid #10b981; font-size:10px; font-weight:bold; white-space:nowrap; margin-top:2px;">Venue: ${(booking.meetingLocation || '').split(',')[0] || 'Meeting Spot'}</div>`,
            iconSize: [34, 50],
            iconAnchor: [17, 25]
          });
          const vMarker = L.marker([venueCoords.lat, venueCoords.lng], { icon: venueIcon }).addTo(map);
          vMarker.bindPopup(`<b>Meeting Venue</b><br/>${booking.meetingLocation || 'Agreed Spot'}`);
          venueMarkerRef.current = vMarker;

          const compAvatarUrl = booking.companionPhoto || (isMale ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80');
          const compIcon = L.divIcon({
            className: 'custom-companion-pin',
            html: `<div style="position:relative; width:44px; height:44px;"><div style="position:absolute; inset:-4px; border-radius:50%; background:${isMale ? 'rgba(14,165,233,0.35)' : 'rgba(236,72,153,0.35)'}; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div><img src="${compAvatarUrl}" style="width:44px; height:44px; border-radius:50%; border:3px solid ${isMale ? '#38bdf8' : '#ec4899'}; object-fit:cover; box-shadow:0 4px 14px rgba(0,0,0,0.4);" /><div style="position:absolute; bottom:-6px; left:50%; transform:translateX(-50%); background:#0f172a; color:#fff; padding:1px 6px; border-radius:4px; font-size:9px; font-weight:bold; white-space:nowrap; border:1px solid ${isMale ? '#38bdf8' : '#ec4899'};">${isMale ? '🚶‍♂️' : '🚶‍♀️'} ${(booking.companionName || '').split(' ')[0] || 'Companion'}</div></div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          });
          const cMarker = L.marker([liveCompanionCoords.lat, liveCompanionCoords.lng], { icon: compIcon }).addTo(map);
          cMarker.bindPopup(`<b>${booking.companionName || 'Companion'}</b><br/>Live Walking GPS Location`);
          companionMarkerRef.current = cMarker;

          const poly = L.polyline([
            [liveCompanionCoords.lat, liveCompanionCoords.lng],
            [venueCoords.lat, venueCoords.lng]
          ], {
            color: isMale ? '#0284c7' : '#ec4899',
            weight: 4,
            opacity: 0.85,
            dashArray: '6, 8'
          }).addTo(map);
          polylineRef.current = poly;

          leafletMapRef.current = map;

          const bounds = L.latLngBounds([
            [liveCompanionCoords.lat, liveCompanionCoords.lng],
            [venueCoords.lat, venueCoords.lng]
          ]);
          map.fitBounds(bounds, { padding: [50, 50] });
        } else {
          if (companionMarkerRef.current) {
            companionMarkerRef.current.setLatLng([liveCompanionCoords.lat, liveCompanionCoords.lng]);
          }
          if (polylineRef.current) {
            polylineRef.current.setLatLngs([
              [liveCompanionCoords.lat, liveCompanionCoords.lng],
              [venueCoords.lat, venueCoords.lng]
            ]);
          }
        }
      })
      .catch((e) => {
        console.warn('Leaflet load notice:', e);
      });

    return () => {
      isCancelled = true;
    };
  }, [mapMode, liveCompanionCoords, venueCoords, isMale, booking]);

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

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
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isLocationUnlocked ? 'bg-emerald-400' : 'bg-pink-400'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isLocationUnlocked ? 'bg-emerald-500' : 'bg-pink-500'}`}></span>
                </span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                    {isLocationUnlocked ? 'Estimated Arrival' : 'Privacy Protection'}
                  </span>
                  <span className={`text-xs sm:text-sm font-extrabold ${isLocationUnlocked ? 'text-emerald-400' : 'text-pink-400'} leading-tight`}>
                    {!isLocationUnlocked
                      ? `Unlocks 30m prior (${formatRemainingUnlock()})`
                      : (bookingStatus === 'COMPANION_ARRIVED' ? 'Arrived at your spot!' : `~${etaMinutes} mins (${distanceKm} km away)`)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pointer-events-auto">
                {/* View Switcher: Real Streets (OpenStreetMap) vs Neon Route */}
                <div className="hidden sm:flex items-center bg-slate-900/95 border border-slate-700/80 rounded-xl p-1 shadow-lg backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setMapMode('street')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      mapMode === 'street'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🗺️ Real Streets
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapMode('radar')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      mapMode === 'radar'
                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ⚡ Neon Route
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleOpenGoogleMaps}
                  className="px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-amber-300 shadow-lg flex items-center gap-1.5 backdrop-blur-md transition cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Google Maps</span>
                </button>
              </div>
            </div>

            {/* REAL STREET MAP / NEON ROUTE VIEW (Requirement 4) */}
            <div className="w-full h-80 sm:h-96 rounded-2xl bg-[#0b1324] relative overflow-hidden border border-slate-800/80">
              {mapMode === 'street' ? (
                /* 1. Real Street Map with Live Leaflet Tile Layer */
                <div className="w-full h-full relative">
                  <div
                    ref={mapContainerRef}
                    id="client-live-street-map"
                    className="w-full h-full z-0"
                    style={{ minHeight: '320px', width: '100%' }}
                  />

                  {/* Fallback real map if Leaflet JS is still loading */}
                  {!leafletLoaded && (
                    <iframe
                      title="OpenStreetMap Real View"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${liveCompanionCoords.lng - 0.008}%2C${liveCompanionCoords.lat - 0.008}%2C${venueCoords.lng + 0.008}%2C${venueCoords.lat + 0.008}&layer=mapnik&marker=${liveCompanionCoords.lat}%2C${liveCompanionCoords.lng}`}
                      className="absolute inset-0 w-full h-full"
                    />
                  )}

                  {/* Real Street Marker Overlay Pill */}
                  <div className="absolute top-16 left-4 z-10 px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700 text-[11px] font-mono text-emerald-400 shadow-lg flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Real-Time Streets & GPS Syncing</span>
                  </div>
                </div>
              ) : (
                /* 2. Interactive SVG Road Map with Animated Walking Character */
                <svg className="w-full h-full" viewBox="0 0 440 300" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <linearGradient id="routeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={isMale ? '#0284c7' : '#ec4899'} />
                      <stop offset="50%" stopColor={isMale ? '#38bdf8' : '#f43f5e'} />
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

                  {/* Active Walking Route Path */}
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
                    <rect x="-35" y="-36" width="70" height="20" rx="6" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
                    <text x="0" y="-23" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">📍 Your Spot</text>
                  </g>

                  {/* Animated Walking Companion Avatar */}
                  {isLocationUnlocked && (
                    <g transform={`translate(${walkerX}, ${walkerY})`}>
                      <circle
                        r="22"
                        fill={isMale ? '#0284c7' : '#ec4899'}
                        fillOpacity="0.25"
                        className="animate-pulse"
                      />
                      <circle
                        r="14"
                        fill="#0f172a"
                        stroke={isMale ? '#38bdf8' : '#ec4899'}
                        strokeWidth="2"
                      />
                      <text x="0" y="6" textAnchor="middle" fontSize="18" className="select-none animate-bounce">
                        {isMale ? '🚶‍♂️' : '🚶‍♀️'}
                      </text>
                      <g transform="translate(0, -22)">
                        <rect
                          x="-44"
                          y="-12"
                          width="88"
                          height="17"
                          rx="5"
                          fill={isMale ? '#0284c7' : '#ec4899'}
                        />
                        <text x="0" y="0" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">
                          {isMale ? '👨' : '👩'} {booking.companionName?.split(' ')[0] || 'Companion'} (~{etaMinutes}m)
                        </text>
                      </g>
                    </g>
                  )}
                </svg>
              )}

              {/* Privacy Protection Frosted Overlay (Active until 30 minutes before meeting) */}
              {!isLocationUnlocked && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
                  <div className="max-w-xs w-full p-4 rounded-2xl bg-slate-900/95 border border-pink-500/40 text-center space-y-2.5 shadow-2xl animate-fade-in">
                    <div className="w-10 h-10 mx-auto rounded-full bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-100 flex items-center justify-center gap-1">
                        <span>🛡️ Privacy Protected Location</span>
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                        To respect personal privacy, live walking GPS tracking unlocks <strong>30 minutes before your scheduled meeting</strong>.
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-[10px] space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Scheduled Meeting:</span>
                        <span className="font-semibold text-slate-200">{booking.date} • {booking.startTime}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Live Tracking Opens:</span>
                        <span className="font-bold text-pink-400">
                          {new Date(thirtyMinsBeforeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 text-[11px] font-mono font-bold text-pink-300">
                      <Clock className="w-3 h-3 text-pink-400 animate-pulse" />
                      <span>Live Map in: {formatRemainingUnlock()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Street Landmark Indicator */}
              <div className="absolute bottom-3 left-4 right-4 z-10 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md flex items-center justify-between text-xs text-slate-300">
                <span className="truncate max-w-[240px] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>Venue: <strong>{booking.meetingLocation || 'Central Public Cafe'}</strong></span>
                </span>
                <span className={`text-[10px] font-bold shrink-0 ${isLocationUnlocked ? 'text-emerald-400' : 'text-pink-400'}`}>
                  {isLocationUnlocked ? 'GPS Connected' : 'Privacy Locked'}
                </span>
              </div>
            </div>

            {/* DYNAMIC SESSION LIFECYCLE CARDS */}
            {bookingStatus === 'COMPLETED' ? (
              <div className="mt-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-teal-950/40 border-2 border-emerald-500/60 shadow-xl space-y-2 text-center animate-fade-in">
                <span className="text-2xl block">🎉</span>
                <h4 className="text-base font-black text-emerald-300">Session Completed Successfully!</h4>
                <p className="text-xs text-slate-300">
                  Thank you for booking with PairUpToday. We hope you had a safe, engaging, and pleasant companionship experience!
                </p>
              </div>
            ) : bookingStatus === 'IN_PROGRESS' ? (
              <div className="mt-4 space-y-3 animate-fade-in">
                {/* 1. Real-Time Session Countdown Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-pink-950/50 border border-purple-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-pink-300 uppercase tracking-wider block">
                      {isSessionFinished ? '⏰ Scheduled Session Time Finished' : '⏱️ Meeting in Progress (Live Countdown)'}
                    </span>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {isSessionFinished
                        ? 'Your booked session hours have completed. Please share the Completion OTP below with your companion.'
                        : `Official booked duration: ${booking.durationHours || 1} Hour(s). Enjoy your companionship!`}
                    </p>
                  </div>
                  <div className="px-5 py-2.5 rounded-xl bg-slate-950 border-2 border-pink-500/60 font-mono text-2xl font-black text-pink-400 text-center shadow-lg whitespace-nowrap">
                    {sessionTimeFormatted}
                  </div>
                </div>

                {/* 2. Completion OTP Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-950 border-2 border-emerald-500/50 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                      🔑 Meeting Completion OTP
                    </span>
                    <p className="text-xs text-slate-300 mt-0.5">
                      When your session finishes, share this 6-digit Completion OTP verbally with your companion to finalize the session:
                    </p>
                  </div>
                  <div className="px-5 py-2.5 rounded-xl bg-slate-950 border-2 border-emerald-400 font-mono text-xl font-black text-emerald-300 tracking-widest text-center shadow-lg whitespace-nowrap animate-pulse">
                    {endOtp || booking.endOtp || '••••••'}
                  </div>
                </div>
              </div>
            ) : (
              /* Start OTP Safety Card: Strictly locked until companion arrives at client location */
              <div className={`mt-4 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                bookingStatus === 'COMPANION_ARRIVED'
                  ? 'bg-gradient-to-r from-emerald-500/20 via-pink-500/15 to-teal-500/20 border-emerald-500/60 shadow-lg shadow-emerald-950/40 ring-2 ring-emerald-500/40 animate-pulse'
                  : 'bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 border-slate-800'
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                      bookingStatus === 'COMPANION_ARRIVED' ? 'text-emerald-300' : 'text-amber-400'
                    }`}>
                      {bookingStatus === 'COMPANION_ARRIVED' ? '🔓 Session Start OTP (Unlocked — Companion Arrived!)' : '🔒 Session Start OTP (Locked)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {bookingStatus === 'COMPANION_ARRIVED'
                      ? '🎉 Your companion has arrived at your meeting location! Share this 6-digit Start OTP verbally to begin the session:'
                      : 'Start OTP is securely locked. It will automatically unlock as soon as your companion reaches your location and confirms arrival.'}
                  </p>
                </div>
                <div className={`px-5 py-2.5 rounded-xl border-2 font-mono font-extrabold text-xl tracking-widest text-center shadow-lg whitespace-nowrap ${
                  bookingStatus === 'COMPANION_ARRIVED'
                    ? 'bg-slate-950 border-emerald-400 text-emerald-300 animate-pulse'
                    : 'bg-slate-950 border-slate-800 text-slate-500 text-sm'
                }`}>
                  {bookingStatus === 'COMPANION_ARRIVED' ? (startOtp || '******') : '•••••• (Unlocks on Arrival)'}
                </div>
              </div>
            )}
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
                  <span title="Identity Verified"><ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /></span>
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

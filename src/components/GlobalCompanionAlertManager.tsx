import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { Bell, Check, X, MapPin, Calendar, Clock, DollarSign, AlertCircle } from 'lucide-react';

interface GlobalCompanionAlertManagerProps {
  onNavigateToDashboard?: () => void;
}

// Convert VAPID URL Base64 to Uint8Array for Web Push API
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Safe system notification helper for Android Chrome
const triggerCallNotification = (title: string, options?: any) => {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return;

    const notifOptions = {
      icon: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
      badge: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
      tag: 'incoming-booking-call',
      category: 'call',
      priority: 2,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [800, 300, 800, 300, 800],
      actions: [
        { action: 'open', title: '📞 ANSWER / VIEW' },
        { action: 'decline', title: '❌ DECLINE' }
      ],
      ...(options || {})
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg && typeof reg.showNotification === 'function') {
          reg.showNotification(title, notifOptions).catch(() => {});
        }
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('System notification suppressed:', err);
  }
};

export const GlobalCompanionAlertManager: React.FC<GlobalCompanionAlertManagerProps> = ({ onNavigateToDashboard }) => {
  const { user } = useAuth();
  const [incomingBooking, setIncomingBooking] = useState<any | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneTimerRef = useRef<any>(null);
  const pulseTimerRef = useRef<any>(null);

  const isCompanion = Boolean(
    user && (user.activeRole === 'COMPANION' || (Array.isArray(user.roles) && user.roles.includes('COMPANION')))
  );

  // Close any ongoing system notifications
  const closeAllCallNotifications = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg && typeof reg.getNotifications === 'function') {
          reg.getNotifications().then((list) => {
            list.forEach((n) => {
              if (n.tag && (n.tag.includes('booking') || n.tag === 'incoming-booking-call')) {
                n.close();
              }
            });
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, []);

  // Stop ringtone and restore background keepalive audio
  const stopRingtone = useCallback(() => {
    try {
      if (ringtoneTimerRef.current) {
        clearInterval(ringtoneTimerRef.current);
        ringtoneTimerRef.current = null;
      }
      if (pulseTimerRef.current) {
        clearInterval(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0);
      }
      if (backgroundAudioRef.current) {
        try {
          backgroundAudioRef.current.src = '/assets/silent.wav';
          backgroundAudioRef.current.loop = true;
          backgroundAudioRef.current.volume = 0.01;
          const p = backgroundAudioRef.current.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {}
      }
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
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
      closeAllCallNotifications();
    } catch (e) {
      console.warn('stopRingtone error', e);
    }
  }, [closeAllCallNotifications]);

  // Start continuous loud repeating ringtone
  const startRingtone = useCallback(() => {
    try {
      stopRingtone();

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
            p.catch(() => {});
          }
        } catch {}
      }

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

      // Vibration pattern
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate([800, 300, 800, 300, 800]);
      }
    } catch (e) {
      console.warn('startRingtone error', e);
    }
  }, [stopRingtone]);

  // Initialize and register Web Push Subscription via Service Worker & VAPID
  useEffect(() => {
    if (!isCompanion || typeof window === 'undefined') return;

    const setupWebPush = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const reg = await navigator.serviceWorker.ready;

        const res = await apiFetch('/api/companion/push-vapid-key');
        if (!res.ok) return;
        const { publicKey } = await res.json();
        if (!publicKey) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
          });
        }
        if (sub) {
          await apiFetch('/api/companion/push-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub })
          });
        }
      } catch (err) {
        console.warn('Web Push setup warning:', err);
      }
    };

    setupWebPush();
  }, [isCompanion, user?.id]);

  // Keep background audio active when companion is logged in
  useEffect(() => {
    if (!isCompanion || typeof window === 'undefined') return;

    try {
      if (!backgroundAudioRef.current) {
        const audio = new Audio('/assets/silent.wav');
        audio.loop = true;
        audio.volume = 0.01;
        backgroundAudioRef.current = audio;
      }
      const p = backgroundAudioRef.current.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {}

    return () => {
      stopRingtone();
      if (backgroundAudioRef.current) {
        try {
          backgroundAudioRef.current.pause();
        } catch {}
      }
    };
  }, [isCompanion, stopRingtone]);

  // Persistent Global SSE Alert Stream + 3.5s Fallback Polling
  useEffect(() => {
    if (!isCompanion || typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let pollTimer: any = null;

    const handleIncomingBooking = (booking: any) => {
      setIncomingBooking(booking);
      startRingtone();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pairup:incoming-booking', { detail: booking }));
      }

      triggerCallNotification(`🚨 URGENT BOOKING: ₹${Math.round(booking.totalPayablePaise ? booking.totalPayablePaise / 100 : (booking.totalAmount || 1000))} - ${booking.serviceName || 'Session'}`, {
        body: `From ${booking.clientName || 'A Client'}. Tap to Answer & Accept now!`,
        data: { bookingId: booking.id, url: '/companion-dashboard' }
      });
    };

    const handleCancellation = (bookingId?: string) => {
      stopRingtone();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pairup:incoming-booking', { detail: null }));
      }
      setIncomingBooking((current: any) => {
        if (!bookingId || (current && current.id === bookingId)) {
          setActionMsg('⚠️ Booking Request was Canceled by Client.');
          setTimeout(() => setActionMsg(null), 4000);
          return null;
        }
        return current;
      });
    };

    // 1. SSE Connection
    try {
      const token = localStorage.getItem('pairup_token') || '';
      const sseUrl = token
        ? `/api/companion/alerts/stream?token=${encodeURIComponent(token)}`
        : '/api/companion/alerts/stream';

      eventSource = new EventSource(sseUrl);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_BOOKING_REQUEST' && data.booking) {
            handleIncomingBooking(data.booking);
          } else if (data.type === 'BOOKING_CANCELLED') {
            handleCancellation(data.bookingId);
          } else if (data.type === 'BOOKING_ACCEPTED') {
            stopRingtone();
            setIncomingBooking(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('pairup:incoming-booking', { detail: null }));
            }
          }
        } catch (e) {
          console.warn('Global SSE parse error', e);
        }
      };
      eventSource.onerror = () => {
        // SSE auto-reconnects, fallback polling guarantees delivery
      };
    } catch (sseErr) {
      console.warn('Global SSE initialization error', sseErr);
    }

    // 2. Fallback Polling every 3.5s
    const checkPendingBookings = async () => {
      try {
        const res = await apiFetch('/api/companion/bookings');
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.bookings) ? data.bookings : [];
          const pending = list.find((b: any) => b.status === 'PENDING' && !b.companionAccepted);
          if (pending) {
            setIncomingBooking((prev: any) => {
              if (!prev || prev.id !== pending.id) {
                handleIncomingBooking(pending);
              }
              return pending;
            });
          } else {
            setIncomingBooking((prev: any) => {
              if (prev) {
                stopRingtone();
              }
              return null;
            });
          }
        }
      } catch {}
    };

    checkPendingBookings();
    pollTimer = setInterval(checkPendingBookings, 3500);

    return () => {
      if (eventSource) eventSource.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [isCompanion, startRingtone, stopRingtone]);

  // Repeating notification pulse while booking is pending
  useEffect(() => {
    if (incomingBooking) {
      pulseTimerRef.current = setInterval(() => {
        triggerCallNotification(`🚨 URGENT BOOKING: ₹${Math.round(incomingBooking.totalPayablePaise ? incomingBooking.totalPayablePaise / 100 : (incomingBooking.totalAmount || 1000))} - ${incomingBooking.serviceName || 'Session'}`, {
          body: `From ${incomingBooking.clientName || 'A Client'}. Tap to Answer & Accept now!`,
          data: { bookingId: incomingBooking.id, url: '/companion-dashboard' }
        });
      }, 3500);
    } else {
      if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
    }
    return () => {
      if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
    };
  }, [incomingBooking?.id]);

  // Handle Accept
  const handleAccept = async () => {
    if (!incomingBooking || isProcessing) return;
    setIsProcessing(true);
    stopRingtone();
    try {
      const res = await apiFetch(`/api/bookings/${incomingBooking.id}/accept`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setIncomingBooking(null);
        if (onNavigateToDashboard) {
          onNavigateToDashboard();
        } else if (typeof window !== 'undefined') {
          window.location.href = '/companion-dashboard';
        }
      } else if (data.canceledByClient) {
        setActionMsg('⚠️ This booking was already canceled by the client.');
        setIncomingBooking(null);
        setTimeout(() => setActionMsg(null), 4000);
      } else {
        setActionMsg(data.error || 'Failed to accept booking.');
        setTimeout(() => setActionMsg(null), 4000);
      }
    } catch (err: any) {
      setActionMsg(err.message || 'Error accepting booking.');
      setTimeout(() => setActionMsg(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Decline
  const handleDecline = async () => {
    if (!incomingBooking || isProcessing) return;
    setIsProcessing(true);
    stopRingtone();
    try {
      await apiFetch(`/api/bookings/${incomingBooking.id}/reject`, { method: 'POST' });
      setIncomingBooking(null);
    } catch (err: any) {
      console.warn('Decline error', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isCompanion) return null;

  const totalEarningsPaise = incomingBooking
    ? Number(incomingBooking.companionNetSharePaise) || Math.round((Number(incomingBooking.bookingAmountPaise || incomingBooking.amountPaise || incomingBooking.baseAmountPaise) || 49900) * 0.85)
    : 0;

  return (
    <>
      {/* Toast Alert Banner */}
      {actionMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] px-5 py-3 rounded-2xl bg-slate-900/95 border border-pink-500/60 text-slate-100 text-xs shadow-2xl flex items-center gap-2.5 animate-bounce">
          <AlertCircle className="w-4 h-4 text-pink-400 shrink-0" />
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global Urgent Incoming Booking Modal (Displays across ALL pages: Home, About, Dashboard, etc.) */}
      {incomingBooking && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border-2 border-pink-500 rounded-3xl shadow-2xl p-6 text-slate-100 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 border-2 border-pink-500 flex items-center justify-center text-pink-400 animate-pulse shrink-0">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-1.5">
                  <span>🚨 Urgent Booking Call!</span>
                </h3>
                <p className="text-xs text-pink-400 font-semibold truncate">
                  {incomingBooking.clientName || 'A Client'} is waiting for your instant response
                </p>
              </div>
            </div>

            {/* Details Box */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Service:</span>
                <span className="font-bold text-slate-100 text-sm">{incomingBooking.serviceName || 'Companion Session'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> Date & Time:
                </span>
                <span className="font-semibold text-slate-200">
                  {incomingBooking.date} ({incomingBooking.startTime || '14:00'} - {incomingBooking.endTime || '16:00'})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" /> Duration:
                </span>
                <span className="font-semibold text-slate-200">{incomingBooking.durationHours || 1} Hour(s)</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-400 flex items-center gap-1 shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" /> Venue:
                </span>
                <span className="font-semibold text-slate-200 text-right truncate max-w-[220px]">
                  {incomingBooking.meetingLocation || 'Client Venue'}
                </span>
              </div>
              {incomingBooking.notes && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 block mb-0.5">Client Notes:</span>
                  <span className="text-slate-300 italic">"{incomingBooking.notes}"</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-slate-300 font-bold flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-emerald-400" /> Your Net Earnings (85%):
                </span>
                <span className="text-emerald-400 font-extrabold text-base">
                  ₹{(totalEarningsPaise / 100).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleDecline}
                disabled={isProcessing}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4 text-rose-400" />
                <span>Decline / Busy</span>
              </button>

              <button
                type="button"
                onClick={handleAccept}
                disabled={isProcessing}
                className="py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>{isProcessing ? 'Accepting...' : 'Accept & Proceed'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

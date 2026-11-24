import React, { useState, useMemo } from 'react';
import { normalizeGender } from '../utils/gender';

export type GenderType = 'MALE' | 'FEMALE' | 'OTHER' | 'NEUTRAL';

export interface CartoonMapMarkerProps {
  gender?: GenderType | string;
  name: string;
  role: 'companion' | 'client' | 'waiting_client';
  sublabel?: string;
  isMoving?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  state?: 'walking' | 'waiting';
}

export const CartoonMapMarker: React.FC<CartoonMapMarkerProps> = ({
  gender = 'FEMALE',
  name,
  role,
  sublabel,
  isMoving = false,
  className = '',
  size = 'md',
  state
}) => {
  const [imgError, setImgError] = useState(false);

  // Normalize gender safely using exact matching & name fallback (avoids 'female'.includes('mal') bug)
  const normalizedGender: 'MALE' | 'FEMALE' = useMemo(() => {
    return normalizeGender(gender, name);
  }, [gender, name]);

  // Determine motion state: walking or waiting
  const motionMode: 'walking' | 'waiting' = useMemo(() => {
    if (state) return state;
    if (role === 'companion') {
      return isMoving ? 'walking' : 'waiting';
    }
    return 'waiting';
  }, [state, role, isMoving]);

  // Wire up the 4 custom transparent PNG character assets from public/avatars/
  const avatarSrc = useMemo(() => {
    if (motionMode === 'walking') {
      return normalizedGender === 'MALE'
        ? '/avatars/male-walking.png'
        : '/avatars/female-walking.png';
    } else {
      return normalizedGender === 'MALE'
        ? '/avatars/male-waiting.png'
        : '/avatars/female-waiting.png';
    }
  }, [motionMode, normalizedGender]);

  // Dimension presets (proportional, high-DPI crisp display on mobile & desktop)
  const sizeConfig = useMemo(() => {
    switch (size) {
      case 'sm':
        return {
          wrapper: 'w-16 h-22 sm:w-18 sm:h-24',
          imgH: 'h-18 sm:h-20',
          ringOuter: 'w-14 h-4',
          ringInner: 'w-10 h-3'
        };
      case 'lg':
        return {
          wrapper: 'w-24 h-32 sm:w-28 sm:h-36',
          imgH: 'h-26 sm:h-30',
          ringOuter: 'w-20 h-6',
          ringInner: 'w-16 h-4.5'
        };
      case 'md':
      default:
        return {
          wrapper: 'w-20 h-26 sm:w-22 sm:h-28',
          imgH: 'h-22 sm:h-24',
          ringOuter: 'w-16 h-5',
          ringInner: 'w-12 h-3.5'
        };
    }
  }, [size]);

  const badgeBg = role === 'companion'
    ? 'bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 text-white'
    : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 text-white';

  return (
    <div className={`relative flex flex-col items-center select-none pointer-events-auto ${className}`}>
      {/* ─── 1. FLOATING LOVE BUBBLES ANIMATION (♥ / 💕) ABOVE HEAD ─── */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-none w-24 h-20 overflow-visible z-20">
        {/* Glass Bubble 1: Floating Heart Left */}
        <div
          className="absolute left-1/2 bottom-0 w-6 h-6 rounded-full border border-pink-300/80 bg-pink-500/30 backdrop-blur-xs flex items-center justify-center shadow-[0_2px_8px_rgba(236,72,153,0.4)]"
          style={{ animation: 'pairupGlassHeart1 2.4s infinite ease-out' }}
        >
          <span className="text-pink-100 font-black text-xs leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
            ♥
          </span>
        </div>

        {/* Glass Bubble 2: Floating Heart Center-Right */}
        <div
          className="absolute left-1/2 bottom-0 w-5 h-5 rounded-full border border-rose-300/80 bg-rose-500/35 backdrop-blur-xs flex items-center justify-center shadow-[0_2px_8px_rgba(244,63,94,0.4)]"
          style={{ animation: 'pairupGlassHeart2 2.7s infinite 0.6s ease-out' }}
        >
          <span className="text-white font-bold text-[10px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
            💕
          </span>
        </div>

        {/* Glass Bubble 3: Gentle Floating Sparkle Heart */}
        <div
          className="absolute left-1/2 bottom-0 w-4 h-4 rounded-full border border-pink-200/80 bg-pink-400/30 backdrop-blur-xs flex items-center justify-center shadow-[0_2px_6px_rgba(236,72,153,0.3)]"
          style={{ animation: 'pairupGlassHeart3 2.5s infinite 1.2s ease-out' }}
        >
          <span className="text-pink-100 font-black text-[9px] leading-none">
            ♥
          </span>
        </div>

        {/* Glass Bubble 4: Soft High Rising Bubble */}
        <div
          className="absolute left-1/2 bottom-0 w-5 h-5 rounded-full border border-purple-200/70 bg-purple-500/25 backdrop-blur-xs flex items-center justify-center shadow-[0_2px_6px_rgba(168,85,247,0.3)]"
          style={{ animation: 'pairupGlassHeart4 2.9s infinite 1.8s ease-out' }}
        >
          <span className="text-purple-100 font-bold text-[10px] leading-none">
            ♥
          </span>
        </div>
      </div>

      {/* ─── 2. CHARACTER BODY CONTAINER WITH REALISTIC MOTION ─── */}
      <div className={`relative ${sizeConfig.wrapper} flex flex-col items-center justify-end group`}>
        {/* Concentric GPS Pulse Ring beneath feet */}
        {motionMode === 'walking' ? (
          /* Walking Companion: Glowing Purple Concentric GPS Pulse Ring */
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center">
            {/* Outer concentric pulse wave */}
            <div
              className={`${sizeConfig.ringOuter} rounded-full bg-purple-500/30 ring-2 ring-purple-400/50 animate-ping`}
              style={{ animationDuration: '1.6s' }}
            />
            {/* Inner glowing pulse disk */}
            <div
              className={`absolute ${sizeConfig.ringInner} rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 opacity-80 blur-[1px] shadow-lg shadow-purple-500/50`}
            />
            {/* Ground contact shadow */}
            <div className="absolute w-8 h-2 rounded-full bg-slate-950/70 blur-[1.5px]" />
          </div>
        ) : (
          /* Waiting Client at Venue: Steady Slate / Purple Destination Ring */
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center">
            {/* Outer gentle breathing pulse */}
            <div
              className={`${sizeConfig.ringOuter} rounded-full border-2 border-purple-400/70 animate-pulse`}
              style={{ animationDuration: '2.5s' }}
            />
            {/* Destination glowing target disk */}
            <div
              className={`absolute ${sizeConfig.ringInner} rounded-full bg-gradient-to-r from-slate-800 via-purple-600 to-slate-800 opacity-90 shadow-md shadow-purple-500/40`}
            />
            {/* Ground contact shadow */}
            <div className="absolute w-8 h-2 rounded-full bg-black/60 blur-[1.5px]" />
          </div>
        )}

        {/* ── Transparent PNG Character Avatar ── */}
        <div
          className="relative z-10 w-full flex items-end justify-center"
          style={{
            transformOrigin: 'bottom center',
            animation: motionMode === 'walking'
              ? 'pairupWalkingStride 0.85s infinite ease-in-out'
              : 'pairupIdleBreathing 2.6s infinite ease-in-out'
          }}
        >
          {!imgError ? (
            <img
              src={avatarSrc}
              alt={`${normalizedGender} ${motionMode}`}
              className={`w-auto ${sizeConfig.imgH} object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)] transition-all`}
              loading="eager"
              onError={() => setImgError(true)}
            />
          ) : (
            /* Graceful SVG fallback in case network blocked local PNG */
            <div className="w-16 h-20 flex items-center justify-center bg-purple-900/60 rounded-full border border-purple-400 p-2">
              <span className="text-2xl">{normalizedGender === 'MALE' ? '👨' : '👩'}</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── 3. FLOATING NAME & STATUS BADGE PILL ─── */}
      <div className="mt-1 flex flex-col items-center z-20">
        <div className={`px-2.5 py-0.5 rounded-full ${badgeBg} shadow-lg flex items-center gap-1 border border-white/60 text-center whitespace-nowrap`}>
          <span className="text-[11px] font-black tracking-wide truncate max-w-[120px] drop-shadow-xs">
            {name}
          </span>
          {role === 'companion' && motionMode === 'walking' && (
            <span className="text-[10px] text-pink-200 font-extrabold animate-pulse">🚶 Live</span>
          )}
          {(role === 'waiting_client' || role === 'client') && (
            <span className="text-[10px] text-pink-200 font-black">♥ Venue</span>
          )}
        </div>

        {sublabel && (
          <span className="text-[9px] font-black text-slate-800 bg-white/95 px-2 py-0.5 rounded-full border border-purple-200/80 mt-0.5 shadow-sm whitespace-nowrap max-w-[150px] truncate">
            {sublabel}
          </span>
        )}
      </div>

      {/* ─── 4. HIGH-PERFORMANCE CSS KEYFRAMES MICRO-ANIMATIONS ─── */}
      <style>{`
        /* Stride motion for Walking Companion (vertical bounce, natural stride sway, forward lean) */
        @keyframes pairupWalkingStride {
          0% {
            transform: translateY(0) rotate(-2.5deg) skewX(-1.5deg);
          }
          25% {
            transform: translateY(-4px) rotate(0deg) skewX(-0.5deg);
          }
          50% {
            transform: translateY(0) rotate(2.5deg) skewX(1deg);
          }
          75% {
            transform: translateY(-3.5px) rotate(0deg) skewX(0.5deg);
          }
          100% {
            transform: translateY(0) rotate(-2.5deg) skewX(-1.5deg);
          }
        }

        /* Idle breathing & gentle body sway for Waiting Client at Venue */
        @keyframes pairupIdleBreathing {
          0% {
            transform: scaleY(1) rotate(-1.5deg);
          }
          50% {
            transform: scaleY(1.025) scaleX(0.99) rotate(1.5deg);
          }
          100% {
            transform: scaleY(1) rotate(-1.5deg);
          }
        }

        /* Glass Floating Love Bubbles with pink hearts */
        @keyframes pairupGlassHeart1 {
          0% {
            transform: translate(-50%, 0) scale(0.4) rotate(-8deg);
            opacity: 0;
          }
          20% {
            opacity: 0.95;
            transform: translate(calc(-50% - 8px), -14px) scale(0.9) rotate(4deg);
          }
          65% {
            opacity: 0.85;
            transform: translate(calc(-50% - 16px), -32px) scale(1.05) rotate(-6deg);
          }
          100% {
            transform: translate(calc(-50% - 22px), -50px) scale(0.5) rotate(10deg);
            opacity: 0;
          }
        }

        @keyframes pairupGlassHeart2 {
          0% {
            transform: translate(-50%, 0) scale(0.35) rotate(8deg);
            opacity: 0;
          }
          25% {
            opacity: 0.9;
            transform: translate(calc(-50% + 10px), -16px) scale(0.85) rotate(-6deg);
          }
          70% {
            opacity: 0.8;
            transform: translate(calc(-50% + 18px), -36px) scale(1) rotate(8deg);
          }
          100% {
            transform: translate(calc(-50% + 24px), -56px) scale(0.45) rotate(-10deg);
            opacity: 0;
          }
        }

        @keyframes pairupGlassHeart3 {
          0% {
            transform: translate(-50%, 0) scale(0.4);
            opacity: 0;
          }
          30% {
            opacity: 0.95;
            transform: translate(calc(-50% + 2px), -18px) scale(0.95) rotate(-4deg);
          }
          75% {
            opacity: 0.7;
            transform: translate(calc(-50% - 4px), -40px) scale(1.1) rotate(6deg);
          }
          100% {
            transform: translate(calc(-50% + 6px), -62px) scale(0.35) rotate(-6deg);
            opacity: 0;
          }
        }

        @keyframes pairupGlassHeart4 {
          0% {
            transform: translate(-50%, 0) scale(0.3) rotate(-10deg);
            opacity: 0;
          }
          25% {
            opacity: 0.85;
            transform: translate(calc(-50% - 10px), -12px) scale(0.8) rotate(6deg);
          }
          65% {
            opacity: 0.65;
            transform: translate(calc(-50% - 14px), -26px) scale(0.95) rotate(-4deg);
          }
          100% {
            transform: translate(calc(-50% - 18px), -44px) scale(0.35) rotate(8deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

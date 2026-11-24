import React from 'react';

export type GenderType = 'MALE' | 'FEMALE' | 'OTHER' | 'NEUTRAL';

interface CartoonMapMarkerProps {
  gender?: GenderType | string;
  name: string;
  role: 'companion' | 'client' | 'waiting_client';
  sublabel?: string;
  isMoving?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CartoonMapMarker: React.FC<CartoonMapMarkerProps> = ({
  gender = 'NEUTRAL',
  name,
  role,
  sublabel,
  isMoving = false,
  className = '',
  size = 'md'
}) => {
  // Normalize gender safely
  const normalizedGender: 'MALE' | 'FEMALE' | 'NEUTRAL' = React.useMemo(() => {
    const g = String(gender || '').toUpperCase();
    if (g.includes('FEM') || g.includes('WOM') || g.includes('GIRL')) return 'FEMALE';
    if (g.includes('MAL') || g.includes('MEN') || g.includes('BOY')) return 'MALE';
    return 'NEUTRAL';
  }, [gender]);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-15 h-15 sm:w-16 sm:h-16',
    lg: 'w-18 h-18 sm:w-20 sm:h-20'
  }[size];

  const ringColor = role === 'companion' 
    ? 'ring-pink-500 border-pink-400 shadow-pink-500/30' 
    : 'ring-emerald-500 border-emerald-400 shadow-emerald-500/30';

  const badgeBg = role === 'companion'
    ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white'
    : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white';

  return (
    <div className={`relative flex flex-col items-center select-none pointer-events-auto ${className}`}>
      {/* ─── FLOATING LOVE BUBBLES ANIMATION (♥ / 💕) ─── */}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 pointer-events-none w-20 h-16 overflow-visible">
        {/* Heart Bubble 1 */}
        <span
          className="absolute left-1/2 bottom-0 text-pink-500 font-bold text-sm drop-shadow-[0_2px_4px_rgba(236,72,153,0.6)]"
          style={{
            animation: 'pairupFloatLove1 2.2s infinite ease-out'
          }}
        >
          ♥
        </span>

        {/* Heart Bubble 2 */}
        <span
          className="absolute left-1/2 bottom-0 text-rose-500 font-bold text-xs drop-shadow-[0_2px_4px_rgba(244,63,94,0.6)]"
          style={{
            animation: 'pairupFloatLove2 2.6s infinite 0.7s ease-out'
          }}
        >
          💕
        </span>

        {/* Heart Bubble 3 */}
        <span
          className="absolute left-1/2 bottom-0 text-pink-400 font-bold text-[10px] drop-shadow-[0_2px_4px_rgba(236,72,153,0.5)]"
          style={{
            animation: 'pairupFloatLove3 2.4s infinite 1.4s ease-out'
          }}
        >
          ♥
        </span>
      </div>

      {/* ─── GENDER-BASED CARTOON AVATAR CONTAINER ─── */}
      <div className="relative group">
        {/* Animated Radar Pulse when moving or waiting */}
        <div
          className={`absolute -inset-1 rounded-full opacity-60 animate-ping ${
            role === 'companion' ? 'bg-pink-400' : 'bg-emerald-400'
          }`}
          style={{ animationDuration: isMoving ? '1.4s' : '2.8s' }}
        />

        {/* Outer Circular Frame */}
        <div
          className={`relative ${sizeClasses} rounded-full bg-white ring-4 ${ringColor} shadow-xl flex items-center justify-center p-1 overflow-hidden transition-transform transform group-hover:scale-105`}
        >
          {normalizedGender === 'FEMALE' ? (
            /* ── Cute Female Cartoon Avatar SVG ── */
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="femHair" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4A1E2F" />
                  <stop offset="100%" stopColor="#1E0B14" />
                </linearGradient>
                <linearGradient id="femSkin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FDDFC7" />
                  <stop offset="100%" stopColor="#F7C4A5" />
                </linearGradient>
                <linearGradient id="femDress" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#EC4899" />
                  <stop offset="100%" stopColor="#BE185D" />
                </linearGradient>
              </defs>
              {/* Back Hair */}
              <path d="M 22 45 C 16 65, 20 85, 26 95 L 74 95 C 80 85, 84 65, 78 45 Z" fill="url(#femHair)" />
              {/* Dress / Body */}
              <path d="M 28 85 C 32 76, 45 74, 50 74 C 55 74, 68 76, 72 85 L 78 100 L 22 100 Z" fill="url(#femDress)" />
              {/* Gold Necklace */}
              <path d="M 43 78 Q 50 84 57 78" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
              <circle cx="50" cy="82" r="2.5" fill="#F43F5E" />
              {/* Neck */}
              <rect x="44" y="65" width="12" height="12" rx="4" fill="url(#femSkin)" />
              {/* Face */}
              <ellipse cx="50" cy="50" rx="22" ry="24" fill="url(#femSkin)" />
              {/* Cheeks Blush */}
              <ellipse cx="36" cy="56" rx="4" ry="2.5" fill="#FDA4AF" opacity="0.85" />
              <ellipse cx="64" cy="56" rx="4" ry="2.5" fill="#FDA4AF" opacity="0.85" />
              {/* Eyes */}
              <ellipse cx="40" cy="48" rx="2.8" ry="3.8" fill="#1E1B4B" />
              <circle cx="41.2" cy="46.5" r="1.3" fill="#FFFFFF" />
              <ellipse cx="60" cy="48" rx="2.8" ry="3.8" fill="#1E1B4B" />
              <circle cx="61.2" cy="46.5" r="1.3" fill="#FFFFFF" />
              {/* Eyelashes */}
              <path d="M 37 44 Q 40 42 43 44" stroke="#1E1B4B" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              <path d="M 57 44 Q 60 42 63 44" stroke="#1E1B4B" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              {/* Gentle Smile */}
              <path d="M 44 60 Q 50 67 56 60" stroke="#BE123C" strokeWidth="2" strokeLinecap="round" fill="#F43F5E" />
              {/* Front Hair / Bangs & Waves */}
              <path d="M 28 42 C 30 20, 70 20, 72 42 C 68 32, 58 30, 50 34 C 42 30, 32 32, 28 42 Z" fill="url(#femHair)" />
              <path d="M 28 42 C 26 52, 29 60, 31 66 C 33 60, 33 48, 36 43 Z" fill="url(#femHair)" />
              <path d="M 72 42 C 74 52, 71 60, 69 66 C 67 60, 67 48, 64 43 Z" fill="url(#femHair)" />
              {/* Gold Flower Hairpin */}
              <circle cx="33" cy="34" r="3.5" fill="#F43F5E" />
              <circle cx="33" cy="34" r="1.5" fill="#FEF08A" />
            </svg>
          ) : normalizedGender === 'MALE' ? (
            /* ── Handsome Male Cartoon Avatar SVG ── */
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="maleHair" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#2D1C12" />
                  <stop offset="100%" stopColor="#0F0906" />
                </linearGradient>
                <linearGradient id="maleSkin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FEE0C8" />
                  <stop offset="100%" stopColor="#F5C4A3" />
                </linearGradient>
                <linearGradient id="maleJacket" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#1E3A8A" />
                </linearGradient>
              </defs>
              {/* Jacket / Shoulders */}
              <path d="M 26 84 C 30 74, 45 72, 50 72 C 55 72, 70 74, 74 84 L 80 100 L 20 100 Z" fill="url(#maleJacket)" />
              {/* Inner White Shirt Collar */}
              <path d="M 43 72 L 50 82 L 57 72 Z" fill="#FFFFFF" />
              {/* Neck */}
              <rect x="43" y="64" width="14" height="12" rx="3" fill="url(#maleSkin)" />
              {/* Face */}
              <ellipse cx="50" cy="49" rx="22" ry="24" fill="url(#maleSkin)" />
              {/* Cheeks Blush */}
              <ellipse cx="36" cy="56" rx="4" ry="2" fill="#FCA5A5" opacity="0.75" />
              <ellipse cx="64" cy="56" rx="4" ry="2" fill="#FCA5A5" opacity="0.75" />
              {/* Modern Boy Hairstyle */}
              <path d="M 28 42 C 26 24, 40 18, 50 18 C 62 18, 76 22, 73 42 C 70 34, 62 30, 52 30 C 42 30, 32 35, 28 42 Z" fill="url(#maleHair)" />
              {/* Eyebrows */}
              <path d="M 37 42 Q 41 39 45 42" stroke="#2D1C12" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M 55 42 Q 59 39 63 42" stroke="#2D1C12" strokeWidth="2.4" strokeLinecap="round" />
              {/* Eyes */}
              <circle cx="41" cy="48" r="3" fill="#1E1B4B" />
              <circle cx="42" cy="47" r="1.2" fill="#FFFFFF" />
              <circle cx="59" cy="48" r="3" fill="#1E1B4B" />
              <circle cx="60" cy="47" r="1.2" fill="#FFFFFF" />
              {/* Confident Friendly Smile */}
              <path d="M 44 59 Q 50 66 56 59" stroke="#991B1B" strokeWidth="2.2" strokeLinecap="round" fill="#DC2626" />
            </svg>
          ) : (
            /* ── Friendly Neutral Cartoon Avatar SVG ── */
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="neutralSkin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FEE0C8" />
                  <stop offset="100%" stopColor="#F5C4A3" />
                </linearGradient>
                <linearGradient id="neutralShirt" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#6D28D9" />
                </linearGradient>
              </defs>
              <path d="M 26 84 C 30 74, 45 72, 50 72 C 55 72, 70 74, 74 84 L 80 100 L 20 100 Z" fill="url(#neutralShirt)" />
              <rect x="43" y="64" width="14" height="12" rx="3" fill="url(#neutralSkin)" />
              <ellipse cx="50" cy="49" rx="22" ry="24" fill="url(#neutralSkin)" />
              <ellipse cx="36" cy="56" rx="4" ry="2" fill="#FDA4AF" opacity="0.8" />
              <ellipse cx="64" cy="56" rx="4" ry="2" fill="#FDA4AF" opacity="0.8" />
              <path d="M 28 38 C 30 20, 70 20, 72 38 Z" fill="#6D28D9" />
              <circle cx="41" cy="48" r="3" fill="#1E1B4B" />
              <circle cx="42" cy="47" r="1.2" fill="#FFFFFF" />
              <circle cx="59" cy="48" r="3" fill="#1E1B4B" />
              <circle cx="60" cy="47" r="1.2" fill="#FFFFFF" />
              <path d="M 44 59 Q 50 66 56 59" stroke="#991B1B" strokeWidth="2.2" strokeLinecap="round" fill="#DC2626" />
            </svg>
          )}
        </div>

        {/* Status Mini Dot Badge */}
        <span
          className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[8px] font-black ${
            role === 'companion' ? 'bg-pink-500 text-white' : 'bg-emerald-500 text-white'
          }`}
          title={role === 'companion' ? 'Companion en route' : 'Client waiting at venue'}
        >
          {role === 'companion' ? '🚶' : '📍'}
        </span>
      </div>

      {/* ─── FLOATING NAME & STATUS PILL ─── */}
      <div className="mt-1 flex flex-col items-center">
        <div className={`px-2.5 py-0.5 rounded-full ${badgeBg} shadow-md flex items-center gap-1 border border-white/50 text-center whitespace-nowrap`}>
          <span className="text-[11px] font-black tracking-wide truncate max-w-[120px]">
            {name}
          </span>
          {role === 'waiting_client' && (
            <span className="text-[10px] text-emerald-200 font-bold">Waiting ♥</span>
          )}
        </div>

        {sublabel && (
          <span className="text-[9px] font-bold text-slate-700 bg-white/90 px-2 py-0.5 rounded-md border border-slate-200 mt-0.5 shadow-xs whitespace-nowrap max-w-[140px] truncate">
            {sublabel}
          </span>
        )}
      </div>

      {/* ─── INLINE CSS KEYFRAMES FOR SMOOTH LOVE BUBBLES ─── */}
      <style>{`
        @keyframes pairupFloatLove1 {
          0% { transform: translateY(0) scale(0.6) rotate(-8deg); opacity: 0; }
          25% { opacity: 0.95; transform: translateY(-10px) scale(1) rotate(6deg); }
          65% { opacity: 0.8; transform: translateY(-24px) scale(1.15) rotate(-10deg); }
          100% { transform: translateY(-40px) scale(0.6) rotate(14deg); opacity: 0; }
        }
        @keyframes pairupFloatLove2 {
          0% { transform: translateY(0) scale(0.5) rotate(12deg); opacity: 0; }
          30% { opacity: 0.9; transform: translateY(-12px) scale(0.95) rotate(-8deg); }
          75% { opacity: 0.75; transform: translateY(-28px) scale(1.1) rotate(10deg); }
          100% { transform: translateY(-46px) scale(0.5) rotate(-12deg); opacity: 0; }
        }
        @keyframes pairupFloatLove3 {
          0% { transform: translateY(0) scale(0.4); opacity: 0; }
          35% { opacity: 0.85; transform: translateY(-14px) scale(0.85) rotate(8deg); }
          80% { opacity: 0.6; transform: translateY(-34px) scale(1) rotate(-6deg); }
          100% { transform: translateY(-52px) scale(0.4) rotate(16deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

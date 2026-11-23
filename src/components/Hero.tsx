import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Sparkles, Heart, Shield, Users, ArrowRight, UserCheck, Search, CreditCard, KeyRound, PhoneCall, CheckCircle } from 'lucide-react';

interface HeroProps {
  onExploreCompanions: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onExploreCompanions }) => {
  const { openAuthModal } = useAuth();
  const { t } = useLanguage();

  const handleCompanionCta = () => {
    // Exact requirement: Clicking the CTA opens the Companion Sign In/registration flow
    openAuthModal('signin');
  };

  return (
    <section className="relative overflow-hidden pt-10 pb-16 lg:pt-16 lg:pb-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Tasteful glowing ambient background elements (Pure CSS/SVG - zero network egress) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-pink-600/15 via-rose-500/10 to-sky-600/15 blur-[120px] rounded-full pointer-events-none -z-0" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Subtle trust kicker */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300 mb-6 backdrop-blur-sm shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{t.heroKicker || "India's Premier Verified Companion Network"}</span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400 font-bold">{t.heroFreeBadge || "Zero Platform Fee for Clients"}</span>
        </div>

        {/* Exact Headline: "Find Your Perfect Companion, Anytime, Anywhere." */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-100 leading-[1.15] mb-5">
          {t.heroHeadline || "Find Your Perfect Companion,"}{' '}
          <span className="bg-gradient-to-r from-amber-300 via-pink-400 to-sky-400 bg-clip-text text-transparent">
            {t.heroHeadlineHighlight || "Anytime, Anywhere."}
          </span>
        </h1>

        {/* Supporting description */}
        <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed font-normal">
          {t.heroSubheadline || "Connect with 100% government ID-verified companions for social events, travel, dining, and city exploration across India with secure escrow & OTP safety."}
        </p>

        {/* Main CTA Section */}
        <div className="flex flex-col items-center justify-center space-y-3">
          
          {/* Primary CTA: Explore Verified Companions */}
          <button
            onClick={onExploreCompanions}
            className="group relative inline-flex items-center justify-center gap-2.5 px-8 py-4 sm:px-10 sm:py-4.5 text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-950 rounded-2xl bg-amber-400 hover:bg-amber-300 shadow-xl shadow-amber-400/25 transition-all duration-300 hover:shadow-amber-400/40 hover:scale-[1.03] active:scale-95 cursor-pointer"
          >
            <span>{t.heroExploreButton || "Explore Verified Companions in your City →"}</span>
          </button>

          {/* Secondary Outline CTA: Join as a Companion */}
          <div className="pt-1">
            <button
              onClick={handleCompanionCta}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-300 hover:text-white py-2.5 px-6 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-slate-500 transition-all cursor-pointer"
            >
              <span>{t.heroCta || "Join as a Companion"}</span>
            </button>
          </div>

          {/* Supporting Text */}
          <p className="text-xs sm:text-sm text-slate-400 font-medium pt-1">
            {t.heroSupportingText || "Earn up to ₹1 Lakh/month on your own schedule with zero listing fees."}
          </p>
        </div>

        {/* 4-Step "How It Works" Horizontal Strip */}
        <div className="mt-12 pt-8 border-t border-slate-800/80">
          <div className="text-center mb-6">
            <h2 className="text-xs uppercase tracking-widest text-slate-400 font-bold">
              Simple &amp; Safe in 4 Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
            {/* Step 1 */}
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 font-bold text-xs shrink-0">
                  1
                </div>
                <div className="font-semibold text-slate-200 text-sm">Sign Up &amp; KYC</div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Quick 2-minute registration with phone OTP and government ID verification.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                  2
                </div>
                <div className="font-semibold text-slate-200 text-sm">Choose Service &amp; Companion</div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Filter across 35 categories by city, ratings, rates, and schedule.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xs shrink-0">
                  3
                </div>
                <div className="font-semibold text-slate-200 text-sm">Book &amp; Pay Securely</div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Funds are held in 48-hour escrow protection until completion.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                  4
                </div>
                <div className="font-semibold text-slate-200 text-sm">Meet Safely with OTP</div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dual Start &amp; Finish OTP verification ensures complete peace of mind.
              </p>
            </div>
          </div>
        </div>

        {/* Polished Trust Badges */}
        <div className="mt-8 pt-6 border-t border-slate-900/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/30">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">100% Verified KYC</div>
              <div className="text-[11px] text-slate-400">Govt ID &amp; Aadhaar checked</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/30">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">Start &amp; Finish OTP</div>
              <div className="text-[11px] text-slate-400">Dual cryptographic security</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/30">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">India 100 &amp; 112 SOS</div>
              <div className="text-[11px] text-slate-400">One-tap emergency alert</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/30">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">100% Platonic &amp; Safe</div>
              <div className="text-[11px] text-slate-400">Zero adult services tolerated</div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

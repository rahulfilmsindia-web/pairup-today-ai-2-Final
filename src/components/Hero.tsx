import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Heart, Shield, Users, ArrowRight } from 'lucide-react';

interface HeroProps {
  onExploreCompanions: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onExploreCompanions }) => {
  const { openAuthModal, isAuthenticated, activeRole } = useAuth();

  const handleCompanionCta = () => {
    // Exact requirement: Clicking the CTA must open the Companion Sign In/registration flow
    openAuthModal('signin');
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Tasteful, love-inspired glowing ambient background elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-pink-600/15 via-rose-500/10 to-sky-600/15 blur-[120px] rounded-full pointer-events-none -z-0" />
      
      {/* Floating subtle ambient heart geometry */}
      <div className="absolute top-16 left-10 md:left-24 opacity-20 pointer-events-none animate-pulse">
        <Heart className="w-16 h-16 text-pink-400 stroke-1" />
      </div>
      <div className="absolute bottom-20 right-10 md:right-32 opacity-15 pointer-events-none animate-pulse delay-700">
        <Heart className="w-20 h-20 text-sky-400 stroke-1" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Subtle trust kicker */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300 mb-8 backdrop-blur-sm shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Verified Social Companionship Across India</span>
          <span className="text-slate-600">|</span>
          <span className="text-pink-400 font-medium">100% Free for Clients</span>
        </div>

        {/* Exact Headline: "Find Your Perfect Companion, Anytime, Anywhere." */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-100 leading-[1.15] mb-6">
          Find Your Perfect Companion,{' '}
          <span className="bg-gradient-to-r from-amber-300 via-pink-400 to-sky-400 bg-clip-text text-transparent">
            Anytime, Anywhere.
          </span>
        </h1>

        {/* Supporting description */}
        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Whether you need a companion for a quiet café, shopping in the city, exploring cultural landmarks, or friendly conversation, PairUpToday connects you with verified individuals safely.
        </p>

        {/* Main CTA Section */}
        <div className="flex flex-col items-center justify-center space-y-4">
          
          {/* Main CTA with gentle zoom-in / zoom-out animation */}
          <button
            onClick={handleCompanionCta}
            className="group relative inline-flex items-center justify-center px-8 py-4 sm:px-10 sm:py-4 text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-950 rounded-xl bg-gradient-to-r from-amber-400 via-rose-400 to-sky-400 shadow-xl shadow-pink-500/25 transition-all duration-300 hover:shadow-pink-500/40 hover:scale-[1.03] active:scale-95 animate-[pulse_3s_ease-in-out_infinite]"
          >
            <span>YOUR TIME. YOUR CHOICE. YOUR EARNINGS. →</span>
          </button>

          {/* Exact Supporting Text: "Join PairUpToday as a Companion and earn on your own terms." */}
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Join PairUpToday as a Companion and earn on your own terms.
          </p>

          {/* Client Discover Button */}
          <div className="pt-4">
            <button
              onClick={onExploreCompanions}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-300 hover:text-amber-400 transition-colors py-2 px-4 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700"
            >
              <span>Explore Verified Companions in your City</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-14 pt-8 border-t border-slate-900/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">100% Verified KYC</div>
              <div className="text-[11px] text-slate-400">Govt ID & live selfie gate</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">Free Client Access</div>
              <div className="text-[11px] text-slate-400">No membership fees</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">Start & Finish OTP</div>
              <div className="text-[11px] text-slate-400">In-person meeting lock</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">India 100 & 112 SOS</div>
              <div className="text-[11px] text-slate-400">Emergency support hub</div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

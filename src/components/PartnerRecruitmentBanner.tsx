import React from 'react';
import { Sparkles, ShieldCheck, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

interface PartnerRecruitmentBannerProps {
  onJoinCompanion: () => void;
}

export const PartnerRecruitmentBanner: React.FC<PartnerRecruitmentBannerProps> = ({ onJoinCompanion }) => {
  return (
    <section className="relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-slate-900 via-purple-950/70 to-slate-900 border-y border-purple-500/20">
      {/* Decorative background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="max-w-2xl text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold mb-4 tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Partner Earning Program
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Become a Verified Companion —{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400">
              Earn Upto ₹1 Lakh/Month
            </span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
            Set your own hourly rates, choose your preferred services &amp; schedule, and keep up to 85% of your earnings with instant payouts, zero listing fees, and 100% KYC safety.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero Listing Fee</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>100% Verified Clients</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Direct Bank Transfer</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
          <button
            onClick={onJoinCompanion}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-base bg-gradient-to-r from-purple-600 via-rose-600 to-orange-500 hover:from-purple-500 hover:via-rose-500 hover:to-orange-400 shadow-xl shadow-purple-900/30 hover:shadow-purple-700/40 transform hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
          >
            <span>Join as a Companion</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};

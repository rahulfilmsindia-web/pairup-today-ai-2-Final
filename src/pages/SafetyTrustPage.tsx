import React from 'react';
import { Shield, KeyRound, CreditCard, MessageSquare, FileText, PhoneCall, AlertTriangle, ShieldCheck, HeartHandshake } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const SafetyTrustPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="py-12 lg:py-20 bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-4 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t.safetyBadge}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            {t.safetyTitle}
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {t.safetySubtitle}
          </p>
        </div>

        {/* The 6 Core Safety Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          
          {/* 1. Identity verification */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-2">
              {t.safetyPillar1Title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {t.safetyPillar1Desc}
            </p>
          </div>

          {/* 2. OTP-based meeting verification */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-2">
              {t.safetyPillar2Title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {t.safetyPillar2Desc}
            </p>
          </div>

          {/* 3. Secure escrow payments */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-sky-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-2">
              {t.safetyPillar3Title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {t.safetyPillar3Desc}
            </p>
          </div>

          {/* 4. In-app communication */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-pink-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mb-4">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-2">
              {t.safetyPillar4Title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {t.safetyPillar4Desc}
            </p>
          </div>

          {/* 5. Emergency SOS */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-rose-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-2">
              {t.safetyPillar5Title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {t.safetyPillar5Desc}
            </p>
          </div>

          {/* 6. Zero tolerance */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-2">
              {t.safetyPillar6Title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {t.safetyPillar6Desc}
            </p>
          </div>

        </div>

        {/* Community Guidelines */}
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/60 border border-slate-800 mb-12">
          <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            {t.safetyCommunityTitle}
          </h3>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>{t.safetyRule1}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>{t.safetyRule2}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>{t.safetyRule3}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>{t.safetyRule4}</span>
            </li>
          </ul>
        </div>

        {/* Emergency Assistance Hotline Banner */}
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-rose-950/40 border border-rose-500/30 mb-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-rose-400 mb-1 flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5" />
                {t.safetyEmergencyTitle}
              </div>
              <h4 className="text-lg font-bold text-slate-100">
                In case of any safety concern during an experience
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                {t.safetyEmergencyDesc}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <a
                href="tel:100"
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-sm shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
              >
                <span>Police: 100</span>
              </a>
              <a
                href="tel:112"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-sm shadow-lg shadow-amber-500/30 transition-all flex items-center gap-2"
              >
                <span>SOS: 112</span>
              </a>
            </div>
          </div>
        </div>

        {/* EXACT Tagline */}
        <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center">
          <div className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-amber-300 via-pink-400 to-sky-400 bg-clip-text text-transparent">
            PairUpToday — More Than Company. A Better Experience.
          </div>
        </div>

      </div>
    </div>
  );
};

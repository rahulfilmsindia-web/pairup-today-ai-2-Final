import React from 'react';
import { ShieldCheck, Scale, FileText, AlertCircle, HeartHandshake, UserCheck, CreditCard, Lock, RotateCcw, Clock, Mail } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const TermsPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="py-12 lg:py-20 bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 text-pink-400 text-xs font-semibold mb-4 border border-pink-500/20">
            <FileText className="w-3.5 h-3.5" />
            {t.termsBadge}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            {t.termsTitle}
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            {t.termsLastUpdated}
          </p>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mx-auto mt-4 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            {t.termsIntro}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">

          {/* Section 1 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-pink-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                {t.termsSec1Title}
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-pink-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec1P1Title}</strong> {t.termsSec1P1Desc}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec1P2Title}</strong> {t.termsSec1P2Desc}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec1P3Title}</strong> {t.termsSec1P3Desc}</span>
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                {t.termsSec2Title}
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec2P1Title}</strong> {t.termsSec2P1Desc}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec2P2Title}</strong> {t.termsSec2P2Desc}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec2P3Title}</strong> {t.termsSec2P3Desc}</span>
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                {t.termsSec3Title}
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec3P1Title}</strong> {t.termsSec3P1Desc}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec3P2Title}</strong> {t.termsSec3P2Desc}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec3P3Title}</strong> {t.termsSec3P3Desc}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec3P4Title}</strong> {t.termsSec3P4Desc}</span>
              </li>
            </ul>
          </div>

          {/* Section 4 - Refund & Cancellation Policy */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-rose-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                {t.termsSec4Title}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
              {t.termsSec4Intro}
            </p>
            <ul className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              {/* Client Cancellation Rules & Slabs */}
              <li className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span><strong className="text-slate-100">{t.termsSec4ClientTitle}</strong> {t.termsSec4ClientDesc}</span>
                </div>
                <div className="ml-6 space-y-1.5 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>{t.termsSec4Slab1}</span>
                  </div>
                  <div className="flex items-center gap-2 text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>{t.termsSec4Slab2}</span>
                  </div>
                  <div className="flex items-center gap-2 text-rose-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    <span>{t.termsSec4Slab3}</span>
                  </div>
                </div>
              </li>

              {/* Client No-Show */}
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec4NoShowClientTitle}</strong> {t.termsSec4NoShowClientDesc}</span>
              </li>

              {/* Companion No-Show */}
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <div>
                  <strong className="text-slate-100">{t.termsSec4NoShowCompTitle}</strong> {t.termsSec4NoShowCompDesc}
                  <ol className="list-decimal list-inside ml-4 mt-1.5 space-y-1 text-slate-300">
                    <li>{t.termsSec4NoShowCompItem1}</li>
                    <li>{t.termsSec4NoShowCompItem2}</li>
                  </ol>
                </div>
              </li>

              {/* Early Departure */}
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec4EarlyEndTitle}</strong> {t.termsSec4EarlyEndDesc}</span>
              </li>

              {/* Technical Errors */}
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec4TechErrorsTitle}</strong> {t.termsSec4TechErrorsDesc}</span>
              </li>

              {/* Refund Timelines */}
              <li className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span><strong className="text-slate-100">{t.termsSec4TimelinesTitle}</strong> {t.termsSec4TimelinesDesc}</span>
                </div>
                <div className="ml-6 space-y-1.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                  <div className="text-slate-300">• {t.termsSec4TimelineUpi}</div>
                  <div className="text-slate-300">• {t.termsSec4TimelineNb}</div>
                  <div className="text-slate-300">• {t.termsSec4TimelineCards}</div>
                </div>
              </li>

              {/* Non-Refundable Items */}
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec4NonRefundTitle}</strong> {t.termsSec4NonRefundDesc}</span>
              </li>

              {/* Contact for Support */}
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec4SupportTitle}</strong> {t.termsSec4SupportDesc}</span>
              </li>
            </ul>
          </div>

          {/* Section 5 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-sky-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                {t.termsSec5Title}
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec5P1Title}</strong> {t.termsSec5P1Desc}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec5P2Title}</strong> {t.termsSec5P2Desc}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec5P3Title}</strong> {t.termsSec5P3Desc}</span>
              </li>
            </ul>
          </div>

          {/* Section 6 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                {t.termsSec6Title}
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec6P1Title}</strong> {t.termsSec6P1Desc}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec6P2Title}</strong> {t.termsSec6P2Desc}</span>
              </li>
            </ul>
          </div>

          {/* Section 7 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                {t.termsSec7Title}
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec7P1Title}</strong> {t.termsSec7P1Desc}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong className="text-slate-100">{t.termsSec7P2Title}</strong> {t.termsSec7P2Desc}</span>
              </li>
            </ul>
          </div>

          {/* Section 8 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-amber-400/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                {t.termsSec8Title}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              {t.termsSec8Desc}
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};

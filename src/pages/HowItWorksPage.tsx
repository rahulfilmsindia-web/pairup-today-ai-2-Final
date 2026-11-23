import React, { useState } from 'react';
import { UserCheck, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface HowItWorksPageProps {
  onRegisterClient: () => void;
  onRegisterCompanion: () => void;
}

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({
  onRegisterClient,
  onRegisterCompanion
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'client' | 'companion'>('client');

  const clientSteps = [
    {
      num: 1,
      title: t.hiwStep1ClientTitle,
      desc: t.hiwStep1ClientDesc
    },
    {
      num: 2,
      title: t.hiwStep2ClientTitle,
      desc: t.hiwStep2ClientDesc
    },
    {
      num: 3,
      title: t.hiwStep3ClientTitle,
      desc: t.hiwStep3ClientDesc
    },
    {
      num: 4,
      title: t.hiwStep4ClientTitle,
      desc: t.hiwStep4ClientDesc
    },
    {
      num: 5,
      title: t.hiwStep5ClientTitle,
      desc: t.hiwStep5ClientDesc
    },
    {
      num: 6,
      title: t.hiwStep6ClientTitle,
      desc: t.hiwStep6ClientDesc
    },
    {
      num: 7,
      title: t.hiwStep7ClientTitle,
      desc: t.hiwStep7ClientDesc
    }
  ];

  const companionSteps = [
    {
      num: 1,
      title: t.hiwStep1CompTitle,
      desc: t.hiwStep1CompDesc
    },
    {
      num: 2,
      title: t.hiwStep2CompTitle,
      desc: t.hiwStep2CompDesc
    },
    {
      num: 3,
      title: t.hiwStep3CompTitle,
      desc: t.hiwStep3CompDesc
    },
    {
      num: 4,
      title: t.hiwStep4CompTitle,
      desc: t.hiwStep4CompDesc
    },
    {
      num: 5,
      title: t.hiwStep5CompTitle,
      desc: t.hiwStep5CompDesc
    },
    {
      num: 6,
      title: t.hiwStep6CompTitle,
      desc: t.hiwStep6CompDesc
    }
  ];

  return (
    <div className="py-12 lg:py-20 bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* EXACT Heading & Intro */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 text-xs font-semibold mb-4 border border-amber-400/20">
            {t.hiwBadge}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            {t.hiwTitle}
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {t.hiwSubtitle}
          </p>
        </div>

        {/* Tab switch between Client and Companion */}
        <div className="flex items-center justify-center mb-12">
          <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 flex gap-2">
            <button
              onClick={() => setActiveTab('client')}
              className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'client'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.hiwTabClient}
            </button>
            <button
              onClick={() => setActiveTab('companion')}
              className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'companion'
                  ? 'bg-pink-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.hiwTabCompanion}
            </button>
          </div>
        </div>

        {/* A. How It Works for Clients */}
        {activeTab === 'client' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-amber-300">
                  {t.hiwClientStepsTitle}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {t.hiwClientStepsDesc}
                </p>
              </div>
              <button
                onClick={onRegisterClient}
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all"
              >
                {t.hiwClientCta}
              </button>
            </div>

            <div className="space-y-4">
              {clientSteps.map(step => (
                <div
                  key={step.num}
                  className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-4 hover:border-amber-400/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 font-bold flex items-center justify-center shrink-0 text-sm">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 mb-1">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* EXACT Client Tagline */}
            <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-amber-950/20 via-slate-900 to-amber-950/20 border border-amber-500/20 text-center">
              <span className="text-base sm:text-lg font-bold text-amber-300 tracking-wide">
                {t.hiwClientTagline}
              </span>
            </div>
          </div>
        )}

        {/* B. How It Works for Companions */}
        {activeTab === 'companion' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-pink-400">
                  {t.hiwCompanionStepsTitle}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {t.hiwCompanionStepsDesc}
                </p>
              </div>
              <button
                onClick={onRegisterCompanion}
                className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-slate-950 text-xs font-bold transition-all"
              >
                {t.hiwCompanionCta}
              </button>
            </div>

            <div className="space-y-4">
              {companionSteps.map(step => (
                <div
                  key={step.num}
                  className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-4 hover:border-pink-500/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400 font-bold flex items-center justify-center shrink-0 text-sm">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 mb-1">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* EXACT Companion Tagline */}
            <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-pink-950/20 via-slate-900 to-pink-950/20 border border-pink-500/20 text-center">
              <span className="text-base sm:text-lg font-bold text-pink-400 tracking-wide">
                {t.hiwCompanionTagline}
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

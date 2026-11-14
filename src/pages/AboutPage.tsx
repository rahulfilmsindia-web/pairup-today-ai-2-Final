import React from 'react';
import { Heart, Compass, Shield, Users, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface AboutPageProps {
  onExplore: () => void;
  onJoinCompanion: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onExplore, onJoinCompanion }) => {
  const { t } = useLanguage();

  return (
    <div className="py-12 lg:py-20 bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* EXACT Heading & Subheading */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 text-xs font-semibold mb-4 border border-amber-400/20">
            {t.aboutBadge}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            {t.aboutTitle}
          </h1>
          <p className="text-lg sm:text-xl font-medium text-pink-400">
            {t.aboutTagline}
          </p>
        </div>

        {/* EXACT Body Text */}
        <div className="prose prose-invert max-w-none space-y-6 text-slate-300 text-base sm:text-lg leading-relaxed bg-slate-900/50 p-6 sm:p-10 rounded-2xl border border-slate-800 shadow-xl">
          <p>
            {t.aboutP1}
          </p>
          <p>
            {t.aboutP2}
          </p>
          <p>
            {t.aboutP3}
          </p>
        </div>

        {/* Our Mission */}
        <div className="mt-12 bg-slate-900/40 p-6 sm:p-8 rounded-2xl border border-slate-800">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-3 mb-4">
            <Compass className="w-6 h-6 text-sky-400" />
            {t.aboutMissionTitle}
          </h2>
          <p className="text-slate-300 leading-relaxed">
            {t.aboutMissionText}
          </p>
        </div>

        {/* What We Offer */}
        <div className="mt-12">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6 flex items-center gap-3">
            <Heart className="w-6 h-6 text-pink-400" />
            {t.aboutOfferTitle}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-amber-300 mb-2">{t.aboutOffer1Title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {t.aboutOffer1Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-sky-300 mb-2">{t.aboutOffer2Title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {t.aboutOffer2Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-emerald-300 mb-2">{t.aboutOffer3Title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {t.aboutOffer3Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-purple-300 mb-2">{t.aboutOffer4Title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {t.aboutOffer4Desc}
              </p>
            </div>
          </div>
        </div>

        {/* Our Values */}
        <div className="mt-12">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6 flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-400" />
            {t.aboutValuesTitle}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-emerald-300 mb-2">{t.aboutVal1Title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {t.aboutVal1Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-amber-300 mb-2">{t.aboutVal2Title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {t.aboutVal2Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-sky-300 mb-2">{t.aboutVal3Title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {t.aboutVal3Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-purple-300 mb-2">{t.aboutVal4Title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {t.aboutVal4Desc}
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-14 p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-pink-950/20 to-slate-900 border border-pink-500/20 text-center">
          <h2 className="text-2xl font-extrabold text-slate-100 mb-2">
            {t.aboutCtaTitle}
          </h2>
          <p className="text-slate-300 text-sm max-w-xl mx-auto mb-6">
            {t.aboutCtaDesc}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onExplore}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>{t.aboutExploreBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onJoinCompanion}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm shadow-lg shadow-pink-600/20 transition-all"
            >
              {t.aboutJoinBtn}
            </button>
          </div>

          <div className="pt-6 mt-8 border-t border-slate-800 text-base sm:text-lg font-bold bg-gradient-to-r from-amber-300 via-pink-400 to-sky-400 bg-clip-text text-transparent">
            PairUpToday — Your Time. Your Choice. Your Companion.
          </div>
        </div>

      </div>
    </div>
  );
};

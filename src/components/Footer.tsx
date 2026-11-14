import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheck, PhoneCall, Heart, Mail, Copy, Check } from 'lucide-react';
import { openExternalUrl, openMailtoUri, copyTextToClipboard } from '../utils/crossPlatform';

interface FooterProps {
  setCurrentPage: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ setCurrentPage }) => {
  const { t } = useLanguage();
  const [copiedEmail, setCopiedEmail] = useState(false);

  const officialFacebookUrl = 'https://www.facebook.com/share/1FEG5wvcBF/';
  const officialInstagramUrl = 'https://www.instagram.com/pairuptoday?exln=MXBtNXhreTBnMWhuNA==';
  const officialEmail = 'pairuptoday@gmail.com';

  const handleFacebookClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    openExternalUrl(officialFacebookUrl);
  };

  const handleInstagramClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    openExternalUrl(officialInstagramUrl);
  };

  const handleEmailClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    openMailtoUri(officialEmail);
  };

  const handleCopyEmail = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const success = await copyTextToClipboard(officialEmail);
    if (success) {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  };

  return (
    <footer className="w-full bg-slate-950 border-t border-slate-900 text-slate-400 text-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8 mb-5 sm:mb-6">
          
          {/* Brand info */}
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-center gap-3">
              <img
                src="/assets/aistudio/image_AIIEuv.png_bc62f6e1.png"
                alt="PairUpToday Logo"
                className="w-10 h-10 rounded-full object-cover ring-1 ring-amber-400/50"
              />
              <span className="text-lg font-bold text-slate-100 tracking-tight">
                PairUpToday
              </span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm max-w-md leading-relaxed">
              {t.footerMission}
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>{t.securityBranding}</span>
            </div>
          </div>

          {/* Quick Platform Links */}
          <div className="space-y-2.5">
            <h4 className="text-xs uppercase font-semibold tracking-wider text-slate-300">
              {t.footerPlatformNav}
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <button
                  onClick={() => setCurrentPage('about')}
                  className="hover:text-amber-400 transition-colors"
                >
                  {t.navAbout}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('how-it-works')}
                  className="hover:text-amber-400 transition-colors"
                >
                  {t.navHowItWorks}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('safety-trust')}
                  className="hover:text-amber-400 transition-colors"
                >
                  {t.navSafetyTrust}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('terms')}
                  className="hover:text-amber-400 transition-colors"
                >
                  {t.navTerms}
                </button>
              </li>
            </ul>
          </div>

          {/* Contact With Us */}
          <div className="space-y-2.5">
            <h4 className="text-xs uppercase font-semibold tracking-wider text-slate-300">
              {t.footerContactWithUs}
            </h4>
            <ul className="space-y-2 text-xs">
              {/* Facebook Link */}
              <li>
                <a
                  href={officialFacebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleFacebookClick}
                  className="flex items-center gap-2 text-slate-300 hover:text-amber-400 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 rounded py-0.5 group"
                  aria-label="Facebook page of PairUpToday"
                >
                  <svg className="w-4 h-4 fill-current text-blue-500 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span>{t.footerFacebookLabel}</span>
                </a>
              </li>

              {/* Instagram Link */}
              <li>
                <a
                  href={officialInstagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleInstagramClick}
                  className="flex items-center gap-2 text-slate-300 hover:text-amber-400 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 rounded py-0.5 group"
                  aria-label="Instagram profile of PairUpToday"
                >
                  <svg className="w-4 h-4 fill-current text-pink-500 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <span>{t.footerInstagramLabel}</span>
                </a>
              </li>

              {/* Email Composition Link with Graceful Copy Fallback */}
              <li>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <a
                    href="mailto:pairuptoday@gmail.com"
                    onClick={handleEmailClick}
                    className="flex items-center gap-2 text-slate-300 hover:text-amber-400 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 rounded py-0.5 group"
                    aria-label={`Send email to ${officialEmail}`}
                  >
                    <Mail className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="font-mono text-[11px]">{officialEmail}</span>
                  </a>

                  {/* One-click copy fallback button */}
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-400/40 transition-colors text-[10px] flex items-center gap-1"
                    title={t.footerCopyEmail}
                    aria-label={t.footerCopyEmail}
                  >
                    {copiedEmail ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {/* Copied visual feedback toast */}
                {copiedEmail && (
                  <div className="mt-1 text-[10px] text-emerald-400 font-medium animate-fade-in flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>{t.footerEmailCopied}</span>
                  </div>
                )}
              </li>
            </ul>
          </div>

          {/* Emergency Information */}
          <div className="space-y-2.5">
            <h4 className="text-xs uppercase font-semibold tracking-wider text-slate-300 flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
              {t.footerEmergencyAssistance}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              India-wide emergency and safety escalation hotlines:
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-slate-300">{t.footerPoliceEmergency}</span>
                <span className="font-mono font-bold text-rose-400">100</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-slate-300">{t.footerNationalSos}</span>
                <span className="font-mono font-bold text-amber-400">112</span>
              </div>
            </div>
          </div>

        </div>

        <div className="pt-4 sm:pt-5 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>{t.footerRights}</p>
          <div className="flex items-center gap-1 text-slate-400">
            <span>{t.footerBuiltWithLove}</span>
            <Heart className="w-3 h-3 text-pink-500 fill-pink-500 inline ml-1" />
          </div>
        </div>
      </div>
    </footer>
  );
};

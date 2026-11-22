import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Language } from '../types';
import { Globe, User, LogOut, ChevronDown, Menu, X, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPage, setCurrentPage }) => {
  const { language, setLanguage, t } = useLanguage();
  const { isAuthenticated, activeRole, openAuthModal, logout, selectActiveRole } = useAuth();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const languages: { code: Language; label: string }[] = [
    { code: 'en', label: 'English (EN)' },
    { code: 'bn', label: 'বাংলা (BN)' },
    { code: 'hi', label: 'हिन्दी (HI)' }
  ];

  const handleNavClick = (page: string) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
  };

  const handleRoleSwitch = () => {
    const nextRole = activeRole === 'COMPANION' ? 'CLIENT' : 'COMPANION';
    const targetPage = nextRole === 'COMPANION' ? 'companion-dashboard' : 'client-dashboard';
    // 1. Instant 0ms navigation
    handleNavClick(targetPage);
    // 2. Background role sync
    selectActiveRole(nextRole).catch(() => {});
  };

  const handleBack = () => {
    // 1. Dispatch custom event so inner dashboards can close modals or return to overview first
    const backEvent = new CustomEvent('pairup:inapp_back', { cancelable: true });
    const notHandled = window.dispatchEvent(backEvent);
    if (!notHandled) {
      return; // Handled by inner dashboard
    }

    // 2. If on an inner page, safely return to home page without closing app
    if (currentPage !== 'home') {
      setCurrentPage('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (window.history.length > 1) {
      window.history.back();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Left Side: Back button (if on inner page) + Logo + PairUpToday */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentPage !== 'home' && (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-xs font-bold shadow-sm active:scale-95"
              title="Go back to previous page"
              aria-label="Back to previous page"
            >
              <ArrowLeft className="w-4 h-4 text-pink-400" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}

          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleNavClick('home')}>
            {/* 1. Exact uploaded PairUpToday Logo */}
            <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden ring-2 ring-amber-400/60 shadow-lg shadow-pink-500/20 transition-transform group-hover:scale-105 shrink-0">
              <img
                src="/assets/aistudio/image_AIIEuv.png_bc62f6e1.png"
                alt="PairUpToday Logo"
                className="w-full h-full object-cover"
              />
            </div>

            {/* 2. PairUpToday Brand Name & Tagline */}
            <div className="flex flex-col justify-center min-w-0">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-pink-400 to-sky-400 bg-clip-text text-transparent leading-none">
                {t.navPairUpToday}
              </span>
              <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium mt-1 whitespace-nowrap hidden sm:block">
                Connect · Match · Belong
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links (Items 3 to 8 in exact order) */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          
          {/* 3. About */}
          <button
            onClick={() => handleNavClick('about')}
            className={`transition-colors hover:text-amber-400 ${
              currentPage === 'about' ? 'text-amber-400 font-semibold' : 'text-slate-300'
            }`}
          >
            {t.navAbout}
          </button>

          {/* 4. How It Works */}
          <button
            onClick={() => handleNavClick('how-it-works')}
            className={`transition-colors hover:text-amber-400 ${
              currentPage === 'how-it-works' ? 'text-amber-400 font-semibold' : 'text-slate-300'
            }`}
          >
            {t.navHowItWorks}
          </button>

          {/* 5. Safety & Trust */}
          <button
            onClick={() => handleNavClick('safety-trust')}
            className={`transition-colors hover:text-amber-400 ${
              currentPage === 'safety-trust' ? 'text-amber-400 font-semibold' : 'text-slate-300'
            }`}
          >
            {t.navSafetyTrust}
          </button>

          {/* Terms of Service */}
          <button
            onClick={() => handleNavClick('terms')}
            className={`transition-colors hover:text-amber-400 ${
              currentPage === 'terms' ? 'text-amber-400 font-semibold' : 'text-slate-300'
            }`}
          >
            {t.navTerms}
          </button>

          {/* 6. Language Selector */}
          <div className="relative">
            <button
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors"
              aria-label={t.navLanguage}
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>{languages.find(l => l.code === language)?.label.split(' ')[0]}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {langDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1 z-50">
                {languages.map(l => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLanguage(l.code);
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-slate-800 ${
                      language === l.code ? 'text-amber-400 font-semibold bg-slate-800/50' : 'text-slate-300'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* If NOT authenticated: Unified Sign In Button */}
          {!isAuthenticated ? (
            <button
              onClick={() => openAuthModal('login')}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 via-rose-500 to-sky-500 hover:from-amber-600 hover:to-sky-600 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] cursor-pointer"
            >
              {t.navSignIn || 'Sign In'}
            </button>
          ) : (
            /* When authenticated, preserve gateway access + direct dashboard & role status */
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNavClick(activeRole === 'COMPANION' ? 'companion-dashboard' : 'client-dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 font-semibold border border-slate-700 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>{activeRole === 'COMPANION' ? t.navCompanionBadge : t.navClientBadge}</span>
              </button>

              <button
                onClick={handleRoleSwitch}
                title={activeRole === 'COMPANION' ? t.navSwitchToClient : t.navSwitchToCompanion}
                className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                {activeRole === 'COMPANION' ? t.navSwitchToClient : t.navSwitchToCompanion}
              </button>

              <button
                onClick={() => {
                  logout();
                  setCurrentPage('home');
                  if (window.location.pathname !== '/') {
                    window.history.pushState({}, '', '/');
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                title={t.navLogout}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </nav>

        {/* Mobile menu toggle button */}
        <div className="flex md:hidden items-center gap-2">
          {/* Quick language toggle */}
          <button
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            className="p-2 text-slate-300 hover:text-white"
            aria-label={t.navLanguage}
          >
            <Globe className="w-5 h-5 text-sky-400" />
          </button>
          
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-white focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer (Strictly in the exact 8 item order) */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-3 pb-6 space-y-3">
          {currentPage !== 'home' && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleBack();
              }}
              className="w-full text-left py-2.5 px-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-pink-400 text-xs font-bold flex items-center gap-2 transition-colors mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Previous Page</span>
            </button>
          )}

          <button
            onClick={() => handleNavClick('home')}
            className="w-full text-left py-2.5 text-slate-300 hover:text-amber-400 text-sm font-semibold transition-colors"
          >
            {t.navPairUpToday}
          </button>

          <button
            onClick={() => handleNavClick('about')}
            className="w-full text-left py-2.5 text-slate-300 hover:text-amber-400 text-sm font-semibold transition-colors"
          >
            {t.navAbout}
          </button>

          <button
            onClick={() => handleNavClick('how-it-works')}
            className="w-full text-left py-2.5 text-slate-300 hover:text-amber-400 text-sm font-semibold transition-colors"
          >
            {t.navHowItWorks}
          </button>

          <button
            onClick={() => handleNavClick('safety-trust')}
            className="w-full text-left py-2.5 text-slate-300 hover:text-amber-400 text-sm font-semibold transition-colors"
          >
            {t.navSafetyTrust}
          </button>

          <button
            onClick={() => handleNavClick('terms')}
            className="w-full text-left py-2.5 text-slate-300 hover:text-amber-400 text-sm font-semibold transition-colors"
          >
            {t.navTerms}
          </button>

          <div className="py-2 border-y border-slate-800/80">
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">{t.navLanguage}</label>
            <div className="flex gap-2">
              {languages.map(l => (
                <button
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className={`px-3 py-1.5 text-xs rounded-lg border min-h-[36px] transition-colors ${
                    language === l.code
                      ? 'border-amber-400 text-amber-400 bg-amber-400/10 font-bold'
                      : 'border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {l.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {!isAuthenticated ? (
            <div className="pt-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal('login');
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-sky-500 text-slate-950 text-sm font-bold text-center shadow-lg transition-all min-h-[44px]"
              >
                {t.navSignIn || 'Sign In'}
              </button>
            </div>
          ) : (
            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleNavClick(activeRole === 'COMPANION' ? 'companion-dashboard' : 'client-dashboard');
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 text-slate-950 font-bold text-xs min-h-[44px]"
              >
                {t.navDashboard} ({activeRole === 'COMPANION' ? t.navCompanionBadge : t.navClientBadge})
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleRoleSwitch();
                }}
                className="w-full py-2.5 rounded-xl border border-slate-700 text-amber-300 font-semibold text-xs min-h-[40px] hover:bg-slate-800"
              >
                {activeRole === 'COMPANION' ? t.navSwitchToClient : t.navSwitchToCompanion}
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                  setCurrentPage('home');
                  if (window.location.pathname !== '/') {
                    window.history.pushState({}, '', '/');
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-rose-400 text-xs min-h-[40px]"
              >
                {t.navLogout}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

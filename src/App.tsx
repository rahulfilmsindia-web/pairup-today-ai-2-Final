import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { ServicesGrid } from './components/ServicesGrid';
import { AboutPage } from './pages/AboutPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { SafetyTrustPage } from './pages/SafetyTrustPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { RefundPolicyPage } from './pages/RefundPolicyPage';
import { ClientDashboard } from './pages/ClientDashboard';
import { CompanionDashboard } from './pages/CompanionDashboard';
import { AuthGatewayModal } from './pages/AuthGatewayModal';
import { KycWizardModal } from './pages/KycWizardModal';
import { RoleSelectionModal } from './pages/RoleSelectionModal';
import { AdminPortal } from './admin/AdminPortal';
import { ServiceItem } from './constants/services';
import { CompanionListing } from './components/CompanionListing';
import { PartnerRecruitmentBanner } from './components/PartnerRecruitmentBanner';
import { TrustReviewsAndFaq } from './components/TrustReviewsAndFaq';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalCompanionAlertManager } from './components/GlobalCompanionAlertManager';
import { apiFetch } from './utils/api';
import { AlertTriangle, PowerOff, Loader2, ShieldAlert, Compass, CalendarCheck, Gift, User } from 'lucide-react';
import { captureReferralFromUrl } from './services/referralService';

const pageToPath = (page: string): string => {
  switch (page) {
    case 'about': return '/about';
    case 'how-it-works': return '/how-it-works';
    case 'safety-trust': return '/safety-trust';
    case 'terms': return '/terms';
    case 'privacy': return '/privacy';
    case 'refund-cancellation': return '/refund-cancellation';
    case 'client-dashboard': return '/client-dashboard';
    case 'companion-dashboard': return '/companion-dashboard';
    case 'admin': return '/admin';
    case 'home':
    default:
      return '/';
  }
};

const pathToPage = (pathname: string): string => {
  const clean = pathname.toLowerCase().replace(/\/$/, '') || '/';
  switch (clean) {
    case '/about': return 'about';
    case '/how-it-works': return 'how-it-works';
    case '/safety-trust': return 'safety-trust';
    case '/terms':
    case '/terms-of-service': return 'terms';
    case '/privacy':
    case '/privacy-policy': return 'privacy';
    case '/refund':
    case '/refund-policy':
    case '/refund-cancellation': return 'refund-cancellation';
    case '/client-dashboard': return 'client-dashboard';
    case '/companion-dashboard': return 'companion-dashboard';
    case '/admin': return 'admin';
    case '/':
    default:
      return 'home';
  }
};

const getInitialPage = (): string => {
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  if (host.startsWith('admin.') || path === '/admin' || search.includes('admin=true')) {
    return 'admin';
  }
  return pathToPage(path);
};

const MainAppContent: React.FC = () => {
  const { user, activeRole, openAuthModal, selectActiveRole, logout } = useAuth();
  const { language, t } = useLanguage();
  const isNative = Capacitor.isNativePlatform();
  const [nativeActiveTab, setNativeActiveTab] = useState<'explore' | 'bookings' | 'referrals' | 'profile'>('explore');

  // Auto-capture ?ref= URL parameter into localStorage on initial load
  useEffect(() => {
    captureReferralFromUrl();
  }, []);
  
  const [currentPage, setCurrentPageState] = useState<string>(() => {
    const init = getInitialPage();
    return init === 'admin' ? 'home' : init;
  });

  const [activeServiceFilter, setActiveServiceFilter] = useState<number | null>(null);
  
  const [isAdminHostMode, setIsAdminHostMode] = useState<boolean>(() => {
    return getInitialPage() === 'admin';
  });

  // Navigation interceptor & offline confirmation state for Companion Dashboard
  const [pendingTargetPage, setPendingTargetPage] = useState<string | null>(null);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState<boolean>(false);
  const [showActiveBookingBlockAlert, setShowActiveBookingBlockAlert] = useState<boolean>(false);
  const [isProcessingExit, setIsProcessingExit] = useState<boolean>(false);

  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Check if an active booking is in progress
  const checkHasActiveBooking = async (): Promise<boolean> => {
    if (localStorage.getItem('pairup_has_active_booking') === 'true') {
      return true;
    }
    if (userRef.current?.id) {
      try {
        const res = await apiFetch(`/api/bookings/my/${userRef.current.id}`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.bookings) ? data.bookings : [];
          const hasActive = list.some((b: any) =>
            b.companionId === userRef.current?.id &&
            ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(b.status) &&
            b.status !== 'CANCELLED' && b.status !== 'COMPLETED'
          );
          if (hasActive) {
            localStorage.setItem('pairup_has_active_booking', 'true');
            return true;
          }
        }
      } catch {}
    }
    return false;
  };

  // Check if companion is currently live and active online (instant local check with optional background verification)
  const checkIsCompanionOnline = async (forceNetwork = false): Promise<boolean> => {
    if (!userRef.current?.id) return false;
    const local = localStorage.getItem('pairup_companion_online');
    if (!forceNetwork) {
      return local === 'true';
    }
    try {
      const res = await apiFetch(`/api/companion/status/${userRef.current.id}`);
      if (res.ok) {
        const data = await res.json();
        const live = Boolean(data.isLive && !data.profile?.isPaused);
        localStorage.setItem('pairup_companion_online', live ? 'true' : 'false');
        return live;
      }
    } catch (e) {
      console.warn('Online status verification error:', e);
    }
    return local === 'true';
  };

  // Base navigation executor
  const executeNavigation = (targetPage: string, options?: { replace?: boolean }) => {
    if (targetPage === 'admin') {
      setIsAdminHostMode(true);
      if (options?.replace) {
        window.history.replaceState({ page: 'admin' }, '', '/admin');
      } else {
        window.history.pushState({ page: 'admin' }, '', '/admin');
      }
      return;
    }

    setIsAdminHostMode(false);
    const targetPath = pageToPath(targetPage);

    // If already on the target page and path matches, do not create duplicate history entries
    if (targetPage === currentPage && window.location.pathname === targetPath && !options?.replace) {
      return;
    }

    if (options?.replace) {
      window.history.replaceState({ page: targetPage }, '', targetPath);
    } else {
      window.history.pushState({ page: targetPage }, '', targetPath);
    }

    setCurrentPageState(targetPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Centralized navigation handler with smart companion exit gate
  const navigateToPage = async (targetPage: string, options?: { replace?: boolean }) => {
    // If user is currently on companion-dashboard and trying to navigate to any other page
    if (currentPage === 'companion-dashboard' && targetPage !== 'companion-dashboard' && user) {
      const hasActive = await checkHasActiveBooking();
      if (hasActive) {
        setShowActiveBookingBlockAlert(true);
        return;
      }

      // User Requirement: If companion attempts to go to the HOME page:
      if (targetPage === 'home') {
        const isOnline = await checkIsCompanionOnline();
        if (isOnline) {
          const confirmOnlineExit = window.confirm(
            language === 'bn'
              ? '⚠️ আপনি বর্তমানে অনলাইনে আছেন!\n\nহোমপেজে যেতে হলে প্রথমে অফলাইন ও লগআউট করতে হবে।\n\nঅফলাইন ও লগআউট হয়ে হোমপেজে যেতে "OK" ক্লিক করুন, অথবা ড্যাশবোর্ডে থাকতে "Cancel" ক্লিক করুন।'
              : language === 'hi'
              ? '⚠️ आप वर्तमान में ऑनलाइन हैं!\n\nहोमपेज पर जाने के लिए पहले ऑफलाइन होना और लॉगआउट करना होगा।\n\nलॉगआउट होकर होमपेज पर जाने के लिए "OK" पर क्लिक करें या डैशबोर्ड पर बने रहने के लिए "Cancel" करें।'
              : '⚠️ You are currently ONLINE.\n\nYou must go OFFLINE and LOG OUT before visiting the Home page.\n\nClick "OK" to go offline, log out, and return to Home; or click "Cancel" to stay on your Dashboard.'
          );
          if (!confirmOnlineExit) return;

          try {
            await apiFetch('/api/companion/availability/toggle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, isPaused: true })
            });
            localStorage.setItem('pairup_companion_online', 'false');
          } catch (e) {
            console.warn('Auto offline error', e);
          }

          logout();
          executeNavigation('home', options);
          return;
        } else {
          // If companion is already OFFLINE:
          const confirmOfflineExit = window.confirm(
            language === 'bn'
              ? 'বিজ্ঞপ্তি: আপনি কম্প্যানিয়ন অ্যাকাউন্টে লগইন অবস্থায় আছেন।\n\nহোমপেজে যেতে হলে প্রথমে লগআউট করতে হবে।\n\nলগআউট করে হোমপেজে যেতে "OK" ক্লিক করুন, অথবা ড্যাশবোর্ডে থাকতে "Cancel" ক্লিক করুন।'
              : language === 'hi'
              ? 'सूचना: आप अपने कंपैनियन खाते में लॉग इन हैं।\n\nहोमपेज पर जाने के लिए पहले लॉगआउट करना होगा।\n\nलॉगआउट करके होमपेज पर जाने के लिए "OK" पर क्लिक करें, या डैशबोर्ड पर बने रहने के लिए "Cancel" करें।'
              : 'Notice: You are logged into your Companion account.\n\nYou must log out before visiting the Home page.\n\nClick "OK" to log out and go to Home, or click "Cancel" to stay on your Dashboard.'
          );
          if (!confirmOfflineExit) return;

          logout();
          executeNavigation('home', options);
          return;
        }
      }

      const isOnline = localStorage.getItem('pairup_companion_online') === 'true';
      if (isOnline) {
        // ONLY prompt confirmation if companion is currently ONLINE!
        setPendingTargetPage(targetPage);
        setShowExitConfirmModal(true);
        return;
      }

      // If companion is already OFFLINE, directly switch role to CLIENT and navigate without popup!
      if (targetPage === 'client-dashboard') {
        selectActiveRole('CLIENT').catch(() => {});
      } else if (targetPage === 'companion-dashboard') {
        selectActiveRole('COMPANION').catch(() => {});
      }
    } else if (targetPage === 'companion-dashboard') {
      selectActiveRole('COMPANION').catch(() => {});
    } else if (targetPage === 'client-dashboard') {
      selectActiveRole('CLIENT').catch(() => {});
    }

    executeNavigation(targetPage, options);
  };

  // Confirm Go Offline and Switch to Client Role
  const handleConfirmExitToClient = async () => {
    if (!user) return;
    setIsProcessingExit(true);
    try {
      // 1. Mark companion OFFLINE on the server immediately
      await apiFetch('/api/companion/availability/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, isPaused: true })
      });
      localStorage.setItem('pairup_companion_online', 'false');
      // 2. Switch role to CLIENT
      await selectActiveRole('CLIENT');
      // 3. Clear modal and proceed to target page
      setShowExitConfirmModal(false);
      const target = pendingTargetPage || 'client-dashboard';
      setPendingTargetPage(null);
      executeNavigation(target);
    } catch (err) {
      console.warn('Exit switch warning:', err);
      localStorage.setItem('pairup_companion_online', 'false');
      selectActiveRole('CLIENT').catch(() => {});
      setShowExitConfirmModal(false);
      executeNavigation(pendingTargetPage || 'client-dashboard');
    } finally {
      setIsProcessingExit(false);
    }
  };

  const handleCancelExit = () => {
    setShowExitConfirmModal(false);
    setPendingTargetPage(null);
  };

  // Custom navigation event listener for in-app switches
  useEffect(() => {
    const handleCustomNavigate = (e: any) => {
      if (e.detail?.page) {
        navigateToPage(e.detail.page);
      }
    };
    window.addEventListener('pairup:navigate', handleCustomNavigate);
    return () => window.removeEventListener('pairup:navigate', handleCustomNavigate);
  }, []);

  // URL routing and device/browser back button (popstate) synchronization
  useEffect(() => {
    // 1. Ensure initial history entry has the state attached so back button can return to it
    const initial = getInitialPage();
    if (!window.history.state || !window.history.state.page) {
      const initialPath = pageToPath(initial);
      window.history.replaceState({ page: initial }, '', window.location.pathname || initialPath);
    }

    // 2. Listen to popstate (browser back/forward, mobile hardware back button, touch swipe back)
    const handlePopState = async (event: PopStateEvent) => {
      const state = event.state;
      let targetPage = 'home';

      if (state && typeof state.page === 'string') {
        targetPage = state.page;
      } else {
        targetPage = pathToPage(window.location.pathname);
      }

      // If user is on companion-dashboard and presses browser back button to leave
      if (currentPageRef.current === 'companion-dashboard' && targetPage !== 'companion-dashboard' && userRef.current) {
        const hasActive = await checkHasActiveBooking();
        if (hasActive) {
          window.history.pushState({ page: 'companion-dashboard' }, '', '/companion-dashboard');
          setShowActiveBookingBlockAlert(true);
          return;
        }

        if (targetPage === 'home') {
          const isOnline = await checkIsCompanionOnline();
          if (isOnline) {
            const confirmOnlineExit = window.confirm(
              language === 'bn'
                ? '⚠️ আপনি বর্তমানে অনলাইনে আছেন!\n\nহোমপেজে যেতে হলে প্রথমে অফলাইন ও লগআউট করতে হবে।\n\nঅফলাইন ও লগআউট হয়ে হোমপেজে যেতে "OK" ক্লিক করুন, অথবা ড্যাশবোর্ডে থাকতে "Cancel" ক্লিক করুন।'
                : language === 'hi'
                ? '⚠️ आप वर्तमान में ऑनलाइन हैं!\n\nहोमपेज पर जाने के लिए पहले ऑफलाइन होना और लॉगआउट करना होगा।\n\nलॉगआउट होकर होमपेज पर जाने के लिए "OK" पर क्लिक करें या डैशबोर्ड पर बने रहने के लिए "Cancel" करें।'
                : '⚠️ You are currently ONLINE.\n\nYou must go OFFLINE and LOG OUT before visiting the Home page.\n\nClick "OK" to go offline, log out, and return to Home; or click "Cancel" to stay on your Dashboard.'
            );
            if (!confirmOnlineExit) {
              window.history.pushState({ page: 'companion-dashboard' }, '', '/companion-dashboard');
              return;
            }

            try {
              await apiFetch('/api/companion/availability/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userRef.current.id, isPaused: true })
              });
              localStorage.setItem('pairup_companion_online', 'false');
            } catch (e) {
              console.warn('Auto offline error', e);
            }

            logout();
          } else {
            const confirmOfflineExit = window.confirm(
              language === 'bn'
                ? 'বিজ্ঞপ্তি: আপনি কম্প্যানিয়ন অ্যাকাউন্টে লগইন অবস্থায় আছেন।\n\nহোমপেজে যেতে হলে প্রথমে লগআউট করতে হবে।\n\nলগআউট করে হোমপেজে যেতে "OK" ক্লিক করুন, অথবা ড্যাশবোর্ডে থাকতে "Cancel" ক্লিক করুন।'
                : language === 'hi'
                ? 'सूचना: आप अपने कंपैनियन खाते में लॉग इन हैं।\n\nहोमपेज पर जाने के लिए पहले लॉगआउट करना होगा।\n\nলগআউট করে হোমপেজে যেতে "OK" ক্লিক করুন, অথবা ড্যাশবোর্ডে থাকতে "Cancel" ক্লিক করুন।'
                : 'Notice: You are logged into your Companion account.\n\nYou must log out before visiting the Home page.\n\nClick "OK" to log out and go to Home, or click "Cancel" to stay on your Dashboard.'
            );
            if (!confirmOfflineExit) {
              window.history.pushState({ page: 'companion-dashboard' }, '', '/companion-dashboard');
              return;
            }

            logout();
          }
        } else {
          const isOnline = localStorage.getItem('pairup_companion_online') === 'true';
          if (isOnline) {
            // Hold companion on companion-dashboard URL ONLY if online
            window.history.pushState({ page: 'companion-dashboard' }, '', '/companion-dashboard');
            setPendingTargetPage(targetPage);
            setShowExitConfirmModal(true);
            return;
          }

          // Already offline: switch role to client and let back navigation proceed naturally
          if (targetPage === 'client-dashboard') {
            selectActiveRole('CLIENT').catch(() => {});
          }
        }
      }

      if (targetPage === 'admin' || window.location.pathname === '/admin') {
        setIsAdminHostMode(true);
      } else {
        setIsAdminHostMode(false);
        setCurrentPageState(targetPage);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Redirect to companion-dashboard on initial load if URL is specifically /companion-dashboard
  useEffect(() => {
    if (user && activeRole === 'COMPANION') {
      if (currentPage === 'home' && window.location.pathname === '/companion-dashboard') {
        executeNavigation('companion-dashboard', { replace: true });
      }
    }
  }, [user?.id, activeRole]);

  // Automatically redirect to home page whenever user logs out
  const prevUserRef = React.useRef(user);
  useEffect(() => {
    if (prevUserRef.current && !user) {
      executeNavigation('home', { replace: true });
    }
    prevUserRef.current = user;
  }, [user]);

  // Safety fallback: if not logged in, client/companion dashboards cannot be viewed
  useEffect(() => {
    if (!user && (currentPage === 'client-dashboard' || currentPage === 'companion-dashboard')) {
      executeNavigation('home', { replace: true });
    }
  }, [user, currentPage]);

  const handleSelectServiceFromGrid = (service: ServiceItem) => {
    setActiveServiceFilter(service.id);
    const el = document.getElementById('companion-discovery');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else if (!user) {
      openAuthModal('signin');
    } else {
      navigateToPage('client-dashboard');
    }
  };

  const handleExploreCompanions = () => {
    const el = document.getElementById('companion-discovery');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else if (!user) {
      openAuthModal('login');
    } else {
      navigateToPage('client-dashboard');
    }
  };

  const handleRegisterCompanion = () => {
    if (!user) {
      openAuthModal('signin');
    } else {
      selectActiveRole('COMPANION');
      navigateToPage('companion-dashboard');
    }
  };

  const handleRegisterClient = () => {
    if (!user) {
      openAuthModal('signin');
    } else {
      selectActiveRole('CLIENT');
      navigateToPage('client-dashboard');
    }
  };

  // IF ADMIN HOST MODE IS ACTIVE: RENDER SEPARATE ADMIN PORTAL COMPLETELY ISOLATED
  if (isAdminHostMode) {
    return (
      <div className="w-full min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
        <AdminPortal />
      </div>
    );
  }

  // CUSTOMER-FACING PLATFORM VIEW
  const renderCustomerPage = () => {
    switch (currentPage) {
      case 'about':
        return (
          <AboutPage
            onExplore={handleExploreCompanions}
            onJoinCompanion={handleRegisterCompanion}
          />
        );
      case 'how-it-works':
        return (
          <HowItWorksPage
            onRegisterClient={handleRegisterClient}
            onRegisterCompanion={handleRegisterCompanion}
          />
        );
      case 'safety-trust':
        return <SafetyTrustPage />;
      case 'terms':
        return <TermsPage />;
      case 'privacy':
        return <PrivacyPolicyPage />;
      case 'refund-cancellation':
        return <RefundPolicyPage />;
      case 'client-dashboard':
        return (
          <ErrorBoundary fallbackTitle="Client Dashboard">
            <ClientDashboard onNavigateToPage={navigateToPage} />
          </ErrorBoundary>
        );
      case 'companion-dashboard':
        return (
          <ErrorBoundary fallbackTitle="Companion Dashboard">
            <CompanionDashboard onNavigateToPage={navigateToPage} />
          </ErrorBoundary>
        );
      case 'home':
      default:
        return (
          <>
            <Hero onExploreCompanions={handleExploreCompanions} />
            <ServicesGrid onSelectService={handleSelectServiceFromGrid} />
            <PartnerRecruitmentBanner onJoinCompanion={handleRegisterCompanion} />
            <CompanionListing
              initialServiceId={activeServiceFilter}
              onBookCompanion={(companion, serviceId) => {
                if (!user) {
                  openAuthModal('login');
                } else {
                  navigateToPage('client-dashboard');
                }
              }}
            />
            <TrustReviewsAndFaq />
          </>
        );
    }
  };

  // Cross-platform responsive viewport rendering (Website, Android WebView/Capacitor, iOS WebView/Capacitor)
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-start overflow-x-hidden selection:bg-pink-500 selection:text-white">
      <div className="w-full flex flex-col min-h-screen">
        {/* Customer Header on public pages only (Dashboards have their own integrated workspace headers) */}
        {!['client-dashboard', 'companion-dashboard'].includes(currentPage) && (
          <Header currentPage={currentPage} setCurrentPage={navigateToPage} />
        )}

        {/* Dynamic Page Content */}
        <main className={`flex-1 w-full overflow-x-hidden ${isNative ? 'pb-20' : ''}`}>
          {renderCustomerPage()}
        </main>

        {/* Footer on Web public pages only (Hidden on Native App for true mobile feel) */}
        {!isNative && !['client-dashboard', 'companion-dashboard'].includes(currentPage) && (
          <Footer setCurrentPage={navigateToPage} />
        )}

        {/* Native Android/iOS Fixed Bottom Navigation Bar */}
        {isNative && (
          <nav
            aria-label="Mobile Bottom Navigation"
            className="fixed bottom-0 inset-x-0 z-[1200] bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/90 px-2 py-1.5 pb-[env(safe-area-inset-bottom,6px)] shadow-2xl"
          >
            <div className="max-w-lg mx-auto grid grid-cols-4 gap-1">
              {[
                { id: 'explore' as const, label: 'Explore', icon: Compass },
                { id: 'bookings' as const, label: 'Bookings', icon: CalendarCheck },
                { id: 'referrals' as const, label: 'Refer & Earn', icon: Gift },
                { id: 'profile' as const, label: user ? 'Dashboard' : 'Profile', icon: User }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive =
                  (tab.id === 'explore' && currentPage === 'home') ||
                  (tab.id !== 'explore' && nativeActiveTab === tab.id && ['client-dashboard', 'companion-dashboard'].includes(currentPage));

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setNativeActiveTab(tab.id);
                      if (tab.id === 'explore') {
                        navigateToPage('home');
                        return;
                      }
                      if (!user) {
                        openAuthModal(tab.id === 'referrals' ? 'signin' : 'login');
                        return;
                      }
                      const targetDashboard = activeRole === 'COMPANION' ? 'companion-dashboard' : 'client-dashboard';
                      const targetTab = tab.id === 'bookings' ? 'bookings' : tab.id === 'referrals' ? 'referrals' : 'profile';
                      sessionStorage.setItem('pairup_target_tab', targetTab);
                      window.dispatchEvent(new CustomEvent('pairup:switch-tab', { detail: targetTab }));
                      navigateToPage(targetDashboard);
                    }}
                    className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
                      isActive
                        ? 'text-pink-400 bg-pink-500/10'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-pink-400' : 'text-slate-400'}`} />
                    <span className="text-[10px] font-bold tracking-tight leading-none">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* Modals & Wizards */}
        <AuthGatewayModal
          onNavigateToDashboard={targetPage => executeNavigation(targetPage)}
        />
        <KycWizardModal />
        <RoleSelectionModal
          onSelectRoleDone={role => {
            if (role === 'COMPANION') {
              executeNavigation('companion-dashboard');
            } else {
              executeNavigation('client-dashboard');
            }
          }}
        />
        {/* Global Companion Alert Manager: listens & alerts across ALL pages (Home, About, etc.) */}
        <GlobalCompanionAlertManager onNavigateToDashboard={() => navigateToPage('companion-dashboard')} />

        {/* Modal A: Active Booking Block Alert */}
        {showActiveBookingBlockAlert && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-md bg-slate-900 border-2 border-rose-500/80 rounded-3xl shadow-2xl p-6 text-slate-100 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">
                    {language === 'bn' ? 'বুকিং সেশন সক্রিয় রয়েছে' : language === 'hi' ? 'सक्रिय बुकिंग प्रगति पर है' : 'Booking Active in Progress'}
                  </h3>
                  <p className="text-xs text-rose-400 font-medium">
                    {language === 'bn' ? 'একটি ক্লায়েন্ট মিটিং সেশন বর্তমানে চলমান' : language === 'hi' ? 'एक ग्राहक सत्र वर्तमान में प्रगति पर है' : 'Client meeting currently active'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2 text-slate-300">
                <p>
                  {language === 'bn'
                    ? 'নিরাপত্তা ও নীতি অনুযায়ী, সক্রিয় মিটিং চলাকালীন আপনি কম্প্যানিয়ন ড্যাশবোর্ড ত্যাগ করতে বা রোল পরিবর্তন করতে পারবেন না। অনুগ্রহ করে মিটিংটি সম্পন্ন করুন।'
                    : language === 'hi'
                    ? 'सुरक्षा और नीतियों के अनुसार, सक्रिय मीटिंग के दौरान आप कंपेनियन डैशबोर्ड छोड़कर नहीं जा सकते। कृपया पहले मीटिंग पूरी करें।'
                    : 'You currently have a booking in progress. You cannot go offline or leave the Companion Dashboard until this session is completed or cancelled.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowActiveBookingBlockAlert(false)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-extrabold text-xs shadow-lg shadow-rose-950/40 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>{language === 'bn' ? 'ড্যাশবোর্ডে থাকুন' : language === 'hi' ? 'डैशबोर्ड पर बने रहें' : 'Stay on Dashboard'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal B: Switch to Client Role & Go Offline Confirmation */}
        {showExitConfirmModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/80 rounded-3xl shadow-2xl p-6 text-slate-100 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                  <PowerOff className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">
                    {language === 'bn' ? 'অফলাইন হয়ে ক্লায়েন্ট মোডে যাবেন?' : language === 'hi' ? 'ऑफ़लाइन होकर क्लाइंट मोड में जाएँ?' : 'Switch to Client & Go Offline?'}
                  </h3>
                  <p className="text-xs text-amber-400 font-medium">
                    {language === 'bn' ? 'কম্প্যানিয়ন মোড (অনলাইন)' : language === 'hi' ? 'कंपेनियन मोड (ऑनलाइन)' : 'Companion Mode (Online)'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2.5 text-slate-300">
                <p>
                  {language === 'bn' ? (
                    <>আপনি বর্তমানে কম্প্যানিয়ন হিসেবে <strong>অনলাইনে</strong> রয়েছেন। ক্লায়েন্ট মোডে যেতে বা এই পৃষ্ঠাটি দেখতে, আপনাকে স্বয়ংক্রিয়ভাবে <strong>অফলাইন</strong> করা হবে এবং আপনার সক্রিয় ভূমিকা <strong>ক্লায়েন্টে</strong> পরিবর্তিত হবে।</>
                  ) : language === 'hi' ? (
                    <>आप वर्तमान में कंपेनियन के रूप में <strong>ऑनलाइन</strong> हैं। क्लाइंट मोड में जाने या इस पृष्ठ को देखने के लिए, आपको स्वचालित रूप से <strong>ऑफ़लाइन</strong> कर दिया जाएगा और आपकी भूमिका <strong>क्लाइंट</strong> में बदल जाएगी।</>
                  ) : (
                    <>You are currently in <strong>Companion Mode (Online)</strong>. To visit this page or browse as a client, you will automatically be set to <strong>OFFLINE</strong> and your active role will switch to <strong>Client</strong>.</>
                  )}
                </p>
                <p className="text-[11px] text-amber-300/90 bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/30">
                  {language === 'bn'
                    ? '⚠️ অফলাইন থাকলে ক্লায়েন্টরা আপনাকে মানচিত্রে দেখতে পাবে না বা বুকিং অনুরোধ পাঠাতে পারবে না।'
                    : language === 'hi'
                    ? '⚠️ ऑफ़लाइन रहने पर ग्राहक आपको मानचित्र पर नहीं देख पाएंगे या बुकिंग अनुरोध नहीं भेज सकेंगे।'
                    : '⚠️ While offline, clients will no longer see your profile on the map or send you booking requests.'}
                </p>
                <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  {language === 'bn'
                    ? 'ড্যাশবোর্ড ছেড়ে যেতে হলে অফলাইন হতে হয়। আপনি পরবর্তীতে কম্প্যানিয়ন ড্যাশবোর্ডে এসে যেকোনো সময় পুনরায় অনলাইন হতে পারবেন।'
                    : language === 'hi'
                    ? 'डैशबोर्ड छोड़ने के लिए ऑफ़लाइन होना आवश्यक है। आप जब चाहें कंपेनियन डैशबोर्ड पर लौटकर पुनः ऑनलाइन हो सकते हैं।'
                    : 'Leaving the companion dashboard requires going offline. You can return to the Companion Dashboard and go online at any time.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  disabled={isProcessingExit}
                  onClick={handleCancelExit}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors cursor-pointer active:scale-95 text-center"
                >
                  {language === 'bn' ? 'বাতিল' : language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>

                <button
                  type="button"
                  disabled={isProcessingExit}
                  onClick={handleConfirmExitToClient}
                  className="py-3 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-pink-600 hover:from-amber-600 hover:to-pink-700 text-white font-extrabold text-xs shadow-lg shadow-pink-950/40 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {isProcessingExit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{language === 'bn' ? 'পরিবর্তন হচ্ছে...' : language === 'hi' ? 'बदला जा रहा है...' : 'Switching...'}</span>
                    </>
                  ) : (
                    <span>{language === 'bn' ? 'অফলাইন হয়ে যান' : language === 'hi' ? 'ऑफ़लाइन जाएँ' : 'Go Offline'}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary fallbackTitle="PairUpToday Application">
      <LanguageProvider>
        <AuthProvider>
          <AdminAuthProvider>
            <MainAppContent />
          </AdminAuthProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;

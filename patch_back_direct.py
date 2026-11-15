import os, re, sys

BASE = os.path.expanduser('~/pairup-today-prod')

# ---------------------------------------------------------------------------
# 1. PATCH src/pages/CompanionDashboard.tsx
# ---------------------------------------------------------------------------
dash_path = os.path.join(BASE, 'src/pages/CompanionDashboard.tsx')
if os.path.exists(dash_path):
    with open(dash_path, 'r', encoding='utf-8') as f:
        dash_src = f.read()

    # Add ArrowLeft import if not present
    if 'ArrowLeft' not in dash_src:
        dash_src = dash_src.replace(
            'CheckSquare, Star',
            'CheckSquare, Star, ArrowLeft'
        )

    # Add Back button to minimal top bars if not present
    back_btn = '''            <button
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = '/';
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold shadow-sm active:scale-95"
              title="Go back to previous page"
              aria-label="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-pink-400" />
              <span>Back</span>
            </button>
'''
    top_bar_marker = '<div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-lg">\n          <div className="flex items-center gap-3">'
    if 'title="Go back to previous page"' not in dash_src and top_bar_marker in dash_src:
        dash_src = dash_src.replace(
            top_bar_marker,
            top_bar_marker + '\n' + back_btn
        )

    with open(dash_path, 'w', encoding='utf-8') as f:
        f.write(dash_src)
    print("1. CompanionDashboard.tsx patched successfully!")
else:
    print("ERROR: CompanionDashboard.tsx not found at", dash_path)

# ---------------------------------------------------------------------------
# 2. PATCH src/components/Header.tsx
# ---------------------------------------------------------------------------
header_path = os.path.join(BASE, 'src/components/Header.tsx')
if os.path.exists(header_path):
    with open(header_path, 'r', encoding='utf-8') as f:
        hdr = f.read()

    # Import ArrowLeft
    if 'ArrowLeft' not in hdr:
        hdr = hdr.replace(
            "import { Globe, User, LogOut, ChevronDown, Menu, X } from 'lucide-react';",
            "import { Globe, User, LogOut, ChevronDown, Menu, X, ArrowLeft } from 'lucide-react';"
        )

    # Add handleBack
    if 'const handleBack =' not in hdr:
        old_nav = '''  const handleNavClick = (page: string) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
  };'''
        new_nav = '''  const handleNavClick = (page: string) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setCurrentPage('home');
    }
  };'''
        hdr = hdr.replace(old_nav, new_nav)

    # Add desktop back button
    desktop_anchor = '''        {/* EXACT ORDER ITEMS 1 & 2: Logo and PairUpToday */}
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleNavClick('home')}>'''
    
    desktop_replacement = '''        {/* Left Side: Back button (if on inner page) + Logo + PairUpToday */}
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

          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleNavClick('home')}>'''

    if 'aria-label="Back to previous page"' not in hdr and desktop_anchor in hdr:
        hdr = hdr.replace(desktop_anchor, desktop_replacement)
        # also close the extra div
        hdr = hdr.replace(
            '            </div>\n          </div>\n        </div>\n\n        {/* Desktop Navigation Links',
            '            </div>\n          </div>\n        </div>\n        </div>\n\n        {/* Desktop Navigation Links'
        )

    # Add mobile drawer back button
    mobile_anchor = '''      {/* Mobile Drawer (Strictly in the exact 8 item order) */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-3 pb-6 space-y-3">
          <button
            onClick={() => handleNavClick('home')}'''

    mobile_replacement = '''      {/* Mobile Drawer (Strictly in the exact 8 item order) */}
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
            onClick={() => handleNavClick('home')}'''

    if 'Back to Previous Page' not in hdr and mobile_anchor in hdr:
        hdr = hdr.replace(mobile_anchor, mobile_replacement)

    with open(header_path, 'w', encoding='utf-8') as f:
        f.write(hdr)
    print("2. Header.tsx patched successfully!")
else:
    print("ERROR: Header.tsx not found at", header_path)

# ---------------------------------------------------------------------------
# 3. WRITE src/App.tsx COMPLETELY
# ---------------------------------------------------------------------------
app_path = os.path.join(BASE, 'src/App.tsx')
APP_CONTENT = """import React, { useState, useEffect } from 'react';
import { LanguageProvider } from './context/LanguageContext';
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
import { ClientDashboard } from './pages/ClientDashboard';
import { CompanionDashboard } from './pages/CompanionDashboard';
import { AuthGatewayModal } from './pages/AuthGatewayModal';
import { KycWizardModal } from './pages/KycWizardModal';
import { RoleSelectionModal } from './pages/RoleSelectionModal';
import { AdminPortal } from './admin/AdminPortal';
import { ServiceItem } from './constants/services';
import { CompanionListing } from './components/CompanionListing';

const pageToPath = (page: string): string => {
  switch (page) {
    case 'about': return '/about';
    case 'how-it-works': return '/how-it-works';
    case 'safety-trust': return '/safety-trust';
    case 'terms': return '/terms';
    case 'client-dashboard': return '/client-dashboard';
    case 'companion-dashboard': return '/companion-dashboard';
    case 'admin': return '/admin';
    case 'home':
    default:
      return '/';
  }
};

const pathToPage = (pathname: string): string => {
  const clean = pathname.toLowerCase().replace(/\\/$/, '') || '/';
  switch (clean) {
    case '/about': return 'about';
    case '/how-it-works': return 'how-it-works';
    case '/safety-trust': return 'safety-trust';
    case '/terms':
    case '/terms-of-service': return 'terms';
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
  const { user, activeRole, openAuthModal, selectActiveRole } = useAuth();
  
  const [currentPage, setCurrentPageState] = useState<string>(() => {
    const init = getInitialPage();
    return init === 'admin' ? 'home' : init;
  });

  const [activeServiceFilter, setActiveServiceFilter] = useState<number | null>(null);
  
  const [isAdminHostMode, setIsAdminHostMode] = useState<boolean>(() => {
    return getInitialPage() === 'admin';
  });

  // Centralized navigation handler that synchronizes browser/device history
  const navigateToPage = (targetPage: string, options?: { replace?: boolean }) => {
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

  // URL routing and device/browser back button (popstate) synchronization
  useEffect(() => {
    // 1. Ensure initial history entry has the state attached so back button can return to it
    const initial = getInitialPage();
    if (!window.history.state || !window.history.state.page) {
      const initialPath = pageToPath(initial);
      window.history.replaceState({ page: initial }, '', window.location.pathname || initialPath);
    }

    // 2. Listen to popstate (browser back/forward, mobile hardware back button, touch swipe back)
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      let targetPage = 'home';

      if (state && typeof state.page === 'string') {
        targetPage = state.page;
      } else {
        targetPage = pathToPage(window.location.pathname);
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

  // Automatically redirect to home page whenever user logs out
  const prevUserRef = React.useRef(user);
  useEffect(() => {
    if (prevUserRef.current && !user) {
      navigateToPage('home', { replace: true });
    }
    prevUserRef.current = user;
  }, [user]);

  // Safety fallback: if not logged in, client/companion dashboards cannot be viewed
  useEffect(() => {
    if (!user && (currentPage === 'client-dashboard' || currentPage === 'companion-dashboard')) {
      navigateToPage('home', { replace: true });
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
      case 'client-dashboard':
        return <ClientDashboard />;
      case 'companion-dashboard':
        return <CompanionDashboard />;
      case 'home':
      default:
        return (
          <>
            <Hero onExploreCompanions={handleExploreCompanions} />
            <ServicesGrid onSelectService={handleSelectServiceFromGrid} />
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
          </>
        );
    }
  };

  // Cross-platform responsive viewport rendering (Website, Android WebView/Capacitor, iOS WebView/Capacitor)
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-start overflow-x-hidden selection:bg-pink-500 selection:text-white">
      <div className="w-full flex flex-col min-h-screen">
        {/* Customer Header with back button & navigation */}
        <Header currentPage={currentPage} setCurrentPage={navigateToPage} />

        {/* Dynamic Page Content */}
        <main className="flex-1 w-full overflow-x-hidden">
          {renderCustomerPage()}
        </main>

        {/* Footer */}
        <Footer setCurrentPage={navigateToPage} />

        {/* Modals & Wizards */}
        <AuthGatewayModal />
        <KycWizardModal />
        <RoleSelectionModal
          onSelectRoleDone={role => {
            if (role === 'COMPANION') {
              navigateToPage('companion-dashboard');
            } else {
              navigateToPage('client-dashboard');
            }
          }}
        />
      </div>
    </div>
  );
};

export function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AdminAuthProvider>
          <MainAppContent />
        </AdminAuthProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
"""

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(APP_CONTENT)
print("3. App.tsx updated successfully!")
print("\\nAll 3 files directly updated without GitHub!")

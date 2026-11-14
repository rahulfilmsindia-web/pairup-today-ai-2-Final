import React, { useState, useEffect } from 'react';
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

const MainAppContent: React.FC = () => {
  const { user, activeRole, openAuthModal, selectActiveRole } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [activeServiceFilter, setActiveServiceFilter] = useState<number | null>(null);
  const [isAdminHostMode, setIsAdminHostMode] = useState<boolean>(() => {
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    return host.startsWith('admin.') || path === '/admin' || search.includes('admin=true');
  });

  // URL routing sync
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/admin') {
        setIsAdminHostMode(true);
      } else if (path === '/about') {
        setCurrentPage('about');
        setIsAdminHostMode(false);
      } else if (path === '/how-it-works') {
        setCurrentPage('how-it-works');
        setIsAdminHostMode(false);
      } else if (path === '/safety-trust') {
        setCurrentPage('safety-trust');
        setIsAdminHostMode(false);
      } else if (path === '/terms' || path === '/terms-of-service') {
        setCurrentPage('terms');
        setIsAdminHostMode(false);
      } else {
        setCurrentPage('home');
        setIsAdminHostMode(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectServiceFromGrid = (service: ServiceItem) => {
    setActiveServiceFilter(service.id);
    const el = document.getElementById('companion-discovery');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else if (!user) {
      openAuthModal('signin');
    } else {
      setCurrentPage('client-dashboard');
    }
  };

  const handleExploreCompanions = () => {
    const el = document.getElementById('companion-discovery');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else if (!user) {
      openAuthModal('login');
    } else {
      setCurrentPage('client-dashboard');
    }
  };

  const handleRegisterCompanion = () => {
    if (!user) {
      openAuthModal('signin');
    } else {
      selectActiveRole('COMPANION');
      setCurrentPage('companion-dashboard');
    }
  };

  const handleRegisterClient = () => {
    if (!user) {
      openAuthModal('signin');
    } else {
      selectActiveRole('CLIENT');
      setCurrentPage('client-dashboard');
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
                  setCurrentPage('client-dashboard');
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
        {/* Customer Header in Exact 8 Item Order */}
        <Header currentPage={currentPage} setCurrentPage={setCurrentPage} />

        {/* Dynamic Page Content */}
        <main className="flex-1 w-full overflow-x-hidden">
          {renderCustomerPage()}
        </main>

        {/* Footer */}
        <Footer setCurrentPage={setCurrentPage} />

        {/* Modals & Wizards */}
        <AuthGatewayModal />
        <KycWizardModal />
        <RoleSelectionModal
          onSelectRoleDone={role => {
            if (role === 'COMPANION') {
              setCurrentPage('companion-dashboard');
            } else {
              setCurrentPage('client-dashboard');
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

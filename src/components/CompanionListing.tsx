import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { PAIRUP_SERVICES } from '../constants/services';
import { CompanionDiscoveryItem } from '../types';
import { LocationAutocomplete } from './LocationAutocomplete';
import {
  MapPin,
  Star,
  Clock,
  Sparkles,
  Eye,
  CalendarCheck,
  AlertCircle,
  X,
  Filter,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Navigation
} from 'lucide-react';

interface CompanionListingProps {
  initialServiceId?: number | null;
  onBookCompanion?: (companion: CompanionDiscoveryItem, serviceId?: number) => void;
}

export const CompanionListing: React.FC<CompanionListingProps> = ({
  initialServiceId,
  onBookCompanion
}) => {
  const { t, language } = useLanguage();
  const { user, openAuthModal, bookingContext, setBookingContext } = useAuth();

  const [selectedCity, setSelectedCity] = useState<string>('');
  const [clientCoords, setClientCoords] = useState<{ lat?: number; lng?: number } | null>(null);
  const [detectedLocationName, setDetectedLocationName] = useState<string>('');
  const [locatingUser, setLocatingUser] = useState<boolean>(false);
  const [selectedServiceId, setSelectedServiceId] = useState<number | 'all'>(
    initialServiceId || 'all'
  );
  const [companions, setCompanions] = useState<CompanionDiscoveryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Quick View Modal state
  const [quickViewCompanion, setQuickViewCompanion] = useState<CompanionDiscoveryItem | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [bookingAlert, setBookingAlert] = useState<{ id: string; message: string } | null>(null);

  // Auto-detect client location on mount to show closest nearby companions first
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      setLocatingUser(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setClientCoords({ lat, lng });
          try {
            const res = await fetch(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`);
            if (res.ok) {
              const data = await res.json();
              if (data?.formatted_address) {
                setDetectedLocationName(data.formatted_address);
              }
            }
          } catch {
            // Reverse geocode non-fatal
          } finally {
            setLocatingUser(false);
          }
        },
        (err) => {
          console.log('Browser geolocation prompt dismissed or unavailable:', err.message);
          setLocatingUser(false);
        },
        { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 }
      );
    }
  }, []);

  const handleUseCurrentLocation = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setClientCoords({ lat, lng });
        try {
          const res = await fetch(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.formatted_address) {
              setDetectedLocationName(data.formatted_address);
              setSelectedCity(data.formatted_address);
            }
          }
        } catch {
          // ignore
        } finally {
          setLocatingUser(false);
        }
      },
      (err) => {
        setLocatingUser(false);
        console.warn('Geolocation error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (initialServiceId) {
      setSelectedServiceId(initialServiceId);
    }
  }, [initialServiceId]);

  // Fetch companions from backend
  // Fetch companions from backend with real-time silent background update
  const fetchCompanions = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams();
      if (selectedCity && selectedCity !== 'all') params.append('city', selectedCity);
      if (selectedServiceId !== 'all') params.append('serviceId', selectedServiceId.toString());
      if (clientCoords?.lat !== undefined && clientCoords?.lng !== undefined) {
        params.append('lat', clientCoords.lat.toString());
        params.append('lng', clientCoords.lng.toString());
      }

      const res = await fetch(`/api/companions/search?${params.toString()}`);
      if (!res.ok) {
        if (!silent) {
          let message = 'Failed to load companion profiles.';
          try {
            const errorBody = await res.json();
            if (typeof errorBody?.error === 'string') message = errorBody.error;
          } catch {
            // Keep the generic message when the server does not return JSON.
          }
          throw new Error(message);
        }
        return;
      }
      const data = await res.json();
      const freshList: CompanionDiscoveryItem[] = data.companions || [];
      setCompanions(freshList);

      // If client has opened a booking context for a companion who just went offline, close modal and notify
      if (bookingContext && !freshList.some(c => c.id === bookingContext.companionId)) {
        setBookingAlert({
          id: bookingContext.companionId,
          message: `${bookingContext.companionName} has just gone offline and is no longer accepting new bookings.`
        });
        setBookingContext(null);
      }
    } catch (err: any) {
      if (!silent) setError(err.message || 'Error loading profiles.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanions();
    // Silent real-time polling every 4s so offline companions instantly disappear without manual page reload
    const pollInterval = setInterval(() => {
      fetchCompanions(true);
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [selectedCity, selectedServiceId, clientCoords]);

  const handleBookNow = (companion: CompanionDiscoveryItem) => {
    setBookingAlert(null);

    // Initial listings are non-bookable
    if (companion.isInitialListing) {
      setBookingAlert({
        id: companion.id,
        message: t.profileUnavailableForBooking
      });
      return;
    }

    // Check if companion is currently in our active online list
    if (companions.length > 0 && !companions.some(c => String(c.id) === String(companion.id))) {
      setBookingAlert({
        id: companion.id,
        message: `${companion.name} is currently offline and not accepting new bookings.`
      });
      return;
    }

    // Genuine companion booking
    const targetServiceId =
      selectedServiceId !== 'all' ? selectedServiceId : companion.services[0] || 1;

    setBookingContext({
      companionId: companion.id,
      companionName: companion.name,
      serviceId: targetServiceId,
      hourlyRate: companion.hourlyRate,
      companion
    });

    if (!user) {
      openAuthModal('login');
      return;
    }

    if (onBookCompanion) {
      onBookCompanion(companion, targetServiceId);
    }
  };

  const openQuickView = (companion: CompanionDiscoveryItem) => {
    setQuickViewCompanion(companion);
    setActivePhotoIdx(0);
    setBookingAlert(null);
  };

  const closeQuickView = () => {
    setQuickViewCompanion(null);
    setActivePhotoIdx(0);
    setBookingAlert(null);
  };

  // Build unified complete photo list for Quick View (Profile Photo first, then gallery photos)
  const allQuickViewPhotos = quickViewCompanion
    ? [
        quickViewCompanion.profilePhoto,
        ...(quickViewCompanion.photos || []).filter((p) => p && p !== quickViewCompanion.profilePhoto)
      ]
    : [];

  const handlePrevPhoto = () => {
    if (allQuickViewPhotos.length <= 1) return;
    setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : allQuickViewPhotos.length - 1));
  };

  const handleNextPhoto = () => {
    if (allQuickViewPhotos.length <= 1) return;
    setActivePhotoIdx((prev) => (prev < allQuickViewPhotos.length - 1 ? prev + 1 : 0));
  };

  // Lock body scroll when Quick View modal is active
  useEffect(() => {
    if (quickViewCompanion) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [quickViewCompanion]);

  // Keyboard navigation: Escape to close, ArrowLeft / ArrowRight to navigate gallery
  useEffect(() => {
    if (!quickViewCompanion) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeQuickView();
      } else if (e.key === 'ArrowLeft') {
        handlePrevPhoto();
      } else if (e.key === 'ArrowRight') {
        handleNextPhoto();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickViewCompanion, activePhotoIdx, allQuickViewPhotos.length]);

  // Touch swipe support for mobile
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0) {
        handlePrevPhoto();
      } else {
        handleNextPhoto();
      }
    }
    setTouchStartX(null);
  };

  return (
    <section id="companion-discovery" className="py-12 bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PairUp Verified Network</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            {t.companionListSectionTitle}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-400">
            {t.companionListSectionSubtitle}
          </p>
        </div>

        {/* Filter Controls Bar */}
        <div className="mb-8 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Smart Location Autocomplete Search */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-pink-400" />
                  {t.selectLocationLabel || (language === 'bn' ? 'শহর বা অবস্থান খুঁজুন' : language === 'hi' ? 'शहर या स्थान खोजें' : 'Search City or Location')}
                </label>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locatingUser}
                  className="text-[11px] font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Navigation className="w-3 h-3 text-pink-400" />
                  <span>{locatingUser ? (language === 'bn' ? 'শনাক্ত হচ্ছে...' : 'Locating...') : (language === 'bn' ? 'আমার বর্তমান অবস্থান' : language === 'hi' ? 'मेरा वर्तमान स्थान' : 'Use Current Location')}</span>
                </button>
              </div>
              <LocationAutocomplete
                value={selectedCity}
                onChange={(val) => {
                  setSelectedCity(val);
                  if (!val) {
                    setClientCoords(null);
                    setDetectedLocationName('');
                  }
                }}
                onSelectLocation={(item) => {
                  if (item.lat !== undefined && item.lng !== undefined) {
                    setClientCoords({ lat: item.lat, lng: item.lng });
                    setDetectedLocationName(item.fullAddress || item.label || item.cityValue || '');
                  } else {
                    setClientCoords(null);
                  }
                }}
                placeholder={
                  language === 'bn'
                    ? 'ভারতে যেকোনো শহর, এলাকা, রাস্তা বা ঠিকানা দিয়ে খুঁজুন...'
                    : language === 'hi'
                    ? 'भारत में कोई भी शहर, क्षेत्र, सड़क या पता खोजें...'
                    : 'Search any city, town, road or local area in India...'
                }
                accentColor="pink"
              />
            </div>

            {/* 24-Service Filter Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                {t.filterByServiceLabel}
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedServiceId(val === 'all' ? 'all' : parseInt(val, 10));
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
              >
                <option value="all">{t.allServicesLabel} (24 Services)</option>
                {PAIRUP_SERVICES.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    #{srv.id}. {srv.name}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Active Nearby Location Notification Banner */}
        {clientCoords && (
          <div className="mb-6 px-4 py-3 rounded-2xl bg-gradient-to-r from-pink-500/15 via-rose-500/10 to-slate-900 border border-pink-500/30 text-xs text-pink-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-lg animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400 shrink-0">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-white block">
                  {language === 'bn'
                    ? '📍 আপনার নিকটতম দূরত্ব অনুযায়ী কম্প্যানিয়নদের সাজানো হয়েছে'
                    : language === 'hi'
                    ? '📍 आपकी निकटतम दूरी के अनुसार साथी दिखाए जा रहे हैं'
                    : '📍 Companions sorted by nearest distance to your location'}
                </span>
                <span className="text-[11px] text-pink-300/80">
                  {detectedLocationName || selectedCity || (language === 'bn' ? 'শনাক্ত করা অবস্থান' : 'Detected GPS Location')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCity('');
                setClientCoords(null);
                setDetectedLocationName('');
              }}
              className="text-[11px] font-semibold text-slate-400 hover:text-white underline self-start sm:self-auto cursor-pointer"
            >
              {language === 'bn' ? 'সকল ভারত দেখুন' : language === 'hi' ? 'पूरा भारत देखें' : 'View All Across India'}
            </button>
          </div>
        )}

        {/* Global Alert for Unavailable Profiles */}
        {bookingAlert && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-medium">{bookingAlert.message}</span>
            </div>
            <button
              onClick={() => setBookingAlert(null)}
              className="p-1 rounded-md text-amber-400 hover:text-amber-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">{t.loadingAction}</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="py-16 text-center text-rose-400">
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => fetchCompanions()}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && companions.length === 0 && (
          <div className="py-16 text-center text-slate-400 max-w-md mx-auto">
            <p className="text-base font-semibold text-slate-300">No companions match your filter criteria.</p>
            <p className="text-xs text-slate-500 mt-1">Try resetting the location or service filter.</p>
            <button
              onClick={() => {
                setSelectedCity('');
                setClientCoords(null);
                setSelectedServiceId('all');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-pink-500/20 text-pink-300 border border-pink-500/30 hover:bg-pink-500/30 text-xs font-bold"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Companions Grid */}
        {!loading && !error && companions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {companions.map((comp) => {
              // Map service IDs to actual catalog items
              const companionServices = comp.services
                .map((sid) => PAIRUP_SERVICES.find((s) => s.id === sid))
                .filter(Boolean);

              const isAlerted = bookingAlert?.id === comp.id;

              return (
                <div
                  key={comp.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl hover:border-slate-700 hover:shadow-2xl transition-all duration-300 flex flex-col"
                >
                  {/* Photo Container */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950 group">
                    <img
                      src={comp.profilePhoto}
                      alt={comp.name}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    
                    {/* Floating Rate Tag */}
                    <div className="absolute top-3 right-3 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg">
                      <span className="text-sm font-extrabold text-amber-400">
                        {comp.hourlyRateFormatted}
                      </span>
                    </div>

                    {/* Floating Rating Tag */}
                    <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{comp.rating.toFixed(2)}</span>
                      <span className="text-slate-500">({comp.totalBookings})</span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Name and Age: e.g. Riya Sharma (24 yrs) */}
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {comp.name} <span className="text-slate-400 font-normal text-sm">({comp.age} {t.ageYearsLabel})</span>
                        </h3>
                      </div>

                      {/* City and State: e.g. Kolkata, West Bengal */}
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                        <span className="font-medium text-slate-300">{comp.locationFormatted}</span>
                      </div>

                      {/* Real Distance Calculation from Client */}
                      {comp.distanceKm !== undefined && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-lg w-fit">
                          <Navigation className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                          <span>
                            {language === 'bn'
                              ? `আপনার থেকে ${comp.distanceKm} কিমি দূরত্বে`
                              : language === 'hi'
                              ? `आपसे ${comp.distanceKm} किमी दूरी पर`
                              : `${comp.distanceKm} km away from you`}
                          </span>
                        </div>
                      )}

                      {/* Bio snippet */}
                      <p className="mt-3 text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {comp.bio}
                      </p>

                      {/* Available Services (From 24-Service Catalog) */}
                      <div className="mt-4 pt-4 border-t border-slate-800/80">
                        <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                          {t.availableServicesLabel}:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {companionServices.slice(0, 3).map((srv) => (
                            <span
                              key={srv!.id}
                              className="inline-flex items-center text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700/60 font-medium"
                              title={srv!.name}
                            >
                              {srv!.name}
                            </span>
                          ))}
                          {companionServices.length > 3 && (
                            <button
                              onClick={() => openQuickView(comp)}
                              className="text-[11px] px-2 py-1 rounded-lg bg-pink-500/10 text-pink-300 border border-pink-500/20 font-semibold hover:bg-pink-500/20 transition-colors"
                            >
                              +{companionServices.length - 3} more
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Inline alert if this specific card was clicked */}
                    {isAlerted && (
                      <div className="mt-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{bookingAlert.message}</span>
                      </div>
                    )}

                    {/* Action Buttons: Quick View & Book Now */}
                    <div className="mt-5 pt-4 border-t border-slate-800 flex items-center gap-3">
                      <button
                        onClick={() => openQuickView(comp)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t.quickViewAction}</span>
                      </button>

                      <button
                        onClick={() => handleBookNow(comp)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <CalendarCheck className="w-3.5 h-3.5" />
                        <span>{t.bookNowAction}</span>
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* QUICK VIEW PROFILE MODAL */}
      {quickViewCompanion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quick View Profile"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeQuickView();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto"
        >
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl text-slate-100 overflow-hidden my-auto max-h-[94vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-white truncate">
                  {quickViewCompanion.name} ({quickViewCompanion.age} {t.ageYearsLabel})
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                  <MapPin className="w-3 h-3 text-pink-400" />
                  {quickViewCompanion.locationFormatted || quickViewCompanion.address || quickViewCompanion.city}
                </span>
              </div>
              <button
                onClick={closeQuickView}
                aria-label="Close Quick View"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 ml-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              
              {/* COMPLETE ORIGINAL IMAGE DISPLAY (NO CROPPING) */}
              <div className="space-y-3">
                <div
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  className="relative w-full flex items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden p-2 sm:p-4 min-h-[280px] sm:min-h-[420px] max-h-[62vh]"
                >
                  <img
                    src={allQuickViewPhotos[activePhotoIdx] || quickViewCompanion.profilePhoto}
                    alt={`${quickViewCompanion.name} - Photo ${activePhotoIdx + 1}`}
                    className="max-h-[58vh] max-w-full w-auto h-auto object-contain select-none mx-auto rounded-lg shadow-2xl transition-all duration-200"
                  />

                  {/* Previous Photo Button */}
                  {allQuickViewPhotos.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePrevPhoto(); }}
                      aria-label="Previous photograph"
                      className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700/80 shadow-lg backdrop-blur transition-all active:scale-95 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}

                  {/* Next Photo Button */}
                  {allQuickViewPhotos.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleNextPhoto(); }}
                      aria-label="Next photograph"
                      className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700/80 shadow-lg backdrop-blur transition-all active:scale-95 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}

                  {/* Floating Rate Tag */}
                  <div className="absolute top-3 right-3 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg">
                    <span className="text-xs sm:text-sm font-extrabold text-amber-400">
                      {quickViewCompanion.hourlyRateFormatted}
                    </span>
                  </div>

                  {/* Image Counter Badge */}
                  {allQuickViewPhotos.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[11px] font-semibold text-slate-300 shadow">
                      {activePhotoIdx + 1} / {allQuickViewPhotos.length}
                    </div>
                  )}
                </div>

                {/* Additional Matching Photos Strip */}
                {allQuickViewPhotos.length > 1 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-300">
                        {t.additionalPhotosLabel} ({allQuickViewPhotos.length}):
                      </span>
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        Click thumbnail to view full image
                      </span>
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5">
                      {allQuickViewPhotos.map((photoUrl, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActivePhotoIdx(idx)}
                          aria-label={`View photo ${idx + 1}`}
                          className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                            activePhotoIdx === idx
                              ? 'border-pink-500 ring-2 ring-pink-500/30 scale-105 shadow-md shadow-pink-500/20'
                              : 'border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={photoUrl}
                            alt={`${quickViewCompanion.name} thumbnail ${idx + 1}`}
                            className="w-full h-full object-cover object-top"
                          />
                          {idx === 0 && (
                            <span className="absolute bottom-0 inset-x-0 bg-pink-600/90 text-white text-[9px] font-bold py-0.5 text-center leading-tight">
                              Profile
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Details & Rates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="text-xs text-slate-400 block">Location</span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-sm font-semibold text-slate-200">
                    <MapPin className="w-4 h-4 text-pink-400 shrink-0" />
                    <span>
                      {quickViewCompanion.locationFormatted || quickViewCompanion.address || quickViewCompanion.city}
                      {quickViewCompanion.distanceKm !== undefined
                        ? language === 'bn'
                          ? ` • আপনার থেকে ${quickViewCompanion.distanceKm} কিমি দূরত্বে`
                          : language === 'hi'
                          ? ` • आपसे ${quickViewCompanion.distanceKm} किमी दूरी पर`
                          : ` • ${quickViewCompanion.distanceKm} km away`
                        : ''}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">Verified Rating</span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-sm font-semibold text-amber-400">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{quickViewCompanion.rating.toFixed(2)}</span>
                    <span className="text-slate-400 text-xs font-normal">
                      ({quickViewCompanion.totalBookings} completed bookings)
                    </span>
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  About Companion
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  {quickViewCompanion.bio}
                </p>
              </div>

              {/* Full Available Services List (24-Service Catalog) */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                  {t.availableServicesLabel} ({quickViewCompanion.services.length} services)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quickViewCompanion.services.map((sid) => {
                    const srv = PAIRUP_SERVICES.find((s) => s.id === sid);
                    if (!srv) return null;
                    return (
                      <div
                        key={srv.id}
                        className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-2.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-200 leading-snug">
                            {srv.name}
                          </p>
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {srv.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Inline Booking Alert in Quick View */}
              {bookingAlert && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-medium">{bookingAlert.message}</span>
                </div>
              )}

            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 sticky bottom-0 z-10">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400">Hourly Rate</span>
                <span className="text-base font-extrabold text-amber-400">
                  {quickViewCompanion.hourlyRateFormatted}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={closeQuickView}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                >
                  {t.closeAction}
                </button>

                <button
                  onClick={() => handleBookNow(quickViewCompanion)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>{t.bookNowAction}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};

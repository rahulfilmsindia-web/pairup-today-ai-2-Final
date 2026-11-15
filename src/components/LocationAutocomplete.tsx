import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, Loader2, X } from 'lucide-react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    district?: string;
    state_district?: string;
    state?: string;
    country?: string;
    amenity?: string;
    tourism?: string;
    shop?: string;
    restaurant?: string;
    hotel?: string;
  };
  type: string;
  class: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  /** 'city' = administrative regions only; 'full' = any address/place/landmark */
  mode?: 'city' | 'full';
  accentColor?: 'amber' | 'pink';
  required?: boolean;
}

/** Returns a compact, human-friendly label from a Nominatim result */
function buildLabel(result: NominatimResult, mode: 'city' | 'full'): string {
  const a = result.address;

  if (mode === 'city') {
    // For city filter: return city/town/district + state
    const city = a.city || a.town || a.village || a.district || a.state_district || '';
    const state = a.state || '';
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (state) return state;
    // fallback to first 2 segments of display_name
    const parts = result.display_name.split(', ');
    return parts.slice(0, 2).join(', ');
  }

  // Full mode: show POI/road + locality + city + state
  const poi = a.amenity || a.tourism || a.shop || a.hotel || a.restaurant || '';
  const road = a.road || '';
  const locality = a.neighbourhood || a.suburb || '';
  const city = a.city || a.town || a.village || a.district || '';
  const state = a.state || '';

  const parts: string[] = [];
  if (poi) parts.push(poi);
  if (road && road !== poi) parts.push(road);
  if (locality) parts.push(locality);
  if (city && city !== locality) parts.push(city);
  if (state) parts.push(state);

  if (parts.length >= 2) return parts.slice(0, 4).join(', ');

  // Fallback: trim display_name to first 4 segments
  const dn = result.display_name.split(', ');
  return dn.slice(0, 4).join(', ');
}

/** Extract the city-name value from a result (for backend city filter) */
function extractCityValue(result: NominatimResult): string {
  const a = result.address;
  return a.city || a.town || a.village || a.district || a.state_district || '';
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Search any location in India...',
  className = '',
  label,
  mode = 'full',
  accentColor = 'amber',
  required = false,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<{ label: string; cityValue: string; displayName: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [noResults, setNoResults] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const accent = accentColor === 'pink' ? 'focus:border-pink-500' : 'focus:border-amber-400';
  const accentText = accentColor === 'pink' ? 'text-pink-400' : 'text-amber-400';
  const accentBg = accentColor === 'pink' ? 'bg-pink-500/10 border-pink-500/30' : 'bg-amber-400/10 border-amber-400/30';

  // Sync external value → input (e.g. when parent resets)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setNoResults(false);
      return;
    }

    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setNoResults(false);

    try {
      // Nominatim URL — India-restricted, structured JSON
      let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=IN&format=json&addressdetails=1&limit=6&accept-language=en`;

      // For city mode: restrict to administrative features
      if (mode === 'city') {
        url += '&featuretype=city&featuretype=town&featuretype=village&featuretype=district';
      }

      const res = await fetch(url, {
        signal: abortRef.current.signal,
        headers: {
          'User-Agent': 'PairUpToday/1.0 (pairuptoday.in contact@pairuptoday.in)',
          'Accept-Language': 'en',
        },
      });

      if (!res.ok) throw new Error('Nominatim error');

      const data: NominatimResult[] = await res.json();

      if (data.length === 0) {
        setSuggestions([]);
        setNoResults(true);
        setOpen(true);
      } else {
        // Deduplicate by label
        const seen = new Set<string>();
        const formatted = data
          .map(r => ({
            label: buildLabel(r, mode),
            cityValue: extractCityValue(r),
            displayName: r.display_name,
          }))
          .filter(r => {
            if (seen.has(r.label)) return false;
            seen.add(r.label);
            return true;
          });

        setSuggestions(formatted);
        setNoResults(false);
        setOpen(true);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setSuggestions([]);
        setNoResults(false);
      }
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val); // propagate free-text immediately
    setActiveIndex(-1);

    // Debounce API call
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(val), 350);
  };

  const selectSuggestion = (item: { label: string; cityValue: string }) => {
    // For city mode: use the short city name as value; for full mode: use full label
    const finalValue = mode === 'city' ? (item.cityValue || item.label) : item.label;
    setInputValue(finalValue);
    onChange(finalValue);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        selectSuggestion(suggestions[activeIndex]);
      } else {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const clearInput = () => {
    setInputValue('');
    onChange('');
    setSuggestions([]);
    setOpen(false);
    setNoResults(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-slate-400 text-xs mb-1 font-medium">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      {/* Input wrapper */}
      <div className="relative flex items-center">
        <MapPin className={`absolute left-3 w-3.5 h-3.5 ${accentText} pointer-events-none z-10`} />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          required={required}
          className={`w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none ${accent} transition-colors`}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Right side: loader or clear */}
        <div className="absolute right-2.5 flex items-center gap-1">
          {loading && (
            <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
          )}
          {!loading && inputValue && (
            <button
              type="button"
              onClick={clearInput}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              tabIndex={-1}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {noResults ? (
            <div className="px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span>No matching locations — you can type freely</span>
            </div>
          ) : (
            <ul className="max-h-56 overflow-y-auto">
              {suggestions.map((item, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault(); // prevent input blur before click fires
                      selectSuggestion(item);
                    }}
                    className={`w-full text-left px-4 py-2.5 flex items-start gap-2.5 transition-colors text-xs
                      ${idx === activeIndex
                        ? `${accentBg} text-slate-100`
                        : 'text-slate-300 hover:bg-slate-800'
                      }`}
                  >
                    <MapPin className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${idx === activeIndex ? accentText : 'text-slate-500'}`} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.label}</div>
                      {mode === 'full' && item.label !== item.displayName.split(', ').slice(0, 4).join(', ') && (
                        <div className="text-slate-500 truncate text-[10px] mt-0.5">
                          {item.displayName.split(', ').slice(0, 5).join(', ')}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Attribution (Nominatim usage policy) */}
          <div className="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-600 flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" />
            Powered by OpenStreetMap
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;

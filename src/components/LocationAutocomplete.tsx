import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, Loader2, X } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface LocationSuggestion {
  label: string;       // Primary line e.g. "1/92, Graham Road"
  sublabel: string;    // Secondary line e.g. "Azadgarh, Kolkata, West Bengal - 700040"
  cityValue: string;   // Clean city string for filtering
  key: string;         // Unique dedup key
}

export interface LocationAutocompleteProps {
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

// ─────────────────────────────────────────────────────────────
// INDIAN TYPO NORMALIZER & PIN REPAIR
// ─────────────────────────────────────────────────────────────

const COMMON_TYPOS: Record<string, string> = {
  restrurant: 'restaurant',
  restrunt: 'restaurant',
  resturant: 'restaurant',
  restaurent: 'restaurant',
  restrnt: 'restaurant',
  restro: 'restaurant',
  biriyani: 'biryani',
  briyani: 'biryani',
  tolygunj: 'tollygunge',
  tollygunj: 'tollygunge',
  toligunj: 'tollygunge',
  tolygonge: 'tollygunge',
  azadgrah: 'azadgarh',
  azadgar: 'azadgarh',
  shantigrah: 'shantigarh',
  jhatiya: 'jhatikra',
  jhatikara: 'jhatikra',
  kolkatta: 'kolkata',
  calcata: 'kolkata',
  calcutta: 'kolkata',
  bangalore: 'bengaluru',
  bombay: 'mumbai',
  poona: 'pune',
  gurgaon: 'gurugram',
};

function normalizeQueryText(text: string): string {
  let cleaned = text.trim();

  // Repair 5-digit PIN (e.g. 70040 -> 700040)
  cleaned = cleaned.replace(/\b([1-9]\d{2})(\d{2})\b/g, '$10$2');

  // Replace common typos
  for (const [typo, fix] of Object.entries(COMMON_TYPOS)) {
    const reg = new RegExp(`\\b${typo}\\b`, 'gi');
    cleaned = cleaned.replace(reg, fix);
  }

  return cleaned;
}

// Extract house/door/plot/flat prefix (e.g. "1/92", "45/B", "Plot 12", "Flat 4A")
function parseHouseNumber(raw: string): { houseNumber: string | null; cleanRemainder: string } {
  const housePattern = /^(\d+[\/\-]\d+[a-zA-Z]?|\d+[a-zA-Z]?|\b(?:flat|plot|house|h\.?no|door)\s*[\w\/\-]+)[\s,]*/i;
  const match = raw.match(housePattern);
  if (match) {
    const houseNumber = match[1].trim();
    const remainder = raw.slice(match[0].length).trim();
    return { houseNumber, cleanRemainder: remainder };
  }
  return { houseNumber: null, cleanRemainder: raw.trim() };
}

// ─────────────────────────────────────────────────────────────
// CURATED POPULAR INDIAN LANDMARKS, RESTAURANTS & LOCALITIES
// Provides instant high-fidelity matches for places like
// "Shimla Biryani", "Graham Road Azadgarh", "Jhatikra Delhi", etc.
// ─────────────────────────────────────────────────────────────

interface CuratedPlace {
  name: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  keywords: string;
}

const CURATED_PLACES: CuratedPlace[] = [
  // Kolkata & Bengal
  { name: 'Shimla Biryani Restaurant', locality: 'EM Bypass / Topsia', city: 'Kolkata', state: 'West Bengal', pincode: '700046', keywords: 'simla shimla biryani biriyani restaurant restrurant topsia em bypass' },
  { name: 'Shimla Biryani Restaurant', locality: 'VIP Road, Kaikhali', city: 'Kolkata', state: 'West Bengal', pincode: '700052', keywords: 'simla shimla biryani biriyani restaurant restrurant kaikhali vip road' },
  { name: 'Graham Road', locality: 'Azadgarh, Regent Park', city: 'Kolkata', state: 'West Bengal', pincode: '700040', keywords: 'graham road azadgarh azadgrah tollygunge tolygunj 700040 70040 shantigarh' },
  { name: 'Arsalan Restaurant', locality: 'Park Circus 7 Point', city: 'Kolkata', state: 'West Bengal', pincode: '700017', keywords: 'arsalan biryani park circus restaurant' },
  { name: 'Aminia Restaurant', locality: 'New Market, Esplanade', city: 'Kolkata', state: 'West Bengal', pincode: '700087', keywords: 'aminia biryani new market esplanade restaurant' },
  { name: 'Peter Cat Restaurant', locality: 'Park Street', city: 'Kolkata', state: 'West Bengal', pincode: '700016', keywords: 'peter cat park street restaurant chelo kebab' },
  { name: 'South City Mall', locality: 'Prince Anwar Shah Road, Jadavpur', city: 'Kolkata', state: 'West Bengal', pincode: '700068', keywords: 'south city mall jadavpur anwar shah' },
  { name: 'Starbucks Coffee', locality: 'Park Street', city: 'Kolkata', state: 'West Bengal', pincode: '700016', keywords: 'starbucks park street cafe coffee' },
  { name: 'Salt Lake Sector V', locality: 'Bidhannagar', city: 'Kolkata', state: 'West Bengal', pincode: '700091', keywords: 'salt lake sector 5 sector v bidhannagar it hub' },
  { name: 'City Centre 1', locality: 'DC Block, Salt Lake', city: 'Kolkata', state: 'West Bengal', pincode: '700064', keywords: 'city centre cc1 salt lake bidhannagar' },

  // Delhi NCR
  { name: 'Jhatikra Road', locality: 'Najafgarh', city: 'New Delhi', state: 'Delhi', pincode: '110043', keywords: 'jhatikra jhatiya najafgarh south west delhi 1/92' },
  { name: 'Connaught Place (CP)', locality: 'Inner Circle', city: 'New Delhi', state: 'Delhi', pincode: '110001', keywords: 'connaught place cp central delhi rajiv chowk' },
  { name: 'Cyber Hub', locality: 'DLF Phase 2', city: 'Gurugram', state: 'Haryana', pincode: '122002', keywords: 'cyber hub dlf gurgaon gurugram' },
  { name: 'Hauz Khas Social', locality: 'Hauz Khas Village', city: 'New Delhi', state: 'Delhi', pincode: '110016', keywords: 'hauz khas village hkv south delhi cafe restaurant' },
  { name: 'Karim\'s Restaurant', locality: 'Jama Masjid, Old Delhi', city: 'New Delhi', state: 'Delhi', pincode: '110006', keywords: 'karim karims jama masjid old delhi biryani kebabs' },
  { name: 'Khan Market', locality: 'Rabindra Nagar', city: 'New Delhi', state: 'Delhi', pincode: '110003', keywords: 'khan market south delhi shopping cafe' },

  // Mumbai
  { name: 'Bandra Bandstand', locality: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', keywords: 'bandra bandstand west mumbai seafront' },
  { name: 'Juhu Beach', locality: 'Juhu Tara Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400049', keywords: 'juhu beach vile parle west mumbai' },
  { name: 'Marine Drive', locality: 'Nariman Point', city: 'Mumbai', state: 'Maharashtra', pincode: '400021', keywords: 'marine drive queens necklace nariman point' },
  { name: 'Bastian Restaurant', locality: 'Linking Road, Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', keywords: 'bastian linking road bandra restaurant' },

  // Bengaluru
  { name: 'Indiranagar 100ft Road', locality: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', pincode: '560038', keywords: 'indiranagar 100ft road bangalore bengaluru' },
  { name: 'Koramangala 5th Block', locality: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', pincode: '560095', keywords: 'koramangala 5th block bangalore cafe pub restaurant' },
  { name: 'UB City', locality: 'Vittal Mallya Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', keywords: 'ub city vittal mallya road bangalore mall' },

  // Hyderabad
  { name: 'Paradise Biryani', locality: 'MG Road, Secunderabad', city: 'Hyderabad', state: 'Telangana', pincode: '500003', keywords: 'paradise biryani secunderabad restaurant' },
  { name: 'Gachibowli Financial District', locality: 'Gachibowli', city: 'Hyderabad', state: 'Telangana', pincode: '500032', keywords: 'gachibowli financial district hitec city hyderabad' }
];

function getCuratedMatches(
  cleanQuery: string,
  houseNo: string | null,
  mode: 'city' | 'full'
): LocationSuggestion[] {
  const norm = cleanQuery.toLowerCase();
  const words = norm.split(/[\s,]+/).filter(w => w.length >= 2);

  if (words.length === 0 && houseNo) {
    // User typed ONLY house number (e.g. "1/92") -> provide popular residential road suggestions with house number
    return CURATED_PLACES.slice(0, 5).map(p => {
      const label = `${houseNo}, ${p.name}`;
      const sublabel = `${p.locality}, ${p.city}, ${p.state} - ${p.pincode}`;
      return {
        label,
        sublabel,
        cityValue: p.city,
        key: `curated:${label}|${sublabel}`.toLowerCase(),
      };
    });
  }

  if (words.length === 0) return [];

  const matched = CURATED_PLACES.filter(p => {
    const haystack = `${p.name} ${p.locality} ${p.city} ${p.state} ${p.pincode} ${p.keywords}`.toLowerCase();
    // Match if all or most words appear in haystack
    const matchCount = words.filter(w => haystack.includes(w)).length;
    return matchCount >= Math.min(words.length, 2);
  });

  return matched.map(p => {
    if (mode === 'city') {
      return {
        label: `${p.city}, ${p.state}`,
        sublabel: `Region (PIN: ${p.pincode})`,
        cityValue: p.city,
        key: `curated:city:${p.city}`.toLowerCase(),
      };
    }
    const label = houseNo ? `${houseNo}, ${p.name}` : p.name;
    const sublabel = `${p.locality}, ${p.city}, ${p.state} - ${p.pincode}`;
    return {
      label,
      sublabel,
      cityValue: p.city,
      key: `curated:${label}|${sublabel}`.toLowerCase(),
    };
  });
}

// ─────────────────────────────────────────────────────────────
// NOMINATIM OPENSTREETMAP API (India-restricted)
// ─────────────────────────────────────────────────────────────

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    quarter?: string;
    city?: string;
    town?: string;
    village?: string;
    district?: string;
    state_district?: string;
    state?: string;
    postcode?: string;
    amenity?: string;
    tourism?: string;
    shop?: string;
    restaurant?: string;
    hotel?: string;
    leisure?: string;
    building?: string;
  };
}

function buildFromNominatim(
  r: NominatimResult,
  houseNo: string | null,
  mode: 'city' | 'full'
): LocationSuggestion | null {
  const a = r.address || {};

  if (mode === 'city') {
    const city = a.city || a.town || a.village || a.district || a.state_district || '';
    const state = a.state || '';
    const lbl = city && state ? `${city}, ${state}` : city || state;
    if (!lbl) return null;
    return {
      label: lbl,
      sublabel: state ? `State: ${state}` : 'India',
      cityValue: city || state,
      key: `nom:city:${lbl}`.toLowerCase(),
    };
  }

  const hNo = houseNo || a.house_number || '';
  const street = a.road || '';
  const poi = a.amenity || a.tourism || a.shop || a.hotel || a.restaurant || a.leisure || a.building || '';
  const locality = a.neighbourhood || a.suburb || a.quarter || '';
  const city = a.city || a.town || a.village || a.district || '';
  const state = a.state || '';
  const pin = a.postcode || '';

  const mainParts: string[] = [];
  if (poi) mainParts.push(poi);
  if (hNo && street) mainParts.push(`${hNo}, ${street}`);
  else if (hNo) mainParts.push(hNo);
  else if (street) mainParts.push(street);

  if (locality && !mainParts.some(p => p.toLowerCase().includes(locality.toLowerCase()))) {
    mainParts.push(locality);
  }
  if (city && !mainParts.some(p => p.toLowerCase().includes(city.toLowerCase()))) {
    mainParts.push(city);
  }

  const subParts: string[] = [];
  if (state) subParts.push(state);
  if (pin) subParts.push(pin);

  const label = mainParts.length > 0 ? mainParts.join(', ') : r.display_name.split(', ').slice(0, 4).join(', ');
  const sublabel = subParts.join(' - ');

  return {
    label,
    sublabel,
    cityValue: city || state,
    key: `nom:${label}|${sublabel}`.toLowerCase(),
  };
}

// ─────────────────────────────────────────────────────────────
// PHOTON (KOMOOT) API (typo/fuzzy tolerant)
// ─────────────────────────────────────────────────────────────

interface PhotonFeature {
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    suburb?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

function buildFromPhoton(
  f: PhotonFeature,
  houseNo: string | null,
  mode: 'city' | 'full'
): LocationSuggestion | null {
  const p = f.properties;
  if (p.country && !['India', 'IN'].includes(p.country)) return null;

  const hNo = houseNo || p.housenumber || '';
  const street = p.street || '';
  const name = p.name || '';
  const suburb = p.suburb || '';
  const district = p.district || '';
  const city = p.city || p.county || '';
  const state = p.state || '';
  const pin = p.postcode || '';

  if (mode === 'city') {
    const cityLabel = city || district || suburb || state;
    if (!cityLabel) return null;
    const lbl = state && cityLabel !== state ? `${cityLabel}, ${state}` : cityLabel;
    return {
      label: lbl,
      sublabel: pin ? `PIN: ${pin}` : state,
      cityValue: city || district || suburb || '',
      key: `photon:city:${lbl}`.toLowerCase(),
    };
  }

  const mainParts: string[] = [];
  if (name && name !== street) mainParts.push(name);
  if (hNo && street) mainParts.push(`${hNo}, ${street}`);
  else if (hNo) mainParts.push(hNo);
  else if (street) mainParts.push(street);

  if (suburb && !mainParts.some(x => x.toLowerCase().includes(suburb.toLowerCase()))) {
    mainParts.push(suburb);
  }
  if (city && !mainParts.some(x => x.toLowerCase().includes(city.toLowerCase()))) {
    mainParts.push(city);
  } else if (!city && district) {
    mainParts.push(district);
  }

  const subParts: string[] = [];
  if (state) subParts.push(state);
  if (pin) subParts.push(pin);

  const label = mainParts.length > 0 ? mainParts.join(', ') : (name || city || state || '');
  const sublabel = subParts.join(' - ');
  if (!label) return null;

  return {
    label,
    sublabel,
    cityValue: city || district || '',
    key: `photon:${label}|${sublabel}`.toLowerCase(),
  };
}

// ─────────────────────────────────────────────────────────────
// COMBINED SEARCH DISPATCHER
// ─────────────────────────────────────────────────────────────

async function executeSmartSearch(
  query: string,
  mode: 'city' | 'full',
  signal: AbortSignal
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { houseNumber, cleanRemainder } = parseHouseNumber(trimmed);
  const normalizedRemainder = normalizeQueryText(cleanRemainder);
  const normalizedFull = normalizeQueryText(trimmed);

  const results: LocationSuggestion[] = [];
  const seen = new Set<string>();

  const add = (item: LocationSuggestion | null) => {
    if (!item) return;
    const dedupe = item.label.toLowerCase().replace(/[\s,]+/g, '');
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    results.push(item);
  };

  // 1. Check curated high-priority places
  const curated = getCuratedMatches(normalizedRemainder || normalizedFull, houseNumber, mode);
  curated.forEach(add);

  // 2. Query Nominatim with India restriction
  try {
    const searchQuery = normalizedRemainder.length >= 2 ? normalizedRemainder : normalizedFull;
    let nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&countrycodes=IN&format=json&addressdetails=1&limit=6&accept-language=en`;
    if (mode === 'city') {
      nomUrl += '&featuretype=city&featuretype=town&featuretype=village&featuretype=district';
    }

    const res = await fetch(nomUrl, {
      signal,
      headers: { 'User-Agent': 'PairUpToday/1.0 (pairuptoday.in contact@pairuptoday.in)' },
    });

    if (res.ok) {
      const data: NominatimResult[] = await res.json();
      data.forEach(r => add(buildFromNominatim(r, houseNumber, mode)));
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
  }

  // 3. Photon API fallback/complement if we have fewer than 4 results
  if (results.length < 4) {
    try {
      const pQuery = normalizedRemainder.length >= 2 ? normalizedRemainder : normalizedFull;
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(pQuery)}&limit=6&lang=en&bbox=68.1,6.7,97.4,35.7`;
      const pRes = await fetch(photonUrl, { signal });
      if (pRes.ok) {
        const pData: { features: PhotonFeature[] } = await pRes.json();
        pData.features?.forEach(f => add(buildFromPhoton(f, houseNumber, mode)));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
    }
  }

  return results.slice(0, 6);
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
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
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
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
  const accentBg = accentColor === 'pink' ? 'bg-pink-500/15' : 'bg-amber-400/15';

  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
    if (query.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      setNoResults(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setNoResults(false);

    try {
      const data = await executeSmartSearch(query, mode, abortRef.current.signal);
      if (data.length === 0) {
        setSuggestions([]);
        setNoResults(true);
        setOpen(true);
      } else {
        setSuggestions(data);
        setNoResults(false);
        setOpen(true);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
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
    onChange(val);
    setActiveIndex(-1);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const selectSuggestion = (item: LocationSuggestion) => {
    let finalValue: string;
    if (mode === 'city') {
      finalValue = item.cityValue || item.label;
    } else {
      finalValue = item.sublabel ? `${item.label}, ${item.sublabel}` : item.label;
    }

    setInputValue(finalValue);
    onChange(finalValue);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
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

      {/* Search Input Box */}
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
        <div className="absolute right-2.5 flex items-center gap-1">
          {loading && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
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

      {/* Autocomplete Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {noResults ? (
            <div className="px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span>কোনো মিল পাওয়া যায়নি — আপনি নিজে লিখতে পারবেন</span>
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y divide-slate-800/60">
              {suggestions.map((item, idx) => (
                <li key={item.key + idx}>
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      selectSuggestion(item);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors
                      ${idx === activeIndex
                        ? `${accentBg} border-l-2 border-${accentColor === 'pink' ? 'pink-500' : 'amber-400'}`
                        : 'hover:bg-slate-800/80'
                      }`}
                  >
                    <MapPin className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${idx === activeIndex ? accentText : 'text-slate-500'}`} />
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold truncate ${idx === activeIndex ? 'text-slate-100' : 'text-slate-200'}`}>
                        {item.label}
                      </div>
                      {item.sublabel ? (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {item.sublabel}
                        </div>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Footer attribution */}
          <div className="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-slate-400" />
              Smart Address Autocomplete
            </span>
            <span className="text-[9px] text-slate-600">OpenStreetMap / Photon</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;

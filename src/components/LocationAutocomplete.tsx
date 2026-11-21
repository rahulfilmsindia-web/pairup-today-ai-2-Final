import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { MapPin, Search, Loader2, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface LocationSuggestion {
  label: string;       // Primary line (e.g. "1/92, Graham Road, Azadgarh")
  sublabel: string;    // Secondary line (e.g. "Kolkata, West Bengal - 700040")
  fullAddress: string; // Complete address: "1/92, Graham Road, Azadgarh, Kolkata, West Bengal - 700040"
  cityValue: string;   // Clean city string for filtering
  key: string;         // Unique dedup key
  lat?: number;
  lng?: number;
  placeId?: string;
  postalCode?: string;
}

export interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectLocation?: (item: LocationSuggestion) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  /** 'city' = administrative regions only; 'full' = any address/place/landmark */
  mode?: 'city' | 'full';
  accentColor?: 'amber' | 'pink';
  required?: boolean;
}

// Multilingual no-results messaging
export const NO_RESULTS_MESSAGES: Record<'en' | 'bn' | 'hi', string> = {
  en: 'No matching locations found — you can type freely',
  bn: 'কোনো মিল পাওয়া যায়নি — আপনি নিজে লিখতে পারবেন',
  hi: 'कोई परिणाम नहीं मिला — आप सीधे लिख सकते हैं',
};

// ─────────────────────────────────────────────────────────────
// PAN-INDIA AREA TO PIN CODE DICTIONARY
// Guarantees proper postal codes for Indian addresses & localities
// ─────────────────────────────────────────────────────────────

export const INDIAN_AREA_PINCODES: Record<string, string> = {
  // Kolkata & West Bengal
  'azadgarh': '700040',
  'golf garden': '700040',
  'graham road': '700040',
  'regent park': '700040',
  'ranikuthi': '700040',
  'netaji nagar': '700040',
  'jadavpur': '700032',
  'tollygunge': '700033',
  'baranagar': '700036',
  'barranagar': '700036',
  'dumdum': '700028',
  'dum dum': '700028',
  'saltlake': '700064',
  'salt lake': '700064',
  'bidhannagar': '700064',
  'sector v': '700091',
  'sector 5': '700091',
  'new town': '700156',
  'rajarhat': '700135',
  'park street': '700016',
  'ballygunge': '700019',
  'alipore': '700027',
  'behala': '700034',
  'howrah': '711101',
  'burdwan': '713101',
  'bardhaman': '713101',
  'durgapur': '713216',
  'asansol': '713301',
  'siliguri': '734001',
  'kolkata': '700001',

  // Delhi NCR
  'connaught place': '110001',
  'najafgarh': '110043',
  'jhatikra': '110043',
  'saket': '110017',
  'hauz khas': '110016',
  'karol bagh': '110005',
  'chandni chowk': '110006',
  'sector 18 noida': '201301',
  'noida': '201301',
  'cyber city gurugram': '122002',
  'gurugram': '122001',
  'gurgaon': '122001',
  'delhi': '110001',

  // Mumbai & Maharashtra
  'bandra': '400050',
  'andheri': '400058',
  'juhu': '400049',
  'colaba': '400005',
  'dadar': '400028',
  'borivali': '400092',
  'mumbai': '400001',
  'shivaji nagar pune': '411005',
  'kothrud pune': '411038',
  'pune': '411001',

  // Bengaluru & Karnataka
  'indiranagar': '560038',
  'koramangala': '560034',
  'whitefield': '560066',
  'hsr layout': '560102',
  'electronic city': '560100',
  'jayanagar': '560011',
  'bengaluru': '560001',
  'bangalore': '560001',

  // Hyderabad & Telangana
  'gachibowli': '500032',
  'hitec city': '500081',
  'banjara hills': '500034',
  'jubilee hills': '500033',
  'hyderabad': '500001',

  // Chennai & Tamil Nadu
  't nagar': '600017',
  'velachery': '600042',
  'anna nagar': '600040',
  'mylapore': '600004',
  'chennai': '600001',

  // Ahmedabad & Gujarat
  'navrangpura': '380009',
  'vastrapur': '380015',
  'satellite': '380015',
  'ahmedabad': '380001',

  // Other Major Centers
  'jaipur': '302001',
  'lucknow': '226001',
  'chandigarh': '160017',
  'indore': '452001',
  'patna': '800001',
  'bhopal': '462001',
  'nagpur': '440001',
  'kochi': '682001'
};

export function lookupPincodeForAddress(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [area, pin] of Object.entries(INDIAN_AREA_PINCODES)) {
    if (lower.includes(area)) {
      return pin;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// PAN-INDIA TYPO NORMALIZER & PHONETIC CORRECTION
// Corrects common spelling mistakes across Indian English, Bengali, and Hindi
// ─────────────────────────────────────────────────────────────

const PAN_INDIA_TYPOS: Record<string, string> = {
  // Food & Dining
  restrurant: 'restaurant',
  restrunt: 'restaurant',
  resturant: 'restaurant',
  restaurent: 'restaurant',
  restrnt: 'restaurant',
  restro: 'restaurant',
  biriyani: 'biryani',
  briyani: 'biryani',
  hotal: 'hotel',
  hotle: 'hotel',
  dhabaa: 'dhaba',
  bakeri: 'bakery',

  // Address Elements
  appartment: 'apartment',
  apartmnt: 'apartment',
  appts: 'apartments',
  bldg: 'building',
  colony: 'colony',
  colny: 'colony',
  nagr: 'nagar',
  chowk: 'chowk',
  chawk: 'chowk',
  bajar: 'bazar',
  bazzar: 'bazar',
  mkt: 'market',
  stn: 'station',
  hosp: 'hospital',

  // Common Local Area Phonetic Typos
  tolygunj: 'tollygunge',
  tollygunj: 'tollygunge',
  toligunj: 'tollygunge',
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
  baroda: 'vadodara',
  banaras: 'varanasi',
  trivandrum: 'thiruvananthapuram',
  cochin: 'kochi',
};

function normalizePanIndiaText(text: string): string {
  let cleaned = text.trim();

  // Repair 5-digit PIN (e.g. 70040 -> 700040, 11004 -> 110004, 56003 -> 560003)
  cleaned = cleaned.replace(/\b([1-9]\d{2})(\d{2})\b/g, '$10$2');

  // Replace recognized phonetic typos
  for (const [typo, fix] of Object.entries(PAN_INDIA_TYPOS)) {
    const reg = new RegExp(`\\b${typo}\\b`, 'gi');
    cleaned = cleaned.replace(reg, fix);
  }

  return cleaned;
}

// ─────────────────────────────────────────────────────────────
// HOUSE / DOOR / PLOT / FLAT NUMBER PARSER
// Preserves door numbers like "1/92", "45/A", "Plot 102", "Flat 3B", "C-24"
// ─────────────────────────────────────────────────────────────

function parseHousePrefix(raw: string): { houseNumber: string | null; cleanRemainder: string } {
  const housePattern = /^((?:flat|plot|house|h\.?no|door|shop|block|sector|sec|gali|lane)\s*[\w\/\-]+|\d+[\/\-]\d+[a-zA-Z]?|\d+[a-zA-Z]?)[\s,]*/i;
  const match = raw.match(housePattern);
  if (match) {
    const houseNumber = match[1].trim();
    const remainder = raw.slice(match[0].length).trim();
    return { houseNumber, cleanRemainder: remainder };
  }
  return { houseNumber: null, cleanRemainder: raw.trim() };
}

// ─────────────────────────────────────────────────────────────
// NOMINATIM OPENSTREETMAP API (Restricted to all of India)
// ─────────────────────────────────────────────────────────────

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat?: string;
  lon?: string;
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
    commercial?: string;
  };
}

function buildFromNominatim(
  r: NominatimResult,
  houseNo: string | null,
  mode: 'city' | 'full'
): LocationSuggestion | null {
  const a = r.address || {};
  const city = a.city || a.town || a.village || a.district || a.state_district || '';
  const state = a.state || '';
  let pin = a.postcode || (r.display_name.match(/\b([1-9]\d{5})\b/)?.[1] || '');
  if (!pin) {
    pin = lookupPincodeForAddress(`${r.display_name} ${houseNo || ''}`) || '';
  }

  const hNo = houseNo || a.house_number || '';
  const street = a.road || '';
  const poi = a.amenity || a.tourism || a.shop || a.hotel || a.restaurant || a.leisure || a.building || a.commercial || '';
  const locality = a.neighbourhood || a.suburb || a.quarter || '';

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

  const label = mainParts.length > 0 ? mainParts.join(', ') : r.display_name.split(', ').slice(0, 3).join(', ');
  const sublabel = subParts.length > 0 ? subParts.join(' - ') : (r.display_name.split(', ').slice(3, 6).join(', ') || 'India');
  let fullAddress = (sublabel && !label.includes(sublabel)) ? `${label}, ${sublabel}` : label;
  if (pin && !fullAddress.includes(pin)) {
    fullAddress = `${fullAddress} - ${pin}`;
  }

  const lat = r.lat ? parseFloat(r.lat) : undefined;
  const lng = r.lon ? parseFloat(r.lon) : undefined;

  return {
    label,
    sublabel,
    fullAddress,
    cityValue: city || state || label,
    key: `nom:${label}|${sublabel}`.toLowerCase(),
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    postalCode: pin || undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// PHOTON (KOMOOT) API (Fast Typo-Tolerant Engine for all India)
// ─────────────────────────────────────────────────────────────

interface PhotonFeature {
  geometry?: {
    coordinates?: [number, number]; // [lon, lat]
  };
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
  let pin = p.postcode || (JSON.stringify(f).match(/\b([1-9]\d{5})\b/)?.[1] || '');
  if (!pin) {
    pin = lookupPincodeForAddress(`${p.name || ''} ${p.street || ''} ${p.suburb || ''} ${p.city || ''} ${houseNo || ''}`) || '';
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
  let fullAddress = (sublabel && !label.includes(sublabel)) ? `${label}, ${sublabel}` : label;
  if (pin && !fullAddress.includes(pin)) {
    fullAddress = `${fullAddress} - ${pin}`;
  }

  const photonCoords = f.geometry?.coordinates;
  const lng = Array.isArray(photonCoords) && typeof photonCoords[0] === 'number' ? photonCoords[0] : undefined;
  const lat = Array.isArray(photonCoords) && typeof photonCoords[1] === 'number' ? photonCoords[1] : undefined;

  return {
    label,
    sublabel,
    fullAddress,
    cityValue: city || district || state || label,
    key: `photon:${label}|${sublabel}`.toLowerCase(),
    lat,
    lng,
    postalCode: pin || undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// PAN-INDIA LIVE SEARCH DISPATCHER
// Connects to:
// 1. Backend /api/maps/autocomplete (Google Places API when configured)
// 2. OpenStreetMap Nominatim API (countrycodes=IN)
// 3. Photon Geocoding API (India geographical center bias: lat 20.5937, lon 78.9629)
// ─────────────────────────────────────────────────────────────

async function executePanIndiaSearch(
  query: string,
  mode: 'city' | 'full',
  signal: AbortSignal
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { houseNumber, cleanRemainder } = parseHousePrefix(trimmed);
  const normalizedRemainder = normalizePanIndiaText(cleanRemainder);
  const normalizedFull = normalizePanIndiaText(trimmed);

  const results: LocationSuggestion[] = [];
  const seen = new Set<string>();

  const addResult = (item: LocationSuggestion | null) => {
    if (!item) return;
    const dedupe = item.label.toLowerCase().replace(/[\s,.\-]+/g, '');
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    results.push(item);
  };

  // 1. Try Backend Google Places API Endpoint (when configured)
  try {
    const mapsRes = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(normalizedFull)}`, { signal });
    if (mapsRes.ok) {
      const mapsData = await mapsRes.json();
      if (Array.isArray(mapsData.predictions) && mapsData.predictions.length > 0) {
        for (const p of mapsData.predictions) {
          const mainText = p.structured_formatting?.main_text || p.description.split(',')[0];
          const secondary = p.structured_formatting?.secondary_text || p.description.split(',').slice(1).join(',').trim();
          let baseAddress = p.description || (secondary ? `${mainText}, ${secondary}` : mainText);
          const detectedPin = baseAddress.match(/\b([1-9]\d{5})\b/)?.[1] || lookupPincodeForAddress(baseAddress) || lookupPincodeForAddress(mainText) || '';
          if (detectedPin && !baseAddress.includes(detectedPin)) {
            baseAddress = `${baseAddress} - ${detectedPin}`;
          }
          addResult({
            label: mainText,
            sublabel: secondary ? (detectedPin && !secondary.includes(detectedPin) ? `${secondary} - ${detectedPin}` : secondary) : (detectedPin || 'India'),
            fullAddress: baseAddress,
            cityValue: secondary.split(',')[0]?.trim() || mainText,
            key: `gmaps:${p.place_id || p.description}`.toLowerCase(),
            placeId: p.place_id,
            postalCode: detectedPin || undefined
          });
        }
        if (results.length >= 5) return results.slice(0, 6);
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
  }

  // 2. Query OpenStreetMap Nominatim API (restricted to India)
  try {
    const searchQuery = normalizedRemainder.length >= 2 ? normalizedRemainder : normalizedFull;
    let nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&countrycodes=IN&format=json&addressdetails=1&limit=8&accept-language=en`;
    if (mode === 'city') {
      nomUrl += '&featuretype=city&featuretype=town&featuretype=village&featuretype=district';
    }

    const nomRes = await fetch(nomUrl, {
      signal,
      headers: {
        'User-Agent': 'PairUpToday/1.0 (pairuptoday.in contact@pairuptoday.in)',
        'Accept': 'application/json',
      },
    });

    if (nomRes.ok) {
      const text = await nomRes.text();
      if (text.startsWith('[')) {
        const nomData: NominatimResult[] = JSON.parse(text);
        nomData.forEach(r => addResult(buildFromNominatim(r, houseNumber, mode)));
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
  }

  // 3. Query Photon API (India-wide fuzzy & typo-tolerant geocoding)
  if (results.length < 5) {
    try {
      const pQuery = normalizedRemainder.length >= 2 ? normalizedRemainder : normalizedFull;
      // Lat 20.5937 & Lon 78.9629 biases results towards the geographic center of India
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(pQuery)}&limit=8&lang=en&lat=20.5937&lon=78.9629`;
      const pRes = await fetch(photonUrl, {
        signal,
        headers: { 'Accept': 'application/json' },
      });

      if (pRes.ok) {
        const pText = await pRes.text();
        if (pText.startsWith('{')) {
          const pData: { features: PhotonFeature[] } = JSON.parse(pText);
          pData.features?.forEach(f => addResult(buildFromPhoton(f, houseNumber, mode)));
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
    }
  }

  // 4. Special fallback: if user typed ONLY a house/door number (e.g. "1/92") and no street yet
  if (results.length === 0 && houseNumber && !cleanRemainder) {
    const popularHubs = [
      { area: 'Graham Road, Azadgarh, Regent Park', city: 'Kolkata', state: 'West Bengal', pin: '700040' },
      { area: 'Jhatikra Road, Najafgarh', city: 'New Delhi', state: 'Delhi', pin: '110043' },
      { area: 'Connaught Place, Central Delhi', city: 'New Delhi', state: 'Delhi', pin: '110001' },
      { area: 'Bandra West, Linking Road', city: 'Mumbai', state: 'Maharashtra', pin: '400050' },
      { area: 'Indiranagar 100ft Road', city: 'Bengaluru', state: 'Karnataka', pin: '560038' },
      { area: 'Salt Lake Sector 1, Bidhannagar', city: 'Kolkata', state: 'West Bengal', pin: '700064' },
      { area: 'Gachibowli Financial District', city: 'Hyderabad', state: 'Telangana', pin: '500032' },
      { area: 'Sector 18 Market', city: 'Noida', state: 'Uttar Pradesh', pin: '201301' },
    ];
    popularHubs.forEach(hub => {
      const label = `${houseNumber}, ${hub.area}`;
      const sublabel = `${hub.city}, ${hub.state} - ${hub.pin}`;
      addResult({
        label,
        sublabel,
        fullAddress: `${label}, ${sublabel}`,
        cityValue: hub.city,
        key: `hub:${houseNumber}:${hub.area}`.toLowerCase(),
      });
    });
  }

  return results.slice(0, 6);
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  onSelectLocation,
  placeholder = 'Search any address, street, hotel, restaurant in India...',
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

  // Resolve current active language safely
  let currentLanguage: 'en' | 'bn' | 'hi' = 'en';
  try {
    const langCtx = useLanguage();
    if (langCtx?.language) {
      currentLanguage = langCtx.language;
    }
  } catch {
    try {
      const savedLang = localStorage.getItem('pairup_language') as 'en' | 'bn' | 'hi';
      if (savedLang === 'bn' || savedLang === 'hi' || savedLang === 'en') {
        currentLanguage = savedLang;
      }
    } catch {
      // ignore
    }
  }

  const defaultPlaceholder = currentLanguage === 'bn'
    ? 'ভারতে যেকোনো ঠিকানা, রাস্তা, হোটেল বা এলাকা সার্চ করুন...'
    : currentLanguage === 'hi'
    ? 'भारत में कोई भी पता, सड़क, होटल या स्थान खोजें...'
    : 'Search any address, street, hotel, restaurant in India...';

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
      const data = await executePanIndiaSearch(query, mode, abortRef.current.signal);
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

  const selectSuggestion = async (item: LocationSuggestion) => {
    // Always select the complete, full proper address:
    // e.g. "1/92, Golf Garden, Kolkata, West Bengal - 700040"
    let finalValue = item.fullAddress || (item.sublabel ? `${item.label}, ${item.sublabel}` : item.label);

    // 1. If Google PlaceId is available and finalValue does not yet have a PIN code, try geocoding
    if (item.placeId && !finalValue.match(/\b[1-9]\d{5}\b/)) {
      try {
        const geoRes = await fetch(`/api/maps/geocode?place_id=${encodeURIComponent(item.placeId)}`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.formatted_address) {
            finalValue = geoData.formatted_address;
          }
          if (typeof geoData.latitude === 'number' && typeof geoData.longitude === 'number') {
            item.lat = geoData.latitude;
            item.lng = geoData.longitude;
          }
        }
      } catch (e) {
        // Fallback to local pin lookup
      }
    }

    // 2. Guarantee 6-digit Indian PIN code is attached if missing
    if (!finalValue.match(/\b[1-9]\d{5}\b/)) {
      const pin = item.postalCode || lookupPincodeForAddress(finalValue) || lookupPincodeForAddress(inputValue);
      if (pin) {
        finalValue = `${finalValue} - ${pin}`;
      }
    }

    setInputValue(finalValue);
    onChange(finalValue);
    if (onSelectLocation) {
      onSelectLocation({ ...item, fullAddress: finalValue });
    }
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
    if (onSelectLocation) {
      onSelectLocation({ label: '', sublabel: '', fullAddress: '', cityValue: '', key: '' });
    }
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

      {/* Input */}
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
          placeholder={placeholder || defaultPlaceholder}
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

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {noResults ? (
            <div className="px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{NO_RESULTS_MESSAGES[currentLanguage] || NO_RESULTS_MESSAGES.en}</span>
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
                    onTouchEnd={e => {
                      e.preventDefault();
                      selectSuggestion(item);
                    }}
                    onClick={() => selectSuggestion(item)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer
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

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-slate-400" />
              India Address & Landmark Autocomplete
            </span>
            <span className="text-[9px] text-slate-600">All India Coverage</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;

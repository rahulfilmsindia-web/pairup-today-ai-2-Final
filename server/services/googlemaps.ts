/**
 * Google Maps and Places API Integration Service
 * For location-based companion discovery, geocoding, and booking locations
 */

export interface AutocompletePrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

export interface GeocodeResult {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

export interface DistanceMatrixResult {
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
  status: string;
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

/**
 * Fallback India-wide place predictions using OpenStreetMap Nominatim & Photon
 */
export async function getFallbackIndiaPredictions(input: string): Promise<AutocompletePrediction[]> {
  const predictions: AutocompletePrediction[] = [];
  const seen = new Set<string>();

  // 1. Nominatim (India-restricted)
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&countrycodes=IN&format=json&addressdetails=1&limit=8&accept-language=en`;
    const res = await fetch(nomUrl, {
      signal: AbortSignal.timeout(2_500),
      headers: {
        'User-Agent': 'PairUpToday/1.0 (pairuptoday.in contact@pairuptoday.in)',
        'Accept': 'application/json'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const r of data) {
          const parts = (r.display_name || '').split(', ');
          const main = parts.slice(0, 2).join(', ');
          const secondary = parts.slice(2).join(', ');
          const key = main.toLowerCase().replace(/[\s,.\-]+/g, '');
          if (!seen.has(key)) {
            seen.add(key);
            predictions.push({
              description: r.display_name,
              place_id: `osm_${r.place_id}`,
              structured_formatting: {
                main_text: main,
                secondary_text: secondary || 'India'
              }
            });
          }
        }
      }
    }
  } catch (e: any) {
    // Continue to Photon
  }

  // 2. Photon (India geographical center bias: lat 20.5937, lon 78.9629)
  if (predictions.length < 5) {
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(input)}&limit=8&lang=en&lat=20.5937&lon=78.9629`;
      const res = await fetch(photonUrl, {
        signal: AbortSignal.timeout(5_000),
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const text = await res.text();
        if (text.startsWith('{')) {
          const data = JSON.parse(text);
          for (const f of (data.features || [])) {
            const p = f.properties;
            if (p.country && !['India', 'IN'].includes(p.country)) continue;
            const main = [p.name || '', p.housenumber || '', p.street || ''].filter(Boolean).join(' ') || p.city || p.district || '';
            const sec = [p.suburb, p.city || p.district, p.state, p.postcode].filter(Boolean).join(', ');
            const full = [main, sec].filter(Boolean).join(', ');
            const key = main.toLowerCase().replace(/[\s,.\-]+/g, '');
            if (main && !seen.has(key)) {
              seen.add(key);
              predictions.push({
                description: full,
                place_id: `photon_${p.osm_id || Math.random()}`,
                structured_formatting: {
                  main_text: main,
                  secondary_text: sec || 'India'
                }
              });
            }
          }
        }
      }
    } catch (e: any) {
      // Ignore
    }
  }

  return predictions;
}

/**
 * Get place autocomplete predictions
 */
export async function getPlaceAutocomplete(
  input: string,
  location?: { lat: number; lng: number },
  radius?: number
): Promise<AutocompletePrediction[]> {
  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY') {
    try {
      const params = new URLSearchParams({
        input,
        key: GOOGLE_MAPS_API_KEY,
        components: 'country:IN', // Restrict to all of India
      });

      if (location && radius) {
        params.append('location', `${location.lat},${location.lng}`);
        params.append('radius', radius.toString());
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
        { signal: AbortSignal.timeout(2_500) }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && Array.isArray(data.predictions)) {
          return data.predictions;
        }
        if (data.status === 'ZERO_RESULTS') {
          return [];
        }
        console.warn(`[GooglePlaces] API status '${data.status}': ${data.error_message || 'Falling back to India OSM geocoder'}`);
      } else {
        console.warn(`[GooglePlaces] HTTP ${response.status}: Falling back to India OSM geocoder`);
      }
    } catch (error: any) {
      console.warn(`[GooglePlaces] Error: ${error.message}. Falling back to India OSM geocoder`);
    }
  }

  // Fallback to high-speed server-side India geocoder
  return getFallbackIndiaPredictions(input);
}

/**
 * Geocode an address or place ID to get coordinates
 */
export async function geocodeAddress(
  addressOrPlaceId: string,
  isPlaceId = false
): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key is not configured.');
  }

  try {
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY
    });

    if (isPlaceId) {
      params.append('place_id', addressOrPlaceId);
    } else {
      params.append('address', addressOrPlaceId);
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!response.ok) throw new Error(`Google Geocoding returned HTTP ${response.status}.`);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return data.results[0];
    }

    if (data.status === 'ZERO_RESULTS') return null;
    throw new Error(`Google Geocoding failed: ${data.status || 'invalid response'}.`);
  } catch (error) {
    console.error('Failed to geocode address:', error);
    throw error;
  }
}

/**
 * Reverse geocode coordinates to get address
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    try {
      const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'User-Agent': 'PairUpToday/1.0' },
        signal: AbortSignal.timeout(3000)
      });
      if (nomRes.ok) {
        const nomData: any = await nomRes.json();
        return {
          formatted_address: nomData.display_name || `${lat}, ${lng}`,
          geometry: { location: { lat, lng } },
          place_id: String(nomData.place_id || 'osm'),
          address_components: []
        };
      }
    } catch {}
    return {
      formatted_address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      geometry: { location: { lat, lng } },
      place_id: 'coords',
      address_components: []
    };
  }

  try {
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      latlng: `${lat},${lng}`
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!response.ok) throw new Error(`Google reverse geocoding returned HTTP ${response.status}.`);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return data.results[0];
    }

    if (data.status === 'ZERO_RESULTS') return null;
    throw new Error(`Google reverse geocoding failed: ${data.status || 'invalid response'}.`);
  } catch (error) {
    console.error('Failed to reverse geocode:', error);
    throw error;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Fallback when Distance Matrix API is not available
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get distance and duration between two places using Distance Matrix API
 */
export async function getDistanceMatrix(
  origins: Array<{ lat: number; lng: number }>,
  destinations: Array<{ lat: number; lng: number }>
): Promise<DistanceMatrixResult[][]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key is not configured.');
  }

  try {
    const originStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
    const destStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');

    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      origins: originStr,
      destinations: destStr,
      mode: 'driving',
      units: 'metric'
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!response.ok) throw new Error(`Google Distance Matrix returned HTTP ${response.status}.`);
    const data = await response.json();

    if (data.status === 'OK' && data.rows) {
      return data.rows.map((row: any) => row.elements);
    }

    throw new Error(`Google Distance Matrix failed: ${data.status || 'invalid response'}.`);
  } catch (error) {
    console.error('Failed to get distance matrix:', error);
    throw error;
  }
}

/**
 * Find nearby companions within a given radius
 */
export function findNearbyCompanions(
  userLocation: { lat: number; lng: number },
  companions: Array<{ id: string; latitude?: number; longitude?: number }>,
  radiusKm: number = 50
): Array<{ companion: any; distanceKm: number }> {
  return companions
    .map(companion => {
      if (!companion.latitude || !companion.longitude) {
        return null;
      }
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        companion.latitude,
        companion.longitude
      );
      return { companion, distanceKm: distance };
    })
    .filter((item): item is { companion: any; distanceKm: number } => {
      return item !== null && item.distanceKm <= radiusKm;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Format address components for display
 */
export function formatAddressFromComponents(
  components: GeocodeResult['address_components']
): string {
  if (!components) return '';

  const parts: string[] = [];
  const seen = new Set<string>();

  for (const component of components) {
    if (component.types.includes('locality') && !seen.has('locality')) {
      parts.push(component.long_name);
      seen.add('locality');
    } else if (component.types.includes('administrative_area_level_1') && !seen.has('state')) {
      parts.push(component.long_name);
      seen.add('state');
    } else if (component.types.includes('country') && !seen.has('country')) {
      parts.push(component.long_name);
      seen.add('country');
    }
  }

  return parts.join(', ');
}

/**
 * Check if Google Maps is configured
 */
export function isGoogleMapsConfigured(): boolean {
  return !!GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY';
}

const directionsCache = new Map<string, { route: any; expiresAt: number }>();

/**
 * Get cached Google Directions route polyline once (Zero redundant API calls)
 */
export async function getDirectionsRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{
  points: [number, number][];
  distanceKm: number;
  durationMins: number;
  encodedPolyline?: string;
}> {
  const cacheKey = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}->${destination.lat.toFixed(3)},${destination.lng.toFixed(3)}`;
  const cached = directionsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.route;
  }

  // Calculate local Haversine distance as base ground-truth
  const distKm = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  const estMins = Math.max(1, Math.round((distKm / 22) * 60)); // 22 km/h city average

  // Generate smooth fallback points between origin and destination
  const fallbackPoints: [number, number][] = [
    [origin.lat, origin.lng],
    [origin.lat + (destination.lat - origin.lat) * 0.33, origin.lng + (destination.lng - origin.lng) * 0.33],
    [origin.lat + (destination.lat - origin.lat) * 0.66, origin.lng + (destination.lng - origin.lng) * 0.66],
    [destination.lat, destination.lng]
  ];

  let result = {
    points: fallbackPoints,
    distanceKm: parseFloat(distKm.toFixed(1)),
    durationMins: estMins,
    encodedPolyline: ''
  };

  if (isGoogleMapsConfigured()) {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.routes && data.routes[0]) {
          const route = data.routes[0];
          const leg = route.legs?.[0];
          const points: [number, number][] = [];
          if (leg?.steps) {
            for (const step of leg.steps) {
              if (step.start_location) points.push([step.start_location.lat, step.start_location.lng]);
              if (step.end_location) points.push([step.end_location.lat, step.end_location.lng]);
            }
          }
          result = {
            points: points.length > 0 ? points : fallbackPoints,
            distanceKm: leg?.distance?.value ? parseFloat((leg.distance.value / 1000).toFixed(1)) : parseFloat(distKm.toFixed(1)),
            durationMins: leg?.duration?.value ? Math.max(1, Math.round(leg.duration.value / 60)) : estMins,
            encodedPolyline: route.overview_polyline?.points || ''
          };
        }
      }
    } catch (e) {
      console.warn('Google Directions API notice, applying local Haversine route:', e);
    }
  }

  // Cache for 2 hours to protect $200 free credit
  directionsCache.set(cacheKey, { route: result, expiresAt: Date.now() + 2 * 3600 * 1000 });
  return result;
}


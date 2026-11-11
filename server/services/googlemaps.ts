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
 * Get place autocomplete predictions
 */
export async function getPlaceAutocomplete(
  input: string,
  location?: { lat: number; lng: number },
  radius?: number
): Promise<AutocompletePrediction[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      input,
      key: GOOGLE_MAPS_API_KEY,
      components: 'country:IN', // Restrict to India
      types: 'geocode|establishment'
    });

    if (location && radius) {
      params.append('location', `${location.lat},${location.lng}`);
      params.append('radius', radius.toString());
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.predictions) {
      return data.predictions;
    }

    console.error('Place autocomplete error:', data.status, data.error_message);
    return [];
  } catch (error) {
    console.error('Failed to fetch place autocomplete:', error);
    return [];
  }
}

/**
 * Geocode an address or place ID to get coordinates
 */
export async function geocodeAddress(
  addressOrPlaceId: string,
  isPlaceId = false
): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured');
    return null;
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
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return data.results[0];
    }

    console.error('Geocoding error:', data.status, data.error_message);
    return null;
  } catch (error) {
    console.error('Failed to geocode address:', error);
    return null;
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
    console.warn('Google Maps API key not configured');
    return null;
  }

  try {
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      latlng: `${lat},${lng}`
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return data.results[0];
    }

    console.error('Reverse geocoding error:', data.status, data.error_message);
    return null;
  } catch (error) {
    console.error('Failed to reverse geocode:', error);
    return null;
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
): Promise<DistanceMatrixResult[][] | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured');
    return null;
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
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.rows) {
      return data.rows.map((row: any) => row.elements);
    }

    console.error('Distance Matrix error:', data.status, data.error_message);
    return null;
  } catch (error) {
    console.error('Failed to get distance matrix:', error);
    return null;
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

/**
 * Geolocation utility for EKSU Digital Marketplace
 * Handles GPS coordinates, campus location mapping, and distance calculations
 */

export interface CampusLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export const CAMPUS_LOCATIONS: CampusLocation[] = [
  {
    id: "eksu_campus",
    name: "EKSU Campus",
    latitude: 7.6556,
    longitude: 5.2247,
    radiusKm: 1.5,
  },
  {
    id: "ado_ekiti",
    name: "Ado Ekiti",
    latitude: 7.6211,
    longitude: 5.2207,
    radiusKm: 8,
  },
  {
    id: "iworoko",
    name: "Iworoko",
    latitude: 7.6789,
    longitude: 5.2456,
    radiusKm: 2,
  },
  {
    id: "osekita",
    name: "Osekita",
    latitude: 7.6323,
    longitude: 5.1956,
    radiusKm: 1.5,
  },
];

export const EKSU_MAIN_CAMPUS = CAMPUS_LOCATIONS.find(l => l.id === "eksu_campus")!;

export type LocationLevel = 
  | "on_campus" 
  | "near_campus" 
  | "iworoko" 
  | "osekita" 
  | "ado_ekiti" 
  | "ekiti_state" 
  | "far_away" 
  | "unknown";

export interface GeolocationInfo {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: number | null;
  displayName: string;
  shortName: string;
  distanceFromCampus: number | null;
  locationLevel: LocationLevel;
  nearestLocation: CampusLocation | null;
  isOnCampus: boolean;
}

/**
 * Calculate the distance between two geographic coordinates using the Haversine formula
 * @returns Distance in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  
  const toRad = (deg: number) => deg * (Math.PI / 180);
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Format distance for display
 */
export function formatDistance(distanceInKm: number): string {
  if (distanceInKm < 0.1) {
    return "< 100m";
  } else if (distanceInKm < 1) {
    const meters = Math.round(distanceInKm * 1000);
    return `${meters}m`;
  } else if (distanceInKm < 10) {
    return `${distanceInKm.toFixed(1)}km`;
  } else {
    return `${Math.round(distanceInKm)}km`;
  }
}

/**
 * Find the nearest campus location to given coordinates
 */
export function findNearestLocation(lat: number, lng: number): { location: CampusLocation; distance: number } | null {
  let nearestLocation: CampusLocation | null = null;
  let minDistance = Infinity;

  for (const location of CAMPUS_LOCATIONS) {
    const distance = calculateHaversineDistance(lat, lng, location.latitude, location.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearestLocation = location;
    }
  }

  if (nearestLocation) {
    return { location: nearestLocation, distance: minDistance };
  }
  return null;
}

/**
 * Map coordinates to a known campus location
 */
export function mapToLocationName(lat: number, lng: number): GeolocationInfo {
  const distanceFromCampus = calculateHaversineDistance(lat, lng, EKSU_MAIN_CAMPUS.latitude, EKSU_MAIN_CAMPUS.longitude);
  const nearest = findNearestLocation(lat, lng);
  
  // Check EKSU Campus first (priority)
  if (distanceFromCampus <= EKSU_MAIN_CAMPUS.radiusKm) {
    return {
      latitude: lat,
      longitude: lng,
      accuracy: null,
      timestamp: Date.now(),
      displayName: "EKSU Campus",
      shortName: "Campus",
      distanceFromCampus,
      locationLevel: "on_campus",
      nearestLocation: EKSU_MAIN_CAMPUS,
      isOnCampus: true,
    };
  }

  // Check if near campus (within 3km)
  if (distanceFromCampus <= 3) {
    return {
      latitude: lat,
      longitude: lng,
      accuracy: null,
      timestamp: Date.now(),
      displayName: `${formatDistance(distanceFromCampus)} from EKSU`,
      shortName: "Near EKSU",
      distanceFromCampus,
      locationLevel: "near_campus",
      nearestLocation: EKSU_MAIN_CAMPUS,
      isOnCampus: false,
    };
  }

  // Check Iworoko
  const iworoko = CAMPUS_LOCATIONS.find(l => l.id === "iworoko")!;
  const distanceFromIworoko = calculateHaversineDistance(lat, lng, iworoko.latitude, iworoko.longitude);
  if (distanceFromIworoko <= iworoko.radiusKm) {
    return {
      latitude: lat,
      longitude: lng,
      accuracy: null,
      timestamp: Date.now(),
      displayName: "Iworoko",
      shortName: "Iworoko",
      distanceFromCampus,
      locationLevel: "iworoko",
      nearestLocation: iworoko,
      isOnCampus: false,
    };
  }

  // Check Osekita
  const osekita = CAMPUS_LOCATIONS.find(l => l.id === "osekita")!;
  const distanceFromOsekita = calculateHaversineDistance(lat, lng, osekita.latitude, osekita.longitude);
  if (distanceFromOsekita <= osekita.radiusKm) {
    return {
      latitude: lat,
      longitude: lng,
      accuracy: null,
      timestamp: Date.now(),
      displayName: "Osekita",
      shortName: "Osekita",
      distanceFromCampus,
      locationLevel: "osekita",
      nearestLocation: osekita,
      isOnCampus: false,
    };
  }

  // Check Ado Ekiti (larger radius, lower priority)
  const adoEkiti = CAMPUS_LOCATIONS.find(l => l.id === "ado_ekiti")!;
  const distanceFromAdo = calculateHaversineDistance(lat, lng, adoEkiti.latitude, adoEkiti.longitude);
  if (distanceFromAdo <= adoEkiti.radiusKm) {
    return {
      latitude: lat,
      longitude: lng,
      accuracy: null,
      timestamp: Date.now(),
      displayName: "Ado Ekiti",
      shortName: "Ado",
      distanceFromCampus,
      locationLevel: "ado_ekiti",
      nearestLocation: adoEkiti,
      isOnCampus: false,
    };
  }

  // Check if still in Ekiti State (within ~50km of Ado)
  if (distanceFromAdo <= 50) {
    return {
      latitude: lat,
      longitude: lng,
      accuracy: null,
      timestamp: Date.now(),
      displayName: "Ekiti State",
      shortName: "Ekiti",
      distanceFromCampus,
      locationLevel: "ekiti_state",
      nearestLocation: nearest?.location || null,
      isOnCampus: false,
    };
  }

  // Far away
  return {
    latitude: lat,
    longitude: lng,
    accuracy: null,
    timestamp: Date.now(),
    displayName: `${formatDistance(distanceFromCampus)} away`,
    shortName: "Far",
    distanceFromCampus,
    locationLevel: "far_away",
    nearestLocation: nearest?.location || null,
    isOnCampus: false,
  };
}

/**
 * Get an unknown location placeholder
 */
export function getUnknownLocation(): GeolocationInfo {
  return {
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
    displayName: "",
    shortName: "",
    distanceFromCampus: null,
    locationLevel: "unknown",
    nearestLocation: null,
    isOnCampus: false,
  };
}

/**
 * Calculate distance between user and seller
 * @returns Formatted distance string or null if coordinates are invalid
 */
export function getDistanceToSeller(
  userLat: number | string | null | undefined,
  userLng: number | string | null | undefined,
  sellerLat: number | string | null | undefined,
  sellerLng: number | string | null | undefined
): string | null {
  const parsedUserLat = typeof userLat === 'string' ? parseFloat(userLat) : userLat;
  const parsedUserLng = typeof userLng === 'string' ? parseFloat(userLng) : userLng;
  const parsedSellerLat = typeof sellerLat === 'string' ? parseFloat(sellerLat) : sellerLat;
  const parsedSellerLng = typeof sellerLng === 'string' ? parseFloat(sellerLng) : sellerLng;

  if (
    parsedUserLat == null || isNaN(parsedUserLat) ||
    parsedUserLng == null || isNaN(parsedUserLng) ||
    parsedSellerLat == null || isNaN(parsedSellerLat) ||
    parsedSellerLng == null || isNaN(parsedSellerLng)
  ) {
    return null;
  }

  const distance = calculateHaversineDistance(
    parsedUserLat,
    parsedUserLng,
    parsedSellerLat,
    parsedSellerLng
  );

  return formatDistance(distance);
}

/**
 * Get seller's location display name from coordinates
 */
export function getSellerLocationName(
  sellerLat: number | string | null | undefined,
  sellerLng: number | string | null | undefined
): string | null {
  const parsedLat = typeof sellerLat === 'string' ? parseFloat(sellerLat) : sellerLat;
  const parsedLng = typeof sellerLng === 'string' ? parseFloat(sellerLng) : sellerLng;

  if (parsedLat == null || isNaN(parsedLat) || parsedLng == null || isNaN(parsedLng)) {
    return null;
  }

  const locationInfo = mapToLocationName(parsedLat, parsedLng);
  return locationInfo.shortName || locationInfo.displayName;
}

// Geolocation caching
let cachedPosition: GeolocationInfo | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get current position using browser geolocation API
 * Returns cached result if available and not expired
 */
export async function getCurrentPosition(options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  forceRefresh?: boolean;
}): Promise<GeolocationInfo> {
  const {
    enableHighAccuracy = false,
    timeout = 10000,
    maximumAge = 300000,
    forceRefresh = false,
  } = options || {};

  // Return cached position if valid and not forcing refresh
  if (!forceRefresh && cachedPosition && Date.now() - lastFetchTime < CACHE_DURATION_MS) {
    return cachedPosition;
  }

  // Check if geolocation is supported
  if (!navigator.geolocation) {
    return getUnknownLocation();
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy,
          timeout,
          maximumAge,
        }
      );
    });

    const locationInfo = mapToLocationName(
      position.coords.latitude,
      position.coords.longitude
    );

    // Add accuracy info
    locationInfo.accuracy = position.coords.accuracy;
    locationInfo.timestamp = position.timestamp;

    // Cache the result
    cachedPosition = locationInfo;
    lastFetchTime = Date.now();

    return locationInfo;
  } catch (error) {
    // Try fallback to IP-based location
    try {
      const response = await fetch('https://ipapi.co/json/', {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.latitude && data.longitude) {
          const locationInfo = mapToLocationName(data.latitude, data.longitude);
          cachedPosition = locationInfo;
          lastFetchTime = Date.now();
          return locationInfo;
        }
      }
    } catch {
      // IP lookup failed silently
    }

    return getUnknownLocation();
  }
}

/**
 * Clear cached position
 */
export function clearLocationCache(): void {
  cachedPosition = null;
  lastFetchTime = 0;
}

/**
 * Get location level color for styling
 */
export function getLocationLevelColor(level: LocationLevel): string {
  switch (level) {
    case "on_campus":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "near_campus":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "iworoko":
    case "osekita":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "ado_ekiti":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "ekiti_state":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400";
    case "far_away":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/**
 * Get location icon name for display
 */
export function getLocationIcon(level: LocationLevel): "school" | "map-pin" | "map" | "globe" {
  switch (level) {
    case "on_campus":
      return "school";
    case "near_campus":
    case "iworoko":
    case "osekita":
    case "ado_ekiti":
      return "map-pin";
    case "ekiti_state":
      return "map";
    default:
      return "globe";
  }
}

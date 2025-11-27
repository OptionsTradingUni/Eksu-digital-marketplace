const EKSU_CAMPUS = {
  lat: 7.6451,
  lng: 5.2247,
  radiusKm: 1.5
};

const ADO_EKITI = {
  lat: 7.6211,
  lng: 5.2349,
  radiusKm: 15
};

const EKITI_STATE = {
  lat: 7.7000,
  lng: 5.3000,
  radiusKm: 100
};

export interface LocationInfo {
  latitude: number | null;
  longitude: number | null;
  displayText: string;
  distanceKm: number | null;
  isOnCampus: boolean;
  locationLevel: 'campus' | 'ado_ekiti' | 'ekiti_state' | 'far_away' | 'unknown';
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function getLocationDisplayText(lat: number, lng: number): LocationInfo {
  const distanceFromCampus = calculateDistance(lat, lng, EKSU_CAMPUS.lat, EKSU_CAMPUS.lng);
  const distanceFromAdo = calculateDistance(lat, lng, ADO_EKITI.lat, ADO_EKITI.lng);
  const distanceFromEkiti = calculateDistance(lat, lng, EKITI_STATE.lat, EKITI_STATE.lng);

  if (distanceFromCampus <= EKSU_CAMPUS.radiusKm) {
    return {
      latitude: lat,
      longitude: lng,
      displayText: "On Campus · EKSU",
      distanceKm: distanceFromCampus,
      isOnCampus: true,
      locationLevel: 'campus'
    };
  }

  if (distanceFromCampus <= 3) {
    return {
      latitude: lat,
      longitude: lng,
      displayText: `${distanceFromCampus.toFixed(1)}km · Near EKSU`,
      distanceKm: distanceFromCampus,
      isOnCampus: false,
      locationLevel: 'campus'
    };
  }

  if (distanceFromAdo <= ADO_EKITI.radiusKm) {
    return {
      latitude: lat,
      longitude: lng,
      displayText: "In Ado-Ekiti",
      distanceKm: distanceFromCampus,
      isOnCampus: false,
      locationLevel: 'ado_ekiti'
    };
  }

  if (distanceFromEkiti <= EKITI_STATE.radiusKm) {
    return {
      latitude: lat,
      longitude: lng,
      displayText: "In Ekiti State",
      distanceKm: distanceFromCampus,
      isOnCampus: false,
      locationLevel: 'ekiti_state'
    };
  }

  return {
    latitude: lat,
    longitude: lng,
    displayText: "Far away · Outside Ekiti",
    distanceKm: distanceFromCampus,
    isOnCampus: false,
    locationLevel: 'far_away'
  };
}

export function getUnknownLocation(): LocationInfo {
  return {
    latitude: null,
    longitude: null,
    displayText: "",
    distanceKm: null,
    isOnCampus: false,
    locationLevel: 'unknown'
  };
}

let cachedLocation: LocationInfo | null = null;
let lastLocationFetch: number = 0;
const LOCATION_CACHE_MS = 5 * 60 * 1000;

export async function getCurrentLocation(): Promise<LocationInfo> {
  if (cachedLocation && Date.now() - lastLocationFetch < LOCATION_CACHE_MS) {
    return cachedLocation;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000
      });
    });

    const location = getLocationDisplayText(
      position.coords.latitude,
      position.coords.longitude
    );
    cachedLocation = location;
    lastLocationFetch = Date.now();
    return location;
  } catch {
    try {
      const response = await fetch('https://ipapi.co/json/', { 
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.latitude && data.longitude) {
          const location = getLocationDisplayText(data.latitude, data.longitude);
          cachedLocation = location;
          lastLocationFetch = Date.now();
          return location;
        }
      }
    } catch {
    }
    
    return getUnknownLocation();
  }
}

export function getLocationForUser(userLat?: string | number | null, userLng?: string | number | null): LocationInfo {
  if (!userLat || !userLng) {
    return getUnknownLocation();
  }

  const lat = typeof userLat === 'string' ? parseFloat(userLat) : userLat;
  const lng = typeof userLng === 'string' ? parseFloat(userLng) : userLng;

  if (isNaN(lat) || isNaN(lng)) {
    return getUnknownLocation();
  }

  return getLocationDisplayText(lat, lng);
}

export function getDistanceBetweenUsers(
  lat1?: string | number | null, 
  lng1?: string | number | null,
  lat2?: string | number | null,
  lng2?: string | number | null
): number | null {
  if (!lat1 || !lng1 || !lat2 || !lng2) {
    return null;
  }

  const parsedLat1 = typeof lat1 === 'string' ? parseFloat(lat1) : lat1;
  const parsedLng1 = typeof lng1 === 'string' ? parseFloat(lng1) : lng1;
  const parsedLat2 = typeof lat2 === 'string' ? parseFloat(lat2) : lat2;
  const parsedLng2 = typeof lng2 === 'string' ? parseFloat(lng2) : lng2;

  if (isNaN(parsedLat1) || isNaN(parsedLng1) || isNaN(parsedLat2) || isNaN(parsedLng2)) {
    return null;
  }

  return calculateDistance(parsedLat1, parsedLng1, parsedLat2, parsedLng2);
}

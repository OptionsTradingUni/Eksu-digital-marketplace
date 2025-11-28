import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getCurrentPosition, 
  mapToLocationName, 
  getUnknownLocation, 
  clearLocationCache,
  getDistanceToSeller,
  getSellerLocationName,
  type GeolocationInfo 
} from '@/lib/geolocation';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  autoUpdate?: boolean;
  updateInterval?: number;
  sendToServer?: boolean;
}

export interface UseGeolocationResult {
  location: GeolocationInfo;
  isLoading: boolean;
  error: string | null;
  permissionState: PermissionState | null;
  refresh: (forceRefresh?: boolean) => Promise<void>;
  clearCache: () => void;
}

const DEFAULT_OPTIONS: UseGeolocationOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 300000, // 5 minutes
  autoUpdate: true,
  updateInterval: 5 * 60 * 1000, // 5 minutes
  sendToServer: true,
};

/**
 * Hook for getting and tracking the user's geolocation
 * Automatically updates the server with location data when authenticated
 */
export function useGeolocation(options?: UseGeolocationOptions): UseGeolocationResult {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const { isAuthenticated } = useAuth();
  
  const [location, setLocation] = useState<GeolocationInfo>(getUnknownLocation());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);
  
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastServerUpdateRef = useRef<number>(0);

  // Check geolocation permission status
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        setPermissionState(result.state);
        result.addEventListener('change', () => {
          setPermissionState(result.state);
        });
      }).catch(() => {
        // Permissions API not fully supported
      });
    }
  }, []);

  // Send location to server
  const sendLocationToServer = useCallback(async (lat: number, lng: number) => {
    if (!isAuthenticated || !mergedOptions.sendToServer) return;
    
    // Throttle server updates to at most once per minute
    const now = Date.now();
    if (now - lastServerUpdateRef.current < 60000) return;
    
    try {
      await apiRequest('PATCH', '/api/users/me/location', {
        latitude: lat,
        longitude: lng,
      });
      lastServerUpdateRef.current = now;
    } catch (err) {
      // Silently fail - don't interrupt the user experience
      console.warn('Failed to update location on server:', err);
    }
  }, [isAuthenticated, mergedOptions.sendToServer]);

  // Fetch location
  const fetchLocation = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const locationInfo = await getCurrentPosition({
        enableHighAccuracy: mergedOptions.enableHighAccuracy,
        timeout: mergedOptions.timeout,
        maximumAge: mergedOptions.maximumAge,
        forceRefresh,
      });

      setLocation(locationInfo);

      // Send to server if we got valid coordinates
      if (locationInfo.latitude && locationInfo.longitude) {
        sendLocationToServer(locationInfo.latitude, locationInfo.longitude);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      setLocation(getUnknownLocation());
    } finally {
      setIsLoading(false);
    }
  }, [mergedOptions, sendLocationToServer]);

  // Initial fetch and interval setup
  useEffect(() => {
    fetchLocation();

    // Setup auto-update interval
    if (mergedOptions.autoUpdate && mergedOptions.updateInterval) {
      updateIntervalRef.current = setInterval(() => {
        fetchLocation(true);
      }, mergedOptions.updateInterval);
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [fetchLocation, mergedOptions.autoUpdate, mergedOptions.updateInterval]);

  // Refresh function
  const refresh = useCallback(async (forceRefresh = true) => {
    await fetchLocation(forceRefresh);
  }, [fetchLocation]);

  // Clear cache function
  const clearCache = useCallback(() => {
    clearLocationCache();
    setLocation(getUnknownLocation());
  }, []);

  return {
    location,
    isLoading,
    error,
    permissionState,
    refresh,
    clearCache,
  };
}

/**
 * Hook for calculating distance between the current user and a seller
 */
export function useDistanceToSeller(
  sellerLat: number | string | null | undefined,
  sellerLng: number | string | null | undefined,
  userLat?: number | string | null | undefined,
  userLng?: number | string | null | undefined
): {
  distance: string | null;
  sellerLocationName: string | null;
} {
  const distance = getDistanceToSeller(userLat, userLng, sellerLat, sellerLng);
  const sellerLocationName = getSellerLocationName(sellerLat, sellerLng);

  return {
    distance,
    sellerLocationName,
  };
}

/**
 * Hook that returns location info for any user based on their stored coordinates
 */
export function useUserLocationInfo(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined
): GeolocationInfo {
  const parsedLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const parsedLng = typeof lng === 'string' ? parseFloat(lng) : lng;

  if (parsedLat == null || isNaN(parsedLat) || parsedLng == null || isNaN(parsedLng)) {
    return getUnknownLocation();
  }

  return mapToLocationName(parsedLat, parsedLng);
}

export default useGeolocation;

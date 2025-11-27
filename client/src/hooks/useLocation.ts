import { useState, useEffect, useCallback } from 'react';
import { getCurrentLocation, getLocationForUser, type LocationInfo } from '@/lib/location';
import { apiRequest } from '@/lib/queryClient';

export function useCurrentLocation() {
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      
      if (loc.latitude && loc.longitude) {
        try {
          await apiRequest('PATCH', '/api/users/me/location', {
            latitude: loc.latitude,
            longitude: loc.longitude
          });
        } catch {
        }
      }
    } catch (err) {
      setError('Could not get location');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  return { location, isLoading, error, refetch: fetchLocation };
}

export function useUserLocation(userLat?: string | number | null, userLng?: string | number | null) {
  return getLocationForUser(userLat, userLng);
}

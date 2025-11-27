/**
 * Calculate the distance between two geographic coordinates using the Haversine formula
 * @param lat1 - Latitude of point 1 in decimal degrees
 * @param lon1 - Longitude of point 1 in decimal degrees
 * @param lat2 - Latitude of point 2 in decimal degrees
 * @param lon2 - Longitude of point 2 in decimal degrees
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  
  // Convert degrees to radians
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
 * @param distanceInKm - Distance in kilometers
 * @returns Formatted string (e.g., "2.3km" or "500m")
 */
export function formatDistance(distanceInKm: number): string {
  if (distanceInKm < 0.1) {
    // Less than 100m, show in meters
    const meters = Math.round(distanceInKm * 1000);
    return `${meters}m`;
  } else if (distanceInKm < 1) {
    // Less than 1km, show in meters
    const meters = Math.round(distanceInKm * 1000);
    return `${meters}m`;
  } else if (distanceInKm < 10) {
    // Less than 10km, show with 1 decimal
    return `${distanceInKm.toFixed(1)}km`;
  } else {
    // 10+ km, show whole number
    return `${Math.round(distanceInKm)}km`;
  }
}

/**
 * Calculate and format distance between two coordinates
 * @param buyerLat - Buyer's latitude
 * @param buyerLon - Buyer's longitude
 * @param sellerLat - Seller's latitude
 * @param sellerLon - Seller's longitude
 * @returns Formatted distance string or null if coordinates are invalid
 */
export function getDistanceDisplay(
  buyerLat: number | string | null | undefined,
  buyerLon: number | string | null | undefined,
  sellerLat: number | string | null | undefined,
  sellerLon: number | string | null | undefined
): string | null {
  // Parse coordinates, handling both number and string types
  const parsedBuyerLat = typeof buyerLat === 'string' ? parseFloat(buyerLat) : buyerLat;
  const parsedBuyerLon = typeof buyerLon === 'string' ? parseFloat(buyerLon) : buyerLon;
  const parsedSellerLat = typeof sellerLat === 'string' ? parseFloat(sellerLat) : sellerLat;
  const parsedSellerLon = typeof sellerLon === 'string' ? parseFloat(sellerLon) : sellerLon;

  // Check if all coordinates are valid numbers
  if (
    parsedBuyerLat == null || isNaN(parsedBuyerLat) ||
    parsedBuyerLon == null || isNaN(parsedBuyerLon) ||
    parsedSellerLat == null || isNaN(parsedSellerLat) ||
    parsedSellerLon == null || isNaN(parsedSellerLon)
  ) {
    return null;
  }

  const distance = calculateDistance(
    parsedBuyerLat,
    parsedBuyerLon,
    parsedSellerLat,
    parsedSellerLon
  );

  return formatDistance(distance);
}

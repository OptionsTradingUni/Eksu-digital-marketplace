import { Badge } from "@/components/ui/badge";
import { MapPin, School, Map, Globe } from "lucide-react";
import { 
  type LocationLevel, 
  type GeolocationInfo,
  getLocationLevelColor,
  mapToLocationName,
  getDistanceToSeller
} from "@/lib/geolocation";
import { cn } from "@/lib/utils";

interface LocationBadgeProps {
  locationInfo?: GeolocationInfo | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  showDistance?: boolean;
  userLat?: number | string | null;
  userLng?: number | string | null;
  className?: string;
  variant?: "default" | "compact" | "distance-only";
}

function getIconForLevel(level: LocationLevel) {
  switch (level) {
    case "on_campus":
      return <School className="h-3 w-3" />;
    case "near_campus":
    case "iworoko":
    case "osekita":
    case "ado_ekiti":
      return <MapPin className="h-3 w-3" />;
    case "ekiti_state":
      return <Map className="h-3 w-3" />;
    default:
      return <Globe className="h-3 w-3" />;
  }
}

export function LocationBadge({
  locationInfo,
  latitude,
  longitude,
  showDistance = false,
  userLat,
  userLng,
  className,
  variant = "default",
}: LocationBadgeProps) {
  // Get location info from coordinates if not provided directly
  let info = locationInfo;
  if (!info && latitude != null && longitude != null) {
    const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
    const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
    if (!isNaN(lat) && !isNaN(lng)) {
      info = mapToLocationName(lat, lng);
    }
  }

  // If no valid location info, don't render anything
  if (!info || info.locationLevel === "unknown") {
    return null;
  }

  // Calculate distance if requested
  let distanceText: string | null = null;
  if (showDistance && userLat != null && userLng != null && info.latitude != null && info.longitude != null) {
    distanceText = getDistanceToSeller(userLat, userLng, info.latitude, info.longitude);
  }

  const colorClasses = getLocationLevelColor(info.locationLevel);

  // Distance-only variant
  if (variant === "distance-only" && distanceText) {
    return (
      <Badge 
        variant="secondary" 
        className={cn("text-[10px] py-0 px-1.5 gap-0.5", className)}
        data-testid="badge-distance"
      >
        <MapPin className="h-2.5 w-2.5" />
        {distanceText}
      </Badge>
    );
  }

  // Compact variant - just icon and short name
  if (variant === "compact") {
    return (
      <Badge 
        variant="secondary" 
        className={cn("text-[10px] py-0 px-1.5 gap-0.5", colorClasses, className)}
        data-testid="badge-location-compact"
      >
        {getIconForLevel(info.locationLevel)}
        <span>{info.shortName}</span>
        {distanceText && (
          <span className="opacity-75 ml-0.5">{distanceText}</span>
        )}
      </Badge>
    );
  }

  // Default variant - full display
  return (
    <Badge 
      variant="secondary" 
      className={cn("text-xs py-0.5 px-2 gap-1", colorClasses, className)}
      data-testid="badge-location"
    >
      {getIconForLevel(info.locationLevel)}
      <span>{info.displayName}</span>
      {distanceText && (
        <span className="opacity-75 border-l border-current/20 pl-1 ml-1">
          {distanceText}
        </span>
      )}
    </Badge>
  );
}

interface DistanceBadgeProps {
  userLat: number | string | null | undefined;
  userLng: number | string | null | undefined;
  sellerLat: number | string | null | undefined;
  sellerLng: number | string | null | undefined;
  className?: string;
}

export function DistanceBadge({
  userLat,
  userLng,
  sellerLat,
  sellerLng,
  className,
}: DistanceBadgeProps) {
  const distanceText = getDistanceToSeller(userLat, userLng, sellerLat, sellerLng);

  if (!distanceText) {
    return null;
  }

  return (
    <Badge 
      variant="secondary" 
      className={cn("text-[10px] py-0 px-1.5 gap-0.5", className)}
      data-testid="badge-distance"
    >
      <MapPin className="h-2.5 w-2.5" />
      {distanceText}
    </Badge>
  );
}

interface SellerLocationBadgeProps {
  sellerLat: number | string | null | undefined;
  sellerLng: number | string | null | undefined;
  sellerLocation?: string | null;
  userLat?: number | string | null | undefined;
  userLng?: number | string | null | undefined;
  showDistance?: boolean;
  className?: string;
}

export function SellerLocationBadge({
  sellerLat,
  sellerLng,
  sellerLocation,
  userLat,
  userLng,
  showDistance = true,
  className,
}: SellerLocationBadgeProps) {
  // If we have coordinates, show GPS-based location
  if (sellerLat != null && sellerLng != null) {
    return (
      <LocationBadge
        latitude={sellerLat}
        longitude={sellerLng}
        showDistance={showDistance}
        userLat={userLat}
        userLng={userLng}
        variant="compact"
        className={className}
      />
    );
  }

  // Fallback to text-based location
  if (sellerLocation) {
    return (
      <Badge 
        variant="secondary" 
        className={cn("text-[10px] py-0 px-1.5 gap-0.5", className)}
        data-testid="badge-location-text"
      >
        <MapPin className="h-2.5 w-2.5" />
        <span className="truncate max-w-[80px]">{sellerLocation}</span>
      </Badge>
    );
  }

  return null;
}

export default LocationBadge;

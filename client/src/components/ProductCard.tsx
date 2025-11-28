import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Eye, ShoppingCart, Loader2, User, Heart } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, Watchlist, UserSettings } from "@shared/schema";
import { useState } from "react";
import { SellerLocationBadge, DistanceBadge } from "@/components/LocationBadge";
import { getSellerLocationName } from "@/lib/geolocation";

interface SellerSettings {
  latitude: string | null;
  longitude: string | null;
  locationVisible: boolean | null;
}

interface ProductCardProps {
  product: Product & { 
    seller?: { firstName?: string; isVerified?: boolean; id?: string; profileImageUrl?: string };
    sellerSettings?: SellerSettings | null;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const { data: wishlistItems = [] } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlist"],
    enabled: isAuthenticated,
  });

  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });

  // Determine if we can show distance and location
  const canShowDistance = isAuthenticated && 
    userSettings?.locationVisible && 
    product.sellerSettings?.locationVisible;

  // Get seller's mapped location name from GPS coordinates
  const sellerLocationName = product.sellerSettings?.locationVisible && product.sellerSettings?.latitude && product.sellerSettings?.longitude
    ? getSellerLocationName(product.sellerSettings.latitude, product.sellerSettings.longitude)
    : null;

  const isInWishlist = wishlistItems.some(item => item.productId === product?.id);

  const addToWishlistMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/watchlist", { productId: product.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: "Added to Wishlist",
        description: `${product.title} has been added to your wishlist`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add to wishlist",
      });
    },
  });

  const removeFromWishlistMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/watchlist/${product.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: "Removed from Wishlist",
        description: `${product.title} has been removed from your wishlist`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove from wishlist",
      });
    },
  });

  if (!product) return null;

  const handleSellerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sellerId = product.sellerId || product.seller?.id;
    if (sellerId) {
      setLocation(`/profile/${sellerId}`);
    }
  };

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast({
        variant: "destructive",
        title: "Login Required",
        description: "Please log in to add items to your wishlist",
      });
      return;
    }

    if (isInWishlist) {
      removeFromWishlistMutation.mutate();
    } else {
      addToWishlistMutation.mutate();
    }
  };
  
  const images = product.images || [];
  const imageUrl = images[0] || "/placeholder-product.png";
  const priceValue = product.price;
  const price = typeof priceValue === 'number' ? priceValue : parseFloat(priceValue as string) || 0;
  const originalPriceValue = product.originalPrice;
  const originalPrice = originalPriceValue ? (typeof originalPriceValue === 'number' ? originalPriceValue : parseFloat(originalPriceValue as string) || 0) : null;
  const isOnSale = product.isOnSale && originalPrice && originalPrice > price;
  const discountPercent = isOnSale ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast({
        variant: "destructive",
        title: "Login Required",
        description: "Please log in to add items to your cart",
      });
      return;
    }

    setIsAddingToCart(true);
    try {
      await addToCart({ productId: product.id });
      toast({
        title: "Added to Cart",
        description: `${product.title} has been added to your cart`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add item to cart",
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const isWishlistLoading = addToWishlistMutation.isPending || removeFromWishlistMutation.isPending;

  return (
    <Link href={`/products/${product.id}`}>
      <Card className="group overflow-hidden hover-elevate active-elevate-2 cursor-pointer">
        <div className="aspect-square relative overflow-hidden">
          <img
            src={imageUrl}
            alt={product.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleWishlistToggle}
            disabled={isWishlistLoading}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm"
            data-testid={`button-wishlist-toggle-${product.id}`}
          >
            {isWishlistLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart 
                className={`h-4 w-4 transition-colors ${
                  isInWishlist 
                    ? "fill-red-500 text-red-500" 
                    : "text-muted-foreground"
                }`} 
              />
            )}
          </Button>
          {isOnSale && (
            <Badge className="absolute top-2 left-2 bg-red-500 text-white" data-testid={`badge-sale-${product.id}`}>
              SALE -{discountPercent}%
            </Badge>
          )}
          {product.isBoosted && !isOnSale && (
            <Badge className="absolute top-2 left-2 bg-yellow-500 text-white">
              Featured
            </Badge>
          )}
          {product.condition && !product.isBoosted && !isOnSale && (
            <Badge variant="secondary" className="absolute top-2 left-2">
              {product.condition}
            </Badge>
          )}
        </div>
        <CardContent className="p-3">
          <h3 className="font-semibold line-clamp-2 text-sm mb-1.5" data-testid={`text-product-title-${product.id}`}>
            {product.title}
          </h3>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex flex-col">
              <p className={`text-lg font-bold ${isOnSale ? "text-red-500 dark:text-red-400" : "text-foreground"}`} data-testid={`text-product-price-${product.id}`}>
                ₦{price.toLocaleString()}
              </p>
              {isOnSale && originalPrice && (
                <p className="text-xs text-muted-foreground line-through" data-testid={`text-product-original-price-${product.id}`}>
                  ₦{originalPrice.toLocaleString()}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleAddToCart}
              disabled={isAddingToCart || !product.isAvailable}
              data-testid={`button-add-to-cart-${product.id}`}
            >
              {isAddingToCart ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            {/* Show GPS-based location badge if available */}
            {product.sellerSettings?.locationVisible && product.sellerSettings?.latitude && product.sellerSettings?.longitude ? (
              <SellerLocationBadge
                sellerLat={product.sellerSettings.latitude}
                sellerLng={product.sellerSettings.longitude}
                userLat={canShowDistance ? userSettings?.latitude : undefined}
                userLng={canShowDistance ? userSettings?.longitude : undefined}
                showDistance={canShowDistance}
              />
            ) : (
              /* Fallback to text-based location */
              product.location && (
                <div className="flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[80px]">{product.location}</span>
                </div>
              )
            )}
            {/* Show distance badge separately if we have GPS but no seller location */}
            {canShowDistance && !product.sellerSettings?.latitude && userSettings?.latitude && (
              <DistanceBadge
                userLat={userSettings.latitude}
                userLng={userSettings.longitude}
                sellerLat={null}
                sellerLng={null}
              />
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{product.views || 0} views</span>
            </div>
            {(product.sellerId || product.seller?.id) && (
              <button
                onClick={handleSellerClick}
                className="flex items-center gap-1 hover-elevate active-elevate-2 rounded px-1.5 py-0.5 transition-all"
                data-testid={`link-seller-profile-${product.id}`}
              >
                <User className="h-3 w-3" />
                <span className="text-xs">
                  {product.seller?.firstName || "Seller"}
                </span>
                {product.seller?.isVerified && (
                  <Badge variant="outline" className="text-xs ml-1 py-0 px-1">
                    Verified
                  </Badge>
                )}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

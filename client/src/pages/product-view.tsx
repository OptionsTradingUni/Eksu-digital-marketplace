import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageSquare, MapPin, Heart, Star, Shield, ChevronLeft, ChevronRight, UserPlus, UserCheck, CheckCircle, Clock, ShoppingBag, ShoppingCart, Calendar, CircleDot, Share2, Loader2, Check, ImageOff, Plus, Minus } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { SafetyShieldModal, hasSafetyBeenAcknowledged } from "@/components/SafetyShieldModal";
import type { Product, User, Watchlist, UserSettings } from "@shared/schema";
import { getDistanceDisplay } from "@/lib/distance";

interface SellerSettings {
  latitude: string | null;
  longitude: string | null;
  locationVisible: boolean | null;
}

type ProductWithSellerSettings = Product & { 
  seller: User; 
  sellerSettings?: SellerSettings | null;
};

function formatJoinDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "Recently";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) return "This month";
  if (diffDays < 60) return "1 month ago";
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  
  const years = Math.floor(diffDays / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function formatOnlineStatus(dateStr: string | Date | null | undefined): { text: string; isActive: boolean } {
  if (!dateStr) return { text: "Offline", isActive: false };
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 5) return { text: "Active now", isActive: true };
  if (diffMins < 60) return { text: `Active ${diffMins}m ago`, isActive: true };
  if (diffMins < 1440) return { text: `Last seen ${Math.floor(diffMins / 60)}h ago`, isActive: false };
  if (diffMins < 10080) return { text: `Last seen ${Math.floor(diffMins / 1440)}d ago`, isActive: false };
  return { text: "Last seen a while ago", isActive: false };
}

function formatResponseTime(minutes: number | null | undefined): string {
  if (!minutes || minutes === 0) return "Not available";
  if (minutes < 60) return `Usually responds in ${minutes}m`;
  if (minutes < 1440) return `Usually responds in ${Math.floor(minutes / 60)}h`;
  return `Usually responds in ${Math.floor(minutes / 1440)}d`;
}

export default function ProductView() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [quantity, setQuantity] = useState(1);
  
  const { addToCart, isAddingToCart, cartItems } = useCart();

  const { data: product, isLoading } = useQuery<ProductWithSellerSettings>({
    queryKey: ["/api/products", id],
  });

  const { data: wishlistItems = [] } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlist"],
    enabled: isAuthenticated,
  });

  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });

  const distanceDisplay = isAuthenticated && 
    userSettings?.locationVisible && 
    product?.sellerSettings?.locationVisible
      ? getDistanceDisplay(
          userSettings.latitude,
          userSettings.longitude,
          product.sellerSettings.latitude,
          product.sellerSettings.longitude
        )
      : null;

  const isInWishlist = wishlistItems.some(item => item.productId === id);
  const isInCart = cartItems.some(item => item.productId === id);
  const cartItem = cartItems.find(item => item.productId === id);

  // Reset safety modal state when product/seller changes
  useEffect(() => {
    setShowSafetyModal(false);
    setCurrentImageIndex(0);
  }, [id]);

  // Fetch follow status for the seller
  const { data: followStats } = useQuery<{
    followerCount: number;
    followingCount: number;
    isFollowing: boolean;
  }>({
    queryKey: ["/api/users", product?.sellerId, "follow-stats"],
    enabled: !!product?.sellerId,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) {
        window.location.href = "/api/login";
        return;
      }
      return await apiRequest("POST", `/api/users/${product?.sellerId}/follow`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", product?.sellerId, "follow-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", product?.sellerId, "followers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      toast({
        title: "Followed",
        description: "You are now following this seller",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to follow seller",
        variant: "destructive",
      });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/users/${product?.sellerId}/follow`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", product?.sellerId, "follow-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", product?.sellerId, "followers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      toast({
        title: "Unfollowed",
        description: "You have unfollowed this seller",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unfollow seller",
        variant: "destructive",
      });
    },
  });

  const addToWishlistMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/watchlist", { productId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist/full"] });
      toast({
        title: "Added to Wishlist",
        description: "Item has been added to your wishlist",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add to wishlist",
        variant: "destructive",
      });
    },
  });

  const removeFromWishlistMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/watchlist/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist/full"] });
      toast({
        title: "Removed from Wishlist",
        description: "Item has been removed from your wishlist",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove from wishlist",
        variant: "destructive",
      });
    },
  });

  const handleWishlistToggle = () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please log in to add items to your wishlist",
        variant: "destructive",
      });
      return;
    }

    if (isInWishlist) {
      removeFromWishlistMutation.mutate();
    } else {
      addToWishlistMutation.mutate();
    }
  };

  const handleShare = async () => {
    const domain = window.location.origin;
    const shareUrl = `${domain}/products/${id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopied(true);
      toast({
        title: "Link Copied",
        description: "Product link has been copied to your clipboard",
      });
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please log in to add items to your cart",
        variant: "destructive",
      });
      return;
    }

    try {
      await addToCart({ productId: id!, quantity });
      toast({
        title: "Added to Cart",
        description: `${quantity} item${quantity > 1 ? 's' : ''} added to your cart`,
      });
      setQuantity(1);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add to cart",
        variant: "destructive",
      });
    }
  };

  const incrementQuantity = () => setQuantity(q => Math.min(q + 1, 10));
  const decrementQuantity = () => setQuantity(q => Math.max(q - 1, 1));

  const startChat = () => {
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }
    
    if (product?.sellerId && !hasSafetyBeenAcknowledged(product.sellerId)) {
      setShowSafetyModal(true);
      return;
    }
    
    setLocation(`/messages?user=${product?.sellerId}`);
  };

  const handleSafetyAcknowledge = () => {
    setLocation(`/messages?user=${product?.sellerId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-lg text-muted-foreground">Product not found</p>
      </div>
    );
  }

  const price = parseFloat(product.price as string);
  const originalPriceValue = product.originalPrice;
  const originalPrice = originalPriceValue ? (typeof originalPriceValue === 'number' ? originalPriceValue : parseFloat(originalPriceValue as string) || 0) : null;
  const isOnSale = product.isOnSale && originalPrice && originalPrice > price;
  const discountPercent = isOnSale ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const images = product.images.length > 0 ? product.images : ["/placeholder-product.png"];
  const sellerInitials = product.seller?.firstName?.[0] || product.seller?.email?.[0] || "S";

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const isOwner = user?.id === product.sellerId;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image Gallery */}
          <div>
            <div className="relative aspect-square md:aspect-auto md:min-h-[400px] max-h-[70vh] md:max-h-none overflow-hidden rounded-lg bg-muted">
              <img
                src={images[currentImageIndex]}
                alt={product.title}
                className="h-full w-full object-contain md:object-cover"
                loading="lazy"
                data-testid="img-product-main"
              />
              {images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2"
                    onClick={prevImage}
                    data-testid="button-prev-image"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={nextImage}
                    data-testid="button-next-image"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-4 grid grid-cols-5 gap-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`aspect-square overflow-hidden rounded-md ${
                      idx === currentImageIndex ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.title} ${idx + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between mb-2 gap-2">
                <h1 className="text-3xl font-bold" data-testid="text-product-title">
                  {product.title}
                </h1>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleShare}
                    data-testid="button-share"
                  >
                    {showCopied ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <Share2 className="h-5 w-5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleWishlistToggle}
                    disabled={isOwner || addToWishlistMutation.isPending || removeFromWishlistMutation.isPending}
                    data-testid="button-wishlist"
                  >
                    {addToWishlistMutation.isPending || removeFromWishlistMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Heart 
                        className={`h-5 w-5 transition-colors ${
                          isInWishlist 
                            ? "fill-red-500 text-red-500" 
                            : ""
                        }`} 
                      />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{product.condition}</Badge>
                {product.isBoosted && (
                  <Badge className="bg-yellow-500">Featured</Badge>
                )}
                {isOnSale && (
                  <Badge className="bg-red-500 text-white" data-testid="badge-sale">
                    SALE
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-3">
                <p className={`text-4xl font-bold ${isOnSale ? "text-red-500 dark:text-red-400" : "text-primary"}`} data-testid="text-product-price">
                  ₦{price.toLocaleString()}
                </p>
                {isOnSale && originalPrice && (
                  <p className="text-xl text-muted-foreground line-through" data-testid="text-product-original-price">
                    ₦{originalPrice.toLocaleString()}
                  </p>
                )}
              </div>
              {isOnSale && discountPercent > 0 && (
                <p className="text-sm font-semibold text-green-600 dark:text-green-500" data-testid="text-discount-percent">
                  You save {discountPercent}% off the original price
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              {product.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{product.location}</span>
                </div>
              )}
              {distanceDisplay && (
                <Badge variant="secondary" className="text-sm py-0.5 px-2" data-testid="badge-seller-distance">
                  <MapPin className="h-3 w-3 mr-1" />
                  {distanceDisplay} away
                </Badge>
              )}
            </div>

            <div>
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-product-description">
                {product.description}
              </p>
            </div>

            {/* Enhanced Seller Card */}
            <Card className="border-2">
              <CardContent className="p-6">
                {/* Seller Header */}
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => setLocation(`/profile/${product.sellerId}`)}
                    className="relative group hover-elevate active-elevate-2 rounded-full transition-all"
                    data-testid="button-seller-avatar"
                  >
                    <Avatar className="h-16 w-16 border-2 border-background">
                      <AvatarImage src={product.seller?.profileImageUrl || undefined} />
                      <AvatarFallback className="text-lg">{sellerInitials}</AvatarFallback>
                    </Avatar>
                    {(() => {
                      const onlineStatus = formatOnlineStatus(product.seller?.updatedAt);
                      return onlineStatus.isActive ? (
                        <span 
                          className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-green-500 border-2 border-background" 
                          title={onlineStatus.text}
                          data-testid="indicator-seller-online"
                        />
                      ) : null;
                    })()}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button 
                        onClick={() => setLocation(`/profile/${product.sellerId}`)}
                        className="font-semibold text-lg truncate hover:underline"
                        data-testid="text-seller-name"
                      >
                        {product.seller?.firstName 
                          ? `${product.seller.firstName}${product.seller.lastName ? ` ${product.seller.lastName}` : ''}`
                          : "Seller"}
                      </button>
                      {product.seller?.isVerified && (
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" data-testid="icon-seller-verified" />
                      )}
                      {product.seller?.isTrustedSeller && (
                        <Badge className="bg-blue-500 dark:bg-blue-600 flex-shrink-0">
                          <Shield className="h-3 w-3 mr-1" />
                          Trusted
                        </Badge>
                      )}
                    </div>
                    {product.seller?.instagramHandle && (
                      <p className="text-sm text-muted-foreground" data-testid="text-seller-username">
                        @{product.seller.instagramHandle}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const trustScore = parseFloat(String(product.seller?.trustScore || "5.0"));
                          const filled = star <= Math.floor(trustScore);
                          const halfFilled = !filled && star === Math.ceil(trustScore) && trustScore % 1 >= 0.5;
                          return (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                filled 
                                  ? "fill-yellow-400 text-yellow-400" 
                                  : halfFilled 
                                    ? "fill-yellow-400/50 text-yellow-400" 
                                    : "text-muted-foreground/30"
                              }`}
                            />
                          );
                        })}
                      </div>
                      <span className="text-sm font-medium ml-1" data-testid="text-seller-rating">
                        {product.seller?.trustScore || "5.0"}
                      </span>
                      <span className="text-sm text-muted-foreground" data-testid="text-seller-reviews">
                        ({product.seller?.totalRatings || 0} reviews)
                      </span>
                    </div>
                  </div>
                  {!isOwner && isAuthenticated && (
                    <Button
                      variant={followStats?.isFollowing ? "secondary" : "default"}
                      size="sm"
                      onClick={() => {
                        if (followStats?.isFollowing) {
                          unfollowMutation.mutate();
                        } else {
                          followMutation.mutate();
                        }
                      }}
                      disabled={followMutation.isPending || unfollowMutation.isPending}
                      data-testid="button-follow-seller"
                      className="gap-1 flex-shrink-0"
                    >
                      {followStats?.isFollowing ? (
                        <>
                          <UserCheck className="h-4 w-4" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Follow
                        </>
                      )}
                    </Button>
                  )}
                </div>

                <Separator className="my-4" />

                {/* Seller Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Online Status */}
                  <div className="flex items-center gap-2">
                    <CircleDot className={`h-4 w-4 flex-shrink-0 ${
                      formatOnlineStatus(product.seller?.updatedAt).isActive 
                        ? "text-green-500" 
                        : "text-muted-foreground"
                    }`} />
                    <span className="text-sm text-muted-foreground truncate" data-testid="text-seller-online-status">
                      {formatOnlineStatus(product.seller?.updatedAt).text}
                    </span>
                  </div>

                  {/* Join Date */}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground truncate" data-testid="text-seller-joined">
                      Joined {formatJoinDate(product.seller?.createdAt)}
                    </span>
                  </div>

                  {/* Total Sales */}
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground" data-testid="text-seller-sales">
                      {product.seller?.totalSales || 0} sales
                    </span>
                  </div>

                  {/* Response Time */}
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground truncate" data-testid="text-seller-response-time">
                      {formatResponseTime(product.seller?.responseTime)}
                    </span>
                  </div>
                </div>

                {/* Followers count */}
                <div className="mt-4 text-center">
                  <span className="text-sm text-muted-foreground" data-testid="text-seller-follower-count">
                    <span className="font-semibold text-foreground">{followStats?.followerCount || 0}</span> followers
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-background pt-4 border-t space-y-3">
              {isOwner ? (
                <Button
                  className="w-full"
                  onClick={() => setLocation(`/products/${id}/edit`)}
                  data-testid="button-edit-product"
                >
                  Edit Listing
                </Button>
              ) : (
                <>
                  {/* Quantity Selector and Add to Cart */}
                  {product.isAvailable && !product.isSold && (
                    <div className="flex gap-2">
                      <div className="flex items-center border rounded-md">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={decrementQuantity}
                          disabled={quantity <= 1}
                          data-testid="button-decrease-quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="px-4 font-medium min-w-[40px] text-center" data-testid="text-quantity">
                          {quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={incrementQuantity}
                          disabled={quantity >= 10}
                          data-testid="button-increase-quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        className="flex-1"
                        onClick={handleAddToCart}
                        disabled={isAddingToCart}
                        data-testid="button-add-to-cart"
                      >
                        {isAddingToCart ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShoppingCart className="mr-2 h-4 w-4" />
                        )}
                        {isInCart ? "Add More" : "Add to Cart"}
                      </Button>
                    </div>
                  )}
                  
                  {/* View Cart Button (if items in cart) */}
                  {isInCart && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setLocation("/checkout")}
                      data-testid="button-view-cart"
                    >
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      View Cart ({cartItem?.quantity} item{(cartItem?.quantity || 0) > 1 ? 's' : ''})
                    </Button>
                  )}
                  
                  {/* Chat with Seller */}
                  <Button
                    variant={product.isAvailable && !product.isSold ? "outline" : "default"}
                    className="w-full"
                    onClick={startChat}
                    data-testid="button-chat-seller"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Chat with Seller
                  </Button>
                  
                  {/* Product unavailable notice */}
                  {(!product.isAvailable || product.isSold) && (
                    <p className="text-sm text-muted-foreground text-center">
                      This item is no longer available for purchase
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Safety Shield Modal */}
      {product?.sellerId && (
        <SafetyShieldModal
          sellerId={product.sellerId}
          open={showSafetyModal}
          onOpenChange={setShowSafetyModal}
          onAcknowledge={handleSafetyAcknowledge}
        />
      )}
    </div>
  );
}

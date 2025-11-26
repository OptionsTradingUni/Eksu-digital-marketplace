import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Heart, Trash2, ShoppingCart, MapPin, Loader2, Share2, ArrowLeft } from "lucide-react";
import type { Product, Watchlist, User } from "@shared/schema";

type WishlistItemWithProduct = Watchlist & {
  product: Product & { seller: User };
};

export default function WishlistPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: wishlistItems = [], isLoading } = useQuery<WishlistItemWithProduct[]>({
    queryKey: ["/api/wishlist/full"],
    enabled: isAuthenticated,
  });

  const removeFromWishlistMutation = useMutation({
    mutationFn: async (productId: string) => {
      return await apiRequest("DELETE", `/api/watchlist/${productId}`, {});
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
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove from wishlist",
      });
    },
  });

  const handleShare = async (product: Product) => {
    const domain = window.location.origin;
    const shareUrl = `${domain}/products/${product.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied",
        description: "Product link has been copied to your clipboard",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy link",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <Heart className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign in to view your wishlist</h2>
          <p className="text-muted-foreground mb-4">
            Save your favorite items and access them anytime
          </p>
          <Button onClick={() => setLocation("/")}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-24">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500 fill-red-500" />
            My Wishlist
          </h1>
          <p className="text-muted-foreground text-sm">
            {wishlistItems.length} {wishlistItems.length === 1 ? "item" : "items"} saved
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <div className="aspect-square">
                <Skeleton className="h-full w-full" />
              </div>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : wishlistItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <Heart className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your wishlist is empty</h2>
          <p className="text-muted-foreground mb-4">
            Start adding items you love by clicking the heart icon
          </p>
          <Button onClick={() => setLocation("/")}>
            Browse Products
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wishlistItems.map((item) => {
            const product = item.product;
            if (!product) return null;

            const price = typeof product.price === 'number' 
              ? product.price 
              : parseFloat(product.price as string) || 0;
            const imageUrl = product.images?.[0] || "/placeholder-product.png";

            return (
              <Card 
                key={item.id} 
                className="group overflow-hidden hover-elevate active-elevate-2"
                data-testid={`card-wishlist-item-${product.id}`}
              >
                <div 
                  className="aspect-square relative overflow-hidden cursor-pointer"
                  onClick={() => setLocation(`/products/${product.id}`)}
                >
                  <img
                    src={imageUrl}
                    alt={product.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(product);
                      }}
                      className="bg-background/80 backdrop-blur-sm"
                      data-testid={`button-share-${product.id}`}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromWishlistMutation.mutate(product.id);
                      }}
                      disabled={removeFromWishlistMutation.isPending}
                      className="bg-background/80 backdrop-blur-sm"
                      data-testid={`button-remove-wishlist-${product.id}`}
                    >
                      {removeFromWishlistMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                  {product.condition && (
                    <Badge variant="secondary" className="absolute top-2 left-2">
                      {product.condition}
                    </Badge>
                  )}
                  {!product.isAvailable && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <Badge variant="destructive">Sold Out</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 
                    className="font-semibold line-clamp-2 mb-2 cursor-pointer hover:underline"
                    onClick={() => setLocation(`/products/${product.id}`)}
                    data-testid={`text-wishlist-product-title-${product.id}`}
                  >
                    {product.title}
                  </h3>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xl font-bold text-primary" data-testid={`text-wishlist-product-price-${product.id}`}>
                      ₦{price.toLocaleString()}
                    </p>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setLocation(`/products/${product.id}`)}
                      disabled={!product.isAvailable}
                      data-testid={`button-view-product-${product.id}`}
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                  </div>
                  {product.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{product.location}</span>
                    </div>
                  )}
                  {product.seller && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Sold by{" "}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/profile/${product.sellerId}`);
                        }}
                        className="font-medium hover:underline"
                      >
                        {product.seller.firstName || "Seller"}
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

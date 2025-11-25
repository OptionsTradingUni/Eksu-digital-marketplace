import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageSquare, MapPin, Heart, Star, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import type { Product, User } from "@shared/schema";

export default function ProductView() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: product, isLoading } = useQuery<Product & { seller: User }>({
    queryKey: ["/api/products", id],
  });

  const watchlistMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/watchlist", { productId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: "Added to watchlist",
        description: "You'll be notified of price changes",
      });
    },
  });

  const startChat = () => {
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }
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
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              <img
                src={images[currentImageIndex]}
                alt={product.title}
                className="h-full w-full object-cover"
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
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-3xl font-bold" data-testid="text-product-title">
                  {product.title}
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => watchlistMutation.mutate()}
                  disabled={!isAuthenticated || isOwner}
                  data-testid="button-watchlist"
                >
                  <Heart className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{product.condition}</Badge>
                {product.isBoosted && (
                  <Badge className="bg-yellow-500">Featured</Badge>
                )}
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-primary" data-testid="text-product-price">
                ₦{price.toLocaleString()}
              </p>
            </div>

            {product.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{product.location}</span>
              </div>
            )}

            <div>
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-product-description">
                {product.description}
              </p>
            </div>

            {/* Seller Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={product.seller?.profileImageUrl || undefined} />
                    <AvatarFallback>{sellerInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold" data-testid="text-seller-name">
                        {product.seller?.firstName || "Seller"}
                      </p>
                      {product.seller?.isVerified && (
                        <Badge variant="outline" className="gap-1">
                          <Shield className="h-3 w-3" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{product.seller?.trustScore || "5.0"}</span>
                      <span>({product.seller?.totalRatings || 0} reviews)</span>
                    </div>
                  </div>
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
                <Button
                  className="w-full"
                  onClick={startChat}
                  data-testid="button-chat-seller"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Chat with Seller
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Eye } from "lucide-react";
import type { Product } from "@shared/schema";

interface ProductCardProps {
  product: Product & { seller?: { firstName?: string; isVerified?: boolean } };
}

export function ProductCard({ product }: ProductCardProps) {
  if (!product) return null;
  
  const images = product.images || [];
  const imageUrl = images[0] || "/placeholder-product.png";
  const priceValue = product.price;
  const price = typeof priceValue === 'number' ? priceValue : parseFloat(priceValue as string) || 0;

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
          {product.isBoosted && (
            <Badge className="absolute top-2 right-2 bg-yellow-500 text-white">
              Featured
            </Badge>
          )}
          {product.condition && (
            <Badge variant="secondary" className="absolute top-2 left-2">
              {product.condition}
            </Badge>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold line-clamp-2 mb-2" data-testid={`text-product-title-${product.id}`}>
            {product.title}
          </h3>
          <div className="flex items-center justify-between mb-2">
            <p className="text-2xl font-bold text-primary" data-testid={`text-product-price-${product.id}`}>
              ₦{price.toLocaleString()}
            </p>
          </div>
          {product.location && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <MapPin className="h-3 w-3" />
              <span>{product.location}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{product.views || 0} views</span>
            </div>
            {product.seller?.isVerified && (
              <Badge variant="outline" className="text-xs">
                Verified Seller
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

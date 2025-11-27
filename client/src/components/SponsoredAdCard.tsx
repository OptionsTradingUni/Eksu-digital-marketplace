import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Megaphone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { SponsoredAd } from "@shared/schema";

interface SponsoredAdCardProps {
  ad: SponsoredAd;
  variant?: "marketplace" | "plug";
}

export function SponsoredAdCard({ ad, variant = "marketplace" }: SponsoredAdCardProps) {
  const hasTrackedImpression = useRef(false);

  useEffect(() => {
    if (!hasTrackedImpression.current) {
      hasTrackedImpression.current = true;
      apiRequest("POST", `/api/ads/${ad.id}/impression`).catch(() => {});
    }
  }, [ad.id]);

  const handleClick = () => {
    apiRequest("POST", `/api/ads/${ad.id}/click`).catch(() => {});
  };

  const destination = ad.productId 
    ? `/products/${ad.productId}` 
    : ad.linkUrl || "#";

  const isExternalLink = ad.linkUrl && !ad.productId;

  if (variant === "plug") {
    return (
      <article 
        className="py-4 border-b"
        data-testid={`sponsored-ad-plug-${ad.id}`}
      >
        <div className="flex gap-3">
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm">{ad.title}</span>
              <Badge 
                variant="outline" 
                className="text-[10px] px-1.5 py-0 h-4 border-muted-foreground/30 text-muted-foreground font-normal"
              >
                Sponsored
              </Badge>
            </div>
            
            {ad.description && (
              <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap mb-3">
                {ad.description}
              </p>
            )}
            
            {ad.imageUrl && (
              <div className="mt-3 mb-3 rounded-xl overflow-hidden">
                <img
                  src={ad.imageUrl}
                  alt={ad.title}
                  className="w-full aspect-video object-cover"
                  loading="lazy"
                />
              </div>
            )}
            
            {isExternalLink ? (
              <a 
                href={destination}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClick}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Learn more
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <Link 
                href={destination}
                onClick={handleClick}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Learn more
              </Link>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <Card 
      className="overflow-hidden hover-elevate cursor-pointer group"
      data-testid={`sponsored-ad-marketplace-${ad.id}`}
    >
      {isExternalLink ? (
        <a 
          href={destination}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="block"
        >
          <div className="relative">
            {ad.imageUrl ? (
              <img
                src={ad.imageUrl}
                alt={ad.title}
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                loading="lazy"
              />
            ) : (
              <div className="aspect-square w-full bg-muted flex items-center justify-center">
                <Megaphone className="h-12 w-12 text-muted-foreground/40" />
              </div>
            )}
            <Badge 
              variant="secondary"
              className="absolute top-2 left-2 text-[10px] px-1.5 py-0 h-5 bg-background/90 backdrop-blur-sm text-muted-foreground font-normal"
            >
              Sponsored
            </Badge>
          </div>
          <CardContent className="p-3">
            <h3 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
              {ad.title}
            </h3>
            {ad.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {ad.description}
              </p>
            )}
          </CardContent>
        </a>
      ) : (
        <Link 
          href={destination}
          onClick={handleClick}
          className="block"
        >
          <div className="relative">
            {ad.imageUrl ? (
              <img
                src={ad.imageUrl}
                alt={ad.title}
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                loading="lazy"
              />
            ) : (
              <div className="aspect-square w-full bg-muted flex items-center justify-center">
                <Megaphone className="h-12 w-12 text-muted-foreground/40" />
              </div>
            )}
            <Badge 
              variant="secondary"
              className="absolute top-2 left-2 text-[10px] px-1.5 py-0 h-5 bg-background/90 backdrop-blur-sm text-muted-foreground font-normal"
            >
              Sponsored
            </Badge>
          </div>
          <CardContent className="p-3">
            <h3 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
              {ad.title}
            </h3>
            {ad.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {ad.description}
              </p>
            )}
          </CardContent>
        </Link>
      )}
    </Card>
  );
}

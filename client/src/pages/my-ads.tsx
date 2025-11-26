import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Plus,
  Megaphone,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  ShoppingBag,
  Zap,
  MessageSquare,
  Rocket,
  Package,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Product } from "@shared/schema";

type ProductWithAnalytics = Product & { inquiryCount: number };

export default function MyAdsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [showBoostDialog, setShowBoostDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithAnalytics | null>(null);

  const { data: products, isLoading } = useQuery<ProductWithAnalytics[]>({
    queryKey: ["/api/seller/products"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/products/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/products"] });
      toast({
        title: "Product deleted",
        description: "Your listing has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete",
        description: error.message || "Unable to delete listing",
        variant: "destructive",
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/products/${id}/toggle-visibility`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/products"] });
      toast({
        title: data.isAvailable ? "Listing activated" : "Listing paused",
        description: data.isAvailable 
          ? "Your listing is now visible to buyers."
          : "Your listing is now hidden from buyers.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Unable to update listing",
        variant: "destructive",
      });
    },
  });

  const markAsSoldMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/products/${id}/sold`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/products"] });
      toast({
        title: "Marked as sold",
        description: "Your listing has been marked as sold.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to mark as sold",
        description: error.message || "Unable to mark as sold",
        variant: "destructive",
      });
    },
  });

  const boostMutation = useMutation({
    mutationFn: async ({ productId, boostType }: { productId: string; boostType: string }) => {
      const response = await apiRequest("POST", `/api/boosts`, { productId, boostType });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/products"] });
      setShowBoostDialog(false);
      setSelectedProduct(null);
      toast({
        title: "Boost requested",
        description: "Your boost request has been submitted for approval.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to boost",
        description: error.message || "Unable to boost listing",
        variant: "destructive",
      });
    },
  });

  const allProducts = products || [];
  const activeProducts = allProducts.filter(p => p.isAvailable && p.isApproved && !p.isSold && !p.isFlagged);
  const soldProducts = allProducts.filter(p => p.isSold);
  const pendingProducts = allProducts.filter(p => !p.isApproved && !p.isFlagged);
  const boostedProducts = allProducts.filter(p => p.isBoosted && !p.isSold);

  const getFilteredProducts = () => {
    switch (activeTab) {
      case "active":
        return activeProducts;
      case "sold":
        return soldProducts;
      case "pending":
        return pendingProducts;
      case "boosted":
        return boostedProducts;
      default:
        return allProducts;
    }
  };

  const filteredProducts = getFilteredProducts();

  const getStatusBadge = (product: ProductWithAnalytics) => {
    if (product.isSold) {
      return (
        <Badge className="absolute top-2 left-2 bg-green-500" data-testid={`badge-sold-${product.id}`}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Sold
        </Badge>
      );
    }
    if (product.isBoosted) {
      return (
        <Badge className="absolute top-2 left-2 bg-orange-500" data-testid={`badge-boosted-${product.id}`}>
          <TrendingUp className="h-3 w-3 mr-1" />
          Boosted
        </Badge>
      );
    }
    if (!product.isApproved && !product.isFlagged) {
      return (
        <Badge variant="secondary" className="absolute top-2 left-2" data-testid={`badge-pending-${product.id}`}>
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }
    if (product.isFlagged) {
      return (
        <Badge variant="destructive" className="absolute top-2 left-2" data-testid={`badge-flagged-${product.id}`}>
          <XCircle className="h-3 w-3 mr-1" />
          Flagged
        </Badge>
      );
    }
    if (!product.isAvailable) {
      return (
        <Badge variant="outline" className="absolute top-2 left-2 bg-background/80" data-testid={`badge-paused-${product.id}`}>
          <Pause className="h-3 w-3 mr-1" />
          Paused
        </Badge>
      );
    }
    return null;
  };

  const handleBoostClick = (product: ProductWithAnalytics) => {
    setSelectedProduct(product);
    setShowBoostDialog(true);
  };

  const ProductCard = ({ product }: { product: ProductWithAnalytics }) => {
    const imageUrl = product.images?.[0] || "/placeholder.svg";
    const canBoost = product.isApproved && !product.isSold && !product.isBoosted;
    const canMarkSold = product.isApproved && !product.isSold;
    const canToggleVisibility = !product.isSold;
    
    return (
      <Card className="overflow-hidden" data-testid={`card-product-${product.id}`}>
        <div className="aspect-square relative">
          <img
            src={imageUrl.startsWith("/uploads") ? imageUrl : imageUrl}
            alt={product.title}
            className="object-cover w-full h-full"
            data-testid={`img-product-${product.id}`}
          />
          {getStatusBadge(product)}
        </div>
        <CardContent className="p-3">
          <h3 className="font-medium truncate mb-1" data-testid={`text-title-${product.id}`}>{product.title}</h3>
          <p className="text-lg font-bold mb-2" data-testid={`text-price-${product.id}`}>
            ₦{parseFloat(product.price).toLocaleString()}
          </p>
          
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground mb-3">
            <span className="flex items-center gap-1" data-testid={`text-views-${product.id}`}>
              <Eye className="h-4 w-4" />
              {product.views || 0}
            </span>
            <span className="flex items-center gap-1" data-testid={`text-inquiries-${product.id}`}>
              <MessageSquare className="h-4 w-4" />
              {product.inquiryCount || product.inquiries || 0}
            </span>
            <Badge variant="outline" className="text-xs" data-testid={`badge-condition-${product.id}`}>
              {product.condition}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1" asChild data-testid={`button-edit-${product.id}`}>
              <Link href={`/products/${product.id}/edit`}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Link>
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-menu-${product.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild data-testid={`menu-view-${product.id}`}>
                  <Link href={`/products/${product.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Listing
                  </Link>
                </DropdownMenuItem>
                
                {canToggleVisibility && (
                  <DropdownMenuItem
                    onClick={() => toggleVisibilityMutation.mutate(product.id)}
                    disabled={toggleVisibilityMutation.isPending}
                    data-testid={`menu-toggle-${product.id}`}
                  >
                    {product.isAvailable ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause Listing
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Activate Listing
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                
                {canBoost && (
                  <DropdownMenuItem
                    onClick={() => handleBoostClick(product)}
                    data-testid={`menu-boost-${product.id}`}
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    Boost Listing
                  </DropdownMenuItem>
                )}
                
                {canMarkSold && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => markAsSoldMutation.mutate(product.id)}
                      disabled={markAsSoldMutation.isPending}
                      className="text-green-600"
                      data-testid={`menu-sold-${product.id}`}
                    >
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Mark as Sold
                    </DropdownMenuItem>
                  </>
                )}
                
                <DropdownMenuSeparator />
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive"
                      data-testid={`menu-delete-${product.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Listing
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your
                        listing and remove it from the marketplace.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(product.id)}
                        className="bg-destructive text-destructive-foreground"
                        data-testid="button-confirm-delete"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  };

  const ProductCardSkeleton = () => (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-square" />
      <CardContent className="p-3">
        <Skeleton className="h-5 w-3/4 mb-1" />
        <Skeleton className="h-6 w-1/2 mb-2" />
        <div className="flex items-center justify-between gap-2 mb-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-8" />
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = () => {
    const getEmptyStateContent = () => {
      switch (activeTab) {
        case "active":
          return {
            icon: <Package className="h-10 w-10 text-muted-foreground" />,
            title: "No Active Listings",
            description: "You don't have any active listings. Create a new ad to start selling.",
          };
        case "sold":
          return {
            icon: <ShoppingBag className="h-10 w-10 text-green-500" />,
            title: "No Sold Items",
            description: "Items you mark as sold will appear here.",
          };
        case "pending":
          return {
            icon: <Clock className="h-10 w-10 text-yellow-500" />,
            title: "No Pending Listings",
            description: "Listings awaiting approval will appear here.",
          };
        case "boosted":
          return {
            icon: <Rocket className="h-10 w-10 text-orange-500" />,
            title: "No Boosted Listings",
            description: "Boost your listings to get more visibility.",
          };
        default:
          return {
            icon: <Megaphone className="h-10 w-10 text-orange-500" />,
            title: "No Ads Yet",
            description: "Add products for customers to buy from you.",
          };
      }
    };

    const content = getEmptyStateContent();

    return (
      <Card data-testid="empty-state">
        <CardContent className="py-12 text-center">
          <div className="rounded-full bg-muted p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            {content.icon}
          </div>
          <h3 className="text-lg font-medium mb-2" data-testid="text-empty-title">{content.title}</h3>
          <p className="text-muted-foreground mb-4" data-testid="text-empty-description">
            {content.description}
          </p>
          <Button asChild data-testid="button-empty-cta">
            <Link href="/products/new">
              <Plus className="h-4 w-4 mr-2" />
              Create New Ad
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full mb-6" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Ads</h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            Manage your product listings ({allProducts.length} total)
          </p>
        </div>
        <Button asChild data-testid="button-create-ad">
          <Link href="/products/new">
            <Plus className="h-4 w-4 mr-2" />
            Create New Ad
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({allProducts.length})
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">
            Active ({activeProducts.length})
          </TabsTrigger>
          <TabsTrigger value="sold" data-testid="tab-sold">
            Sold ({soldProducts.length})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingProducts.length})
          </TabsTrigger>
          <TabsTrigger value="boosted" data-testid="tab-boosted">
            Boosted ({boostedProducts.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredProducts.length > 0 ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      <Dialog open={showBoostDialog} onOpenChange={setShowBoostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="dialog-boost-title">Boost Your Listing</DialogTitle>
            <DialogDescription data-testid="dialog-boost-description">
              Get more visibility for "{selectedProduct?.title}" by boosting it to the top of search results.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div 
              className="border rounded-md p-4 cursor-pointer hover-elevate"
              onClick={() => selectedProduct && boostMutation.mutate({ productId: selectedProduct.id, boostType: "basic" })}
              data-testid="boost-option-basic"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-2">
                    <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-medium">Basic Boost</h4>
                    <p className="text-sm text-muted-foreground">24 hours visibility boost</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">₦500</p>
                </div>
              </div>
            </div>
            
            <div 
              className="border rounded-md p-4 cursor-pointer hover-elevate"
              onClick={() => selectedProduct && boostMutation.mutate({ productId: selectedProduct.id, boostType: "premium" })}
              data-testid="boost-option-premium"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-orange-100 dark:bg-orange-900 p-2">
                    <Rocket className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h4 className="font-medium">Premium Boost</h4>
                    <p className="text-sm text-muted-foreground">7 days visibility + featured badge</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">₦2,000</p>
                </div>
              </div>
            </div>
            
            <div 
              className="border rounded-md p-4 cursor-pointer hover-elevate border-orange-500"
              onClick={() => selectedProduct && boostMutation.mutate({ productId: selectedProduct.id, boostType: "super" })}
              data-testid="boost-option-super"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-gradient-to-br from-orange-400 to-pink-500 p-2">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium">Super Boost</h4>
                    <p className="text-sm text-muted-foreground">30 days + homepage spotlight</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">₦5,000</p>
                  <Badge variant="secondary">Best Value</Badge>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBoostDialog(false)} data-testid="button-cancel-boost">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

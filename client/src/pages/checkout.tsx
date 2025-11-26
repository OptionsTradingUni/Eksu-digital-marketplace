import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCart, CartItemWithProduct } from "@/hooks/use-cart";
import {
  ShoppingCart,
  MapPin,
  Truck,
  Users,
  Wallet,
  CreditCard,
  ArrowLeft,
  CheckCircle,
  Loader2,
  Package,
} from "lucide-react";
import type { Wallet as WalletType } from "@shared/schema";

const PLATFORM_FEE_RATE = 0.035;

interface OrderSuccessData {
  orderNumber: string;
  orderId: string;
}

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { cartItems, subtotal, isLoading: cartLoading, clearCart } = useCart();
  
  const [deliveryMethod, setDeliveryMethod] = useState<string>("campus_meetup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("wallet");
  const [orderSuccess, setOrderSuccess] = useState<OrderSuccessData | null>(null);

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletType>({
    queryKey: ["/api/wallet"],
  });

  const walletBalance = wallet ? parseFloat(wallet.balance as string) : 0;

  const platformFee = Math.round(subtotal * PLATFORM_FEE_RATE * 100) / 100;
  const monnifyFeeEstimate = paymentMethod === "monnify" 
    ? Math.min(Math.round((subtotal * 0.015 + (subtotal >= 2500 ? 50 : 0)) * 100) / 100, 2000) 
    : 0;
  const total = subtotal + platformFee + monnifyFeeEstimate;

  const createOrderMutation = useMutation({
    mutationFn: async (data: { 
      productId: string; 
      deliveryMethod: string;
      deliveryAddress?: string;
      deliveryLocation?: string;
      deliveryNotes?: string;
    }) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return res.json();
    },
  });

  const walletPaymentMutation = useMutation({
    mutationFn: async (data: { 
      productId: string;
      amount: number;
    }) => {
      const res = await apiRequest("POST", "/api/wallet/pay", data);
      return res.json();
    },
  });

  const initializeMonnifyMutation = useMutation({
    mutationFn: async (data: {
      amount: string;
      purpose: string;
      paymentDescription: string;
    }) => {
      const res = await apiRequest("POST", "/api/monnify/initialize", data);
      return res.json();
    },
  });

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Cart Empty",
        description: "Please add items to your cart before checkout",
      });
      return;
    }

    if (deliveryMethod === "seller_delivery" && (!deliveryAddress || !deliveryLocation)) {
      toast({
        variant: "destructive",
        title: "Delivery Details Required",
        description: "Please provide delivery address and location",
      });
      return;
    }

    try {
      if (paymentMethod === "wallet") {
        if (walletBalance < total) {
          toast({
            variant: "destructive",
            title: "Insufficient Balance",
            description: `Your wallet balance (₦${walletBalance.toLocaleString()}) is less than the total (₦${total.toLocaleString()})`,
          });
          return;
        }

        const orderResults = [];
        for (const item of cartItems) {
          const order = await createOrderMutation.mutateAsync({
            productId: item.productId,
            deliveryMethod,
            deliveryAddress: deliveryMethod === "seller_delivery" ? deliveryAddress : undefined,
            deliveryLocation: deliveryMethod === "seller_delivery" ? deliveryLocation : undefined,
            deliveryNotes: deliveryNotes || undefined,
          });
          orderResults.push(order);
        }

        await clearCart();

        queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
        queryClient.invalidateQueries({ queryKey: ["/api/orders/buyer"] });

        const firstOrder = orderResults[0];
        setOrderSuccess({
          orderNumber: firstOrder.orderNumber,
          orderId: firstOrder.id,
        });

        toast({
          title: "Order Placed Successfully",
          description: `Your order #${firstOrder.orderNumber} has been placed`,
        });
      } else {
        localStorage.setItem("pendingCheckout", JSON.stringify({
          cartItems: cartItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          deliveryMethod,
          deliveryAddress: deliveryMethod === "seller_delivery" ? deliveryAddress : undefined,
          deliveryLocation: deliveryMethod === "seller_delivery" ? deliveryLocation : undefined,
          deliveryNotes: deliveryNotes || undefined,
        }));

        const result = await initializeMonnifyMutation.mutateAsync({
          amount: total.toFixed(2),
          purpose: "purchase",
          paymentDescription: `Purchase of ${cartItems.length} item(s) from EKSU Marketplace`,
        });

        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          throw new Error("No checkout URL received");
        }
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        variant: "destructive",
        title: "Checkout Failed",
        description: error.message || "Failed to process your order. Please try again.",
      });
    }
  };

  if (orderSuccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold">Order Placed Successfully!</h1>
              <p className="text-muted-foreground">
                Thank you for your purchase. Your order has been confirmed.
              </p>
              <div className="bg-muted rounded-md p-4 w-full max-w-sm">
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="text-2xl font-mono font-bold" data-testid="text-order-number">
                  {orderSuccess.orderNumber}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                You will receive a notification when the seller confirms your order.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button
                  onClick={() => setLocation("/orders")}
                  data-testid="button-view-orders"
                >
                  View My Orders
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/")}
                  data-testid="button-continue-shopping"
                >
                  Continue Shopping
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div>
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <ShoppingCart className="h-16 w-16 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Your Cart is Empty</h2>
              <p className="text-muted-foreground">
                Add some items to your cart to proceed with checkout
              </p>
              <Button onClick={() => setLocation("/")} data-testid="button-start-shopping">
                Start Shopping
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isProcessing = createOrderMutation.isPending || 
    walletPaymentMutation.isPending || 
    initializeMonnifyMutation.isPending;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold" data-testid="text-checkout-title">Checkout</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Cart Items ({cartItems.length})
              </CardTitle>
              <CardDescription>Review your items before checkout</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <CartItemCard key={item.id} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Delivery Method
              </CardTitle>
              <CardDescription>Choose how you want to receive your items</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={deliveryMethod}
                onValueChange={setDeliveryMethod}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 rounded-md border p-4 hover-elevate">
                  <RadioGroupItem value="campus_meetup" id="campus_meetup" data-testid="radio-campus-meetup" />
                  <Label htmlFor="campus_meetup" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Campus Meetup</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Meet the seller at a convenient location on campus
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-md border p-4 hover-elevate">
                  <RadioGroupItem value="pickup" id="pickup" data-testid="radio-pickup" />
                  <Label htmlFor="pickup" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Pickup from Seller</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pick up the item from the seller's location
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-md border p-4 hover-elevate">
                  <RadioGroupItem value="seller_delivery" id="seller_delivery" data-testid="radio-delivery" />
                  <Label htmlFor="seller_delivery" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Delivery to Me</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Seller delivers to your specified location
                    </p>
                  </Label>
                </div>
              </RadioGroup>

              {deliveryMethod === "seller_delivery" && (
                <div className="mt-4 space-y-4 p-4 bg-muted/50 rounded-md">
                  <div className="space-y-2">
                    <Label htmlFor="deliveryLocation">Delivery Location</Label>
                    <Input
                      id="deliveryLocation"
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="e.g., Phase 2, School Gate, Yemkem"
                      data-testid="input-delivery-location"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryAddress">Delivery Address</Label>
                    <Textarea
                      id="deliveryAddress"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Enter your full delivery address"
                      className="resize-none"
                      data-testid="input-delivery-address"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <Label htmlFor="deliveryNotes">Delivery Notes (Optional)</Label>
                <Textarea
                  id="deliveryNotes"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Any special instructions for the seller?"
                  className="resize-none"
                  data-testid="input-delivery-notes"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </CardTitle>
              <CardDescription>Choose your preferred payment method</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 rounded-md border p-4 hover-elevate">
                  <RadioGroupItem value="wallet" id="wallet" data-testid="radio-wallet" />
                  <Label htmlFor="wallet" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Pay with Wallet</span>
                      </div>
                      {walletLoading ? (
                        <Skeleton className="h-5 w-20" />
                      ) : (
                        <Badge variant={walletBalance >= total ? "default" : "destructive"}>
                          ₦{walletBalance.toLocaleString()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pay instantly from your wallet balance
                    </p>
                    {walletBalance < total && paymentMethod === "wallet" && (
                      <p className="text-sm text-destructive mt-1">
                        Insufficient balance. Please fund your wallet or use Monnify.
                      </p>
                    )}
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-md border p-4 hover-elevate">
                  <RadioGroupItem value="monnify" id="monnify" data-testid="radio-monnify" />
                  <Label htmlFor="monnify" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Pay with Monnify (Card/Transfer)</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pay with debit card, bank transfer, or USSD
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Subtotal</span>
                <span data-testid="text-subtotal">₦{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Platform Fee (3.5%)</span>
                <span data-testid="text-platform-fee">₦{platformFee.toLocaleString()}</span>
              </div>
              {paymentMethod === "monnify" && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Monnify Fee</span>
                  <span data-testid="text-monnify-fee">₦{monnifyFeeEstimate.toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold" data-testid="text-total">
                  ₦{total.toLocaleString()}
                </span>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handlePlaceOrder}
                disabled={
                  isProcessing || 
                  (paymentMethod === "wallet" && walletBalance < total) ||
                  (deliveryMethod === "seller_delivery" && (!deliveryAddress || !deliveryLocation))
                }
                data-testid="button-place-order"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {paymentMethod === "wallet" ? (
                      <>
                        <Wallet className="mr-2 h-4 w-4" />
                        Pay ₦{total.toLocaleString()}
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Pay with Monnify
                      </>
                    )}
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By placing this order, you agree to our Terms of Service and Privacy Policy
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CartItemCard({ item }: { item: CartItemWithProduct }) {
  const images = item.product.images || [];
  const imageUrl = images[0] || "/placeholder-product.png";
  const priceValue = item.product.price;
  const price = typeof priceValue === 'number' ? priceValue : parseFloat(priceValue as string) || 0;
  const itemTotal = price * item.quantity;

  return (
    <div className="flex gap-4 py-3" data-testid={`checkout-item-${item.id}`}>
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border">
        <img
          src={imageUrl}
          alt={item.product.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col">
        <h4 className="text-sm font-medium line-clamp-2" data-testid={`checkout-item-title-${item.id}`}>
          {item.product.title}
        </h4>
        <p className="text-sm text-muted-foreground">
          ₦{price.toLocaleString()} x {item.quantity}
        </p>
        <div className="mt-auto flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            Qty: {item.quantity}
          </Badge>
          <p className="text-sm font-semibold" data-testid={`checkout-item-total-${item.id}`}>
            ₦{itemTotal.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle, XCircle, Loader2, ShoppingBag, Home } from "lucide-react";

interface PaymentVerificationResult {
  status: string;
  amountPaid: number;
  paymentMethod: string;
  paidOn: string;
}

interface PendingCheckout {
  cartItems: Array<{ productId: string; quantity: number }>;
  deliveryMethod: string;
  deliveryAddress?: string;
  deliveryLocation?: string;
  deliveryNotes?: string;
}

interface OrderResult {
  id: string;
  orderNumber: string;
}

export default function PaymentCallbackPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<"verifying" | "success" | "failed" | "creating_orders">("verifying");
  const [orderResults, setOrderResults] = useState<OrderResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const searchParams = new URLSearchParams(searchString);
  const paymentReference = searchParams.get("paymentReference") || searchParams.get("reference");
  const transactionReference = searchParams.get("transactionReference");

  const reference = paymentReference || transactionReference;

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

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/cart");
    },
  });

  useEffect(() => {
    const verifyPayment = async () => {
      if (!reference) {
        setStatus("failed");
        setErrorMessage("No payment reference found in URL");
        return;
      }

      try {
        const res = await fetch(`/api/monnify/verify/${reference}`, {
          credentials: "include",
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Payment verification failed");
        }

        const result: PaymentVerificationResult = await res.json();

        if (result.status === "PAID") {
          setStatus("creating_orders");
          
          const pendingCheckoutStr = localStorage.getItem("pendingCheckout");
          if (pendingCheckoutStr) {
            try {
              const pendingCheckout: PendingCheckout = JSON.parse(pendingCheckoutStr);
              
              const orders: OrderResult[] = [];
              for (const item of pendingCheckout.cartItems) {
                const order = await createOrderMutation.mutateAsync({
                  productId: item.productId,
                  deliveryMethod: pendingCheckout.deliveryMethod,
                  deliveryAddress: pendingCheckout.deliveryAddress,
                  deliveryLocation: pendingCheckout.deliveryLocation,
                  deliveryNotes: pendingCheckout.deliveryNotes,
                });
                orders.push(order);
              }

              setOrderResults(orders);

              await clearCartMutation.mutateAsync();

              localStorage.removeItem("pendingCheckout");

              queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
              queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
              queryClient.invalidateQueries({ queryKey: ["/api/orders/buyer"] });

              setStatus("success");

              toast({
                title: "Payment Successful",
                description: `Your payment of ₦${result.amountPaid.toLocaleString()} has been confirmed`,
              });
            } catch (orderError: any) {
              console.error("Error creating orders:", orderError);
              setStatus("success");
              toast({
                title: "Payment Successful",
                description: "Payment received but there was an issue creating your orders. Please contact support.",
              });
            }
          } else {
            queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
            setStatus("success");
            toast({
              title: "Payment Successful",
              description: `Your wallet has been credited with ₦${result.amountPaid.toLocaleString()}`,
            });
          }
        } else if (result.status === "PENDING") {
          setStatus("verifying");
          setTimeout(verifyPayment, 3000);
        } else {
          setStatus("failed");
          setErrorMessage(`Payment status: ${result.status}`);
        }
      } catch (error: any) {
        console.error("Payment verification error:", error);
        setStatus("failed");
        setErrorMessage(error.message || "Failed to verify payment");
      }
    };

    verifyPayment();
  }, [reference]);

  if (status === "verifying" || status === "creating_orders") {
    return (
      <div className="container mx-auto px-4 py-8 max-w-md">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h1 className="text-xl font-semibold">
                {status === "verifying" ? "Verifying Payment..." : "Creating Orders..."}
              </h1>
              <p className="text-muted-foreground">
                {status === "verifying" 
                  ? "Please wait while we confirm your payment."
                  : "Please wait while we process your orders."
                }
              </p>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="container mx-auto px-4 py-8 max-w-md">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-full bg-destructive/10 p-4">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <h1 className="text-xl font-semibold">Payment Failed</h1>
              <p className="text-muted-foreground">
                {errorMessage || "There was an issue processing your payment."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button
                  onClick={() => setLocation("/checkout")}
                  data-testid="button-try-again"
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/")}
                  data-testid="button-go-home"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-xl font-semibold">Payment Successful!</h1>
            <p className="text-muted-foreground">
              {orderResults.length > 0
                ? "Your payment has been confirmed and your orders have been placed."
                : "Your payment has been confirmed and your wallet has been credited."
              }
            </p>
            
            {orderResults.length > 0 && (
              <div className="bg-muted rounded-md p-4 w-full space-y-2">
                <p className="text-sm text-muted-foreground">Order Number(s)</p>
                {orderResults.map((order, index) => (
                  <p 
                    key={order.id}
                    className="text-lg font-mono font-bold"
                    data-testid={`text-order-number-${index}`}
                  >
                    {order.orderNumber}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {orderResults.length > 0 ? (
                <>
                  <Button
                    onClick={() => setLocation("/orders")}
                    data-testid="button-view-orders"
                  >
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    View My Orders
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/")}
                    data-testid="button-continue-shopping"
                  >
                    Continue Shopping
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setLocation("/wallet")}
                    data-testid="button-view-wallet"
                  >
                    View Wallet
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/")}
                    data-testid="button-go-home"
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

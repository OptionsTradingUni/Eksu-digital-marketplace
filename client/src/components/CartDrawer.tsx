import { useState } from "react";
import { useLocation } from "wouter";
import { useCart, CartItemWithProduct } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, Plus, Minus, Trash2, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CartItemRowProps {
  item: CartItemWithProduct;
  onUpdateQuantity: (id: string, quantity: number) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  isUpdating: boolean;
}

function CartItemRow({ item, onUpdateQuantity, onRemove, isUpdating }: CartItemRowProps) {
  const [localQuantity, setLocalQuantity] = useState(item.quantity);
  const [isRemoving, setIsRemoving] = useState(false);

  const images = item.product.images || [];
  const imageUrl = images[0] || "/placeholder-product.png";
  const priceValue = item.product.price;
  const price = typeof priceValue === 'number' ? priceValue : parseFloat(priceValue as string) || 0;

  const handleIncrement = async () => {
    const newQuantity = localQuantity + 1;
    setLocalQuantity(newQuantity);
    await onUpdateQuantity(item.id, newQuantity);
  };

  const handleDecrement = async () => {
    if (localQuantity > 1) {
      const newQuantity = localQuantity - 1;
      setLocalQuantity(newQuantity);
      await onUpdateQuantity(item.id, newQuantity);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove(item.id);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="flex gap-3 py-4" data-testid={`cart-item-${item.id}`}>
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border">
        <img
          src={imageUrl}
          alt={item.product.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between">
          <h4 className="text-sm font-medium line-clamp-2" data-testid={`cart-item-title-${item.id}`}>
            {item.product.title}
          </h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-2 -mt-1"
            onClick={handleRemove}
            disabled={isRemoving}
            data-testid={`button-remove-cart-item-${item.id}`}
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm font-semibold text-primary" data-testid={`cart-item-price-${item.id}`}>
          ₦{price.toLocaleString()}
        </p>
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handleDecrement}
              disabled={localQuantity <= 1 || isUpdating}
              data-testid={`button-decrement-${item.id}`}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center text-sm" data-testid={`text-quantity-${item.id}`}>
              {localQuantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handleIncrement}
              disabled={isUpdating}
              data-testid={`button-increment-${item.id}`}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-sm font-medium" data-testid={`cart-item-subtotal-${item.id}`}>
            ₦{(price * localQuantity).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

interface CartDrawerProps {
  children?: React.ReactNode;
}

export function CartDrawer({ children }: CartDrawerProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const {
    cartItems,
    itemCount,
    subtotal,
    isLoading,
    updateQuantity,
    isUpdatingQuantity,
    removeFromCart,
    clearCart,
    isClearingCart,
  } = useCart();

  const handleUpdateQuantity = async (cartItemId: string, quantity: number) => {
    try {
      await updateQuantity({ cartItemId, quantity });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update quantity",
      });
    }
  };

  const handleRemoveFromCart = async (cartItemId: string) => {
    try {
      await removeFromCart(cartItemId);
      toast({
        title: "Removed",
        description: "Item removed from cart",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove item",
      });
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCart();
      toast({
        title: "Cart Cleared",
        description: "All items have been removed from your cart",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to clear cart",
      });
    }
  };

  const handleContinueShopping = () => {
    setIsOpen(false);
  };

  const handleCheckout = () => {
    setIsOpen(false);
    setLocation("/checkout");
  };

  if (!isAuthenticated) {
    return (
      <Button variant="ghost" size="icon" disabled data-testid="button-cart-disabled">
        <ShoppingCart className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {children || (
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            data-testid="button-cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                data-testid="badge-cart-count"
              >
                {itemCount > 99 ? "99+" : itemCount}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="flex flex-col w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle data-testid="text-cart-title">Shopping Cart</SheetTitle>
          <SheetDescription data-testid="text-cart-description">
            {itemCount === 0
              ? "Your cart is empty"
              : `You have ${itemCount} item${itemCount === 1 ? "" : "s"} in your cart`}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <ShoppingCart className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">Your cart is empty</p>
            <Button onClick={handleContinueShopping} data-testid="button-start-shopping">
              Start Shopping
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="divide-y">
                {cartItems.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemove={handleRemoveFromCart}
                    isUpdating={isUpdatingQuantity}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-4 pt-4">
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold" data-testid="text-cart-subtotal">
                  ₦{subtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold" data-testid="text-cart-total">
                  ₦{subtotal.toLocaleString()}
                </span>
              </div>
              <Separator />

              <SheetFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  className="w-full"
                  onClick={handleCheckout}
                  data-testid="button-checkout"
                >
                  Proceed to Checkout
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleContinueShopping}
                  data-testid="button-continue-shopping"
                >
                  Continue Shopping
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-destructive"
                  onClick={handleClearCart}
                  disabled={isClearingCart}
                  data-testid="button-clear-cart"
                >
                  {isClearingCart ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear Cart
                    </>
                  )}
                </Button>
              </SheetFooter>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

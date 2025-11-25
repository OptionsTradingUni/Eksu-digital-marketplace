import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CartItem, Product } from "@shared/schema";

export type CartItemWithProduct = CartItem & { product: Product };

export function useCart() {
  const cartQuery = useQuery<CartItemWithProduct[]>({
    queryKey: ["/api/cart"],
    staleTime: 1000 * 60,
    retry: false,
  });

  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity = 1 }: { productId: string; quantity?: number }) => {
      const res = await apiRequest("POST", "/api/cart", { productId, quantity });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) => {
      const res = await apiRequest("PATCH", `/api/cart/${cartItemId}`, { quantity });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  const removeFromCartMutation = useMutation({
    mutationFn: async (cartItemId: string) => {
      await apiRequest("DELETE", `/api/cart/${cartItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/cart");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  const cartItems = cartQuery.data || [];
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => {
    const price = typeof item.product.price === 'number' 
      ? item.product.price 
      : parseFloat(item.product.price as string) || 0;
    return sum + price * item.quantity;
  }, 0);

  return {
    cartItems,
    itemCount,
    subtotal,
    isLoading: cartQuery.isLoading,
    isError: cartQuery.isError,
    addToCart: addToCartMutation.mutateAsync,
    isAddingToCart: addToCartMutation.isPending,
    updateQuantity: updateQuantityMutation.mutateAsync,
    isUpdatingQuantity: updateQuantityMutation.isPending,
    removeFromCart: removeFromCartMutation.mutateAsync,
    isRemovingFromCart: removeFromCartMutation.isPending,
    clearCart: clearCartMutation.mutateAsync,
    isClearingCart: clearCartMutation.isPending,
  };
}

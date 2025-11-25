import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isSeller: user?.role === "seller" || user?.role === "admin",
    isBuyer: user?.role === "buyer" || user?.role === "admin",
    isAdmin: user?.role === "admin",
  };
}

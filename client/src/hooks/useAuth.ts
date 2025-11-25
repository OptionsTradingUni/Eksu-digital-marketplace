import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isError,
    isAuthenticated: !!user && !isError,
    isSeller: user?.role === "seller" || user?.role === "admin",
    isBuyer: user?.role === "buyer" || user?.role === "admin",
    isAdmin: user?.role === "admin",
  };
}

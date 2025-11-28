import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Check if user is super admin via environment variable
  const isSuperAdmin = (() => {
    if (!user?.id) return false;
    const adminIds = import.meta.env.VITE_SUPER_ADMIN_IDS?.split(',').map((id: string) => id.trim()) || [];
    return adminIds.includes(user.id);
  })();

  return {
    user,
    isLoading,
    isError,
    isAuthenticated: !!user && !isError,
    isSeller: user?.role === "seller" || user?.role === "admin",
    isBuyer: user?.role === "buyer" || user?.role === "admin",
    isAdmin: user?.role === "admin" || isSuperAdmin,
    isVerified: user?.isVerified || user?.ninVerified || false,
    isEmailVerified: user?.emailVerified || false,
  };
}

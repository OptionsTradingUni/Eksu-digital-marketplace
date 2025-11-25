import { Link, useLocation } from "wouter";
import { ShoppingBag, MessageSquare, User, Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import { CartDrawer } from "@/components/CartDrawer";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Header() {
  const { user, isAuthenticated, isSeller, isAdmin } = useAuth();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <span className="hidden text-lg font-bold sm:inline-block">
              EKSU Marketplace
            </span>
            <span className="text-lg font-bold sm:hidden">EKSU</span>
          </Link>

          {/* Search Bar - Desktop */}
          <form onSubmit={handleSearch} className="hidden flex-1 max-w-md md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </form>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Cart */}
                <CartDrawer />

                {/* Messages */}
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  data-testid="button-messages"
                >
                  <Link href="/messages">
                    <MessageSquare className="h-5 w-5" />
                  </Link>
                </Button>

                {/* Notifications */}
                <NotificationBell />

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-9 w-9 rounded-full"
                      data-testid="button-user-menu"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user?.profileImageUrl || undefined} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          {user?.firstName || user?.email}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {user?.role}
                          </Badge>
                          {user?.isVerified && (
                            <Badge variant="default" className="text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" data-testid="link-profile">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    {isSeller && (
                      <DropdownMenuItem asChild>
                        <Link href="/seller/dashboard" data-testid="link-seller-dashboard">
                          <ShoppingBag className="mr-2 h-4 w-4" />
                          Seller Dashboard
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" data-testid="link-admin">
                          <User className="mr-2 h-4 w-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={async () => {
                        try {
                          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                          window.location.href = '/';
                        } catch (error) {
                          console.error('Logout failed:', error);
                        }
                      }}
                      className="cursor-pointer"
                      data-testid="link-logout"
                    >
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <ThemeToggle />
                <Button variant="ghost" asChild data-testid="button-login">
                  <a href="/api/login">Log In</a>
                </Button>
                <Button asChild data-testid="button-signup">
                  <a href="/api/login">Sign Up</a>
                </Button>
              </>
            )}

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <nav className="flex flex-col gap-4 mt-8">
                  <form onSubmit={handleSearch} className="mb-4">
                    <Input
                      type="search"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-mobile"
                    />
                  </form>
                  {isAuthenticated && (
                    <>
                      <Link href="/messages">
                        <Button variant="ghost" className="w-full justify-start">
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Messages
                        </Button>
                      </Link>
                      <Link href="/profile">
                        <Button variant="ghost" className="w-full justify-start">
                          <User className="mr-2 h-4 w-4" />
                          Profile
                        </Button>
                      </Link>
                      {isSeller && (
                        <Link href="/seller/dashboard">
                          <Button variant="ghost" className="w-full justify-start">
                            <ShoppingBag className="mr-2 h-4 w-4" />
                            Seller Dashboard
                          </Button>
                        </Link>
                      )}
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

import { Link, useLocation } from "wouter";
import { ShoppingBag, MessageSquare, User, Search, Wallet, Users, Megaphone, Settings, LogOut, Bell, Smartphone, HelpCircle, Shield, FileText, Heart, Bookmark, UsersRound, MessageCircle, Share2, Briefcase, UserCog, Home, BookOpen, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useQuery } from "@tanstack/react-query";

export function Header() {
  const { user, isAuthenticated, isSeller, isAdmin } = useAuth();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const unreadCount = unreadData?.count || 0;

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
                {/* Theme Toggle in Header - Shows all 8 themes */}
                <ThemeToggle />

                {/* Cart */}
                <CartDrawer />

                {/* Messages */}
                <Link href="/messages">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    data-testid="button-header-messages"
                  >
                    <MessageSquare className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center p-0 text-[10px]"
                        data-testid="badge-header-unread-messages"
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </Link>

                {/* Notifications */}
                <NotificationBell />

                {/* Profile Dropdown Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-9 w-9 rounded-full"
                      data-testid="button-profile-menu"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user?.profileImageUrl || undefined} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user?.profileImageUrl || undefined} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium">
                            {user?.firstName} {user?.lastName}
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
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Main Actions - Always visible */}
                    <DropdownMenuItem asChild>
                      <Link href="/profile" data-testid="link-my-profile">
                        <User className="mr-2 h-4 w-4" />
                        My Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/wallet" data-testid="link-wallet">
                        <Wallet className="mr-2 h-4 w-4" />
                        Wallet
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/my-ads" data-testid="link-my-ads">
                        <Megaphone className="mr-2 h-4 w-4" />
                        My Ads
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    {/* Social - Collapsible submenu */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger data-testid="submenu-social">
                        <Share2 className="mr-2 h-4 w-4" />
                        Social
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem asChild>
                            <Link href="/the-plug?tab=bookmarks" data-testid="link-bookmarks">
                              <Bookmark className="mr-2 h-4 w-4" />
                              Saved Posts
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/communities" data-testid="link-communities">
                              <UsersRound className="mr-2 h-4 w-4" />
                              Communities
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/confessions" data-testid="link-confessions">
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Confessions
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    
                    {/* Services - Collapsible submenu */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger data-testid="submenu-services">
                        <Briefcase className="mr-2 h-4 w-4" />
                        Services
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem asChild>
                            <Link href="/hostels" data-testid="link-hostels">
                              <Home className="mr-2 h-4 w-4" />
                              Hostel Finder
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/study-materials" data-testid="link-study-materials">
                              <BookOpen className="mr-2 h-4 w-4" />
                              Study Materials
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/vtu" data-testid="link-vtu-data">
                              <Smartphone className="mr-2 h-4 w-4" />
                              VTU Data
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/referrals" data-testid="link-referrals">
                              <Users className="mr-2 h-4 w-4" />
                              Referrals
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/explore" data-testid="link-explore">
                              <Compass className="mr-2 h-4 w-4" />
                              Explore All
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    
                    {/* Account - Collapsible submenu */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger data-testid="submenu-account">
                        <UserCog className="mr-2 h-4 w-4" />
                        Account
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem asChild>
                            <Link href="/settings" data-testid="link-settings">
                              <Settings className="mr-2 h-4 w-4" />
                              Settings
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/notifications" data-testid="link-notifications">
                              <Bell className="mr-2 h-4 w-4" />
                              Notifications
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/wishlist" data-testid="link-wishlist">
                              <Heart className="mr-2 h-4 w-4" />
                              Wishlist
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/kyc" data-testid="link-kyc-verify">
                              <Shield className="mr-2 h-4 w-4" />
                              Verify Identity
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    
                    <DropdownMenuSeparator />
                    
                    {/* Other - Always visible */}
                    <DropdownMenuItem asChild>
                      <Link href="/support" data-testid="link-support">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Help (Use Chatbot or Support)
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/legal" data-testid="link-legal">
                        <FileText className="mr-2 h-4 w-4" />
                        Legal & Privacy
                      </Link>
                    </DropdownMenuItem>
                    
                    {/* Admin Panel - Visible for admins only */}
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/admin" data-testid="link-admin-panel">
                            <Settings className="mr-2 h-4 w-4" />
                            Admin Panel
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    
                    <DropdownMenuSeparator />
                    
                    {/* Logout */}
                    <DropdownMenuItem 
                      onClick={async () => {
                        try {
                          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                          queryClient.clear();
                          window.location.href = '/';
                        } catch (error) {
                          console.error('Logout failed:', error);
                        }
                      }}
                      className="cursor-pointer text-destructive"
                      data-testid="button-logout"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {/* Theme Toggle for guests - Shows all 8 themes */}
                <ThemeToggle />
                <Button variant="ghost" asChild data-testid="button-login">
                  <a href="/api/login">Log In</a>
                </Button>
                <Button asChild data-testid="button-signup">
                  <a href="/api/login">Sign Up</a>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

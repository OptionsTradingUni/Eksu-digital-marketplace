import { Link, useLocation } from "wouter";
import { Home, Zap, MessageSquare, User, MoreHorizontal, BookOpen, Building2, Smartphone, Gamepad2, Compass, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  isActive: boolean;
  testId: string;
  badgeCount?: number;
}

function NavItem({ icon, label, href, isActive, testId, badgeCount }: NavItemProps) {
  return (
    <Link href={href}>
      <Button
        variant="ghost"
        className={cn(
          "flex flex-col items-center justify-center h-full w-full gap-0.5 rounded-none relative",
          isActive && "text-primary"
        )}
        data-testid={testId}
      >
        <div className="relative h-5 w-5">
          {icon}
          {badgeCount !== undefined && badgeCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-3 h-4 min-w-4 flex items-center justify-center p-0 text-[10px]"
              data-testid="badge-unread-messages"
            >
              {badgeCount > 99 ? "99+" : badgeCount}
            </Badge>
          )}
        </div>
        <span className="text-xs">{label}</span>
      </Button>
    </Link>
  );
}

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const unreadCount = unreadData?.count || 0;

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/";
    }
    return location.startsWith(path);
  };

  const moreMenuItems = [
    { icon: <Building2 className="h-5 w-5" />, label: "Hostel Finder", href: "/hostels", testId: "button-nav-hostels" },
    { icon: <BookOpen className="h-5 w-5" />, label: "Study Materials", href: "/study-materials", testId: "button-nav-study" },
    { icon: <Smartphone className="h-5 w-5" />, label: "VTU Data", href: "/vtu", testId: "button-nav-vtu" },
    { icon: <Gamepad2 className="h-5 w-5" />, label: "Games", href: "/games", testId: "button-nav-games" },
    { icon: <MessageCircle className="h-5 w-5" />, label: "Secret Messages", href: "/secret-messages", testId: "button-nav-secret" },
    { icon: <Compass className="h-5 w-5" />, label: "Explore All", href: "/explore", testId: "button-nav-explore" },
  ];

  const isMoreActive = moreMenuItems.some(item => isActive(item.href));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background lg:hidden"
      data-testid="bottom-nav"
    >
      <div className="grid h-16 grid-cols-5">
        <NavItem
          icon={<Home className="h-5 w-5" />}
          label="Home"
          href="/"
          isActive={isActive("/")}
          testId="button-nav-home"
        />

        <NavItem
          icon={<Zap className="h-5 w-5" />}
          label="The Plug"
          href="/the-plug"
          isActive={isActive("/the-plug")}
          testId="button-nav-plug"
        />

        <NavItem
          icon={<MessageSquare className="h-5 w-5" />}
          label="Messages"
          href="/messages"
          isActive={isActive("/messages")}
          testId="button-nav-messages"
          badgeCount={unreadCount}
        />

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "flex flex-col items-center justify-center h-full w-full gap-0.5 rounded-none",
                isMoreActive && "text-primary"
              )}
              data-testid="button-nav-more"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-xs">More</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-xl">
            <SheetHeader>
              <SheetTitle>Services & Features</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-4 py-6">
              {moreMenuItems.map((item) => (
                <Button
                  key={item.href}
                  variant="ghost"
                  className={cn(
                    "flex flex-col items-center justify-center h-20 gap-2",
                    isActive(item.href) && "bg-primary/10 text-primary"
                  )}
                  onClick={() => {
                    setLocation(item.href);
                    setMoreOpen(false);
                  }}
                  data-testid={item.testId}
                >
                  {item.icon}
                  <span className="text-xs text-center">{item.label}</span>
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        <NavItem
          icon={<User className="h-5 w-5" />}
          label="Profile"
          href="/profile"
          isActive={isActive("/profile")}
          testId="button-nav-profile"
        />
      </div>
    </nav>
  );
}

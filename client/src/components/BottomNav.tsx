import { Link, useLocation } from "wouter";
import { Home, Zap, MessageSquare, Gamepad2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

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
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();

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

        <NavItem
          icon={<Gamepad2 className="h-5 w-5" />}
          label="Games"
          href="/games"
          isActive={isActive("/games")}
          testId="button-nav-games"
        />

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

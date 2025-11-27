import { Link, useLocation } from "wouter";
import { Home, Zap, Search, MessageSquare, Gamepad2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  isActive: boolean;
  testId: string;
}

function NavItem({ icon, label, href, isActive, testId }: NavItemProps) {
  return (
    <Link href={href}>
      <Button
        variant="ghost"
        className={cn(
          "flex flex-col items-center justify-center h-full w-full gap-0.5 rounded-none",
          isActive && "text-primary"
        )}
        data-testid={testId}
      >
        <div className="h-5 w-5">{icon}</div>
        <span className="text-xs">{label}</span>
      </Button>
    </Link>
  );
}

export function BottomNav() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/" && !location.includes("?focus=search");
    }
    return location.startsWith(path);
  };

  const isSearchActive = location.includes("?focus=search");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background lg:hidden"
      data-testid="bottom-nav"
    >
      <div className="grid h-16 grid-cols-6">
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
          icon={<Search className="h-5 w-5" />}
          label="Search"
          href="/?focus=search"
          isActive={isSearchActive}
          testId="button-nav-search"
        />

        <NavItem
          icon={<MessageSquare className="h-5 w-5" />}
          label="Messages"
          href="/messages"
          isActive={isActive("/messages")}
          testId="button-nav-messages"
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

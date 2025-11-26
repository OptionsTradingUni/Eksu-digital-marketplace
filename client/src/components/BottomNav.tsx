import { Link, useLocation } from "wouter";
import { Home, Zap, Search, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/CartDrawer";
import { useCart } from "@/hooks/use-cart";
import { Badge } from "@/components/ui/badge";
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
  const { itemCount } = useCart();

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
          icon={<Search className="h-5 w-5" />}
          label="Search"
          href="/?focus=search"
          isActive={isSearchActive}
          testId="button-nav-search"
        />

        <CartDrawer>
          <Button
            variant="ghost"
            className={cn(
              "flex flex-col items-center justify-center h-full w-full gap-0.5 rounded-none relative"
            )}
            data-testid="button-nav-cart"
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[10px]"
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </Badge>
              )}
            </div>
            <span className="text-xs">Cart</span>
          </Button>
        </CartDrawer>

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

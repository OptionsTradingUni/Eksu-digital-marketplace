import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingBag, 
  Building2, 
  BookOpen, 
  Smartphone, 
  Gamepad2, 
  MessageCircle, 
  Zap, 
  Users,
  MessageSquare,
  Wallet,
  Heart,
  Trophy,
  Shield,
  HelpCircle,
  UsersRound
} from "lucide-react";

interface FeatureItem {
  icon: JSX.Element;
  title: string;
  description: string;
  href: string;
  badge?: string;
  color: string;
  bgColor: string;
}

interface FeatureCategory {
  title: string;
  description: string;
  items: FeatureItem[];
}

const featureCategories: FeatureCategory[] = [
  {
    title: "Marketplace",
    description: "Buy and sell items on campus",
    items: [
      {
        icon: <ShoppingBag className="h-6 w-6" />,
        title: "Browse Products",
        description: "Find great deals from fellow students",
        href: "/",
        color: "text-green-500",
        bgColor: "bg-green-500/10",
      },
      {
        icon: <Heart className="h-6 w-6" />,
        title: "Wishlist",
        description: "Save items you want to buy later",
        href: "/wishlist",
        color: "text-red-500",
        bgColor: "bg-red-500/10",
      },
      {
        icon: <Wallet className="h-6 w-6" />,
        title: "Wallet",
        description: "Manage your funds and transactions",
        href: "/wallet",
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
      },
    ],
  },
  {
    title: "Housing",
    description: "Find accommodation around campus",
    items: [
      {
        icon: <Building2 className="h-6 w-6" />,
        title: "Hostel Finder",
        description: "Browse available hostels and rooms",
        href: "/hostels",
        badge: "Popular",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
      },
    ],
  },
  {
    title: "Education",
    description: "Academic resources and materials",
    items: [
      {
        icon: <BookOpen className="h-6 w-6" />,
        title: "Study Materials",
        description: "Access notes, past questions, and textbooks",
        href: "/study-materials",
        badge: "New",
        color: "text-indigo-500",
        bgColor: "bg-indigo-500/10",
      },
    ],
  },
  {
    title: "Social",
    description: "Connect with the campus community",
    items: [
      {
        icon: <Zap className="h-6 w-6" />,
        title: "The Plug",
        description: "Campus news, updates, and discussions",
        href: "/the-plug",
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
      },
      {
        icon: <UsersRound className="h-6 w-6" />,
        title: "Communities",
        description: "Join groups and connect with others",
        href: "/communities",
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
      },
      {
        icon: <MessageSquare className="h-6 w-6" />,
        title: "Confessions",
        description: "Share anonymous thoughts and stories",
        href: "/confessions",
        color: "text-pink-500",
        bgColor: "bg-pink-500/10",
      },
      {
        icon: <MessageCircle className="h-6 w-6" />,
        title: "Secret Messages",
        description: "Send and receive anonymous messages",
        href: "/secret-messages",
        color: "text-rose-500",
        bgColor: "bg-rose-500/10",
      },
    ],
  },
  {
    title: "Services",
    description: "Useful services for students",
    items: [
      {
        icon: <Smartphone className="h-6 w-6" />,
        title: "VTU Data",
        description: "Buy airtime and data at discounted rates",
        href: "/vtu",
        badge: "Discounts",
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
      },
      {
        icon: <Users className="h-6 w-6" />,
        title: "Referrals",
        description: "Invite friends and earn rewards",
        href: "/referrals",
        color: "text-teal-500",
        bgColor: "bg-teal-500/10",
      },
      {
        icon: <Shield className="h-6 w-6" />,
        title: "KYC Verification",
        description: "Verify your identity for trusted trading",
        href: "/kyc",
        color: "text-slate-500",
        bgColor: "bg-slate-500/10",
      },
    ],
  },
  {
    title: "Games",
    description: "Play and win with friends",
    items: [
      {
        icon: <Gamepad2 className="h-6 w-6" />,
        title: "Games Hub",
        description: "Play Ludo, Whot, and more",
        href: "/games",
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
      },
      {
        icon: <Trophy className="h-6 w-6" />,
        title: "Leaderboards",
        description: "See top players and compete",
        href: "/games",
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
      },
    ],
  },
  {
    title: "Support",
    description: "Get help when you need it",
    items: [
      {
        icon: <HelpCircle className="h-6 w-6" />,
        title: "Help Center",
        description: "FAQs, guides, and support tickets",
        href: "/support",
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
      },
    ],
  },
];

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-explore-title">Explore EKSU Marketplace</h1>
          <p className="text-muted-foreground">Discover all features and services available to you</p>
        </div>

        <div className="space-y-10">
          {featureCategories.map((category) => (
            <section key={category.title} data-testid={`section-${category.title.toLowerCase()}`}>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">{category.title}</h2>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {category.items.map((item) => (
                  <Link key={item.href + item.title} href={item.href}>
                    <Card 
                      className="hover-elevate cursor-pointer transition-all h-full" 
                      data-testid={`card-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className={`p-3 rounded-lg ${item.bgColor}`}>
                            <div className={item.color}>{item.icon}</div>
                          </div>
                          {item.badge && (
                            <Badge variant="secondary" className="text-xs">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base mt-3">{item.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardDescription>{item.description}</CardDescription>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

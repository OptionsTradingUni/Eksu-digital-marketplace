import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Link2, 
  Users, 
  DollarSign, 
  Copy, 
  Share2, 
  CheckCircle, 
  Clock, 
  XCircle,
  Trophy,
  Gift,
  TrendingUp,
  ShoppingCart,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import type { Referral } from "@shared/schema";

interface ReferralWithUser extends Referral {
  referredUser?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    profileImageUrl: string | null;
  };
}

interface TierInfo {
  name: string;
  icon: typeof Trophy;
  minReferrals: number;
  maxReferrals: number | null;
  bonusMultiplier: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

const TIERS: TierInfo[] = [
  { 
    name: "Bronze", 
    icon: Trophy, 
    minReferrals: 0, 
    maxReferrals: 4, 
    bonusMultiplier: 1, 
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    borderColor: "border-orange-300 dark:border-orange-700"
  },
  { 
    name: "Silver", 
    icon: Trophy, 
    minReferrals: 5, 
    maxReferrals: 14, 
    bonusMultiplier: 1.5, 
    color: "text-slate-500 dark:text-slate-300",
    bgColor: "bg-slate-100 dark:bg-slate-800/50",
    borderColor: "border-slate-300 dark:border-slate-600"
  },
  { 
    name: "Gold", 
    icon: Trophy, 
    minReferrals: 15, 
    maxReferrals: 29, 
    bonusMultiplier: 2, 
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    borderColor: "border-yellow-400 dark:border-yellow-600"
  },
  { 
    name: "Platinum", 
    icon: Trophy, 
    minReferrals: 30, 
    maxReferrals: 49, 
    bonusMultiplier: 2.5, 
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    borderColor: "border-cyan-400 dark:border-cyan-600"
  },
  { 
    name: "Diamond", 
    icon: Trophy, 
    minReferrals: 50, 
    maxReferrals: null, 
    bonusMultiplier: 3, 
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    borderColor: "border-purple-400 dark:border-purple-600"
  },
];

function getTier(referralCount: number): TierInfo {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (referralCount >= TIERS[i].minReferrals) {
      return TIERS[i];
    }
  }
  return TIERS[0];
}

function getNextTier(referralCount: number): TierInfo | null {
  const currentTier = getTier(referralCount);
  const currentIndex = TIERS.findIndex(t => t.name === currentTier.name);
  if (currentIndex < TIERS.length - 1) {
    return TIERS[currentIndex + 1];
  }
  return null;
}

function getProgressToNextTier(referralCount: number): number {
  const currentTier = getTier(referralCount);
  const nextTier = getNextTier(referralCount);
  
  if (!nextTier) return 100;
  
  const progressInCurrentTier = referralCount - currentTier.minReferrals;
  const totalInCurrentTier = nextTier.minReferrals - currentTier.minReferrals;
  
  return Math.min((progressInCurrentTier / totalInCurrentTier) * 100, 100);
}

export default function ReferralsPage() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const { data: referrals, isLoading, isError, error, refetch } = useQuery<ReferralWithUser[]>({
    queryKey: ["/api/referrals"],
    enabled: !!user,
    retry: 2,
  });

  const referralCode = (user as any)?.referralCode || "--------";
  const referralLink = `${window.location.origin}/auth/signup?ref=${referralCode}`;

  const copyToClipboard = async (text: string, type: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "link") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
      toast({
        title: "Copied!",
        description: `Referral ${type} copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join EKSU Marketplace",
          text: `Sign up on EKSU Campus Marketplace using my referral code: ${referralCode}. Get a welcome bonus when you join!`,
          url: referralLink,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          copyToClipboard(referralLink, "link");
        }
      }
    } else {
      copyToClipboard(referralLink, "link");
    }
  };

  const pendingReferrals = referrals?.filter(r => !r.bonusPaid) || [];
  const completedReferrals = referrals?.filter(r => r.bonusPaid) || [];
  const referralsWithPurchases = referrals?.filter(r => r.referredUserMadePurchase) || [];

  const totalEarned = completedReferrals.reduce((sum, r) => sum + parseFloat(r.bonusAmount || "0"), 0);
  const totalReferrals = referrals?.length || 0;
  const successfulPurchases = referralsWithPurchases.length;

  const currentTier = getTier(totalReferrals);
  const nextTier = getNextTier(totalReferrals);
  const progressToNextTier = getProgressToNextTier(totalReferrals);
  const referralsNeededForNextTier = nextTier ? nextTier.minReferrals - totalReferrals : 0;

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
              <p className="text-muted-foreground mb-4">Please log in to view your referrals.</p>
              <Button asChild data-testid="button-login-referrals">
                <a href="/api/login">Log In</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Failed to Load Referrals</h2>
              <p className="text-muted-foreground mb-4">
                {error instanceof Error ? error.message : "An unexpected error occurred"}
              </p>
              <Button onClick={() => refetch()} data-testid="button-retry-referrals">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Referral Program</h1>
        <p className="text-muted-foreground">Invite friends and earn rewards for every successful referral</p>
      </div>

      <Card className={`mb-8 border-2 ${currentTier.borderColor}`}>
        <CardHeader className={`${currentTier.bgColor}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-3 ${currentTier.bgColor}`}>
                <Trophy className={`h-8 w-8 ${currentTier.color}`} />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  <span data-testid="text-current-tier">{currentTier.name} Tier</span>
                  <Badge variant="secondary" className="text-xs">
                    {currentTier.bonusMultiplier}x Bonus
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {nextTier 
                    ? `${referralsNeededForNextTier} more referral${referralsNeededForNextTier !== 1 ? 's' : ''} to reach ${nextTier.name}`
                    : "You've reached the highest tier!"
                  }
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress to next tier</span>
              <span className="font-medium" data-testid="text-tier-progress">
                {totalReferrals} / {nextTier?.minReferrals || totalReferrals} referrals
              </span>
            </div>
            <Progress value={progressToNextTier} className="h-3" data-testid="progress-tier" />
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              {TIERS.map((tier) => (
                <div 
                  key={tier.name} 
                  className={`flex items-center gap-1 text-xs ${
                    tier.name === currentTier.name ? tier.color + " font-semibold" : "text-muted-foreground"
                  }`}
                >
                  <Trophy className="h-3 w-3" />
                  <span>{tier.name}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Referrals</p>
                <p className="text-xl font-bold" data-testid="text-total-referrals">
                  {totalReferrals}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-500/10 p-2">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Earned</p>
                <p className="text-xl font-bold" data-testid="text-total-earned">
                  {totalEarned.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-500/10 p-2">
                <ShoppingCart className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Purchases Made</p>
                <p className="text-xl font-bold" data-testid="text-successful-purchases">
                  {successfulPurchases}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-500/10 p-2">
                <TrendingUp className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending Bonus</p>
                <p className="text-xl font-bold" data-testid="text-pending-count">
                  {pendingReferrals.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Your Referral Code & Link
          </CardTitle>
          <CardDescription>Share your code or link with friends to earn rewards</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Referral Code</label>
            <div className="flex gap-2">
              <Input
                value={referralCode}
                readOnly
                className="font-mono text-lg font-bold tracking-wider text-center"
                data-testid="input-referral-code"
              />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(referralCode, "code")}
                data-testid="button-copy-code"
              >
                {copiedCode ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Referral Link</label>
            <div className="flex gap-2">
              <Input
                value={referralLink}
                readOnly
                className="font-mono text-sm"
                data-testid="input-referral-link"
              />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(referralLink, "link")}
                data-testid="button-copy-link"
              >
                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button onClick={shareLink} className="w-full" data-testid="button-share-link">
            <Share2 className="h-4 w-4 mr-2" />
            Share Invitation Link
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="rounded-full bg-primary/10 p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                <Share2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">1. Share</h3>
              <p className="text-sm text-muted-foreground">Share your referral code or link with friends</p>
            </div>
            <div className="text-center">
              <div className="rounded-full bg-primary/10 p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">2. Friends Join</h3>
              <p className="text-sm text-muted-foreground">Friends sign up using your code and fund their wallet</p>
            </div>
            <div className="text-center">
              <div className="rounded-full bg-green-500/10 p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="font-semibold mb-1">3. Earn Rewards</h3>
              <p className="text-sm text-muted-foreground">Get bonus for each successful referral (up to 3x at Diamond tier)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Referral History
          </CardTitle>
          <CardDescription>Track all your referred users and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" data-testid="tab-all">
                All ({referrals?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending">
                Pending ({pendingReferrals.length})
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">
                Completed ({completedReferrals.length})
              </TabsTrigger>
              <TabsTrigger value="purchased" data-testid="tab-purchased">
                Purchased ({referralsWithPurchases.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {referrals && referrals.length > 0 ? (
                <div className="space-y-3">
                  {referrals.map((ref) => (
                    <ReferralItem key={ref.id} referral={ref} />
                  ))}
                </div>
              ) : (
                <EmptyState 
                  icon={Users} 
                  title="No referrals yet" 
                  description="Share your referral link to start earning rewards"
                />
              )}
            </TabsContent>

            <TabsContent value="pending" className="mt-4">
              {pendingReferrals.length > 0 ? (
                <div className="space-y-3">
                  {pendingReferrals.map((ref) => (
                    <ReferralItem key={ref.id} referral={ref} />
                  ))}
                </div>
              ) : (
                <EmptyState 
                  icon={Clock} 
                  title="No pending referrals" 
                  description="Pending referrals will appear here"
                />
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
              {completedReferrals.length > 0 ? (
                <div className="space-y-3">
                  {completedReferrals.map((ref) => (
                    <ReferralItem key={ref.id} referral={ref} />
                  ))}
                </div>
              ) : (
                <EmptyState 
                  icon={CheckCircle} 
                  title="No completed referrals" 
                  description="Completed referrals with paid bonuses will appear here"
                />
              )}
            </TabsContent>

            <TabsContent value="purchased" className="mt-4">
              {referralsWithPurchases.length > 0 ? (
                <div className="space-y-3">
                  {referralsWithPurchases.map((ref) => (
                    <ReferralItem key={ref.id} referral={ref} />
                  ))}
                </div>
              ) : (
                <EmptyState 
                  icon={ShoppingCart} 
                  title="No purchases yet" 
                  description="Referrals who made purchases will appear here"
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Tier Benefits
          </CardTitle>
          <CardDescription>Unlock higher tiers for better rewards</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <div 
                key={tier.name}
                className={`p-4 rounded-lg border-2 ${
                  tier.name === currentTier.name 
                    ? `${tier.borderColor} ${tier.bgColor}` 
                    : "border-border"
                }`}
                data-testid={`tier-card-${tier.name.toLowerCase()}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className={`h-5 w-5 ${tier.color}`} />
                  <span className={`font-semibold ${tier.color}`}>{tier.name}</span>
                  {tier.name === currentTier.name && (
                    <Badge variant="secondary" className="text-xs ml-auto">Current</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {tier.minReferrals}+ referrals
                </p>
                <p className="text-lg font-bold">{tier.bonusMultiplier}x Bonus</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReferralItem({ referral }: { referral: ReferralWithUser }) {
  const statusConfig = {
    completed: {
      icon: CheckCircle,
      color: "text-green-500",
      badge: <Badge variant="default" className="bg-green-500 dark:bg-green-600">Paid</Badge>,
    },
    pending: {
      icon: Clock,
      color: "text-yellow-500",
      badge: <Badge variant="secondary">Pending</Badge>,
    },
  };

  const status = referral.bonusPaid ? "completed" : "pending";
  const config = statusConfig[status];
  
  const getUserDisplayName = () => {
    if (referral.referredUser?.firstName && referral.referredUser?.lastName) {
      return `${referral.referredUser.firstName} ${referral.referredUser.lastName}`;
    }
    if (referral.referredUser?.firstName) {
      return referral.referredUser.firstName;
    }
    if (referral.referredUser?.email) {
      return referral.referredUser.email.split('@')[0];
    }
    return "Unknown User";
  };

  const getAvatarInitials = () => {
    if (referral.referredUser?.firstName && referral.referredUser?.lastName) {
      return `${referral.referredUser.firstName[0]}${referral.referredUser.lastName[0]}`.toUpperCase();
    }
    if (referral.referredUser?.firstName) {
      return referral.referredUser.firstName.slice(0, 2).toUpperCase();
    }
    if (referral.referredUser?.email) {
      return referral.referredUser.email.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  return (
    <div
      className="flex items-center justify-between gap-4 p-4 border rounded-lg"
      data-testid={`referral-item-${referral.id}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="text-sm font-medium">
            {getAvatarInitials()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate" data-testid={`text-referral-name-${referral.id}`}>
            {getUserDisplayName()}
          </p>
          <p className="text-sm text-muted-foreground">
            {referral.createdAt 
              ? format(new Date(referral.createdAt), "MMM d, yyyy")
              : "Date unknown"
            }
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {referral.referredUserMadePurchase && (
          <Badge variant="outline" className="gap-1">
            <ShoppingCart className="h-3 w-3" />
            Purchased
          </Badge>
        )}
        {referral.bonusPaid && referral.bonusAmount && (
          <span className="font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
            +{parseFloat(referral.bonusAmount).toLocaleString()}
          </span>
        )}
        {config.badge}
      </div>
    </div>
  );
}

function EmptyState({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: typeof Users; 
  title: string; 
  description: string;
}) {
  return (
    <div className="text-center py-12">
      <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Gift, Trophy, Star, ArrowRight, Sparkles, Wallet, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface RewardPoints {
  id: string;
  userId: string;
  totalPoints: number;
  availablePoints: number;
  redeemedPoints: number;
  lifetimePoints: number;
  tier: string;
  createdAt: string;
  updatedAt: string;
}

interface PointsTransaction {
  id: string;
  userId: string;
  type: string;
  points: number;
  description: string;
  source: string;
  relatedTransactionId: string | null;
  createdAt: string;
}

const TIER_CONFIG: Record<string, { color: string; minPoints: number; multiplier: number; icon: typeof Trophy }> = {
  bronze: { color: "from-amber-600 to-amber-800", minPoints: 0, multiplier: 1, icon: Star },
  silver: { color: "from-gray-400 to-gray-600", minPoints: 10000, multiplier: 1.25, icon: Star },
  gold: { color: "from-yellow-400 to-yellow-600", minPoints: 50000, multiplier: 1.5, icon: Trophy },
  platinum: { color: "from-indigo-400 to-purple-600", minPoints: 200000, multiplier: 2, icon: Sparkles },
};

const TIER_ORDER = ["bronze", "silver", "gold", "platinum"];

interface RedemptionOption {
  id: string;
  name: string;
  points: number;
  value: number;
}

const REDEMPTION_OPTIONS: RedemptionOption[] = [
  { id: "wallet_100", name: "N100 Wallet Credit", points: 100, value: 100 },
  { id: "wallet_200", name: "N200 Wallet Credit", points: 180, value: 200 },
  { id: "wallet_500", name: "N500 Wallet Credit", points: 400, value: 500 },
  { id: "wallet_1000", name: "N1,000 Wallet Credit", points: 750, value: 1000 },
  { id: "wallet_2000", name: "N2,000 Wallet Credit", points: 1400, value: 2000 },
  { id: "wallet_5000", name: "N5,000 Wallet Credit", points: 3000, value: 5000 },
];

export function RewardsCenter() {
  const { toast } = useToast();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const { data: rewards, isLoading: rewardsLoading, refetch } = useQuery<RewardPoints>({
    queryKey: ["/api/rewards"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<PointsTransaction[]>({
    queryKey: ["/api/rewards/transactions"],
  });

  const redeemMutation = useMutation({
    mutationFn: async (optionId: string) => {
      return apiRequest("/api/rewards/redeem", "POST", { optionId });
    },
    onSuccess: (data: any) => {
      const option = REDEMPTION_OPTIONS.find(o => o.id === selectedOptionId);
      toast({
        title: "Points Redeemed!",
        description: `You've redeemed ${option?.points || 0} points for ${option?.name || "wallet credit"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setSelectedOptionId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Redemption Failed",
        description: error.message || "Failed to redeem points. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRedeem = (optionId: string) => {
    const option = REDEMPTION_OPTIONS.find(o => o.id === optionId);
    if (!option) return;
    
    if (rewards && option.points > (rewards.totalPoints || 0)) {
      toast({
        title: "Insufficient Points",
        description: `You need ${option.points} points but only have ${rewards.totalPoints || 0}.`,
        variant: "destructive",
      });
      return;
    }
    setSelectedOptionId(optionId);
    redeemMutation.mutate(optionId);
  };

  if (rewardsLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loader-rewards">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentTier = rewards?.tier || "bronze";
  const tierConfig = TIER_CONFIG[currentTier];
  const tierIndex = TIER_ORDER.indexOf(currentTier);
  const nextTier = tierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[tierIndex + 1] : null;
  const nextTierConfig = nextTier ? TIER_CONFIG[nextTier] : null;
  const lifetimePoints = rewards?.lifetimePoints || 0;
  const pointsToNextTier = nextTierConfig ? nextTierConfig.minPoints - lifetimePoints : 0;
  const progressToNextTier = nextTierConfig 
    ? Math.min(100, ((lifetimePoints - tierConfig.minPoints) / (nextTierConfig.minPoints - tierConfig.minPoints)) * 100)
    : 100;

  const availablePoints = rewards?.totalPoints || 0;
  const nairaValue = Math.floor(availablePoints / 10);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className={`bg-gradient-to-br ${tierConfig.color} text-white col-span-1 md:col-span-2 lg:col-span-1`} data-testid="card-tier-status">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg font-medium text-white/90">Your Tier</CardTitle>
              <Badge variant="secondary" className="bg-white/20 text-white capitalize border-0" data-testid="badge-tier">
                {currentTier}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-white/20">
                <tierConfig.icon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-points-balance">
                  {availablePoints.toLocaleString()}
                </p>
                <p className="text-sm text-white/80">Available Points</p>
              </div>
            </div>
            
            {nextTier && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-white/80">
                  <span>Progress to {nextTier}</span>
                  <span>{pointsToNextTier.toLocaleString()} pts left</span>
                </div>
                <Progress value={progressToNextTier} className="h-2 bg-white/20" />
              </div>
            )}

            <div className="pt-2 border-t border-white/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/80">Points Multiplier</span>
                <span className="font-semibold" data-testid="text-multiplier">{tierConfig.multiplier}x</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-points-value">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg font-medium">Point Value</CardTitle>
              <Wallet className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600" data-testid="text-naira-value">
                N{nairaValue.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Available Wallet Credit</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground text-center">
                10 points = N1 wallet credit
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-lifetime-stats">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg font-medium">Lifetime Stats</CardTitle>
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-md bg-muted/50">
                <p className="text-xl font-bold" data-testid="text-lifetime-earned">
                  {(rewards?.lifetimePoints || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total Earned</p>
              </div>
              <div className="text-center p-3 rounded-md bg-muted/50">
                <p className="text-xl font-bold" data-testid="text-lifetime-redeemed">
                  {(rewards?.redeemedPoints || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Redeemed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="card-redeem-points">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Redeem Points</CardTitle>
                <CardDescription>Convert your points to wallet credit</CardDescription>
              </div>
              <Gift className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {REDEMPTION_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  variant={selectedOptionId === option.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleRedeem(option.id)}
                  disabled={option.points > availablePoints || redeemMutation.isPending}
                  className="flex flex-col items-start h-auto py-3 px-4"
                  data-testid={`button-redeem-${option.id}`}
                >
                  <span className="font-semibold">{option.name}</span>
                  <span className="text-xs opacity-70">
                    {option.points.toLocaleString()} points
                  </span>
                </Button>
              ))}
            </div>
            {redeemMutation.isPending && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redeeming points...</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-points-history">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Points History</CardTitle>
                <CardDescription>Your recent points activity</CardDescription>
              </div>
              <Sparkles className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              {transactionsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : transactions && transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((tx, index) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                      data-testid={`row-points-tx-${index}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.createdAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <div className={`text-sm font-bold ${tx.type === "earn" ? "text-green-600" : "text-red-600"}`}>
                        {tx.type === "earn" ? "+" : "-"}{Math.abs(tx.points).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm">No points activity yet</p>
                  <p className="text-xs">Make purchases to earn reward points!</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-how-it-works">
        <CardHeader>
          <CardTitle>How Rewards Work</CardTitle>
          <CardDescription>Earn points on every purchase and enjoy exclusive benefits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-md bg-muted/50 text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600">
                <Gift className="w-5 h-5" />
              </div>
              <h4 className="font-medium mb-1">Earn Points</h4>
              <p className="text-sm text-muted-foreground">
                Get 10 points for every N1,000 you spend on data, airtime, and bills
              </p>
            </div>
            <div className="p-4 rounded-md bg-muted/50 text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h4 className="font-medium mb-1">Level Up</h4>
              <p className="text-sm text-muted-foreground">
                Earn more points with higher tiers - up to 2x multiplier for Platinum
              </p>
            </div>
            <div className="p-4 rounded-md bg-muted/50 text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-3 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600">
                <Wallet className="w-5 h-5" />
              </div>
              <h4 className="font-medium mb-1">Redeem Rewards</h4>
              <p className="text-sm text-muted-foreground">
                Convert 1,000+ points to wallet credit (10 pts = N1)
              </p>
            </div>
            <div className="p-4 rounded-md bg-muted/50 text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="font-medium mb-1">Exclusive Benefits</h4>
              <p className="text-sm text-muted-foreground">
                Higher tiers unlock special discounts and priority support
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

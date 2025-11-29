import { RewardsCenter } from "@/components/RewardsCenter";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function RewardsPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
        <p className="text-muted-foreground mb-6">Please sign in to access your rewards.</p>
        <Link href="/login">
          <Button data-testid="button-login">Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/vtu">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Rewards Center</h1>
          <p className="text-muted-foreground">Earn points, unlock rewards, and save more</p>
        </div>
      </div>
      <RewardsCenter />
    </div>
  );
}

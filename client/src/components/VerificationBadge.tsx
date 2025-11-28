import { BadgeCheck, Crown, Store, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type VerificationType = "verified" | "official" | "seller" | "admin";

interface VerificationBadgeProps {
  type: VerificationType;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

const badgeConfig = {
  verified: {
    icon: BadgeCheck,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Verified User",
    description: "This user has been verified",
  },
  official: {
    icon: Crown,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "Official Campus Account",
    description: "Official EKSU campus account",
  },
  seller: {
    icon: Store,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    label: "Verified Seller",
    description: "Trusted seller on the marketplace",
  },
  admin: {
    icon: Shield,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Admin",
    description: "Platform administrator",
  },
};

const sizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function VerificationBadge({ 
  type, 
  size = "md", 
  showTooltip = true,
  className 
}: VerificationBadgeProps) {
  const config = badgeConfig[type];
  const Icon = config.icon;

  const badge = (
    <span 
      className={cn("inline-flex items-center", className)}
      data-testid={`badge-${type}`}
    >
      <Icon className={cn(sizeClasses[size], config.color)} />
    </span>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">{config.label}</p>
        <p className="text-muted-foreground">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function getUserBadgeType(user: {
  isVerified?: boolean;
  isSeller?: boolean;
  isAdmin?: boolean;
  isOfficial?: boolean;
  role?: string;
}): VerificationType | null {
  if (user.isAdmin || user.role === 'admin') return 'admin';
  if (user.isOfficial) return 'official';
  if (user.isSeller) return 'seller';
  if (user.isVerified) return 'verified';
  return null;
}

export function UserBadges({ user, size = "md" }: { 
  user: {
    isVerified?: boolean;
    isSeller?: boolean;
    isAdmin?: boolean;
    isOfficial?: boolean;
    role?: string;
  };
  size?: "sm" | "md" | "lg";
}) {
  const badges: VerificationType[] = [];
  
  if (user.isAdmin || user.role === 'admin') badges.push('admin');
  if (user.isOfficial) badges.push('official');
  if (user.isSeller) badges.push('seller');
  if (user.isVerified && !user.isOfficial && !user.isAdmin) badges.push('verified');

  if (badges.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5">
      {badges.map((type) => (
        <VerificationBadge key={type} type={type} size={size} />
      ))}
    </span>
  );
}

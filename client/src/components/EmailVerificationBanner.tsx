import { AlertCircle, Mail, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const BANNER_DISMISS_KEY = "eksu_email_verify_dismissed";
const BANNER_DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

interface EmailVerificationBannerProps {
  email?: string;
  onDismiss?: () => void;
}

function isDismissedInStorage(): boolean {
  try {
    const dismissed = localStorage.getItem(BANNER_DISMISS_KEY);
    if (!dismissed) return false;
    
    const dismissedAt = parseInt(dismissed, 10);
    const now = Date.now();
    
    // Check if dismissal has expired (24 hours)
    if (now - dismissedAt > BANNER_DISMISS_DURATION) {
      localStorage.removeItem(BANNER_DISMISS_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function setDismissedInStorage(): void {
  try {
    localStorage.setItem(BANNER_DISMISS_KEY, Date.now().toString());
  } catch {
    // Ignore storage errors
  }
}

export function EmailVerificationBanner({ email, onDismiss }: EmailVerificationBannerProps) {
  const [isResending, setIsResending] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => isDismissedInStorage());
  const { toast } = useToast();

  const handleResendVerification = async () => {
    setIsResending(true);
    try {
      await apiRequest("POST", "/api/auth/resend-verification");
      toast({
        title: "Verification email sent",
        description: "Please check your inbox for the verification link.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to send verification",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleDismiss = () => {
    setDismissedInStorage();
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) {
    return null;
  }

  return (
    <Alert 
      className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 mb-4 relative"
      data-testid="alert-email-verification"
    >
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2 ml-2">
        <div className="flex-1 text-amber-800 dark:text-amber-200">
          <span className="font-medium">Email not verified.</span>
          <span className="ml-1 text-amber-700 dark:text-amber-300">
            Verify your email to access all features. Unverified accounts are limited to 3 listings and cannot message, buy, or post in The Plug.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleResendVerification}
            disabled={isResending}
            className="border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            data-testid="button-resend-verification"
          >
            <Mail className="h-4 w-4 mr-1" />
            {isResending ? "Sending..." : "Resend Email"}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 w-8 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            data-testid="button-dismiss-verification-banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

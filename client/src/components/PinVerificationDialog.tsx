import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, AlertTriangle, Eye, EyeOff, Loader2, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PinVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (pin: string) => void;
  title?: string;
  description?: string;
}

interface PinStatus {
  pinSet: boolean;
  isLocked: boolean;
  lockRemainingMinutes: number;
  attemptsRemaining: number;
}

export function PinVerificationDialog({
  open,
  onOpenChange,
  onSuccess,
  title = "Verify Transaction PIN",
  description = "Enter your transaction PIN to continue with this operation.",
}: PinVerificationDialogProps) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [isLocked, setIsLocked] = useState(false);
  const [lockMinutes, setLockMinutes] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setPin("");
      setShowPin(false);
      setError(null);
    }
  }, [open]);

  const verifyMutation = useMutation({
    mutationFn: async (pinValue: string) => {
      const response = await apiRequest("POST", "/api/auth/pin/verify", { pin: pinValue });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.verified) {
        onSuccess(pin);
        setPin("");
        setError(null);
        onOpenChange(false);
      }
    },
    onError: async (error: any) => {
      try {
        const response = error.response;
        if (response) {
          const data = await response.json();
          
          if (data.locked) {
            setIsLocked(true);
            setLockMinutes(data.remainingMinutes || 30);
            setError(data.message);
          } else if (data.remainingAttempts !== undefined) {
            setRemainingAttempts(data.remainingAttempts);
            setError(data.message);
          } else {
            setError(data.message || "PIN verification failed");
          }
        } else {
          setError("Failed to verify PIN. Please try again.");
        }
      } catch {
        setError("Failed to verify PIN. Please try again.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin.length < 4 || pin.length > 6) {
      setError("PIN must be 4-6 digits");
      return;
    }

    if (!/^\d+$/.test(pin)) {
      setError("PIN must contain only digits");
      return;
    }

    setError(null);
    verifyMutation.mutate(pin);
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPin(value);
    if (error) setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isLocked ? (
          <div className="py-4">
            <Alert variant="destructive">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Your PIN is temporarily locked due to too many failed attempts.
                Please try again in {lockMinutes} minute{lockMinutes !== 1 ? "s" : ""}.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Transaction PIN</Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showPin ? "text" : "password"}
                  placeholder="Enter your PIN"
                  value={pin}
                  onChange={handlePinChange}
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  className="pr-10 text-center text-lg tracking-widest"
                  data-testid="input-pin"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowPin(!showPin)}
                  tabIndex={-1}
                  data-testid="button-toggle-pin-visibility"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {remainingAttempts < 5 && !isLocked && (
              <p className="text-sm text-muted-foreground text-center">
                {remainingAttempts} attempt{remainingAttempts !== 1 ? "s" : ""} remaining
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-pin"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pin.length < 4 || verifyMutation.isPending}
                data-testid="button-submit-pin"
              >
                {verifyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify PIN"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface SetupPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode?: "setup" | "change";
}

export function SetupPinDialog({
  open,
  onOpenChange,
  onSuccess,
  mode = "setup",
}: SetupPinDialogProps) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setShowCurrentPin(false);
      setShowNewPin(false);
      setShowConfirmPin(false);
      setError(null);
    }
  }, [open]);

  const setupMutation = useMutation({
    mutationFn: async () => {
      const endpoint = mode === "setup" ? "/api/auth/pin/setup" : "/api/auth/pin/change";
      const body = mode === "setup"
        ? { pin: newPin, confirmPin: confirmPin }
        : { currentPin, newPin, confirmNewPin: confirmPin };
      const response = await apiRequest("POST", endpoint, body);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: mode === "setup" ? "PIN Created" : "PIN Changed",
          description: data.message,
        });
        onSuccess();
        onOpenChange(false);
      }
    },
    onError: async (error: any) => {
      try {
        const response = error.response;
        if (response) {
          const data = await response.json();
          setError(data.message || "Operation failed");
        } else {
          setError("Operation failed. Please try again.");
        }
      } catch {
        setError("Operation failed. Please try again.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === "change" && (currentPin.length < 4 || currentPin.length > 6)) {
      setError("Current PIN must be 4-6 digits");
      return;
    }

    if (newPin.length < 4 || newPin.length > 6) {
      setError("New PIN must be 4-6 digits");
      return;
    }

    if (!/^\d+$/.test(newPin)) {
      setError("PIN must contain only digits");
      return;
    }

    if (newPin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    setError(null);
    setupMutation.mutate();
  };

  const handlePinInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void
  ) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setter(value);
    if (error) setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {mode === "setup" ? "Set Transaction PIN" : "Change Transaction PIN"}
          </DialogTitle>
          <DialogDescription>
            {mode === "setup"
              ? "Create a 4-6 digit PIN to secure your wallet transactions."
              : "Enter your current PIN and set a new one."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "change" && (
            <div className="space-y-2">
              <Label htmlFor="currentPin">Current PIN</Label>
              <div className="relative">
                <Input
                  id="currentPin"
                  type={showCurrentPin ? "text" : "password"}
                  placeholder="Enter current PIN"
                  value={currentPin}
                  onChange={(e) => handlePinInput(e, setCurrentPin)}
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  className="pr-10 text-center text-lg tracking-widest"
                  data-testid="input-current-pin"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowCurrentPin(!showCurrentPin)}
                  tabIndex={-1}
                >
                  {showCurrentPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="newPin">{mode === "setup" ? "PIN" : "New PIN"}</Label>
            <div className="relative">
              <Input
                id="newPin"
                type={showNewPin ? "text" : "password"}
                placeholder={mode === "setup" ? "Enter PIN" : "Enter new PIN"}
                value={newPin}
                onChange={(e) => handlePinInput(e, setNewPin)}
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                className="pr-10 text-center text-lg tracking-widest"
                data-testid="input-new-pin"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowNewPin(!showNewPin)}
                tabIndex={-1}
              >
                {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <div className="relative">
              <Input
                id="confirmPin"
                type={showConfirmPin ? "text" : "password"}
                placeholder="Confirm PIN"
                value={confirmPin}
                onChange={(e) => handlePinInput(e, setConfirmPin)}
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                className="pr-10 text-center text-lg tracking-widest"
                data-testid="input-confirm-pin"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                tabIndex={-1}
              >
                {showConfirmPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-muted-foreground">
            Your PIN will be required for withdrawals and other sensitive transactions.
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-setup"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                (mode === "change" && currentPin.length < 4) ||
                newPin.length < 4 ||
                confirmPin.length < 4 ||
                setupMutation.isPending
              }
              data-testid="button-submit-setup"
            >
              {setupMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "setup" ? "Setting up..." : "Changing..."}
                </>
              ) : mode === "setup" ? (
                "Set PIN"
              ) : (
                "Change PIN"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ResetPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ResetPinDialog({
  open,
  onOpenChange,
  onSuccess,
}: ResetPinDialogProps) {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [code, setCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setStep("request");
      setCode("");
      setNewPin("");
      setConfirmPin("");
      setShowNewPin(false);
      setShowConfirmPin(false);
      setError(null);
    }
  }, [open]);

  const requestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/pin/reset-request", {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Code Sent",
          description: "Check your email for the reset code.",
        });
        setStep("confirm");
      }
    },
    onError: async (error: any) => {
      try {
        const response = error.response;
        if (response) {
          const data = await response.json();
          setError(data.message || "Failed to send reset code");
        } else {
          setError("Failed to send reset code. Please try again.");
        }
      } catch {
        setError("Failed to send reset code. Please try again.");
      }
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/pin/reset-confirm", {
        code,
        newPin,
        confirmNewPin: confirmPin,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "PIN Reset",
          description: "Your transaction PIN has been reset successfully.",
        });
        onSuccess();
        onOpenChange(false);
      }
    },
    onError: async (error: any) => {
      try {
        const response = error.response;
        if (response) {
          const data = await response.json();
          setError(data.message || "Failed to reset PIN");
        } else {
          setError("Failed to reset PIN. Please try again.");
        }
      } catch {
        setError("Failed to reset PIN. Please try again.");
      }
    },
  });

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    requestMutation.mutate();
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 6) {
      setError("Reset code must be 6 digits");
      return;
    }

    if (newPin.length < 4 || newPin.length > 6) {
      setError("New PIN must be 4-6 digits");
      return;
    }

    if (!/^\d+$/.test(newPin)) {
      setError("PIN must contain only digits");
      return;
    }

    if (newPin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    setError(null);
    confirmMutation.mutate();
  };

  const handlePinInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void,
    maxLength = 6
  ) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, maxLength);
    setter(value);
    if (error) setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Reset Transaction PIN
          </DialogTitle>
          <DialogDescription>
            {step === "request"
              ? "We'll send a reset code to your registered email address."
              : "Enter the code from your email and set a new PIN."}
          </DialogDescription>
        </DialogHeader>

        {step === "request" ? (
          <form onSubmit={handleRequestSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click the button below to receive a 6-digit reset code in your email.
              The code will expire in 15 minutes.
            </p>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={requestMutation.isPending}
                data-testid="button-request-reset"
              >
                {requestMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Code"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleConfirmSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resetCode">Reset Code</Label>
              <Input
                id="resetCode"
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => handlePinInput(e, setCode, 6)}
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                className="text-center text-lg tracking-widest"
                data-testid="input-reset-code"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newResetPin">New PIN</Label>
              <div className="relative">
                <Input
                  id="newResetPin"
                  type={showNewPin ? "text" : "password"}
                  placeholder="Enter new PIN"
                  value={newPin}
                  onChange={(e) => handlePinInput(e, setNewPin)}
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  className="pr-10 text-center text-lg tracking-widest"
                  data-testid="input-new-reset-pin"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowNewPin(!showNewPin)}
                  tabIndex={-1}
                >
                  {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmResetPin">Confirm PIN</Label>
              <div className="relative">
                <Input
                  id="confirmResetPin"
                  type={showConfirmPin ? "text" : "password"}
                  placeholder="Confirm PIN"
                  value={confirmPin}
                  onChange={(e) => handlePinInput(e, setConfirmPin)}
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  className="pr-10 text-center text-lg tracking-widest"
                  data-testid="input-confirm-reset-pin"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowConfirmPin(!showConfirmPin)}
                  tabIndex={-1}
                >
                  {showConfirmPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("request")}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={
                  code.length !== 6 ||
                  newPin.length < 4 ||
                  confirmPin.length < 4 ||
                  confirmMutation.isPending
                }
                data-testid="button-confirm-reset"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset PIN"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

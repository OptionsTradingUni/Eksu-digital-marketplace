import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, Wallet, MapPin } from "lucide-react";

interface SafetyShieldModalProps {
  sellerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
}

const STORAGE_KEY_PREFIX = "safety_acknowledged_";

export function getSafetyAcknowledgedKey(sellerId: string): string {
  return `${STORAGE_KEY_PREFIX}${sellerId}`;
}

export function hasSafetyBeenAcknowledged(sellerId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(getSafetyAcknowledgedKey(sellerId)) === "true";
}

export function acknowledgeSafety(sellerId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getSafetyAcknowledgedKey(sellerId), "true");
}

export function SafetyShieldModal({
  sellerId,
  open,
  onOpenChange,
  onAcknowledge,
}: SafetyShieldModalProps) {
  const handleAcknowledge = useCallback(() => {
    acknowledgeSafety(sellerId);
    onAcknowledge();
    onOpenChange(false);
  }, [sellerId, onAcknowledge, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-safety-shield">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Safety First
          </DialogTitle>
          <DialogDescription className="text-center">
            Before you start chatting, please review these important safety guidelines
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm" data-testid="text-safety-warning">
                Do not pay this seller directly via bank transfer
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Direct payments are risky and not protected by EKSU Marketplace
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <Wallet className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm" data-testid="text-safety-rule">
                Only pay through the EKSU Marketplace Wallet/Escrow
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Your money is held safely until you receive your item
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-green-500/10 dark:bg-green-500/20 rounded-lg border border-green-500/20 dark:border-green-500/30">
            <MapPin className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm" data-testid="text-safety-tip">
                Meet in open campus areas (e.g., SUB, Faculty building)
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Always meet in busy, well-lit public spaces
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            onClick={handleAcknowledge}
            className="w-full sm:w-auto min-w-[200px]"
            data-testid="button-safety-acknowledge"
          >
            <Shield className="w-4 h-4 mr-2" />
            I Understand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SafetyShieldModal;

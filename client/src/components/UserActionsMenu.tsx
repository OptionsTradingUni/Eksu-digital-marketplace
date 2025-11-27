import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, VolumeX, Volume2, Ban, UserCheck, Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface UserRelationship {
  isBlocked: boolean;
  isMuted: boolean;
  isBlockedByTarget: boolean;
}

interface UserActionsMenuProps {
  targetUserId: string;
  targetUserName: string;
  onAction?: (action: "block" | "unblock" | "mute" | "unmute" | "report") => void;
}

export function UserActionsMenu({ targetUserId, targetUserName, onAction }: UserActionsMenuProps) {
  const { toast } = useToast();
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportDescription, setReportDescription] = useState("");

  const { data: relationship, isLoading: isLoadingRelationship } = useQuery<UserRelationship>({
    queryKey: ["/api/users", targetUserId, "relationship"],
    enabled: !!targetUserId,
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/users/${targetUserId}/block`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", targetUserId, "relationship"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/blocked"] });
      toast({
        title: "User blocked",
        description: `You have blocked ${targetUserName}. They can no longer contact you.`,
      });
      onAction?.("block");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to block user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/users/${targetUserId}/block`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", targetUserId, "relationship"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/blocked"] });
      toast({
        title: "User unblocked",
        description: `You have unblocked ${targetUserName}.`,
      });
      onAction?.("unblock");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unblock user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const muteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/users/${targetUserId}/mute`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", targetUserId, "relationship"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/muted"] });
      toast({
        title: "User muted",
        description: `You have muted ${targetUserName}. Their content will be hidden.`,
      });
      onAction?.("mute");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to mute user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unmuteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/users/${targetUserId}/mute`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", targetUserId, "relationship"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/muted"] });
      toast({
        title: "User unmuted",
        description: `You have unmuted ${targetUserName}.`,
      });
      onAction?.("unmute");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unmute user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (data: { reason: string; description?: string }) => {
      await apiRequest("POST", `/api/users/${targetUserId}/report`, data);
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Thank you for your report. Our team will review it shortly.",
      });
      setReportDialogOpen(false);
      setReportReason("");
      setReportDescription("");
      onAction?.("report");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit report",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReport = () => {
    if (!reportReason) {
      toast({
        title: "Please select a reason",
        description: "You must select a reason for your report.",
        variant: "destructive",
      });
      return;
    }
    reportMutation.mutate({
      reason: reportReason,
      description: reportDescription || undefined,
    });
  };

  const isBlocked = relationship?.isBlocked ?? false;
  const isMuted = relationship?.isMuted ?? false;
  const isBlockedByTarget = relationship?.isBlockedByTarget ?? false;
  const isPending = blockMutation.isPending || unblockMutation.isPending || 
                   muteMutation.isPending || unmuteMutation.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            disabled={isLoadingRelationship || isPending}
            data-testid="button-user-actions"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isMuted ? (
            <DropdownMenuItem
              onClick={() => unmuteMutation.mutate()}
              data-testid="menu-item-unmute"
            >
              <Volume2 className="mr-2 h-4 w-4" />
              Unmute {targetUserName}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => muteMutation.mutate()}
              data-testid="menu-item-mute"
            >
              <VolumeX className="mr-2 h-4 w-4" />
              Mute {targetUserName}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {isBlocked ? (
            <DropdownMenuItem
              onClick={() => unblockMutation.mutate()}
              data-testid="menu-item-unblock"
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Unblock {targetUserName}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => blockMutation.mutate()}
              className="text-destructive focus:text-destructive"
              data-testid="menu-item-block"
            >
              <Ban className="mr-2 h-4 w-4" />
              Block {targetUserName}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setReportDialogOpen(true)}
            className="text-destructive focus:text-destructive"
            data-testid="menu-item-report"
          >
            <Flag className="mr-2 h-4 w-4" />
            Report {targetUserName}
          </DropdownMenuItem>

          {isBlockedByTarget && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                This user has blocked you
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {targetUserName}</DialogTitle>
            <DialogDescription>
              Help us understand the issue. Your report will be reviewed by our team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for report</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger id="reason" data-testid="select-report-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="scam">Scam or fraud</SelectItem>
                  <SelectItem value="inappropriate">Inappropriate content</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Additional details (optional)</Label>
              <Textarea
                id="description"
                placeholder="Provide more context about the issue..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={4}
                data-testid="input-report-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReportDialogOpen(false)}
              data-testid="button-cancel-report"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReport}
              disabled={reportMutation.isPending || !reportReason}
              data-testid="button-submit-report"
            >
              {reportMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserSettings } from "@shared/schema";
import { 
  Settings, 
  Bell, 
  User, 
  Trash2, 
  MapPin, 
  Eye, 
  Clock, 
  MessageSquare,
  AlertTriangle,
  Loader2,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  Megaphone,
  Check,
  X,
  Shield,
  BadgeCheck,
  ExternalLink,
  Ban,
  VolumeX
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";

export default function SettingsPage() {
  const { user, isLoading: authLoading, isVerified } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usernameConfirmation, setUsernameConfirmation] = useState("");

  const { data: settings, isLoading: settingsLoading } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    enabled: !!user,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "Please log in to access settings.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, user, toast]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      const response = await apiRequest("PATCH", "/api/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Updated",
        description: "Your settings have been saved.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const requestDeletionMutation = useMutation({
    mutationFn: async (usernameConfirmation: string) => {
      const response = await apiRequest("POST", "/api/settings/delete-account", { usernameConfirmation });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setDeleteDialogOpen(false);
      setUsernameConfirmation("");
      toast({
        title: "Deletion Requested",
        description: "Your account will be deleted in 30 days. You can cancel anytime.",
        variant: "destructive",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in again.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to request account deletion.",
        variant: "destructive",
      });
    },
  });

  const cancelDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/cancel-deletion", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Deletion Cancelled",
        description: "Your account will not be deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to cancel account deletion.",
        variant: "destructive",
      });
    },
  });

  const { data: blockedUsers, isLoading: blockedUsersLoading } = useQuery<Array<{
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
    email?: string;
  }>>({
    queryKey: ["/api/blocked-users"],
    enabled: !!user,
  });

  const { data: mutedUsers, isLoading: mutedUsersLoading } = useQuery<Array<{
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
    email?: string;
  }>>({
    queryKey: ["/api/users/muted"],
    enabled: !!user,
  });

  const unblockMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/users/${userId}/block`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocked-users"] });
      toast({
        title: "User Unblocked",
        description: "You have unblocked this user.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unblock user.",
        variant: "destructive",
      });
    },
  });

  const unmuteMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/users/${userId}/mute`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/muted"] });
      toast({
        title: "User Unmuted",
        description: "You have unmuted this user.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unmute user.",
        variant: "destructive",
      });
    },
  });

  const handleSettingToggle = (key: keyof UserSettings, value: boolean) => {
    updateSettingsMutation.mutate({ [key]: value } as Partial<UserSettings>);
  };

  const handleDeleteAccount = () => {
    if (!usernameConfirmation.trim()) {
      toast({
        title: "Confirmation Required",
        description: "Please enter your username to confirm deletion.",
        variant: "destructive",
      });
      return;
    }
    requestDeletionMutation.mutate(usernameConfirmation);
  };

  const isLoading = authLoading || settingsLoading;

  if (isLoading || !user) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const username = user.email?.split("@")[0] || "user";
  const deletionRequested = !!settings?.deletionRequestedAt;
  const deletionDate = settings?.deletionScheduledFor ? new Date(settings.deletionScheduledFor) : null;
  const daysUntilDeletion = deletionDate ? differenceInDays(deletionDate, new Date()) : null;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl pb-24">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
        </div>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-settings">
          <TabsTrigger value="general" data-testid="tab-general">
            <MapPin className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="privacy" data-testid="tab-privacy">
            <Shield className="h-4 w-4 mr-2" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="account" data-testid="tab-account">
            <User className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location Settings
              </CardTitle>
              <CardDescription>Control how your location is shared with others</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="location-visibility" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Location Visibility
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow others to see your location
                  </p>
                </div>
                <Switch
                  id="location-visibility"
                  checked={settings?.locationVisible ?? true}
                  onCheckedChange={(checked) => handleSettingToggle("locationVisible", checked)}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-location-visibility"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="distance-campus" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Show Distance from Campus
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Display your distance from campus to buyers
                  </p>
                </div>
                <Switch
                  id="distance-campus"
                  checked={settings?.showDistanceFromCampus ?? true}
                  onCheckedChange={(checked) => handleSettingToggle("showDistanceFromCampus", checked)}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-distance-campus"
                />
              </div>

              <Separator />

              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4" />
                  Current Location
                </Label>
                {settings?.latitude && settings?.longitude ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm" data-testid="text-current-location">
                      Location set: {Number(settings.latitude).toFixed(4)}, {Number(settings.longitude).toFixed(4)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <X className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground" data-testid="text-no-location">
                      Location not set
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="push-notifications" className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Push Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications on your device
                  </p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={settings?.pushNotifications ?? true}
                  onCheckedChange={(checked) => handleSettingToggle("pushNotifications", checked)}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-push-notifications"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="email-notifications" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive important updates via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={settings?.emailNotifications ?? true}
                  onCheckedChange={(checked) => handleSettingToggle("emailNotifications", checked)}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-email-notifications"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="message-notifications" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Message Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about new messages
                  </p>
                </div>
                <Switch
                  id="message-notifications"
                  checked={settings?.messageNotifications ?? true}
                  onCheckedChange={(checked) => handleSettingToggle("messageNotifications", checked)}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-message-notifications"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="order-notifications" className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Order Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Updates about your orders and sales
                  </p>
                </div>
                <Switch
                  id="order-notifications"
                  checked={settings?.orderNotifications ?? true}
                  onCheckedChange={(checked) => handleSettingToggle("orderNotifications", checked)}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-order-notifications"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="promotional-notifications" className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4" />
                    Promotional Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Deals, offers, and promotional content
                  </p>
                </div>
                <Switch
                  id="promotional-notifications"
                  checked={settings?.promotionalNotifications ?? false}
                  onCheckedChange={(checked) => handleSettingToggle("promotionalNotifications", checked)}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-promotional-notifications"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Chat Settings
              </CardTitle>
              <CardDescription>Control your chat privacy and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="typing-status">Show Typing Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Let others see when you&apos;re typing
                  </p>
                </div>
                <Switch
                  id="typing-status"
                  checked={settings?.showTypingStatus ?? true}
                  onCheckedChange={(checked) => handleSettingToggle("showTypingStatus", checked)}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-typing-status"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="read-receipts">Show Read Receipts</Label>
                  <p className="text-sm text-muted-foreground">
                    Let others see when you&apos;ve read their messages
                  </p>
                </div>
                <Switch
                  id="read-receipts"
                  checked={settings?.showReadReceipts ?? true}
                  onCheckedChange={(checked) => handleSettingToggle("showReadReceipts", checked)}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-read-receipts"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="online-status">Show Online Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Let others see when you&apos;re online
                  </p>
                </div>
                <Switch
                  id="online-status"
                  checked={settings?.showOnlineStatus ?? true}
                  onCheckedChange={(checked) => handleSettingToggle("showOnlineStatus", checked)}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-online-status"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5" />
                Blocked Accounts
              </CardTitle>
              <CardDescription>Users you have blocked</CardDescription>
            </CardHeader>
            <CardContent>
              {blockedUsersLoading ? (
                <div className="space-y-3" data-testid="skeleton-blocked-users">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-9 w-20" />
                    </div>
                  ))}
                </div>
              ) : blockedUsers && blockedUsers.length > 0 ? (
                <div className="space-y-3" data-testid="list-blocked-users">
                  {blockedUsers.map((blockedUser) => (
                    <div
                      key={blockedUser.id}
                      className="flex items-center justify-between gap-4"
                      data-testid={`blocked-user-${blockedUser.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={blockedUser.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {blockedUser.firstName?.[0] || ""}
                            {blockedUser.lastName?.[0] || ""}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium" data-testid={`text-blocked-user-name-${blockedUser.id}`}>
                          {blockedUser.firstName} {blockedUser.lastName}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unblockMutation.mutate(blockedUser.id)}
                        disabled={unblockMutation.isPending}
                        data-testid={`button-unblock-${blockedUser.id}`}
                      >
                        {unblockMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Unblock"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="empty-blocked-users">
                  <Ban className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No blocked users</p>
                  <p className="text-sm text-muted-foreground">
                    Users you block will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <VolumeX className="h-5 w-5" />
                Muted Accounts
              </CardTitle>
              <CardDescription>Users you have muted</CardDescription>
            </CardHeader>
            <CardContent>
              {mutedUsersLoading ? (
                <div className="space-y-3" data-testid="skeleton-muted-users">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-9 w-20" />
                    </div>
                  ))}
                </div>
              ) : mutedUsers && mutedUsers.length > 0 ? (
                <div className="space-y-3" data-testid="list-muted-users">
                  {mutedUsers.map((mutedUser) => (
                    <div
                      key={mutedUser.id}
                      className="flex items-center justify-between gap-4"
                      data-testid={`muted-user-${mutedUser.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={mutedUser.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {mutedUser.firstName?.[0] || ""}
                            {mutedUser.lastName?.[0] || ""}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium" data-testid={`text-muted-user-name-${mutedUser.id}`}>
                          {mutedUser.firstName} {mutedUser.lastName}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unmuteMutation.mutate(mutedUser.id)}
                        disabled={unmuteMutation.isPending}
                        data-testid={`button-unmute-${mutedUser.id}`}
                      >
                        {unmuteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Unmute"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="empty-muted-users">
                  <VolumeX className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No muted users</p>
                  <p className="text-sm text-muted-foreground">
                    Users you mute will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p className="text-sm text-muted-foreground" data-testid="text-user-email">
                      {user.email || "Not set"}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <p className="text-sm text-muted-foreground" data-testid="text-user-phone">
                      {user.phoneNumber || "Not set"}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <Label>Member Since</Label>
                    <p className="text-sm text-muted-foreground" data-testid="text-member-since">
                      {user.createdAt 
                        ? format(new Date(user.createdAt), "MMMM d, yyyy")
                        : "Unknown"
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={isVerified ? "border-green-500/50" : "border-yellow-500/50"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className={`h-5 w-5 ${isVerified ? "text-green-500" : "text-yellow-500"}`} />
                KYC Verification
              </CardTitle>
              <CardDescription>
                {isVerified 
                  ? "Your identity has been verified" 
                  : "Verify your identity to unlock seller features"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isVerified ? (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-md border border-green-500/20">
                  <BadgeCheck className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400" data-testid="text-verification-status">
                      Verified Seller
                    </p>
                    <p className="text-sm text-muted-foreground">
                      You can list products and create ads on the marketplace
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert className="border-yellow-500/50 bg-yellow-500/10">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertTitle className="text-yellow-600 dark:text-yellow-400">Verification Required</AlertTitle>
                    <AlertDescription>
                      Complete identity verification to list products for sale on the marketplace. 
                      This helps build trust and prevents scams.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Benefits of verification:</h4>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      <li>Green verified badge on your profile</li>
                      <li>Ability to list and sell products</li>
                      <li>Higher trust from buyers</li>
                      <li>Access to all seller features</li>
                    </ul>
                  </div>
                  
                  <Link href="/kyc">
                    <Button className="w-full" data-testid="button-verify-kyc">
                      <Shield className="mr-2 h-4 w-4" />
                      Get Verified Now
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete Account
              </CardTitle>
              <CardDescription>Permanently delete your account and all data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning: Account Deletion Policy</AlertTitle>
                <AlertDescription>
                  When you request account deletion, your account will be scheduled for permanent deletion after a 30-day grace period. 
                  During this time, you can cancel the deletion request. After 30 days, all your data including listings, messages, 
                  wallet balance, and personal information will be permanently deleted and cannot be recovered.
                </AlertDescription>
              </Alert>

              {deletionRequested && deletionDate && daysUntilDeletion !== null ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-md border border-destructive/20">
                    <Clock className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium text-destructive" data-testid="text-deletion-status">
                        Account Deletion Scheduled
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid="text-deletion-countdown">
                        Your account will be deleted in {daysUntilDeletion} days 
                        ({format(deletionDate, "MMMM d, yyyy")})
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => cancelDeletionMutation.mutate()}
                    disabled={cancelDeletionMutation.isPending}
                    data-testid="button-cancel-deletion"
                  >
                    {cancelDeletionMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Cancel Deletion
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  data-testid="button-delete-account"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Account Deletion
            </DialogTitle>
            <DialogDescription>
              This action will schedule your account for permanent deletion. To confirm, please type your username or email below.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>This will delete:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All your product listings</li>
                <li>Your wallet balance and transaction history</li>
                <li>All messages and conversations</li>
                <li>Your reviews and ratings</li>
                <li>All personal information</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="username-confirmation">
              Type <span className="font-mono font-bold">{username}</span> or your email to confirm
            </Label>
            <Input
              id="username-confirmation"
              value={usernameConfirmation}
              onChange={(e) => setUsernameConfirmation(e.target.value)}
              placeholder="Enter username or email"
              data-testid="input-username-confirmation"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setUsernameConfirmation("");
              }}
              data-testid="button-cancel-dialog"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={requestDeletionMutation.isPending || !usernameConfirmation.trim()}
              data-testid="button-confirm-delete"
            >
              {requestDeletionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete My Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

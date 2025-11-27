import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateUserProfileSchema, type User } from "@shared/schema";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, 
  Star, 
  ShoppingBag, 
  Users, 
  Camera, 
  Loader2, 
  X, 
  Pencil, 
  TrendingUp,
  UserCheck,
  Store,
  ShoppingCart,
  MapPin,
  Clock,
  MoreHorizontal,
  Settings,
  ImagePlus,
  Copy,
  Check,
  Hash,
  AtSign,
  Eye,
  EyeOff,
  UserPlus,
  UserMinus,
  MessageCircle,
  Ban,
  Flag,
  AlertTriangle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UpdateProfileData = z.infer<typeof updateUserProfileSchema>;

export default function Profile() {
  const { userId: urlUserId } = useParams<{ userId?: string }>();
  const [, setLocation] = useLocation();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showPreviewAfterSave, setShowPreviewAfterSave] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  const isOwnProfile = !urlUserId || (currentUser && urlUserId === currentUser.id);

  const { data: profileUser, isLoading: profileLoading } = useQuery<User>({
    queryKey: ["/api/users", urlUserId],
    enabled: !!urlUserId && !isOwnProfile,
  });

  const displayUser = isOwnProfile ? currentUser : profileUser;
  const displayUserId = isOwnProfile ? currentUser?.id : urlUserId;

  const { data: followStats } = useQuery<{
    followerCount: number;
    followingCount: number;
    isFollowing: boolean;
  }>({
    queryKey: ["/api/users", displayUserId, "follow-stats"],
    enabled: !!displayUserId,
  });

  const form = useForm<UpdateProfileData>({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      location: "",
      bio: "",
    },
  });

  useEffect(() => {
    if (currentUser && isOwnProfile) {
      form.reset({
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        phoneNumber: currentUser.phoneNumber || "",
        location: currentUser.location || "",
        bio: currentUser.bio || "",
      });
    }
  }, [currentUser, form, isOwnProfile]);

  // Load cover photo from database when user data loads
  useEffect(() => {
    if (displayUser?.coverImageUrl) {
      setCoverPhoto(displayUser.coverImageUrl);
    }
  }, [displayUser?.coverImageUrl]);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, currentUser, toast]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      return await apiRequest("PUT", `/api/users/${currentUser?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setIsEditDialogOpen(false);
      setShowPreviewAfterSave(true);
      setIsPreviewMode(true);
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated. Preview how it looks to others!",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async (role: "buyer" | "seller" | "both") => {
      return await apiRequest("PUT", `/api/users/${currentUser?.id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Role updated successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload image");
      }

      const { url } = await response.json();

      const updateResponse = await apiRequest("PUT", `/api/users/${currentUser?.id}/profile-image`, {
        profileImageUrl: url,
      });

      return updateResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSelectedFile(null);
      setPreviewUrl(null);
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to upload profile picture",
        variant: "destructive",
      });
    },
  });

  const uploadCoverMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload image");
      }

      const { url } = await response.json();

      const updateResponse = await apiRequest("PUT", `/api/users/${currentUser?.id}/cover-image`, {
        coverImageUrl: url,
      });

      return updateResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Cover photo updated successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to upload cover photo",
        variant: "destructive",
      });
    },
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/users/${urlUserId}/follow`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", urlUserId, "follow-stats"] });
      toast({
        title: "Followed",
        description: "You are now following this user",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to follow user",
        variant: "destructive",
      });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/users/${urlUserId}/follow`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", urlUserId, "follow-stats"] });
      toast({
        title: "Unfollowed",
        description: "You have unfollowed this user",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unfollow user",
        variant: "destructive",
      });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/users/${urlUserId}/block`, {});
    },
    onSuccess: () => {
      setIsBlockDialogOpen(false);
      toast({
        title: "User Blocked",
        description: "You will no longer see content from this user",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to block user",
        variant: "destructive",
      });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (data: { reason: string; description: string }) => {
      return await apiRequest("POST", `/api/users/${urlUserId}/report`, data);
    },
    onSuccess: () => {
      setIsReportDialogOpen(false);
      setReportReason("");
      setReportDescription("");
      toast({
        title: "Report Submitted",
        description: "Thank you for helping keep our community safe",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit report",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Cover photo must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    // Set local preview while uploading
    setCoverPhoto(URL.createObjectURL(file));
    
    // Upload the cover photo to persist it
    uploadCoverMutation.mutate(file);
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadImageMutation.mutate(selectedFile);
    }
  };

  const handleRoleChange = (role: "buyer" | "seller" | "both") => {
    if (currentUser?.role !== role) {
      roleMutation.mutate(role);
    }
  };

  const copyUserId = () => {
    if (displayUser?.id) {
      navigator.clipboard.writeText(displayUser.id.slice(0, 8).toUpperCase());
      setCopiedId(true);
      toast({
        title: "Copied",
        description: "User ID copied to clipboard",
      });
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleFollow = () => {
    if (followStats?.isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  const handleMessage = () => {
    setLocation(`/messages?user=${urlUserId}`);
  };

  const isLoading = authLoading || (!isOwnProfile && profileLoading);

  if (isLoading || !displayUser) {
    return (
      <div className="min-h-screen">
        <div className="h-48 bg-gradient-to-br from-primary/20 via-primary/10 to-background" />
        <div className="container mx-auto px-4 -mt-16 max-w-4xl">
          <div className="space-y-6">
            <Skeleton className="h-32 w-32 rounded-full mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-32" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  const initials = displayUser.firstName && displayUser.lastName
    ? `${displayUser.firstName[0]}${displayUser.lastName[0]}`
    : displayUser.email?.[0] || "U";

  const fullName = displayUser.firstName && displayUser.lastName
    ? `${displayUser.firstName} ${displayUser.lastName}`
    : displayUser.firstName || "User";

  const username = displayUser.email?.split("@")[0] || "user";
  const shortId = displayUser.id?.slice(0, 8).toUpperCase() || "00000000";

  const isSeller = displayUser.role === "seller" || displayUser.role === "both";
  const trustScoreValue = displayUser.trustScore ? parseFloat(String(displayUser.trustScore)) : 5.0;

  const statsData = [
    {
      icon: Star,
      value: trustScoreValue.toFixed(1),
      label: "Trust Score",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      testId: "text-trust-score"
    },
    {
      icon: TrendingUp,
      value: displayUser.totalRatings || 0,
      label: "Reviews",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      testId: "text-reviews-count"
    },
    {
      icon: Users,
      value: followStats?.followerCount || 0,
      label: "Followers",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      testId: "text-follower-count"
    },
    isSeller 
      ? {
          icon: ShoppingBag,
          value: displayUser.totalSales || 0,
          label: "Total Sales",
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          testId: "text-total-sales"
        }
      : {
          icon: Users,
          value: followStats?.followingCount || 0,
          label: "Following",
          color: "text-indigo-500",
          bgColor: "bg-indigo-500/10",
          testId: "text-following-count"
        }
  ];

  const canEdit = isOwnProfile && !isPreviewMode;

  return (
    <div className="min-h-screen pb-24">
      <div className="relative">
        <div 
          className="relative h-44 sm:h-52 md:h-64 overflow-hidden"
          style={{
            backgroundImage: coverPhoto 
              ? `url(${coverPhoto})` 
              : 'linear-gradient(135deg, hsl(var(--primary)/0.3) 0%, hsl(var(--primary)/0.1) 50%, hsl(var(--background)) 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="absolute top-4 left-4 p-2 rounded-full bg-black/40 text-white backdrop-blur-sm hover-elevate active-elevate-2 transition-all"
                data-testid="button-change-cover"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverSelect}
                className="hidden"
                data-testid="input-cover-file"
              />
              
              <div className="absolute top-4 right-4 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="bg-black/40 text-white backdrop-blur-sm border-0"
                      data-testid="button-settings-menu"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem 
                      onClick={() => setIsEditDialogOpen(true)}
                      className="cursor-pointer"
                      data-testid="menu-item-edit-profile"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => coverInputRef.current?.click()}
                      className="cursor-pointer"
                      data-testid="menu-item-change-cover"
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      Change Cover
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={copyUserId}
                      className="cursor-pointer"
                      data-testid="menu-item-copy-id"
                    >
                      {copiedId ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      Copy User ID
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
          
          {isPreviewMode && isOwnProfile && (
            <div className="absolute top-4 right-4 z-10">
              <Badge variant="secondary" className="gap-1.5 bg-black/40 text-white backdrop-blur-sm border-0">
                <Eye className="h-3 w-3" />
                Preview Mode
              </Badge>
            </div>
          )}
        </div>

        <div className="container mx-auto px-4 max-w-4xl relative">
          <motion.div 
            className="flex flex-col items-center -mt-20 relative z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="relative group">
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Avatar className="h-32 w-32 sm:h-36 sm:w-36 ring-4 ring-background shadow-2xl">
                  <AvatarImage src={previewUrl || displayUser.profileImageUrl || undefined} />
                  <AvatarFallback className="text-4xl font-bold bg-gradient-to-br from-primary/20 to-primary/5">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover-elevate active-elevate-2 transition-all"
                  data-testid="button-change-avatar"
                  disabled={uploadImageMutation.isPending}
                >
                  {uploadImageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
              )}
              {isOwnProfile && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-avatar-file"
                />
              )}
            </div>

            <motion.div 
              className="mt-4 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <h1 
                className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text" 
                data-testid="text-profile-fullname"
              >
                {fullName}
              </h1>
              
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge 
                  variant="secondary" 
                  className="text-sm font-medium gap-1 px-3"
                  data-testid="badge-username"
                >
                  <AtSign className="h-3.5 w-3.5" />
                  {username}
                </Badge>
              </div>

              <motion.button
                onClick={copyUserId}
                className="flex items-center gap-1.5 mt-2 mx-auto px-3 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground hover-elevate active-elevate-2 transition-all"
                data-testid="button-user-id"
                whileTap={{ scale: 0.98 }}
              >
                <Hash className="h-3 w-3" />
                <span className="font-mono">{shortId}</span>
                {copiedId ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </motion.button>

              {displayUser.location && (
                <motion.div 
                  className="flex items-center justify-center gap-1 mt-3 text-sm text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <MapPin className="h-4 w-4" />
                  <span data-testid="text-profile-location">{displayUser.location}</span>
                </motion.div>
              )}

              <motion.div 
                className="flex items-center gap-2 mt-4 flex-wrap justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                <Badge variant="outline" className="text-xs" data-testid="badge-role">
                  {displayUser.role?.charAt(0).toUpperCase() + displayUser.role?.slice(1)}
                </Badge>
                {displayUser.isVerified && (
                  <Badge variant="default" className="gap-1 text-xs" data-testid="badge-verified">
                    <Shield className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
                {displayUser.isTrustedSeller && (
                  <Badge className="gap-1 text-xs bg-green-600/90 dark:bg-green-700/90" data-testid="badge-trusted-seller">
                    <UserCheck className="h-3 w-3" />
                    Trusted Seller
                  </Badge>
                )}
              </motion.div>

              {displayUser.bio && (
                <motion.p 
                  className="mt-4 text-muted-foreground max-w-md mx-auto text-sm leading-relaxed" 
                  data-testid="text-profile-bio"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {displayUser.bio}
                </motion.p>
              )}

              <motion.div
                className="flex items-center justify-center gap-3 mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                {isOwnProfile ? (
                  <>
                    {!isPreviewMode ? (
                      <Button
                        variant="default"
                        onClick={() => setIsEditDialogOpen(true)}
                        className="gap-2"
                        data-testid="button-edit-profile-main"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit Profile
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsPreviewMode(false);
                          setShowPreviewAfterSave(false);
                        }}
                        className="gap-2"
                        data-testid="button-exit-preview"
                      >
                        <EyeOff className="h-4 w-4" />
                        Exit Preview
                      </Button>
                    )}
                    
                    <Button
                      variant={isPreviewMode ? "default" : "outline"}
                      onClick={() => setIsPreviewMode(!isPreviewMode)}
                      className="gap-2"
                      data-testid="button-toggle-preview"
                    >
                      {isPreviewMode ? (
                        <>
                          <Eye className="h-4 w-4" />
                          Preview Mode
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          Preview Profile
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant={followStats?.isFollowing ? "outline" : "default"}
                      onClick={handleFollow}
                      disabled={followMutation.isPending || unfollowMutation.isPending}
                      className="gap-2"
                      data-testid="button-follow"
                    >
                      {followMutation.isPending || unfollowMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : followStats?.isFollowing ? (
                        <>
                          <UserMinus className="h-4 w-4" />
                          Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Follow
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={handleMessage}
                      className="gap-2"
                      data-testid="button-message"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid="button-user-actions-menu"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem 
                          onClick={() => setIsBlockDialogOpen(true)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                          data-testid="menu-item-block-user"
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Block User
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setIsReportDialogOpen(true)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                          data-testid="menu-item-report-user"
                        >
                          <Flag className="mr-2 h-4 w-4" />
                          Report User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </motion.div>
            </motion.div>
          </motion.div>

          <AnimatePresence>
            {isPreviewMode && isOwnProfile && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6"
              >
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Eye className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm" data-testid="text-preview-banner-title">
                            {showPreviewAfterSave ? "Profile Updated Successfully!" : "Preview Mode"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            This is how your profile appears to other users
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsPreviewMode(false);
                          setShowPreviewAfterSave(false);
                        }}
                        data-testid="button-close-preview-banner"
                      >
                        Back to Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedFile && canEdit && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-4"
              >
                <Card className="max-w-md mx-auto">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={previewUrl || undefined} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <p className="text-sm font-medium">New profile picture</p>
                          <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCancelUpload}
                          disabled={uploadImageMutation.isPending}
                          data-testid="button-cancel-upload"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={handleUpload}
                          disabled={uploadImageMutation.isPending}
                          data-testid="button-upload-avatar"
                        >
                          {uploadImageMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            "Upload"
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div 
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8" 
            data-testid="stats-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            {statsData.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + index * 0.05 }}
              >
                <Card className="overflow-visible hover-elevate transition-all border-0 bg-gradient-to-br from-card to-card/50">
                  <CardContent className="pt-5 pb-4 text-center">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${stat.bgColor} mb-2`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid={stat.testId}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {isOwnProfile && !isPreviewMode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="mt-6 border-2 border-primary/10 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-5 w-5 text-primary" />
                    Switch Your Role
                  </CardTitle>
                  <CardDescription>
                    Choose how you want to use CampusPlug
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3" data-testid="role-switch-group">
                    {[
                      { role: "buyer" as const, icon: ShoppingCart, label: "Buyer", desc: "Shop products" },
                      { role: "seller" as const, icon: Store, label: "Seller", desc: "Sell products" },
                      { role: "both" as const, icon: Users, label: "Both", desc: "Buy & Sell" },
                    ].map((item) => (
                      <Button
                        key={item.role}
                        variant={currentUser?.role === item.role ? "default" : "outline"}
                        onClick={() => handleRoleChange(item.role)}
                        disabled={roleMutation.isPending || currentUser?.role === "admin"}
                        className="flex flex-col gap-1.5 h-auto py-4"
                        data-testid={`button-role-${item.role}`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="font-semibold text-sm">{item.label}</span>
                        <span className="text-[10px] opacity-80">{item.desc}</span>
                        {roleMutation.isPending && currentUser?.role !== item.role && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                      </Button>
                    ))}
                  </div>
                  
                  {currentUser?.role === "admin" && (
                    <p className="text-sm text-muted-foreground mt-3 text-center">
                      Admin accounts cannot change their role.
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {isSeller && followStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Store className="h-5 w-5" />
                    Seller Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold" data-testid="text-following-count-alt">
                        {followStats.followingCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Following</p>
                    </div>
                    {displayUser.responseTime && (
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <p className="text-2xl font-bold" data-testid="text-response-time">
                            {displayUser.responseTime}m
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">Avg. Response</p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {displayUser.totalSales || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Completed Sales</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Edit Profile
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campus Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Hostel A, Block 3"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us about yourself..."
                        rows={4}
                        {...field}
                        value={field.value || ""}
                        data-testid="input-bio"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-profile"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Block User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to block <span className="font-semibold">{fullName}</span>? 
              They won't be able to message you, see your listings, or interact with your content. 
              You can unblock them later from your settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-block">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={blockMutation.isPending}
              data-testid="button-confirm-block"
            >
              {blockMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Blocking...
                </>
              ) : (
                "Block User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-destructive" />
              Report User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Help us keep Campuspluguni safe. Please tell us why you're reporting this user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Reason for report</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger id="report-reason" data-testid="select-report-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spam">Spam or fake account</SelectItem>
                  <SelectItem value="scam">Scam or fraud</SelectItem>
                  <SelectItem value="harassment">Harassment or bullying</SelectItem>
                  <SelectItem value="inappropriate">Inappropriate content</SelectItem>
                  <SelectItem value="impersonation">Impersonation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-description">Additional details (optional)</Label>
              <Textarea
                id="report-description"
                placeholder="Provide any additional context that might help us investigate..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={3}
                data-testid="input-report-description"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setReportReason("");
                setReportDescription("");
              }}
              data-testid="button-cancel-report"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => reportMutation.mutate({ reason: reportReason, description: reportDescription })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!reportReason || reportMutation.isPending}
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

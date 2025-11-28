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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateUserProfileSchema, type User, type SocialPost, type Product, type Story } from "@shared/schema";
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
  AlertTriangle,
  BadgeCheck,
  Calendar,
  Heart,
  Image,
  Pin,
  FileText,
  ChevronDown
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
import { format } from "date-fns";
import { LocationBadge } from "@/components/LocationBadge";
import { useUserLocationInfo } from "@/hooks/useGeolocation";
import { StoryViewer } from "./stories";

type UpdateProfileData = z.infer<typeof updateUserProfileSchema>;

function formatCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

function formatJoinDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return format(d, "MMMM yyyy");
}

type PostWithAuthor = SocialPost & { author: User };

function PinnedPostCard({ post }: { post: PostWithAuthor }) {
  return (
    <Card className="mb-3 border-l-2 border-l-primary/50">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Pin className="h-3 w-3" />
          <span>Pinned</span>
        </div>
        <p className="text-sm line-clamp-3">{post.content}</p>
        {post.images && post.images.length > 0 && (
          <div className="flex gap-2 mt-2">
            {post.images.slice(0, 4).map((img, i) => (
              <img
                key={i}
                src={img}
                alt=""
                className="h-16 w-16 object-cover rounded-md"
                loading="lazy"
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {formatCount(post.likesCount || 0)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {formatCount(post.commentsCount || 0)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SocialPostCard({ post }: { post: PostWithAuthor }) {
  const [, setLocation] = useLocation();
  
  return (
    <Card className="mb-3 hover-elevate cursor-pointer" onClick={() => setLocation(`/the-plug`)}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author?.profileImageUrl || undefined} />
            <AvatarFallback>
              {post.author?.firstName?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm">{post.author?.firstName} {post.author?.lastName}</span>
              {post.author?.isVerified && (
                <BadgeCheck className="h-4 w-4 text-primary" />
              )}
              <span className="text-muted-foreground text-xs">
                @{post.author?.username || post.author?.email?.split("@")[0]}
              </span>
            </div>
            <p className="text-sm mt-1 line-clamp-4">{post.content}</p>
            {post.images && post.images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {post.images.slice(0, 4).map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    className="w-full h-24 object-cover rounded-md"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {formatCount(post.likesCount || 0)}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {formatCount(post.commentsCount || 0)}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {formatCount(post.viewsCount || 0)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductCard({ product }: { product: Product }) {
  const [, setLocation] = useLocation();
  
  return (
    <Card className="mb-3 hover-elevate cursor-pointer" onClick={() => setLocation(`/product/${product.id}`)}>
      <CardContent className="pt-4 pb-3">
        <div className="flex gap-3">
          {product.images && product.images.length > 0 && (
            <img
              src={product.images[0]}
              alt={product.title}
              className="h-20 w-20 object-cover rounded-md flex-shrink-0"
              loading="lazy"
            />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm line-clamp-2">{product.title}</h4>
            <p className="text-lg font-bold text-primary mt-1">
              ₦{Number(product.price).toLocaleString()}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {product.condition}
              </Badge>
              {product.isSold && (
                <Badge variant="destructive" className="text-xs">Sold</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
  const [activeTab, setActiveTab] = useState("posts");
  const [usernameInput, setUsernameInput] = useState("");
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [selectedUserStories, setSelectedUserStories] = useState<(Story & { author: User; hasViewed?: boolean })[] | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    social: true,
    services: true,
    account: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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

  const { data: pinnedPosts, isLoading: pinnedLoading } = useQuery<PostWithAuthor[]>({
    queryKey: ["/api/users", displayUserId, "pinned-posts"],
    enabled: !!displayUserId,
  });

  const { data: userPosts, isLoading: postsLoading } = useQuery<PostWithAuthor[]>({
    queryKey: ["/api/social-posts", { authorId: displayUserId }],
    enabled: !!displayUserId,
  });

  const { data: userProducts, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", { sellerId: displayUserId }],
    enabled: !!displayUserId && (displayUser?.role === "seller" || displayUser?.role === "both" || displayUser?.role === "admin"),
  });

  const { data: userStories } = useQuery<(Story & { author: User; hasViewed?: boolean })[]>({
    queryKey: ["/api/stories/user", displayUserId],
    enabled: !!displayUserId,
  });

  const hasActiveStories = userStories && userStories.length > 0;
  const hasUnviewedStories = userStories?.some(s => !s.hasViewed) || false;

  const handleAvatarClick = () => {
    if (hasActiveStories && userStories) {
      setSelectedUserStories(userStories);
    }
  };

  const form = useForm<UpdateProfileData>({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      location: "",
      bio: "",
      gender: null,
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
        gender: (currentUser as any).gender || null,
      });
      setUsernameInput(currentUser.username || "");
    }
  }, [currentUser, form, isOwnProfile]);

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

  const updateUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      return await apiRequest("PATCH", `/api/users/me/username`, { username });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Username Updated",
        description: "Your username has been updated successfully.",
      });
      setIsUpdatingUsername(false);
    },
    onError: (error: Error) => {
      const message = error.message.includes("taken") ? "Username is already taken" : "Failed to update username";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async (role: "buyer" | "seller") => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/users", urlUserId, "followers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id, "following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/users", urlUserId, "followers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id, "following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
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

    setCoverPhoto(URL.createObjectURL(file));
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

  const handleRoleChange = (role: "buyer" | "seller") => {
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

  const handleUpdateUsername = () => {
    if (usernameInput.length >= 3 && usernameInput.length <= 20) {
      updateUsernameMutation.mutate(usernameInput);
    } else {
      toast({
        title: "Invalid Username",
        description: "Username must be between 3 and 20 characters",
        variant: "destructive",
      });
    }
  };

  const isLoading = authLoading || (!isOwnProfile && profileLoading);

  if (isLoading || !displayUser) {
    return (
      <div className="min-h-screen">
        <div className="relative" style={{ aspectRatio: '16/5' }}>
          <Skeleton className="absolute inset-0" />
        </div>
        <div className="container mx-auto px-4 -mt-16 max-w-4xl">
          <div className="space-y-6">
            <div className="flex items-end gap-4">
              <Skeleton className="h-32 w-32 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
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

  const username = displayUser.username || displayUser.email?.split("@")[0] || "user";
  const shortId = displayUser.id?.slice(0, 8).toUpperCase() || "00000000";

  const isSeller = displayUser.role === "seller" || displayUser.role === "both" || displayUser.role === "admin";
  const isSystemAccount = displayUser.isSystemAccount === true;
  const isVerified = displayUser.isVerified || displayUser.ninVerified || isSystemAccount;

  const canEdit = isOwnProfile && !isPreviewMode;

  const mediaPosts = userPosts?.filter(p => (p.images && p.images.length > 0) || (p.videos && p.videos.length > 0)) || [];

  return (
    <div className="min-h-screen pb-24">
      <div className="relative">
        <div 
          className={`relative w-full overflow-hidden ${isSystemAccount ? 'bg-gradient-to-br from-yellow-500/30 via-amber-400/20 to-background' : ''}`}
          style={{
            aspectRatio: '16/5',
            backgroundImage: coverPhoto 
              ? `url(${coverPhoto})` 
              : isSystemAccount
                ? undefined
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
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors group"
                data-testid="button-change-cover"
              >
                <div className="p-3 rounded-full bg-black/40 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6" />
                </div>
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverSelect}
                className="hidden"
                data-testid="input-cover-file"
              />
            </>
          )}
          
          {!canEdit && coverPhoto && (
            <button
              type="button"
              onClick={() => setLightboxImage(coverPhoto)}
              className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors"
              data-testid="button-view-cover"
            />
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
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-16 md:-mt-20 relative z-10">
            <div className="flex items-end gap-4">
              <div className="relative group">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  onClick={hasActiveStories ? handleAvatarClick : undefined}
                  className={hasActiveStories ? "cursor-pointer" : ""}
                >
                  <div 
                    className={`rounded-full p-1 ${
                      hasActiveStories 
                        ? hasUnviewedStories 
                          ? 'bg-gradient-to-tr from-[#16a34a] via-[#22c55e] to-[#16a34a]' 
                          : 'bg-muted'
                        : ''
                    }`}
                  >
                    <Avatar className={`h-28 w-28 md:h-36 md:w-36 ring-4 ring-background shadow-2xl ${isSystemAccount ? 'ring-yellow-500/50' : ''}`}>
                      <AvatarImage src={previewUrl || displayUser.profileImageUrl || undefined} />
                      <AvatarFallback className={`text-3xl md:text-4xl font-bold ${isSystemAccount ? 'bg-gradient-to-br from-yellow-500/30 to-amber-400/20' : 'bg-gradient-to-br from-primary/20 to-primary/5'}`}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </motion.div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-1 right-1 p-2 rounded-full bg-background border shadow-md hover-elevate active-elevate-2 transition-all"
                    data-testid="button-change-avatar"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                )}
                {!canEdit && displayUser.profileImageUrl && (
                  <button
                    type="button"
                    onClick={() => setLightboxImage(displayUser.profileImageUrl!)}
                    className="absolute bottom-1 right-1 p-2 rounded-full bg-background/80 border shadow-md hover:bg-background transition-all"
                    data-testid="button-view-avatar"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-avatar-file"
                />
              </div>
              
              <div className="pb-2 sm:pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold" data-testid="text-display-name">
                    {fullName}
                  </h1>
                  {isVerified && (
                    <BadgeCheck 
                      className={`h-5 w-5 md:h-6 md:w-6 ${isSystemAccount ? 'text-yellow-500' : 'text-primary'}`} 
                      data-testid="icon-verified"
                    />
                  )}
                </div>
                
                {isSystemAccount && (
                  <Badge className="mt-1 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                    Official Account
                  </Badge>
                )}
                
                {displayUser.username ? (
                  <p className="text-muted-foreground text-sm md:text-base" data-testid="text-username">
                    @{displayUser.username}
                  </p>
                ) : isOwnProfile ? (
                  <button
                    onClick={() => {
                      setIsUpdatingUsername(true);
                      setIsEditDialogOpen(true);
                    }}
                    className="text-primary text-sm hover:underline flex items-center gap-1"
                    data-testid="button-add-username"
                  >
                    <AtSign className="h-3 w-3" />
                    Add username
                  </button>
                ) : (
                  <p className="text-muted-foreground text-sm" data-testid="text-username-fallback">
                    @{displayUser.email?.split("@")[0]}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pb-2 sm:pb-4">
              {isOwnProfile ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(true)}
                    data-testid="button-edit-profile"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="button-settings-menu">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {(currentUser?.role === "admin" || currentUser?.id?.slice(0, 8).toLowerCase() === "e461e9f4") && (
                        <DropdownMenuItem 
                          onClick={() => setLocation("/admin")}
                          className="cursor-pointer"
                          data-testid="link-admin-dashboard"
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Admin Dashboard
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={copyUserId}
                        className="cursor-pointer"
                        data-testid="menu-item-copy-id"
                      >
                        {copiedId ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                        Copy User ID
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setLocation("/settings")}
                        className="cursor-pointer"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Button
                    variant={followStats?.isFollowing ? "outline" : "default"}
                    onClick={handleFollow}
                    disabled={followMutation.isPending || unfollowMutation.isPending}
                    data-testid="button-follow"
                  >
                    {followMutation.isPending || unfollowMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : followStats?.isFollowing ? (
                      <>
                        <UserMinus className="h-4 w-4 mr-2" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleMessage} data-testid="button-message">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="button-more-actions">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem 
                        onClick={copyUserId}
                        className="cursor-pointer"
                      >
                        {copiedId ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                        Copy User ID
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setIsBlockDialogOpen(true)}
                        className="cursor-pointer text-destructive"
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Block
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setIsReportDialogOpen(true)}
                        className="cursor-pointer text-destructive"
                      >
                        <Flag className="mr-2 h-4 w-4" />
                        Report
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          <motion.div 
            className="mt-6 space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {displayUser.bio && (
              <p className="text-sm md:text-base" data-testid="text-bio">
                {displayUser.bio}
              </p>
            )}
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {/* GPS-based location badge (if coordinates available) */}
              {(displayUser as any).latitude && (displayUser as any).longitude && (
                <LocationBadge
                  latitude={(displayUser as any).latitude}
                  longitude={(displayUser as any).longitude}
                  variant="default"
                />
              )}
              {/* Text-based location fallback */}
              {displayUser.location && !(displayUser as any).latitude && (
                <span className="flex items-center gap-1" data-testid="text-location">
                  <MapPin className="h-4 w-4" />
                  {displayUser.location}
                </span>
              )}
              
              {displayUser.createdAt && (
                <span className="flex items-center gap-1" data-testid="text-join-date">
                  <Calendar className="h-4 w-4" />
                  Joined {formatJoinDate(displayUser.createdAt)}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <button 
                className="hover:underline"
                onClick={() => {}}
                data-testid="button-following-count"
              >
                <span className="font-semibold">{formatCount(followStats?.followingCount || 0)}</span>
                <span className="text-muted-foreground ml-1">Following</span>
              </button>
              <button 
                className="hover:underline"
                onClick={() => {}}
                data-testid="button-follower-count"
              >
                <span className="font-semibold">{formatCount(followStats?.followerCount || 0)}</span>
                <span className="text-muted-foreground ml-1">Followers</span>
              </button>
            </div>

            {isOwnProfile && (
              <div className="mt-6 space-y-3">
                {["social", "services", "account"].map((section) => (
                  <Card key={section} className="cursor-pointer hover-elevate" onClick={() => toggleSection(section as keyof typeof expandedSections)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base capitalize">{section === "social" ? "Social & Links" : section === "services" ? "Services" : "Account Settings"}</CardTitle>
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections[section as keyof typeof expandedSections] ? "" : "-rotate-90"}`} />
                      </div>
                    </CardHeader>
                    {expandedSections[section as keyof typeof expandedSections] && (
                      <CardContent className="text-sm text-muted-foreground">
                        {section === "social" ? "Social links and profile connections" : section === "services" ? "Services you offer" : "Account security and settings"}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </motion.div>

          {lightboxImage && (
            <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
              <DialogContent className="max-w-3xl p-0 bg-black/90 border-0">
                <img src={lightboxImage} alt="Preview" className="w-full h-auto" />
              </DialogContent>
            </Dialog>
          )}

          <AnimatePresence>
            {showPreviewAfterSave && isOwnProfile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-primary" />
                        <span className="text-sm">
                          Preview mode: See how others view your profile
                        </span>
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
                <Card className="max-w-md">
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

          {pinnedPosts && pinnedPosts.length > 0 && (
            <motion.div
              className="mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {pinnedPosts.map(post => (
                <PinnedPostCard key={post.id} post={post} />
              ))}
            </motion.div>
          )}

          <motion.div
            className="mt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
                <TabsTrigger 
                  value="posts" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                  data-testid="tab-posts"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Posts
                </TabsTrigger>
                {isSeller && (
                  <TabsTrigger 
                    value="selling" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                    data-testid="tab-selling"
                  >
                    <Store className="h-4 w-4 mr-2" />
                    Selling
                  </TabsTrigger>
                )}
                {isOwnProfile && (
                  <TabsTrigger 
                    value="likes" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                    data-testid="tab-likes"
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    Likes
                  </TabsTrigger>
                )}
                <TabsTrigger 
                  value="media" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                  data-testid="tab-media"
                >
                  <Image className="h-4 w-4 mr-2" />
                  Media
                </TabsTrigger>
              </TabsList>

              <TabsContent value="posts" className="mt-4">
                {postsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : userPosts && userPosts.length > 0 ? (
                  <div>
                    {userPosts.map(post => (
                      <SocialPostCard key={post.id} post={post} />
                    ))}
                  </div>
                ) : (
                  <Card className="p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No posts yet</p>
                    {isOwnProfile && (
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setLocation("/the-plug")}
                      >
                        Create your first post
                      </Button>
                    )}
                  </Card>
                )}
              </TabsContent>

              {isSeller && (
                <TabsContent value="selling" className="mt-4">
                  {productsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))}
                    </div>
                  ) : userProducts && userProducts.length > 0 ? (
                    <div>
                      {userProducts.map(product => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  ) : (
                    <Card className="p-8 text-center">
                      <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No products listed</p>
                      {isOwnProfile && (
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={() => setLocation("/seller-dashboard")}
                        >
                          List a product
                        </Button>
                      )}
                    </Card>
                  )}
                </TabsContent>
              )}

              {isOwnProfile && (
                <TabsContent value="likes" className="mt-4">
                  <Card className="p-8 text-center">
                    <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Posts you've liked will appear here</p>
                  </Card>
                </TabsContent>
              )}

              <TabsContent value="media" className="mt-4">
                {postsLoading ? (
                  <div className="grid grid-cols-3 gap-1">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <Skeleton key={i} className="aspect-square" />
                    ))}
                  </div>
                ) : mediaPosts.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1">
                    {mediaPosts.map(post => (
                      <div 
                        key={post.id} 
                        className="aspect-square overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLocation("/the-plug")}
                      >
                        {post.images && post.images[0] && (
                          <img 
                            src={post.images[0]} 
                            alt="" 
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                        {post.videos && post.videos[0] && !post.images?.[0] && (
                          <video 
                            src={post.videos[0]} 
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Card className="p-8 text-center">
                    <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No media posts yet</p>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>

          {isOwnProfile && !isPreviewMode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="mt-6 border-2 border-primary/10 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-5 w-5 text-primary" />
                    Switch Your Role
                  </CardTitle>
                  <CardDescription>
                    Choose how you want to use EKSU Marketplace
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3" data-testid="role-switch-group">
                    {[
                      { role: "buyer" as const, icon: ShoppingCart, label: "Buyer", desc: "Shop products" },
                      { role: "seller" as const, icon: Store, label: "Seller", desc: "Sell products" },
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
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="username"
                      className="pl-9"
                      maxLength={20}
                      data-testid="input-username"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUpdateUsername}
                    disabled={updateUsernameMutation.isPending || usernameInput === currentUser?.username}
                    data-testid="button-update-username"
                  >
                    {updateUsernameMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Update"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  3-20 characters. Letters, numbers, and underscores only.
                </p>
              </div>

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

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-gender-profile">
                          <SelectValue placeholder="Select gender (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Used for personalized experience. Optional.
                    </FormDescription>
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
              Help us keep EKSU Marketplace safe. Please tell us why you're reporting this user.
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

      {selectedUserStories && currentUser && (
        <StoryViewer
          stories={selectedUserStories}
          onClose={() => setSelectedUserStories(null)}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  );
}

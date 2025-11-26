import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { updateUserProfileSchema, type User } from "@shared/schema";
import { z } from "zod";
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
  Clock
} from "lucide-react";

type UpdateProfileData = z.infer<typeof updateUserProfileSchema>;

export default function Profile() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: followStats } = useQuery<{
    followerCount: number;
    followingCount: number;
    isFollowing: boolean;
  }>({
    queryKey: ["/api/users", currentUser?.id, "follow-stats"],
    enabled: !!currentUser?.id,
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
    if (currentUser) {
      form.reset({
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        phoneNumber: currentUser.phoneNumber || "",
        location: currentUser.location || "",
        bio: currentUser.bio || "",
      });
    }
  }, [currentUser, form]);

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
      toast({
        title: "Success",
        description: "Profile updated successfully",
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

  if (authLoading || !currentUser) {
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

  const initials = currentUser.firstName && currentUser.lastName
    ? `${currentUser.firstName[0]}${currentUser.lastName[0]}`
    : currentUser.email?.[0] || "U";

  const fullName = currentUser.firstName && currentUser.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser.firstName || "User";

  const username = currentUser.email?.split("@")[0] || "user";

  const isSeller = currentUser.role === "seller" || currentUser.role === "both";
  const trustScoreValue = currentUser.trustScore ? parseFloat(String(currentUser.trustScore)) : 5.0;

  return (
    <div className="min-h-screen pb-8">
      {/* Gradient Hero Section */}
      <div className="relative h-56 bg-gradient-to-br from-primary/30 via-primary/15 to-background dark:from-primary/20 dark:via-primary/10 dark:to-background">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        
        {/* Edit Profile Button - Always visible at top right */}
        <div className="absolute top-4 right-4 z-10">
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="default"
                size="default"
                className="gap-2 shadow-lg"
                data-testid="button-edit-profile"
              >
                <Pencil className="h-4 w-4" />
                Edit Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
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
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 -mt-24 max-w-4xl relative z-10">
        <div className="space-y-6">
          {/* Profile Header Section */}
          <div className="flex flex-col items-center text-center">
            {/* Large Avatar with Camera Button */}
            <div className="relative mb-4">
              <Avatar className="h-36 w-36 ring-4 ring-background shadow-xl">
                <AvatarImage src={previewUrl || currentUser.profileImageUrl || undefined} />
                <AvatarFallback className="text-4xl font-semibold bg-primary/10">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover-elevate active-elevate-2 transition-all"
                data-testid="button-change-avatar"
                disabled={uploadImageMutation.isPending}
              >
                {uploadImageMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-avatar-file"
              />
            </div>

            {/* Display Name & Username */}
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-profile-fullname">
              {fullName}
            </h1>
            <p className="text-lg text-muted-foreground font-medium" data-testid="text-profile-username">
              @{username}
            </p>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-profile-email">
              {currentUser.email}
            </p>

            {/* Location if available */}
            {currentUser.location && (
              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span data-testid="text-profile-location">{currentUser.location}</span>
              </div>
            )}

            {/* Verification Badges */}
            <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
              <Badge variant="secondary" className="text-sm" data-testid="badge-role">
                {currentUser.role?.charAt(0).toUpperCase() + currentUser.role?.slice(1)}
              </Badge>
              {currentUser.isVerified && (
                <Badge variant="default" className="gap-1" data-testid="badge-verified">
                  <Shield className="h-3 w-3" />
                  Verified Student
                </Badge>
              )}
              {currentUser.isTrustedSeller && (
                <Badge className="gap-1 bg-green-600 dark:bg-green-700" data-testid="badge-trusted-seller">
                  <UserCheck className="h-3 w-3" />
                  Trusted Seller
                </Badge>
              )}
            </div>

            {/* Bio */}
            {currentUser.bio && (
              <p className="mt-4 text-muted-foreground max-w-md" data-testid="text-profile-bio">
                {currentUser.bio}
              </p>
            )}

            {/* Image Upload Preview */}
            {selectedFile && (
              <Card className="mt-4 w-full max-w-md">
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
            )}
          </div>

          {/* Role Switching Section - Prominent Card */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Switch Your Role
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose how you want to use CampusPlug - you can switch anytime
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3" data-testid="role-switch-group">
                <Button
                  variant={currentUser.role === "buyer" ? "default" : "outline"}
                  onClick={() => handleRoleChange("buyer")}
                  disabled={roleMutation.isPending || currentUser.role === "admin"}
                  className="flex flex-col gap-2 h-auto py-4"
                  data-testid="button-role-buyer"
                >
                  <ShoppingCart className="h-6 w-6" />
                  <span className="font-semibold">Buyer</span>
                  <span className="text-xs opacity-80">Shop products</span>
                  {roleMutation.isPending && currentUser.role !== "buyer" && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </Button>
                <Button
                  variant={currentUser.role === "seller" ? "default" : "outline"}
                  onClick={() => handleRoleChange("seller")}
                  disabled={roleMutation.isPending || currentUser.role === "admin"}
                  className="flex flex-col gap-2 h-auto py-4"
                  data-testid="button-role-seller"
                >
                  <Store className="h-6 w-6" />
                  <span className="font-semibold">Seller</span>
                  <span className="text-xs opacity-80">Sell products</span>
                  {roleMutation.isPending && currentUser.role !== "seller" && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </Button>
                <Button
                  variant={currentUser.role === "both" ? "default" : "outline"}
                  onClick={() => handleRoleChange("both")}
                  disabled={roleMutation.isPending || currentUser.role === "admin"}
                  className="flex flex-col gap-2 h-auto py-4"
                  data-testid="button-role-both"
                >
                  <Users className="h-6 w-6" />
                  <span className="font-semibold">Both</span>
                  <span className="text-xs opacity-80">Buy & Sell</span>
                  {roleMutation.isPending && currentUser.role !== "both" && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </Button>
              </div>
              
              {currentUser.role === "admin" && (
                <p className="text-sm text-muted-foreground mt-3 text-center">
                  Admin accounts cannot change their role.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-testid="stats-grid">
            {/* Trust Score */}
            <Card className="hover-elevate">
              <CardContent className="pt-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-3">
                  <Star className="h-6 w-6 fill-yellow-500 text-yellow-500" />
                </div>
                <p className="text-3xl font-bold" data-testid="text-trust-score">
                  {trustScoreValue.toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Trust Score</p>
              </CardContent>
            </Card>

            {/* Reviews Count */}
            <Card className="hover-elevate">
              <CardContent className="pt-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-3">
                  <TrendingUp className="h-6 w-6 text-blue-500" />
                </div>
                <p className="text-3xl font-bold" data-testid="text-reviews-count">
                  {currentUser.totalRatings || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Reviews</p>
              </CardContent>
            </Card>

            {/* Followers */}
            <Card className="hover-elevate">
              <CardContent className="pt-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-3">
                  <Users className="h-6 w-6 text-purple-500" />
                </div>
                <p className="text-3xl font-bold" data-testid="text-follower-count">
                  {followStats?.followerCount || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Followers</p>
              </CardContent>
            </Card>

            {/* Following or Total Sales based on role */}
            {isSeller ? (
              <Card className="hover-elevate">
                <CardContent className="pt-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                    <ShoppingBag className="h-6 w-6 text-green-500" />
                  </div>
                  <p className="text-3xl font-bold" data-testid="text-total-sales">
                    {currentUser.totalSales || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Total Sales</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="hover-elevate">
                <CardContent className="pt-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mb-3">
                    <Users className="h-6 w-6 text-indigo-500" />
                  </div>
                  <p className="text-3xl font-bold" data-testid="text-following-count">
                    {followStats?.followingCount || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Following</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Additional Seller Stats */}
          {isSeller && followStats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
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
                    <p className="text-sm text-muted-foreground">Following</p>
                  </div>
                  {currentUser.responseTime && (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <p className="text-2xl font-bold" data-testid="text-response-time">
                          {currentUser.responseTime}m
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">Avg. Response</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {currentUser.totalSales || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Completed Sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  UserCheck,
  Store,
  ShoppingCart
} from "lucide-react";

type UpdateProfileData = z.infer<typeof updateUserProfileSchema>;

export default function Profile() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

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
      setIsEditOpen(false);
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
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const initials = currentUser.firstName && currentUser.lastName
    ? `${currentUser.firstName[0]}${currentUser.lastName[0]}`
    : currentUser.email?.[0] || "U";

  const fullName = currentUser.firstName && currentUser.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser.firstName || currentUser.email;

  const isSeller = currentUser.role === "seller" || currentUser.role === "both";
  const trustScoreValue = currentUser.trustScore ? parseFloat(String(currentUser.trustScore)) : 5.0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="space-y-6">
        {/* Profile Header Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6">
              {/* Avatar and Edit Button Row */}
              <div className="flex flex-col sm:flex-row items-center gap-6 w-full">
                <div className="relative">
                  <Avatar className="h-28 w-28">
                    <AvatarImage src={previewUrl || currentUser.profileImageUrl || undefined} />
                    <AvatarFallback className="text-3xl">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground hover-elevate active-elevate-2 transition-colors"
                    data-testid="button-change-avatar"
                    disabled={uploadImageMutation.isPending}
                  >
                    {uploadImageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
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

                <div className="flex-1 text-center sm:text-left">
                  {/* Full Name Display */}
                  <h1 className="text-3xl font-bold" data-testid="text-profile-fullname">
                    {fullName}
                  </h1>
                  <p className="text-muted-foreground mt-1" data-testid="text-profile-email">
                    {currentUser.email}
                  </p>
                  
                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start flex-wrap">
                    <Badge variant="secondary" data-testid="badge-role">{currentUser.role}</Badge>
                    {currentUser.isVerified && (
                      <Badge variant="default" className="gap-1" data-testid="badge-verified">
                        <Shield className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                    {currentUser.isTrustedSeller && (
                      <Badge variant="default" className="gap-1 bg-green-600" data-testid="badge-trusted-seller">
                        <UserCheck className="h-3 w-3" />
                        Trusted Seller
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Edit Profile Button */}
                <Button
                  variant="outline"
                  onClick={() => setIsEditOpen(!isEditOpen)}
                  className="gap-2"
                  data-testid="button-edit-profile"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Profile
                </Button>
              </div>

              {/* Bio Display */}
              {currentUser.bio && (
                <div className="w-full text-center sm:text-left">
                  <p className="text-muted-foreground" data-testid="text-profile-bio">
                    {currentUser.bio}
                  </p>
                </div>
              )}

              {/* Image Upload Preview */}
              {selectedFile && (
                <div className="w-full p-4 rounded-md bg-muted/50">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={previewUrl || undefined} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div>
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
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-testid="stats-grid">
          {/* Trust Score */}
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              </div>
              <p className="text-2xl font-bold" data-testid="text-trust-score">
                {trustScoreValue.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">Trust Score</p>
            </CardContent>
          </Card>

          {/* Reviews Count */}
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold" data-testid="text-reviews-count">
                {currentUser.totalRatings || 0}
              </p>
              <p className="text-xs text-muted-foreground">Reviews</p>
            </CardContent>
          </Card>

          {/* Followers */}
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold" data-testid="text-follower-count">
                {followStats?.followerCount || 0}
              </p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </CardContent>
          </Card>

          {/* Following or Total Sales based on role */}
          {isSeller ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold" data-testid="text-total-sales">
                  {currentUser.totalSales || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total Sales</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold" data-testid="text-following-count">
                  {followStats?.followingCount || 0}
                </p>
                <p className="text-xs text-muted-foreground">Following</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Role Switch Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-semibold">Account Role</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose how you want to use CampusPlug
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3" data-testid="role-switch-group">
                <Button
                  variant={currentUser.role === "buyer" ? "default" : "outline"}
                  onClick={() => handleRoleChange("buyer")}
                  disabled={roleMutation.isPending || currentUser.role === "admin"}
                  className="gap-2 flex-1 min-w-[120px]"
                  data-testid="button-role-buyer"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Buyer
                  {roleMutation.isPending && currentUser.role !== "buyer" && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </Button>
                <Button
                  variant={currentUser.role === "seller" ? "default" : "outline"}
                  onClick={() => handleRoleChange("seller")}
                  disabled={roleMutation.isPending || currentUser.role === "admin"}
                  className="gap-2 flex-1 min-w-[120px]"
                  data-testid="button-role-seller"
                >
                  <Store className="h-4 w-4" />
                  Seller
                  {roleMutation.isPending && currentUser.role !== "seller" && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </Button>
                <Button
                  variant={currentUser.role === "both" ? "default" : "outline"}
                  onClick={() => handleRoleChange("both")}
                  disabled={roleMutation.isPending || currentUser.role === "admin"}
                  className="gap-2 flex-1 min-w-[120px]"
                  data-testid="button-role-both"
                >
                  <Users className="h-4 w-4" />
                  Both
                  {roleMutation.isPending && currentUser.role !== "both" && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </Button>
              </div>
              
              {currentUser.role === "admin" && (
                <p className="text-sm text-muted-foreground">
                  Admin accounts cannot change their role.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Collapsible Edit Profile Form */}
        <Collapsible open={isEditOpen} onOpenChange={setIsEditOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardContent className="pt-6 cursor-pointer">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Pencil className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">Edit Profile Details</h3>
                      <p className="text-sm text-muted-foreground">
                        Update your personal information
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" data-testid="button-toggle-edit-form">
                    {isEditOpen ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="pt-0 border-t">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))}
                    className="space-y-4 pt-6"
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
                        onClick={() => setIsEditOpen(false)}
                        data-testid="button-cancel-edit"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Additional Info for Sellers */}
        {isSeller && followStats && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-semibold">Seller Stats</h3>
                  <p className="text-sm text-muted-foreground">
                    Your selling performance
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-bold" data-testid="text-following-count-alt">
                      {followStats.followingCount}
                    </p>
                    <p className="text-muted-foreground">Following</p>
                  </div>
                  {currentUser.responseTime && (
                    <div className="text-center">
                      <p className="font-bold" data-testid="text-response-time">
                        {currentUser.responseTime}m
                      </p>
                      <p className="text-muted-foreground">Avg. Response</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

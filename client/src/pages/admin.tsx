import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, ShoppingBag, TrendingUp, AlertCircle, Shield, Ban, Database, Activity, HardDrive, Megaphone, Pin, Trash2, Edit, Plus, Sparkles, AlertTriangle, ScanFace, Check, X, Eye, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { User, Product, Announcement, KycVerification, PlatformSetting } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function AdminPanel() {
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const { toast } = useToast();

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You need to be an admin to access this page",
        variant: "destructive",
      });
      window.location.href = "/";
    }
  }, [authLoading, isAdmin, toast]);

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: announcements, isLoading: announcementsLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/admin/announcements"],
  });

  // KYC Review types - extend KycVerification with user info
  interface KycVerificationWithUser extends KycVerification {
    user?: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      phoneNumber: string | null;
    };
  }

  const { data: pendingKyc, isLoading: kycLoading } = useQuery<KycVerificationWithUser[]>({
    queryKey: ["/api/kyc/admin/pending"],
  });

  const { data: platformSettings, isLoading: settingsLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/platform-settings"],
  });

  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState<{
    title: string;
    content: string;
    category: "update" | "feature" | "alert";
    priority: "low" | "normal" | "high";
    isPinned: boolean;
    isPublished: boolean;
  }>({
    title: "",
    content: "",
    category: "update",
    priority: "normal",
    isPinned: false,
    isPublished: true,
  });

  // KYC Review state
  const [kycReviewDialogOpen, setKycReviewDialogOpen] = useState(false);
  const [selectedKyc, setSelectedKyc] = useState<KycVerificationWithUser | null>(null);
  const [kycReviewData, setKycReviewData] = useState({
    action: "approve" as "approve" | "reject",
    notes: "",
    rejectionReason: "",
  });
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const verifyUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("PUT", `/api/admin/users/${userId}/verify`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User verified successfully",
      });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("PUT", `/api/admin/users/${userId}/ban`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User banned successfully",
      });
    },
  });

  const approveProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      return await apiRequest("PUT", `/api/admin/products/${productId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({
        title: "Success",
        description: "Product approved successfully",
      });
    },
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: typeof newAnnouncement) => {
      return await apiRequest("POST", "/api/announcements", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setAnnouncementDialogOpen(false);
      setNewAnnouncement({
        title: "",
        content: "",
        category: "update",
        priority: "normal",
        isPinned: false,
        isPublished: true,
      });
      toast({
        title: "Success",
        description: "Announcement created successfully",
      });
    },
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof newAnnouncement> }) => {
      return await apiRequest("PATCH", `/api/announcements/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setAnnouncementDialogOpen(false);
      setEditingAnnouncement(null);
      toast({
        title: "Success",
        description: "Announcement updated successfully",
      });
    },
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/announcements/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({
        title: "Success",
        description: "Announcement deleted successfully",
      });
    },
  });

  const updatePlatformSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return await apiRequest("PATCH", `/api/admin/platform-settings/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-settings"] });
      toast({
        title: "Success",
        description: "Setting updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update setting",
        variant: "destructive",
      });
    },
  });

  // KYC Review mutation
  const reviewKycMutation = useMutation({
    mutationFn: async (data: { kycId: string; action: "approve" | "reject"; notes?: string; rejectionReason?: string }) => {
      return await apiRequest("POST", "/api/kyc/admin/review", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/admin/pending"] });
      setKycReviewDialogOpen(false);
      setSelectedKyc(null);
      setKycReviewData({ action: "approve", notes: "", rejectionReason: "" });
      toast({
        title: "Success",
        description: variables.action === "approve" 
          ? "KYC verification approved successfully" 
          : "KYC verification rejected",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process KYC review",
        variant: "destructive",
      });
    },
  });

  // KYC Review handlers
  const handleOpenKycReview = (kyc: KycVerificationWithUser) => {
    setSelectedKyc(kyc);
    setKycReviewData({ action: "approve", notes: "", rejectionReason: "" });
    setKycReviewDialogOpen(true);
  };

  const handleSubmitKycReview = () => {
    if (!selectedKyc) return;
    
    // Validate rejection reason if rejecting
    if (kycReviewData.action === "reject" && !kycReviewData.rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Rejection reason is required when rejecting a verification",
        variant: "destructive",
      });
      return;
    }

    reviewKycMutation.mutate({
      kycId: selectedKyc.id,
      action: kycReviewData.action,
      notes: kycReviewData.notes || undefined,
      rejectionReason: kycReviewData.action === "reject" ? kycReviewData.rejectionReason : undefined,
    });
  };

  const handleOpenAnnouncementDialog = (announcement?: Announcement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setNewAnnouncement({
        title: announcement.title,
        content: announcement.content,
        category: (announcement.category || "update") as "update" | "feature" | "alert",
        priority: (announcement.priority || "normal") as "low" | "normal" | "high",
        isPinned: announcement.isPinned || false,
        isPublished: announcement.isPublished || true,
      });
    } else {
      setEditingAnnouncement(null);
      setNewAnnouncement({
        title: "",
        content: "",
        category: "update",
        priority: "normal",
        isPinned: false,
        isPublished: true,
      });
    }
    setAnnouncementDialogOpen(true);
  };

  const handleSubmitAnnouncement = () => {
    if (editingAnnouncement) {
      updateAnnouncementMutation.mutate({ id: editingAnnouncement.id, data: newAnnouncement });
    } else {
      createAnnouncementMutation.mutate(newAnnouncement);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const totalUsers = users?.length || 0;
  const verifiedUsers = users?.filter((u) => u.isVerified).length || 0;
  const totalProducts = products?.length || 0;
  const flaggedProducts = products?.filter((p) => p.isFlagged).length || 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {verifiedUsers} verified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-products">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              Active listings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flagged Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-flagged-products">
              {flaggedProducts}
            </div>
            <p className="text-xs text-muted-foreground">
              Needs review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦0</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for User and Product Management */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
          <TabsTrigger value="announcements" data-testid="tab-announcements">Campus Updates</TabsTrigger>
          <TabsTrigger value="kyc" data-testid="tab-kyc">KYC Review</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          <TabsTrigger value="metrics" data-testid="tab-metrics">Database Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : users && users.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Trust Score</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium" data-testid={`text-user-name-${u.id}`}>
                                {u.firstName || u.email}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {u.email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{u.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {u.isVerified && (
                                <Badge variant="default" className="gap-1">
                                  <Shield className="h-3 w-3" />
                                  Verified
                                </Badge>
                              )}
                              {u.isBanned && (
                                <Badge variant="destructive" className="gap-1">
                                  <Ban className="h-3 w-3" />
                                  Banned
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {u.trustScore || "5.0"} ({u.totalRatings || 0})
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {!u.isVerified && (
                                <Button
                                  size="sm"
                                  onClick={() => verifyUserMutation.mutate(u.id)}
                                  data-testid={`button-verify-${u.id}`}
                                >
                                  Verify
                                </Button>
                              )}
                              {!u.isBanned && u.id !== user.id && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => banUserMutation.mutate(u.id)}
                                  data-testid={`button-ban-${u.id}`}
                                >
                                  Ban
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No users found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Product Moderation</CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : products && products.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <img
                                src={product.images[0] || "/placeholder-product.png"}
                                alt={product.title}
                                className="h-12 w-12 rounded object-cover"
                                loading="lazy"
                              />
                              <p className="font-medium line-clamp-1" data-testid={`text-product-title-${product.id}`}>
                                {product.title}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            ₦{parseFloat(product.price as string).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {product.isFlagged && (
                                <Badge variant="destructive">Flagged</Badge>
                              )}
                              {!product.isApproved && (
                                <Badge variant="secondary">Pending</Badge>
                              )}
                              {product.isApproved && !product.isFlagged && (
                                <Badge variant="default">Approved</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{product.views || 0}</TableCell>
                          <TableCell className="text-right">
                            {!product.isApproved && (
                              <Button
                                size="sm"
                                onClick={() => approveProductMutation.mutate(product.id)}
                                data-testid={`button-approve-${product.id}`}
                              >
                                Approve
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No products found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Campus Updates Management
                </CardTitle>
              </div>
              <Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenAnnouncementDialog()} data-testid="button-new-announcement">
                    <Plus className="h-4 w-4 mr-2" />
                    New Announcement
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingAnnouncement ? "Edit Announcement" : "Create New Announcement"}</DialogTitle>
                    <DialogDescription>
                      {editingAnnouncement 
                        ? "Update the announcement details below." 
                        : "Create a new announcement to share with all users."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={newAnnouncement.title}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                        placeholder="Announcement title"
                        data-testid="input-announcement-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="content">Content</Label>
                      <Textarea
                        id="content"
                        value={newAnnouncement.content}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                        placeholder="Write the announcement content..."
                        className="min-h-32"
                        data-testid="input-announcement-content"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={newAnnouncement.category}
                          onValueChange={(value: "update" | "feature" | "alert") => 
                            setNewAnnouncement({ ...newAnnouncement, category: value })
                          }
                        >
                          <SelectTrigger data-testid="select-announcement-category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="update">
                              <span className="flex items-center gap-2">
                                <Megaphone className="h-4 w-4" />
                                Update
                              </span>
                            </SelectItem>
                            <SelectItem value="feature">
                              <span className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                New Feature
                              </span>
                            </SelectItem>
                            <SelectItem value="alert">
                              <span className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Alert
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select
                          value={newAnnouncement.priority}
                          onValueChange={(value: "low" | "normal" | "high") => 
                            setNewAnnouncement({ ...newAnnouncement, priority: value })
                          }
                        >
                          <SelectTrigger data-testid="select-announcement-priority">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            id="isPinned"
                            checked={newAnnouncement.isPinned}
                            onCheckedChange={(checked) => 
                              setNewAnnouncement({ ...newAnnouncement, isPinned: checked })
                            }
                          />
                          <Label htmlFor="isPinned" className="flex items-center gap-1">
                            <Pin className="h-4 w-4" />
                            Pin to top
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id="isPublished"
                            checked={newAnnouncement.isPublished}
                            onCheckedChange={(checked) => 
                              setNewAnnouncement({ ...newAnnouncement, isPublished: checked })
                            }
                          />
                          <Label htmlFor="isPublished">Publish immediately</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAnnouncementDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmitAnnouncement}
                      disabled={!newAnnouncement.title || !newAnnouncement.content || createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending}
                      data-testid="button-submit-announcement"
                    >
                      {createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending ? "Saving..." : editingAnnouncement ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {announcementsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : announcements && announcements.length > 0 ? (
                <div className="space-y-4">
                  {announcements.map((announcement) => {
                    const categoryConfig = {
                      update: { icon: Megaphone, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
                      feature: { icon: Sparkles, className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" },
                      alert: { icon: AlertTriangle, className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" },
                    };
                    const config = categoryConfig[announcement.category as keyof typeof categoryConfig] || categoryConfig.update;
                    const CategoryIcon = config.icon;
                    
                    return (
                      <div 
                        key={announcement.id} 
                        className={`border rounded-lg p-4 ${!announcement.isPublished ? 'opacity-60' : ''}`}
                        data-testid={`card-admin-announcement-${announcement.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge className={config.className} variant="outline">
                                <CategoryIcon className="h-3 w-3 mr-1" />
                                {announcement.category}
                              </Badge>
                              {announcement.isPinned && (
                                <Badge variant="secondary" className="gap-1">
                                  <Pin className="h-3 w-3" />
                                  Pinned
                                </Badge>
                              )}
                              {!announcement.isPublished && (
                                <Badge variant="outline">Draft</Badge>
                              )}
                              {announcement.priority === "high" && (
                                <Badge variant="destructive" className="text-xs">High Priority</Badge>
                              )}
                            </div>
                            <h3 className="font-semibold text-lg mb-1">{announcement.title}</h3>
                            <p className="text-muted-foreground text-sm line-clamp-2">{announcement.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {announcement.createdAt && formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                              {announcement.views !== null && ` · ${announcement.views} views`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenAnnouncementDialog(announcement)}
                              data-testid={`button-edit-announcement-${announcement.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteAnnouncementMutation.mutate(announcement.id)}
                              disabled={deleteAnnouncementMutation.isPending}
                              data-testid={`button-delete-announcement-${announcement.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Announcements Yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first announcement to inform users about updates.</p>
                  <Button onClick={() => handleOpenAnnouncementDialog()} data-testid="button-create-first-announcement">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Announcement
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanFace className="h-5 w-5" />
                KYC Verification Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kycLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : pendingKyc && pendingKyc.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>NIN Name</TableHead>
                        <TableHead>Similarity Score</TableHead>
                        <TableHead>Images</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingKyc.map((kyc) => (
                        <TableRow key={kyc.id} data-testid={`row-kyc-${kyc.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium" data-testid={`text-kyc-user-${kyc.id}`}>
                                {kyc.user?.firstName || kyc.user?.email || "Unknown User"}
                                {kyc.user?.lastName ? ` ${kyc.user.lastName}` : ""}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {kyc.user?.email}
                              </p>
                              {kyc.user?.phoneNumber && (
                                <p className="text-xs text-muted-foreground">
                                  {kyc.user.phoneNumber}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {kyc.ninFirstName} {kyc.ninLastName}
                              </p>
                              {kyc.ninDateOfBirth && (
                                <p className="text-xs text-muted-foreground">
                                  DOB: {kyc.ninDateOfBirth}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {kyc.similarityScore ? (
                              <Badge 
                                variant={parseFloat(kyc.similarityScore as string) >= 70 ? "default" : "secondary"}
                                className={parseFloat(kyc.similarityScore as string) >= 70 ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30"}
                              >
                                {parseFloat(kyc.similarityScore as string).toFixed(1)}%
                              </Badge>
                            ) : (
                              <Badge variant="secondary">N/A</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {kyc.selfieUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setImagePreviewUrl(kyc.selfieUrl)}
                                  data-testid={`button-view-selfie-${kyc.id}`}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Selfie
                                </Button>
                              )}
                              {kyc.ninPhotoUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setImagePreviewUrl(kyc.ninPhotoUrl)}
                                  data-testid={`button-view-nin-${kyc.id}`}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  NIN
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {kyc.createdAt && formatDistanceToNow(new Date(kyc.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleOpenKycReview(kyc)}
                              data-testid={`button-review-kyc-${kyc.id}`}
                            >
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <ScanFace className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Pending KYC Reviews</h3>
                  <p className="text-muted-foreground">All KYC verifications have been processed.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* KYC Review Dialog */}
          <Dialog open={kycReviewDialogOpen} onOpenChange={setKycReviewDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Review KYC Verification</DialogTitle>
                <DialogDescription>
                  Review the submitted verification documents and decide to approve or reject.
                </DialogDescription>
              </DialogHeader>
              {selectedKyc && (
                <div className="space-y-6 py-4">
                  {/* User Info Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Account Name</Label>
                      <p className="font-medium">
                        {selectedKyc.user?.firstName} {selectedKyc.user?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{selectedKyc.user?.email}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">NIN Name</Label>
                      <p className="font-medium">
                        {selectedKyc.ninFirstName} {selectedKyc.ninLastName}
                      </p>
                      {selectedKyc.ninDateOfBirth && (
                        <p className="text-sm text-muted-foreground">DOB: {selectedKyc.ninDateOfBirth}</p>
                      )}
                    </div>
                  </div>

                  {/* Similarity Score */}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Similarity Score</Label>
                    <div className="flex items-center gap-2">
                      {selectedKyc.similarityScore ? (
                        <>
                          <Badge 
                            className={parseFloat(selectedKyc.similarityScore as string) >= 70 
                              ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" 
                              : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30"}
                          >
                            {parseFloat(selectedKyc.similarityScore as string).toFixed(1)}%
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {parseFloat(selectedKyc.similarityScore as string) >= 70 
                              ? "Good match" 
                              : "Low match - requires manual review"}
                          </span>
                        </>
                      ) : (
                        <Badge variant="secondary">Not available</Badge>
                      )}
                    </div>
                  </div>

                  {/* Images */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">Selfie Image</Label>
                      {selectedKyc.selfieUrl ? (
                        <div className="border rounded-lg overflow-hidden">
                          <img 
                            src={selectedKyc.selfieUrl} 
                            alt="User Selfie" 
                            className="w-full h-48 object-cover cursor-pointer"
                            loading="lazy"
                            onClick={() => setImagePreviewUrl(selectedKyc.selfieUrl)}
                          />
                        </div>
                      ) : (
                        <div className="border rounded-lg h-48 flex items-center justify-center bg-muted">
                          <p className="text-muted-foreground text-sm">No selfie available</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">NIN Photo</Label>
                      {selectedKyc.ninPhotoUrl ? (
                        <div className="border rounded-lg overflow-hidden">
                          <img 
                            src={selectedKyc.ninPhotoUrl} 
                            alt="NIN Photo" 
                            className="w-full h-48 object-cover cursor-pointer"
                            loading="lazy"
                            onClick={() => setImagePreviewUrl(selectedKyc.ninPhotoUrl)}
                          />
                        </div>
                      ) : (
                        <div className="border rounded-lg h-48 flex items-center justify-center bg-muted">
                          <p className="text-muted-foreground text-sm">No NIN photo available</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Review Action */}
                  <div className="space-y-2">
                    <Label htmlFor="action">Decision</Label>
                    <Select
                      value={kycReviewData.action}
                      onValueChange={(value: "approve" | "reject") => 
                        setKycReviewData({ ...kycReviewData, action: value })
                      }
                    >
                      <SelectTrigger data-testid="select-kyc-action">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approve">
                          <span className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            Approve Verification
                          </span>
                        </SelectItem>
                        <SelectItem value="reject">
                          <span className="flex items-center gap-2">
                            <X className="h-4 w-4 text-red-600" />
                            Reject Verification
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={kycReviewData.notes}
                      onChange={(e) => setKycReviewData({ ...kycReviewData, notes: e.target.value })}
                      placeholder="Add any notes about this verification..."
                      className="min-h-20"
                      data-testid="input-kyc-notes"
                    />
                  </div>

                  {/* Rejection Reason - only show if rejecting */}
                  {kycReviewData.action === "reject" && (
                    <div className="space-y-2">
                      <Label htmlFor="rejectionReason">Rejection Reason (required)</Label>
                      <Textarea
                        id="rejectionReason"
                        value={kycReviewData.rejectionReason}
                        onChange={(e) => setKycReviewData({ ...kycReviewData, rejectionReason: e.target.value })}
                        placeholder="Explain why this verification is being rejected..."
                        className="min-h-20"
                        data-testid="input-kyc-rejection-reason"
                      />
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setKycReviewDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitKycReview}
                  disabled={reviewKycMutation.isPending}
                  variant={kycReviewData.action === "reject" ? "destructive" : "default"}
                  data-testid="button-submit-kyc-review"
                >
                  {reviewKycMutation.isPending 
                    ? "Processing..." 
                    : kycReviewData.action === "approve" 
                      ? "Approve" 
                      : "Reject"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Image Preview Dialog */}
          <Dialog open={!!imagePreviewUrl} onOpenChange={() => setImagePreviewUrl(null)}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Image Preview</DialogTitle>
              </DialogHeader>
              {imagePreviewUrl && (
                <div className="flex justify-center">
                  <img 
                    src={imagePreviewUrl} 
                    alt="Preview" 
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                    loading="lazy"
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Platform Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Megaphone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">Sponsored Ads System</h4>
                        <p className="text-sm text-muted-foreground">
                          Enable or disable sponsored advertisements in the marketplace
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={platformSettings?.find(s => s.key === "ads_enabled")?.value !== "false"}
                      onCheckedChange={(checked) => {
                        updatePlatformSettingMutation.mutate({
                          key: "ads_enabled",
                          value: checked ? "true" : "false",
                        });
                      }}
                      disabled={updatePlatformSettingMutation.isPending}
                      data-testid="switch-ads-enabled"
                    />
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      About Sponsored Ads
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Ads appear every 6th position in the marketplace grid</li>
                      <li>Maximum 3 ads are shown at a time (randomized)</li>
                      <li>Ads are clearly labeled with a "Sponsored" badge</li>
                      <li>Impressions and clicks are tracked for analytics</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <DatabaseMetricsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Database Metrics Types
interface TableMetric {
  table_name: string;
  row_estimate: number;
  total_size_bytes: number;
  indexes_size_bytes: number;
  table_size_bytes: number;
}

interface TableMetrics {
  tables: TableMetric[];
  totalDatabaseSize: number;
}

interface ConnectionState {
  state: string;
  count: number;
}

interface ActivityMetrics {
  connectionsByState: ConnectionState[];
  totalConnections: number;
  maxConnectionAge: number;
}

interface PerformanceMetrics {
  queryStats: any[];
  databaseStats: {
    deadlocks: number;
    temp_files: number;
    temp_bytes: number;
  };
  extensionAvailable: boolean;
}

// Database Metrics Component
function DatabaseMetricsTab() {
  // Poll metrics every 30 seconds
  const { data: tableMetrics, isLoading: tablesLoading } = useQuery<TableMetrics>({
    queryKey: ["/api/admin/metrics/tables"],
    refetchInterval: 30000,
  });

  const { data: activityMetrics, isLoading: activityLoading } = useQuery<ActivityMetrics>({
    queryKey: ["/api/admin/metrics/activity"],
    refetchInterval: 30000,
  });

  const { data: performanceMetrics, isLoading: performanceLoading } = useQuery<PerformanceMetrics>({
    queryKey: ["/api/admin/metrics/performance"],
    refetchInterval: 30000,
  });

  // Format bytes to readable size
  const formatBytes = (bytes: number | null | undefined) => {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return '0 Bytes';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (isNaN(i) || i < 0) return '0 Bytes';
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[Math.min(i, sizes.length - 1)];
  };

  // Prepare data for charts
  const tableChartData = tableMetrics?.tables.slice(0, 10).map((t: any) => ({
    name: t.table_name.split('.')[1] || t.table_name,
    size: Math.round(t.total_size_bytes / 1024 / 1024 * 100) / 100, // MB
    rows: t.row_estimate,
  })) || [];

  const connectionData = activityMetrics?.connectionsByState.map((c: any) => ({
    name: c.state || 'unknown',
    value: c.count,
  })) || [];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (tablesLoading || activityLoading || performanceLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Database Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-db-size">
              {formatBytes(tableMetrics?.totalDatabaseSize || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {tableMetrics?.tables.length || 0} tables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-connections">
              {activityMetrics?.totalConnections || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Max age: {Math.round(activityMetrics?.maxConnectionAge || 0)}s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Query Stats</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-queries">
              {performanceMetrics?.queryStats?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {performanceMetrics?.extensionAvailable ? 'Extension enabled' : 'Enable pg_stat_statements'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table Storage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Table Storage (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tableChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis label={{ value: 'Size (MB)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="size" fill="#3b82f6" name="Size (MB)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Connection States */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Connection States</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={connectionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {connectionData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Deadlocks</span>
                <span className="font-medium" data-testid="text-deadlocks">
                  {performanceMetrics?.databaseStats?.deadlocks || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Temp Files</span>
                <span className="font-medium" data-testid="text-temp-files">
                  {performanceMetrics?.databaseStats?.temp_files || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Temp Data</span>
                <span className="font-medium">
                  {formatBytes(performanceMetrics?.databaseStats?.temp_bytes || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table Info */}
      <Card>
        <CardHeader>
          <CardTitle>Table Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table Name</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Table Size</TableHead>
                  <TableHead className="text-right">Index Size</TableHead>
                  <TableHead className="text-right">Total Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableMetrics?.tables.map((table: any) => (
                  <TableRow key={table.table_name}>
                    <TableCell className="font-medium">
                      {table.table_name.split('.')[1] || table.table_name}
                    </TableCell>
                    <TableCell className="text-right">
                      {(table.row_estimate ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatBytes(table.table_size_bytes)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatBytes(table.indexes_size_bytes)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatBytes(table.total_size_bytes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

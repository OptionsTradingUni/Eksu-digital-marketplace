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
import { Users, ShoppingBag, TrendingUp, AlertCircle, Shield, Ban, Database, Activity, HardDrive } from "lucide-react";
import type { User, Product } from "@shared/schema";
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
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
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
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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
                      {table.row_estimate.toLocaleString()}
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

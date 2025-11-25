import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import {
  Bell,
  MessageSquare,
  ShoppingCart,
  Star,
  UserPlus,
  Package,
  AlertCircle,
  CheckCircle,
  XCircle,
  Wallet,
  TrendingUp,
  ArrowLeft,
  Check,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@shared/schema";

export default function NotificationsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("all");

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PUT", `/api/notifications/${id}/read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/notifications/read-all");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "All notifications marked as read",
      });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/notifications/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Notification deleted",
      });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "message":
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case "sale":
      case "purchase":
        return <ShoppingCart className="h-5 w-5 text-green-500" />;
      case "review":
        return <Star className="h-5 w-5 text-yellow-500" />;
      case "follow":
        return <UserPlus className="h-5 w-5 text-purple-500" />;
      case "product_update":
        return <Package className="h-5 w-5 text-orange-500" />;
      case "announcement":
        return <Bell className="h-5 w-5 text-primary" />;
      case "dispute":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "verification_approved":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "verification_rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "escrow_released":
      case "wallet_credit":
        return <Wallet className="h-5 w-5 text-green-500" />;
      case "boost_expired":
        return <TrendingUp className="h-5 w-5 text-orange-500" />;
      case "price_alert":
        return <AlertCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      setLocation(notification.link);
    }
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;
  const readCount = notifications?.filter(n => n.isRead).length || 0;

  const filteredNotifications = notifications?.filter(n => {
    if (activeTab === "unread") return !n.isRead;
    if (activeTab === "read") return n.isRead;
    return true;
  }) || [];

  const renderNotificationList = (notificationList: Notification[]) => {
    if (notificationList.length === 0) {
      const emptyMessage = activeTab === "unread" 
        ? "No unread notifications"
        : activeTab === "read"
        ? "No read notifications"
        : "No notifications yet";
      
      const emptyDescription = activeTab === "unread"
        ? "You're all caught up!"
        : activeTab === "read"
        ? "Read notifications will appear here."
        : "You'll see updates about your orders, messages, and more here.";

      return (
        <Card data-testid="empty-notifications">
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2" data-testid="text-empty-title">{emptyMessage}</h3>
            <p className="text-muted-foreground" data-testid="text-empty-description">
              {emptyDescription}
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {notificationList.map((notification) => (
          <Card
            key={notification.id}
            className={`relative cursor-pointer transition-colors hover-elevate ${!notification.isRead ? "bg-primary/5 border-primary/20" : ""}`}
            data-testid={`notification-card-${notification.id}`}
            onClick={() => handleNotificationClick(notification)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-muted p-2 flex-shrink-0" data-testid={`notification-icon-${notification.id}`}>
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p 
                        className={`font-medium ${!notification.isRead ? "text-foreground" : "text-muted-foreground"}`}
                        data-testid={`notification-title-${notification.id}`}
                      >
                        {notification.title}
                      </p>
                      <p 
                        className="text-sm text-muted-foreground mt-1"
                        data-testid={`notification-message-${notification.id}`}
                      >
                        {notification.message}
                      </p>
                      <p 
                        className="text-xs text-muted-foreground mt-2"
                        data-testid={`notification-time-${notification.id}`}
                      >
                        {formatDistanceToNow(new Date(notification.createdAt!), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <Badge variant="default" className="flex-shrink-0" data-testid={`notification-unread-badge-${notification.id}`}>
                        New
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {notification.link && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        onClick={() => {
                          if (!notification.isRead) {
                            markReadMutation.mutate(notification.id);
                          }
                        }}
                        data-testid={`button-view-${notification.id}`}
                      >
                        <Link href={notification.link}>View</Link>
                      </Button>
                    )}
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markReadMutation.mutate(notification.id)}
                        disabled={markReadMutation.isPending}
                        data-testid={`button-mark-read-${notification.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Mark Read
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotificationMutation.mutate(notification.id)}
                      disabled={deleteNotificationMutation.isPending}
                      className="text-destructive"
                      data-testid={`button-delete-${notification.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i} data-testid={`skeleton-notification-${i}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-12" />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild data-testid="button-back">
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Notifications</h1>
            {!isLoading && notifications && notifications.length > 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-unread-count">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            )}
          </div>
        </div>
        {!isLoading && unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            data-testid="button-mark-all-read"
          >
            <Check className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <>
          <div className="mb-6">
            <Skeleton className="h-10 w-full max-w-md" />
          </div>
          {renderLoadingSkeleton()}
        </>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-6" data-testid="tabs-filter">
            <TabsTrigger value="all" data-testid="tab-all">
              All
              {notifications && notifications.length > 0 && (
                <Badge variant="secondary" className="ml-2 no-default-hover-elevate no-default-active-elevate">
                  {notifications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread" data-testid="tab-unread">
              Unread
              {unreadCount > 0 && (
                <Badge variant="default" className="ml-2 no-default-hover-elevate no-default-active-elevate">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="read" data-testid="tab-read">
              Read
              {readCount > 0 && (
                <Badge variant="secondary" className="ml-2 no-default-hover-elevate no-default-active-elevate">
                  {readCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" data-testid="content-all">
            {renderNotificationList(filteredNotifications)}
          </TabsContent>

          <TabsContent value="unread" data-testid="content-unread">
            {renderNotificationList(filteredNotifications)}
          </TabsContent>

          <TabsContent value="read" data-testid="content-read">
            {renderNotificationList(filteredNotifications)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

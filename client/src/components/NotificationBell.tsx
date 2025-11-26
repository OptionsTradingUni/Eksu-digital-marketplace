import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@/../../shared/schema";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  // WebSocket connection for real-time notifications
  useEffect(() => {
    let mounted = true;

    const connectWebSocket = async () => {
      try {
        // Get WebSocket token
        const tokenResponse = await fetch("/api/auth/ws-token", { credentials: "include" });
        if (!tokenResponse.ok) {
          console.log("Not authenticated, skipping WebSocket for notifications");
          return;
        }

        const { token } = await tokenResponse.json();
        if (!token || !mounted) return;

        // Connect to WebSocket
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        const socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
          console.log("NotificationBell: WebSocket connected, authenticating...");
          socket.send(JSON.stringify({ type: "auth", token }));
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === "auth_success") {
              console.log("NotificationBell: WebSocket authenticated");
            } else if (data.type === "new_notification") {
              console.log("NotificationBell: Received new notification via WebSocket");
              // Invalidate the notifications cache to refresh the list
              queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        socket.onclose = () => {
          console.log("NotificationBell: WebSocket disconnected");
          wsRef.current = null;
          
          // Attempt to reconnect after 5 seconds
          if (mounted) {
            reconnectTimeoutRef.current = setTimeout(() => {
              if (mounted) connectWebSocket();
            }, 5000);
          }
        };

        socket.onerror = (error) => {
          console.error("NotificationBell: WebSocket error:", error);
        };

        wsRef.current = socket;
      } catch (error) {
        console.error("Failed to connect WebSocket for notifications:", error);
      }
    };

    connectWebSocket();

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/notifications/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/notifications/mark-all-read", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-2">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllAsRead.mutate()}
              data-testid="button-mark-all-read"
            >
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex flex-col items-start p-3 cursor-pointer gap-1"
                onClick={() => handleNotificationClick(notification)}
                data-testid={`notification-${notification.id}`}
              >
                <div className="flex items-start justify-between w-full gap-2">
                  <div className="flex-1">
                    <p className={`text-sm ${!notification.isRead ? "font-semibold" : ""}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

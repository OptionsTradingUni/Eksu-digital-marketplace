import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Megaphone, 
  Sparkles, 
  AlertTriangle, 
  Pin, 
  CheckCircle2, 
  Circle,
  Eye
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Announcement, User } from "@shared/schema";

type AnnouncementWithAuthor = Announcement & { author: User; isRead?: boolean };

const categoryConfig = {
  update: { 
    label: "Update", 
    icon: Megaphone, 
    variant: "default" as const,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
  },
  feature: { 
    label: "New Feature", 
    icon: Sparkles, 
    variant: "default" as const,
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30"
  },
  alert: { 
    label: "Alert", 
    icon: AlertTriangle, 
    variant: "destructive" as const,
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
  },
};

const priorityConfig = {
  low: { label: "Low", className: "text-muted-foreground" },
  normal: { label: "Normal", className: "" },
  high: { label: "High", className: "font-semibold" },
};

export default function AnnouncementsPage() {
  const { user } = useAuth();

  const { data: announcements, isLoading } = useQuery<AnnouncementWithAuthor[]>({
    queryKey: ["/api/announcements"],
    refetchOnMount: true,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/announcements/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
  });

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsReadMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const pinnedAnnouncements = announcements?.filter(a => a.isPinned) || [];
  const regularAnnouncements = announcements?.filter(a => !a.isPinned) || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <Megaphone className="h-8 w-8" />
          Campus Updates
        </h1>
        <p className="text-muted-foreground mt-2">
          Stay informed with the latest news and updates from the EKSU marketplace
        </p>
      </div>

      {announcements && announcements.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <Megaphone className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Announcements Yet</h3>
            <p className="text-muted-foreground">
              Check back later for updates from the marketplace team.
            </p>
          </CardContent>
        </Card>
      )}

      {pinnedAnnouncements.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Pin className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Pinned</h2>
          </div>
          <div className="space-y-4">
            {pinnedAnnouncements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                onMarkAsRead={handleMarkAsRead}
                isPending={markAsReadMutation.isPending}
                user={user}
              />
            ))}
          </div>
        </div>
      )}

      {regularAnnouncements.length > 0 && (
        <div>
          {pinnedAnnouncements.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold">Recent Updates</h2>
            </div>
          )}
          <div className="space-y-4">
            {regularAnnouncements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                onMarkAsRead={handleMarkAsRead}
                isPending={markAsReadMutation.isPending}
                user={user}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({
  announcement,
  onMarkAsRead,
  isPending,
  user,
}: {
  announcement: AnnouncementWithAuthor;
  onMarkAsRead: (id: string, e: React.MouseEvent) => void;
  isPending: boolean;
  user: any;
}) {
  const categoryInfo = categoryConfig[announcement.category as keyof typeof categoryConfig] || categoryConfig.update;
  const priorityInfo = priorityConfig[announcement.priority as keyof typeof priorityConfig] || priorityConfig.normal;
  const CategoryIcon = categoryInfo.icon;
  
  const isRead = announcement.isRead;

  return (
    <Card 
      className={`transition-all ${!isRead ? 'border-l-4 border-l-primary' : ''}`}
      data-testid={`card-announcement-${announcement.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={categoryInfo.className} variant="outline">
              <CategoryIcon className="h-3 w-3 mr-1" />
              {categoryInfo.label}
            </Badge>
            {announcement.isPinned && (
              <Badge variant="secondary" className="gap-1">
                <Pin className="h-3 w-3" />
                Pinned
              </Badge>
            )}
            {announcement.priority === "high" && (
              <Badge variant="destructive" className="text-xs">
                High Priority
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {announcement.views !== null && announcement.views > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {announcement.views}
              </span>
            )}
            <span>
              {formatDistanceToNow(new Date(announcement.createdAt!), { addSuffix: true })}
            </span>
          </div>
        </div>
        <CardTitle className={`text-xl mt-2 ${priorityInfo.className}`}>
          {announcement.title}
        </CardTitle>
        {announcement.author && (
          <CardDescription>
            Posted by {announcement.author.firstName} {announcement.author.lastName}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap">{announcement.content}</p>
        </div>
        
        {user && !isRead && (
          <div className="mt-4 pt-4 border-t flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => onMarkAsRead(announcement.id, e)}
              disabled={isPending}
              className="gap-2"
              data-testid={`button-mark-read-${announcement.id}`}
            >
              {isRead ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Read
                </>
              ) : (
                <>
                  <Circle className="h-4 w-4" />
                  Mark as Read
                </>
              )}
            </Button>
          </div>
        )}
        
        {user && isRead && (
          <div className="mt-4 pt-4 border-t flex justify-end">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              You've read this update
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ThumbsUp, 
  ThumbsDown, 
  MessageCircle, 
  Send, 
  Eye,
  MoreHorizontal,
  Trash2,
  Flag,
  Plus,
  TrendingUp,
  Heart,
  Sparkles,
  GraduationCap,
  Theater,
  MessageSquare,
  Smile,
  Lock,
  AlertTriangle,
  Link2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import type { Confession, ConfessionComment } from "@shared/schema";

const CATEGORIES = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "general", label: "General", icon: MessageSquare },
  { value: "love", label: "Love", icon: Heart },
  { value: "academics", label: "Academics", icon: GraduationCap },
  { value: "drama", label: "Drama", icon: Theater },
  { value: "advice", label: "Advice", icon: MessageCircle },
  { value: "funny", label: "Funny", icon: Smile },
  { value: "secrets", label: "Secrets", icon: Lock },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30",
  love: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30",
  academics: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  drama: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
  advice: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  funny: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  secrets: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
};

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "hate_speech", label: "Hate Speech" },
  { value: "self_harm", label: "Self Harm Content" },
  { value: "other", label: "Other" },
];

type ConfessionWithMeta = Confession & {
  author?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } | null;
  comments?: CommentWithAuthor[];
  userVote?: "like" | "dislike" | null;
  isOwner?: boolean;
};

type CommentWithAuthor = ConfessionComment & {
  author?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } | null;
};

function MaskedAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <Avatar className={sizeClasses}>
      <AvatarFallback className="bg-purple-500/20 text-purple-600 dark:text-purple-400">
        <Eye className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
      </AvatarFallback>
    </Avatar>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const Icon = CATEGORIES.find(c => c.value === category)?.icon || MessageSquare;
  const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
  
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </Badge>
  );
}

function ConfessionCard({ 
  confession, 
  onVote, 
  onComment, 
  onDelete, 
  onReport,
  currentUserId 
}: { 
  confession: ConfessionWithMeta;
  onVote: (id: string, type: "like" | "dislike") => void;
  onComment: (id: string) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  currentUserId?: string;
}) {
  const isOwner = confession.authorId === currentUserId;
  const displayName = confession.isAnonymous ? "Anonymous Confessor" : 
    (confession.author ? `${confession.author.firstName} ${confession.author.lastName}` : "Anonymous Confessor");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-zinc-900/50 dark:bg-zinc-900/50 border-zinc-800/50 dark:border-zinc-800/50 overflow-visible">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {confession.isAnonymous ? (
              <MaskedAvatar />
            ) : (
              <Avatar className="h-10 w-10">
                <AvatarImage src={confession.author?.profileImageUrl || undefined} />
                <AvatarFallback className="bg-purple-500/20 text-purple-600">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">
                  {displayName}
                </span>
                <CategoryBadge category={confession.category || "general"} />
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(confession.createdAt!), { addSuffix: true })}
                </span>
                {confession.isTrending && (
                  <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Trending
                  </Badge>
                )}
              </div>
              
              <p className="mt-2 text-foreground whitespace-pre-wrap break-words text-sm leading-relaxed">
                {confession.content}
              </p>

              <div className="flex items-center gap-4 mt-3 pt-2 border-t border-zinc-800/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVote(confession.id, "like")}
                  className={`gap-1.5 text-muted-foreground ${
                    confession.userVote === "like" ? "text-purple-500" : ""
                  }`}
                  data-testid={`button-like-${confession.id}`}
                >
                  <ThumbsUp className={`h-4 w-4 ${confession.userVote === "like" ? "fill-current" : ""}`} />
                  <span>{confession.likesCount || 0}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVote(confession.id, "dislike")}
                  className={`gap-1.5 text-muted-foreground ${
                    confession.userVote === "dislike" ? "text-red-500" : ""
                  }`}
                  data-testid={`button-dislike-${confession.id}`}
                >
                  <ThumbsDown className={`h-4 w-4 ${confession.userVote === "dislike" ? "fill-current" : ""}`} />
                  <span>{confession.dislikesCount || 0}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onComment(confession.id)}
                  className="gap-1.5 text-muted-foreground"
                  data-testid={`button-comment-${confession.id}`}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>{confession.commentsCount || 0}</span>
                </Button>
                
                <div className="ml-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isOwner && (
                        <DropdownMenuItem 
                          onClick={() => onDelete(confession.id)}
                          className="text-destructive"
                          data-testid={`button-delete-${confession.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                      {!isOwner && (
                        <DropdownMenuItem 
                          onClick={() => onReport(confession.id)}
                          data-testid={`button-report-${confession.id}`}
                        >
                          <Flag className="h-4 w-4 mr-2" />
                          Report
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CommentItem({ comment }: { comment: CommentWithAuthor }) {
  const displayName = comment.isAnonymous ? "Anonymous" : 
    (comment.author ? `${comment.author.firstName} ${comment.author.lastName}` : "Anonymous");

  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-800/30 last:border-b-0">
      {comment.isAnonymous ? (
        <MaskedAvatar size="sm" />
      ) : (
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.author?.profileImageUrl || undefined} />
          <AvatarFallback className="bg-purple-500/20 text-purple-600 text-xs">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground">{displayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt!), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-foreground mt-1">{comment.content}</p>
      </div>
    </div>
  );
}

function TrendingSection({ trending }: { trending: Confession[] }) {
  if (!trending || trending.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-5 w-5 text-purple-500" />
        <h3 className="font-semibold text-foreground">Trending Confessions</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
        {trending.slice(0, 5).map((confession) => (
          <Card 
            key={confession.id} 
            className="min-w-[280px] max-w-[280px] bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20"
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <MaskedAvatar size="sm" />
                <CategoryBadge category={confession.category || "general"} />
              </div>
              <p className="text-sm text-foreground line-clamp-2">{confession.content}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  {confession.likesCount || 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {confession.commentsCount || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ConfessionSkeleton() {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-4 w-full mt-2" />
            <Skeleton className="h-4 w-3/4 mt-1" />
            <div className="flex gap-4 mt-3">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConfessionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedConfessionId, setSelectedConfessionId] = useState<string | null>(null);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [commentContent, setCommentContent] = useState("");
  const [isCommentAnonymous, setIsCommentAnonymous] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  const { data: confessionsData, isLoading } = useQuery<{ confessions: ConfessionWithMeta[]; total: number }>({
    queryKey: ["/api/confessions", selectedCategory, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      params.append("page", page.toString());
      params.append("limit", "20");
      const res = await fetch(`/api/confessions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch confessions");
      return res.json();
    },
  });

  const { data: trendingData } = useQuery<Confession[]>({
    queryKey: ["/api/confessions/trending"],
    queryFn: async () => {
      const res = await fetch("/api/confessions/trending?limit=5");
      if (!res.ok) throw new Error("Failed to fetch trending");
      return res.json();
    },
  });

  const { data: selectedConfession, refetch: refetchConfession } = useQuery<ConfessionWithMeta>({
    queryKey: ["/api/confessions", selectedConfessionId],
    queryFn: async () => {
      if (!selectedConfessionId) return null;
      const res = await fetch(`/api/confessions/${selectedConfessionId}`);
      if (!res.ok) throw new Error("Failed to fetch confession");
      return res.json();
    },
    enabled: !!selectedConfessionId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/confessions", {
        content: newContent,
        category: newCategory,
        isAnonymous,
      });
    },
    onSuccess: () => {
      toast({ title: "Confession posted!", description: "Your confession will be visible after moderation." });
      setShowNewDialog(false);
      setNewContent("");
      setNewCategory("general");
      setIsAnonymous(true);
      queryClient.invalidateQueries({ queryKey: ["/api/confessions"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to post confession", variant: "destructive" });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ id, voteType }: { id: string; voteType: "like" | "dislike" }) => {
      return apiRequest("POST", `/api/confessions/${id}/vote`, { voteType });
    },
    onMutate: async ({ id, voteType }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/confessions"] });
      const previousData = queryClient.getQueryData(["/api/confessions", selectedCategory, page]);
      
      queryClient.setQueryData(["/api/confessions", selectedCategory, page], (old: any) => {
        if (!old?.confessions) return old;
        return {
          ...old,
          confessions: old.confessions.map((c: ConfessionWithMeta) => {
            if (c.id !== id) return c;
            const prevVote = c.userVote;
            const newVote = prevVote === voteType ? null : voteType;
            let likesCount = c.likesCount || 0;
            let dislikesCount = c.dislikesCount || 0;
            if (prevVote === "like") likesCount--;
            if (prevVote === "dislike") dislikesCount--;
            if (newVote === "like") likesCount++;
            if (newVote === "dislike") dislikesCount++;
            return { ...c, userVote: newVote, likesCount, dislikesCount };
          }),
        };
      });
      
      return { previousData };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["/api/confessions", selectedCategory, page], context.previousData);
      }
      if (error?.message?.includes("401") || error?.message?.includes("Unauthorized")) {
        toast({ title: "Login Required", description: "Please login to vote on confessions", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to vote", variant: "destructive" });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/confessions"] });
      if (selectedConfessionId) refetchConfession();
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConfessionId) return;
      return apiRequest("POST", `/api/confessions/${selectedConfessionId}/comments`, {
        content: commentContent,
        isAnonymous: isCommentAnonymous,
      });
    },
    onSuccess: () => {
      toast({ title: "Comment added!" });
      setCommentContent("");
      setIsCommentAnonymous(false);
      refetchConfession();
      queryClient.invalidateQueries({ queryKey: ["/api/confessions"] });
    },
    onError: (error: any) => {
      if (error?.message?.includes("401") || error?.message?.includes("Unauthorized")) {
        toast({ title: "Login Required", description: "Please login to add comments", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to add comment", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/confessions/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Confession deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/confessions"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete confession", variant: "destructive" });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConfessionId) return;
      return apiRequest("POST", `/api/confessions/${selectedConfessionId}/report`, {
        reason: reportReason,
        description: reportDescription,
      });
    },
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Thank you for helping keep the community safe." });
      setShowReportDialog(false);
      setReportReason("");
      setReportDescription("");
      setSelectedConfessionId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit report", variant: "destructive" });
    },
  });

  const handleVote = useCallback((id: string, type: "like" | "dislike") => {
    if (!user) {
      toast({ title: "Login Required", description: "Please login to vote on confessions", variant: "destructive" });
      return;
    }
    voteMutation.mutate({ id, voteType: type });
  }, [voteMutation, user, toast]);

  const handleComment = useCallback((id: string) => {
    if (!user) {
      toast({ title: "Login Required", description: "Please login to add comments", variant: "destructive" });
      return;
    }
    setSelectedConfessionId(id);
    setShowCommentDialog(true);
  }, [user, toast]);

  const handleDelete = useCallback((id: string) => {
    if (confirm("Are you sure you want to delete this confession?")) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation]);

  const handleReport = useCallback((id: string) => {
    setSelectedConfessionId(id);
    setShowReportDialog(true);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Eye className="h-6 w-6 text-purple-500" />
              Confessions
            </h1>
            <p className="text-sm text-muted-foreground">Share anonymously with the community</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/secret-messages">
              <Button 
                variant="outline"
                className="border-purple-500/30 text-purple-400"
                data-testid="button-secret-messages"
              >
                <Link2 className="h-4 w-4 mr-1" />
                Secret Links
              </Button>
            </Link>
            <Button 
              onClick={() => {
                if (!user) {
                  toast({ title: "Login Required", description: "Please login to post a confession", variant: "destructive" });
                  return;
                }
                setShowNewDialog(true);
              }} 
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-new-confession"
            >
              <Plus className="h-4 w-4 mr-1" />
              Confess
            </Button>
          </div>
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-4">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-transparent gap-1 p-0">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger
                  key={cat.value}
                  value={cat.value}
                  className="flex-shrink-0 gap-1.5 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
                  data-testid={`tab-${cat.value}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cat.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {selectedCategory === "all" && <TrendingSection trending={trendingData || []} />}

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <ConfessionSkeleton key={i} />)
          ) : confessionsData?.confessions && confessionsData.confessions.length > 0 ? (
            <AnimatePresence>
              {confessionsData.confessions.map((confession) => (
                <ConfessionCard
                  key={confession.id}
                  confession={confession}
                  onVote={handleVote}
                  onComment={handleComment}
                  onDelete={handleDelete}
                  onReport={handleReport}
                  currentUserId={user?.id}
                />
              ))}
            </AnimatePresence>
          ) : (
            <Card className="bg-zinc-900/50 border-zinc-800/50">
              <CardContent className="p-8 text-center">
                <Eye className="h-12 w-12 mx-auto text-purple-500/50 mb-3" />
                <h3 className="font-semibold text-foreground mb-1">No confessions yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Be the first to share something!</p>
                <Button 
                  onClick={() => {
                    if (!user) {
                      toast({ title: "Login Required", description: "Please login to post a confession", variant: "destructive" });
                      return;
                    }
                    setShowNewDialog(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Make a Confession
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {confessionsData && confessionsData.total > 20 && (
          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <span className="flex items-center px-3 text-sm text-muted-foreground">
              Page {page} of {Math.ceil(confessionsData.total / 20)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(confessionsData.total / 20)}
              onClick={() => setPage(p => p + 1)}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        )}

        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-purple-500" />
                New Confession
              </DialogTitle>
              <DialogDescription>
                Share your thoughts with the community. You can choose to be anonymous.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter(c => c.value !== "all").map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <cat.icon className="h-4 w-4" />
                          {cat.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="content">Your Confession</Label>
                <Textarea
                  id="content"
                  placeholder="What's on your mind..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="min-h-[120px] resize-none"
                  maxLength={2000}
                  data-testid="textarea-confession"
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {newContent.length}/2000
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch 
                    id="anonymous" 
                    checked={isAnonymous} 
                    onCheckedChange={setIsAnonymous}
                    data-testid="switch-anonymous"
                  />
                  <Label htmlFor="anonymous" className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    Post Anonymously
                  </Label>
                </div>
              </div>
              {!isAnonymous && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs">Your name and profile will be visible to others</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => createMutation.mutate()}
                disabled={newContent.trim().length < 10 || createMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-submit-confession"
              >
                {createMutation.isPending ? "Posting..." : "Post Confession"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCommentDialog} onOpenChange={(open) => {
          if (!open) {
            setShowCommentDialog(false);
            setSelectedConfessionId(null);
          }
        }}>
          <DialogContent className="sm:max-w-md max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Comments</DialogTitle>
            </DialogHeader>
            {selectedConfession && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                  <p className="text-sm text-foreground line-clamp-3">{selectedConfession.content}</p>
                </div>
                
                <ScrollArea className="h-[200px]">
                  <div className="pr-4">
                    {selectedConfession.comments && selectedConfession.comments.length > 0 ? (
                      selectedConfession.comments.map((comment) => (
                        <CommentItem key={comment.id} comment={comment} />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No comments yet. Be the first!
                      </p>
                    )}
                  </div>
                </ScrollArea>

                <div className="space-y-3 pt-2 border-t">
                  <Textarea
                    placeholder="Add a comment..."
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    className="min-h-[80px] resize-none"
                    maxLength={1000}
                    data-testid="textarea-comment"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch 
                        id="comment-anonymous" 
                        checked={isCommentAnonymous} 
                        onCheckedChange={setIsCommentAnonymous}
                        data-testid="switch-comment-anonymous"
                      />
                      <Label htmlFor="comment-anonymous" className="text-sm">Anonymous</Label>
                    </div>
                    <Button 
                      onClick={() => commentMutation.mutate()}
                      disabled={!commentContent.trim() || commentMutation.isPending}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                      data-testid="button-submit-comment"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {commentMutation.isPending ? "Posting..." : "Comment"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showReportDialog} onOpenChange={(open) => {
          if (!open) {
            setShowReportDialog(false);
            setSelectedConfessionId(null);
            setReportReason("");
            setReportDescription("");
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-destructive" />
                Report Confession
              </DialogTitle>
              <DialogDescription>
                Help us maintain a safe community by reporting inappropriate content.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Reason for Report</Label>
                <Select value={reportReason} onValueChange={setReportReason}>
                  <SelectTrigger data-testid="select-report-reason">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Additional Details (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Provide any additional context..."
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  className="min-h-[80px] resize-none"
                  data-testid="textarea-report-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReportDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => reportMutation.mutate()}
                disabled={!reportReason || reportMutation.isPending}
                data-testid="button-submit-report"
              >
                {reportMutation.isPending ? "Submitting..." : "Submit Report"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

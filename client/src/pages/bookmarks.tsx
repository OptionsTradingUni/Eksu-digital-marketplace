import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark,
  BookmarkX,
  Repeat2,
  Share,
  Play,
  BadgeCheck,
  Store,
  Trash2,
  ArrowLeft
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import type { User, SocialPost, PostBookmark } from "@shared/schema";

type BookmarkWithPost = PostBookmark & { 
  post: SocialPost; 
  author: User;
};

type Comment = {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
  author: User;
};

function formatEngagement(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return count.toString();
}

function MediaGrid({ images, videos }: { images?: string[] | null; videos?: string[] | null }) {
  const allMedia = [
    ...(images || []).map(url => ({ url, type: 'image' as const })),
    ...(videos || []).map(url => ({ url, type: 'video' as const }))
  ];

  if (allMedia.length === 0) return null;

  const getGridClasses = () => {
    switch (allMedia.length) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-2";
      case 3:
        return "grid-cols-2";
      case 4:
        return "grid-cols-2";
      default:
        return "grid-cols-2";
    }
  };

  const getItemClasses = (index: number, total: number) => {
    if (total === 1) return "aspect-video";
    if (total === 2) return "aspect-square";
    if (total === 3) {
      if (index === 0) return "row-span-2 aspect-[2/3]";
      return "aspect-square";
    }
    if (total >= 4) return "aspect-square";
    return "aspect-square";
  };

  return (
    <div className={`grid ${getGridClasses()} gap-0.5 rounded-xl overflow-hidden`}>
      {allMedia.slice(0, 4).map((media, idx) => {
        const isMoreThanFour = allMedia.length > 4 && idx === 3;
        
        return (
          <div 
            key={idx} 
            className={`relative ${getItemClasses(idx, allMedia.length)} overflow-hidden bg-muted`}
          >
            {media.type === 'video' ? (
              <div className="relative w-full h-full group">
                <video
                  src={media.url}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="h-6 w-6 text-black fill-black ml-0.5" />
                  </div>
                </div>
              </div>
            ) : (
              <img
                src={media.url}
                alt={`Media ${idx + 1}`}
                className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                loading="lazy"
              />
            )}
            {isMoreThanFour && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-xl font-semibold">+{allMedia.length - 4}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VerifiedBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className="relative inline-flex">
      <BadgeCheck className={`${sizeClasses} text-primary fill-primary/10`} />
    </div>
  );
}

function SellerBadge() {
  return (
    <Badge 
      variant="outline" 
      className="text-[10px] px-1.5 py-0 h-4 border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium gap-0.5"
    >
      <Store className="h-2.5 w-2.5" />
      Seller
    </Badge>
  );
}

function EKSUPlugBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className="relative inline-flex">
      <BadgeCheck className={`${sizeClasses} text-amber-500 fill-amber-500/20`} />
    </div>
  );
}

function isEKSUPlugAccount(author: User): boolean {
  return author?.isSystemAccount === true && author?.systemAccountType === 'eksuplug';
}

export default function BookmarksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [repostedPosts, setRepostedPosts] = useState<Set<string>>(new Set());

  const { data: bookmarks, isLoading } = useQuery<BookmarkWithPost[]>({
    queryKey: ["/api/users/me/bookmarks"],
  });

  const { data: comments } = useQuery<Comment[]>({
    queryKey: ["/api/social-posts", expandedComments, "comments"],
    enabled: !!expandedComments,
  });

  const unbookmarkMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiRequest("POST", `/api/social-posts/${postId}/bookmark`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Removed from bookmarks" });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
    onError: () => {
      toast({ title: "Failed to remove bookmark", variant: "destructive" });
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiRequest("POST", `/api/social-posts/${postId}/like`);
      return response.json();
    },
    onMutate: (postId) => {
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(postId)) {
          newSet.delete(postId);
        } else {
          newSet.add(postId);
        }
        return newSet;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/bookmarks"] });
    },
  });

  const repostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiRequest("POST", `/api/social-posts/${postId}/repost`);
      return response.json();
    },
    onMutate: (postId) => {
      setRepostedPosts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(postId)) {
          newSet.delete(postId);
        } else {
          newSet.add(postId);
        }
        return newSet;
      });
    },
    onSuccess: (data) => {
      if (data.action === "reposted") {
        toast({ title: "Reposted!" });
      } else {
        toast({ title: "Removed repost" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/bookmarks"] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const response = await apiRequest("POST", `/api/social-posts/${postId}/comments`, { content });
      return response.json();
    },
    onSuccess: (_, variables) => {
      setCommentText((prev) => ({ ...prev, [variables.postId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts", variables.postId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/bookmarks"] });
    },
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "U";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-xl">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <Link href="/the-plug">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bookmark className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Bookmarks</h1>
              <p className="text-xs text-muted-foreground">
                {bookmarks?.length || 0} saved posts
              </p>
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="space-y-0 divide-y">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="py-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-16 w-full" />
                    <div className="flex gap-6">
                      <Skeleton className="h-8 w-14" />
                      <Skeleton className="h-8 w-14" />
                      <Skeleton className="h-8 w-14" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : bookmarks && bookmarks.length > 0 ? (
          <motion.div 
            className="divide-y"
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.05
                }
              }
            }}
          >
            {bookmarks.map((bookmark) => {
              const post = bookmark.post;
              const author = bookmark.author;
              
              return (
                <motion.article
                  key={bookmark.id}
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1 }
                  }}
                  transition={{ duration: 0.2 }}
                  className="py-4"
                  data-testid={`bookmark-card-${bookmark.id}`}
                >
                  <div className="flex gap-3">
                    <Link href={`/profile/${post.authorId}`}>
                      <Avatar className="h-10 w-10 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity">
                        <AvatarImage src={author?.profileImageUrl || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                          {getInitials(author?.firstName, author?.lastName)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1 flex-wrap min-w-0">
                          <Link href={`/profile/${post.authorId}`}>
                            <span className={`font-bold text-sm hover:underline cursor-pointer truncate ${isEKSUPlugAccount(author) ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                              {author?.firstName} {author?.lastName}
                            </span>
                          </Link>
                          {isEKSUPlugAccount(author) ? (
                            <EKSUPlugBadge />
                          ) : author?.isVerified ? (
                            <VerifiedBadge />
                          ) : null}
                          {author?.role === "seller" && !isEKSUPlugAccount(author) && (
                            <SellerBadge />
                          )}
                          <span className="text-muted-foreground text-sm">·</span>
                          <span className="text-muted-foreground text-sm">
                            {post.createdAt && formatDistanceToNow(new Date(post.createdAt), { addSuffix: false })}
                          </span>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => unbookmarkMutation.mutate(post.id)}
                          disabled={unbookmarkMutation.isPending}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-full flex-shrink-0"
                          data-testid={`button-unbookmark-${post.id}`}
                        >
                          <BookmarkX className="h-4 w-4" />
                        </Button>
                      </div>

                      {post.content && (
                        <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap mt-1 mb-3">
                          {post.content}
                        </p>
                      )}

                      {((post.images && post.images.length > 0) || (post.videos && post.videos.length > 0)) && (
                        <div className="mt-3 mb-3">
                          <MediaGrid images={post.images} videos={post.videos} />
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3 -ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedComments(expandedComments === post.id ? null : post.id)}
                          className="h-8 px-2 gap-1 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 group"
                          data-testid={`button-comments-${post.id}`}
                        >
                          <MessageCircle className="h-[18px] w-[18px] group-hover:text-primary" />
                          <span className="text-sm tabular-nums">{formatEngagement(post.commentsCount || 0)}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => repostMutation.mutate(post.id)}
                          disabled={repostMutation.isPending}
                          className={`h-8 px-2 gap-1 rounded-full group ${
                            repostedPosts.has(post.id)
                              ? "text-green-500"
                              : "text-muted-foreground hover:text-green-500 hover:bg-green-500/10"
                          }`}
                          data-testid={`button-repost-${post.id}`}
                        >
                          <Repeat2 className={`h-[18px] w-[18px] ${repostedPosts.has(post.id) ? "text-green-500" : "group-hover:text-green-500"}`} />
                          <span className="text-sm tabular-nums">{formatEngagement(post.repostsCount || 0)}</span>
                        </Button>

                        <motion.div whileTap={{ scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => likeMutation.mutate(post.id)}
                            className={`h-8 px-2 gap-1 rounded-full group ${
                              likedPosts.has(post.id) 
                                ? "text-red-500" 
                                : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            }`}
                            data-testid={`button-like-${post.id}`}
                          >
                            <motion.div
                              animate={likedPosts.has(post.id) ? { scale: [1, 1.2, 1] } : {}}
                              transition={{ duration: 0.2 }}
                            >
                              <Heart className={`h-[18px] w-[18px] ${likedPosts.has(post.id) ? "fill-current" : "group-hover:text-red-500"}`} />
                            </motion.div>
                            <span className="text-sm tabular-nums">{formatEngagement(post.likesCount || 0)}</span>
                          </Button>
                        </motion.div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unbookmarkMutation.mutate(post.id)}
                          disabled={unbookmarkMutation.isPending}
                          className="h-8 px-2 gap-1 rounded-full group text-primary"
                          data-testid={`button-bookmark-action-${post.id}`}
                        >
                          <Bookmark className="h-[18px] w-[18px] fill-current" />
                        </Button>
                      </div>

                      <AnimatePresence>
                        {expandedComments === post.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <Separator className="my-3" />
                            <div className="space-y-3">
                              {comments?.map((comment) => (
                                <motion.div 
                                  key={comment.id} 
                                  className="flex gap-2"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                >
                                  <Avatar className="h-8 w-8 flex-shrink-0">
                                    <AvatarImage src={comment.author?.profileImageUrl || undefined} />
                                    <AvatarFallback className="text-[10px] bg-muted">
                                      {getInitials(comment.author?.firstName, comment.author?.lastName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <div className="bg-muted/50 rounded-2xl rounded-tl-md px-3 py-2">
                                      <div className="flex items-center gap-1">
                                        <span className="font-semibold text-xs">
                                          {comment.author?.firstName} {comment.author?.lastName}
                                        </span>
                                        {comment.author?.isVerified && <VerifiedBadge size="sm" />}
                                        <span className="text-muted-foreground text-xs">·</span>
                                        <span className="text-muted-foreground text-xs">
                                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: false })}
                                        </span>
                                      </div>
                                      <p className="text-sm text-foreground/90 mt-0.5">{comment.content}</p>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                              
                              <div className="flex gap-2 items-center pt-1">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarImage src={user?.profileImageUrl || undefined} />
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                    {getInitials(user?.firstName, user?.lastName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 flex gap-2">
                                  <Input
                                    placeholder="Post your reply"
                                    value={commentText[post.id] || ""}
                                    onChange={(e) => setCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && commentText[post.id]?.trim()) {
                                        commentMutation.mutate({ postId: post.id, content: commentText[post.id] });
                                      }
                                    }}
                                    className="h-9 text-sm rounded-full bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
                                    data-testid={`input-comment-${post.id}`}
                                  />
                                  <Button
                                    size="icon"
                                    onClick={() => {
                                      if (commentText[post.id]?.trim()) {
                                        commentMutation.mutate({ postId: post.id, content: commentText[post.id] });
                                      }
                                    }}
                                    disabled={!commentText[post.id]?.trim() || commentMutation.isPending}
                                    className="h-9 w-9 rounded-full flex-shrink-0"
                                    data-testid={`button-send-comment-${post.id}`}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="py-16 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
            >
              <Bookmark className="h-8 w-8 text-primary" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">No saved posts yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
              When you bookmark posts, they'll show up here for easy access later.
            </p>
            <Link href="/the-plug">
              <Button data-testid="button-browse-plug">
                Browse The Plug
              </Button>
            </Link>
          </motion.div>
        )}

        <div className="h-24 md:h-8" />
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SponsoredAdCard } from "@/components/SponsoredAdCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Image as ImageIcon, 
  X, 
  UserPlus,
  UserCheck,
  Users,
  Compass,
  Zap,
  Trash2,
  Store,
  Sparkles,
  Repeat2,
  Share,
  MoreHorizontal,
  Play,
  Video,
  BadgeCheck,
  Plus,
  Link2,
  Bookmark
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import type { User, SocialPost, SponsoredAd } from "@shared/schema";

type PostWithAuthor = SocialPost & { 
  author: User; 
  isLiked?: boolean;
  isFollowingAuthor?: boolean;
  isReposted?: boolean;
  isBookmarked?: boolean;
  engagementScore?: string;
  viewsCount?: number;
  sharesCount?: number;
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

export default function ThePlugPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("for_you");
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [repostedPosts, setRepostedPosts] = useState<Set<string>>(new Set());
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());
  const [optimisticFollows, setOptimisticFollows] = useState<Map<string, boolean>>(new Map());
  const [showMobileComposer, setShowMobileComposer] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePost, setSharePost] = useState<PostWithAuthor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewedPostsRef = useRef<Set<string>>(new Set());

  const { data: posts, isLoading } = useQuery<PostWithAuthor[]>({
    queryKey: ["/api/feed", { type: activeTab }],
  });

  const { data: sponsoredAds = [] } = useQuery<SponsoredAd[]>({
    queryKey: ["/api/ads/active", { type: "plug" }],
  });

  const { data: comments } = useQuery<Comment[]>({
    queryKey: ["/api/social-posts", expandedComments, "comments"],
    enabled: !!expandedComments,
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: { content: string; media: File[] }) => {
      const formData = new FormData();
      formData.append("content", data.content);
      data.media.forEach((file) => {
        formData.append("media", file);
      });
      const response = await fetch("/api/social-posts", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create post");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Post created!" });
      setNewPostContent("");
      setSelectedMedia([]);
      setMediaPreviews([]);
      setShowMobileComposer(false);
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
    onError: () => {
      toast({ title: "Failed to create post", variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiRequest("DELETE", `/api/social-posts/${postId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Post deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const followMutation = useMutation({
    mutationFn: async ({ userId, isCurrentlyFollowing }: { userId: string; isCurrentlyFollowing: boolean }) => {
      if (isCurrentlyFollowing) {
        await apiRequest("DELETE", `/api/users/${userId}/follow`);
        return { action: "unfollowed", userId };
      } else {
        await apiRequest("POST", `/api/users/${userId}/follow`);
        return { action: "followed", userId };
      }
    },
    onMutate: ({ userId, isCurrentlyFollowing }) => {
      setOptimisticFollows(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, !isCurrentlyFollowing);
        return newMap;
      });
    },
    onSuccess: (data) => {
      if (data.action === "followed") {
        toast({ title: "Following!" });
      } else {
        toast({ title: "Unfollowed" });
      }
      setOptimisticFollows(new Map());
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
    onError: (error: any, { userId }) => {
      setOptimisticFollows(prev => {
        const newMap = new Map(prev);
        newMap.delete(userId);
        return newMap;
      });
      toast({ title: error.message || "Failed to update follow status", variant: "destructive" });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiRequest("POST", `/api/social-posts/${postId}/bookmark`);
      return response.json();
    },
    onMutate: (postId) => {
      setBookmarkedPosts(prev => {
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
      if (data.action === "bookmarked") {
        toast({ title: "Added to bookmarks" });
      } else {
        toast({ title: "Removed from bookmarks" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const trackViewMutation = useMutation({
    mutationFn: async (postId: string) => {
      await apiRequest("POST", `/api/social-posts/${postId}/view`);
    },
  });

  const trackShareMutation = useMutation({
    mutationFn: async (postId: string) => {
      await apiRequest("POST", `/api/social-posts/${postId}/share`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedMedia.length > 10) {
      toast({ title: "Maximum 10 media files allowed", variant: "destructive" });
      return;
    }
    setSelectedMedia((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const isVideo = file.type.startsWith('video/');
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreviews((prev) => [...prev, { 
          url: reader.result as string, 
          type: isVideo ? 'video' : 'image' 
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeMedia = (index: number) => {
    setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = () => {
    if (!newPostContent.trim() && selectedMedia.length === 0) {
      toast({ title: "Please add some content", variant: "destructive" });
      return;
    }
    createPostMutation.mutate({ content: newPostContent, media: selectedMedia });
  };

  const handleShare = (post: PostWithAuthor) => {
    trackShareMutation.mutate(post.id);
    setSharePost(post);
    setShareDialogOpen(true);
  };

  const copyPostLink = () => {
    if (sharePost) {
      navigator.clipboard.writeText(`${window.location.origin}/the-plug?post=${sharePost.id}`);
      toast({ title: "Link copied to clipboard" });
      setShareDialogOpen(false);
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "U";
  };

  const isPostLiked = (post: PostWithAuthor) => {
    return likedPosts.has(post.id) || post.isLiked;
  };

  const isPostReposted = (post: PostWithAuthor) => {
    return repostedPosts.has(post.id) || post.isReposted;
  };

  const isPostBookmarked = (post: PostWithAuthor) => {
    return bookmarkedPosts.has(post.id) || post.isBookmarked;
  };

  const trackPostView = useCallback((postId: string) => {
    if (!viewedPostsRef.current.has(postId)) {
      viewedPostsRef.current.add(postId);
      trackViewMutation.mutate(postId);
    }
  }, [trackViewMutation]);

  const isUserFollowed = (authorId: string, post: PostWithAuthor) => {
    if (optimisticFollows.has(authorId)) {
      return optimisticFollows.get(authorId);
    }
    return post.isFollowingAuthor || false;
  };

  const PostComposer = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex gap-3">
      <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm flex-shrink-0">
        <AvatarImage src={user?.profileImageUrl || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {getInitials(user?.firstName, user?.lastName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-3">
        <Textarea
          placeholder="What's happening on campus?"
          value={newPostContent}
          onChange={(e) => setNewPostContent(e.target.value)}
          className="resize-none border-0 bg-transparent focus-visible:ring-0 text-base min-h-[80px] placeholder:text-muted-foreground/60"
          rows={3}
          data-testid="input-new-post"
        />
        
        <AnimatePresence>
          {mediaPreviews.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 flex-wrap"
            >
              {mediaPreviews.map((preview, index) => (
                <motion.div 
                  key={index} 
                  className="relative group"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <div className="h-20 w-20 rounded-lg overflow-hidden ring-1 ring-border">
                    {preview.type === 'video' ? (
                      <div className="h-full w-full bg-muted flex items-center justify-center relative">
                        <video src={preview.url} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="h-6 w-6 text-white fill-white" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={preview.url}
                        alt={`Preview ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeMedia(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <Separator className="my-2" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleMediaUpload}
              data-testid="input-post-media"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Video className="h-5 w-5" />
            </Button>
          </div>
          <Button
            onClick={handleCreatePost}
            disabled={createPostMutation.isPending || (!newPostContent.trim() && selectedMedia.length === 0)}
            className="rounded-full px-5 font-semibold"
            data-testid="button-create-post"
          >
            {createPostMutation.isPending ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Send className="h-4 w-4" />
              </motion.div>
            ) : (
              "Post"
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-xl">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <Sparkles className="h-3 w-3 text-primary absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">The Plug</h1>
              <p className="text-xs text-muted-foreground">Campus Social Feed</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden md:block"
        >
          <Card className="mb-6 overflow-hidden border-b">
            <CardContent className="p-4">
              <PostComposer />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="w-full h-12 p-0 bg-transparent border-b rounded-none">
              <TabsTrigger 
                value="for_you" 
                className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent transition-all"
                data-testid="tab-for-you"
              >
                <Compass className="h-4 w-4 mr-2" />
                <span className="font-semibold">For You</span>
              </TabsTrigger>
              <TabsTrigger 
                value="following" 
                className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent transition-all"
                data-testid="tab-following"
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="font-semibold">Following</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {isLoading ? (
          <div className="space-y-0 divide-y">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="py-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-3">
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
        ) : posts && posts.length > 0 ? (
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
            {posts.map((post, index) => {
              const adIndex = Math.floor(index / 5);
              const showAd = index > 0 && index % 5 === 0 && sponsoredAds[adIndex - 1];
              
              return (
                <>
                  {showAd && (
                    <SponsoredAdCard 
                      key={`ad-${sponsoredAds[adIndex - 1].id}`} 
                      ad={sponsoredAds[adIndex - 1]} 
                      variant="plug"
                    />
                  )}
                  <motion.article
                key={post.id}
                ref={(el) => {
                  if (el && !viewedPostsRef.current.has(post.id)) {
                    const observer = new IntersectionObserver(
                      (entries) => {
                        entries.forEach((entry) => {
                          if (entry.isIntersecting) {
                            trackPostView(post.id);
                            observer.disconnect();
                          }
                        });
                      },
                      { threshold: 0.5 }
                    );
                    observer.observe(el);
                  }
                }}
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1 }
                }}
                transition={{ duration: 0.2 }}
                className="py-4"
                data-testid={`post-card-${post.id}`}
              >
                <div className="flex gap-3">
                  <Link href={`/profile/${post.authorId}`}>
                    <Avatar className="h-10 w-10 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity">
                      <AvatarImage src={post.author?.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                        {getInitials(post.author?.firstName, post.author?.lastName)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        <Link href={`/profile/${post.authorId}`}>
                          <span className={`font-bold text-sm hover:underline cursor-pointer truncate ${isEKSUPlugAccount(post.author) ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                            {post.author?.firstName} {post.author?.lastName}
                          </span>
                        </Link>
                        {isEKSUPlugAccount(post.author) ? (
                          <EKSUPlugBadge />
                        ) : post.author?.isVerified ? (
                          <VerifiedBadge />
                        ) : null}
                        {(post.author?.role === "seller" || post.author?.role === "both") && !isEKSUPlugAccount(post.author) && (
                          <SellerBadge />
                        )}
                        <span className="text-muted-foreground text-sm">·</span>
                        <span className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(post.createdAt!), { addSuffix: false })}
                        </span>
                        {(post.viewsCount ?? 0) > 0 && (
                          <>
                            <span className="text-muted-foreground text-sm">·</span>
                            <span className="text-muted-foreground text-sm">
                              {formatEngagement(post.viewsCount || 0)} views
                            </span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {post.authorId !== user?.id && (
                          <Button
                            variant={isUserFollowed(post.authorId, post) ? "outline" : "default"}
                            size="sm"
                            onClick={() => {
                              const currentlyFollowing = isUserFollowed(post.authorId, post);
                              followMutation.mutate({ userId: post.authorId, isCurrentlyFollowing: currentlyFollowing || false });
                            }}
                            disabled={followMutation.isPending}
                            className="h-7 rounded-full text-xs font-semibold px-3"
                            data-testid={`button-follow-${post.authorId}`}
                          >
                            {isUserFollowed(post.authorId, post) ? "Following" : "Follow"}
                          </Button>
                        )}
                        {post.authorId === user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePostMutation.mutate(post.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-full"
                            data-testid={`button-delete-${post.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
                          isPostReposted(post)
                            ? "text-green-500"
                            : "text-muted-foreground hover:text-green-500 hover:bg-green-500/10"
                        }`}
                        data-testid={`button-repost-${post.id}`}
                      >
                        <Repeat2 className={`h-[18px] w-[18px] ${isPostReposted(post) ? "text-green-500" : "group-hover:text-green-500"}`} />
                        <span className="text-sm tabular-nums">{formatEngagement(post.repostsCount || 0)}</span>
                      </Button>

                      <motion.div whileTap={{ scale: 0.9 }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => likeMutation.mutate(post.id)}
                          className={`h-8 px-2 gap-1 rounded-full group ${
                            isPostLiked(post) 
                              ? "text-red-500" 
                              : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          }`}
                          data-testid={`button-like-${post.id}`}
                        >
                          <motion.div
                            animate={isPostLiked(post) ? { scale: [1, 1.2, 1] } : {}}
                            transition={{ duration: 0.2 }}
                          >
                            <Heart className={`h-[18px] w-[18px] ${isPostLiked(post) ? "fill-current" : "group-hover:text-red-500"}`} />
                          </motion.div>
                          <span className="text-sm tabular-nums">{formatEngagement(post.likesCount || 0)}</span>
                        </Button>
                      </motion.div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => bookmarkMutation.mutate(post.id)}
                        disabled={bookmarkMutation.isPending}
                        className={`h-8 px-2 gap-1 rounded-full group ${
                          isPostBookmarked(post)
                            ? "text-primary"
                            : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                        }`}
                        data-testid={`button-bookmark-${post.id}`}
                      >
                        <Bookmark className={`h-[18px] w-[18px] ${isPostBookmarked(post) ? "fill-current" : "group-hover:text-primary"}`} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShare(post)}
                        className="h-8 px-2 gap-1 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 group"
                        data-testid={`button-share-${post.id}`}
                      >
                        <Share className="h-[18px] w-[18px] group-hover:text-primary" />
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
                </>
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
              <Zap className="h-8 w-8 text-primary" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">
              {activeTab === "following" ? "No posts from people you follow" : "No posts yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {activeTab === "following"
                ? "Follow more people to see their posts here"
                : "Be the first to share what's happening on campus!"}
            </p>
          </motion.div>
        )}

        <div className="h-24 md:h-8" />
      </div>

      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        onClick={() => setShowMobileComposer(true)}
        className="fixed bottom-24 right-4 md:hidden h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-50"
        data-testid="button-mobile-compose"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      <Dialog open={showMobileComposer} onOpenChange={setShowMobileComposer}>
        <DialogContent className="sm:max-w-[500px] p-0">
          <DialogHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold">New Post</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-4">
            <PostComposer isMobile />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Share Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12"
              onClick={copyPostLink}
            >
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                <Link2 className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="font-medium">Copy link</div>
                <div className="text-xs text-muted-foreground">Copy post link to clipboard</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

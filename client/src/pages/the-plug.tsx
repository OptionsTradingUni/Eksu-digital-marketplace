import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SponsoredAdCard } from "@/components/SponsoredAdCard";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Image as ImageIcon, 
  X, 
  Users,
  Compass,
  Zap,
  Trash2,
  Store,
  Sparkles,
  Repeat2,
  Share,
  Play,
  Video,
  BadgeCheck,
  Plus,
  Link2,
  Bookmark,
  BookmarkCheck,
  FileText,
  ChevronDown
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link, useLocation, useSearch } from "wouter";
import type { User, SocialPost, SponsoredAd } from "@shared/schema";
import { StoriesBar } from "./stories";

const MAX_CHAR_COUNT = 280;
const DRAFTS_STORAGE_KEY = "plug_drafts";

type Draft = {
  id: string;
  content: string;
  createdAt: string;
};

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

function getDrafts(): Draft[] {
  try {
    const drafts = localStorage.getItem(DRAFTS_STORAGE_KEY);
    return drafts ? JSON.parse(drafts) : [];
  } catch {
    return [];
  }
}

function saveDraft(content: string): void {
  const drafts = getDrafts();
  const newDraft: Draft = {
    id: Date.now().toString(),
    content,
    createdAt: new Date().toISOString(),
  };
  drafts.unshift(newDraft);
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts.slice(0, 10)));
}

function deleteDraft(id: string): void {
  const drafts = getDrafts().filter(d => d.id !== id);
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
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

function getUsername(author: User): string {
  if (author?.username) return author.username;
  const firstName = author?.firstName?.toLowerCase() || '';
  const lastName = author?.lastName?.toLowerCase() || '';
  return `${firstName}${lastName}`.replace(/\s+/g, '') || 'user';
}

export default function ThePlugPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  
  const initialTab = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get("tab");
    if (tab === "bookmarks") return "bookmarks";
    if (tab === "following") return "following";
    return "for_you";
  }, [searchString]);
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [repostedPosts, setRepostedPosts] = useState<Set<string>>(new Set());
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());
  const [optimisticFollows, setOptimisticFollows] = useState<Map<string, boolean>>(new Map());
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePost, setSharePost] = useState<PostWithAuthor | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewedPostsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setDrafts(getDrafts());
  }, []);

  useEffect(() => {
    if (showComposeModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [showComposeModal]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    if (newTab === "for_you") {
      setLocation("/the-plug");
    } else {
      setLocation(`/the-plug?tab=${newTab}`);
    }
  };

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
      setShowComposeModal(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/users", data.userId, "follow-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", data.userId, "followers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "following"] });
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
    if (newPostContent.length > MAX_CHAR_COUNT) {
      toast({ title: `Post exceeds ${MAX_CHAR_COUNT} characters`, variant: "destructive" });
      return;
    }
    createPostMutation.mutate({ content: newPostContent, media: selectedMedia });
  };

  const handleSaveDraft = () => {
    if (newPostContent.trim()) {
      saveDraft(newPostContent);
      setDrafts(getDrafts());
      toast({ title: "Draft saved" });
      setNewPostContent("");
      setSelectedMedia([]);
      setMediaPreviews([]);
      setShowComposeModal(false);
    }
  };

  const handleLoadDraft = (draft: Draft) => {
    setNewPostContent(draft.content);
    deleteDraft(draft.id);
    setDrafts(getDrafts());
    setShowDrafts(false);
    toast({ title: "Draft loaded" });
  };

  const handleDeleteDraft = (id: string) => {
    deleteDraft(id);
    setDrafts(getDrafts());
    toast({ title: "Draft deleted" });
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

  const charCount = newPostContent.length;
  const isOverLimit = charCount > MAX_CHAR_COUNT;
  const charCountColor = isOverLimit ? "text-destructive" : charCount > MAX_CHAR_COUNT - 20 ? "text-amber-500" : "text-muted-foreground";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-0 sm:px-4 max-w-xl">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-4 py-4"
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
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="border-b"
        >
          <StoriesBar />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={handleTabChange}>
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
              <TabsTrigger 
                value="bookmarks" 
                className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent transition-all"
                data-testid="tab-bookmarks"
              >
                <BookmarkCheck className="h-4 w-4 mr-2" />
                <span className="font-semibold">Saved</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {isLoading ? (
          <div className="divide-y divide-border">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-16 w-full" />
                    <div className="flex gap-8 pt-2">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <motion.div 
            className="divide-y divide-border"
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.03
                }
              }
            }}
          >
            {posts.map((post, index) => {
              const adIndex = Math.floor(index / 5);
              const showAd = index > 0 && index % 5 === 0 && sponsoredAds[adIndex - 1];
              
              return (
                <div key={post.id}>
                  {showAd && (
                    <SponsoredAdCard 
                      key={`ad-${sponsoredAds[adIndex - 1].id}`} 
                      ad={sponsoredAds[adIndex - 1]} 
                      variant="plug"
                    />
                  )}
                  <motion.article
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
                    transition={{ duration: 0.15 }}
                    className="px-4 py-3 hover:bg-muted/30 transition-colors"
                    data-testid={`post-card-${post.id}`}
                  >
                    <div className="flex gap-3">
                      <Link href={`/profile/${post.authorId}`}>
                        <Avatar className="h-10 w-10 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                          <AvatarImage src={post.author?.profileImageUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                            {getInitials(post.author?.firstName, post.author?.lastName)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <Link href={`/profile/${post.authorId}`}>
                            <span className={`font-bold text-[15px] hover:underline cursor-pointer ${isEKSUPlugAccount(post.author) ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                              {post.author?.firstName} {post.author?.lastName}
                            </span>
                          </Link>
                          {isEKSUPlugAccount(post.author) ? (
                            <EKSUPlugBadge />
                          ) : post.author?.isVerified ? (
                            <VerifiedBadge />
                          ) : null}
                          {post.author?.role === "seller" && !isEKSUPlugAccount(post.author) && (
                            <SellerBadge />
                          )}
                          <span className="text-muted-foreground text-[15px]">@{getUsername(post.author)}</span>
                          <span className="text-muted-foreground text-[15px]">·</span>
                          <span className="text-muted-foreground text-[15px]">
                            {formatDistanceToNow(new Date(post.createdAt!), { addSuffix: false })}
                          </span>
                          {post.authorId !== user?.id && !isUserFollowed(post.authorId, post) && (
                            <>
                              <span className="text-muted-foreground text-[15px]">·</span>
                              <button
                                onClick={() => {
                                  followMutation.mutate({ userId: post.authorId, isCurrentlyFollowing: false });
                                }}
                                disabled={followMutation.isPending}
                                className="text-primary font-bold text-[15px] hover:underline"
                                data-testid={`button-follow-${post.authorId}`}
                              >
                                Follow
                              </button>
                            </>
                          )}
                          {post.authorId === user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deletePostMutation.mutate(post.id)}
                              className="h-6 w-6 ml-auto text-muted-foreground hover:text-destructive rounded-full"
                              data-testid={`button-delete-${post.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        {post.content && (
                          <p className="text-[15px] leading-normal text-foreground whitespace-pre-wrap mt-0.5">
                            {post.content}
                          </p>
                        )}

                        {((post.images && post.images.length > 0) || (post.videos && post.videos.length > 0)) && (
                          <div className="mt-3">
                            <MediaGrid images={post.images} videos={post.videos} />
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 max-w-md">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedComments(expandedComments === post.id ? null : post.id)}
                            className="h-8 px-0 gap-1.5 text-muted-foreground hover:text-primary hover:bg-transparent group"
                            data-testid={`button-comments-${post.id}`}
                          >
                            <MessageCircle className="h-[18px] w-[18px]" />
                            <span className="text-[13px] tabular-nums">{formatEngagement(post.commentsCount || 0)}</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => repostMutation.mutate(post.id)}
                            disabled={repostMutation.isPending}
                            className={`h-8 px-0 gap-1.5 hover:bg-transparent group ${
                              isPostReposted(post)
                                ? "text-green-500"
                                : "text-muted-foreground hover:text-green-500"
                            }`}
                            data-testid={`button-repost-${post.id}`}
                          >
                            <Repeat2 className="h-[18px] w-[18px]" />
                            <span className="text-[13px] tabular-nums">{formatEngagement(post.repostsCount || 0)}</span>
                          </Button>

                          <motion.div whileTap={{ scale: 0.9 }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => likeMutation.mutate(post.id)}
                              className={`h-8 px-0 gap-1.5 hover:bg-transparent group ${
                                isPostLiked(post) 
                                  ? "text-red-500" 
                                  : "text-muted-foreground hover:text-red-500"
                              }`}
                              data-testid={`button-like-${post.id}`}
                            >
                              <motion.div
                                animate={isPostLiked(post) ? { scale: [1, 1.2, 1] } : {}}
                                transition={{ duration: 0.2 }}
                              >
                                <Heart className={`h-[18px] w-[18px] ${isPostLiked(post) ? "fill-current" : ""}`} />
                              </motion.div>
                              <span className="text-[13px] tabular-nums">{formatEngagement(post.likesCount || 0)}</span>
                            </Button>
                          </motion.div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => bookmarkMutation.mutate(post.id)}
                            disabled={bookmarkMutation.isPending}
                            className={`h-8 px-0 gap-1.5 hover:bg-transparent group ${
                              isPostBookmarked(post)
                                ? "text-primary"
                                : "text-muted-foreground hover:text-primary"
                            }`}
                            data-testid={`button-bookmark-${post.id}`}
                          >
                            <Bookmark className={`h-[18px] w-[18px] ${isPostBookmarked(post) ? "fill-current" : ""}`} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShare(post)}
                            className="h-8 px-0 gap-1.5 text-muted-foreground hover:text-primary hover:bg-transparent group"
                            data-testid={`button-share-${post.id}`}
                          >
                            <Share className="h-[18px] w-[18px]" />
                          </Button>

                          {(post.viewsCount ?? 0) > 0 && (
                            <span className="text-[13px] text-muted-foreground tabular-nums">
                              {formatEngagement(post.viewsCount || 0)} views
                            </span>
                          )}
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
                              <div className="pt-3 mt-3 border-t space-y-3">
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
                </div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="py-16 text-center px-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
            >
              {activeTab === "bookmarks" ? (
                <BookmarkCheck className="h-8 w-8 text-primary" />
              ) : (
                <Zap className="h-8 w-8 text-primary" />
              )}
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">
              {activeTab === "bookmarks" 
                ? "No saved posts yet" 
                : activeTab === "following" 
                  ? "No posts from people you follow" 
                  : "No posts yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {activeTab === "bookmarks"
                ? "Save posts by tapping the bookmark icon to view them here later"
                : activeTab === "following"
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
        onClick={() => setShowComposeModal(true)}
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-50 hover:bg-primary/90 transition-colors"
        data-testid="button-floating-compose"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      <AnimatePresence>
        {showComposeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background md:bg-black/50 md:flex md:items-start md:justify-center md:pt-12"
            data-testid="dialog-compose-post"
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="h-full w-full md:h-auto md:max-h-[90vh] md:w-[600px] md:rounded-xl bg-background flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (newPostContent.trim()) {
                      handleSaveDraft();
                    } else {
                      setShowComposeModal(false);
                    }
                  }}
                  data-testid="button-close-composer"
                >
                  <X className="h-5 w-5" />
                </Button>
                
                <div className="flex items-center gap-2">
                  {drafts.length > 0 && (
                    <DropdownMenu open={showDrafts} onOpenChange={setShowDrafts}>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="gap-1"
                          data-testid="button-load-drafts"
                        >
                          <FileText className="h-4 w-4" />
                          Drafts ({drafts.length})
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-72">
                        {drafts.map((draft) => (
                          <DropdownMenuItem
                            key={draft.id}
                            className="flex items-start gap-2 py-3"
                            onClick={() => handleLoadDraft(draft)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{draft.content}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDraft(draft.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  
                  <Button
                    onClick={handleCreatePost}
                    disabled={createPostMutation.isPending || (!newPostContent.trim() && selectedMedia.length === 0) || isOverLimit}
                    className="rounded-full px-5 font-semibold"
                    data-testid="button-post-submit"
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
              
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex gap-3">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(user?.firstName, user?.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea
                      placeholder="What's happening?"
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      className="resize-none border-0 bg-transparent focus-visible:ring-0 text-xl min-h-[150px] placeholder:text-muted-foreground/50"
                      autoFocus
                      data-testid="input-post-content"
                    />
                    
                    <AnimatePresence>
                      {mediaPreviews.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="grid grid-cols-2 gap-2 mt-4"
                        >
                          {mediaPreviews.map((preview, index) => (
                            <motion.div 
                              key={index} 
                              className="relative group aspect-square"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                            >
                              <div className="h-full w-full rounded-xl overflow-hidden ring-1 ring-border">
                                {preview.type === 'video' ? (
                                  <div className="h-full w-full bg-muted flex items-center justify-center relative">
                                    <video src={preview.url} className="h-full w-full object-cover" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                      <Play className="h-8 w-8 text-white fill-white" />
                                    </div>
                                  </div>
                                ) : (
                                  <img
                                    src={preview.url}
                                    alt={`Preview ${index + 1}`}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                onClick={() => removeMedia(index)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              
              <div className="border-t px-4 py-3 sticky bottom-0 bg-background">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handleMediaUpload}
                      data-testid="input-compose-media"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full text-primary"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-add-image"
                    >
                      <ImageIcon className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full text-primary"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-add-video"
                    >
                      <Video className="h-5 w-5" />
                    </Button>
                    {newPostContent.trim() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveDraft}
                        className="rounded-full text-muted-foreground ml-2"
                        data-testid="button-save-draft"
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Save draft
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-medium ${charCountColor}`}>
                      {charCount}/{MAX_CHAR_COUNT}
                    </div>
                    {charCount > 0 && (
                      <div className="relative h-5 w-5">
                        <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
                          <circle
                            cx="10"
                            cy="10"
                            r="8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-muted/30"
                          />
                          <circle
                            cx="10"
                            cy="10"
                            r="8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray={`${Math.min((charCount / MAX_CHAR_COUNT) * 50.26, 50.26)} 50.26`}
                            className={isOverLimit ? "text-destructive" : charCount > MAX_CHAR_COUNT - 20 ? "text-amber-500" : "text-primary"}
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Image as ImageIcon, 
  X, 
  UserPlus,
  Users,
  Compass,
  Zap,
  Trash2,
  Store,
  Sparkles
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import type { User, SocialPost } from "@shared/schema";

type PostWithAuthor = SocialPost & { 
  author: User; 
  isLiked?: boolean;
};

type Comment = {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
  author: User;
};

export default function ThePlugPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("discover");
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const { data: posts, isLoading } = useQuery<PostWithAuthor[]>({
    queryKey: ["/api/social-posts", activeTab === "following" ? { following: true } : {}],
  });

  const { data: comments } = useQuery<Comment[]>({
    queryKey: ["/api/social-posts", expandedComments, "comments"],
    enabled: !!expandedComments,
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: { content: string; images: File[] }) => {
      const formData = new FormData();
      formData.append("content", data.content);
      data.images.forEach((file) => {
        formData.append("images", file);
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
      setSelectedImages([]);
      setImagePreviews([]);
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiRequest("DELETE", `/api/social-posts/${postId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Post deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
    },
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/users/${userId}/follow`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Following!" });
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to follow", variant: "destructive" });
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedImages.length > 5) {
      toast({ title: "Maximum 5 images allowed", variant: "destructive" });
      return;
    }
    setSelectedImages((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = () => {
    if (!newPostContent.trim() && selectedImages.length === 0) {
      toast({ title: "Please add some content", variant: "destructive" });
      return;
    }
    createPostMutation.mutate({ content: newPostContent, images: selectedImages });
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "U";
  };

  const isPostLiked = (post: PostWithAuthor) => {
    return likedPosts.has(post.id) || post.isLiked;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-xl">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
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
        >
          <Card className="mb-6 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
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
                    className="resize-none border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/20 text-sm min-h-[80px] placeholder:text-muted-foreground/60"
                    rows={3}
                    data-testid="input-new-post"
                  />
                  
                  <AnimatePresence>
                    {imagePreviews.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-2 flex-wrap"
                      >
                        {imagePreviews.map((preview, index) => (
                          <motion.div 
                            key={index} 
                            className="relative group"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                          >
                            <div className="h-16 w-16 rounded-lg overflow-hidden ring-1 ring-border">
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeImage(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between pt-2">
                    <label className="cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageUpload}
                        data-testid="input-post-images"
                      />
                      <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors px-3 py-1.5 rounded-full bg-muted/50 group-hover:bg-primary/10">
                        <ImageIcon className="h-4 w-4" />
                        <span className="text-xs font-medium">Photo</span>
                      </div>
                    </label>
                    <Button
                      onClick={handleCreatePost}
                      disabled={createPostMutation.isPending || (!newPostContent.trim() && selectedImages.length === 0)}
                      size="sm"
                      className="rounded-full px-5"
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
                        <>
                          <Send className="h-4 w-4" />
                          Post
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="w-full bg-muted/50 p-1 rounded-xl">
              <TabsTrigger 
                value="discover" 
                className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                data-testid="tab-discover"
              >
                <Compass className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Discover</span>
              </TabsTrigger>
              <TabsTrigger 
                value="following" 
                className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                data-testid="tab-following"
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Following</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-20 w-full rounded-lg mb-3" />
                  <div className="flex gap-4">
                    <Skeleton className="h-8 w-16 rounded-full" />
                    <Skeleton className="h-8 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <motion.div 
            className="space-y-4"
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
          >
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                transition={{ duration: 0.3 }}
              >
                <Card className="overflow-hidden" data-testid={`post-card-${post.id}`}>
                  <CardContent className="p-0">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <Link href={`/profile?user=${post.authorId}`}>
                          <div className="flex items-center gap-3 group cursor-pointer">
                            <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm transition-transform group-hover:scale-105">
                              <AvatarImage src={post.author?.profileImageUrl || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                                {getInitials(post.author?.firstName, post.author?.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                                  {post.author?.firstName} {post.author?.lastName}
                                </span>
                                {(post.author?.role === "seller" || post.author?.role === "both") && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    <Store className="h-2.5 w-2.5 mr-0.5" />
                                    Seller
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(post.createdAt!), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </Link>
                        <div className="flex items-center gap-1">
                          {post.authorId !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => followMutation.mutate(post.authorId)}
                              className="text-xs h-7 px-2 text-primary"
                              data-testid={`button-follow-${post.authorId}`}
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1" />
                              Follow
                            </Button>
                          )}
                          {post.authorId === user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deletePostMutation.mutate(post.id)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              data-testid={`button-delete-${post.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {post.content && (
                        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap mb-3">
                          {post.content}
                        </p>
                      )}
                    </div>

                    {post.images && post.images.length > 0 && (
                      <div className={`${post.images.length === 1 ? "" : "grid grid-cols-2 gap-0.5"}`}>
                        {post.images.map((img, idx) => {
                          const isSingleImage = post.images!.length === 1;
                          return (
                            <div key={idx} className={isSingleImage ? "" : "overflow-hidden"}>
                              <AspectRatio ratio={isSingleImage ? 4/3 : 1}>
                                <img
                                  src={img}
                                  alt={`Post image ${idx + 1}`}
                                  className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                                />
                              </AspectRatio>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="p-4 pt-3">
                      <div className="flex items-center gap-1">
                        <motion.div whileTap={{ scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => likeMutation.mutate(post.id)}
                            className={`h-8 px-3 gap-1.5 rounded-full transition-colors ${
                              isPostLiked(post) 
                                ? "text-red-500 bg-red-500/10" 
                                : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            }`}
                            data-testid={`button-like-${post.id}`}
                          >
                            <motion.div
                              animate={isPostLiked(post) ? { scale: [1, 1.3, 1] } : {}}
                              transition={{ duration: 0.3 }}
                            >
                              <Heart className={`h-4 w-4 ${isPostLiked(post) ? "fill-current" : ""}`} />
                            </motion.div>
                            <span className="text-xs font-medium">{post.likesCount || 0}</span>
                          </Button>
                        </motion.div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedComments(expandedComments === post.id ? null : post.id)}
                          className={`h-8 px-3 gap-1.5 rounded-full transition-colors ${
                            expandedComments === post.id
                              ? "text-primary bg-primary/10"
                              : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                          }`}
                          data-testid={`button-comments-${post.id}`}
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-xs font-medium">{post.commentsCount || 0}</span>
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
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={comment.author?.profileImageUrl || undefined} />
                                    <AvatarFallback className="text-[10px] bg-muted">
                                      {getInitials(comment.author?.firstName, comment.author?.lastName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 bg-muted/50 rounded-2xl rounded-tl-md px-3 py-2">
                                    <span className="font-medium text-xs">
                                      {comment.author?.firstName} {comment.author?.lastName}
                                    </span>
                                    <p className="text-sm text-foreground/90">{comment.content}</p>
                                  </div>
                                </motion.div>
                              ))}
                              
                              <div className="flex gap-2 items-center">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={user?.profileImageUrl || undefined} />
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                    {getInitials(user?.firstName, user?.lastName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 flex gap-2">
                                  <Input
                                    placeholder="Write a comment..."
                                    value={commentText[post.id] || ""}
                                    onChange={(e) => setCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && commentText[post.id]?.trim()) {
                                        commentMutation.mutate({ postId: post.id, content: commentText[post.id] });
                                      }
                                    }}
                                    className="h-8 text-sm rounded-full bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
                                    data-testid={`input-comment-${post.id}`}
                                  />
                                  <motion.div whileTap={{ scale: 0.9 }}>
                                    <Button
                                      size="icon"
                                      onClick={() => {
                                        if (commentText[post.id]?.trim()) {
                                          commentMutation.mutate({ postId: post.id, content: commentText[post.id] });
                                        }
                                      }}
                                      disabled={!commentText[post.id]?.trim() || commentMutation.isPending}
                                      className="h-8 w-8 rounded-full"
                                      data-testid={`button-send-comment-${post.id}`}
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                    </Button>
                                  </motion.div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="py-16 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"
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
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="h-20" />
      </div>
    </div>
  );
}

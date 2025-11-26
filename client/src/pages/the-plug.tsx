import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
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
  MoreHorizontal,
  Trash2,
  Store
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

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">The Plug</h1>
        </div>
        <Badge variant="secondary" className="text-xs">Campus Feed</Badge>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback>{getInitials(user?.firstName, user?.lastName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                placeholder="What's happening on campus?"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="resize-none border-0 focus-visible:ring-0 text-base"
                rows={3}
                data-testid="input-new-post"
              />
              {imagePreviews.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="h-20 w-20 object-cover rounded-md"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-5 w-5"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                    data-testid="input-post-images"
                  />
                  <div className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-sm">Photo</span>
                  </div>
                </label>
                <Button
                  onClick={handleCreatePost}
                  disabled={createPostMutation.isPending || (!newPostContent.trim() && selectedImages.length === 0)}
                  data-testid="button-create-post"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Post
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="discover" className="flex items-center gap-2" data-testid="tab-discover">
            <Compass className="h-4 w-4" />
            Discover
          </TabsTrigger>
          <TabsTrigger value="following" className="flex items-center gap-2" data-testid="tab-following">
            <Users className="h-4 w-4" />
            Following
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : posts && posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} data-testid={`post-card-${post.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/profile?user=${post.authorId}`}>
                    <div className="flex items-center gap-3 hover-elevate rounded-md p-1 -m-1 cursor-pointer">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={post.author?.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {getInitials(post.author?.firstName, post.author?.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {post.author?.firstName} {post.author?.lastName}
                          </span>
                          {(post.author?.role === "seller" || post.author?.role === "both") && (
                            <Badge variant="secondary" className="text-[10px]">
                              <Store className="h-3 w-3 mr-1" />
                              Seller
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
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
                        className="text-xs"
                        data-testid={`button-follow-${post.authorId}`}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Follow
                      </Button>
                    )}
                    {post.authorId === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePostMutation.mutate(post.id)}
                        className="text-destructive"
                        data-testid={`button-delete-${post.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
                {post.images && post.images.length > 0 && (
                  <div className={`grid gap-2 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {post.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Post image ${idx + 1}`}
                        className="rounded-md w-full object-cover max-h-64"
                      />
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => likeMutation.mutate(post.id)}
                    className={post.isLiked ? "text-red-500" : ""}
                    data-testid={`button-like-${post.id}`}
                  >
                    <Heart className={`h-4 w-4 mr-1 ${post.isLiked ? "fill-current" : ""}`} />
                    {post.likesCount || 0}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedComments(expandedComments === post.id ? null : post.id)}
                    data-testid={`button-comments-${post.id}`}
                  >
                    <MessageCircle className="h-4 w-4 mr-1" />
                    {post.commentsCount || 0}
                  </Button>
                </div>

                {expandedComments === post.id && (
                  <div className="space-y-3 pt-3 border-t">
                    {comments?.map((comment) => (
                      <div key={comment.id} className="flex gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.author?.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {getInitials(comment.author?.firstName, comment.author?.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-muted rounded-md p-2">
                          <span className="font-medium text-sm">
                            {comment.author?.firstName} {comment.author?.lastName}
                          </span>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Write a comment..."
                        value={commentText[post.id] || ""}
                        onChange={(e) => setCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && commentText[post.id]?.trim()) {
                            commentMutation.mutate({ postId: post.id, content: commentText[post.id] });
                          }
                        }}
                        data-testid={`input-comment-${post.id}`}
                      />
                      <Button
                        size="icon"
                        onClick={() => {
                          if (commentText[post.id]?.trim()) {
                            commentMutation.mutate({ postId: post.id, content: commentText[post.id] });
                          }
                        }}
                        disabled={!commentText[post.id]?.trim()}
                        data-testid={`button-send-comment-${post.id}`}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {activeTab === "following" ? "No posts from people you follow" : "No posts yet"}
            </h3>
            <p className="text-muted-foreground">
              {activeTab === "following"
                ? "Follow more people to see their posts here"
                : "Be the first to share what's happening on campus!"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

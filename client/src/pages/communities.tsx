import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users,
  Plus,
  Heart,
  MessageCircle,
  Send,
  ArrowLeft,
  Globe,
  Lock,
  Mail,
  Image as ImageIcon,
  X,
  Pin,
  BookOpen,
  Gamepad2,
  Music,
  Film,
  Code,
  Utensils,
  Briefcase,
  Shirt,
  MoreHorizontal,
  Search,
  TrendingUp,
  CheckCircle,
  Crown,
  Shield,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Community, CommunityPost, CommunityPostComment, CommunityMember } from "@shared/schema";

const COMMUNITY_CATEGORIES = [
  { value: "general", label: "General", icon: Globe },
  { value: "academics", label: "Academics", icon: BookOpen },
  { value: "gaming", label: "Gaming", icon: Gamepad2 },
  { value: "music", label: "Music", icon: Music },
  { value: "entertainment", label: "Entertainment", icon: Film },
  { value: "technology", label: "Technology", icon: Code },
  { value: "food", label: "Food & Cooking", icon: Utensils },
  { value: "career", label: "Career & Jobs", icon: Briefcase },
  { value: "fashion", label: "Fashion", icon: Shirt },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  academics: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  gaming: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  music: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  entertainment: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  technology: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  food: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  career: "bg-green-500/10 text-green-600 dark:text-green-400",
  fashion: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const TYPE_CONFIG = {
  public: { icon: Globe, label: "Public", desc: "Anyone can join" },
  private: { icon: Lock, label: "Private", desc: "Requires approval" },
  invite_only: { icon: Mail, label: "Invite Only", desc: "By invitation" },
};

const ROLE_BADGES: Record<string, { color: string; icon: typeof Crown }> = {
  owner: { color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", icon: Crown },
  admin: { color: "bg-red-500/10 text-red-600 dark:text-red-400", icon: Shield },
  moderator: { color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: Shield },
  member: { color: "bg-green-500/10 text-green-600 dark:text-green-400", icon: CheckCircle },
};

type CommunityWithOwner = Community & {
  owner?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } | null;
  membership?: CommunityMember | null;
};

type PostWithAuthor = CommunityPost & {
  author?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } | null;
  isLiked?: boolean;
};

type CommentWithAuthor = CommunityPostComment & {
  author?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } | null;
};

function CategoryBadge({ category }: { category: string }) {
  const cat = COMMUNITY_CATEGORIES.find(c => c.value === category);
  const Icon = cat?.icon || Globe;
  const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
  
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {cat?.label || category}
    </Badge>
  );
}

function CommunityCard({ 
  community, 
  onClick 
}: { 
  community: CommunityWithOwner;
  onClick: () => void;
}) {
  const typeConfig = TYPE_CONFIG[community.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.public;
  const TypeIcon = typeConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        className="overflow-visible hover-elevate cursor-pointer"
        onClick={onClick}
        data-testid={`card-community-${community.id}`}
      >
        <div className="relative h-24 bg-gradient-to-br from-primary/20 to-primary/5">
          {community.coverUrl && (
            <img 
              src={community.coverUrl} 
              alt="" 
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute -bottom-6 left-4">
            <Avatar className="h-14 w-14 border-4 border-background">
              <AvatarImage src={community.iconUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold">
                {community.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <CardContent className="pt-8 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate">{community.name}</h3>
                <TypeIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">c/{community.slug}</p>
            </div>
            {community.category && <CategoryBadge category={community.category} />}
          </div>
          
          {community.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {community.description}
            </p>
          )}
          
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {community.membersCount || 0} members
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {community.postsCount || 0} posts
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PostCard({
  post,
  community,
  onLike,
  onComment,
  currentUserId,
}: {
  post: PostWithAuthor;
  community: CommunityWithOwner;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  currentUserId?: string;
}) {
  const authorName = post.author 
    ? `${post.author.firstName} ${post.author.lastName}` 
    : "Unknown User";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-visible" data-testid={`card-post-${post.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.author?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {authorName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">
                  {authorName}
                </span>
                {post.isPinned && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                    <Pin className="h-3 w-3 mr-1" />
                    Pinned
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.createdAt!), { addSuffix: true })}
                </span>
              </div>
              
              {post.title && (
                <h4 className="mt-1 font-medium text-foreground">{post.title}</h4>
              )}
              
              <p className="mt-2 text-foreground whitespace-pre-wrap break-words text-sm leading-relaxed">
                {post.content}
              </p>

              {post.images && post.images.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {post.images.slice(0, 4).map((img, idx) => (
                    <img 
                      key={idx}
                      src={img}
                      alt=""
                      className="rounded-md object-cover w-full h-32"
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onLike(post.id); }}
                  className={`gap-1.5 ${post.isLiked ? "text-red-500" : "text-muted-foreground"}`}
                  data-testid={`button-like-post-${post.id}`}
                >
                  <Heart className={`h-4 w-4 ${post.isLiked ? "fill-current" : ""}`} />
                  <span>{post.likesCount || 0}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onComment(post.id); }}
                  className="gap-1.5 text-muted-foreground"
                  data-testid={`button-comment-post-${post.id}`}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>{post.commentsCount || 0}</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CommentsDialog({
  open,
  onOpenChange,
  postId,
  communityId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string | null;
  communityId: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");

  const { data: comments = [], isLoading } = useQuery<CommentWithAuthor[]>({
    queryKey: ['/api/community-posts', postId, 'comments'],
    enabled: !!postId && open,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (data: { content: string }) => {
      const res = await apiRequest('POST', `/api/community-posts/${postId}/comments`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community-posts', postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/communities', communityId, 'posts'] });
      setNewComment("");
      toast({ title: "Comment added!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate({ content: newComment.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No comments yet. Be the first!</p>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="flex gap-3" data-testid={`comment-${comment.id}`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.author?.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {comment.author?.firstName?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {comment.author ? `${comment.author.firstName} ${comment.author.lastName}` : "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt!), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-1">{comment.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t mt-4">
          <Input
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
            data-testid="input-new-comment"
          />
          <Button 
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || addCommentMutation.isPending}
            data-testid="button-submit-comment"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateCommunityDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("public");
  const [category, setCategory] = useState<string>("general");
  const [rules, setRules] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/communities', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/communities/joined'] });
      onOpenChange(false);
      resetForm();
      toast({ title: "Community created successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setSlug("");
    setDescription("");
    setType("public");
    setCategory("general");
    setRules("");
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const handleSubmit = () => {
    if (!name.trim() || !slug.trim()) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    const rulesArray = rules.split('\n').filter(r => r.trim()).map(r => r.trim());

    createMutation.mutate({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      type,
      category,
      rules: rulesArray,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Create Community</DialogTitle>
          <DialogDescription>
            Create a new community for people to join and share content.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Community Name *</Label>
            <Input
              id="name"
              placeholder="e.g., EKSU Tech Enthusiasts"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              data-testid="input-community-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug *</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-sm">c/</span>
              <Input
                id="slug"
                placeholder="eksu-tech"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                data-testid="input-community-slug"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What's this community about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              data-testid="input-community-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-community-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-community-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNITY_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <cat.icon className="h-4 w-4" />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rules">Community Rules (one per line)</Label>
            <Textarea
              id="rules"
              placeholder="Be respectful&#10;No spam&#10;Stay on topic"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={3}
              data-testid="input-community-rules"
            />
          </div>
        </div>
        </ScrollArea>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createMutation.isPending || !name.trim() || !slug.trim()}
            data-testid="button-create-community"
          >
            {createMutation.isPending ? "Creating..." : "Create Community"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePostDialog({
  open,
  onOpenChange,
  communityId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/communities/${communityId}/posts`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communities', communityId, 'posts'] });
      onOpenChange(false);
      resetForm();
      toast({ title: "Post created!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setContent("");
    setImages([]);
    setImageUrl("");
  };

  const handleAddImage = () => {
    if (imageUrl.trim() && images.length < 4) {
      setImages([...images, imageUrl.trim()]);
      setImageUrl("");
    }
  };

  const handleRemoveImage = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!content.trim()) {
      toast({ title: "Please write some content", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      title: title.trim() || undefined,
      content: content.trim(),
      images: images.length > 0 ? images : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
          <DialogDescription>
            Share something with the community.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="post-title">Title (optional)</Label>
            <Input
              id="post-title"
              placeholder="Give your post a title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-post-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-content">Content *</Label>
            <Textarea
              id="post-content"
              placeholder="What do you want to share?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              data-testid="input-post-content"
            />
          </div>

          <div className="space-y-2">
            <Label>Images (up to 4)</Label>
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img src={img} alt="" className="w-full h-16 object-cover rounded-md" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => handleRemoveImage(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {images.length < 4 && (
              <div className="flex gap-2">
                <Input
                  placeholder="Image URL"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  data-testid="input-image-url"
                />
                <Button variant="outline" onClick={handleAddImage} disabled={!imageUrl.trim()}>
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createMutation.isPending || !content.trim()}
            data-testid="button-create-post"
          >
            {createMutation.isPending ? "Posting..." : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommunityDetailView({
  slug,
  onBack,
}: {
  slug: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const { data: community, isLoading: communityLoading } = useQuery<CommunityWithOwner>({
    queryKey: ['/api/communities', slug],
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<PostWithAuthor[]>({
    queryKey: ['/api/communities', community?.id, 'posts'],
    enabled: !!community?.id,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/communities/${community?.id}/join`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communities', slug] });
      queryClient.invalidateQueries({ queryKey: ['/api/communities/joined'] });
      toast({ title: "Joined community!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/communities/${community?.id}/leave`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communities', slug] });
      queryClient.invalidateQueries({ queryKey: ['/api/communities/joined'] });
      toast({ title: "Left community" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await apiRequest('POST', `/api/community-posts/${postId}/like`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communities', community?.id, 'posts'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (communityLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Community not found</p>
        <Button variant="ghost" onClick={onBack}>Go back</Button>
      </div>
    );
  }

  const isMember = !!community.membership;
  const typeConfig = TYPE_CONFIG[community.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.public;
  const TypeIcon = typeConfig.icon;

  const pinnedPosts = posts.filter(p => p.isPinned);
  const regularPosts = posts.filter(p => !p.isPinned);
  const sortedPosts = [...pinnedPosts, ...regularPosts];

  return (
    <div className="flex flex-col pb-20 lg:pb-4">
      <div className="relative h-40 bg-gradient-to-br from-primary/30 to-primary/10">
        {community.coverUrl && (
          <img 
            src={community.coverUrl} 
            alt="" 
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-background/50 backdrop-blur-sm"
          onClick={onBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative px-4 -mt-12">
        <div className="flex items-end gap-4">
          <Avatar className="h-24 w-24 border-4 border-background">
            <AvatarImage src={community.iconUrl || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-3xl font-bold">
              {community.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 pb-2">
            <h1 className="text-2xl font-bold text-foreground truncate">{community.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TypeIcon className="h-4 w-4" />
              <span>c/{community.slug}</span>
              {community.category && (
                <>
                  <span>-</span>
                  <CategoryBadge category={community.category} />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {community.membersCount || 0} members
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              {community.postsCount || 0} posts
            </span>
          </div>
          
          {isMember ? (
            <Button 
              variant="outline" 
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending || community.membership?.role === 'owner'}
              data-testid="button-leave-community"
            >
              {community.membership?.role === 'owner' ? 'Owner' : leaveMutation.isPending ? 'Leaving...' : 'Leave'}
            </Button>
          ) : (
            <Button 
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              data-testid="button-join-community"
            >
              {joinMutation.isPending ? 'Joining...' : 'Join Community'}
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {community.description && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">About</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {community.description}
            </CardContent>
          </Card>
        )}

        {community.rules && community.rules.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                {(community.rules as string[]).map((rule, idx) => (
                  <li key={idx}>{rule}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Posts</h2>
          {isMember && (
            <Button onClick={() => setShowCreatePost(true)} data-testid="button-new-post">
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </Button>
          )}
        </div>

        {postsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedPosts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {sortedPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  community={community}
                  onLike={(postId) => likeMutation.mutate(postId)}
                  onComment={(postId) => setSelectedPostId(postId)}
                  currentUserId={user?.id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <CreatePostDialog
        open={showCreatePost}
        onOpenChange={setShowCreatePost}
        communityId={community.id}
      />

      <CommentsDialog
        open={!!selectedPostId}
        onOpenChange={(open) => !open && setSelectedPostId(null)}
        postId={selectedPostId}
        communityId={community.id}
      />
    </div>
  );
}

export default function CommunitiesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("discover");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allCommunities = [], isLoading: allLoading } = useQuery<CommunityWithOwner[]>({
    queryKey: ['/api/communities'],
  });

  const { data: joinedCommunities = [], isLoading: joinedLoading } = useQuery<CommunityWithOwner[]>({
    queryKey: ['/api/communities/joined'],
  });

  const filteredCommunities = searchQuery.trim()
    ? allCommunities.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allCommunities;

  if (selectedSlug) {
    return (
      <CommunityDetailView
        slug={selectedSlug}
        onBack={() => setSelectedSlug(null)}
      />
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Communities</h1>
          <p className="text-sm text-muted-foreground">Join groups and connect with others</p>
        </div>
        <Button onClick={() => setShowCreateCommunity(true)} data-testid="button-create-community">
          <Plus className="h-4 w-4 mr-2" />
          Create
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 mb-6">
          <TabsTrigger value="discover" className="gap-2" data-testid="tab-discover">
            <TrendingUp className="h-4 w-4" />
            Discover
          </TabsTrigger>
          <TabsTrigger value="joined" className="gap-2" data-testid="tab-joined">
            <Users className="h-4 w-4" />
            My Communities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="mt-0">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search communities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-communities"
              />
            </div>
          </div>

          {allLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <div className="h-24">
                    <Skeleton className="h-full w-full" />
                  </div>
                  <CardContent className="pt-8 pb-4">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3 mt-1" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredCommunities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No communities found matching your search" : "No communities yet. Create the first one!"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <AnimatePresence>
                {filteredCommunities.map(community => (
                  <CommunityCard
                    key={community.id}
                    community={community}
                    onClick={() => setSelectedSlug(community.slug)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="joined" className="mt-0">
          {joinedLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map(i => (
                <Card key={i}>
                  <div className="h-24">
                    <Skeleton className="h-full w-full" />
                  </div>
                  <CardContent className="pt-8 pb-4">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : joinedCommunities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">You haven't joined any communities yet</p>
                <Button variant="outline" onClick={() => setActiveTab("discover")}>
                  <Search className="h-4 w-4 mr-2" />
                  Browse Communities
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <AnimatePresence>
                {joinedCommunities.map(community => (
                  <CommunityCard
                    key={community.id}
                    community={community}
                    onClick={() => setSelectedSlug(community.slug)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateCommunityDialog
        open={showCreateCommunity}
        onOpenChange={setShowCreateCommunity}
      />
    </div>
  );
}

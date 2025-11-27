import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus,
  X, 
  ChevronLeft,
  ChevronRight,
  Heart,
  Send,
  Image as ImageIcon,
  Video,
  Type,
  Eye,
  Trash2,
  Pause,
  Play,
  Volume2,
  VolumeX
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { User, Story } from "@shared/schema";

type StoryWithAuthor = Story & { 
  author: User; 
  hasViewed?: boolean;
};

type UserWithStories = {
  user: User;
  storyCount: number;
  hasUnviewed: boolean;
  latestStoryAt: string;
};

const STORY_DURATION = 5000;

const BACKGROUND_COLORS = [
  "#16a34a",
  "#3b82f6", 
  "#ec4899",
  "#f59e0b",
  "#8b5cf6",
  "#000000",
];

const FONT_STYLES = [
  { name: "Sans", value: "sans-serif" },
  { name: "Serif", value: "serif" },
  { name: "Mono", value: "monospace" },
];

const REACTIONS = ["fire", "heart", "clap", "eyes", "laugh", "wow"];

const REACTION_ICONS: Record<string, string> = {
  fire: "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z",
  heart: "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z",
  clap: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
  eyes: "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  laugh: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z",
  wow: "M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z",
};

function StoryRing({ 
  user, 
  hasUnviewed, 
  isOwn,
  onClick,
  size = "md"
}: { 
  user: User; 
  hasUnviewed: boolean;
  isOwn?: boolean;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-20 h-20",
  };
  
  const ringClasses = hasUnviewed 
    ? "ring-2 ring-[#16a34a] ring-offset-2 ring-offset-background" 
    : "ring-2 ring-muted ring-offset-2 ring-offset-background";

  const initials = user.firstName && user.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user.email.substring(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 min-w-[72px]"
      data-testid={`story-ring-${user.id}`}
    >
      <div className={`relative ${sizeClasses[size]} rounded-full ${ringClasses}`}>
        <Avatar className="w-full h-full">
          <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || user.email} />
          <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
        </Avatar>
        {isOwn && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#16a34a] rounded-full flex items-center justify-center border-2 border-background">
            <Plus className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <span className="text-xs truncate max-w-[64px] text-muted-foreground">
        {isOwn ? "Your story" : user.firstName || user.email.split("@")[0]}
      </span>
    </button>
  );
}

function StoryViewer({
  stories,
  initialStoryIndex = 0,
  onClose,
  currentUserId,
}: {
  stories: StoryWithAuthor[];
  initialStoryIndex?: number;
  onClose: () => void;
  currentUserId: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [showReactions, setShowReactions] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  
  const currentStory = stories[currentIndex];
  const isOwnStory = currentStory?.authorId === currentUserId;
  
  const viewMutation = useMutation({
    mutationFn: async (storyId: string) => {
      return apiRequest("POST", `/api/stories/${storyId}/view`);
    },
  });
  
  const reactMutation = useMutation({
    mutationFn: async ({ storyId, reaction }: { storyId: string; reaction: string }) => {
      return apiRequest("POST", `/api/stories/${storyId}/react`, { reaction });
    },
    onSuccess: () => {
      toast({ title: "Reaction sent!" });
      setShowReactions(false);
    },
  });
  
  const replyMutation = useMutation({
    mutationFn: async ({ storyId, content }: { storyId: string; content: string }) => {
      return apiRequest("POST", `/api/stories/${storyId}/reply`, { content });
    },
    onSuccess: () => {
      toast({ title: "Reply sent!" });
      setReplyText("");
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (storyId: string) => {
      return apiRequest("DELETE", `/api/stories/${storyId}`);
    },
    onSuccess: () => {
      toast({ title: "Story deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stories/users"] });
      if (stories.length === 1) {
        onClose();
      } else if (currentIndex >= stories.length - 1) {
        setCurrentIndex(currentIndex - 1);
      }
    },
  });
  
  const startProgress = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    
    setProgress(0);
    
    const duration = currentStory?.type === "video" && videoRef.current 
      ? (videoRef.current.duration || 15) * 1000 
      : STORY_DURATION;
    
    const interval = 50;
    const increment = (interval / duration) * 100;
    
    progressInterval.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval.current!);
          goToNext();
          return 0;
        }
        return prev + increment;
      });
    }, interval);
  }, [currentStory?.type]);
  
  const pauseProgress = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
  }, []);
  
  const goToNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);
  
  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);
  
  useEffect(() => {
    if (currentStory && !currentStory.hasViewed && currentStory.authorId !== currentUserId) {
      viewMutation.mutate(currentStory.id);
    }
  }, [currentStory?.id]);
  
  useEffect(() => {
    if (!isPaused) {
      startProgress();
    } else {
      pauseProgress();
    }
    
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentIndex, isPaused, startProgress, pauseProgress]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        setIsPaused(p => !p);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrev, onClose]);
  
  if (!currentStory) return null;
  
  const author = currentStory.author;
  const initials = author.firstName && author.lastName 
    ? `${author.firstName[0]}${author.lastName[0]}`.toUpperCase()
    : author.email.substring(0, 2).toUpperCase();
  
  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeftSide = x < rect.width / 3;
    const isRightSide = x > (rect.width * 2) / 3;
    
    if (isLeftSide) {
      goToPrev();
    } else if (isRightSide) {
      goToNext();
    }
  };
  
  const handleReact = (reaction: string) => {
    reactMutation.mutate({ storyId: currentStory.id, reaction });
  };
  
  const handleReply = () => {
    if (replyText.trim()) {
      replyMutation.mutate({ storyId: currentStory.id, content: replyText.trim() });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div 
        className="relative w-full h-full max-w-[420px] max-h-[100vh] flex flex-col"
        onClick={handleTap}
        data-testid="story-viewer"
      >
        <div className="absolute top-0 left-0 right-0 z-10 p-2 flex gap-1">
          {stories.map((_, idx) => (
            <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all"
                style={{ 
                  width: idx < currentIndex ? "100%" : idx === currentIndex ? `${progress}%` : "0%" 
                }}
              />
            </div>
          ))}
        </div>
        
        <div className="absolute top-6 left-0 right-0 z-10 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 ring-2 ring-white/50">
              <AvatarImage src={author.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-white">
              <p className="font-medium text-sm" data-testid="story-author-name">
                {author.firstName && author.lastName 
                  ? `${author.firstName} ${author.lastName}` 
                  : author.email}
              </p>
              <p className="text-xs text-white/70" data-testid="story-time">
                {currentStory.createdAt && formatDistanceToNow(new Date(currentStory.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="text-white"
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused(p => !p);
              }}
              data-testid="button-pause-story"
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </Button>
            {currentStory.type === "video" && (
              <Button
                size="icon"
                variant="ghost"
                className="text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(m => !m);
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                  }
                }}
                data-testid="button-mute-story"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
            )}
            {isOwnStory && (
              <Button
                size="icon"
                variant="ghost"
                className="text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate(currentStory.id);
                }}
                data-testid="button-delete-story"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="text-white"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              data-testid="button-close-story"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          {currentStory.type === "text" ? (
            <div 
              className="w-full h-full flex items-center justify-center p-8"
              style={{ backgroundColor: currentStory.backgroundColor || "#16a34a" }}
            >
              <p 
                className="text-white text-2xl font-semibold text-center break-words"
                style={{ fontFamily: currentStory.fontStyle || "sans-serif" }}
                data-testid="story-text-content"
              >
                {currentStory.textContent}
              </p>
            </div>
          ) : currentStory.type === "image" ? (
            <img 
              src={currentStory.mediaUrl || ""} 
              alt="Story" 
              className="w-full h-full object-contain"
              data-testid="story-image"
            />
          ) : (
            <video
              ref={videoRef}
              src={currentStory.mediaUrl || ""}
              className="w-full h-full object-contain"
              autoPlay
              muted={isMuted}
              loop={false}
              playsInline
              onLoadedMetadata={() => startProgress()}
              data-testid="story-video"
            />
          )}
        </div>
        
        {isOwnStory ? (
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4 px-4">
            <div className="flex items-center gap-2 bg-black/50 rounded-full px-4 py-2">
              <Eye className="w-5 h-5 text-white" />
              <span className="text-white text-sm" data-testid="story-views-count">
                {currentStory.viewsCount || 0} views
              </span>
            </div>
            <div className="flex items-center gap-2 bg-black/50 rounded-full px-4 py-2">
              <Heart className="w-5 h-5 text-white" />
              <span className="text-white text-sm" data-testid="story-likes-count">
                {currentStory.likesCount || 0}
              </span>
            </div>
          </div>
        ) : (
          <div className="absolute bottom-4 left-0 right-0 px-4 flex flex-col gap-2">
            <AnimatePresence>
              {showReactions && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="flex justify-center gap-3 bg-black/60 rounded-full px-4 py-2 mx-auto"
                >
                  {REACTIONS.map(reaction => (
                    <button
                      key={reaction}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReact(reaction);
                      }}
                      className="text-2xl"
                      data-testid={`reaction-${reaction}`}
                    >
                      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d={REACTION_ICONS[reaction]} />
                      </svg>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Reply to story..."
                className="flex-1 bg-black/50 border-white/20 text-white placeholder:text-white/50"
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
                onKeyPress={(e) => e.key === "Enter" && handleReply()}
                data-testid="input-story-reply"
              />
              <Button
                size="icon"
                variant="ghost"
                className="text-white"
                onClick={() => setShowReactions(s => !s)}
                data-testid="button-show-reactions"
              >
                <Heart className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-white"
                onClick={handleReply}
                disabled={!replyText.trim() || replyMutation.isPending}
                data-testid="button-send-reply"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
        
        <button
          className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-white/70"
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          disabled={currentIndex === 0}
          data-testid="button-prev-story"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
        
        <button
          className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-white/70"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          data-testid="button-next-story"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}

function CreateStoryModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [storyType, setStoryType] = useState<"text" | "image" | "video">("text");
  const [textContent, setTextContent] = useState("");
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUND_COLORS[0]);
  const [fontStyle, setFontStyle] = useState("sans-serif");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      setIsUploading(true);
      setUploadProgress(0);
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        });
        
        xhr.addEventListener("load", () => {
          setIsUploading(false);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.message || "Failed to create story"));
            } catch {
              reject(new Error("Failed to create story"));
            }
          }
        });
        
        xhr.addEventListener("error", () => {
          setIsUploading(false);
          reject(new Error("Network error occurred"));
        });
        
        xhr.open("POST", "/api/stories");
        xhr.withCredentials = true;
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      toast({ title: "Story posted!" });
      queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stories/users"] });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const handleClose = () => {
    setStoryType("text");
    setTextContent("");
    setBackgroundColor(BACKGROUND_COLORS[0]);
    setFontStyle("sans-serif");
    setMediaFile(null);
    setMediaPreview(null);
    setUploadProgress(0);
    setIsUploading(false);
    onClose();
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onload = () => setMediaPreview(reader.result as string);
      reader.readAsDataURL(file);
      
      if (file.type.startsWith("video/")) {
        setStoryType("video");
      } else {
        setStoryType("image");
      }
    }
  };
  
  const handleSubmit = () => {
    if (storyType === "text" && !textContent.trim()) {
      toast({ title: "Please enter some text", variant: "destructive" });
      return;
    }
    
    if ((storyType === "image" || storyType === "video") && !mediaFile) {
      toast({ title: "Please select a file", variant: "destructive" });
      return;
    }
    
    const formData = new FormData();
    formData.append("type", storyType);
    
    if (storyType === "text") {
      formData.append("textContent", textContent);
      formData.append("backgroundColor", backgroundColor);
      formData.append("fontStyle", fontStyle);
    } else if (mediaFile) {
      formData.append("media", mediaFile);
    }
    
    createMutation.mutate(formData);
  };
  
  const canSubmit = storyType === "text" 
    ? textContent.trim().length > 0 
    : !!mediaFile;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md p-0 flex flex-col max-h-[80vh] sm:max-h-[85vh] overflow-hidden">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle>Create Story</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto min-h-0 p-4">
          <div className="flex gap-2 mb-4">
            <Button
              variant={storyType === "text" ? "default" : "outline"}
              onClick={() => {
                setStoryType("text");
                setMediaFile(null);
                setMediaPreview(null);
              }}
              className="flex-1"
              data-testid="button-story-type-text"
            >
              <Type className="w-4 h-4 mr-2" />
              Text
            </Button>
            <Button
              variant={storyType === "image" ? "default" : "outline"}
              onClick={() => {
                setStoryType("image");
                fileInputRef.current?.click();
              }}
              className="flex-1"
              data-testid="button-story-type-image"
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Image
            </Button>
            <Button
              variant={storyType === "video" ? "default" : "outline"}
              onClick={() => {
                setStoryType("video");
                fileInputRef.current?.click();
              }}
              className="flex-1"
              data-testid="button-story-type-video"
            >
              <Video className="w-4 h-4 mr-2" />
              Video
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-story-media"
          />
          
          {storyType === "text" ? (
            <>
              <div 
                className="aspect-[9/16] max-h-[35vh] rounded-lg mb-4 flex items-center justify-center p-4"
                style={{ backgroundColor }}
              >
                <Textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Type your story..."
                  className="bg-transparent border-none text-white text-xl text-center resize-none focus-visible:ring-0 placeholder:text-white/50"
                  style={{ fontFamily: fontStyle }}
                  rows={6}
                  data-testid="textarea-story-text"
                />
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Background Color</p>
                <div className="flex gap-2 flex-wrap">
                  {BACKGROUND_COLORS.map(color => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full ${backgroundColor === color ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setBackgroundColor(color)}
                      data-testid={`color-${color.replace("#", "")}`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Font Style</p>
                <div className="flex gap-2 flex-wrap">
                  {FONT_STYLES.map(font => (
                    <Button
                      key={font.value}
                      variant={fontStyle === font.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFontStyle(font.value)}
                      style={{ fontFamily: font.value }}
                      data-testid={`font-${font.value}`}
                    >
                      {font.name}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div 
              className="aspect-[9/16] max-h-[35vh] rounded-lg mb-4 bg-muted flex items-center justify-center overflow-hidden cursor-pointer"
              onClick={() => !mediaPreview && fileInputRef.current?.click()}
            >
              {mediaPreview ? (
                storyType === "video" ? (
                  <video 
                    src={mediaPreview} 
                    className="w-full h-full object-contain" 
                    controls
                    playsInline
                    data-testid="preview-video"
                  />
                ) : (
                  <img 
                    src={mediaPreview} 
                    alt="Preview" 
                    className="w-full h-full object-contain"
                    data-testid="preview-image"
                  />
                )
              ) : (
                <div className="text-center text-muted-foreground p-4">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                  <p>Tap to select media</p>
                </div>
              )}
            </div>
          )}
          
          {mediaPreview && (storyType === "image" || storyType === "video") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="w-full mb-4"
              data-testid="button-change-media"
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Change Media
            </Button>
          )}
        </div>
        
        <div className="shrink-0 p-4 border-t bg-background z-50">
          {isUploading && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" data-testid="upload-progress" />
            </div>
          )}
          
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={createMutation.isPending || isUploading || !canSubmit}
            data-testid="button-post-story"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading {uploadProgress}%
              </>
            ) : createMutation.isPending ? (
              "Posting..."
            ) : (
              "Post Story"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StoriesBar({ onViewStory }: { onViewStory?: (stories: StoryWithAuthor[], startIndex: number) => void }) {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUserStories, setSelectedUserStories] = useState<StoryWithAuthor[] | null>(null);
  
  const { data: usersWithStories, isLoading: usersLoading } = useQuery<UserWithStories[]>({
    queryKey: ["/api/stories/users"],
    enabled: !!user,
  });
  
  const { data: allStories } = useQuery<StoryWithAuthor[]>({
    queryKey: ["/api/stories"],
    enabled: !!user,
  });
  
  const { data: ownStories } = useQuery<StoryWithAuthor[]>({
    queryKey: ["/api/stories/user", user?.id],
    enabled: !!user?.id,
  });
  
  const hasOwnStory = ownStories && ownStories.length > 0;
  
  const handleStoryClick = (userId: string) => {
    if (userId === user?.id) {
      if (hasOwnStory && ownStories) {
        if (onViewStory) {
          onViewStory(ownStories, 0);
        } else {
          setSelectedUserStories(ownStories);
        }
      } else {
        setShowCreateModal(true);
      }
    } else {
      const userStories = allStories?.filter(s => s.authorId === userId) || [];
      if (userStories.length > 0) {
        if (onViewStory) {
          onViewStory(userStories, 0);
        } else {
          setSelectedUserStories(userStories);
        }
      }
    }
  };
  
  if (!user) return null;

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-3 p-3" data-testid="stories-bar">
          <StoryRing
            user={user}
            hasUnviewed={false}
            isOwn={true}
            onClick={() => handleStoryClick(user.id)}
          />
          
          {usersLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 min-w-[72px]">
                <Skeleton className="w-16 h-16 rounded-full" />
                <Skeleton className="w-12 h-3" />
              </div>
            ))
          ) : (
            usersWithStories?.filter(u => u.user.id !== user.id).map(({ user: storyUser, hasUnviewed }) => (
              <StoryRing
                key={storyUser.id}
                user={storyUser}
                hasUnviewed={hasUnviewed}
                onClick={() => handleStoryClick(storyUser.id)}
              />
            ))
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      
      <CreateStoryModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
      
      {selectedUserStories && user && (
        <StoryViewer
          stories={selectedUserStories}
          onClose={() => setSelectedUserStories(null)}
          currentUserId={user.id}
        />
      )}
    </>
  );
}

export default function StoriesPage() {
  const { user } = useAuth();
  const [selectedStories, setSelectedStories] = useState<StoryWithAuthor[] | null>(null);
  
  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <p className="text-muted-foreground">Please log in to view stories</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b">
        <StoriesBar 
          onViewStory={(stories) => setSelectedStories(stories)}
        />
      </div>
      
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">Click on a story to view</p>
          <p>Stories disappear after 24 hours</p>
        </div>
      </div>
      
      {selectedStories && (
        <StoryViewer
          stories={selectedStories}
          onClose={() => setSelectedStories(null)}
          currentUserId={user.id}
        />
      )}
    </div>
  );
}

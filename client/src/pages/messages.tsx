import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  Send, 
  Paperclip, 
  Smile, 
  Check, 
  CheckCheck, 
  ArrowLeft,
  MessageCircle,
  Users,
  Search,
  Wifi,
  WifiOff
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { SafetyShieldModal, hasSafetyBeenAcknowledged } from "@/components/SafetyShieldModal";
import type { Message, User } from "@shared/schema";
import { useSearch } from "wouter";

type WebSocketStatus = "connecting" | "connected" | "disconnected" | "error";

interface ChatThread {
  user: User;
  lastMessage?: Message;
  unreadCount: number;
}

// Common emoji categories for the emoji picker
const EMOJI_CATEGORIES = [
  { name: "Smileys", emojis: ["😊", "😂", "🥰", "😍", "🤗", "😎", "🤔", "😅", "😇", "🙂", "😉", "😌"] },
  { name: "Gestures", emojis: ["👍", "👎", "👋", "🙏", "🤝", "✌️", "🤞", "👏", "💪", "🤙", "👌", "✊"] },
  { name: "Hearts", emojis: ["❤️", "💕", "💖", "💗", "💙", "💚", "💛", "🧡", "💜", "🖤", "🤍", "💯"] },
  { name: "Objects", emojis: ["📱", "💻", "📦", "💰", "🎁", "🛒", "🏠", "🚗", "✨", "🔥", "⭐", "🎉"] },
];

// Format relative time for message timestamps
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Format date separator
function formatDateSeparator(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) return "Today";
  if (messageDate.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

// Check if two dates are on the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2" data-testid="indicator-typing">
      <div className="flex items-center gap-1 bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

// Empty state component for no conversations
function EmptyConversationsState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center" data-testid="state-no-conversations">
      <div className="w-24 h-24 mb-6 rounded-full bg-muted flex items-center justify-center">
        <Users className="w-12 h-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
      <p className="text-muted-foreground text-sm max-w-xs">
        Start chatting with sellers or buyers to see your conversations here
      </p>
    </div>
  );
}

// Empty state component for no messages in conversation
function EmptyMessagesState({ userName }: { userName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center" data-testid="state-no-messages">
      <div className="w-20 h-20 mb-6 rounded-full bg-muted flex items-center justify-center">
        <MessageCircle className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Start the conversation</h3>
      <p className="text-muted-foreground text-sm max-w-xs">
        Send a message to {userName || "this user"} to begin chatting
      </p>
    </div>
  );
}

// Empty state component for no selected conversation
function NoConversationSelectedState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center" data-testid="state-no-selection">
      <div className="w-24 h-24 mb-6 rounded-full bg-muted flex items-center justify-center">
        <MessageCircle className="w-12 h-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
      <p className="text-muted-foreground text-sm max-w-xs">
        Choose a conversation from the list to start messaging
      </p>
    </div>
  );
}

// Chat bubble component with tail
function ChatBubble({ 
  message, 
  isOwn, 
  showTail 
}: { 
  message: Message; 
  isOwn: boolean; 
  showTail: boolean;
}) {
  const messageDate = new Date(message.createdAt!);
  
  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1`}
      data-testid={`message-${message.id}`}
    >
      <div
        className={`relative max-w-[75%] px-3 py-2 ${
          isOwn
            ? `bg-primary text-primary-foreground ${showTail ? "rounded-2xl rounded-br-sm" : "rounded-2xl"}`
            : `bg-muted ${showTail ? "rounded-2xl rounded-bl-sm" : "rounded-2xl"}`
        }`}
      >
        {/* Message content */}
        <p className="text-sm whitespace-pre-wrap break-words" data-testid={`text-message-content-${message.id}`}>
          {message.content}
        </p>
        
        {/* Timestamp and read status */}
        <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
          <span 
            className={`text-[10px] ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}
            data-testid={`text-message-time-${message.id}`}
          >
            {messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          
          {/* Read receipts for sent messages */}
          {isOwn && (
            <span data-testid={`status-message-read-${message.id}`}>
              {message.isRead ? (
                <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/70" />
              ) : (
                <Check className="w-3.5 h-3.5 text-primary-foreground/70" />
              )}
            </span>
          )}
        </div>
        
        {/* Tail indicator */}
        {showTail && (
          <div
            className={`absolute bottom-0 w-3 h-3 ${
              isOwn
                ? "right-0 translate-x-1/2 bg-primary"
                : "left-0 -translate-x-1/2 bg-muted"
            }`}
            style={{
              clipPath: isOwn
                ? "polygon(0 0, 100% 0, 0 100%)"
                : "polygon(100% 0, 0 0, 100% 100%)",
            }}
          />
        )}
      </div>
    </div>
  );
}

// Date separator component
function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="flex items-center justify-center my-4" data-testid="separator-date">
      <div className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
        {formatDateSeparator(date)}
      </div>
    </div>
  );
}

// Thread item component with online status and animations
function ThreadItem({
  thread,
  isSelected,
  onClick,
}: {
  thread: ChatThread;
  isSelected: boolean;
  onClick: () => void;
}) {
  const lastMessageTime = thread.lastMessage?.createdAt
    ? formatRelativeTime(new Date(thread.lastMessage.createdAt))
    : null;

  // Simulate online status (in real app, this would come from WebSocket)
  const isOnline = thread.user.id.charCodeAt(0) % 3 === 0;

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 hover-elevate text-left transition-all duration-200 ${
        isSelected ? "bg-accent" : ""
      }`}
      data-testid={`thread-${thread.user.id}`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar with online indicator */}
        <div className="relative">
          <Avatar>
            <AvatarImage src={thread.user.profileImageUrl || undefined} />
            <AvatarFallback>
              {thread.user.firstName?.[0] || thread.user.email?.[0]}
            </AvatarFallback>
          </Avatar>
          {/* Online/Offline indicator */}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
              isOnline ? "bg-green-500" : "bg-muted-foreground/50"
            }`}
            data-testid={`status-online-${thread.user.id}`}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium truncate" data-testid={`text-thread-name-${thread.user.id}`}>
              {thread.user.firstName || thread.user.email}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {lastMessageTime && (
                <span 
                  className="text-xs text-muted-foreground"
                  data-testid={`text-thread-time-${thread.user.id}`}
                >
                  {lastMessageTime}
                </span>
              )}
              {thread.unreadCount > 0 && (
                <Badge 
                  variant="default" 
                  className="min-w-[20px] h-5 flex items-center justify-center text-xs animate-pulse"
                  data-testid={`badge-unread-${thread.user.id}`}
                >
                  {thread.unreadCount}
                </Badge>
              )}
            </div>
          </div>
          {thread.lastMessage && (
            <p 
              className="text-sm text-muted-foreground truncate mt-0.5"
              data-testid={`text-thread-preview-${thread.user.id}`}
            >
              {thread.lastMessage.content}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// Emoji picker component
function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <div className="grid gap-2" data-testid="picker-emoji">
      {EMOJI_CATEGORIES.map((category) => (
        <div key={category.name}>
          <p className="text-xs text-muted-foreground mb-1">{category.name}</p>
          <div className="grid grid-cols-6 gap-1">
            {category.emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg hover-elevate rounded"
                data-testid={`button-emoji-${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Messages() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const preselectedUserId = searchParams.get("user");
  const isMobile = useIsMobile();
  
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [messageContent, setMessageContent] = useState("");
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>("disconnected");
  const [isTyping, setIsTyping] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (preselectedUserId) {
      if (hasSafetyBeenAcknowledged(preselectedUserId)) {
        setSelectedUser(preselectedUserId);
        setShowMobileChat(true);
      } else {
        setPendingUserId(preselectedUserId);
        setShowSafetyModal(true);
      }
    }
  }, [preselectedUserId]);

  // Fetch chat threads
  const { data: threads, isLoading: threadsLoading } = useQuery<ChatThread[]>({
    queryKey: ["/api/messages/threads"],
  });

  // Fetch messages for selected user
  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", selectedUser],
    enabled: !!selectedUser,
  });

  // Send message mutation with optimistic update
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (wsStatus === "connected" && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "message",
          receiverId: selectedUser,
          content,
        }));
        return { success: true, viaWebSocket: true };
      }

      return await apiRequest("POST", "/api/messages", {
        receiverId: selectedUser,
        content,
      });
    },
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/messages", selectedUser] });

      const previousMessages = queryClient.getQueryData<Message[]>(["/api/messages", selectedUser]);

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        senderId: currentUser?.id || "",
        receiverId: selectedUser || "",
        content,
        isRead: false,
        createdAt: new Date(),
        productId: null,
      };

      queryClient.setQueryData<Message[]>(
        ["/api/messages", selectedUser],
        (old) => [...(old || []), optimisticMessage]
      );

      return { previousMessages, optimisticMessage };
    },
    onSuccess: (data, _, context) => {
      setMessageContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      if (!(data as any)?.viaWebSocket) {
        queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedUser] });
        queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      }
    },
    onError: (error, _, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["/api/messages", selectedUser], context.previousMessages);
      }
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Helper function to append a message to the messages cache
  const appendMessageToCache = useCallback((newMessage: Message, isOwnMessage: boolean = false) => {
    const conversationUserId = newMessage.senderId === currentUser?.id 
      ? newMessage.receiverId 
      : newMessage.senderId;
    
    queryClient.setQueryData<Message[]>(
      ["/api/messages", conversationUserId],
      (oldMessages) => {
        if (!oldMessages) return [newMessage];
        
        // Check if this exact message already exists
        const existingIndex = oldMessages.findIndex(m => m.id === newMessage.id);
        if (existingIndex >= 0) return oldMessages;
        
        // If this is our own sent message, replace any temp messages with matching content
        if (isOwnMessage) {
          const tempIndex = oldMessages.findIndex(
            m => m.id.startsWith('temp-') && 
                 m.content === newMessage.content && 
                 m.senderId === newMessage.senderId
          );
          if (tempIndex >= 0) {
            const updated = [...oldMessages];
            updated[tempIndex] = newMessage;
            return updated;
          }
        }
        
        return [...oldMessages, newMessage];
      }
    );

    queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
  }, [currentUser?.id]);

  // WebSocket connection with proper JWT authentication and reconnection
  useEffect(() => {
    if (!currentUser) return;

    const MAX_RECONNECT_ATTEMPTS = 10;
    const BASE_RECONNECT_DELAY = 1000;

    const connectWebSocket = async () => {
      try {
        setWsStatus("connecting");

        const tokenResponse = await fetch("/api/auth/ws-token", {
          credentials: "include",
        });

        if (!tokenResponse.ok) {
          console.error("Failed to get WebSocket token");
          setWsStatus("error");
          scheduleReconnect();
          return;
        }

        const { token } = await tokenResponse.json();

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log("WebSocket connection opened, authenticating...");
          socket.send(JSON.stringify({ type: "auth", token }));
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "auth_success") {
              console.log("WebSocket authenticated successfully");
              setWsStatus("connected");
              reconnectAttemptRef.current = 0;
            }

            if (data.type === "auth_error") {
              console.error("WebSocket auth error:", data.message);
              setWsStatus("error");
              socket.close();
              scheduleReconnect();
              return;
            }

            if (data.type === "new_message" && data.message) {
              console.log("Received new message via WebSocket:", data.message.id);
              appendMessageToCache(data.message, false);
            }

            if (data.type === "message_sent" && data.message) {
              console.log("Message sent confirmation:", data.message.id);
              appendMessageToCache(data.message, true);
            }

            if (data.type === "typing" && data.userId === selectedUser) {
              setIsTyping(true);
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
              typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        socket.onclose = (event) => {
          console.log("WebSocket closed:", event.code, event.reason);
          setWsStatus("disconnected");
          wsRef.current = null;

          if (event.code !== 1000) {
            scheduleReconnect();
          }
        };

        socket.onerror = (error) => {
          console.error("WebSocket error:", error);
          setWsStatus("error");
        };

        wsRef.current = socket;
      } catch (error) {
        console.error("Failed to connect WebSocket:", error);
        setWsStatus("error");
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.log("Max reconnection attempts reached, stopping reconnection");
        return;
      }

      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
        30000
      );
      
      console.log(`Scheduling reconnection attempt ${reconnectAttemptRef.current + 1} in ${delay}ms`);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptRef.current++;
        connectWebSocket();
      }, delay);
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [currentUser, selectedUser, appendMessageToCache]);

  // Polling fallback - refetch messages every 5 seconds as backup
  useEffect(() => {
    if (!selectedUser) return;

    pollingIntervalRef.current = setInterval(() => {
      if (wsStatus !== "connected") {
        console.log("WebSocket not connected, polling for messages...");
        queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedUser] });
        queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      }
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [selectedUser, wsStatus]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageContent(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim() || !selectedUser) return;
    sendMutation.mutate(messageContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleSelectThread = (userId: string) => {
    if (hasSafetyBeenAcknowledged(userId)) {
      setSelectedUser(userId);
      if (isMobile) {
        setShowMobileChat(true);
      }
    } else {
      setPendingUserId(userId);
      setShowSafetyModal(true);
    }
  };

  const handleSafetyAcknowledge = () => {
    if (pendingUserId) {
      setSelectedUser(pendingUserId);
      if (isMobile) {
        setShowMobileChat(true);
      }
      setPendingUserId(null);
    }
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageContent((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const selectedThread = threads?.find((t) => t.user.id === selectedUser);

  // Filter threads based on search
  const filteredThreads = threads?.filter((thread) => {
    const name = thread.user.firstName || thread.user.email || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group messages by date
  const groupedMessages = messages?.reduce((acc, msg, index, arr) => {
    const msgDate = new Date(msg.createdAt!);
    const prevMsg = arr[index - 1];
    const prevDate = prevMsg ? new Date(prevMsg.createdAt!) : null;

    // Add date separator if it's a new day
    if (!prevDate || !isSameDay(msgDate, prevDate)) {
      acc.push({ type: "separator" as const, date: msgDate });
    }

    // Determine if this message should show a tail
    const nextMsg = arr[index + 1];
    const showTail = !nextMsg || 
      nextMsg.senderId !== msg.senderId ||
      !isSameDay(new Date(nextMsg.createdAt!), msgDate);

    acc.push({ type: "message" as const, message: msg, showTail });
    return acc;
  }, [] as Array<{ type: "separator"; date: Date } | { type: "message"; message: Message; showTail: boolean }>);

  // Thread list content
  const ThreadListContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg mb-3" data-testid="text-messages-title">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9"
            data-testid="input-search-threads"
          />
        </div>
      </div>
      
      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {threadsLoading ? (
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredThreads && filteredThreads.length > 0 ? (
          <div className="divide-y">
            {filteredThreads.map((thread) => (
              <ThreadItem
                key={thread.user.id}
                thread={thread}
                isSelected={selectedUser === thread.user.id}
                onClick={() => handleSelectThread(thread.user.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyConversationsState />
        )}
      </div>
    </div>
  );

  // Chat content
  const ChatContent = (
    <div className="flex-1 flex flex-col h-full">
      {selectedUser ? (
        <>
          {/* Chat Header */}
          <div className="p-4 border-b flex items-center gap-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToList}
                data-testid="button-back-to-list"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="relative">
              <Avatar>
                <AvatarImage src={selectedThread?.user.profileImageUrl || undefined} />
                <AvatarFallback>
                  {selectedThread?.user.firstName?.[0] || selectedThread?.user.email?.[0]}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator */}
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                  (selectedThread?.user.id?.charCodeAt(0) ?? 0) % 3 === 0 ? "bg-green-500" : "bg-muted-foreground/50"
                }`}
                data-testid="status-chat-online"
              />
            </div>
            <div className="flex-1">
              <p className="font-semibold" data-testid="text-chat-user-name">
                {selectedThread?.user.firstName || selectedThread?.user.email}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedThread?.user.isVerified && (
                  <Badge variant="outline" className="text-xs" data-testid="badge-verified">
                    Verified
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground" data-testid="text-chat-status">
                  {(selectedThread?.user.id?.charCodeAt(0) ?? 0) % 3 === 0 ? "Online" : "Offline"}
                </span>
              </div>
            </div>
            {/* Connection status indicator */}
            <div 
              className="flex items-center gap-1 text-xs"
              data-testid="status-connection"
              title={wsStatus === "connected" ? "Real-time updates active" : "Polling for updates"}
            >
              {wsStatus === "connected" ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : wsStatus === "connecting" ? (
                <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messagesLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={i % 2 === 0 ? "flex justify-start" : "flex justify-end"}>
                    <Skeleton className="h-12 w-48 rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : groupedMessages && groupedMessages.length > 0 ? (
              <>
                {groupedMessages.map((item, index) => {
                  if (item.type === "separator") {
                    return <DateSeparator key={`sep-${index}`} date={item.date} />;
                  }
                  return (
                    <ChatBubble
                      key={item.message.id}
                      message={item.message}
                      isOwn={item.message.senderId === currentUser?.id}
                      showTail={item.showTail}
                    />
                  );
                })}
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <EmptyMessagesState userName={selectedThread?.user.firstName || selectedThread?.user.email} />
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-4 border-t">
            <div className="flex items-end gap-2">
              {/* Attachment button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                data-testid="button-attachment"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              
              {/* Message input */}
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={messageContent}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="min-h-[40px] max-h-[120px] resize-none pr-10"
                  rows={1}
                  data-testid="input-message"
                />
                
                {/* Emoji picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 bottom-1 h-8 w-8"
                      data-testid="button-emoji"
                    >
                      <Smile className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="end">
                    <EmojiPicker onSelect={handleEmojiSelect} />
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Send button */}
              <Button
                type="submit"
                size="icon"
                disabled={!messageContent.trim() || sendMutation.isPending}
                className="shrink-0"
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </>
      ) : (
        <NoConversationSelectedState />
      )}
    </div>
  );

  // Mobile layout with Sheet
  if (isMobile) {
    return (
      <>
        <div className="h-[calc(100vh-4rem)] flex flex-col">
          {showMobileChat ? (
            ChatContent
          ) : (
            ThreadListContent
          )}
        </div>
        
        {/* Safety Shield Modal */}
        {pendingUserId && (
          <SafetyShieldModal
            sellerId={pendingUserId}
            open={showSafetyModal}
            onOpenChange={setShowSafetyModal}
            onAcknowledge={handleSafetyAcknowledge}
          />
        )}
      </>
    );
  }

  // Desktop layout
  return (
    <>
      <div className="h-[calc(100vh-4rem)] flex">
        {/* Threads List */}
        <div className="w-80 border-r flex flex-col">
          {ThreadListContent}
        </div>

        {/* Chat Area */}
        {ChatContent}
      </div>
      
      {/* Safety Shield Modal */}
      {pendingUserId && (
        <SafetyShieldModal
          sellerId={pendingUserId}
          open={showSafetyModal}
          onOpenChange={setShowSafetyModal}
          onAcknowledge={handleSafetyAcknowledge}
        />
      )}
    </>
  );
}

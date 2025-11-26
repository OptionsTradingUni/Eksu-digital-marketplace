import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  MessageCircle, 
  X, 
  Send, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  Wallet, 
  ShoppingBag, 
  Shield, 
  Gamepad2, 
  HelpCircle,
  PlusCircle,
  User,
  MessageSquare,
  Gift,
  BarChart3,
  Home,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface QuickAction {
  label: string;
  message: string;
  icon: any;
  navigateTo?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "How to sell?", message: "How do I sell items on this app?", icon: PlusCircle, navigateTo: "/my-ads" },
  { label: "My balance", message: "I want to check my wallet balance", icon: Wallet, navigateTo: "/wallet" },
  { label: "Report scam", message: "I need to report a scammer", icon: AlertTriangle, navigateTo: "/support" },
  { label: "Escrow?", message: "How does escrow work?", icon: Shield },
  { label: "Games", message: "Tell me about the games I can play", icon: Gamepad2, navigateTo: "/games" },
];

const CONTEXT_MESSAGES: Record<string, string> = {
  "/home": "I see you're browsing products! I can help you find items, understand categories, or get the best deals. What are you looking for?",
  "/": "Welcome! I can help you browse products, sell items, check your wallet, or play games. What would you like to do?",
  "/games": "Ready to play? We have Ludo, Word Battle, and Trivia games! You can play for fun or stake money to win. Want to know how any game works?",
  "/wallet": "Looking at your wallet? I can help with deposits, withdrawals, or explain how escrow works. What do you need?",
  "/profile": "Need to update your profile or get verified? I can guide you through student verification or NIN verification for higher trust scores.",
  "/messages": "Chatting with sellers or buyers? Remember to keep all negotiations in-app and ALWAYS use escrow for payments!",
  "/my-ads": "Managing your listings? I can help you boost products, edit listings, or create new ones. What would you like to do?",
  "/referrals": "Want to earn money by referring friends? Share your unique code and get N500 for each verified signup plus 2% of their trading fees!",
  "/support": "Need help? You can submit a support ticket here. For scam reports, I recommend selecting the Scam Report category for faster response.",
  "/seller-dashboard": "Checking your seller stats? I can help you understand your analytics, manage orders, or boost slow-moving products.",
  "/admin": "Admin panel access! You can manage users, products, announcements, and handle disputes from here.",
};

function getPageName(path: string): string {
  const pageNames: Record<string, string> = {
    "/": "Home",
    "/home": "Home",
    "/games": "Games",
    "/wallet": "Wallet",
    "/profile": "Profile",
    "/messages": "Messages",
    "/my-ads": "My Ads",
    "/referrals": "Referrals",
    "/support": "Support",
    "/seller-dashboard": "Seller Dashboard",
    "/admin": "Admin",
    "/notifications": "Notifications",
    "/announcements": "Announcements",
  };
  
  if (path.startsWith("/product/")) return "Product Detail";
  if (path.startsWith("/search")) return "Search";
  
  return pageNames[path] || "App";
}

function formatMessage(content: string): string {
  let formatted = content;
  formatted = formatted.replace(/\*\*\*/g, '');
  formatted = formatted.replace(/\*\*/g, '');
  formatted = formatted.replace(/\*/g, '');
  formatted = formatted.replace(/_{2,}/g, '');
  formatted = formatted.replace(/`{1,3}/g, '');
  formatted = formatted.replace(/^#+\s/gm, '');
  return formatted.trim();
}

const NOTIFICATION_SOUND = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQcAQMC2qaSfkX1pUUQ0JyclKC45UVCKL0ptnLPS3My0mH5xZ19WUk5KPz84NjUzMTAwLy4sKyopJyYlJCMhIB4eHRsaGhkYFxYVFBQTEhEREA8ODg0NDAsLCgoJCQgIBwcGBgUFBQQEBAMDAwICAgIBAQEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQgGRQQDA0KBwUDAQECAgMFBggKDA4REhQYGx0gIycqLC4wMzU3OT0/QUNGSU1QVFhbX2NnamtvdHl+goeLj5OYnKCkqK2xtbnBxszT2d/l7PL4/wCBhYqFbA==";

export default function ChatBot() {
  const [location, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasGreetedForPage, setHasGreetedForPage] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hey! I'm your campus marketplace assistant. I sabi everything about buying, selling, wallet, games, and staying safe from scams. How I fit help you today? Tap any quick action below or ask me anything!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentWarning, setShowPaymentWarning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    audioRef.current.volume = 0.3;
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && location !== hasGreetedForPage && CONTEXT_MESSAGES[location]) {
      const contextMessage = CONTEXT_MESSAGES[location];
      if (contextMessage && messages.length <= 2) {
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.content !== contextMessage) {
            return [...prev, { role: "assistant", content: contextMessage }];
          }
          return prev;
        });
        setHasGreetedForPage(location);
      }
    }
  }, [isOpen, location, hasGreetedForPage, messages.length]);

  const playNotificationSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  const sendMessage = async (messageText?: string, navigateAfter?: string) => {
    const userMessage = (messageText || input).trim();
    if (!userMessage || isLoading) return;

    setInput("");
    setIsLoading(true);
    setShowPaymentWarning(false);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          message: userMessage,
          currentPage: getPageName(location)
        }),
      });

      const data = await res.json();

      if (data.hasPaymentWarning) {
        setShowPaymentWarning(true);
      }

      const formattedMessage = formatMessage(data.message || "I no fit get response now. Try again!");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: formattedMessage },
      ]);

      playNotificationSound();

      if (navigateAfter) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Taking you to ${getPageName(navigateAfter)} now...` },
          ]);
          setTimeout(() => {
            navigate(navigateAfter);
            setIsOpen(false);
          }, 1000);
        }, 1500);
      }
    } catch (error: any) {
      console.error("Chatbot error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Omo, something don wrong. Network no dey flow well. Abeg try again!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.message, action.navigateTo);
  };

  const handleNavigateAction = (path: string, label: string) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `Take me to ${label}` },
      { role: "assistant", content: `No wahala! Taking you to ${label} now...` },
    ]);
    playNotificationSound();
    setTimeout(() => {
      navigate(path);
      setIsOpen(false);
    }, 1000);
  };

  if (!isOpen) {
    return (
      <Button
        size="lg"
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 rounded-full shadow-2xl z-[9999] bg-primary border-2 border-primary-foreground/10 h-14 w-14"
        onClick={() => setIsOpen(true)}
        data-testid="button-open-chatbot"
        aria-label="Open chat assistant"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-background animate-pulse"></span>
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[400px] h-[70vh] sm:h-[600px] max-h-[600px] shadow-2xl flex flex-col z-[9999] border-2 bg-background/95 backdrop-blur-sm" data-testid="card-chatbot">
      <div className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
            <MessageCircle className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Campus AI Assistant</h3>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-xs text-muted-foreground">Online - Pidgin and English</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSoundEnabled(!soundEnabled)}
            data-testid="button-toggle-sound"
            aria-label={soundEnabled ? "Mute notifications" : "Enable notifications"}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            data-testid="button-close-chatbot"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showPaymentWarning && (
        <Alert variant="destructive" className="m-3 mb-0">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            PAYMENT WARNING: Only pay through app escrow! Outside payments = scam risk. We are not responsible!
          </AlertDescription>
        </Alert>
      )}

      <ScrollArea className="flex-1 p-3 bg-background/50 backdrop-blur-sm" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              data-testid={`message-${message.role}-${index}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/80 backdrop-blur-sm"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{formatMessage(message.content)}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start" data-testid="loading-indicator">
              <div className="bg-muted/80 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce"></span>
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.15s" }}></span>
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.3s" }}></span>
                  </div>
                  <span className="text-xs text-muted-foreground">Typing...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t bg-background/80 backdrop-blur-sm space-y-2">
        <div className="flex gap-1.5 flex-wrap" data-testid="quick-actions-container">
          {QUICK_ACTIONS.map((action, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="cursor-pointer text-xs py-1 px-2 flex items-center gap-1"
              onClick={() => handleQuickAction(action)}
              data-testid={`quick-action-${index}`}
            >
              <action.icon className="h-3 w-3" />
              {action.label}
            </Badge>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap" data-testid="navigate-actions-container">
          <Badge
            variant="outline"
            className="cursor-pointer text-xs py-0.5 px-1.5 flex items-center gap-1"
            onClick={() => handleNavigateAction("/home", "Home")}
            data-testid="nav-home"
          >
            <Home className="h-2.5 w-2.5" />
            Home
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer text-xs py-0.5 px-1.5 flex items-center gap-1"
            onClick={() => handleNavigateAction("/wallet", "Wallet")}
            data-testid="nav-wallet"
          >
            <Wallet className="h-2.5 w-2.5" />
            Wallet
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer text-xs py-0.5 px-1.5 flex items-center gap-1"
            onClick={() => handleNavigateAction("/games", "Games")}
            data-testid="nav-games"
          >
            <Gamepad2 className="h-2.5 w-2.5" />
            Games
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer text-xs py-0.5 px-1.5 flex items-center gap-1"
            onClick={() => handleNavigateAction("/profile", "Profile")}
            data-testid="nav-profile"
          >
            <User className="h-2.5 w-2.5" />
            Profile
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer text-xs py-0.5 px-1.5 flex items-center gap-1"
            onClick={() => handleNavigateAction("/support", "Support")}
            data-testid="nav-support"
          >
            <HelpCircle className="h-2.5 w-2.5" />
            Support
          </Badge>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Ask anything... (Pidgin or English)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="flex-1 bg-background/60 backdrop-blur-sm"
            data-testid="input-chatbot-message"
          />
          <Button
            size="icon"
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Currently on: {getPageName(location)}
        </p>
      </div>
    </Card>
  );
}

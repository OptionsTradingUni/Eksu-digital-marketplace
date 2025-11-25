import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, AlertTriangle, HelpCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hey! 👋 I'm your campus marketplace assistant. I know everything about buying, selling, safety, and avoiding scams. How I fit help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentWarning, setShowPaymentWarning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const quickHelp = [
    { topic: "how-to-sell", label: "How to Sell", icon: "📦" },
    { topic: "safety", label: "Safety Tips", icon: "🚨" },
    { topic: "escrow", label: "How Escrow Works", icon: "💰" },
    { topic: "verification", label: "Get Verified", icon: "✅" },
  ];

  const handleQuickHelp = async (topic: string) => {
    try {
      const response = await fetch(`/api/chatbot/quick-help?topic=${topic}`);
      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        { role: "user", content: quickHelp.find(h => h.topic === topic)?.label || topic },
        { role: "assistant", content: data.message },
      ]);
    } catch (error) {
      console.error("Quick help error:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setShowPaymentWarning(false);

    // Add user message to local state immediately for UI
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      // Send only the current message to server (server maintains trusted history)
      const response = await apiRequest("POST", "/api/chatbot", {
        message: userMessage,
      }) as unknown as { message: string; hasPaymentWarning: boolean };

      if (response.hasPaymentWarning) {
        setShowPaymentWarning(true);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.message },
      ]);
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

  if (!isOpen) {
    return (
      <Button
        size="icon"
        className="fixed bottom-6 right-6 rounded-full shadow-2xl z-[100] relative"
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
    <Card className="fixed bottom-6 right-6 w-[90vw] sm:w-[400px] h-[85vh] sm:h-[650px] max-h-[650px] shadow-2xl flex flex-col z-[100] border-2" data-testid="card-chatbot">
      <div className="flex items-center justify-between gap-2 p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Campus AI Assistant</h3>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-xs text-muted-foreground">Online - Always Helpful</span>
            </div>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setIsOpen(false)}
          data-testid="button-close-chatbot"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {showPaymentWarning && (
        <Alert variant="destructive" className="m-4 mb-0">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            🚨 <strong>PAYMENT WARNING:</strong> Only pay through app escrow! Outside payments = scam risk. We're not responsible!
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2 p-3 border-b">
        {quickHelp.map((help) => (
          <Button
            key={help.topic}
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => handleQuickHelp(help.topic)}
            data-testid={`button-quickhelp-${help.topic}`}
          >
            <span className="mr-1">{help.icon}</span>
            {help.label}
          </Button>
        ))}
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              data-testid={`message-${message.role}-${index}`}
            >
              <div
                className={`max-w-[280px] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.role === "assistant" && message.content.includes("🚨") && (
                  <div className="flex items-start gap-2 mb-2">
                    <ShieldCheck className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <span className="text-xs font-semibold text-destructive">Security Alert</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"></span>
                  <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.2s]"></span>
                  <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Ask anything... (Pidgin or English)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="flex-1"
            data-testid="input-chatbot-message"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Powered by AI • Understands Pidgin, Yoruba, Igbo
        </p>
      </div>
    </Card>
  );
}

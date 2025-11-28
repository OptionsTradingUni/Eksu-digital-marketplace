import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Eye,
  Check,
  AlertTriangle,
  Clock,
  Sparkles,
  Lock
} from "lucide-react";

type LinkInfo = {
  title: string;
  backgroundColor: string;
  isActive: boolean;
};

export default function SendSecretPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const { data: linkInfo, isLoading, isError, error } = useQuery<LinkInfo>({
    queryKey: ["/api/secret-links", code],
    queryFn: async () => {
      const res = await fetch(`/api/secret-links/${code}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Link not found");
      }
      return res.json();
    },
    retry: false,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/secret-messages/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send message");
      }
      return data;
    },
    onSuccess: (data) => {
      setSent(true);
      setMessage("");
      toast({
        title: "Message sent!",
        description: data.message || "Your anonymous message has been delivered.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }
    sendMessageMutation.mutate(message);
  };

  const resetForm = () => {
    setSent(false);
    setMessage("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-950/50 to-zinc-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent mb-4"></div>
          <p className="text-purple-300">Loading...</p>
        </motion.div>
      </div>
    );
  }

  if (isError || !linkInfo) {
    const errorMessage = error instanceof Error ? error.message : "Link not found";
    const isInactive = errorMessage.includes("no longer active");
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-950/50 to-zinc-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <Card className="bg-zinc-900/80 border-zinc-800">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
              <h1 className="text-xl font-bold mb-2">
                {isInactive ? "Link Inactive" : "Link Not Found"}
              </h1>
              <p className="text-muted-foreground mb-6">
                {isInactive 
                  ? "This secret message link is no longer accepting messages."
                  : "This secret message link doesn't exist or has been deleted."
                }
              </p>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = "/"}
                data-testid="button-go-home"
              >
                Go to Homepage
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 transition-colors"
      style={{ 
        background: `linear-gradient(to bottom, ${linkInfo.backgroundColor}33, #09090b)` 
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="bg-zinc-900/80 border-zinc-800">
                <CardContent className="p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                    style={{ backgroundColor: `${linkInfo.backgroundColor}33` }}
                  >
                    <Check className="h-10 w-10" style={{ color: linkInfo.backgroundColor }} />
                  </motion.div>
                  <h1 className="text-2xl font-bold mb-2">Message Sent!</h1>
                  <p className="text-muted-foreground mb-6">
                    Your anonymous message has been delivered successfully.
                  </p>
                  <div className="space-y-3">
                    <Button 
                      onClick={resetForm}
                      className="w-full"
                      style={{ backgroundColor: linkInfo.backgroundColor }}
                      data-testid="button-send-another"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Another Message
                    </Button>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Lock className="h-3 w-3" />
                      Your identity is completely anonymous
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="bg-zinc-900/80 border-zinc-800 overflow-visible">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.1 }}
                      className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                      style={{ backgroundColor: `${linkInfo.backgroundColor}33` }}
                    >
                      <Eye className="h-8 w-8" style={{ color: linkInfo.backgroundColor }} />
                    </motion.div>
                    <h1 className="text-xl font-bold mb-2">{linkInfo.title}</h1>
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                      <Lock className="h-3 w-3" />
                      Your message will be completely anonymous
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Textarea
                        data-testid="textarea-secret-message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Write your anonymous message here..."
                        className="min-h-[150px] bg-zinc-800/50 border-zinc-700 focus:border-purple-500 resize-none"
                        maxLength={2000}
                      />
                      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        <span>{message.length}/2000 characters</span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          No one will know it's you
                        </span>
                      </div>
                    </div>

                    <Button 
                      type="submit"
                      className="w-full"
                      style={{ backgroundColor: linkInfo.backgroundColor }}
                      data-testid="button-send-message"
                      disabled={sendMessageMutation.isPending || !message.trim()}
                    >
                      {sendMessageMutation.isPending ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Anonymous Message
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="mt-6 pt-4 border-t border-zinc-800 text-center">
                    <p className="text-xs text-muted-foreground mb-2">
                      Want to create your own secret message link?
                    </p>
                    <Button 
                      variant="ghost" 
                      className="text-purple-400 text-sm"
                      onClick={() => window.location.href = "/"}
                      data-testid="button-create-own-link"
                    >
                      Create your link on EKSU Marketplace
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-6 text-center"
              >
                <p className="text-xs text-zinc-500">
                  Powered by EKSU Marketplace Secret Messages
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

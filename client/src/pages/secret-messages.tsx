import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Link2, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Eye,
  EyeOff,
  MessageSquare,
  Clock,
  Inbox,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import type { SecretMessageLink, SecretMessage } from "@shared/schema";

type SecretMessageWithLink = SecretMessage & { link: SecretMessageLink };

function CreateLinkForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("Send me an anonymous message");
  const [backgroundColor, setBackgroundColor] = useState("#6b21a8");

  const createLinkMutation = useMutation({
    mutationFn: async (data: { title: string; backgroundColor: string }) => {
      const res = await apiRequest("POST", "/api/secret-links", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secret-links/mine"] });
      toast({
        title: "Link created!",
        description: "Your secret message link is ready to share.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create link",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLinkMutation.mutate({ title, backgroundColor });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Prompt Message</Label>
        <Input
          id="title"
          data-testid="input-link-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Send me an anonymous message..."
          maxLength={200}
        />
        <p className="text-xs text-muted-foreground">This is what people will see when they visit your link</p>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="color">Theme Color</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            id="color"
            data-testid="input-link-color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="w-12 h-10 rounded-md border cursor-pointer"
          />
          <Input
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            placeholder="#6b21a8"
            pattern="^#[0-9A-Fa-f]{6}$"
            className="flex-1"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          type="submit" 
          data-testid="button-create-link"
          disabled={createLinkMutation.isPending}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {createLinkMutation.isPending ? "Creating..." : "Create Link"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function LinkCard({ link, onDelete }: { link: SecretMessageLink; onDelete: (id: string) => void }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const fullUrl = `${baseUrl}/secret/${link.linkCode}`;

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/secret-links/${id}/toggle`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secret-links/mine"] });
    },
  });

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="bg-gradient-to-r from-purple-900/40 to-pink-900/30 border-purple-500/30 hover:border-purple-500/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div 
                  className="w-4 h-4 rounded-full shadow-lg" 
                  style={{ backgroundColor: link.backgroundColor || "#6b21a8" }}
                />
                <span className="font-medium text-sm truncate text-purple-100">{link.title}</span>
                <Badge 
                  variant={link.isActive ? "default" : "secondary"}
                  className={link.isActive ? "bg-green-500/30 text-green-300 border-green-500/50" : "bg-zinc-500/30 text-zinc-300 border-zinc-500/30"}
                >
                  {link.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 mb-3">
                <code className="text-xs text-muted-foreground bg-zinc-800/50 px-2 py-1 rounded truncate flex-1">
                  {fullUrl}
                </code>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Created {formatDistanceToNow(new Date(link.createdAt!), { addSuffix: true })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                size="icon" 
                variant="ghost"
                data-testid={`button-copy-link-${link.id}`}
                onClick={copyToClipboard}
                className="h-8 w-8"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button 
                size="icon" 
                variant="ghost"
                data-testid={`button-open-link-${link.id}`}
                onClick={() => window.open(fullUrl, '_blank')}
                className="h-8 w-8"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Switch
                id={`active-${link.id}`}
                data-testid={`switch-link-active-${link.id}`}
                checked={link.isActive || false}
                onCheckedChange={(checked) => toggleMutation.mutate({ id: link.id, isActive: checked })}
              />
              <Label htmlFor={`active-${link.id}`} className="text-sm text-muted-foreground">
                {link.isActive ? "Accepting messages" : "Not accepting messages"}
              </Label>
            </div>
            <Button
              size="sm"
              variant="ghost"
              data-testid={`button-delete-link-${link.id}`}
              onClick={() => onDelete(link.id)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MessageCard({ 
  message, 
  onMarkRead, 
  onDelete 
}: { 
  message: SecretMessageWithLink; 
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className={`bg-gradient-to-r from-purple-900/30 to-pink-900/20 border-purple-500/30 hover:border-purple-500/50 transition-colors ${!message.isRead ? 'border-l-4 border-l-pink-500 shadow-lg shadow-pink-500/20' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{ backgroundColor: message.link.backgroundColor || "#6b21a8" }}
            >
              <Eye className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  Via: {message.link.title}
                </span>
                {!message.isRead && (
                  <Badge className="bg-purple-500/20 text-purple-400 text-xs">New</Badge>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(message.createdAt!), { addSuffix: true })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-zinc-800/50">
            {!message.isRead && (
              <Button
                size="sm"
                variant="ghost"
                data-testid={`button-mark-read-${message.id}`}
                onClick={() => onMarkRead(message.id)}
                className="text-purple-400 hover:text-purple-300"
              >
                <EyeOff className="h-4 w-4 mr-1" />
                Mark as read
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              data-testid={`button-delete-message-${message.id}`}
              onClick={() => onDelete(message.id)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function SecretMessagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'link' | 'message'; id: string } | null>(null);

  const { data: links, isLoading: linksLoading, refetch: refetchLinks } = useQuery<SecretMessageLink[]>({
    queryKey: ["/api/secret-links/mine"],
    refetchInterval: 30000,
  });

  const { data: messages, isLoading: messagesLoading, refetch: refetchMessages } = useQuery<SecretMessageWithLink[]>({
    queryKey: ["/api/secret-messages"],
    refetchInterval: 15000,
  });

  const { data: unreadCount, refetch: refetchUnreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/secret-messages/unread-count"],
    refetchInterval: 15000,
  });

  const handleManualRefresh = () => {
    refetchLinks();
    refetchMessages();
    refetchUnreadCount();
    toast({
      title: "Refreshed",
      description: "Messages updated",
    });
  };

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/secret-messages/${id}/read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secret-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/secret-messages/unread-count"] });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/secret-links/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secret-links/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/secret-messages"] });
      toast({
        title: "Link deleted",
        description: "The link and all associated messages have been deleted.",
      });
      setDeleteTarget(null);
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/secret-messages/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secret-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/secret-messages/unread-count"] });
      toast({
        title: "Message deleted",
        description: "The message has been deleted.",
      });
      setDeleteTarget(null);
    },
  });

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'link') {
      deleteLinkMutation.mutate(deleteTarget.id);
    } else {
      deleteMessageMutation.mutate(deleteTarget.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950/20 to-background pb-20 lg:pb-4">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/confessions">
            <Button variant="ghost" size="icon" data-testid="button-back-confessions">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-400" />
              Secret Messages
            </h1>
            <p className="text-sm text-muted-foreground">Create links to receive anonymous messages</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleManualRefresh}
            data-testid="button-refresh-messages"
            className="text-purple-400 hover:text-purple-300"
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="bg-gradient-to-r from-purple-900/40 via-purple-800/30 to-pink-900/30 border-purple-500/40 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-semibold text-purple-100 text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-300" />
                    Create a new link
                  </h3>
                  <p className="text-sm text-purple-300/80 mt-1">Share with anyone and receive anonymous messages</p>
                </div>
                <Button 
                  data-testid="button-create-new-link"
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white whitespace-nowrap"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Link
                </Button>
              </div>
            </CardContent>
          </Card>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold">My Links</h2>
              {links && links.length > 0 && (
                <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                  {links.length}
                </Badge>
              )}
            </div>
            
            {linksLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : links && links.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence>
                  {links.map((link) => (
                    <LinkCard 
                      key={link.id} 
                      link={link} 
                      onDelete={(id) => setDeleteTarget({ type: 'link', id })}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <Card className="bg-zinc-900/50 border-zinc-800/50">
                <CardContent className="p-8 text-center">
                  <Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">No links created yet</p>
                  <p className="text-sm text-muted-foreground/70 mb-4">Create your first link to start receiving anonymous messages</p>
                  <Button 
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Link
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Inbox className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold">Received Messages</h2>
              {unreadCount && unreadCount.count > 0 && (
                <Badge className="bg-purple-500 text-white">
                  {unreadCount.count} new
                </Badge>
              )}
            </div>

            {messagesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : messages && messages.length > 0 ? (
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-3 pr-4">
                  <AnimatePresence>
                    {messages.map((message) => (
                      <MessageCard
                        key={message.id}
                        message={message}
                        onMarkRead={(id) => markReadMutation.mutate(id)}
                        onDelete={(id) => setDeleteTarget({ type: 'message', id })}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            ) : (
              <Card className="bg-zinc-900/50 border-zinc-800/50">
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">No messages yet</p>
                  <p className="text-sm text-muted-foreground/70">Share your link to start receiving anonymous messages</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-purple-400" />
              Create Secret Message Link
            </DialogTitle>
            <DialogDescription>
              Create a link that you can share. Anyone with the link can send you anonymous messages.
            </DialogDescription>
          </DialogHeader>
          <CreateLinkForm onClose={() => setShowCreateDialog(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === 'link' 
                ? "Are you sure you want to delete this link? All messages associated with it will also be deleted."
                : "Are you sure you want to delete this message? This action cannot be undone."
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button 
              variant="destructive"
              data-testid="button-confirm-delete"
              onClick={handleDelete}
              disabled={deleteLinkMutation.isPending || deleteMessageMutation.isPending}
            >
              {deleteLinkMutation.isPending || deleteMessageMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

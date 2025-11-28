import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Eye,
  Lock,
  MessageCircle,
  Sparkles,
  ArrowRight,
  Shield,
  User,
  Ghost,
  Link2,
  Copy,
  Check
} from "lucide-react";

export default function SecretHubPage() {
  const [copied, setCopied] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const copyLink = () => {
    navigator.clipboard.writeText(baseUrl + "/secret");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/20 border border-purple-500/30 mb-6">
            <Ghost className="h-10 w-10 text-purple-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Anonymous Secret Messages
          </h1>
          <p className="text-lg text-purple-200/70">
            Send and receive anonymous messages. Complete privacy guaranteed.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="grid gap-4 mb-8"
        >
          <Card className="bg-zinc-900/80 border-purple-500/20 hover:border-purple-500/40 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Eye className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    100% Anonymous
                  </h3>
                  <p className="text-sm text-gray-400">
                    Your identity is completely hidden. The recipient will never know who sent the message.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/80 border-purple-500/20 hover:border-purple-500/40 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Lock className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    End-to-End Privacy
                  </h3>
                  <p className="text-sm text-gray-400">
                    No tracking, no logs. Your messages are private between you and the recipient.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/80 border-purple-500/20 hover:border-purple-500/40 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Link2 className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Create Your Link
                  </h3>
                  <p className="text-sm text-gray-400">
                    Sign in to create your personal anonymous message link and share it anywhere.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-4"
        >
          <Link href="/api/login">
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 text-lg"
              data-testid="button-login-secret"
            >
              <User className="h-5 w-5 mr-2" />
              Sign In to Get Started
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>

          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Or share this page</p>
            <Button 
              variant="outline" 
              onClick={copyLink}
              className="bg-zinc-900/50 border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
              data-testid="button-copy-hub-link"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Link Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Page Link
                </>
              )}
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-12 pt-8 border-t border-purple-500/10"
        >
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Shield className="h-4 w-4" />
            <span>Part of EKSU Marketplace</span>
          </div>
          <p className="text-center text-xs text-gray-600 mt-2">
            Powered by secure, anonymous messaging technology
          </p>
        </motion.div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Shield, CheckCircle, Copy, Eye, EyeOff, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface TerminalLine {
  id: number;
  text: string;
  type: "command" | "output" | "success" | "warning" | "error" | "info" | "code";
  delay?: number;
}

interface ApiCredentials {
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
}

interface ApiTerminalProps {
  isOpen: boolean;
  onComplete: (credentials: ApiCredentials) => void;
  onClose: () => void;
  siteName: string;
  tier: string;
  isAdmin?: boolean;
}

const generateRandomString = (length: number, prefix: string = ""): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const TERMINAL_SEQUENCE: TerminalLine[] = [
  { id: 1, text: "$ eksuplug-cli api:generate --secure", type: "command", delay: 0 },
  { id: 2, text: "Initializing secure API credential generator...", type: "output", delay: 500 },
  { id: 3, text: "[INFO] Connecting to EKSU Digital Marketplace Core...", type: "info", delay: 1000 },
  { id: 4, text: "[OK] Connection established", type: "success", delay: 1500 },
  { id: 5, text: "", type: "output", delay: 1700 },
  { id: 6, text: "=== SECURITY VERIFICATION ===", type: "warning", delay: 2000 },
  { id: 7, text: "[WARN] This action will generate permanent API credentials", type: "warning", delay: 2300 },
  { id: 8, text: "[WARN] Store these credentials securely - they cannot be retrieved again", type: "warning", delay: 2600 },
  { id: 9, text: "[WARN] Never share your API Secret with anyone", type: "warning", delay: 2900 },
  { id: 10, text: "", type: "output", delay: 3100 },
  { id: 11, text: "[INFO] Generating cryptographic entropy...", type: "info", delay: 3400 },
  { id: 12, text: "████████████████████████████████ 100%", type: "output", delay: 3900 },
  { id: 13, text: "[OK] Entropy pool ready", type: "success", delay: 4200 },
  { id: 14, text: "", type: "output", delay: 4300 },
  { id: 15, text: "[INFO] Creating API Key (Public)...", type: "info", delay: 4500 },
  { id: 16, text: "API_KEY_PLACEHOLDER", type: "code", delay: 5000 },
  { id: 17, text: "[OK] API Key generated", type: "success", delay: 5300 },
  { id: 18, text: "", type: "output", delay: 5400 },
  { id: 19, text: "[INFO] Creating API Secret (Private)...", type: "info", delay: 5600 },
  { id: 20, text: "[WARN] ⚠ CRITICAL: Store this secret securely!", type: "warning", delay: 5900 },
  { id: 21, text: "API_SECRET_PLACEHOLDER", type: "code", delay: 6400 },
  { id: 22, text: "[OK] API Secret generated", type: "success", delay: 6700 },
  { id: 23, text: "", type: "output", delay: 6800 },
  { id: 24, text: "[INFO] Creating Webhook Secret...", type: "info", delay: 7000 },
  { id: 25, text: "WEBHOOK_SECRET_PLACEHOLDER", type: "code", delay: 7500 },
  { id: 26, text: "[OK] Webhook Secret generated", type: "success", delay: 7800 },
  { id: 27, text: "", type: "output", delay: 7900 },
  { id: 28, text: "=== API RATE LIMITS ===", type: "info", delay: 8100 },
  { id: 29, text: "Requests per minute: 100", type: "output", delay: 8400 },
  { id: 30, text: "Daily request limit: 10,000", type: "output", delay: 8600 },
  { id: 31, text: "", type: "output", delay: 8700 },
  { id: 32, text: "=== ENDPOINTS ACTIVATED ===", type: "info", delay: 8900 },
  { id: 33, text: "POST /api/v1/data/purchase", type: "output", delay: 9100 },
  { id: 34, text: "POST /api/v1/airtime/purchase", type: "output", delay: 9300 },
  { id: 35, text: "GET  /api/v1/plans", type: "output", delay: 9500 },
  { id: 36, text: "GET  /api/v1/balance", type: "output", delay: 9700 },
  { id: 37, text: "GET  /api/v1/transactions", type: "output", delay: 9900 },
  { id: 38, text: "", type: "output", delay: 10000 },
  { id: 39, text: "[SUCCESS] API credentials generated successfully!", type: "success", delay: 10200 },
  { id: 40, text: "[INFO] Your API is now ACTIVE", type: "info", delay: 10500 },
  { id: 41, text: "", type: "output", delay: 10600 },
  { id: 42, text: "$ _", type: "command", delay: 10800 },
];

export function ApiTerminal({ isOpen, onComplete, onClose, siteName, tier, isAdmin }: ApiTerminalProps) {
  const [displayedLines, setDisplayedLines] = useState<TerminalLine[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [credentials, setCredentials] = useState<ApiCredentials | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const generateCredentials = useCallback((): ApiCredentials => {
    const apiKey = generateRandomString(32, "pk_live_");
    const apiSecret = generateRandomString(32, "sk_live_");
    const webhookSecret = generateRandomString(32, "whsec_");
    return { apiKey, apiSecret, webhookSecret };
  }, []);

  useEffect(() => {
    if (isOpen && !isGenerating && !isComplete) {
      setIsGenerating(true);
      setDisplayedLines([]);
      setCurrentIndex(0);
      const creds = generateCredentials();
      setCredentials(creds);
    }
  }, [isOpen, isGenerating, isComplete, generateCredentials]);

  useEffect(() => {
    if (!isGenerating || !credentials) return;

    if (currentIndex >= TERMINAL_SEQUENCE.length) {
      setIsComplete(true);
      setIsGenerating(false);
      return;
    }

    const currentLine = TERMINAL_SEQUENCE[currentIndex];
    const delay = currentLine.delay || 0;
    const prevDelay = currentIndex > 0 ? TERMINAL_SEQUENCE[currentIndex - 1].delay || 0 : 0;
    const actualDelay = delay - prevDelay;

    const timer = setTimeout(() => {
      let lineText = currentLine.text;
      if (lineText === "API_KEY_PLACEHOLDER") {
        lineText = credentials.apiKey;
      } else if (lineText === "API_SECRET_PLACEHOLDER") {
        lineText = credentials.apiSecret;
      } else if (lineText === "WEBHOOK_SECRET_PLACEHOLDER") {
        lineText = credentials.webhookSecret;
      }

      setDisplayedLines(prev => [...prev, { ...currentLine, text: lineText }]);
      setCurrentIndex(prev => prev + 1);
    }, actualDelay);

    return () => clearTimeout(timer);
  }, [currentIndex, isGenerating, credentials]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [displayedLines]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const handleComplete = () => {
    if (credentials) {
      onComplete(credentials);
    }
  };

  const getLineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "command":
        return "text-green-400";
      case "success":
        return "text-green-500";
      case "warning":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      case "info":
        return "text-cyan-400";
      case "code":
        return "text-purple-400 font-mono bg-purple-900/30 px-2 py-0.5 rounded";
      default:
        return "text-gray-300";
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-3xl bg-gray-950 rounded-lg border border-gray-800 shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-green-500" />
              <span className="text-sm font-mono text-gray-400">
                EKSU API Generator - {siteName} ({tier})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
          </div>

          <div
            ref={terminalRef}
            className="h-96 overflow-y-auto p-4 font-mono text-sm bg-gray-950"
            data-testid="terminal-output"
          >
            {displayedLines.map((line, index) => (
              <motion.div
                key={line.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.1 }}
                className={`${getLineColor(line.type)} ${line.text === "" ? "h-4" : ""}`}
              >
                {line.type === "code" ? (
                  <div className="flex items-center gap-2 my-1">
                    <code className={getLineColor(line.type)}>{line.text}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-gray-400 hover:text-white"
                      onClick={() => copyToClipboard(line.text, "Credential")}
                      data-testid={`button-copy-${line.id}`}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  line.text
                )}
              </motion.div>
            ))}
            
            {isGenerating && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-green-400"
              >
                _
              </motion.span>
            )}
          </div>

          {isComplete && credentials && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-gray-900 border-t border-gray-800 space-y-4"
            >
              <div className="flex items-start gap-3 p-3 rounded-md bg-yellow-900/20 border border-yellow-800">
                <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-yellow-500">Security Warning</p>
                  <p className="text-yellow-400/80">
                    Save these credentials now. The API Secret will not be shown again after you close this window.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-md bg-gray-800">
                  <div>
                    <p className="text-xs text-gray-400">API Key (Public)</p>
                    <code className="text-green-400 font-mono text-sm">{credentials.apiKey}</code>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(credentials.apiKey, "API Key")}
                    data-testid="button-copy-api-key"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-gray-800">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400">API Secret (Private)</p>
                    <div className="flex items-center gap-2">
                      <code className="text-purple-400 font-mono text-sm">
                        {showSecret ? credentials.apiSecret : "sk_live_" + "*".repeat(28)}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowSecret(!showSecret)}
                        data-testid="button-toggle-secret"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(credentials.apiSecret, "API Secret")}
                    data-testid="button-copy-api-secret"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-gray-800">
                  <div>
                    <p className="text-xs text-gray-400">Webhook Secret</p>
                    <code className="text-cyan-400 font-mono text-sm">{credentials.webhookSecret}</code>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(credentials.webhookSecret, "Webhook Secret")}
                    data-testid="button-copy-webhook-secret"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Shield className="h-5 w-5 text-green-500" />
                <p className="text-sm text-gray-400">
                  Your API is now active and ready to use. Check the documentation for integration guides.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={onClose} data-testid="button-close-terminal">
                  Close
                </Button>
                <Button onClick={handleComplete} data-testid="button-save-credentials">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  I've Saved My Credentials
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ApiTerminal;

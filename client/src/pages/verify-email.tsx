import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { CheckCircle2, XCircle, Loader2, Mail, ArrowRight, RefreshCw, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

type VerificationStatus = "idle" | "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const token = new URLSearchParams(searchParams).get("token");
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [tokenStatus, setTokenStatus] = useState<VerificationStatus>(token ? "loading" : "idle");
  const [tokenMessage, setTokenMessage] = useState("");
  
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<VerificationStatus>("idle");
  const [codeMessage, setCodeMessage] = useState("");
  
  const [resendStatus, setResendStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [resendMessage, setResendMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const showCodeInput = !token || tokenStatus === "error";
  const overallSuccess = tokenStatus === "success" || codeStatus === "success";

  useEffect(() => {
    if (!token) {
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email/${token}`);
        const data = await response.json();

        if (response.ok) {
          setTokenStatus("success");
          setTokenMessage(data.message || "Your email has been verified successfully!");
        } else {
          setTokenStatus("error");
          setTokenMessage(data.message || "Failed to verify email. The link may have expired.");
        }
      } catch (error) {
        setTokenStatus("error");
        setTokenMessage("An error occurred while verifying your email. Please try again.");
      }
    };

    verifyEmail();
  }, [token]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeVerification = async () => {
    if (code.length !== 6) {
      setCodeMessage("Please enter a complete 6-digit code");
      return;
    }

    setCodeStatus("loading");
    setCodeMessage("");

    try {
      const response = await apiRequest("POST", "/api/auth/verify-email-code", { code });
      const data = await response.json();

      if (response.ok && data.success) {
        setCodeStatus("success");
        setCodeMessage(data.message || "Your email has been verified successfully!");
      } else {
        setCodeStatus("error");
        setCodeMessage(data.message || "Invalid or expired verification code.");
      }
    } catch (error: any) {
      setCodeStatus("error");
      setCodeMessage(error.message || "An error occurred. Please try again.");
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setResendStatus("loading");
    setResendMessage("");

    try {
      const response = await apiRequest("POST", "/api/auth/send-verification-email", {});
      const data = await response.json();

      if (response.ok) {
        setResendStatus("success");
        setResendMessage("Verification email sent! Check your inbox.");
        setResendCooldown(60);
        setCode("");
        setCodeStatus("idle");
        setCodeMessage("");
      } else {
        setResendStatus("error");
        setResendMessage(data.message || "Failed to send verification email.");
      }
    } catch (error: any) {
      setResendStatus("error");
      setResendMessage(error.message || "An error occurred. Please try again.");
    }
  };

  const getStatusIcon = () => {
    if (overallSuccess) {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center"
        >
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </motion.div>
      );
    }

    if (tokenStatus === "loading" || codeStatus === "loading") {
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <Loader2 className="h-8 w-8 text-primary" />
        </motion.div>
      );
    }

    if (showCodeInput) {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <KeyRound className="h-8 w-8 text-primary" />
        </motion.div>
      );
    }

    return null;
  };

  const getTitle = () => {
    if (overallSuccess) return "Email Verified!";
    if (tokenStatus === "loading") return "Verifying Email...";
    if (codeStatus === "loading") return "Verifying Code...";
    if (showCodeInput) return "Verify Your Email";
    return "Email Verification";
  };

  const getDescription = () => {
    if (overallSuccess) {
      return tokenMessage || codeMessage;
    }
    if (tokenStatus === "loading") {
      return "Please wait while we verify your email address...";
    }
    if (codeStatus === "loading") {
      return "Checking your verification code...";
    }
    if (showCodeInput) {
      if (tokenStatus === "error" && tokenMessage) {
        return tokenMessage;
      }
      return "Enter the 6-digit verification code sent to your email.";
    }
    return "";
  };

  if (authLoading && showCodeInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <Loader2 className="h-8 w-8 text-primary" />
                </motion.div>
              </div>
              <CardTitle className="text-2xl">Loading...</CardTitle>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-2xl" data-testid="text-verification-title">
              {getTitle()}
            </CardTitle>
            <CardDescription className="mt-2" data-testid="text-verification-message">
              {getDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <AnimatePresence mode="wait">
              {overallSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <p className="text-center text-sm text-muted-foreground">
                    You can now access all features of EKSU Marketplace.
                  </p>
                  <Button 
                    className="w-full" 
                    onClick={() => setLocation("/")}
                    data-testid="button-go-to-home"
                  >
                    Go to Marketplace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              ) : showCodeInput ? (
                <motion.div
                  key="code-input"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {!isAuthenticated ? (
                    <div className="space-y-4">
                      <p className="text-center text-sm text-muted-foreground">
                        Please log in to verify your email with a code, or use the verification link sent to your email.
                      </p>
                      <Button 
                        variant="outline"
                        className="w-full" 
                        onClick={() => setLocation("/")}
                        data-testid="button-go-to-login"
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Go to Login
                      </Button>
                    </div>
                  ) : user?.emailVerified ? (
                    <div className="space-y-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="mx-auto h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center"
                      >
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                      </motion.div>
                      <p className="text-center text-sm text-muted-foreground">
                        Your email is already verified!
                      </p>
                      <Button 
                        className="w-full" 
                        onClick={() => setLocation("/")}
                        data-testid="button-go-to-home-verified"
                      >
                        Go to Marketplace
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex justify-center">
                          <InputOTP
                            maxLength={6}
                            value={code}
                            onChange={setCode}
                            disabled={codeStatus === "loading"}
                            data-testid="input-verification-code"
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        
                        {codeStatus === "error" && codeMessage && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-destructive text-center"
                            data-testid="text-code-error"
                          >
                            {codeMessage}
                          </motion.p>
                        )}

                        <Button 
                          className="w-full"
                          onClick={handleCodeVerification}
                          disabled={code.length !== 6 || codeStatus === "loading"}
                          data-testid="button-verify-code"
                        >
                          {codeStatus === "loading" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Verify with Code
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">
                            Didn't receive the code?
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Button 
                          variant="outline"
                          className="w-full"
                          onClick={handleResendCode}
                          disabled={resendStatus === "loading" || resendCooldown > 0}
                          data-testid="button-resend-code"
                        >
                          {resendStatus === "loading" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : resendCooldown > 0 ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Resend in {resendCooldown}s
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Resend Code
                            </>
                          )}
                        </Button>

                        {resendStatus === "success" && resendMessage && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-green-600 text-center"
                            data-testid="text-resend-success"
                          >
                            {resendMessage}
                          </motion.p>
                        )}

                        {resendStatus === "error" && resendMessage && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-destructive text-center"
                            data-testid="text-resend-error"
                          >
                            {resendMessage}
                          </motion.p>
                        )}

                        <p className="text-xs text-muted-foreground text-center">
                          Check your spam folder if you don't see the email in your inbox.
                        </p>
                      </div>

                      <Button 
                        variant="ghost"
                        className="w-full"
                        onClick={() => setLocation("/")}
                        data-testid="button-back-to-home"
                      >
                        <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                        Back to Home
                      </Button>
                    </>
                  )}
                </motion.div>
              ) : tokenStatus === "loading" ? (
                <motion.p
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-sm text-muted-foreground"
                >
                  Please wait while we verify your email address...
                </motion.p>
              ) : null}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

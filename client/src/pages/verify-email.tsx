import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Mail, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const token = new URLSearchParams(searchParams).get("token");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email/${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message || "Your email has been verified successfully!");
        } else {
          setStatus("error");
          setMessage(data.message || "Failed to verify email. The link may have expired.");
        }
      } catch (error) {
        setStatus("error");
        setMessage("An error occurred while verifying your email. Please try again.");
      }
    };

    verifyEmail();
  }, [token]);

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
              {status === "loading" && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <Loader2 className="h-8 w-8 text-primary" />
                </motion.div>
              )}
              {status === "success" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center"
                >
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </motion.div>
              )}
              {status === "error" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center"
                >
                  <XCircle className="h-8 w-8 text-destructive" />
                </motion.div>
              )}
            </div>
            <CardTitle className="text-2xl">
              {status === "loading" && "Verifying Email..."}
              {status === "success" && "Email Verified!"}
              {status === "error" && "Verification Failed"}
            </CardTitle>
            <CardDescription className="mt-2">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {status === "success" && (
              <div className="space-y-4">
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
              </div>
            )}
            {status === "error" && (
              <div className="space-y-4">
                <p className="text-center text-sm text-muted-foreground">
                  The verification link may have expired or is invalid. Please request a new verification email.
                </p>
                <Button 
                  variant="outline"
                  className="w-full" 
                  onClick={() => setLocation("/")}
                  data-testid="button-back-to-home"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </div>
            )}
            {status === "loading" && (
              <p className="text-center text-sm text-muted-foreground">
                Please wait while we verify your email address...
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

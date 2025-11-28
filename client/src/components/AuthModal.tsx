import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Mail, Lock, User, Phone, ArrowLeft, Store, ShoppingCart, Gift, Check, AtSign, Loader2, X, CheckCircle2, Shield, RefreshCw } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type PasswordStrength = "weak" | "medium" | "strong";

interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number;
  requirements: {
    minLength: boolean;
    hasLowercase: boolean;
    hasUppercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}

function calculatePasswordStrength(password: string): PasswordStrengthResult {
  const requirements = {
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  let score = 0;
  if (requirements.minLength) score += 1;
  if (requirements.hasLowercase) score += 1;
  if (requirements.hasUppercase) score += 1;
  if (requirements.hasNumber) score += 1;
  if (requirements.hasSpecialChar) score += 1;

  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  let strength: PasswordStrength = "weak";
  if (score >= 5) strength = "strong";
  else if (score >= 3) strength = "medium";

  return { strength, score, requirements };
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  const result = useMemo(() => calculatePasswordStrength(password), [password]);
  
  if (!password) return null;

  const strengthConfig = {
    weak: { 
      color: "bg-red-500 dark:bg-red-400", 
      width: "33%", 
      text: "Weak",
      textColor: "text-red-600 dark:text-red-400"
    },
    medium: { 
      color: "bg-yellow-500 dark:bg-yellow-400", 
      width: "66%", 
      text: "Medium",
      textColor: "text-yellow-600 dark:text-yellow-400"
    },
    strong: { 
      color: "bg-green-500 dark:bg-green-400", 
      width: "100%", 
      text: "Strong",
      textColor: "text-green-600 dark:text-green-400"
    },
  };

  const config = strengthConfig[result.strength];

  return (
    <div className="space-y-1 mt-1.5" data-testid="password-strength-indicator">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Shield className={`h-3 w-3 ${config.textColor}`} />
          <span className={`text-xs font-medium ${config.textColor}`} data-testid="password-strength-text">
            {config.text}
          </span>
        </div>
      </div>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${config.color}`}
          style={{ width: config.width }}
          data-testid="password-strength-bar"
        />
      </div>
      <div className="flex flex-wrap gap-1 text-[10px]">
        <span className={result.requirements.minLength ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
          8+ chars
        </span>
        <span className="text-muted-foreground">|</span>
        <span className={result.requirements.hasLowercase ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
          a-z
        </span>
        <span className="text-muted-foreground">|</span>
        <span className={result.requirements.hasUppercase ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
          A-Z
        </span>
        <span className="text-muted-foreground">|</span>
        <span className={result.requirements.hasNumber ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
          0-9
        </span>
        <span className="text-muted-foreground">|</span>
        <span className={result.requirements.hasSpecialChar ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
          !@#$
        </span>
      </div>
    </div>
  );
}

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .refine((password) => {
      const result = calculatePasswordStrength(password);
      return result.strength !== "weak";
    }, "Password too weak. Add uppercase, numbers, or special characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  phoneNumber: z.string().optional(),
  role: z.enum(["buyer", "seller"]).default("buyer"),
  referralCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const verificationCodeSchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type SignInFormData = z.infer<typeof signInSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type VerificationCodeFormData = z.infer<typeof verificationCodeSchema>;

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "signin" | "signup";
  defaultRole?: "buyer" | "seller";
  defaultReferralCode?: string;
}

export function AuthModal({ open, onOpenChange, defaultTab = "signin", defaultRole = "buyer", defaultReferralCode = "" }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      setShowForgotPassword(false);
      setShowVerification(false);
      setVerificationCode("");
      setRegisteredEmail("");
    }
  }, [open, defaultTab]);

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      username: "",
      phoneNumber: "",
      role: defaultRole,
      referralCode: defaultReferralCode,
    },
  });

  // Username availability checking state
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [usernameMessage, setUsernameMessage] = useState<string>("");
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounced username availability check
  const checkUsernameAvailability = useCallback(async (username: string) => {
    // Clear any existing timeout
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }
    
    // Don't check if username is too short
    if (!username || username.length < 3) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }
    
    // Basic validation before API call
    if (username.length > 30) {
      setUsernameStatus("invalid");
      setUsernameMessage("Username must be at most 30 characters");
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus("invalid");
      setUsernameMessage("Only letters, numbers, and underscores allowed");
      return;
    }
    
    // Set checking state
    setUsernameStatus("checking");
    setUsernameMessage("Checking availability...");
    
    // Debounce: wait 500ms before checking
    usernameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/auth/check-username/${encodeURIComponent(username.toLowerCase())}`);
        const data = await response.json();
        
        if (response.ok) {
          if (data.available) {
            setUsernameStatus("available");
            setUsernameMessage("Username is available");
          } else {
            setUsernameStatus("taken");
            setUsernameMessage(data.message || "Username is already taken");
          }
        } else {
          setUsernameStatus("invalid");
          setUsernameMessage(data.message || "Error checking username");
        }
      } catch (error) {
        setUsernameStatus("idle");
        setUsernameMessage("");
        console.error("Error checking username:", error);
      }
    }, 500);
  }, []);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    if (open && defaultRole) {
      signUpForm.setValue("role", defaultRole);
    }
  }, [open, defaultRole]);

  useEffect(() => {
    if (open && defaultReferralCode) {
      signUpForm.setValue("referralCode", defaultReferralCode);
    }
  }, [open, defaultReferralCode]);

  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const signInMutation = useMutation({
    mutationFn: async (data: SignInFormData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onOpenChange(false);
      signInForm.reset();
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Sign in failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const signUpMutation = useMutation({
    mutationFn: async (data: SignUpFormData) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Account created!",
        description: "Check your email for the verification code.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setRegisteredEmail(variables.email);
      setShowVerification(true);
      signUpForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Sign up failed",
        description: error.message || "Unable to create account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/auth/verify-email-code", { code });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email verified!",
        description: "Your account is now fully set up.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onOpenChange(false);
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid or expired code. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/send-verification-email", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Code resent!",
        description: "Check your email for the new verification code.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to resend",
        description: error.message || "Unable to resend code. Please try again.",
        variant: "destructive",
      });
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reset link sent!",
        description: "Check your email for password reset instructions.",
      });
      setShowForgotPassword(false);
      forgotPasswordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Request failed",
        description: error.message || "Unable to send reset link. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSignIn = (data: SignInFormData) => {
    signInMutation.mutate(data);
  };

  const onSignUp = (data: SignUpFormData) => {
    signUpMutation.mutate(data);
  };

  const onForgotPassword = (data: ForgotPasswordFormData) => {
    forgotPasswordMutation.mutate(data);
  };

  if (showForgotPassword) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto" data-testid="dialog-forgot-password">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowForgotPassword(false)}
                data-testid="button-back-to-signin"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="rounded-full bg-primary/10 p-1.5">
                <Lock className="h-4 w-4 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-xl">Reset Password</DialogTitle>
            <DialogDescription className="text-sm">
              Enter your email to receive a reset link.
            </DialogDescription>
          </DialogHeader>

          <Form {...forgotPasswordForm}>
            <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPassword)} className="space-y-3 mt-2">
              <FormField
                control={forgotPasswordForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="you@eksu.edu.ng"
                          className="pl-10"
                          data-testid="input-forgot-password-email"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={forgotPasswordMutation.isPending}
                data-testid="button-send-reset-link"
              >
                {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  if (showVerification) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setShowVerification(false);
          setVerificationCode("");
          setLocation("/");
        }
        onOpenChange(isOpen);
      }}>
        <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto" data-testid="dialog-verification">
          <DialogHeader className="text-center">
            <div className="mx-auto rounded-full bg-primary/10 p-3 mb-2">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Verify Your Email</DialogTitle>
            <DialogDescription className="text-sm">
              We sent a 6-digit code to <span className="font-medium">{registeredEmail}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={verificationCode}
                onChange={setVerificationCode}
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

            <Button
              type="button"
              className="w-full"
              disabled={verificationCode.length !== 6 || verifyCodeMutation.isPending}
              onClick={() => verifyCodeMutation.mutate(verificationCode)}
              data-testid="button-verify-code"
            >
              {verifyCodeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verify Email
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Didn't receive the code?</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={resendVerificationMutation.isPending}
                onClick={() => resendVerificationMutation.mutate()}
                data-testid="button-resend-verification"
              >
                {resendVerificationMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Resend
                  </>
                )}
              </Button>
            </div>

            <div className="text-center pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowVerification(false);
                  onOpenChange(false);
                  setLocation("/");
                }}
                data-testid="button-skip-verification"
              >
                Skip for now
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                You can verify later from your profile settings
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto p-0 gap-0" data-testid="dialog-auth">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 border-b sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary p-2">
              <ShoppingBag className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-lg">EKSU Marketplace</DialogTitle>
              <DialogDescription className="text-xs">
                Join students trading safely on campus
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin" data-testid="tab-signin">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup">
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-0">
              <Form {...signInForm}>
                <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-3">
                  <FormField
                    control={signInForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="you@eksu.edu.ng"
                              className="pl-10"
                              data-testid="input-signin-email"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signInForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="password"
                              placeholder="Enter your password"
                              className="pl-10"
                              data-testid="input-signin-password"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-0 text-xs h-auto"
                      onClick={() => setShowForgotPassword(true)}
                      data-testid="button-forgot-password"
                    >
                      Forgot password?
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={signInMutation.isPending}
                    data-testid="button-signin-submit"
                  >
                    {signInMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              <Form {...signUpForm}>
                <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={signUpForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">First Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="John"
                                className="pl-10"
                                data-testid="input-signup-firstname"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={signUpForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Last Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="Doe"
                                className="pl-10"
                                data-testid="input-signup-lastname"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={signUpForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="you@eksu.edu.ng"
                              className="pl-10"
                              data-testid="input-signup-email"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="johndoe123"
                              className={`pl-10 pr-10 ${
                                usernameStatus === "available" 
                                  ? "border-green-500 focus-visible:ring-green-500" 
                                  : usernameStatus === "taken" || usernameStatus === "invalid"
                                  ? "border-red-500 focus-visible:ring-red-500"
                                  : ""
                              }`}
                              data-testid="input-signup-username"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                checkUsernameAvailability(e.target.value);
                              }}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {usernameStatus === "checking" && (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" data-testid="icon-username-checking" />
                              )}
                              {usernameStatus === "available" && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" data-testid="icon-username-available" />
                              )}
                              {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                                <X className="h-4 w-4 text-red-500" data-testid="icon-username-taken" />
                              )}
                            </div>
                          </div>
                        </FormControl>
                        {usernameMessage && usernameStatus !== "idle" && (
                          <p className={`text-xs mt-1 ${
                            usernameStatus === "available" 
                              ? "text-green-600 dark:text-green-400" 
                              : usernameStatus === "checking"
                              ? "text-muted-foreground"
                              : "text-red-600 dark:text-red-400"
                          }`} data-testid="text-username-status">
                            {usernameMessage}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Phone <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="tel"
                              placeholder="+234 XXX XXX XXXX"
                              className="pl-10"
                              data-testid="input-signup-phone"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Role</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-wrap gap-2"
                          >
                            <div className="flex-1 min-w-[100px]">
                              <RadioGroupItem
                                value="buyer"
                                id="role-buyer"
                                className="peer sr-only"
                                data-testid="radio-role-buyer"
                              />
                              <label
                                htmlFor="role-buyer"
                                className="flex items-center gap-2 rounded-md border-2 border-muted bg-popover px-3 py-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                              >
                                <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="text-sm font-medium">Buyer</span>
                                {field.value === "buyer" && (
                                  <Check className="h-3 w-3 text-primary ml-auto" />
                                )}
                              </label>
                            </div>
                            <div className="flex-1 min-w-[100px]">
                              <RadioGroupItem
                                value="seller"
                                id="role-seller"
                                className="peer sr-only"
                                data-testid="radio-role-seller"
                              />
                              <label
                                htmlFor="role-seller"
                                className="flex items-center gap-2 rounded-md border-2 border-muted bg-popover px-3 py-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                              >
                                <Store className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                                <span className="text-sm font-medium">Seller</span>
                                {field.value === "seller" && (
                                  <Check className="h-3 w-3 text-primary ml-auto" />
                                )}
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="password"
                              placeholder="Strong password required"
                              className="pl-10"
                              data-testid="input-signup-password"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <PasswordStrengthIndicator password={field.value} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="password"
                              placeholder="Re-enter your password"
                              className="pl-10"
                              data-testid="input-signup-confirm-password"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="referralCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">
                          Referral Code <span className="text-muted-foreground font-normal">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Gift className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Friend's code for bonus"
                              className="pl-10"
                              data-testid="input-signup-referral-code"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={signUpMutation.isPending}
                    data-testid="button-signup-submit"
                  >
                    {signUpMutation.isPending ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

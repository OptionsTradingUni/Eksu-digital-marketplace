import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { ShoppingBag, Mail, Lock, User, Phone, ArrowLeft, Store, ShoppingCart, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().optional(),
  role: z.enum(["buyer", "seller", "both"]).default("buyer"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type SignInFormData = z.infer<typeof signInSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "signin" | "signup";
}

export function AuthModal({ open, onOpenChange, defaultTab = "signin" }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      setShowForgotPassword(false);
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
      phoneNumber: "",
      role: "both",
    },
  });

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
    onSuccess: () => {
      toast({
        title: "Account created!",
        description: "Welcome to EKSU Campus Marketplace.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onOpenChange(false);
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
        <DialogContent className="sm:max-w-[450px]" data-testid="dialog-forgot-password">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowForgotPassword(false)}
                data-testid="button-back-to-signin"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-primary/10 p-2">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>
            <DialogTitle className="text-2xl">Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>

          <Form {...forgotPasswordForm}>
            <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPassword)} className="space-y-4 mt-4">
              <FormField
                control={forgotPasswordForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0" data-testid="dialog-auth">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 border-b">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-full bg-primary p-2.5">
              <ShoppingBag className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-2xl">EKSU Marketplace</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Join thousands of students trading safely on campus
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin" data-testid="tab-signin" className="text-base">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup" className="text-base">
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-0">
              <Form {...signInForm}>
                <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-4">
                  <FormField
                    control={signInForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
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
                        <FormLabel>Password</FormLabel>
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
                      className="px-0 text-sm h-auto"
                      onClick={() => setShowForgotPassword(true)}
                      data-testid="button-forgot-password"
                    >
                      Forgot password?
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
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
                <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={signUpForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
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
                          <FormLabel>Last Name</FormLabel>
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
                        <FormLabel>Email</FormLabel>
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
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
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
                        <FormLabel>What do you want to do?</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-3 gap-2"
                          >
                            <div>
                              <RadioGroupItem
                                value="buyer"
                                id="role-buyer"
                                className="peer sr-only"
                              />
                              <label
                                htmlFor="role-buyer"
                                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                              >
                                <ShoppingCart className="h-5 w-5 mb-1" />
                                <span className="text-xs font-medium">Buy</span>
                              </label>
                            </div>
                            <div>
                              <RadioGroupItem
                                value="seller"
                                id="role-seller"
                                className="peer sr-only"
                              />
                              <label
                                htmlFor="role-seller"
                                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                              >
                                <Store className="h-5 w-5 mb-1" />
                                <span className="text-xs font-medium">Sell</span>
                              </label>
                            </div>
                            <div>
                              <RadioGroupItem
                                value="both"
                                id="role-both"
                                className="peer sr-only"
                              />
                              <label
                                htmlFor="role-both"
                                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                              >
                                <Users className="h-5 w-5 mb-1" />
                                <span className="text-xs font-medium">Both</span>
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
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="password"
                              placeholder="At least 6 characters"
                              className="pl-10"
                              data-testid="input-signup-password"
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
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
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

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
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

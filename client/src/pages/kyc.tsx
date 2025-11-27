import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, CheckCircle2, XCircle, Clock, Camera, Upload, AlertTriangle, CreditCard, User, Calendar, FileText, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { KycVerification, User as UserType } from "@shared/schema";

const kycFormSchema = z.object({
  nin: z.string().length(11, "NIN must be exactly 11 digits").regex(/^\d+$/, "NIN must contain only numbers"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  consent: z.boolean().refine(val => val === true, "You must agree to the verification terms"),
});

type KycFormData = z.infer<typeof kycFormSchema>;

export default function KycPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<"info" | "payment" | "nin" | "selfie" | "processing" | "result">("info");
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [currentKycId, setCurrentKycId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<KycFormData>({
    resolver: zodResolver(kycFormSchema),
    defaultValues: {
      nin: "",
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      dateOfBirth: "",
      consent: false,
    },
  });

  const { data: kycStatus, isLoading: loadingStatus } = useQuery<KycVerification | null>({
    queryKey: ["/api/kyc/status"],
    retry: false,
  });

  const initiatePaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/kyc/initiate-payment");
      const result = await response.json();
      return result as { paymentUrl: string; kycId: string };
    },
    onSuccess: (data) => {
      setCurrentKycId(data.kycId);
      setPaymentUrl(data.paymentUrl);
      if (data.paymentUrl) {
        window.open(data.paymentUrl, "_blank");
      }
      setStep("nin");
      toast({
        title: "Payment initiated",
        description: "Complete the payment in the new window, then continue here.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Payment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submitNinMutation = useMutation({
    mutationFn: async (data: KycFormData) => {
      const response = await apiRequest("POST", "/api/kyc/submit-nin", {
        kycId: currentKycId,
        nin: data.nin,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        consent: data.consent,
      });
      const result = await response.json();
      return result as { kycId: string; ninPhotoReceived: boolean };
    },
    onSuccess: (data) => {
      setCurrentKycId(data.kycId);
      setStep("selfie");
      toast({
        title: "NIN verified",
        description: "Now take a clear selfie for comparison.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "NIN verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadSelfieMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("selfie", file);
      formData.append("kycId", currentKycId || "");
      
      const response = await fetch("/api/kyc/upload-selfie", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload selfie");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setStep("processing");
      checkVerificationStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Selfie upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkVerificationStatus = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setStep("result");
    } catch (error) {
      console.error("Error checking status:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      setSelfieFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfiePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitSelfie = () => {
    if (selfieFile) {
      uploadSelfieMutation.mutate(selfieFile);
    }
  };

  const onSubmitNin = (data: KycFormData) => {
    submitNinMutation.mutate(data);
  };

  if (loadingStatus) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (user?.isVerified || user?.ninVerified) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Already Verified</CardTitle>
            <CardDescription>
              Your identity has been verified. You have full access to all platform features.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Badge variant="default" className="text-sm">
              <Shield className="mr-1 h-3 w-3" />
              Verified User
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (kycStatus?.status === "pending_verification" || kycStatus?.status === "manual_review") {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle>Verification In Progress</CardTitle>
            <CardDescription>
              {kycStatus?.status === "manual_review" 
                ? "Your verification is being reviewed by our team. This usually takes 1-24 hours."
                : "Your verification is being processed. Please wait..."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="secondary">
                {kycStatus?.status === "manual_review" ? "Manual Review" : "Processing"}
              </Badge>
            </div>
            {kycStatus?.similarityScore && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Match Score</span>
                <span>{parseFloat(kycStatus.similarityScore).toFixed(1)}%</span>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/kyc/status"] })}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Status
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (kycStatus?.status === "rejected") {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle>Verification Rejected</CardTitle>
            <CardDescription>
              {kycStatus?.rejectionReason || "Your verification was not successful. A refund has been processed."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>What went wrong?</AlertTitle>
              <AlertDescription>
                The selfie didn't match the NIN photo closely enough. Common reasons:
                <ul className="list-disc pl-4 mt-2 text-sm">
                  <li>Poor lighting in selfie</li>
                  <li>Face not clearly visible</li>
                  <li>Wearing sunglasses or face coverings</li>
                  <li>Different angle than NIN photo</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => setStep("info")}>
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-kyc-title">Identity Verification</h1>
        <p className="text-muted-foreground">
          Verify your identity to unlock all platform features
        </p>
      </div>

      <div className="mb-6">
        <Progress 
          value={
            step === "info" ? 0 :
            step === "payment" ? 25 :
            step === "nin" ? 50 :
            step === "selfie" ? 75 :
            100
          } 
          className="h-2"
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>Start</span>
          <span>Payment</span>
          <span>NIN</span>
          <span>Selfie</span>
          <span>Done</span>
        </div>
      </div>

      {step === "info" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Why Verify?</CardTitle>
            </div>
            <CardDescription>
              Verification helps prevent scams and builds trust
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Verified Badge</p>
                  <p className="text-sm text-muted-foreground">Get a green verified badge on your profile</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Sell Products</p>
                  <p className="text-sm text-muted-foreground">Only verified users can list items for sale</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Higher Trust</p>
                  <p className="text-sm text-muted-foreground">Buyers prefer verified sellers</p>
                </div>
              </div>
            </div>

            <Alert>
              <CreditCard className="h-4 w-4" />
              <AlertTitle>Verification Fee: N200</AlertTitle>
              <AlertDescription>
                This one-time fee covers the cost of NIN verification. If verification fails, 
                you'll receive a full refund.
              </AlertDescription>
            </Alert>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Important Privacy Notice</AlertTitle>
              <AlertDescription>
                Your NIN photo and selfie will be used ONLY for one-time verification and 
                deleted within 24 hours. We never store your actual NIN number.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              onClick={() => initiatePaymentMutation.mutate()}
              disabled={initiatePaymentMutation.isPending}
              data-testid="button-start-verification"
            >
              {initiatePaymentMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Pay N200 & Start Verification
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "nin" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Enter NIN Details</CardTitle>
            </div>
            <CardDescription>
              Enter your National Identification Number and personal details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitNin)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NIN (11 digits)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="12345678901" 
                          maxLength={11}
                          {...field} 
                          data-testid="input-nin"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} data-testid="input-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-dob"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="consent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-consent"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>I consent to verification</FormLabel>
                        <FormDescription>
                          I allow Campuspluguni to compare my selfie with my NIN photo for 
                          one-time verification. Both images will be deleted immediately after verification.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={submitNinMutation.isPending}
                  data-testid="button-submit-nin"
                >
                  {submitNinMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Continue to Selfie
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {step === "selfie" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              <CardTitle>Take a Selfie</CardTitle>
            </div>
            <CardDescription>
              Take a clear photo of your face for comparison with your NIN photo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Camera className="h-4 w-4" />
              <AlertTitle>Selfie Tips</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 mt-2 text-sm">
                  <li>Use good lighting (face the light source)</li>
                  <li>Look directly at the camera</li>
                  <li>Remove glasses or face coverings</li>
                  <li>Keep a neutral expression</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div 
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-selfie"
              />
              
              {selfiePreview ? (
                <div className="relative">
                  <img 
                    src={selfiePreview} 
                    alt="Selfie preview" 
                    className="max-w-[200px] rounded-lg"
                    loading="lazy"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute -top-2 -right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelfieFile(null);
                      setSelfiePreview(null);
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground text-center">
                    Click to take a selfie or upload a photo
                  </p>
                </>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full"
              disabled={!selfieFile || uploadSelfieMutation.isPending}
              onClick={handleSubmitSelfie}
              data-testid="button-submit-selfie"
            >
              {uploadSelfieMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Submit for Verification
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "processing" && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <CardTitle>Verifying Your Identity</CardTitle>
            <CardDescription>
              Please wait while we compare your selfie with your NIN photo...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Progress value={66} className="mb-4" />
            <p className="text-sm text-muted-foreground">
              This usually takes less than a minute
            </p>
          </CardContent>
        </Card>
      )}

      {step === "result" && kycStatus?.status === "approved" && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Verification Successful!</CardTitle>
            <CardDescription>
              Your identity has been verified. You now have full access to all platform features.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Badge variant="default" className="text-sm">
              <Shield className="mr-1 h-3 w-3" />
              Verified User
            </Badge>
            {kycStatus?.similarityScore && (
              <p className="text-sm text-muted-foreground">
                Match confidence: {parseFloat(kycStatus.similarityScore).toFixed(1)}%
              </p>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" asChild>
              <a href="/profile">View Profile</a>
            </Button>
            <Button className="flex-1" asChild>
              <a href="/products/new">Start Selling</a>
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

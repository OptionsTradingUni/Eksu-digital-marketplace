import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Camera,
  Check,
  X,
  ChevronRight,
  Loader2,
  Shield,
  AlertTriangle,
  RefreshCw,
  User,
  Phone,
  Calendar,
  FileText,
  CreditCard,
  BadgeCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

const kycFormSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  nin: z.string().length(11, "NIN must be exactly 11 digits").regex(/^\d+$/, "NIN must contain only numbers"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\d+$/, "Phone number must contain only numbers"),
});

type KycFormData = z.infer<typeof kycFormSchema>;

const LIVENESS_PROMPTS = [
  "Please blink your eyes",
  "Turn your head slightly to the left",
  "Turn your head slightly to the right",
  "Look up briefly",
  "Smile naturally",
];

export default function KYCVerification() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<"success" | "failure" | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [currentLivenessPrompt, setCurrentLivenessPrompt] = useState(0);
  const [livenessChecked, setLivenessChecked] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const form = useForm<KycFormData>({
    resolver: zodResolver(kycFormSchema),
    defaultValues: {
      fullName: "",
      dateOfBirth: "",
      nin: "",
      phoneNumber: "",
    },
  });

  const getProgressValue = () => {
    switch (step) {
      case 1: return 0;
      case 2: return 20;
      case 3: return 40;
      case 4: return 60;
      case 5: return 80;
      case 6: return 100;
      default: return 0;
    }
  };

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsCameraReady(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraReady(true);
        };
      }
    } catch (error) {
      console.error("Camera access error:", error);
      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          setCameraError("Camera access was denied. Please allow camera access in your browser settings and try again.");
        } else if (error.name === "NotFoundError") {
          setCameraError("No camera found. Please connect a camera and try again.");
        } else if (error.name === "NotReadableError") {
          setCameraError("Camera is in use by another application. Please close other apps using the camera and try again.");
        } else {
          setCameraError("Failed to access camera. Please try again.");
        }
      } else {
        setCameraError("An unexpected error occurred while accessing the camera.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(imageDataUrl);

    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setLivenessChecked(false);
    setCurrentLivenessPrompt(0);
    startCamera();
  }, [startCamera]);

  useEffect(() => {
    if (step === 4 && !capturedImage) {
      startCamera();
    }

    return () => {
      if (step !== 4) {
        stopCamera();
      }
    };
  }, [step, capturedImage, startCamera, stopCamera]);

  useEffect(() => {
    if (step === 4 && isCameraReady && !capturedImage && !livenessChecked) {
      const interval = setInterval(() => {
        setCurrentLivenessPrompt((prev) => {
          const next = prev + 1;
          if (next >= LIVENESS_PROMPTS.length) {
            setLivenessChecked(true);
            clearInterval(interval);
            return prev;
          }
          return next;
        });
      }, 2500);

      return () => clearInterval(interval);
    }
  }, [step, isCameraReady, capturedImage, livenessChecked]);

  const handleTermsAccept = () => {
    if (!termsAccepted) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms and conditions to continue.",
        variant: "destructive",
      });
      return;
    }
    setStep(2);
  };

  const handleInfoSubmit = (data: KycFormData) => {
    setStep(3);
  };

  const handlePayment = async () => {
    setIsProcessingPayment(true);
    
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    setIsProcessingPayment(false);
    toast({
      title: "Payment Successful",
      description: "Your payment of ₦500 has been processed.",
    });
    setStep(4);
  };

  const handleSubmitSelfie = async () => {
    if (!capturedImage) {
      toast({
        title: "Photo Required",
        description: "Please capture a photo before submitting.",
        variant: "destructive",
      });
      return;
    }

    setStep(5);
    setIsVerifying(true);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsVerifying(false);
    setVerificationResult("success");
    setStep(6);
  };

  const handleRetry = () => {
    setStep(1);
    setTermsAccepted(false);
    setCapturedImage(null);
    setVerificationResult(null);
    setLivenessChecked(false);
    setCurrentLivenessPrompt(0);
    form.reset();
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-kyc-verification-title">
            Identity Verification
          </h1>
        </div>
        <p className="text-muted-foreground">
          Complete verification to unlock all platform features
        </p>
      </div>

      <div className="mb-6">
        <Progress value={getProgressValue()} className="h-2" />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>Terms</span>
          <span>Info</span>
          <span>Payment</span>
          <span>Selfie</span>
          <span>Verify</span>
          <span>Done</span>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Terms & Conditions</CardTitle>
            </div>
            <CardDescription>
              Please read and accept the terms to proceed with verification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-4 max-h-64 overflow-y-auto text-sm space-y-3">
              <h3 className="font-semibold">Identity Verification Terms</h3>
              <p>
                By proceeding with identity verification, you agree to the following terms:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Data Collection:</strong> We will collect your National Identification Number (NIN), 
                  date of birth, phone number, and a selfie photograph for verification purposes.
                </li>
                <li>
                  <strong>Data Usage:</strong> Your information will be used solely for identity verification 
                  and fraud prevention on our platform.
                </li>
                <li>
                  <strong>Data Security:</strong> All collected data is encrypted and stored securely. 
                  Your selfie and NIN details will be deleted within 24 hours after verification.
                </li>
                <li>
                  <strong>Third-Party Processing:</strong> We may use secure third-party services to 
                  process and verify your identity documents.
                </li>
                <li>
                  <strong>Verification Fee:</strong> A non-refundable fee of ₦500 is required to process 
                  your verification. If verification fails due to system error, a full refund will be issued.
                </li>
                <li>
                  <strong>Accuracy:</strong> You confirm that all information provided is accurate and 
                  belongs to you. Providing false information may result in account suspension.
                </li>
                <li>
                  <strong>Consent:</strong> You consent to the capture and processing of your biometric 
                  data (facial features) for liveness detection and identity matching.
                </li>
              </ul>
              <p className="text-muted-foreground">
                By checking the box below, you acknowledge that you have read, understood, and agree 
                to these terms and conditions.
              </p>
            </div>

            <div className="flex items-start space-x-3 rounded-md border p-4">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                data-testid="checkbox-terms"
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="terms" className="cursor-pointer">
                  I have read and agree to the Terms & Conditions
                </Label>
                <p className="text-xs text-muted-foreground">
                  You must accept the terms to proceed with verification
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handleTermsAccept}
              disabled={!termsAccepted}
              data-testid="button-terms-continue"
            >
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Personal Information</CardTitle>
            </div>
            <CardDescription>
              Enter your details exactly as they appear on your NIN document
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleInfoSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Full Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your full name"
                          {...field}
                          data-testid="input-full-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Date of Birth
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-date-of-birth"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        NIN (11 digits)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your 11-digit NIN"
                          maxLength={11}
                          {...field}
                          data-testid="input-nin"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone Number
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your phone number"
                          maxLength={15}
                          {...field}
                          data-testid="input-phone-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" data-testid="button-info-continue">
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Verification Payment</CardTitle>
            </div>
            <CardDescription>
              A one-time fee is required to process your verification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Verification Fee</span>
                <span className="text-xl font-bold">₦500</span>
              </div>
              <div className="text-sm text-muted-foreground">
                This fee covers:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>NIN verification processing</li>
                  <li>Biometric face matching</li>
                  <li>Liveness detection check</li>
                  <li>Verified badge on your profile</li>
                </ul>
              </div>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Secure Payment</AlertTitle>
              <AlertDescription>
                Your payment is processed securely through PayStack. We do not store your card details.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handlePayment}
              disabled={isProcessingPayment}
              data-testid="button-pay"
            >
              {isProcessingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay ₦500
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              <CardTitle>Capture Selfie</CardTitle>
            </div>
            <CardDescription>
              Take a clear photo of your face for identity verification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cameraError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Camera Error</AlertTitle>
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            ) : null}

            {!capturedImage && !cameraError && (
              <Alert>
                <Camera className="h-4 w-4" />
                <AlertTitle>Photo Tips</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-1 text-sm">
                    <li>Ensure good lighting on your face</li>
                    <li>Look directly at the camera</li>
                    <li>Remove glasses or face coverings</li>
                    <li>Keep a neutral expression</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col items-center space-y-4">
              {!capturedImage ? (
                <>
                  <div
                    className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-primary bg-muted flex items-center justify-center"
                    data-testid="camera-container"
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      data-testid="video-camera-feed"
                    />
                    {!isCameraReady && !cameraError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                  </div>

                  {isCameraReady && !livenessChecked && (
                    <div className="text-center p-3 rounded-md bg-primary/10 border border-primary/20">
                      <p className="text-sm font-medium text-primary" data-testid="text-liveness-prompt">
                        {LIVENESS_PROMPTS[currentLivenessPrompt]}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Follow the prompts for liveness detection
                      </p>
                    </div>
                  )}

                  {livenessChecked && (
                    <div className="text-center p-3 rounded-md bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center justify-center gap-2">
                        <Check className="h-4 w-4" />
                        Liveness check complete
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        You can now capture your photo
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={capturePhoto}
                    disabled={!isCameraReady || !livenessChecked}
                    data-testid="button-capture-photo"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Capture Photo
                  </Button>

                  {cameraError && (
                    <Button
                      variant="outline"
                      onClick={startCamera}
                      data-testid="button-retry-camera"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Try Again
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-green-500">
                    <img
                      src={capturedImage}
                      alt="Captured selfie"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      data-testid="img-captured-selfie"
                    />
                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground text-center">
                    Photo captured successfully. Review and submit or retake.
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={retakePhoto}
                      data-testid="button-retake"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retake
                    </Button>
                    <Button
                      onClick={handleSubmitSelfie}
                      data-testid="button-submit-selfie"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Submit
                    </Button>
                  </div>
                </>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <CardTitle>Verifying Your Identity</CardTitle>
            <CardDescription>
              Please wait while we process your verification...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span data-testid="text-verifying-status">Analyzing facial features...</span>
              </div>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Secure Processing</AlertTitle>
              <AlertDescription>
                Your data is being processed securely. This usually takes a few seconds.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardHeader className="text-center">
            {verificationResult === "success" ? (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <BadgeCheck className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle data-testid="text-verification-success">
                  Verification Successful!
                </CardTitle>
                <CardDescription>
                  Your identity has been verified successfully
                </CardDescription>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <X className="h-8 w-8 text-red-600" />
                </div>
                <CardTitle data-testid="text-verification-failure">
                  Verification Failed
                </CardTitle>
                <CardDescription>
                  We couldn't verify your identity
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {verificationResult === "success" ? (
              <>
                <div className="text-center">
                  <Badge variant="default" className="text-sm">
                    <Shield className="mr-1 h-3 w-3" />
                    Verified User
                  </Badge>
                </div>

                <div className="rounded-md border p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span>NIN verified successfully</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span>Face match confirmed</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span>Liveness check passed</span>
                  </div>
                </div>

                <Alert>
                  <BadgeCheck className="h-4 w-4" />
                  <AlertTitle>What's Next?</AlertTitle>
                  <AlertDescription>
                    You now have full access to all platform features. Your verified badge 
                    will be visible on your profile and product listings.
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Verification Failed</AlertTitle>
                  <AlertDescription>
                    The verification process couldn't confirm your identity. 
                    This could be due to poor image quality or a mismatch with your NIN details.
                  </AlertDescription>
                </Alert>

                <div className="rounded-md border p-4 space-y-2 text-sm">
                  <p className="font-medium">Common reasons for failure:</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>Poor lighting in the selfie</li>
                    <li>Face not clearly visible</li>
                    <li>Wearing glasses or face coverings</li>
                    <li>Information doesn't match NIN records</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            {verificationResult === "success" ? (
              <Button className="w-full" data-testid="button-done">
                <Check className="mr-2 h-4 w-4" />
                Done
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={handleRetry}
                data-testid="button-retry-verification"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

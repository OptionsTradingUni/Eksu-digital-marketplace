import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Smartphone, 
  Wallet, 
  Zap, 
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Store,
  Users
} from "lucide-react";

interface WelcomeOnboardingProps {
  onComplete: () => void;
  onCreateAccount: () => void;
  onBrowseAsGuest: () => void;
}

interface Slide {
  title: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  bgGradient: string;
}

const slides: Slide[] = [
  {
    title: "Welcome to EKSU Marketplace!",
    description: "Nigeria's cheapest platform for all your digital services",
    features: [
      "Data bundles (all networks)",
      "Airtime top-up",
      "Cable TV subscriptions",
      "Electricity bills"
    ],
    icon: <Smartphone className="h-16 w-16" />,
    bgGradient: "from-primary/20 to-primary/5"
  },
  {
    title: "Save Money Every Time",
    description: "Get the best rates on all VTU services",
    features: [
      "Up to 15% cheaper than networks",
      "Instant delivery",
      "24/7 automated service",
      "No hidden charges"
    ],
    icon: <TrendingDown className="h-16 w-16" />,
    bgGradient: "from-green-500/20 to-green-500/5"
  },
  {
    title: "Become a Reseller",
    description: "Start your own VTU business with us",
    features: [
      "Create your own VTU website",
      "Set your prices, keep profits",
      "Start with just 5,000 naira",
      "Earn from every transaction"
    ],
    icon: <Store className="h-16 w-16" />,
    bgGradient: "from-blue-500/20 to-blue-500/5"
  },
  {
    title: "Ready to Start?",
    description: "Join thousands of satisfied users",
    features: [
      "Free account registration",
      "Instant wallet funding",
      "Referral bonuses available",
      "24/7 customer support"
    ],
    icon: <Users className="h-16 w-16" />,
    bgGradient: "from-purple-500/20 to-purple-500/5"
  }
];

export function WelcomeOnboarding({ onComplete, onCreateAccount, onBrowseAsGuest }: WelcomeOnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("hasSeenWelcome");
    if (hasSeenWelcome === "true") {
      setIsVisible(false);
      onComplete();
    }
  }, [onComplete]);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("hasSeenWelcome", "true");
    setIsVisible(false);
    onComplete();
  };

  const handleCreateAccount = () => {
    localStorage.setItem("hasSeenWelcome", "true");
    setIsVisible(false);
    onCreateAccount();
  };

  const handleBrowseAsGuest = () => {
    localStorage.setItem("hasSeenWelcome", "true");
    setIsVisible(false);
    onBrowseAsGuest();
  };

  if (!isVisible) return null;

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md overflow-hidden shadow-2xl">
        <CardContent className="p-0">
          <div className={`bg-gradient-to-br ${slide.bgGradient} p-8 text-center`}>
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-background/80 p-4 text-primary">
                {slide.icon}
              </div>
            </div>
            <div className="mb-2 text-sm text-muted-foreground">
              Slide {currentSlide + 1} of {slides.length}
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {slide.title}
            </h2>
            <p className="text-muted-foreground">
              {slide.description}
            </p>
          </div>

          <div className="p-6 space-y-4">
            <ul className="space-y-3">
              {slide.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="flex justify-center gap-2 pt-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentSlide 
                      ? "w-6 bg-primary" 
                      : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                  data-testid={`slide-indicator-${index}`}
                />
              ))}
            </div>

            {isLastSlide ? (
              <div className="space-y-3 pt-4">
                <Button 
                  onClick={handleCreateAccount} 
                  className="w-full"
                  data-testid="button-create-account"
                >
                  Create Free Account
                </Button>
                <Button 
                  onClick={handleBrowseAsGuest} 
                  variant="outline" 
                  className="w-full"
                  data-testid="button-browse-guest"
                >
                  Browse as Guest
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="ghost"
                  onClick={handlePrevious}
                  disabled={currentSlide === 0}
                  className="gap-1"
                  data-testid="button-previous-slide"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="gap-1"
                  data-testid="button-next-slide"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {!isLastSlide && (
              <div className="text-center">
                <button
                  onClick={handleComplete}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-skip-onboarding"
                >
                  Skip for now
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default WelcomeOnboarding;

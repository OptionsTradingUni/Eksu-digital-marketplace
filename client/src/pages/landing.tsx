import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ShoppingBag, 
  MessageSquare, 
  Shield, 
  TrendingUp, 
  Menu, 
  X, 
  Wallet,
  Users,
  Lock,
  Zap,
  CheckCircle,
  ArrowRight,
  Star,
  Store
} from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Landing() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"signin" | "signup">("signup");
  const [showSplash, setShowSplash] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem("hasSeenSplash");
    if (hasSeenSplash) {
      setShowSplash(false);
    } else {
      const timer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.setItem("hasSeenSplash", "true");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleGetStarted = () => {
    setAuthModalTab("signup");
    setAuthModalOpen(true);
  };

  const handleBrowse = () => {
    setAuthModalTab("signin");
    setAuthModalOpen(true);
  };

  const handleBecomeMerchant = () => {
    setAuthModalTab("signup");
    setAuthModalOpen(true);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { label: "Home", href: "#home" },
    { label: "About", href: "#about" },
    { label: "Features", href: "#features" },
    { label: "How it Works", href: "#how-it-works" },
    { label: "Become a Merchant", href: "#merchant" },
  ];

  if (showSplash) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center animate-fade-in">
          <div className="rounded-full bg-primary/10 p-8 animate-pulse-scale">
            <ShoppingBag className="h-16 w-16 text-primary" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-primary animate-slide-up">
            EKSU Marketplace
          </h1>
          <p className="mt-2 text-muted-foreground animate-fade-in-delayed">
            Your Campus Trading Hub
          </p>
          <div className="mt-6 h-1 w-24 rounded-full bg-primary/20 overflow-hidden animate-fade-in-delayed-2">
            <div className="h-full bg-primary animate-progress-fill" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" id="home">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">EKSU Marketplace</span>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => scrollToSection(link.href.replace("#", ""))}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {link.label}
                </button>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" onClick={handleBrowse} data-testid="button-login">
                Log In
              </Button>
              <Button onClick={handleGetStarted} data-testid="button-signup">
                Sign Up
              </Button>
            </div>

            <div className="flex md:hidden items-center gap-2">
              <ThemeToggle />
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px]">
                  <div className="flex flex-col gap-4 mt-8">
                    {navLinks.map((link) => (
                      <button
                        key={link.label}
                        onClick={() => scrollToSection(link.href.replace("#", ""))}
                        className="text-left font-medium py-2 transition-colors hover:text-primary"
                      >
                        {link.label}
                      </button>
                    ))}
                    <div className="border-t pt-4 space-y-2">
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleBrowse();
                        }}
                      >
                        Log In
                      </Button>
                      <Button 
                        className="w-full" 
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleGetStarted();
                        }}
                      >
                        Sign Up
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <section className="relative bg-gradient-to-b from-primary/10 to-background py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="mx-auto max-w-3xl animate-slide-up">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              EKSU Campus Marketplace
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              Buy and sell with trusted students. From textbooks to electronics,
              fashion to furniture - your campus marketplace for everything.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" onClick={handleGetStarted} data-testid="button-get-started">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={handleBrowse} data-testid="button-browse">
                Browse Listings
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="py-16 px-4">
        <div className="container mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">About EKSU Marketplace</h2>
            <p className="text-lg text-muted-foreground mb-8">
              EKSU Marketplace is the premier online platform for students at Ekiti State University 
              to buy and sell items within the campus community. Our platform provides a safe, 
              convenient, and efficient way for students to trade goods and services.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="rounded-full bg-primary/10 p-3 w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">5,000+</h3>
                  <p className="text-sm text-muted-foreground">Active Students</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="rounded-full bg-primary/10 p-3 w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">10,000+</h3>
                  <p className="text-sm text-muted-foreground">Products Listed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="rounded-full bg-primary/10 p-3 w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                    <Star className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">4.8/5</h3>
                  <p className="text-sm text-muted-foreground">User Rating</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <h2 className="text-center text-3xl font-bold mb-4">
            Why Choose EKSU Marketplace?
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Experience the best campus trading platform with features designed for students
          </p>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Verified Sellers</h3>
                  <p className="text-sm text-muted-foreground">
                    Trade with confidence. All sellers go through verification.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Real-Time Chat</h3>
                  <p className="text-sm text-muted-foreground">
                    Chat instantly with buyers and sellers. Negotiate deals in real-time.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Wallet className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Secure Wallet</h3>
                  <p className="text-sm text-muted-foreground">
                    Built-in wallet with escrow protection for safe transactions.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Escrow System</h3>
                  <p className="text-sm text-muted-foreground">
                    Money held safely until delivery is confirmed by buyer.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Boost Products</h3>
                  <p className="text-sm text-muted-foreground">
                    Promote your listings for more visibility and faster sales.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Referral Bonus</h3>
                  <p className="text-sm text-muted-foreground">
                    Invite friends and earn rewards when they join and trade.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Fast Delivery</h3>
                  <p className="text-sm text-muted-foreground">
                    Campus-to-campus delivery. Meet up easily on campus.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Star className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Ratings & Reviews</h3>
                  <p className="text-sm text-muted-foreground">
                    Build your reputation with ratings and reviews.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-center text-3xl font-bold mb-4">
            How It Works
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Start buying or selling in just a few simple steps
          </p>
          <div className="grid gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="rounded-full bg-primary text-primary-foreground w-12 h-12 mx-auto mb-4 flex items-center justify-center font-bold text-lg">
                1
              </div>
              <h3 className="font-semibold mb-2">Sign Up</h3>
              <p className="text-sm text-muted-foreground">
                Create your account with your email. Quick and easy registration.
              </p>
            </div>
            <div className="text-center">
              <div className="rounded-full bg-primary text-primary-foreground w-12 h-12 mx-auto mb-4 flex items-center justify-center font-bold text-lg">
                2
              </div>
              <h3 className="font-semibold mb-2">List or Browse</h3>
              <p className="text-sm text-muted-foreground">
                List items for sale or browse products from other students.
              </p>
            </div>
            <div className="text-center">
              <div className="rounded-full bg-primary text-primary-foreground w-12 h-12 mx-auto mb-4 flex items-center justify-center font-bold text-lg">
                3
              </div>
              <h3 className="font-semibold mb-2">Connect</h3>
              <p className="text-sm text-muted-foreground">
                Chat with buyers or sellers and negotiate the best price.
              </p>
            </div>
            <div className="text-center">
              <div className="rounded-full bg-primary text-primary-foreground w-12 h-12 mx-auto mb-4 flex items-center justify-center font-bold text-lg">
                4
              </div>
              <h3 className="font-semibold mb-2">Complete Trade</h3>
              <p className="text-sm text-muted-foreground">
                Complete your transaction safely with our escrow protection.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="merchant" className="py-16 px-4 bg-primary/5">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto">
            <div className="grid gap-8 md:grid-cols-2 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">Become a Merchant</h2>
                <p className="text-muted-foreground mb-6">
                  Start your campus business today. Sell products to thousands of students 
                  and earn money while studying. Get verified seller status for more trust and sales.
                </p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>Free to list your products</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>Get verified seller badge</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>Access to seller dashboard</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>Boost products for more visibility</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>Withdraw earnings to bank account</span>
                  </li>
                </ul>
                <Button size="lg" onClick={handleBecomeMerchant} data-testid="button-become-merchant">
                  <Store className="mr-2 h-4 w-4" />
                  Start Selling Today
                </Button>
              </div>
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg p-8">
                <div className="text-center">
                  <div className="rounded-full bg-primary/10 p-6 w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <Store className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Seller Benefits</h3>
                  <p className="text-muted-foreground">
                    Join our growing community of student entrepreneurs
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Trading?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of EKSU students buying and selling safely on campus.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleGetStarted} data-testid="button-join-now">
              Join Now - It's Free
            </Button>
            <Button size="lg" variant="outline" onClick={handleBrowse}>
              Already have an account? Log In
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span className="font-semibold">EKSU Marketplace</span>
            </div>
            <p className="text-sm text-muted-foreground">
              2024 EKSU Campus Marketplace. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultTab={authModalTab}
      />
    </div>
  );
}

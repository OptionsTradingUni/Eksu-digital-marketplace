import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, MessageSquare, Shield, TrendingUp } from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Landing() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"signin" | "signup">("signup");

  const handleGetStarted = () => {
    setAuthModalTab("signup");
    setAuthModalOpen(true);
  };

  const handleBrowse = () => {
    setAuthModalTab("signin");
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen">
      {/* Header with Theme Toggle */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">EKSU Marketplace</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/10 to-background py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="mx-auto max-w-3xl">
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
              </Button>
              <Button size="lg" variant="outline" onClick={handleBrowse} data-testid="button-browse">
                Browse Listings
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-center text-3xl font-bold mb-12">
            Why Choose EKSU Marketplace?
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Verified Students</h3>
                  <p className="text-sm text-muted-foreground">
                    Trade with confidence. All users are verified EKSU students.
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
                    <ShoppingBag className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Easy Listing</h3>
                  <p className="text-sm text-muted-foreground">
                    List items in seconds with photos. Manage everything from your dashboard.
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
                  <h3 className="font-semibold">Trust System</h3>
                  <p className="text-sm text-muted-foreground">
                    Build your reputation with ratings and reviews from other students.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Trading?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of EKSU students buying and selling safely on campus.
          </p>
          <Button size="lg" onClick={handleGetStarted} data-testid="button-join-now">
            Join Now - It's Free
          </Button>
        </div>
      </section>

      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultTab={authModalTab}
      />
    </div>
  );
}

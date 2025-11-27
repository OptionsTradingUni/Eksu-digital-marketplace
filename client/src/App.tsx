import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import ChatBot from "@/components/ChatBot";
import { setupGlobalErrorHandler } from "@/lib/globalErrorHandler";
import { lazy, Suspense, useEffect } from "react";

const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/landing"));
const Home = lazy(() => import("@/pages/home"));
const ProductView = lazy(() => import("@/pages/product-view"));
const CreateProduct = lazy(() => import("@/pages/product-detail"));
const Messages = lazy(() => import("@/pages/messages"));
const Profile = lazy(() => import("@/pages/profile"));
const SellerDashboard = lazy(() => import("@/pages/seller-dashboard"));
const AdminPanel = lazy(() => import("@/pages/admin"));
const WalletPage = lazy(() => import("@/pages/wallet"));
const ReferralsPage = lazy(() => import("@/pages/referrals"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const MyAdsPage = lazy(() => import("@/pages/my-ads"));
const GamesPage = lazy(() => import("@/pages/games"));
const SupportPage = lazy(() => import("@/pages/support"));
const AnnouncementsPage = lazy(() => import("@/pages/announcements"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const ThePlugPage = lazy(() => import("@/pages/the-plug"));
const PaymentCallbackPage = lazy(() => import("@/pages/payment-callback"));
const WishlistPage = lazy(() => import("@/pages/wishlist"));
const VtuPage = lazy(() => import("@/pages/vtu"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const LegalPage = lazy(() => import("@/pages/legal"));
const KycPage = lazy(() => import("@/pages/kyc"));

function PageLoadingSpinner() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading, isError } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page for unauthenticated users or auth errors
  if (!isAuthenticated || isError) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoadingSpinner />}>
          <Landing />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Show authenticated app
  return (
    <>
      <Header />
      <main className="pb-16 lg:pb-0">
        <Suspense fallback={<PageLoadingSpinner />}>
          <Switch>
            <Route path="/" component={() => (
              <ErrorBoundary>
                <Home />
              </ErrorBoundary>
            )} />
            <Route path="/products/new" component={() => (
              <ErrorBoundary>
                <CreateProduct />
              </ErrorBoundary>
            )} />
            <Route path="/products/:id" component={() => (
              <ErrorBoundary>
                <ProductView />
              </ErrorBoundary>
            )} />
            <Route path="/products/:id/edit" component={() => (
              <ErrorBoundary>
                <CreateProduct />
              </ErrorBoundary>
            )} />
            <Route path="/messages" component={() => (
              <ErrorBoundary>
                <Messages />
              </ErrorBoundary>
            )} />
            <Route path="/messages/:userId" component={() => (
              <ErrorBoundary>
                <Messages />
              </ErrorBoundary>
            )} />
            <Route path="/chat/:userId" component={() => (
              <ErrorBoundary>
                <Messages />
              </ErrorBoundary>
            )} />
            <Route path="/profile/:userId?" component={() => (
              <ErrorBoundary>
                <Profile />
              </ErrorBoundary>
            )} />
            <Route path="/seller/dashboard" component={() => (
              <ErrorBoundary>
                <SellerDashboard />
              </ErrorBoundary>
            )} />
            <Route path="/admin" component={() => (
              <ErrorBoundary>
                <AdminPanel />
              </ErrorBoundary>
            )} />
            <Route path="/wallet" component={() => (
              <ErrorBoundary>
                <WalletPage />
              </ErrorBoundary>
            )} />
            <Route path="/referrals" component={() => (
              <ErrorBoundary>
                <ReferralsPage />
              </ErrorBoundary>
            )} />
            <Route path="/notifications" component={() => (
              <ErrorBoundary>
                <NotificationsPage />
              </ErrorBoundary>
            )} />
            <Route path="/my-ads" component={() => (
              <ErrorBoundary>
                <MyAdsPage />
              </ErrorBoundary>
            )} />
            <Route path="/games" component={() => (
              <ErrorBoundary>
                <GamesPage />
              </ErrorBoundary>
            )} />
            <Route path="/support" component={() => (
              <ErrorBoundary>
                <SupportPage />
              </ErrorBoundary>
            )} />
            <Route path="/announcements" component={() => (
              <ErrorBoundary>
                <AnnouncementsPage />
              </ErrorBoundary>
            )} />
            <Route path="/the-plug" component={() => (
              <ErrorBoundary>
                <ThePlugPage />
              </ErrorBoundary>
            )} />
            <Route path="/checkout" component={() => (
              <ErrorBoundary>
                <CheckoutPage />
              </ErrorBoundary>
            )} />
            <Route path="/payment/callback" component={() => (
              <ErrorBoundary>
                <PaymentCallbackPage />
              </ErrorBoundary>
            )} />
            <Route path="/wishlist" component={() => (
              <ErrorBoundary>
                <WishlistPage />
              </ErrorBoundary>
            )} />
            <Route path="/vtu" component={() => (
              <ErrorBoundary>
                <VtuPage />
              </ErrorBoundary>
            )} />
            <Route path="/settings" component={() => (
              <ErrorBoundary>
                <SettingsPage />
              </ErrorBoundary>
            )} />
            <Route path="/legal" component={() => (
              <ErrorBoundary>
                <LegalPage />
              </ErrorBoundary>
            )} />
            <Route path="/kyc" component={() => (
              <ErrorBoundary>
                <KycPage />
              </ErrorBoundary>
            )} />
            <Route component={() => (
              <ErrorBoundary>
                <NotFound />
              </ErrorBoundary>
            )} />
          </Switch>
        </Suspense>
      </main>
      <BottomNav />
    </>
  );
}

function App() {
  // Setup global error handlers on mount
  useEffect(() => {
    setupGlobalErrorHandler();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <ChatBot />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

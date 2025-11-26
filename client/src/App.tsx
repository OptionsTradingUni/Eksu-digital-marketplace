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
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import ProductView from "@/pages/product-view";
import CreateProduct from "@/pages/product-detail";
import Messages from "@/pages/messages";
import Profile from "@/pages/profile";
import SellerDashboard from "@/pages/seller-dashboard";
import AdminPanel from "@/pages/admin";
import WalletPage from "@/pages/wallet";
import ReferralsPage from "@/pages/referrals";
import NotificationsPage from "@/pages/notifications";
import MyAdsPage from "@/pages/my-ads";
import GamesPage from "@/pages/games";
import SupportPage from "@/pages/support";
import AnnouncementsPage from "@/pages/announcements";
import { setupGlobalErrorHandler } from "@/lib/globalErrorHandler";
import { useEffect } from "react";

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
        <Landing />
      </ErrorBoundary>
    );
  }

  // Show authenticated app
  return (
    <>
      <Header />
      <main className="pb-16 lg:pb-0">
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
          <Route path="/profile" component={() => (
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
          <Route component={() => (
            <ErrorBoundary>
              <NotFound />
            </ErrorBoundary>
          )} />
        </Switch>
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

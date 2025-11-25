import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
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
    return <Landing />;
  }

  // Show authenticated app
  return (
    <>
      <Header />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/products/new" component={CreateProduct} />
        <Route path="/products/:id" component={ProductView} />
        <Route path="/products/:id/edit" component={CreateProduct} />
        <Route path="/messages" component={Messages} />
        <Route path="/profile" component={Profile} />
        <Route path="/seller/dashboard" component={SellerDashboard} />
        <Route path="/admin" component={AdminPanel} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          <ChatBot />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

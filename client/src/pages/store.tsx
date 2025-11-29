import { useState, useMemo, useEffect } from "react";
import { useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Wifi, Phone, CheckCircle, XCircle, MessageCircle, Mail, ExternalLink } from "lucide-react";

interface StoreConfig {
  id: string;
  siteName: string;
  siteDescription: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  contactEmail: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  tier: string;
  subdomain: string;
}

interface DataPlan {
  id: string;
  network: string;
  planType: string;
  planCode: string;
  name: string;
  dataAmount: string;
  validity: string;
  apiPrice: number;
  marketPrice: number;
  sellingPrice: number;
  profit: number;
  savingsAmount: number;
  savingsPercentage: number;
  resellerMargin?: number;
}

interface NetworkInfo {
  name: string;
  color: string;
  prefixes: string[];
}

interface PlansResponse {
  plans: DataPlan[];
  networks: Record<string, NetworkInfo>;
  discount: { percentage: number; isActive: boolean };
  profitMargin: number;
}

const purchaseSchema = z.object({
  phoneNumber: z.string()
    .min(11, "Phone number must be at least 11 digits")
    .max(14, "Phone number is too long")
    .regex(/^(0|234|\+234)[789][01]\d{8}$/, "Enter a valid Nigerian phone number"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
});

type PurchaseFormData = z.infer<typeof purchaseSchema>;

export default function StorePage() {
  const params = useParams<{ subdomain: string }>();
  const subdomain = params.subdomain || "";
  const searchParams = useSearch();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"data" | "airtime">("data");
  const [selectedNetwork, setSelectedNetwork] = useState<string>("all");
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [airtimeAmount, setAirtimeAmount] = useState<string>("");

  // Parse URL params for status messages
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const status = params.get("status");
    const message = params.get("message");
    
    if (status === "success") {
      toast({
        title: "Purchase Successful",
        description: message?.replace(/\+/g, " ") || "Your purchase has been completed successfully!",
      });
    } else if (status === "failed" || status === "error") {
      toast({
        title: "Purchase Failed",
        description: message?.replace(/\+/g, " ") || "There was an issue with your purchase.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  // Fetch store configuration
  const { data: storeConfig, isLoading: configLoading, error: configError } = useQuery<StoreConfig>({
    queryKey: ["/api/store", subdomain],
    enabled: !!subdomain && subdomain.length >= 3,
  });

  // Fetch VTU plans
  const { data: plansData, isLoading: plansLoading } = useQuery<PlansResponse>({
    queryKey: ["/api/store", subdomain, "plans"],
    enabled: !!subdomain && subdomain.length >= 3 && !!storeConfig,
  });

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      phoneNumber: "",
      email: "",
    },
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async (data: { 
      serviceType: "data" | "airtime"; 
      planId?: string; 
      phoneNumber: string; 
      email?: string;
      amount?: number;
    }) => {
      const response = await apiRequest("POST", `/api/store/${subdomain}/purchase`, data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to process purchase",
        variant: "destructive",
      });
    },
  });

  // Filter plans by network
  const filteredPlans = useMemo(() => {
    if (!plansData?.plans) return [];
    if (selectedNetwork === "all") return plansData.plans;
    return plansData.plans.filter(plan => plan.network === selectedNetwork);
  }, [plansData?.plans, selectedNetwork]);

  // Get unique networks
  const networks = useMemo(() => {
    if (!plansData?.plans) return [];
    const uniqueNetworks = Array.from(new Set(plansData.plans.map(p => p.network)));
    return uniqueNetworks;
  }, [plansData?.plans]);

  const onSubmit = (formData: PurchaseFormData) => {
    if (activeTab === "data" && !selectedPlan) {
      toast({
        title: "Select a Plan",
        description: "Please select a data plan to continue",
        variant: "destructive",
      });
      return;
    }

    if (activeTab === "airtime") {
      const amount = parseFloat(airtimeAmount);
      if (!amount || amount < 50 || amount > 50000) {
        toast({
          title: "Invalid Amount",
          description: "Airtime amount must be between ₦50 and ₦50,000",
          variant: "destructive",
        });
        return;
      }
    }

    purchaseMutation.mutate({
      serviceType: activeTab,
      planId: activeTab === "data" ? selectedPlan?.id : undefined,
      phoneNumber: formData.phoneNumber,
      email: formData.email || undefined,
      amount: activeTab === "airtime" ? parseFloat(airtimeAmount) : undefined,
    });
  };

  // Custom CSS variables for branding
  const customStyles = useMemo(() => {
    if (!storeConfig) return {};
    return {
      "--store-primary": storeConfig.primaryColor,
      "--store-secondary": storeConfig.secondaryColor,
    } as React.CSSProperties;
  }, [storeConfig]);

  // Loading state
  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading store...</p>
        </div>
      </div>
    );
  }

  // Error or not found state
  if (configError || !storeConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-4">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Store Not Found</CardTitle>
            <CardDescription>
              The store you're looking for doesn't exist or is not active.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <a href="/" className="text-primary underline">
              Visit EKSU Marketplace
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" style={customStyles}>
      {/* Header */}
      <header 
        className="border-b py-4 px-4"
        style={{ backgroundColor: storeConfig.primaryColor + "10" }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {storeConfig.logoUrl ? (
              <img 
                src={storeConfig.logoUrl} 
                alt={storeConfig.siteName} 
                className="h-10 w-10 rounded-md object-cover"
                data-testid="img-store-logo"
              />
            ) : (
              <div 
                className="h-10 w-10 rounded-md flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: storeConfig.primaryColor }}
              >
                {storeConfig.siteName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-bold text-lg" data-testid="text-store-name">
                {storeConfig.siteName}
              </h1>
              {storeConfig.siteDescription && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {storeConfig.siteDescription}
                </p>
              )}
            </div>
          </div>
          
          {/* Contact buttons */}
          <div className="flex items-center gap-2">
            {storeConfig.whatsappNumber && (
              <a 
                href={`https://wa.me/${storeConfig.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-whatsapp"
              >
                <Button variant="outline" size="icon">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </a>
            )}
            {storeConfig.contactPhone && (
              <a href={`tel:${storeConfig.contactPhone}`} data-testid="link-phone">
                <Button variant="outline" size="icon">
                  <Phone className="h-4 w-4" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-4 pb-24">
        {/* Success/Error Banner from URL */}
        {searchParams && (
          <URLStatusBanner searchParams={searchParams} />
        )}

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          {/* Plans Section */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "data" | "airtime")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="data" className="gap-2" data-testid="tab-data">
                  <Wifi className="h-4 w-4" />
                  Data
                </TabsTrigger>
                <TabsTrigger value="airtime" className="gap-2" data-testid="tab-airtime">
                  <Phone className="h-4 w-4" />
                  Airtime
                </TabsTrigger>
              </TabsList>

              <TabsContent value="data" className="mt-4">
                {/* Network Filter */}
                <div className="mb-4">
                  <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                    <SelectTrigger className="w-[180px]" data-testid="select-network">
                      <SelectValue placeholder="Filter by network" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Networks</SelectItem>
                      {networks.map(network => (
                        <SelectItem key={network} value={network}>
                          {network.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Plans Grid */}
                {plansLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {filteredPlans.map(plan => (
                      <Card 
                        key={plan.id}
                        className={`cursor-pointer transition-all ${
                          selectedPlan?.id === plan.id 
                            ? "ring-2 ring-offset-2 ring-primary" 
                            : "hover-elevate"
                        }`}
                        onClick={() => setSelectedPlan(plan)}
                        data-testid={`card-plan-${plan.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Badge variant="secondary" className="mb-2">
                                {plan.network.toUpperCase()}
                              </Badge>
                              <h3 className="font-semibold">{plan.dataAmount}</h3>
                              <p className="text-xs text-muted-foreground">{plan.validity}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg" style={{ color: storeConfig.primaryColor }}>
                                ₦{plan.sellingPrice.toLocaleString()}
                              </p>
                              {plan.marketPrice > plan.sellingPrice && (
                                <p className="text-xs text-muted-foreground line-through">
                                  ₦{plan.marketPrice.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          {selectedPlan?.id === plan.id && (
                            <div className="mt-2 flex items-center gap-1 text-sm" style={{ color: storeConfig.primaryColor }}>
                              <CheckCircle className="h-4 w-4" />
                              Selected
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                
                {filteredPlans.length === 0 && !plansLoading && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No data plans available for this network.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="airtime" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Buy Airtime</CardTitle>
                    <CardDescription>
                      Enter the amount of airtime you want to purchase
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Amount (₦)</label>
                        <Input
                          type="number"
                          placeholder="Enter amount (50 - 50,000)"
                          value={airtimeAmount}
                          onChange={(e) => setAirtimeAmount(e.target.value)}
                          min={50}
                          max={50000}
                          data-testid="input-airtime-amount"
                        />
                      </div>
                      
                      {/* Quick amounts */}
                      <div className="flex flex-wrap gap-2">
                        {[100, 200, 500, 1000, 2000, 5000].map(amount => (
                          <Button
                            key={amount}
                            variant={airtimeAmount === amount.toString() ? "default" : "outline"}
                            size="sm"
                            onClick={() => setAirtimeAmount(amount.toString())}
                            data-testid={`button-amount-${amount}`}
                          >
                            ₦{amount.toLocaleString()}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Purchase Form */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Complete Purchase</CardTitle>
                <CardDescription>
                  Enter your phone number to receive the {activeTab}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="08012345678" 
                              {...field} 
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="email"
                              placeholder="you@example.com" 
                              {...field} 
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Order Summary */}
                    <div className="border rounded-md p-3 bg-muted/50 space-y-2">
                      <p className="text-sm font-medium">Order Summary</p>
                      {activeTab === "data" && selectedPlan && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>{selectedPlan.network.toUpperCase()} {selectedPlan.dataAmount}</span>
                            <span className="font-medium">₦{selectedPlan.sellingPrice.toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{selectedPlan.validity}</p>
                        </>
                      )}
                      {activeTab === "airtime" && airtimeAmount && (
                        <div className="flex justify-between text-sm">
                          <span>Airtime</span>
                          <span className="font-medium">₦{parseFloat(airtimeAmount).toLocaleString()}</span>
                        </div>
                      )}
                      {!selectedPlan && activeTab === "data" && (
                        <p className="text-sm text-muted-foreground">Select a data plan</p>
                      )}
                      {!airtimeAmount && activeTab === "airtime" && (
                        <p className="text-sm text-muted-foreground">Enter airtime amount</p>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={
                        purchaseMutation.isPending || 
                        (activeTab === "data" && !selectedPlan) ||
                        (activeTab === "airtime" && !airtimeAmount)
                      }
                      style={{ backgroundColor: storeConfig.primaryColor }}
                      data-testid="button-purchase"
                    >
                      {purchaseMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>Pay Now</>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t bg-background py-3 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Powered by</span>
          <a 
            href="/" 
            className="font-medium text-foreground inline-flex items-center gap-1"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-powered-by"
          >
            EKSU Marketplace
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}

// Component to show status from URL params
function URLStatusBanner({ searchParams }: { searchParams: string }) {
  const params = new URLSearchParams(searchParams);
  const status = params.get("status");
  const message = params.get("message");
  const reference = params.get("ref");

  if (!status) return null;

  const isSuccess = status === "success";

  return (
    <Card className={`${isSuccess ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-destructive bg-destructive/10"}`}>
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          {isSuccess ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : (
            <XCircle className="h-6 w-6 text-destructive" />
          )}
          <div>
            <p className="font-medium">
              {isSuccess ? "Purchase Successful!" : "Purchase Failed"}
            </p>
            {message && (
              <p className="text-sm text-muted-foreground">
                {message.replace(/\+/g, " ")}
              </p>
            )}
            {reference && isSuccess && (
              <p className="text-xs text-muted-foreground mt-1">
                Reference: {reference}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

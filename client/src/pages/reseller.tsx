import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Store, TrendingUp, Users, DollarSign, Settings, History, 
  CheckCircle, Crown, Rocket, Building2, ExternalLink, Copy,
  Loader2, AlertCircle, Phone, Mail, Globe, Key, Terminal, 
  Shield, Eye, EyeOff, Code, Zap, RefreshCw, Wallet, Building, 
  CreditCard, ArrowDownToLine, Clock
} from "lucide-react";
import { format } from "date-fns";
import type { ResellerSite, ResellerTransaction, ResellerCustomer, Wallet, User, ResellerWithdrawal } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiTerminal } from "@/components/api-terminal";

type ResellerTier = "starter" | "business" | "enterprise";

interface TierInfo {
  id: ResellerTier;
  name: string;
  price: number;
  dailyLimit: string;
  profitMargin: string;
  features: string[];
  icon: any;
  popular?: boolean;
}

const TIER_INFO: TierInfo[] = [
  {
    id: "starter",
    name: "Starter",
    price: 5000,
    dailyLimit: "₦50,000",
    profitMargin: "5%",
    features: [
      "Subdomain (yourname.eksuplug.com)",
      "₦50,000 daily transaction limit",
      "5% profit margin on all sales",
      "Basic dashboard analytics",
      "Email support",
    ],
    icon: Rocket,
  },
  {
    id: "business",
    name: "Business",
    price: 15000,
    dailyLimit: "₦200,000",
    profitMargin: "7%",
    popular: true,
    features: [
      "Everything in Starter",
      "₦200,000 daily transaction limit",
      "7% profit margin on all sales",
      "Custom branding (logo, colors)",
      "Priority support",
      "Customer management",
    ],
    icon: Building2,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 50000,
    dailyLimit: "Unlimited",
    profitMargin: "10%",
    features: [
      "Everything in Business",
      "Unlimited daily transactions",
      "10% profit margin on all sales",
      "Custom domain support",
      "API access (coming soon)",
      "Dedicated account manager",
      "Advanced analytics",
    ],
    icon: Crown,
  },
];

const createResellerFormSchema = z.object({
  tier: z.enum(["starter", "business", "enterprise"]),
  siteName: z.string().min(3, "Site name must be at least 3 characters").max(100),
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, "Subdomain can only contain lowercase letters, numbers, and hyphens"),
  siteDescription: z.string().max(500).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(20).optional(),
  whatsappNumber: z.string().max(20).optional(),
  businessName: z.string().max(200).optional(),
});

const updateSettingsFormSchema = z.object({
  siteName: z.string().min(3, "Site name must be at least 3 characters").max(100),
  siteDescription: z.string().max(500).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(20).optional(),
  whatsappNumber: z.string().max(20).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional(),
});

const withdrawalFormSchema = z.object({
  amount: z.coerce.number().min(1000, "Minimum withdrawal is ₦1,000"),
  bankName: z.string().min(2, "Bank name is required"),
  accountNumber: z.string().min(10, "Account number must be 10 digits").max(10, "Account number must be 10 digits"),
  accountName: z.string().min(2, "Account name is required"),
});

const NIGERIAN_BANKS = [
  "Access Bank",
  "First Bank",
  "Guaranty Trust Bank (GTBank)",
  "United Bank for Africa (UBA)",
  "Zenith Bank",
  "Ecobank",
  "Fidelity Bank",
  "First City Monument Bank (FCMB)",
  "Polaris Bank",
  "Stanbic IBTC Bank",
  "Sterling Bank",
  "Union Bank",
  "Wema Bank",
  "Keystone Bank",
  "Unity Bank",
  "Jaiz Bank",
  "Providus Bank",
  "SunTrust Bank",
  "Titan Trust Bank",
  "Globus Bank",
  "Parallex Bank",
  "Kuda Bank",
  "Opay",
  "PalmPay",
  "Moniepoint",
  "Carbon",
  "Eyowo",
];

export function TierCard({ tier, isSelected, onSelect, disabled }: { 
  tier: TierInfo; 
  isSelected: boolean; 
  onSelect: () => void;
  disabled?: boolean;
}) {
  const Icon = tier.icon;
  
  return (
    <Card 
      className={`relative cursor-pointer transition-all ${
        isSelected 
          ? "border-2 border-primary ring-2 ring-primary/20" 
          : "hover-elevate"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={() => !disabled && onSelect()}
      data-testid={`card-tier-${tier.id}`}
    >
      {tier.popular && (
        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
          Most Popular
        </Badge>
      )}
      <CardHeader className="text-center pt-6">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">{tier.name}</CardTitle>
        <CardDescription>
          <span className="text-2xl font-bold text-foreground">₦{tier.price.toLocaleString()}</span>
          <span className="text-muted-foreground"> one-time</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Daily Limit</span>
          <span className="font-medium">{tier.dailyLimit}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Profit Margin</span>
          <Badge variant="secondary">{tier.profitMargin}</Badge>
        </div>
        <hr />
        <ul className="space-y-2">
          {tier.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          variant={isSelected ? "default" : "outline"}
          disabled={disabled}
          data-testid={`button-select-tier-${tier.id}`}
        >
          {isSelected ? "Selected" : "Select Plan"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function TierSelectionView({ wallet }: { wallet: Wallet | undefined }) {
  const [selectedTier, setSelectedTier] = useState<ResellerTier>("business");
  const [step, setStep] = useState<"select" | "setup">("select");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof createResellerFormSchema>>({
    resolver: zodResolver(createResellerFormSchema),
    defaultValues: {
      tier: "business",
      siteName: "",
      subdomain: "",
      siteDescription: "",
      contactEmail: "",
      contactPhone: "",
      whatsappNumber: "",
      businessName: "",
    },
  });

  const createResellerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createResellerFormSchema>) => {
      const response = await apiRequest("POST", "/api/reseller", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Your reseller site has been created!" });
      queryClient.invalidateQueries({ queryKey: ["/api/reseller"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create reseller site",
        variant: "destructive"
      });
    },
  });

  const selectedTierInfo = TIER_INFO.find(t => t.id === selectedTier)!;
  const hasEnoughBalance = wallet && parseFloat(wallet.balance) >= selectedTierInfo.price;

  const handleContinue = () => {
    form.setValue("tier", selectedTier);
    setStep("setup");
  };

  const onSubmit = (data: z.infer<typeof createResellerFormSchema>) => {
    createResellerMutation.mutate(data);
  };

  if (step === "setup") {
    return (
      <div className="container max-w-2xl mx-auto py-6 px-4">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setStep("select")} data-testid="button-back-to-tiers">
            Back to Plans
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Set Up Your Reseller Site
            </CardTitle>
            <CardDescription>
              Configure your {selectedTierInfo.name} plan (₦{selectedTierInfo.price.toLocaleString()})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="siteName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="My VTU Business" {...field} data-testid="input-site-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="subdomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subdomain *</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input 
                            placeholder="my-vtu-business" 
                            {...field} 
                            onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                            data-testid="input-subdomain"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">.eksuplug.com</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="siteDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe your VTU business..." 
                          {...field} 
                          data-testid="input-site-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="contact@example.com" 
                            {...field} 
                            data-testid="input-contact-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="08012345678" 
                            {...field} 
                            data-testid="input-contact-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="whatsappNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp Number</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="08012345678" 
                          {...field} 
                          data-testid="input-whatsapp"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Your business name" 
                          {...field} 
                          data-testid="input-business-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-medium">Setup Fee:</span>
                    <span className="text-xl font-bold">₦{selectedTierInfo.price.toLocaleString()}</span>
                  </div>
                  
                  {!hasEnoughBalance && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md mb-4">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm text-destructive">
                        Insufficient balance. You need ₦{selectedTierInfo.price.toLocaleString()} to proceed.
                      </span>
                    </div>
                  )}
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={!hasEnoughBalance || createResellerMutation.isPending}
                    data-testid="button-create-reseller"
                  >
                    {createResellerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Reseller Site (₦{selectedTierInfo.price.toLocaleString()})
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Become a VTU Reseller</h1>
        <p className="text-muted-foreground">
          Start your own VTU business with your personalized subdomain. Earn commissions on every sale!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {TIER_INFO.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            isSelected={selectedTier === tier.id}
            onSelect={() => setSelectedTier(tier.id)}
          />
        ))}
      </div>

      <div className="text-center">
        <div className="mb-4 text-sm text-muted-foreground">
          Your current balance: <span className="font-medium text-foreground">₦{wallet ? parseFloat(wallet.balance).toLocaleString() : "0"}</span>
        </div>
        <Button 
          size="lg" 
          onClick={handleContinue}
          disabled={!hasEnoughBalance}
          data-testid="button-continue-setup"
        >
          Continue with {selectedTierInfo.name} Plan
        </Button>
        {!hasEnoughBalance && (
          <p className="text-sm text-destructive mt-2">
            Please fund your wallet to continue
          </p>
        )}
      </div>
    </div>
  );
}

export function StatsCard({ title, value, icon: Icon, subtext }: { 
  title: string; 
  value: string; 
  icon: any; 
  subtext?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ResellerDashboard({ site }: { site: ResellerSite }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showApiTerminal, setShowApiTerminal] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const isAdmin = currentUser?.role === "admin";

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalRevenue: string;
    totalProfit: string;
    totalTransactions: number;
    activeCustomers: number;
  }>({
    queryKey: ["/api/reseller/stats"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<ResellerTransaction[]>({
    queryKey: ["/api/reseller/transactions"],
  });

  const { data: customers, isLoading: customersLoading } = useQuery<ResellerCustomer[]>({
    queryKey: ["/api/reseller/customers"],
  });

  // Withdrawal queries and mutations
  const { data: withdrawalData, isLoading: withdrawalsLoading } = useQuery<{
    withdrawals: ResellerWithdrawal[];
    summary: {
      totalEarnings: number;
      withdrawnAmount: number;
      availableBalance: number;
      pendingWithdrawals: number;
    };
  }>({
    queryKey: ["/api/reseller/withdrawals"],
  });

  const withdrawalForm = useForm<z.infer<typeof withdrawalFormSchema>>({
    resolver: zodResolver(withdrawalFormSchema),
    defaultValues: {
      amount: 0,
      bankName: "",
      accountNumber: "",
      accountName: "",
    },
  });

  const createWithdrawalMutation = useMutation({
    mutationFn: async (data: z.infer<typeof withdrawalFormSchema>) => {
      const response = await apiRequest("POST", "/api/reseller/withdraw", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message || "Withdrawal request submitted" });
      queryClient.invalidateQueries({ queryKey: ["/api/reseller/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reseller/stats"] });
      withdrawalForm.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to submit withdrawal request",
        variant: "destructive"
      });
    },
  });

  const generateApiMutation = useMutation({
    mutationFn: async (credentials: { apiKey: string; apiSecret: string; webhookSecret: string }) => {
      const response = await apiRequest("POST", "/api/reseller/api-keys", credentials);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "API credentials generated and saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/reseller"] });
      setShowApiTerminal(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to generate API credentials",
        variant: "destructive"
      });
    },
  });

  const regenerateApiMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/reseller/api-keys");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "API Keys Revoked", description: "Your old API keys have been revoked. Generate new ones." });
      queryClient.invalidateQueries({ queryKey: ["/api/reseller"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to revoke API keys",
        variant: "destructive"
      });
    },
  });

  const settingsForm = useForm<z.infer<typeof updateSettingsFormSchema>>({
    resolver: zodResolver(updateSettingsFormSchema),
    defaultValues: {
      siteName: site.siteName || "",
      siteDescription: site.siteDescription || "",
      contactEmail: site.contactEmail || "",
      contactPhone: site.contactPhone || "",
      whatsappNumber: site.whatsappNumber || "",
      primaryColor: site.primaryColor || "#16a34a",
      secondaryColor: site.secondaryColor || "#0ea5e9",
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof updateSettingsFormSchema>) => {
      const response = await apiRequest("PATCH", "/api/reseller", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Settings updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/reseller"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update settings",
        variant: "destructive"
      });
    },
  });

  const siteUrl = `https://${site.subdomain}.eksuplug.com`;
  const tierInfo = TIER_INFO.find(t => t.id === site.tier)!;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Link copied to clipboard" });
  };

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6" />
            {site.siteName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{tierInfo.name} Plan</Badge>
            <Badge variant={site.status === "active" ? "default" : "destructive"}>
              {site.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => copyToClipboard(siteUrl)}
            data-testid="button-copy-url"
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy Link
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(siteUrl, "_blank")}
            data-testid="button-visit-site"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Visit Site
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <TrendingUp className="h-4 w-4 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">
            <History className="h-4 w-4 mr-1" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">
            <Users className="h-4 w-4 mr-1" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="withdrawals" data-testid="tab-withdrawals">
            <Wallet className="h-4 w-4 mr-1" />
            Earnings
          </TabsTrigger>
          <TabsTrigger value="api" data-testid="tab-api">
            <Key className="h-4 w-4 mr-1" />
            API Access
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statsLoading ? (
              Array(4).fill(0).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <StatsCard 
                  title="Total Revenue" 
                  value={`₦${parseFloat(stats?.totalRevenue || "0").toLocaleString()}`}
                  icon={DollarSign}
                />
                <StatsCard 
                  title="Total Profit" 
                  value={`₦${parseFloat(stats?.totalProfit || "0").toLocaleString()}`}
                  icon={TrendingUp}
                  subtext={`${tierInfo.profitMargin} profit margin`}
                />
                <StatsCard 
                  title="Transactions" 
                  value={(stats?.totalTransactions || 0).toLocaleString()}
                  icon={History}
                />
                <StatsCard 
                  title="Customers" 
                  value={(stats?.activeCustomers || 0).toLocaleString()}
                  icon={Users}
                />
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Site URL</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{siteUrl}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Daily Limit</Label>
                  <p className="font-medium">{tierInfo.dailyLimit}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Plan</Label>
                  <p className="font-medium">{tierInfo.name} - {tierInfo.profitMargin} profit</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Member Since</Label>
                  <p className="font-medium">
                    {site.createdAt ? format(new Date(site.createdAt), "MMM d, yyyy") : "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>View all transactions through your reseller site</CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-2">
                  {Array(5).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : transactions && transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                        <TableCell className="text-sm">
                          {tx.createdAt ? format(new Date(tx.createdAt), "MMM d, HH:mm") : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{tx.serviceType}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.customerPhone || tx.customerEmail || "N/A"}
                        </TableCell>
                        <TableCell className="font-medium">
                          ₦{parseFloat(tx.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-green-600 dark:text-green-400">
                          +₦{parseFloat(tx.resellerProfit).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.status === "completed" ? "default" : tx.status === "failed" ? "destructive" : "secondary"}>
                            {tx.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No transactions yet</p>
                  <p className="text-sm">Share your site link to start earning!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle>Your Customers</CardTitle>
              <CardDescription>Repeat customers who purchased through your site</CardDescription>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <div className="space-y-2">
                  {Array(5).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : customers && customers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Last Purchase</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                        <TableCell className="font-medium">
                          {customer.name || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {customer.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {customer.phone}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {customer.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{customer.totalTransactions}</TableCell>
                        <TableCell className="font-medium">
                          ₦{parseFloat(customer.totalSpent || "0").toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {customer.lastTransactionAt 
                            ? format(new Date(customer.lastTransactionAt), "MMM d, yyyy")
                            : "N/A"
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No customers yet</p>
                  <p className="text-sm">Customers will appear here after their first purchase</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {withdrawalsLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-8 w-32" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                <>
                  <StatsCard 
                    title="Total Earnings" 
                    value={`₦${(withdrawalData?.summary?.totalEarnings || 0).toLocaleString()}`}
                    icon={TrendingUp}
                  />
                  <StatsCard 
                    title="Available Balance" 
                    value={`₦${(withdrawalData?.summary?.availableBalance || 0).toLocaleString()}`}
                    icon={Wallet}
                  />
                  <StatsCard 
                    title="Withdrawn" 
                    value={`₦${(withdrawalData?.summary?.withdrawnAmount || 0).toLocaleString()}`}
                    icon={ArrowDownToLine}
                  />
                  <StatsCard 
                    title="Pending Withdrawals" 
                    value={`₦${(withdrawalData?.summary?.pendingWithdrawals || 0).toLocaleString()}`}
                    icon={Clock}
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownToLine className="h-5 w-5" />
                    Request Withdrawal
                  </CardTitle>
                  <CardDescription>
                    Withdraw your earnings to your bank account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...withdrawalForm}>
                    <form onSubmit={withdrawalForm.handleSubmit((data) => createWithdrawalMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={withdrawalForm.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount (₦)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="Enter amount" 
                                {...field} 
                                data-testid="input-withdrawal-amount"
                              />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-muted-foreground">
                              Minimum: ₦1,000 | Available: ₦{(withdrawalData?.summary?.availableBalance || 0).toLocaleString()}
                            </p>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={withdrawalForm.control}
                        name="bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank Name</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-bank-name">
                                  <SelectValue placeholder="Select your bank" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {NIGERIAN_BANKS.map((bank) => (
                                  <SelectItem key={bank} value={bank}>
                                    {bank}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={withdrawalForm.control}
                        name="accountNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Number</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="10-digit account number" 
                                maxLength={10}
                                {...field} 
                                data-testid="input-account-number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={withdrawalForm.control}
                        name="accountName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Name on your bank account" 
                                {...field} 
                                data-testid="input-account-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Withdrawals over ₦50,000 require admin approval
                        </p>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={createWithdrawalMutation.isPending || (withdrawalData?.summary?.availableBalance || 0) < 1000}
                        data-testid="button-submit-withdrawal"
                      >
                        {createWithdrawalMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Request Withdrawal
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Withdrawal History
                  </CardTitle>
                  <CardDescription>
                    Track your withdrawal requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {withdrawalsLoading ? (
                    <div className="space-y-2">
                      {Array(3).fill(0).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : withdrawalData?.withdrawals && withdrawalData.withdrawals.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {withdrawalData.withdrawals.map((withdrawal) => (
                        <div 
                          key={withdrawal.id} 
                          className="p-3 rounded-md border bg-card"
                          data-testid={`card-withdrawal-${withdrawal.id}`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <span className="font-medium">
                              ₦{parseFloat(withdrawal.amount).toLocaleString()}
                            </span>
                            <Badge 
                              variant={
                                withdrawal.status === "completed" ? "default" : 
                                withdrawal.status === "processing" ? "secondary" :
                                withdrawal.status === "rejected" || withdrawal.status === "failed" ? "destructive" :
                                "outline"
                              }
                            >
                              {withdrawal.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2">
                              <Building className="h-3 w-3" />
                              {withdrawal.bankName}
                            </div>
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-3 w-3" />
                              {withdrawal.accountNumber} - {withdrawal.accountName}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              {withdrawal.createdAt ? format(new Date(withdrawal.createdAt), "MMM d, yyyy HH:mm") : "N/A"}
                            </div>
                            {withdrawal.adminNote && (
                              <div className="mt-2 p-2 rounded bg-muted text-xs">
                                <span className="font-medium">Note:</span> {withdrawal.adminNote}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No withdrawals yet</p>
                      <p className="text-sm">Your withdrawal history will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Access
                </CardTitle>
                <CardDescription>
                  Generate API credentials to integrate VTU services into your own applications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {site.apiKey ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/30">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-600 dark:text-green-400 font-medium">API Access Enabled</span>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 rounded-md bg-muted/50 space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">API Key (Public)</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="flex-1 p-2 rounded bg-background font-mono text-sm">
                              {site.apiKey}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(site.apiKey || "");
                                toast({ title: "Copied", description: "API Key copied to clipboard" });
                              }}
                              data-testid="button-copy-api-key"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">API Secret (Private)</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="flex-1 p-2 rounded bg-background font-mono text-sm">
                              {showApiSecret ? (site.apiSecret || "sk_live_****") : "sk_live_" + "*".repeat(28)}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowApiSecret(!showApiSecret)}
                              data-testid="button-toggle-api-secret"
                            >
                              {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(site.apiSecret || "");
                                toast({ title: "Copied", description: "API Secret copied to clipboard" });
                              }}
                              data-testid="button-copy-api-secret"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Never share your API Secret publicly
                          </p>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Rate Limit</Label>
                          <p className="font-medium">{site.apiRateLimit || 100} requests per minute</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          variant="destructive"
                          onClick={() => regenerateApiMutation.mutate()}
                          disabled={regenerateApiMutation.isPending}
                          data-testid="button-revoke-api"
                        >
                          {regenerateApiMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate API Keys
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center py-8 space-y-4">
                      <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Terminal className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Generate API Credentials</h3>
                        <p className="text-muted-foreground text-sm mt-1">
                          Create secure API keys to integrate VTU services into your applications
                        </p>
                      </div>
                      
                      {!isAdmin && (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Shield className="h-4 w-4" />
                          <span>One-time fee: <span className="font-bold text-foreground">₦5,000</span></span>
                        </div>
                      )}
                      {isAdmin && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                          Admin - Free Access
                        </Badge>
                      )}

                      <Button
                        size="lg"
                        onClick={() => setShowApiTerminal(true)}
                        data-testid="button-generate-api"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Generate API Keys
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Code className="h-8 w-8 mx-auto mb-2 text-primary" />
                          <h4 className="font-medium">Easy Integration</h4>
                          <p className="text-xs text-muted-foreground">Simple REST API with comprehensive documentation</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
                          <h4 className="font-medium">Secure</h4>
                          <p className="text-xs text-muted-foreground">Industry-standard encryption and authentication</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Zap className="h-8 w-8 mx-auto mb-2 text-primary" />
                          <h4 className="font-medium">Fast</h4>
                          <p className="text-xs text-muted-foreground">Real-time processing with instant webhooks</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {site.apiKey && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    API Documentation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-md bg-gray-900 text-gray-100 font-mono text-sm overflow-x-auto">
                    <p className="text-green-400"># Purchase Data</p>
                    <p className="text-gray-400">POST https://api.eksuplug.com/v1/data/purchase</p>
                    <p className="text-gray-500 mt-2"># Headers</p>
                    <p>Authorization: Bearer {"{"}your_api_key{"}"}</p>
                    <p>X-API-Secret: {"{"}your_api_secret{"}"}</p>
                    <p className="text-gray-500 mt-2"># Body</p>
                    <p>{"{"}</p>
                    <p className="pl-4">"phone": "08012345678",</p>
                    <p className="pl-4">"network": "mtn_sme",</p>
                    <p className="pl-4">"plan_id": "mtn_500mb_30days"</p>
                    <p>{"}"}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Available Endpoints</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>POST /v1/data/purchase - Purchase data</li>
                        <li>POST /v1/airtime/purchase - Purchase airtime</li>
                        <li>GET /v1/plans - List available plans</li>
                        <li>GET /v1/balance - Check wallet balance</li>
                        <li>GET /v1/transactions - List transactions</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Rate Limits</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>100 requests per minute</li>
                        <li>10,000 requests per day</li>
                        <li>Webhook retries: 3 attempts</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Site Settings</CardTitle>
              <CardDescription>Customize your reseller site appearance and contact info</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...settingsForm}>
                <form onSubmit={settingsForm.handleSubmit((data) => updateSettingsMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={settingsForm.control}
                    name="siteName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-settings-site-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={settingsForm.control}
                    name="siteDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} data-testid="input-settings-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={settingsForm.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-settings-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="contactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-settings-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={settingsForm.control}
                    name="whatsappNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-settings-whatsapp" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(site.tier === "business" || site.tier === "enterprise") && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={settingsForm.control}
                        name="primaryColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Color</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                <Input 
                                  type="color" 
                                  className="w-12 h-9 p-1 cursor-pointer" 
                                  {...field} 
                                  data-testid="input-settings-primary-color"
                                />
                                <Input {...field} placeholder="#16a34a" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={settingsForm.control}
                        name="secondaryColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secondary Color</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                <Input 
                                  type="color" 
                                  className="w-12 h-9 p-1 cursor-pointer" 
                                  {...field}
                                  data-testid="input-settings-secondary-color"
                                />
                                <Input {...field} placeholder="#0ea5e9" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    disabled={updateSettingsMutation.isPending}
                    data-testid="button-save-settings"
                  >
                    {updateSettingsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Settings
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ApiTerminal
        isOpen={showApiTerminal}
        onComplete={(credentials) => generateApiMutation.mutate(credentials)}
        onClose={() => setShowApiTerminal(false)}
        siteName={site.siteName}
        tier={site.tier}
        isAdmin={isAdmin}
      />
    </div>
  );
}

export default function ResellerPage() {
  const { data: resellerSite, isLoading: siteLoading } = useQuery<ResellerSite | null>({
    queryKey: ["/api/reseller"],
  });

  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
  });

  if (siteLoading || walletLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-6 px-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (resellerSite) {
    return <ResellerDashboard site={resellerSite} />;
  }

  return <TierSelectionView wallet={wallet} />;
}

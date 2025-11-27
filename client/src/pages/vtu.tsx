import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Wallet, Smartphone, Signal, CheckCircle, XCircle, Clock, Loader2, Plus, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { Wallet as WalletType, VtuPlan, VtuTransaction } from "@shared/schema";

type NetworkType = "mtn_sme" | "glo_cg" | "airtel_cg" | "9mobile";

interface NetworkInfo {
  id: NetworkType;
  name: string;
  displayName: string;
  color: string;
  bgColor: string;
  textColor: string;
  prefixes: string[];
}

const NETWORKS: NetworkInfo[] = [
  {
    id: "mtn_sme",
    name: "MTN SME",
    displayName: "MTN",
    color: "bg-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    textColor: "text-yellow-700 dark:text-yellow-300",
    prefixes: ["0803", "0806", "0703", "0706", "0813", "0816", "0810", "0814", "0903", "0906", "0913", "0916"],
  },
  {
    id: "glo_cg",
    name: "GLO CG",
    displayName: "GLO",
    color: "bg-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-700 dark:text-green-300",
    prefixes: ["0805", "0807", "0705", "0815", "0811", "0905", "0915"],
  },
  {
    id: "airtel_cg",
    name: "Airtel CG",
    displayName: "Airtel",
    color: "bg-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    textColor: "text-red-700 dark:text-red-300",
    prefixes: ["0802", "0808", "0708", "0812", "0701", "0902", "0907", "0901", "0912"],
  },
  {
    id: "9mobile",
    name: "9mobile",
    displayName: "9mobile",
    color: "bg-green-500",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    textColor: "text-emerald-700 dark:text-emerald-300",
    prefixes: ["0809", "0817", "0818", "0909", "0908"],
  },
];

function detectNetwork(phoneNumber: string): NetworkInfo | null {
  const cleaned = phoneNumber.replace(/\D/g, "");
  if (cleaned.length < 4) return null;
  
  const prefix = cleaned.startsWith("234") 
    ? "0" + cleaned.slice(3, 6) 
    : cleaned.slice(0, 4);
  
  for (const network of NETWORKS) {
    if (network.prefixes.includes(prefix)) {
      return network;
    }
  }
  return null;
}

function validatePhoneNumber(phone: string): { valid: boolean; message: string } {
  const cleaned = phone.replace(/\D/g, "");
  
  if (!cleaned) {
    return { valid: false, message: "" };
  }
  
  if (cleaned.startsWith("234")) {
    if (cleaned.length !== 13) {
      return { valid: false, message: "Phone number must be 13 digits when starting with 234" };
    }
    return { valid: true, message: "" };
  }
  
  if (cleaned.startsWith("0")) {
    if (cleaned.length !== 11) {
      return { valid: false, message: "Phone number must be 11 digits" };
    }
    return { valid: true, message: "" };
  }
  
  return { valid: false, message: "Phone number must start with 0 or 234" };
}

export default function VtuPage() {
  const { toast } = useToast();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>("mtn_sme");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletType>({
    queryKey: ["/api/wallet"],
  });

  const { data: plans, isLoading: plansLoading } = useQuery<VtuPlan[]>({
    queryKey: ["/api/vtu/plans", { network: selectedNetwork }],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<VtuTransaction[]>({
    queryKey: ["/api/vtu/transactions"],
  });

  const purchaseMutation = useMutation({
    mutationFn: async (data: { planId: string; phoneNumber: string }) => {
      const response = await apiRequest("POST", "/api/vtu/purchase", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Purchase Successful",
        description: "Data has been sent to the phone number.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vtu/transactions"] });
      setSelectedPlanId(null);
      setPhoneNumber("");
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Unable to complete the purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  const detectedNetwork = useMemo(() => detectNetwork(phoneNumber), [phoneNumber]);
  const phoneValidation = useMemo(() => validatePhoneNumber(phoneNumber), [phoneNumber]);
  const networkMatch = detectedNetwork?.id === selectedNetwork;

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId);
  const walletBalance = parseFloat(wallet?.balance || "0");
  const canPurchase = 
    selectedPlanId && 
    phoneValidation.valid && 
    selectedPlan && 
    walletBalance >= parseFloat(selectedPlan.sellingPrice);

  const handlePurchase = () => {
    if (!selectedPlanId || !phoneValidation.valid) return;

    if (detectedNetwork && !networkMatch) {
      toast({
        title: "Network Mismatch",
        description: `The phone number appears to be ${detectedNetwork.displayName}, but you selected ${NETWORKS.find(n => n.id === selectedNetwork)?.displayName}. Are you sure you want to continue?`,
        variant: "destructive",
      });
      return;
    }

    purchaseMutation.mutate({ planId: selectedPlanId, phoneNumber });
  };

  const getNetworkBadge = (networkId: NetworkType) => {
    const network = NETWORKS.find((n) => n.id === networkId);
    if (!network) return null;
    return (
      <Badge className={`${network.bgColor} ${network.textColor} border-0`}>
        {network.displayName}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case "pending":
      case "processing":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            {status === "processing" ? "Processing" : "Pending"}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="outline">
            Refunded
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handlePhoneChange = (value: string) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 13);
    setPhoneNumber(numericValue);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Buy Data</h1>
        <p className="text-muted-foreground">Purchase data bundles for any network</p>
      </div>

      <Card className="mb-8 bg-gradient-to-br from-primary/20 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wallet Balance</p>
                {walletLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <h2 className="text-2xl font-bold text-primary" data-testid="text-wallet-balance">
                    ₦{walletBalance.toLocaleString()}
                  </h2>
                )}
              </div>
            </div>
            <Link href="/wallet">
              <Button variant="outline" data-testid="link-fund-wallet">
                <Plus className="h-4 w-4 mr-2" />
                Fund Wallet
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Signal className="h-5 w-5" />
            Select Network & Plan
          </CardTitle>
          <CardDescription>Choose your preferred network and data plan</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedNetwork} onValueChange={(v) => {
            setSelectedNetwork(v as NetworkType);
            setSelectedPlanId(null);
          }}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              {NETWORKS.map((network) => (
                <TabsTrigger 
                  key={network.id} 
                  value={network.id}
                  data-testid={`tab-network-${network.id}`}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <span className={`w-2 h-2 rounded-full ${network.color} mr-2`} />
                  {network.displayName}
                </TabsTrigger>
              ))}
            </TabsList>

            {NETWORKS.map((network) => (
              <TabsContent key={network.id} value={network.id}>
                {plansLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-28" />
                    ))}
                  </div>
                ) : plans && plans.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`p-4 rounded-md border-2 cursor-pointer transition-all ${
                          selectedPlanId === plan.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover-elevate"
                        }`}
                        data-testid={`card-plan-${plan.id}`}
                      >
                        <div className="text-lg font-bold">{plan.dataAmount}</div>
                        <div className="text-sm text-muted-foreground">{plan.validity}</div>
                        <div className="text-lg font-semibold text-primary mt-2">
                          ₦{parseFloat(plan.sellingPrice).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Signal className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No plans available for this network.</p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Phone Number
          </CardTitle>
          <CardDescription>Enter the phone number to recharge</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone-number">Phone Number</Label>
            <div className="relative">
              <Input
                id="phone-number"
                type="tel"
                placeholder="08012345678"
                value={phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className={`pr-24 ${phoneValidation.message ? "border-red-500" : ""}`}
                data-testid="input-phone-number"
              />
              {detectedNetwork && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Badge 
                    className={`${detectedNetwork.bgColor} ${detectedNetwork.textColor} border-0`}
                    data-testid="badge-detected-network"
                  >
                    {detectedNetwork.displayName}
                  </Badge>
                </div>
              )}
            </div>
            {phoneValidation.message && (
              <p className="text-sm text-red-500 flex items-center gap-1" data-testid="text-phone-error">
                <AlertCircle className="h-4 w-4" />
                {phoneValidation.message}
              </p>
            )}
            {detectedNetwork && !networkMatch && phoneValidation.valid && (
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1" data-testid="text-network-mismatch">
                <AlertCircle className="h-4 w-4" />
                This number appears to be {detectedNetwork.displayName}, but you selected{" "}
                {NETWORKS.find((n) => n.id === selectedNetwork)?.displayName}
              </p>
            )}
            {networkMatch && phoneValidation.valid && (
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1" data-testid="text-network-match">
                <CheckCircle className="h-4 w-4" />
                Network verified
              </p>
            )}
          </div>

          {selectedPlan && (
            <div className="p-4 rounded-md bg-muted/50 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan:</span>
                <span className="font-medium">{selectedPlan.dataAmount} - {selectedPlan.validity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network:</span>
                {getNetworkBadge(selectedNetwork)}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-primary">₦{parseFloat(selectedPlan.sellingPrice).toLocaleString()}</span>
              </div>
            </div>
          )}

          {selectedPlan && walletBalance < parseFloat(selectedPlan.sellingPrice) && (
            <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Insufficient Balance</p>
                <p className="text-sm">You need ₦{(parseFloat(selectedPlan.sellingPrice) - walletBalance).toLocaleString()} more to purchase this plan.</p>
              </div>
            </div>
          )}

          <Button
            onClick={handlePurchase}
            disabled={!canPurchase || purchaseMutation.isPending}
            className="w-full"
            data-testid="button-purchase"
          >
            {purchaseMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Purchase Data
                {selectedPlan && ` - ₦${parseFloat(selectedPlan.sellingPrice).toLocaleString()}`}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>Your recent VTU purchases</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-md bg-muted/30"
                  data-testid={`transaction-${tx.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${NETWORKS.find(n => n.id === tx.network)?.bgColor || "bg-muted"}`}>
                      <Signal className={`h-4 w-4 ${NETWORKS.find(n => n.id === tx.network)?.textColor || "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <div className="font-medium flex flex-wrap items-center gap-2">
                        {tx.phoneNumber}
                        {getNetworkBadge(tx.network as NetworkType)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {tx.createdAt && format(new Date(tx.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:text-right">
                    <div>
                      <div className="font-bold">₦{parseFloat(tx.amount).toLocaleString()}</div>
                    </div>
                    {getStatusBadge(tx.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No transactions yet.</p>
              <p className="text-sm">Your VTU purchase history will appear here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Wallet, Smartphone, Signal, CheckCircle, XCircle, Clock, Loader2, Plus, AlertCircle, 
  Search, Phone, Zap, Star, Trash2, Filter, Gift, Calendar, 
  Play, Pause, Send, Copy
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { 
  Wallet as WalletType, 
  VtuTransaction, 
  VtuBeneficiary,
  ScheduledVtuPurchase,
  GiftData
} from "@shared/schema";

type NetworkType = "mtn" | "glo" | "airtel" | "9mobile";
type ServiceType = "data" | "airtime" | "cable" | "electricity" | "exam" | "schedule" | "gift";
type ScheduleFrequency = "daily" | "weekly" | "monthly";

interface DataPlan {
  id: string;
  network: NetworkType;
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
}

interface PlansApiResponse {
  plans: DataPlan[];
  discount: { description: string; averageSavings: string };
  networks: Record<NetworkType, { name: string; displayName: string; color: string; bgColor: string; textColor: string; airtimeDiscount: number }>;
}

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
    id: "mtn",
    name: "MTN",
    displayName: "MTN",
    color: "bg-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    textColor: "text-yellow-700 dark:text-yellow-300",
    prefixes: ["0803", "0806", "0703", "0704", "0706", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916", "0702"],
  },
  {
    id: "glo",
    name: "GLO",
    displayName: "GLO",
    color: "bg-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-700 dark:text-green-300",
    prefixes: ["0805", "0807", "0705", "0815", "0811", "0905", "0915"],
  },
  {
    id: "airtel",
    name: "Airtel",
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
    color: "bg-emerald-500",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    textColor: "text-emerald-700 dark:text-emerald-300",
    prefixes: ["0809", "0817", "0818", "0908", "0909"],
  },
];

const AIRTIME_AMOUNTS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
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

function PriceDisplay({ 
  marketPrice, 
  sellingPrice, 
  savingsPercentage,
  size = "default" 
}: { 
  marketPrice: number; 
  sellingPrice: number; 
  savingsPercentage: number;
  size?: "default" | "large" | "small";
}) {
  const textSize = size === "large" ? "text-xl" : size === "small" ? "text-sm" : "text-base";
  const badgeSize = size === "large" ? "text-sm" : "text-xs";
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`font-bold ${textSize} text-foreground`}>
        ₦{sellingPrice.toLocaleString()}
      </span>
      {savingsPercentage > 0 && (
        <>
          <span className={`${size === "small" ? "text-xs" : "text-sm"} text-muted-foreground line-through`}>
            ₦{marketPrice.toLocaleString()}
          </span>
          <Badge variant="secondary" className={`${badgeSize} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300`}>
            Save {savingsPercentage}%
          </Badge>
        </>
      )}
    </div>
  );
}

export default function VtuPage() {
  const { toast } = useToast();
  const [serviceType, setServiceType] = useState<ServiceType>("data");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>("mtn");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [customAirtimeAmount, setCustomAirtimeAmount] = useState("");
  const [selectedAirtimeAmount, setSelectedAirtimeAmount] = useState<number | null>(null);
  
  const [showBeneficiaryDialog, setShowBeneficiaryDialog] = useState(false);
  const [newBeneficiaryName, setNewBeneficiaryName] = useState("");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<VtuBeneficiary | null>(null);
  
  const [txStatusFilter, setTxStatusFilter] = useState<string>("all");
  const [txNetworkFilter, setTxNetworkFilter] = useState<string>("all");

  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<ScheduleFrequency>("daily");
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState<number>(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState<number>(1);
  const [scheduleTimeOfDay, setScheduleTimeOfDay] = useState<string>("09:00");
  const [schedulePhoneNumber, setSchedulePhoneNumber] = useState("");
  const [scheduleNetwork, setScheduleNetwork] = useState<NetworkType>("mtn");
  const [scheduleServiceType, setScheduleServiceType] = useState<"data" | "airtime">("data");
  const [schedulePlanId, setSchedulePlanId] = useState<string | null>(null);
  const [scheduleAirtimeAmount, setScheduleAirtimeAmount] = useState<string>("");

  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const [giftRecipientPhone, setGiftRecipientPhone] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftPlanId, setGiftPlanId] = useState<string | null>(null);
  const [giftNetwork, setGiftNetwork] = useState<NetworkType>("mtn");
  const [giftTab, setGiftTab] = useState<"send" | "sent" | "received">("send");

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletType>({
    queryKey: ["/api/wallet"],
  });

  const { data: plansData, isLoading: plansLoading } = useQuery<PlansApiResponse>({
    queryKey: ["/api/vtu/plans", { network: selectedNetwork }],
  });

  const { data: schedulePlansData } = useQuery<PlansApiResponse>({
    queryKey: ["/api/vtu/plans", { network: scheduleNetwork }],
    enabled: showScheduleDialog,
  });

  const { data: giftPlansData } = useQuery<PlansApiResponse>({
    queryKey: ["/api/vtu/plans", { network: giftNetwork }],
    enabled: serviceType === "gift" || showGiftDialog,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<VtuTransaction[]>({
    queryKey: ["/api/vtu/transactions", { status: txStatusFilter !== "all" ? txStatusFilter : undefined, network: txNetworkFilter !== "all" ? txNetworkFilter : undefined }],
  });

  const { data: beneficiaries } = useQuery<VtuBeneficiary[]>({
    queryKey: ["/api/vtu/beneficiaries"],
  });

  const { data: scheduledPurchases, isLoading: schedulesLoading } = useQuery<ScheduledVtuPurchase[]>({
    queryKey: ["/api/vtu/scheduled-purchases"],
    enabled: serviceType === "schedule",
  });

  const { data: sentGifts, isLoading: sentGiftsLoading } = useQuery<GiftData[]>({
    queryKey: ["/api/vtu/gift-data", { type: "sent" }],
    enabled: serviceType === "gift",
  });

  const { data: receivedGifts, isLoading: receivedGiftsLoading } = useQuery<GiftData[]>({
    queryKey: ["/api/vtu/gift-data", { type: "received" }],
    enabled: serviceType === "gift",
  });

  const plans = plansData?.plans || [];
  const schedulePlans = schedulePlansData?.plans || [];
  const giftPlans = giftPlansData?.plans || [];
  const discount = plansData?.discount;

  const createBeneficiaryMutation = useMutation({
    mutationFn: async (data: { name: string; phoneNumber: string; network: NetworkType }) => {
      const response = await apiRequest("POST", "/api/vtu/beneficiaries", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Beneficiary saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/vtu/beneficiaries"] });
      setShowBeneficiaryDialog(false);
      setNewBeneficiaryName("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save beneficiary", variant: "destructive" });
    },
  });

  const deleteBeneficiaryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/vtu/beneficiaries/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Beneficiary removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/vtu/beneficiaries"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete beneficiary", variant: "destructive" });
    },
  });

  const purchaseDataMutation = useMutation({
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

  const purchaseAirtimeMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; amount: number; network: NetworkType }) => {
      const response = await apiRequest("POST", "/api/vtu/airtime", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Airtime Purchase Successful",
        description: "Airtime has been sent to the phone number.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vtu/transactions"] });
      setSelectedAirtimeAmount(null);
      setCustomAirtimeAmount("");
      setPhoneNumber("");
    },
    onError: (error: any) => {
      toast({
        title: "Airtime Purchase Failed",
        description: error.message || "Unable to complete the purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: {
      serviceType: "data" | "airtime";
      planId?: string;
      network: NetworkType;
      phoneNumber: string;
      amount?: number;
      frequency: ScheduleFrequency;
      dayOfWeek?: number;
      dayOfMonth?: number;
      timeOfDay?: string;
    }) => {
      const response = await apiRequest("POST", "/api/vtu/scheduled-purchases", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Schedule Created", description: "Your scheduled purchase has been set up." });
      queryClient.invalidateQueries({ queryKey: ["/api/vtu/scheduled-purchases"] });
      setShowScheduleDialog(false);
      resetScheduleForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create schedule", variant: "destructive" });
    },
  });

  const updateScheduleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" }) => {
      const response = await apiRequest("PUT", `/api/vtu/scheduled-purchases/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Schedule status updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/vtu/scheduled-purchases"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update schedule", variant: "destructive" });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/vtu/scheduled-purchases/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Schedule removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/vtu/scheduled-purchases"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete schedule", variant: "destructive" });
    },
  });

  const sendGiftMutation = useMutation({
    mutationFn: async (data: { recipientPhone: string; planId: string; network: NetworkType; message?: string }) => {
      const response = await apiRequest("POST", "/api/vtu/gift-data", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Gift Sent", description: "Your data gift has been sent successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/vtu/gift-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setShowGiftDialog(false);
      resetGiftForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send gift", variant: "destructive" });
    },
  });

  const claimGiftMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", `/api/vtu/gift-data/${code}/claim`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Gift Claimed", description: "Data has been added to your phone!" });
      queryClient.invalidateQueries({ queryKey: ["/api/vtu/gift-data"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to claim gift", variant: "destructive" });
    },
  });

  const resetScheduleForm = () => {
    setSchedulePhoneNumber("");
    setScheduleNetwork("mtn");
    setScheduleServiceType("data");
    setSchedulePlanId(null);
    setScheduleAirtimeAmount("");
    setScheduleFrequency("daily");
    setScheduleDayOfWeek(1);
    setScheduleDayOfMonth(1);
    setScheduleTimeOfDay("09:00");
  };

  const resetGiftForm = () => {
    setGiftRecipientPhone("");
    setGiftMessage("");
    setGiftPlanId(null);
    setGiftNetwork("mtn");
  };

  const walletBalance = parseFloat(wallet?.balance || "0");

  const detectedNetwork = useMemo(() => detectNetwork(phoneNumber), [phoneNumber]);
  const phoneValidation = useMemo(() => validatePhoneNumber(phoneNumber), [phoneNumber]);
  const networkMatch = detectedNetwork?.id === selectedNetwork;

  const schedulePhoneValidation = useMemo(() => validatePhoneNumber(schedulePhoneNumber), [schedulePhoneNumber]);
  const giftPhoneValidation = useMemo(() => validatePhoneNumber(giftRecipientPhone), [giftRecipientPhone]);

  const filteredPlans = useMemo(() => {
    if (!plans.length) return [];
    if (!searchQuery.trim()) return plans;
    
    const query = searchQuery.toLowerCase();
    return plans.filter(plan => 
      plan.dataAmount.toLowerCase().includes(query) ||
      plan.validity.toLowerCase().includes(query) ||
      plan.name.toLowerCase().includes(query) ||
      plan.sellingPrice.toString().includes(query)
    );
  }, [plans, searchQuery]);

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId);
  
  const canPurchaseData = 
    selectedPlanId && 
    phoneValidation.valid && 
    selectedPlan && 
    walletBalance >= selectedPlan.sellingPrice;

  const airtimeAmount = selectedAirtimeAmount || (customAirtimeAmount ? parseFloat(customAirtimeAmount) : 0);
  const canPurchaseAirtime = 
    phoneValidation.valid && 
    airtimeAmount >= 50 && 
    airtimeAmount <= 50000 &&
    walletBalance >= airtimeAmount;

  const canCreateSchedule = 
    schedulePhoneValidation.valid &&
    ((scheduleServiceType === "data" && schedulePlanId) || 
     (scheduleServiceType === "airtime" && parseFloat(scheduleAirtimeAmount) >= 50));

  const selectedGiftPlan = giftPlans?.find(p => p.id === giftPlanId);
  const canSendGift = 
    giftPhoneValidation.valid &&
    giftPlanId &&
    selectedGiftPlan &&
    walletBalance >= selectedGiftPlan.sellingPrice;

  const handleDataPurchase = () => {
    if (!selectedPlanId || !phoneValidation.valid) return;

    if (detectedNetwork && !networkMatch) {
      toast({
        title: "Network Mismatch",
        description: `The phone number appears to be ${detectedNetwork.displayName}, but you selected ${NETWORKS.find(n => n.id === selectedNetwork)?.displayName}. Are you sure you want to continue?`,
        variant: "destructive",
      });
      return;
    }

    purchaseDataMutation.mutate({ planId: selectedPlanId, phoneNumber });
  };

  const handleAirtimePurchase = () => {
    if (!phoneValidation.valid || airtimeAmount < 50) return;

    const network = detectedNetwork?.id || selectedNetwork;

    purchaseAirtimeMutation.mutate({ 
      phoneNumber, 
      amount: airtimeAmount, 
      network 
    });
  };

  const handleSelectBeneficiary = (beneficiary: VtuBeneficiary) => {
    setPhoneNumber(beneficiary.phoneNumber);
    setSelectedNetwork(beneficiary.network as NetworkType);
    setSelectedBeneficiary(beneficiary);
    toast({ title: "Contact Selected", description: `Using ${beneficiary.name}'s number` });
  };

  const handleSaveBeneficiary = () => {
    if (!phoneValidation.valid || !newBeneficiaryName.trim()) return;
    const network = detectedNetwork?.id || selectedNetwork;
    createBeneficiaryMutation.mutate({
      name: newBeneficiaryName.trim(),
      phoneNumber,
      network,
    });
  };

  const handleCreateSchedule = () => {
    if (!canCreateSchedule) return;

    createScheduleMutation.mutate({
      serviceType: scheduleServiceType,
      planId: scheduleServiceType === "data" ? schedulePlanId ?? undefined : undefined,
      network: scheduleNetwork,
      phoneNumber: schedulePhoneNumber,
      amount: scheduleServiceType === "airtime" ? parseFloat(scheduleAirtimeAmount) : undefined,
      frequency: scheduleFrequency,
      dayOfWeek: scheduleFrequency === "weekly" ? scheduleDayOfWeek : undefined,
      dayOfMonth: scheduleFrequency === "monthly" ? scheduleDayOfMonth : undefined,
      timeOfDay: scheduleTimeOfDay,
    });
  };

  const handleSendGift = () => {
    if (!canSendGift || !giftPlanId) return;

    sendGiftMutation.mutate({
      recipientPhone: giftRecipientPhone,
      planId: giftPlanId,
      network: giftNetwork,
      message: giftMessage || undefined,
    });
  };

  const handleCopyGiftCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied", description: "Gift code copied to clipboard" });
  };

  const getNetworkBadge = (networkId: NetworkType | string) => {
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

  const getScheduleStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-500">
            <Play className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="secondary">
            <Pause className="h-3 w-3 mr-1" />
            Paused
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getGiftStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "accepted":
      case "claimed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Claimed
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline">
            Cancelled
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

  const getFrequencyLabel = (schedule: ScheduledVtuPurchase) => {
    switch (schedule.frequency) {
      case "daily":
        return `Daily at ${schedule.timeOfDay}`;
      case "weekly":
        return `${DAYS_OF_WEEK.find(d => d.value === schedule.dayOfWeek)?.label || ""} at ${schedule.timeOfDay}`;
      case "monthly":
        return `${schedule.dayOfMonth}${getDaySuffix(schedule.dayOfMonth || 1)} of each month at ${schedule.timeOfDay}`;
      default:
        return schedule.frequency;
    }
  };

  const getDaySuffix = (day: number) => {
    if (day >= 11 && day <= 13) return "th";
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">VTU Services</h1>
        <p className="text-muted-foreground">Purchase data bundles and airtime for any network</p>
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

      <Tabs value={serviceType} onValueChange={(v) => setServiceType(v as ServiceType)} className="mb-8">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="data" data-testid="tab-service-data" className="flex items-center gap-2">
            <Signal className="h-4 w-4" />
            <span className="hidden sm:inline">Buy</span> Data
          </TabsTrigger>
          <TabsTrigger value="airtime" data-testid="tab-service-airtime" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Buy</span> Airtime
          </TabsTrigger>
          <TabsTrigger value="schedule" data-testid="tab-service-schedule" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="gift" data-testid="tab-service-gift" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Gift
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Signal className="h-5 w-5" />
                Select Network & Plan
              </CardTitle>
              <CardDescription>Choose your preferred network and data plan</CardDescription>
              {discount && (
                <div className="mt-3 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <Zap className="h-4 w-4" />
                    <span className="font-medium">{discount.description}</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Average savings: {discount.averageSavings}
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Tabs value={selectedNetwork} onValueChange={(v) => {
                setSelectedNetwork(v as NetworkType);
                setSelectedPlanId(null);
                setSearchQuery("");
              }}>
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  {NETWORKS.map((network) => (
                    <TabsTrigger 
                      key={network.id} 
                      value={network.id}
                      data-testid={`tab-network-${network.id}`}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm"
                    >
                      <span className={`w-2 h-2 rounded-full ${network.color} mr-1 sm:mr-2`} />
                      <span className="truncate">{network.displayName}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search plans (e.g., 1GB, 30 days, 500)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-plans"
                    />
                  </div>
                  {searchQuery && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Showing {filteredPlans.length} of {plans?.length || 0} plans
                    </p>
                  )}
                </div>

                {NETWORKS.map((network) => (
                  <TabsContent key={network.id} value={network.id}>
                    {plansLoading ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[...Array(6)].map((_, i) => (
                          <Skeleton key={i} className="h-28" />
                        ))}
                      </div>
                    ) : filteredPlans && filteredPlans.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
                        {filteredPlans.map((plan) => (
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
                            <div className="mt-2 space-y-1">
                              <PriceDisplay 
                                marketPrice={plan.marketPrice} 
                                sellingPrice={plan.sellingPrice} 
                                savingsPercentage={plan.savingsPercentage}
                                size="small"
                              />
                              {plan.savingsAmount > 0 && (
                                <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                                  You Save ₦{plan.savingsAmount.toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Signal className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>{searchQuery ? "No plans match your search." : "No plans available for this network."}</p>
                        {searchQuery && (
                          <Button 
                            variant="ghost" 
                            onClick={() => setSearchQuery("")}
                            className="mt-2"
                          >
                            Clear search
                          </Button>
                        )}
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="airtime">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Select Airtime Amount
              </CardTitle>
              <CardDescription>Choose or enter the airtime amount</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as NetworkType)}>
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  {NETWORKS.map((network) => (
                    <TabsTrigger 
                      key={network.id} 
                      value={network.id}
                      data-testid={`tab-airtime-network-${network.id}`}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm"
                    >
                      <span className={`w-2 h-2 rounded-full ${network.color} mr-1 sm:mr-2`} />
                      <span className="truncate">{network.displayName}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="grid grid-cols-4 gap-3 mb-6">
                {AIRTIME_AMOUNTS.map((amount) => (
                  <div
                    key={amount}
                    onClick={() => {
                      setSelectedAirtimeAmount(amount);
                      setCustomAirtimeAmount("");
                    }}
                    className={`p-3 rounded-md border-2 cursor-pointer transition-all text-center ${
                      selectedAirtimeAmount === amount
                        ? "border-primary bg-primary/5"
                        : "border-border hover-elevate"
                    }`}
                    data-testid={`card-airtime-${amount}`}
                  >
                    <div className="font-bold">₦{amount.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-amount">Or enter custom amount</Label>
                <Input
                  id="custom-amount"
                  type="number"
                  placeholder="Enter amount (50 - 50,000)"
                  value={customAirtimeAmount}
                  onChange={(e) => {
                    setCustomAirtimeAmount(e.target.value);
                    setSelectedAirtimeAmount(null);
                  }}
                  min={50}
                  max={50000}
                  data-testid="input-custom-airtime"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum: ₦50 | Maximum: ₦50,000
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card className="mb-8">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Scheduled Purchases
                  </CardTitle>
                  <CardDescription>Automate your data and airtime purchases</CardDescription>
                </div>
                <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-schedule">
                      <Plus className="h-4 w-4 mr-2" />
                      New Schedule
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Scheduled Purchase</DialogTitle>
                      <DialogDescription>Set up automatic data or airtime purchases</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Service Type</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={scheduleServiceType === "data" ? "default" : "outline"}
                            onClick={() => setScheduleServiceType("data")}
                            className="flex-1"
                            data-testid="button-schedule-type-data"
                          >
                            <Signal className="h-4 w-4 mr-2" />
                            Data
                          </Button>
                          <Button
                            type="button"
                            variant={scheduleServiceType === "airtime" ? "default" : "outline"}
                            onClick={() => setScheduleServiceType("airtime")}
                            className="flex-1"
                            data-testid="button-schedule-type-airtime"
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Airtime
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Network</Label>
                        <Select value={scheduleNetwork} onValueChange={(v) => {
                          setScheduleNetwork(v as NetworkType);
                          setSchedulePlanId(null);
                        }}>
                          <SelectTrigger data-testid="select-schedule-network">
                            <SelectValue placeholder="Select network" />
                          </SelectTrigger>
                          <SelectContent>
                            {NETWORKS.map(n => (
                              <SelectItem key={n.id} value={n.id}>
                                <span className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${n.color}`} />
                                  {n.displayName}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                          placeholder="08012345678"
                          value={schedulePhoneNumber}
                          onChange={(e) => setSchedulePhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 13))}
                          data-testid="input-schedule-phone"
                        />
                        {schedulePhoneValidation.message && (
                          <p className="text-sm text-red-500">{schedulePhoneValidation.message}</p>
                        )}
                        {beneficiaries && beneficiaries.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {beneficiaries.slice(0, 3).map((b) => (
                              <Button
                                key={b.id}
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSchedulePhoneNumber(b.phoneNumber);
                                  setScheduleNetwork(b.network as NetworkType);
                                }}
                                className="text-xs"
                                data-testid={`button-schedule-beneficiary-${b.id}`}
                              >
                                {b.name}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>

                      {scheduleServiceType === "data" ? (
                        <div className="space-y-2">
                          <Label>Data Plan</Label>
                          <Select value={schedulePlanId || ""} onValueChange={setSchedulePlanId}>
                            <SelectTrigger data-testid="select-schedule-plan">
                              <SelectValue placeholder="Select plan" />
                            </SelectTrigger>
                            <SelectContent>
                              {schedulePlans?.map(plan => (
                                <SelectItem key={plan.id} value={plan.id}>
                                  {plan.dataAmount} - {plan.validity} (₦{plan.discountedPrice.toLocaleString()})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Airtime Amount</Label>
                          <Input
                            type="number"
                            placeholder="Enter amount (50 - 50,000)"
                            value={scheduleAirtimeAmount}
                            onChange={(e) => setScheduleAirtimeAmount(e.target.value)}
                            min={50}
                            max={50000}
                            data-testid="input-schedule-airtime-amount"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Select value={scheduleFrequency} onValueChange={(v) => setScheduleFrequency(v as ScheduleFrequency)}>
                          <SelectTrigger data-testid="select-schedule-frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {scheduleFrequency === "weekly" && (
                        <div className="space-y-2">
                          <Label>Day of Week</Label>
                          <Select value={scheduleDayOfWeek.toString()} onValueChange={(v) => setScheduleDayOfWeek(parseInt(v))}>
                            <SelectTrigger data-testid="select-schedule-day-of-week">
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map(d => (
                                <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {scheduleFrequency === "monthly" && (
                        <div className="space-y-2">
                          <Label>Day of Month</Label>
                          <Select value={scheduleDayOfMonth.toString()} onValueChange={(v) => setScheduleDayOfMonth(parseInt(v))}>
                            <SelectTrigger data-testid="select-schedule-day-of-month">
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                                <SelectItem key={d} value={d.toString()}>{d}{getDaySuffix(d)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Time of Day</Label>
                        <Input
                          type="time"
                          value={scheduleTimeOfDay}
                          onChange={(e) => setScheduleTimeOfDay(e.target.value)}
                          data-testid="input-schedule-time"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={handleCreateSchedule}
                        disabled={!canCreateSchedule || createScheduleMutation.isPending}
                        data-testid="button-confirm-schedule"
                      >
                        {createScheduleMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Calendar className="h-4 w-4 mr-2" />
                        )}
                        Create Schedule
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {schedulesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : scheduledPurchases && scheduledPurchases.length > 0 ? (
                <div className="space-y-4">
                  {scheduledPurchases.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-4 rounded-md bg-muted/30 space-y-3"
                      data-testid={`schedule-${schedule.id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${NETWORKS.find(n => n.id === schedule.network)?.bgColor || "bg-muted"}`}>
                            {schedule.serviceType === "data" ? (
                              <Signal className={`h-4 w-4 ${NETWORKS.find(n => n.id === schedule.network)?.textColor || "text-muted-foreground"}`} />
                            ) : (
                              <Phone className={`h-4 w-4 ${NETWORKS.find(n => n.id === schedule.network)?.textColor || "text-muted-foreground"}`} />
                            )}
                          </div>
                          <div>
                            <div className="font-medium flex flex-wrap items-center gap-2">
                              {schedule.phoneNumber}
                              {getNetworkBadge(schedule.network as NetworkType)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {getFrequencyLabel(schedule)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getScheduleStatusBadge(schedule.status)}
                          <div className="font-bold">
                            ₦{parseFloat(schedule.amount || "0").toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {schedule.status === "active" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateScheduleStatusMutation.mutate({ id: schedule.id, status: "paused" })}
                            disabled={updateScheduleStatusMutation.isPending}
                            data-testid={`button-pause-schedule-${schedule.id}`}
                          >
                            <Pause className="h-3 w-3 mr-1" />
                            Pause
                          </Button>
                        ) : schedule.status === "paused" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateScheduleStatusMutation.mutate({ id: schedule.id, status: "active" })}
                            disabled={updateScheduleStatusMutation.isPending}
                            data-testid={`button-resume-schedule-${schedule.id}`}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Resume
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                          disabled={deleteScheduleMutation.isPending}
                          className="text-destructive"
                          data-testid={`button-delete-schedule-${schedule.id}`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No scheduled purchases yet.</p>
                  <p className="text-sm">Create a schedule to automate your purchases.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gift">
          <Card className="mb-8">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Gift Data
                  </CardTitle>
                  <CardDescription>Send data as a gift to friends and family</CardDescription>
                </div>
                <Dialog open={showGiftDialog} onOpenChange={setShowGiftDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-send-gift">
                      <Send className="h-4 w-4 mr-2" />
                      Send Gift
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Send Data Gift</DialogTitle>
                      <DialogDescription>Gift data to someone special</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Network</Label>
                        <Select value={giftNetwork} onValueChange={(v) => {
                          setGiftNetwork(v as NetworkType);
                          setGiftPlanId(null);
                        }}>
                          <SelectTrigger data-testid="select-gift-network">
                            <SelectValue placeholder="Select network" />
                          </SelectTrigger>
                          <SelectContent>
                            {NETWORKS.map(n => (
                              <SelectItem key={n.id} value={n.id}>
                                <span className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${n.color}`} />
                                  {n.displayName}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Recipient Phone Number</Label>
                        <Input
                          placeholder="08012345678"
                          value={giftRecipientPhone}
                          onChange={(e) => setGiftRecipientPhone(e.target.value.replace(/\D/g, "").slice(0, 13))}
                          data-testid="input-gift-phone"
                        />
                        {giftPhoneValidation.message && (
                          <p className="text-sm text-red-500">{giftPhoneValidation.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Data Plan</Label>
                        <Select value={giftPlanId || ""} onValueChange={setGiftPlanId}>
                          <SelectTrigger data-testid="select-gift-plan">
                            <SelectValue placeholder="Select plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {giftPlans?.map(plan => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.dataAmount} - {plan.validity} (₦{plan.discountedPrice.toLocaleString()})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Gift Message (Optional)</Label>
                        <Textarea
                          placeholder="Add a personal message to your gift..."
                          value={giftMessage}
                          onChange={(e) => setGiftMessage(e.target.value)}
                          rows={3}
                          data-testid="input-gift-message"
                        />
                      </div>

                      {selectedGiftPlan && (
                        <div className="p-4 rounded-md bg-muted/50 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Plan:</span>
                            <span className="font-medium">{selectedGiftPlan.dataAmount} - {selectedGiftPlan.validity}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Cost:</span>
                            <span className="font-bold text-primary">₦{selectedGiftPlan.discountedPrice.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={handleSendGift}
                        disabled={!canSendGift || sendGiftMutation.isPending}
                        data-testid="button-confirm-gift"
                      >
                        {sendGiftMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Gift className="h-4 w-4 mr-2" />
                        )}
                        Send Gift
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={giftTab} onValueChange={(v) => setGiftTab(v as "send" | "sent" | "received")}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="sent" data-testid="tab-gift-sent">
                    Sent Gifts
                  </TabsTrigger>
                  <TabsTrigger value="received" data-testid="tab-gift-received">
                    Received Gifts
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sent">
                  {sentGiftsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                  ) : sentGifts && sentGifts.length > 0 ? (
                    <div className="space-y-4">
                      {sentGifts.map((gift) => (
                        <div
                          key={gift.id}
                          className="p-4 rounded-md bg-muted/30 space-y-2"
                          data-testid={`gift-sent-${gift.id}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${NETWORKS.find(n => n.id === gift.network)?.bgColor || "bg-muted"}`}>
                                <Gift className={`h-4 w-4 ${NETWORKS.find(n => n.id === gift.network)?.textColor || "text-muted-foreground"}`} />
                              </div>
                              <div>
                                <div className="font-medium flex flex-wrap items-center gap-2">
                                  To: {gift.recipientPhone}
                                  {getNetworkBadge(gift.network as NetworkType)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {gift.createdAt && format(new Date(gift.createdAt), "MMM d, yyyy")}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getGiftStatusBadge(gift.status)}
                              <div className="font-bold">₦{parseFloat(gift.amount || "0").toLocaleString()}</div>
                            </div>
                          </div>
                          {gift.giftCode && gift.status === "pending" && (
                            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                              <code className="text-sm font-mono">{gift.giftCode}</code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyGiftCode(gift.giftCode!)}
                                data-testid={`button-copy-gift-code-${gift.id}`}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {gift.message && (
                            <p className="text-sm text-muted-foreground italic">"{gift.message}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Gift className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No gifts sent yet.</p>
                      <p className="text-sm">Send your first data gift!</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="received">
                  {receivedGiftsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                  ) : receivedGifts && receivedGifts.length > 0 ? (
                    <div className="space-y-4">
                      {receivedGifts.map((gift) => (
                        <div
                          key={gift.id}
                          className="p-4 rounded-md bg-muted/30 space-y-2"
                          data-testid={`gift-received-${gift.id}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${NETWORKS.find(n => n.id === gift.network)?.bgColor || "bg-muted"}`}>
                                <Gift className={`h-4 w-4 ${NETWORKS.find(n => n.id === gift.network)?.textColor || "text-muted-foreground"}`} />
                              </div>
                              <div>
                                <div className="font-medium flex flex-wrap items-center gap-2">
                                  From: {gift.senderPhone || "Anonymous"}
                                  {getNetworkBadge(gift.network as NetworkType)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {gift.createdAt && format(new Date(gift.createdAt), "MMM d, yyyy")}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getGiftStatusBadge(gift.status)}
                              <div className="font-bold">₦{parseFloat(gift.amount || "0").toLocaleString()}</div>
                            </div>
                          </div>
                          {gift.message && (
                            <p className="text-sm text-muted-foreground italic">"{gift.message}"</p>
                          )}
                          {gift.status === "pending" && gift.giftCode && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => claimGiftMutation.mutate(gift.giftCode!)}
                              disabled={claimGiftMutation.isPending}
                              data-testid={`button-claim-gift-${gift.id}`}
                            >
                              {claimGiftMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              )}
                              Claim Gift
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Gift className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No gifts received yet.</p>
                      <p className="text-sm">When someone sends you data, it will appear here.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {beneficiaries && beneficiaries.length > 0 && (serviceType === "data" || serviceType === "airtime") && (
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4" />
              Quick Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {beneficiaries.slice(0, 5).map((b) => (
                <Button
                  key={b.id}
                  variant={selectedBeneficiary?.id === b.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSelectBeneficiary(b)}
                  className="flex items-center gap-2"
                  data-testid={`button-beneficiary-${b.id}`}
                >
                  <span className="truncate max-w-[80px]">{b.name}</span>
                  <Badge className={`${NETWORKS.find(n => n.id === b.network)?.bgColor} ${NETWORKS.find(n => n.id === b.network)?.textColor} border-0 text-xs`}>
                    {NETWORKS.find(n => n.id === b.network)?.displayName}
                  </Badge>
                </Button>
              ))}
              {beneficiaries.length > 5 && (
                <Button variant="ghost" size="sm" data-testid="button-more-beneficiaries">
                  +{beneficiaries.length - 5} more
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(serviceType === "data" || serviceType === "airtime") && (
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
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1" data-testid="text-network-match">
                    <CheckCircle className="h-4 w-4" />
                    Network verified
                  </p>
                  {!beneficiaries?.some(b => b.phoneNumber === phoneNumber) && (
                    <Dialog open={showBeneficiaryDialog} onOpenChange={setShowBeneficiaryDialog}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs" data-testid="button-save-beneficiary">
                          <Star className="h-3 w-3 mr-1" />
                          Save Contact
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Save Contact</DialogTitle>
                          <DialogDescription>Save this number for quick access next time</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="beneficiary-name">Name</Label>
                            <Input
                              id="beneficiary-name"
                              placeholder="e.g., Self, Mom, Friend"
                              value={newBeneficiaryName}
                              onChange={(e) => setNewBeneficiaryName(e.target.value)}
                              data-testid="input-beneficiary-name"
                            />
                          </div>
                          <div className="p-3 rounded-md bg-muted/50 flex items-center justify-between">
                            <span>{phoneNumber}</span>
                            {getNetworkBadge(detectedNetwork?.id || selectedNetwork)}
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            onClick={handleSaveBeneficiary}
                            disabled={!newBeneficiaryName.trim() || createBeneficiaryMutation.isPending}
                            data-testid="button-confirm-save-beneficiary"
                          >
                            {createBeneficiaryMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Star className="h-4 w-4 mr-2" />
                            )}
                            Save Contact
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              )}
            </div>

            {serviceType === "data" && selectedPlan && (
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
                  <div className="text-right">
                    {selectedPlan.price !== selectedPlan.discountedPrice && (
                      <span className="text-sm text-muted-foreground line-through mr-2">
                        ₦{selectedPlan.price.toLocaleString()}
                      </span>
                    )}
                    <span className="font-bold text-primary">₦{selectedPlan.discountedPrice.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {serviceType === "airtime" && airtimeAmount > 0 && (
              <div className="p-4 rounded-md bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service:</span>
                  <span className="font-medium">Airtime Top-up</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network:</span>
                  {getNetworkBadge(detectedNetwork?.id || selectedNetwork)}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold text-primary">₦{airtimeAmount.toLocaleString()}</span>
                </div>
              </div>
            )}

            {serviceType === "data" && selectedPlan && walletBalance < selectedPlan.discountedPrice && (
              <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Insufficient Balance</p>
                  <p className="text-sm">You need ₦{(selectedPlan.discountedPrice - walletBalance).toLocaleString()} more to purchase this plan.</p>
                </div>
              </div>
            )}

            {serviceType === "airtime" && airtimeAmount > 0 && walletBalance < airtimeAmount && (
              <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Insufficient Balance</p>
                  <p className="text-sm">You need ₦{(airtimeAmount - walletBalance).toLocaleString()} more to purchase this airtime.</p>
                </div>
              </div>
            )}

            {serviceType === "data" ? (
              <Button
                onClick={handleDataPurchase}
                disabled={!canPurchaseData || purchaseDataMutation.isPending}
                className="w-full"
                data-testid="button-purchase-data"
              >
                {purchaseDataMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Purchase Data
                    {selectedPlan && ` - ₦${selectedPlan.discountedPrice.toLocaleString()}`}
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleAirtimePurchase}
                disabled={!canPurchaseAirtime || purchaseAirtimeMutation.isPending}
                className="w-full"
                data-testid="button-purchase-airtime"
              >
                {purchaseAirtimeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Purchase Airtime
                    {airtimeAmount > 0 && ` - ₦${airtimeAmount.toLocaleString()}`}
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {(serviceType === "data" || serviceType === "airtime") && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Transaction History
                </CardTitle>
                <CardDescription>Your recent VTU purchases</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={txStatusFilter} onValueChange={setTxStatusFilter}>
                  <SelectTrigger className="w-[120px]" data-testid="select-status-filter">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={txNetworkFilter} onValueChange={setTxNetworkFilter}>
                  <SelectTrigger className="w-[120px]" data-testid="select-network-filter">
                    <Signal className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Networks</SelectItem>
                    {NETWORKS.map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                          {!tx.planId && (
                            <Badge variant="outline" className="text-xs">Airtime</Badge>
                          )}
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
                <p>No transactions {txStatusFilter !== "all" || txNetworkFilter !== "all" ? "matching filters" : "yet"}.</p>
                <p className="text-sm">
                  {txStatusFilter !== "all" || txNetworkFilter !== "all" 
                    ? "Try adjusting your filters" 
                    : "Your VTU purchase history will appear here."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

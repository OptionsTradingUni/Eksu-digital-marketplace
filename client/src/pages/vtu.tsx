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
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Wallet, Smartphone, Signal, CheckCircle, XCircle, Clock, Loader2, Plus, AlertCircle, 
  Search, Phone, Zap, Star, Trash2, Filter, Gift, Calendar, 
  Play, Pause, Send, Copy, TrendingDown, SlidersHorizontal, X, Users, 
  Download, FileSpreadsheet, FileText
} from "lucide-react";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
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
type ServiceType = "data" | "airtime" | "cable" | "electricity" | "exam" | "schedule" | "gift" | "bulk";
type ScheduleFrequency = "daily" | "weekly" | "monthly";

interface BulkPurchaseItem {
  phoneNumber: string;
  planId?: string;
  amount?: number;
  network?: NetworkType;
}

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
  size = "default",
  showSavingsAmount = false
}: { 
  marketPrice: number; 
  sellingPrice: number; 
  savingsPercentage: number;
  size?: "default" | "large" | "small";
  showSavingsAmount?: boolean;
}) {
  const textSize = size === "large" ? "text-xl" : size === "small" ? "text-sm" : "text-base";
  const badgeSize = size === "large" ? "text-sm" : "text-xs";
  const savingsAmount = marketPrice - sellingPrice;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`font-bold ${textSize} text-foreground`}>
          ₦{sellingPrice.toLocaleString()}
        </span>
        {savingsPercentage > 0 && (
          <span className={`${size === "small" ? "text-xs" : "text-sm"} text-red-500 dark:text-red-400 line-through`}>
            ₦{marketPrice.toLocaleString()}
          </span>
        )}
      </div>
      {savingsPercentage > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={`${badgeSize} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300`}>
            {savingsPercentage}% OFF
          </Badge>
          {showSavingsAmount && savingsAmount > 0 && (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
              Save ₦{savingsAmount.toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SavingsCalculator({ 
  marketPrice, 
  sellingPrice 
}: { 
  marketPrice: number; 
  sellingPrice: number; 
}) {
  const savingsPerUnit = marketPrice - sellingPrice;
  const monthlySavings = savingsPerUnit * 10; // Assuming 10 purchases per month
  const yearlySavings = monthlySavings * 12;
  const savingsPercentage = Math.round((savingsPerUnit / marketPrice) * 100);
  
  return (
    <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border border-green-200 dark:border-green-800">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
          <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
        <h4 className="font-semibold text-green-800 dark:text-green-300">See Your Savings</h4>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Network Direct Price:</span>
          <span className="font-medium line-through text-red-500">₦{marketPrice.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Our Price:</span>
          <span className="font-bold text-green-600 dark:text-green-400">₦{sellingPrice.toLocaleString()}</span>
        </div>
        <div className="border-t border-green-200 dark:border-green-700 my-2" />
        <div className="flex justify-between">
          <span className="text-muted-foreground">You Save:</span>
          <span className="font-bold text-green-600 dark:text-green-400">₦{savingsPerUnit.toLocaleString()} ({savingsPercentage}%)</span>
        </div>
        
        <div className="mt-4 pt-3 border-t border-green-200 dark:border-green-700">
          <p className="text-xs text-muted-foreground mb-2">If you buy 10 times monthly:</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white dark:bg-background/50 rounded p-2 text-center">
              <div className="text-xs text-muted-foreground">Monthly</div>
              <div className="font-bold text-green-600 dark:text-green-400">₦{monthlySavings.toLocaleString()}</div>
            </div>
            <div className="bg-white dark:bg-background/50 rounded p-2 text-center">
              <div className="text-xs text-muted-foreground">Yearly</div>
              <div className="font-bold text-green-600 dark:text-green-400">₦{yearlySavings.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Advanced filter types
type ValidityFilter = "all" | "daily" | "weekly" | "monthly";
type PlanTypeFilter = "all" | "sme" | "direct" | "cg" | "social" | "awoof";
type DataSizeFilter = "all" | "small" | "medium" | "large" | "xlarge";

const VALIDITY_OPTIONS: { value: ValidityFilter; label: string }[] = [
  { value: "all", label: "All Validity" },
  { value: "daily", label: "1-3 Days" },
  { value: "weekly", label: "7 Days" },
  { value: "monthly", label: "30 Days" },
];

const PLAN_TYPE_OPTIONS: { value: PlanTypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "sme", label: "SME" },
  { value: "direct", label: "Direct" },
  { value: "cg", label: "Corporate Gifting" },
];

const DATA_SIZE_OPTIONS: { value: DataSizeFilter; label: string }[] = [
  { value: "all", label: "All Sizes" },
  { value: "small", label: "< 1GB" },
  { value: "medium", label: "1GB - 3GB" },
  { value: "large", label: "3GB - 10GB" },
  { value: "xlarge", label: "> 10GB" },
];

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
  
  const [showFilters, setShowFilters] = useState(false);
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>("all");
  const [planTypeFilter, setPlanTypeFilter] = useState<PlanTypeFilter>("all");
  const [dataSizeFilter, setDataSizeFilter] = useState<DataSizeFilter>("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "data_asc" | "data_desc">("price_asc");

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

  const [bulkServiceType, setBulkServiceType] = useState<"data" | "airtime">("data");
  const [bulkNetwork, setBulkNetwork] = useState<NetworkType>("mtn");
  const [bulkPlanId, setBulkPlanId] = useState<string | null>(null);
  const [bulkPhoneNumbers, setBulkPhoneNumbers] = useState("");
  const [bulkAirtimeAmount, setBulkAirtimeAmount] = useState("");
  const [bulkResults, setBulkResults] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);

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

  const bulkPlansData = useQuery<PlansApiResponse>({
    queryKey: ["/api/vtu/plans", { network: bulkNetwork }],
    enabled: serviceType === "bulk",
  });

  const bulkPlans = bulkPlansData.data?.plans || [];
  const selectedBulkPlan = bulkPlans.find(p => p.id === bulkPlanId);

  const bulkPurchaseMutation = useMutation({
    mutationFn: async (data: { purchases: BulkPurchaseItem[]; serviceType: "data" | "airtime" }) => {
      const response = await apiRequest("POST", "/api/vtu/bulk-purchase", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Bulk Purchase Complete", 
        description: `${data.summary?.successful || 0} successful, ${data.summary?.failed || 0} failed`
      });
      setBulkResults(data.results || []);
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vtu/transactions"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Bulk purchase failed", variant: "destructive" });
    },
  });

  const parseBulkPhoneNumbers = (text: string): string[] => {
    return text
      .split(/[\n,;]+/)
      .map(line => line.replace(/\D/g, "").trim())
      .filter(num => num.length >= 10);
  };

  const handleBulkPurchase = () => {
    const phoneNumbers = parseBulkPhoneNumbers(bulkPhoneNumbers);
    if (phoneNumbers.length === 0) {
      toast({ title: "Error", description: "Please enter at least one valid phone number", variant: "destructive" });
      return;
    }

    if (bulkServiceType === "data" && !bulkPlanId) {
      toast({ title: "Error", description: "Please select a data plan", variant: "destructive" });
      return;
    }

    if (bulkServiceType === "airtime" && (!bulkAirtimeAmount || parseFloat(bulkAirtimeAmount) < 50)) {
      toast({ title: "Error", description: "Please enter a valid airtime amount (min 50)", variant: "destructive" });
      return;
    }

    const purchases: BulkPurchaseItem[] = phoneNumbers.map(phoneNumber => ({
      phoneNumber,
      planId: bulkServiceType === "data" ? bulkPlanId! : undefined,
      amount: bulkServiceType === "airtime" ? parseFloat(bulkAirtimeAmount) : undefined,
      network: bulkNetwork,
    }));

    bulkPurchaseMutation.mutate({ purchases, serviceType: bulkServiceType });
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const response = await apiRequest("GET", "/api/vtu/transactions/export");
      const data = await response.json();
      
      if (!data.success) throw new Error("Export failed");
      
      const { exportData } = data;
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text("VTU Transaction Report", 14, 22);
      
      doc.setFontSize(10);
      doc.text(`Generated: ${format(new Date(exportData.exportDate), "PPP p")}`, 14, 32);
      doc.text(`User: ${exportData.userName}`, 14, 38);
      
      doc.setFontSize(12);
      doc.text("Summary", 14, 48);
      doc.setFontSize(10);
      doc.text(`Total Transactions: ${exportData.summary.totalTransactions}`, 14, 56);
      doc.text(`Total Amount: ₦${exportData.summary.totalAmount.toLocaleString()}`, 14, 62);
      doc.text(`Successful: ${exportData.summary.successfulCount}`, 14, 68);
      doc.text(`Failed: ${exportData.summary.failedCount}`, 14, 74);
      
      let yPos = 88;
      doc.setFontSize(12);
      doc.text("Transactions", 14, yPos);
      yPos += 8;
      
      doc.setFontSize(8);
      doc.text("Date", 14, yPos);
      doc.text("Phone", 50, yPos);
      doc.text("Network", 90, yPos);
      doc.text("Amount", 120, yPos);
      doc.text("Status", 160, yPos);
      yPos += 6;
      
      exportData.transactions.slice(0, 30).forEach((tx: any) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(format(new Date(tx.date), "MM/dd/yy"), 14, yPos);
        doc.text(tx.phoneNumber || "N/A", 50, yPos);
        doc.text(tx.network?.toUpperCase() || "N/A", 90, yPos);
        doc.text(`₦${parseFloat(tx.amount || 0).toLocaleString()}`, 120, yPos);
        doc.text(tx.status || "N/A", 160, yPos);
        yPos += 6;
      });
      
      doc.save("vtu-transactions.pdf");
      toast({ title: "Downloaded", description: "PDF exported successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to export PDF", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const response = await apiRequest("GET", "/api/vtu/transactions/export");
      const data = await response.json();
      
      if (!data.success) throw new Error("Export failed");
      
      const { exportData } = data;
      
      const wsData = [
        ["VTU Transaction Report"],
        ["Generated:", format(new Date(exportData.exportDate), "PPP p")],
        ["User:", exportData.userName],
        [],
        ["Summary"],
        ["Total Transactions:", exportData.summary.totalTransactions],
        ["Total Amount:", `₦${exportData.summary.totalAmount.toLocaleString()}`],
        ["Successful:", exportData.summary.successfulCount],
        ["Failed:", exportData.summary.failedCount],
        [],
        ["Date", "Phone Number", "Network", "Plan", "Amount", "Status", "Reference"],
        ...exportData.transactions.map((tx: any) => [
          format(new Date(tx.date), "yyyy-MM-dd HH:mm"),
          tx.phoneNumber || "N/A",
          tx.network?.toUpperCase() || "N/A",
          tx.plan || "N/A",
          parseFloat(tx.amount || 0),
          tx.status || "N/A",
          tx.reference || "N/A",
        ])
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");
      XLSX.writeFile(wb, "vtu-transactions.xlsx");
      
      toast({ title: "Downloaded", description: "Excel exported successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to export Excel", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

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

  const parseDataSize = (dataAmount: string): number => {
    const match = dataAmount.toLowerCase().match(/([\d.]+)\s*(gb|mb|kb)/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === "gb") return value * 1024;
    if (unit === "mb") return value;
    if (unit === "kb") return value / 1024;
    return 0;
  };

  const parseValidity = (validity: string): number => {
    const lower = validity.toLowerCase();
    const match = lower.match(/(\d+)\s*(day|week|month)/);
    if (!match) return 0;
    const value = parseInt(match[1]);
    if (lower.includes("month")) return value * 30;
    if (lower.includes("week")) return value * 7;
    return value;
  };

  const filteredPlans = useMemo(() => {
    if (!plans.length) return [];
    
    let result = [...plans];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(plan => 
        plan.dataAmount.toLowerCase().includes(query) ||
        plan.validity.toLowerCase().includes(query) ||
        plan.name.toLowerCase().includes(query) ||
        plan.sellingPrice.toString().includes(query)
      );
    }

    if (validityFilter !== "all") {
      result = result.filter(plan => {
        const days = parseValidity(plan.validity);
        switch (validityFilter) {
          case "daily": return days <= 3;
          case "weekly": return days >= 4 && days <= 14;
          case "monthly": return days >= 28;
          default: return true;
        }
      });
    }

    if (planTypeFilter !== "all") {
      result = result.filter(plan => {
        const planName = plan.name.toLowerCase();
        switch (planTypeFilter) {
          case "sme": return planName.includes("sme");
          case "direct": return planName.includes("direct") || (!planName.includes("sme") && !planName.includes("cg"));
          case "cg": return planName.includes("cg") || planName.includes("corporate") || planName.includes("gifting");
          default: return true;
        }
      });
    }

    if (dataSizeFilter !== "all") {
      result = result.filter(plan => {
        const sizeMb = parseDataSize(plan.dataAmount);
        switch (dataSizeFilter) {
          case "small": return sizeMb < 1024;
          case "medium": return sizeMb >= 1024 && sizeMb < 3072;
          case "large": return sizeMb >= 3072 && sizeMb < 10240;
          case "xlarge": return sizeMb >= 10240;
          default: return true;
        }
      });
    }

    result = result.filter(plan => 
      plan.sellingPrice >= priceRange[0] && plan.sellingPrice <= priceRange[1]
    );

    switch (sortBy) {
      case "price_asc":
        result.sort((a, b) => a.sellingPrice - b.sellingPrice);
        break;
      case "price_desc":
        result.sort((a, b) => b.sellingPrice - a.sellingPrice);
        break;
      case "data_asc":
        result.sort((a, b) => parseDataSize(a.dataAmount) - parseDataSize(b.dataAmount));
        break;
      case "data_desc":
        result.sort((a, b) => parseDataSize(b.dataAmount) - parseDataSize(a.dataAmount));
        break;
    }

    return result;
  }, [plans, searchQuery, validityFilter, planTypeFilter, dataSizeFilter, priceRange, sortBy]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (validityFilter !== "all") count++;
    if (planTypeFilter !== "all") count++;
    if (dataSizeFilter !== "all") count++;
    if (priceRange[0] > 0 || priceRange[1] < 10000) count++;
    if (sortBy !== "price_asc") count++;
    return count;
  }, [validityFilter, planTypeFilter, dataSizeFilter, priceRange, sortBy]);

  const clearAllFilters = () => {
    setValidityFilter("all");
    setPlanTypeFilter("all");
    setDataSizeFilter("all");
    setPriceRange([0, 10000]);
    setSortBy("price_asc");
    setSearchQuery("");
  };

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

      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5">
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

        <Link href="/rewards" className="block">
          <Card className="h-full bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border-amber-200/50 dark:border-amber-800/50 hover-elevate cursor-pointer transition-all" data-testid="card-rewards-link">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-amber-500/20 p-3">
                    <Star className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reward Points</p>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-amber-700 dark:text-amber-400" data-testid="text-rewards-preview">
                        Earn 10 pts/₦1000
                      </h3>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  View
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

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
          <TabsTrigger value="bulk" data-testid="tab-service-bulk" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Bulk
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

                <div className="mb-4 space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search plans (e.g., 1GB, 30 days, 500)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="input-search-plans"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setShowFilters(!showFilters)}
                      className="relative"
                      data-testid="button-toggle-filters"
                    >
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      Filters
                      {activeFiltersCount > 0 && (
                        <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {activeFiltersCount}
                        </Badge>
                      )}
                    </Button>
                  </div>

                  <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                    <CollapsibleContent className="space-y-4 pt-2">
                      <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">Advanced Filters</h4>
                          {activeFiltersCount > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearAllFilters}
                              className="h-7 text-xs"
                              data-testid="button-clear-filters"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Clear All
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Validity</Label>
                            <Select value={validityFilter} onValueChange={(v) => setValidityFilter(v as ValidityFilter)}>
                              <SelectTrigger className="h-9" data-testid="select-validity-filter">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VALIDITY_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Plan Type</Label>
                            <Select value={planTypeFilter} onValueChange={(v) => setPlanTypeFilter(v as PlanTypeFilter)}>
                              <SelectTrigger className="h-9" data-testid="select-plantype-filter">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PLAN_TYPE_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Data Size</Label>
                            <Select value={dataSizeFilter} onValueChange={(v) => setDataSizeFilter(v as DataSizeFilter)}>
                              <SelectTrigger className="h-9" data-testid="select-datasize-filter">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DATA_SIZE_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Sort By</Label>
                            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                              <SelectTrigger className="h-9" data-testid="select-sort-filter">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                                <SelectItem value="data_asc">Data: Small to Large</SelectItem>
                                <SelectItem value="data_desc">Data: Large to Small</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Price Range</Label>
                            <span className="text-xs text-muted-foreground">
                              ₦{priceRange[0].toLocaleString()} - ₦{priceRange[1].toLocaleString()}
                            </span>
                          </div>
                          <Slider
                            value={priceRange}
                            onValueChange={(v) => setPriceRange(v as [number, number])}
                            min={0}
                            max={10000}
                            step={100}
                            className="mt-2"
                            data-testid="slider-price-range"
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {(searchQuery || activeFiltersCount > 0) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Showing {filteredPlans.length} of {plans?.length || 0} plans</span>
                      {filteredPlans.length === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllFilters}
                          className="h-auto p-0 text-primary"
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
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
                                  {plan.dataAmount} - {plan.validity} (₦{plan.sellingPrice.toLocaleString()})
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
                                {plan.dataAmount} - {plan.validity} (₦{plan.sellingPrice.toLocaleString()})
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
                            <span className="font-bold text-primary">₦{selectedGiftPlan.sellingPrice.toLocaleString()}</span>
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

        <TabsContent value="bulk">
          <Card className="mb-8">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Bulk Purchase
                  </CardTitle>
                  <CardDescription>Send data or airtime to multiple numbers at once</CardDescription>
                </div>
                <Badge variant="secondary">Max 50 numbers per batch</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={bulkServiceType === "data" ? "default" : "outline"}
                      onClick={() => setBulkServiceType("data")}
                      className="flex-1"
                      data-testid="button-bulk-type-data"
                    >
                      <Signal className="h-4 w-4 mr-2" />
                      Data
                    </Button>
                    <Button
                      variant={bulkServiceType === "airtime" ? "default" : "outline"}
                      onClick={() => setBulkServiceType("airtime")}
                      className="flex-1"
                      data-testid="button-bulk-type-airtime"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Airtime
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Network</Label>
                  <div className="flex gap-1 flex-wrap">
                    {NETWORKS.map((network) => (
                      <Button
                        key={network.id}
                        variant={bulkNetwork === network.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setBulkNetwork(network.id);
                          setBulkPlanId(null);
                        }}
                        className={bulkNetwork === network.id ? network.bgColor : ""}
                        data-testid={`button-bulk-network-${network.id}`}
                      >
                        {network.displayName}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {bulkServiceType === "data" ? (
                <div className="space-y-2">
                  <Label>Select Data Plan</Label>
                  <Select value={bulkPlanId || ""} onValueChange={setBulkPlanId}>
                    <SelectTrigger data-testid="select-bulk-plan">
                      <SelectValue placeholder="Choose a data plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkPlans.slice(0, 20).map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          <div className="flex justify-between items-center w-full gap-4">
                            <span>{plan.dataAmount} - {plan.validity}</span>
                            <span className="font-bold">₦{plan.sellingPrice.toLocaleString()}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedBulkPlan && (
                    <div className="p-3 rounded-md bg-muted/50 text-sm">
                      <div className="flex justify-between">
                        <span>Selected:</span>
                        <span className="font-medium">{selectedBulkPlan.dataAmount} - {selectedBulkPlan.validity}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Price per number:</span>
                        <span>₦{selectedBulkPlan.sellingPrice.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Airtime Amount (per number)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                    <Input
                      type="number"
                      placeholder="100"
                      value={bulkAirtimeAmount}
                      onChange={(e) => setBulkAirtimeAmount(e.target.value)}
                      className="pl-8"
                      min={50}
                      max={50000}
                      data-testid="input-bulk-airtime-amount"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Phone Numbers</Label>
                <Textarea
                  placeholder="Enter phone numbers (one per line, or comma/semicolon separated)&#10;Example:&#10;08012345678&#10;09087654321&#10;07098765432"
                  value={bulkPhoneNumbers}
                  onChange={(e) => setBulkPhoneNumbers(e.target.value)}
                  rows={6}
                  data-testid="textarea-bulk-phone-numbers"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{parseBulkPhoneNumbers(bulkPhoneNumbers).length} valid numbers detected</span>
                  <span>Supports CSV format: paste from Excel/Google Sheets</span>
                </div>
              </div>

              {parseBulkPhoneNumbers(bulkPhoneNumbers).length > 0 && (bulkServiceType === "data" ? selectedBulkPlan : parseFloat(bulkAirtimeAmount) >= 50) && (
                <div className="p-4 rounded-md bg-muted/30 space-y-2">
                  <div className="flex justify-between">
                    <span>Numbers to process:</span>
                    <span className="font-medium">{parseBulkPhoneNumbers(bulkPhoneNumbers).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount per number:</span>
                    <span className="font-medium">
                      ₦{bulkServiceType === "data" 
                        ? selectedBulkPlan?.sellingPrice.toLocaleString()
                        : parseFloat(bulkAirtimeAmount).toLocaleString()
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total Amount:</span>
                    <span>
                      ₦{(
                        parseBulkPhoneNumbers(bulkPhoneNumbers).length * 
                        (bulkServiceType === "data" 
                          ? (selectedBulkPlan?.sellingPrice || 0)
                          : parseFloat(bulkAirtimeAmount) || 0
                        )
                      ).toLocaleString()}
                    </span>
                  </div>
                  {walletBalance < (parseBulkPhoneNumbers(bulkPhoneNumbers).length * (bulkServiceType === "data" ? (selectedBulkPlan?.sellingPrice || 0) : parseFloat(bulkAirtimeAmount) || 0)) && (
                    <div className="text-destructive text-sm flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Insufficient wallet balance
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleBulkPurchase}
                disabled={
                  bulkPurchaseMutation.isPending ||
                  parseBulkPhoneNumbers(bulkPhoneNumbers).length === 0 ||
                  (bulkServiceType === "data" && !bulkPlanId) ||
                  (bulkServiceType === "airtime" && parseFloat(bulkAirtimeAmount) < 50)
                }
                className="w-full"
                size="lg"
                data-testid="button-bulk-purchase"
              >
                {bulkPurchaseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Process Bulk Purchase
              </Button>

              {bulkResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Results</h4>
                    <Button variant="ghost" size="sm" onClick={() => setBulkResults([])}>
                      Clear
                    </Button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {bulkResults.map((result, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-md flex items-center justify-between ${
                          result.status === "success" 
                            ? "bg-green-500/10 border border-green-500/20" 
                            : "bg-red-500/10 border border-red-500/20"
                        }`}
                        data-testid={`bulk-result-${index}`}
                      >
                        <div className="flex items-center gap-2">
                          {result.status === "success" ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-mono text-sm">{result.phoneNumber}</span>
                        </div>
                        <div className="text-sm text-right">
                          {result.status === "success" ? (
                            <span className="text-green-600">{result.message}</span>
                          ) : (
                            <span className="text-red-600">{result.message}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              <div className="space-y-4">
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
                      {selectedPlan.marketPrice !== selectedPlan.sellingPrice && (
                        <span className="text-sm text-red-500 dark:text-red-400 line-through mr-2">
                          ₦{selectedPlan.marketPrice.toLocaleString()}
                        </span>
                      )}
                      <span className="font-bold text-primary">₦{selectedPlan.sellingPrice.toLocaleString()}</span>
                    </div>
                  </div>
                  {selectedPlan.savingsPercentage > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-muted-foreground">Your Savings:</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        ₦{selectedPlan.savingsAmount.toLocaleString()} ({selectedPlan.savingsPercentage}% OFF)
                      </Badge>
                    </div>
                  )}
                </div>

                {selectedPlan.savingsPercentage > 0 && (
                  <SavingsCalculator 
                    marketPrice={selectedPlan.marketPrice} 
                    sellingPrice={selectedPlan.sellingPrice} 
                  />
                )}
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

            {serviceType === "data" && selectedPlan && walletBalance < selectedPlan.sellingPrice && (
              <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Insufficient Balance</p>
                  <p className="text-sm">You need ₦{(selectedPlan.sellingPrice - walletBalance).toLocaleString()} more to purchase this plan.</p>
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
                    {selectedPlan && ` - ₦${selectedPlan.sellingPrice.toLocaleString()}`}
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
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToPDF}
                    disabled={isExporting || !transactions || transactions.length === 0}
                    data-testid="button-export-pdf"
                  >
                    {isExporting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline ml-1">PDF</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToExcel}
                    disabled={isExporting || !transactions || transactions.length === 0}
                    data-testid="button-export-excel"
                  >
                    {isExporting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline ml-1">Excel</span>
                  </Button>
                </div>
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

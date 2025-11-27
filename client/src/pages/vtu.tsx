import { useState, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Wallet, Smartphone, Signal, CheckCircle, XCircle, Clock, Loader2, Plus, AlertCircle, 
  Search, Phone, Zap, Users, Star, Trash2, Filter, Gift, Sparkles, Calendar, 
  Play, Pause, Send, Copy, Download, Tv, Lightbulb, Receipt
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { 
  Wallet as WalletType, 
  VtuPlan, 
  VtuTransaction, 
  VtuBeneficiary,
  ScheduledVtuPurchase,
  GiftData,
  BillPayment
} from "@shared/schema";

type NetworkType = "mtn_sme" | "glo_cg" | "airtel_cg" | "9mobile";
type ServiceType = "data" | "airtime" | "schedule" | "gift" | "bills";
type BillType = "cable" | "electricity";
type BillServiceType = "dstv" | "gotv" | "startimes" | "showmax" | "ekedc" | "ikedc" | "aedc" | "ibedc" | "phedc" | "eedc";

interface BillPackage {
  code: string;
  name: string;
  amount: number;
  validity?: string;
}

const CABLE_SERVICES = [
  { id: "dstv" as BillServiceType, name: "DSTV", icon: "TV" },
  { id: "gotv" as BillServiceType, name: "GOtv", icon: "TV" },
  { id: "startimes" as BillServiceType, name: "StarTimes", icon: "TV" },
  { id: "showmax" as BillServiceType, name: "Showmax", icon: "TV" },
];

const ELECTRICITY_SERVICES = [
  { id: "ekedc" as BillServiceType, name: "Eko (EKEDC)", region: "Lagos" },
  { id: "ikedc" as BillServiceType, name: "Ikeja (IKEDC)", region: "Lagos" },
  { id: "aedc" as BillServiceType, name: "Abuja (AEDC)", region: "Abuja" },
  { id: "ibedc" as BillServiceType, name: "Ibadan (IBEDC)", region: "Ibadan" },
  { id: "phedc" as BillServiceType, name: "Port Harcourt (PHEDC)", region: "PH" },
  { id: "eedc" as BillServiceType, name: "Enugu (EEDC)", region: "Enugu" },
];

type ScheduleFrequency = "daily" | "weekly" | "monthly";

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
    prefixes: ["0803", "0806", "0703", "0704", "0706", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916", "0702"],
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

export default function VtuPage() {
  const { toast } = useToast();
  const [serviceType, setServiceType] = useState<ServiceType>("data");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>("mtn_sme");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [customAirtimeAmount, setCustomAirtimeAmount] = useState("");
  const [selectedAirtimeAmount, setSelectedAirtimeAmount] = useState<number | null>(null);
  
  // Beneficiary states
  const [showBeneficiaryDialog, setShowBeneficiaryDialog] = useState(false);
  const [newBeneficiaryName, setNewBeneficiaryName] = useState("");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<VtuBeneficiary | null>(null);
  
  // Transaction filter states
  const [txStatusFilter, setTxStatusFilter] = useState<string>("all");
  const [txNetworkFilter, setTxNetworkFilter] = useState<string>("all");

  // Schedule states
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<ScheduleFrequency>("daily");
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState<number>(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState<number>(1);
  const [scheduleTimeOfDay, setScheduleTimeOfDay] = useState<string>("09:00");
  const [schedulePhoneNumber, setSchedulePhoneNumber] = useState("");
  const [scheduleNetwork, setScheduleNetwork] = useState<NetworkType>("mtn_sme");
  const [scheduleServiceType, setScheduleServiceType] = useState<"data" | "airtime">("data");
  const [schedulePlanId, setSchedulePlanId] = useState<string | null>(null);
  const [scheduleAirtimeAmount, setScheduleAirtimeAmount] = useState<string>("");

  // Gift Data states
  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const [giftRecipientPhone, setGiftRecipientPhone] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftPlanId, setGiftPlanId] = useState<string | null>(null);
  const [giftNetwork, setGiftNetwork] = useState<NetworkType>("mtn_sme");
  const [giftTab, setGiftTab] = useState<"send" | "sent" | "received">("send");

  // Bill Payment states
  const [billType, setBillType] = useState<BillType>("cable");
  const [selectedBillService, setSelectedBillService] = useState<BillServiceType>("dstv");
  const [billCustomerId, setBillCustomerId] = useState("");
  const [billCustomerName, setBillCustomerName] = useState<string | null>(null);
  const [billCustomerValidated, setBillCustomerValidated] = useState(false);
  const [selectedBillPackage, setSelectedBillPackage] = useState<BillPackage | null>(null);
  const [billElectricityAmount, setBillElectricityAmount] = useState("");
  const [billPackages, setBillPackages] = useState<BillPackage[]>([]);
  const [loadingBillPackages, setLoadingBillPackages] = useState(false);

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletType>({
    queryKey: ["/api/wallet"],
  });

  const { data: plans, isLoading: plansLoading } = useQuery<VtuPlan[]>({
    queryKey: ["/api/vtu/plans", { network: selectedNetwork }],
  });

  const { data: schedulePlans } = useQuery<VtuPlan[]>({
    queryKey: ["/api/vtu/plans", { network: scheduleNetwork }],
    enabled: showScheduleDialog,
  });

  const { data: giftPlans } = useQuery<VtuPlan[]>({
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

  const { data: billPayments, isLoading: billPaymentsLoading } = useQuery<BillPayment[]>({
    queryKey: ["/api/bills/history"],
    enabled: serviceType === "bills",
  });

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

  // Schedule mutations
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

  // Gift mutations
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

  const validateBillCustomerMutation = useMutation({
    mutationFn: async (data: { serviceType: BillServiceType; customerId: string }) => {
      const response = await apiRequest("POST", "/api/bills/validate", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setBillCustomerName(data.customerName);
        setBillCustomerValidated(true);
        toast({ title: "Verified", description: `Customer: ${data.customerName}` });
      } else {
        setBillCustomerName(null);
        setBillCustomerValidated(false);
        toast({ title: "Validation Failed", description: data.message || "Invalid customer ID", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      setBillCustomerName(null);
      setBillCustomerValidated(false);
      toast({ title: "Error", description: error.message || "Failed to validate customer", variant: "destructive" });
    },
  });

  const payBillMutation = useMutation({
    mutationFn: async (data: { 
      serviceType: BillServiceType; 
      billType: BillType; 
      customerId: string; 
      amount: number;
      packageCode?: string;
      packageName?: string;
    }) => {
      const response = await apiRequest("POST", "/api/bills/pay", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ 
          title: "Payment Successful", 
          description: data.token 
            ? `Token: ${data.token}` 
            : "Bill payment completed successfully!" 
        });
        queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
        queryClient.invalidateQueries({ queryKey: ["/api/bills/history"] });
        resetBillForm();
      } else {
        toast({ title: "Payment Failed", description: data.message || "Bill payment failed", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to process payment", variant: "destructive" });
    },
  });

  const resetScheduleForm = () => {
    setSchedulePhoneNumber("");
    setScheduleNetwork("mtn_sme");
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
    setGiftNetwork("mtn_sme");
  };

  const resetBillForm = () => {
    setBillCustomerId("");
    setBillCustomerName(null);
    setBillCustomerValidated(false);
    setSelectedBillPackage(null);
    setBillElectricityAmount("");
    setBillPackages([]);
  };

  const fetchCablePackages = async (service: BillServiceType) => {
    setLoadingBillPackages(true);
    try {
      const response = await fetch(`/api/bills/packages/${service}`);
      const data = await response.json();
      if (data.success && data.packages) {
        setBillPackages(data.packages);
      } else {
        setBillPackages([]);
      }
    } catch (error) {
      setBillPackages([]);
    } finally {
      setLoadingBillPackages(false);
    }
  };

  const handleBillServiceChange = (service: BillServiceType) => {
    setSelectedBillService(service);
    resetBillForm();
    if (billType === "cable") {
      fetchCablePackages(service);
    }
  };

  const handleBillTypeChange = (type: BillType) => {
    setBillType(type);
    resetBillForm();
    if (type === "cable") {
      setSelectedBillService("dstv");
      fetchCablePackages("dstv");
    } else {
      setSelectedBillService("ekedc");
    }
  };

  const handleValidateCustomer = () => {
    if (!billCustomerId.trim()) return;
    validateBillCustomerMutation.mutate({
      serviceType: selectedBillService,
      customerId: billCustomerId.trim(),
    });
  };

  const handleBillPayment = () => {
    const amount = billType === "cable" 
      ? selectedBillPackage?.amount || 0 
      : parseFloat(billElectricityAmount) || 0;

    if (!amount || !billCustomerValidated) return;

    payBillMutation.mutate({
      serviceType: selectedBillService,
      billType,
      customerId: billCustomerId.trim(),
      amount,
      packageCode: selectedBillPackage?.code,
      packageName: selectedBillPackage?.name,
    });
  };

  const canPayBill = billCustomerValidated && (
    (billType === "cable" && selectedBillPackage && walletBalance >= selectedBillPackage.amount) ||
    (billType === "electricity" && parseFloat(billElectricityAmount) >= 500 && walletBalance >= parseFloat(billElectricityAmount))
  );

  const getBillServiceName = (service: BillServiceType): string => {
    const cable = CABLE_SERVICES.find(s => s.id === service);
    if (cable) return cable.name;
    const elec = ELECTRICITY_SERVICES.find(s => s.id === service);
    return elec?.name || service.toUpperCase();
  };

  const detectedNetwork = useMemo(() => detectNetwork(phoneNumber), [phoneNumber]);
  const phoneValidation = useMemo(() => validatePhoneNumber(phoneNumber), [phoneNumber]);
  const networkMatch = detectedNetwork?.id === selectedNetwork;

  const schedulePhoneValidation = useMemo(() => validatePhoneNumber(schedulePhoneNumber), [schedulePhoneNumber]);
  const giftPhoneValidation = useMemo(() => validatePhoneNumber(giftRecipientPhone), [giftRecipientPhone]);

  const filteredPlans = useMemo(() => {
    if (!plans) return [];
    if (!searchQuery.trim()) return plans;
    
    const query = searchQuery.toLowerCase();
    return plans.filter(plan => 
      plan.dataAmount.toLowerCase().includes(query) ||
      plan.validity.toLowerCase().includes(query) ||
      plan.planName.toLowerCase().includes(query) ||
      plan.sellingPrice.includes(query)
    );
  }, [plans, searchQuery]);

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId);
  const walletBalance = parseFloat(wallet?.balance || "0");
  
  const canPurchaseData = 
    selectedPlanId && 
    phoneValidation.valid && 
    selectedPlan && 
    walletBalance >= parseFloat(selectedPlan.sellingPrice);

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
    walletBalance >= parseFloat(selectedGiftPlan.sellingPrice);

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
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="data" data-testid="tab-service-data" className="flex items-center gap-2">
            <Signal className="h-4 w-4" />
            <span className="hidden sm:inline">Buy</span> Data
          </TabsTrigger>
          <TabsTrigger value="airtime" data-testid="tab-service-airtime" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Buy</span> Airtime
          </TabsTrigger>
          <TabsTrigger value="bills" data-testid="tab-service-bills" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Bills
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
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <span className={`w-2 h-2 rounded-full ${network.color} mr-2`} />
                      {network.displayName}
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
                            <div className="text-lg font-semibold text-primary mt-2">
                              ₦{parseFloat(plan.sellingPrice).toLocaleString()}
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
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <span className={`w-2 h-2 rounded-full ${network.color} mr-2`} />
                      {network.displayName}
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

        <TabsContent value="bills">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Pay Bills
              </CardTitle>
              <CardDescription>Pay cable TV and electricity bills</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={billType === "cable" ? "default" : "outline"}
                  onClick={() => handleBillTypeChange("cable")}
                  className="flex-1"
                  data-testid="button-bill-type-cable"
                >
                  <Tv className="h-4 w-4 mr-2" />
                  Cable TV
                </Button>
                <Button
                  type="button"
                  variant={billType === "electricity" ? "default" : "outline"}
                  onClick={() => handleBillTypeChange("electricity")}
                  className="flex-1"
                  data-testid="button-bill-type-electricity"
                >
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Electricity
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Service Provider</Label>
                <Select 
                  value={selectedBillService} 
                  onValueChange={(v) => handleBillServiceChange(v as BillServiceType)}
                >
                  <SelectTrigger data-testid="select-bill-service">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {billType === "cable" ? (
                      CABLE_SERVICES.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <Tv className="h-4 w-4" />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))
                    ) : (
                      ELECTRICITY_SERVICES.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <Lightbulb className="h-4 w-4" />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{billType === "cable" ? "Decoder Number" : "Meter Number"}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder={billType === "cable" ? "Enter decoder number" : "Enter meter number"}
                    value={billCustomerId}
                    onChange={(e) => {
                      setBillCustomerId(e.target.value);
                      setBillCustomerValidated(false);
                      setBillCustomerName(null);
                    }}
                    className="flex-1"
                    data-testid="input-bill-customer-id"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleValidateCustomer}
                    disabled={!billCustomerId.trim() || validateBillCustomerMutation.isPending}
                    data-testid="button-validate-customer"
                  >
                    {validateBillCustomerMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
                {billCustomerValidated && billCustomerName && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Customer: {billCustomerName}
                  </div>
                )}
              </div>

              {billType === "cable" ? (
                <div className="space-y-2">
                  <Label>Select Package</Label>
                  {loadingBillPackages ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : billPackages.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                      {billPackages.map((pkg) => (
                        <div
                          key={pkg.code}
                          onClick={() => setSelectedBillPackage(pkg)}
                          className={`p-3 rounded-md border-2 cursor-pointer transition-all ${
                            selectedBillPackage?.code === pkg.code
                              ? "border-primary bg-primary/5"
                              : "border-border hover-elevate"
                          }`}
                          data-testid={`card-bill-package-${pkg.code}`}
                        >
                          <div className="font-medium">{pkg.name}</div>
                          <div className="text-lg font-bold text-primary">
                            ₦{pkg.amount.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Tv className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No packages available. Select a provider first.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Amount (min ₦500)</Label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={billElectricityAmount}
                    onChange={(e) => setBillElectricityAmount(e.target.value)}
                    min={500}
                    data-testid="input-bill-electricity-amount"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum amount: ₦500
                  </p>
                </div>
              )}

              <Button
                onClick={handleBillPayment}
                disabled={!canPayBill || payBillMutation.isPending}
                className="w-full"
                data-testid="button-pay-bill"
              >
                {payBillMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Pay Bill
                    {billType === "cable" && selectedBillPackage && ` - ₦${selectedBillPackage.amount.toLocaleString()}`}
                    {billType === "electricity" && billElectricityAmount && ` - ₦${parseFloat(billElectricityAmount).toLocaleString()}`}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Bill Payment History
              </CardTitle>
              <CardDescription>Your recent bill payments</CardDescription>
            </CardHeader>
            <CardContent>
              {billPaymentsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : billPayments && billPayments.length > 0 ? (
                <div className="space-y-4">
                  {billPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-md bg-muted/30"
                      data-testid={`bill-payment-${payment.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          {payment.billType === "cable" ? (
                            <Tv className="h-4 w-4 text-primary" />
                          ) : (
                            <Lightbulb className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium flex flex-wrap items-center gap-2">
                            {getBillServiceName(payment.serviceType as BillServiceType)}
                            <Badge variant="outline" className="text-xs">
                              {payment.billType === "cable" ? "Cable" : "Electricity"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {payment.customerId}
                            {payment.token && (
                              <span className="ml-2 text-green-600 dark:text-green-400">
                                Token: {payment.token}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {payment.createdAt && format(new Date(payment.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:text-right">
                        <div>
                          <div className="font-bold">₦{parseFloat(payment.amount).toLocaleString()}</div>
                        </div>
                        {getStatusBadge(payment.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No bill payments yet.</p>
                  <p className="text-sm">Your bill payment history will appear here.</p>
                </div>
              )}
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
                                  {plan.dataAmount} - {plan.validity} (₦{parseFloat(plan.sellingPrice).toLocaleString()})
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
                        <Label>Time</Label>
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
                        data-testid="button-confirm-create-schedule"
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
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : scheduledPurchases && scheduledPurchases.length > 0 ? (
                <div className="space-y-4">
                  {scheduledPurchases.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-md bg-muted/30"
                      data-testid={`schedule-${schedule.id}`}
                    >
                      <div className="flex items-start gap-3">
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
                            {getNetworkBadge(schedule.network)}
                            <Badge variant="outline" className="text-xs">
                              {schedule.serviceType === "data" ? "Data" : "Airtime"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {getFrequencyLabel(schedule)}
                          </div>
                          {schedule.nextRunAt && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Next: {format(new Date(schedule.nextRunAt), "MMM d, yyyy 'at' h:mm a")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {schedule.amount && (
                          <span className="font-bold">₦{parseFloat(schedule.amount).toLocaleString()}</span>
                        )}
                        {getScheduleStatusBadge(schedule.status || "active")}
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={schedule.status === "active"}
                            onCheckedChange={(checked) => {
                              updateScheduleStatusMutation.mutate({
                                id: schedule.id,
                                status: checked ? "active" : "paused",
                              });
                            }}
                            data-testid={`switch-schedule-${schedule.id}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this schedule?")) {
                                deleteScheduleMutation.mutate(schedule.id);
                              }
                            }}
                            data-testid={`button-delete-schedule-${schedule.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
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
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Gift Data
              </CardTitle>
              <CardDescription>Send data as a gift or claim received gifts</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={giftTab} onValueChange={(v) => setGiftTab(v as "send" | "sent" | "received")}>
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="send" data-testid="tab-gift-send" className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Send Gift
                  </TabsTrigger>
                  <TabsTrigger value="sent" data-testid="tab-gift-sent" className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Sent Gifts
                  </TabsTrigger>
                  <TabsTrigger value="received" data-testid="tab-gift-received" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Received
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="send">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Recipient Phone Number</Label>
                      <Input
                        placeholder="08012345678"
                        value={giftRecipientPhone}
                        onChange={(e) => setGiftRecipientPhone(e.target.value.replace(/\D/g, "").slice(0, 13))}
                        data-testid="input-gift-recipient-phone"
                      />
                      {giftPhoneValidation.message && (
                        <p className="text-sm text-red-500">{giftPhoneValidation.message}</p>
                      )}
                      {beneficiaries && beneficiaries.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {beneficiaries.slice(0, 4).map((b) => (
                            <Button
                              key={b.id}
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setGiftRecipientPhone(b.phoneNumber);
                                setGiftNetwork(b.network as NetworkType);
                              }}
                              className="text-xs"
                              data-testid={`button-gift-beneficiary-${b.id}`}
                            >
                              {b.name}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

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
                      <Label>Data Plan</Label>
                      <Select value={giftPlanId || ""} onValueChange={setGiftPlanId}>
                        <SelectTrigger data-testid="select-gift-plan">
                          <SelectValue placeholder="Select plan to gift" />
                        </SelectTrigger>
                        <SelectContent>
                          {giftPlans?.map(plan => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.dataAmount} - {plan.validity} (₦{parseFloat(plan.sellingPrice).toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Message (Optional)</Label>
                      <Textarea
                        placeholder="Add a personal message..."
                        value={giftMessage}
                        onChange={(e) => setGiftMessage(e.target.value)}
                        maxLength={200}
                        className="resize-none"
                        data-testid="input-gift-message"
                      />
                      <p className="text-xs text-muted-foreground text-right">{giftMessage.length}/200</p>
                    </div>

                    {selectedGiftPlan && (
                      <div className="p-4 rounded-md bg-muted/50 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plan:</span>
                          <span className="font-medium">{selectedGiftPlan.dataAmount} - {selectedGiftPlan.validity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Network:</span>
                          {getNetworkBadge(giftNetwork)}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-bold text-primary">₦{parseFloat(selectedGiftPlan.sellingPrice).toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {selectedGiftPlan && walletBalance < parseFloat(selectedGiftPlan.sellingPrice) && (
                      <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Insufficient Balance</p>
                          <p className="text-sm">You need ₦{(parseFloat(selectedGiftPlan.sellingPrice) - walletBalance).toLocaleString()} more to send this gift.</p>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleSendGift}
                      disabled={!canSendGift || sendGiftMutation.isPending}
                      className="w-full"
                      data-testid="button-send-gift"
                    >
                      {sendGiftMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Gift className="h-4 w-4 mr-2" />
                          Send Gift
                          {selectedGiftPlan && ` - ₦${parseFloat(selectedGiftPlan.sellingPrice).toLocaleString()}`}
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="sent">
                  {sentGiftsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : sentGifts && sentGifts.length > 0 ? (
                    <div className="space-y-4">
                      {sentGifts.map((gift) => (
                        <div
                          key={gift.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-md bg-muted/30"
                          data-testid={`sent-gift-${gift.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full ${NETWORKS.find(n => n.id === gift.network)?.bgColor || "bg-muted"}`}>
                              <Gift className={`h-4 w-4 ${NETWORKS.find(n => n.id === gift.network)?.textColor || "text-muted-foreground"}`} />
                            </div>
                            <div>
                              <div className="font-medium flex flex-wrap items-center gap-2">
                                To: {gift.recipientPhone}
                                {getNetworkBadge(gift.network)}
                              </div>
                              {gift.message && (
                                <p className="text-sm text-muted-foreground mt-1 italic">"{gift.message}"</p>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {gift.createdAt && format(new Date(gift.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col sm:items-end gap-2">
                            {getGiftStatusBadge(gift.status || "pending")}
                            {gift.giftCode && (
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded">{gift.giftCode}</code>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleCopyGiftCode(gift.giftCode!)}
                                  data-testid={`button-copy-gift-code-${gift.id}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No gifts sent yet.</p>
                      <p className="text-sm">Send your first data gift to someone special!</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="received">
                  {receivedGiftsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : receivedGifts && receivedGifts.length > 0 ? (
                    <div className="space-y-4">
                      {receivedGifts.map((gift) => (
                        <div
                          key={gift.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-md bg-muted/30"
                          data-testid={`received-gift-${gift.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full ${NETWORKS.find(n => n.id === gift.network)?.bgColor || "bg-muted"}`}>
                              <Gift className={`h-4 w-4 ${NETWORKS.find(n => n.id === gift.network)?.textColor || "text-muted-foreground"}`} />
                            </div>
                            <div>
                              <div className="font-medium flex flex-wrap items-center gap-2">
                                Data Gift
                                {getNetworkBadge(gift.network)}
                              </div>
                              {gift.message && (
                                <p className="text-sm text-muted-foreground mt-1 italic">"{gift.message}"</p>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {gift.createdAt && format(new Date(gift.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              </div>
                              {gift.expiresAt && gift.status === "pending" && (
                                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                  Expires: {format(new Date(gift.expiresAt), "MMM d, yyyy")}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:items-end gap-2">
                            {getGiftStatusBadge(gift.status || "pending")}
                            {gift.status === "pending" && gift.giftCode && (
                              <Button
                                size="sm"
                                onClick={() => claimGiftMutation.mutate(gift.giftCode!)}
                                disabled={claimGiftMutation.isPending}
                                data-testid={`button-claim-gift-${gift.id}`}
                              >
                                {claimGiftMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Download className="h-4 w-4 mr-2" />
                                )}
                                Claim Gift
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Download className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No gifts received yet.</p>
                      <p className="text-sm">Gifts you receive will appear here.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Saved Beneficiaries Quick Select - Only show for data and airtime tabs */}
      {(serviceType === "data" || serviceType === "airtime") && beneficiaries && beneficiaries.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Quick Select
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

      {/* Phone Number and Purchase Card - Only show for data and airtime tabs */}
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
                  <span className="font-bold text-primary">₦{parseFloat(selectedPlan.sellingPrice).toLocaleString()}</span>
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

            {serviceType === "data" && selectedPlan && walletBalance < parseFloat(selectedPlan.sellingPrice) && (
              <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Insufficient Balance</p>
                  <p className="text-sm">You need ₦{(parseFloat(selectedPlan.sellingPrice) - walletBalance).toLocaleString()} more to purchase this plan.</p>
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
                    {selectedPlan && ` - ₦${parseFloat(selectedPlan.sellingPrice).toLocaleString()}`}
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

      {/* Transaction History - Only show for data and airtime tabs */}
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
                          {tx.serviceType === "airtime" && (
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

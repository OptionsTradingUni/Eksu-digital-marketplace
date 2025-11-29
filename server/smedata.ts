// SMEDATA.NG API Integration for VTU Data Sales
// API Documentation: https://smedata.ng/reseller/
// Base URL: https://smedata.ng/wp-json/api/v1/
// Networks: MTN SME, GLO CG, AIRTEL CG

const SMEDATA_BASE_URL = "https://smedata.ng/wp-json/api/v1";
const SME_API_KEY = process.env.SME_API || "";

// Default discount rate for resellers (2-3%)
const DEFAULT_DISCOUNT_RATE = 0.03; // 3% discount

export interface SMEDataResponse {
  success: boolean;
  message: string;
  data?: any;
  reference?: string;
  orderId?: string;
  error?: string;
}

// Network types supported by SME Data API (no 9mobile)
export type NetworkType = "mtn_sme" | "glo_cg" | "airtel_cg";

// Data plan structure with pricing
export interface DataPlan {
  id: string;
  network: NetworkType;
  planCode: string;
  name: string;
  dataAmount: string;
  validity: string;
  price: number;
  discountedPrice: number;
}

// All available MTN Data Plans from API documentation
const MTN_PLANS: Omit<DataPlan, 'discountedPrice'>[] = [
  { id: "mtn_230mb1d", network: "mtn_sme", planCode: "230mb1d", name: "MTN 230MB Daily", dataAmount: "230MB", validity: "1 day", price: 100 },
  { id: "mtn_1gb1d", network: "mtn_sme", planCode: "1gb1d", name: "MTN 1GB + 1.5Mins Daily", dataAmount: "1GB", validity: "1 day", price: 300 },
  { id: "mtn_1gb1w", network: "mtn_sme", planCode: "1gb1w", name: "MTN 1GB Weekly", dataAmount: "1GB", validity: "7 days", price: 300 },
  { id: "mtn_1.5gb2d", network: "mtn_sme", planCode: "1.5gb2d", name: "MTN 1.5GB 2-Days", dataAmount: "1.5GB", validity: "2 days", price: 300 },
  { id: "mtn_1.5gb1w", network: "mtn_sme", planCode: "1.5gb1w", name: "MTN 1.5GB Weekly", dataAmount: "1.5GB", validity: "7 days", price: 350 },
  { id: "mtn_2.5gb1d", network: "mtn_sme", planCode: "2.5gb1d", name: "MTN 2.5GB Daily", dataAmount: "2.5GB", validity: "1 day", price: 500 },
  { id: "mtn_2.5gb2d", network: "mtn_sme", planCode: "2.5gb2d", name: "MTN 2.5GB 2-Days", dataAmount: "2.5GB", validity: "2 days", price: 500 },
  { id: "mtn_2gb1m", network: "mtn_sme", planCode: "2gb1m", name: "MTN 2GB + 2Mins Monthly", dataAmount: "2GB", validity: "30 days", price: 500 },
  { id: "mtn_2.7gb1m", network: "mtn_sme", planCode: "2.7gb1m", name: "MTN 2.7GB + 5Mins Monthly", dataAmount: "2.7GB", validity: "30 days", price: 550 },
  { id: "mtn_6gb1w", network: "mtn_sme", planCode: "6gb1w", name: "MTN 6GB Weekly", dataAmount: "6GB", validity: "7 days", price: 1000 },
  { id: "mtn_3.5gb1m", network: "mtn_sme", planCode: "3.5gb1m", name: "MTN 3.5GB + 5Mins Monthly", dataAmount: "3.5GB", validity: "30 days", price: 700 },
  { id: "mtn_7gb1m", network: "mtn_sme", planCode: "7gb1m", name: "MTN 7GB Monthly", dataAmount: "7GB", validity: "30 days", price: 1500 },
  { id: "mtn_10gb1m", network: "mtn_sme", planCode: "10gb1m", name: "MTN 10GB + 10Mins Monthly", dataAmount: "10GB", validity: "30 days", price: 2000 },
  { id: "mtn_12.5gb1m", network: "mtn_sme", planCode: "12.5gb1m", name: "MTN 12.5GB Monthly", dataAmount: "12.5GB", validity: "30 days", price: 2500 },
  { id: "mtn_16.5gb1m", network: "mtn_sme", planCode: "16.5gb1m", name: "MTN 16.5GB + 10Mins Monthly", dataAmount: "16.5GB", validity: "30 days", price: 3000 },
  { id: "mtn_20gb1m", network: "mtn_sme", planCode: "20gb1m", name: "MTN 20GB Monthly", dataAmount: "20GB", validity: "30 days", price: 3500 },
  { id: "mtn_25gb1m", network: "mtn_sme", planCode: "25gb1m", name: "MTN 25GB Monthly", dataAmount: "25GB", validity: "30 days", price: 5000 },
];

// All available GLO Data Plans from API documentation
const GLO_PLANS: Omit<DataPlan, 'discountedPrice'>[] = [
  { id: "glo_500mb", network: "glo_cg", planCode: "500MB", name: "GLO 500MB SME", dataAmount: "500MB", validity: "30 days", price: 150 },
  { id: "glo_1gb", network: "glo_cg", planCode: "1GB", name: "GLO 1GB SME", dataAmount: "1GB", validity: "30 days", price: 250 },
  { id: "glo_2gb", network: "glo_cg", planCode: "2GB", name: "GLO 2GB SME", dataAmount: "2GB", validity: "30 days", price: 500 },
  { id: "glo_3gb", network: "glo_cg", planCode: "3GB", name: "GLO 3GB SME", dataAmount: "3GB", validity: "30 days", price: 750 },
  { id: "glo_5gb", network: "glo_cg", planCode: "5GB", name: "GLO 5GB SME", dataAmount: "5GB", validity: "30 days", price: 1250 },
  { id: "glo_10gb", network: "glo_cg", planCode: "10GB", name: "GLO 10GB SME", dataAmount: "10GB", validity: "30 days", price: 2500 },
];

// All available AIRTEL Data Plans from API documentation
const AIRTEL_PLANS: Omit<DataPlan, 'discountedPrice'>[] = [
  { id: "airtel_300mb2d", network: "airtel_cg", planCode: "300mb2d", name: "Airtel 300MB 2-Days", dataAmount: "300MB", validity: "2 days", price: 100 },
  { id: "airtel_500mb1w", network: "airtel_cg", planCode: "500mb1w", name: "Airtel 500MB Weekly", dataAmount: "500MB", validity: "7 days", price: 150 },
  { id: "airtel_1gb1w", network: "airtel_cg", planCode: "1gb1w", name: "Airtel 1GB Weekly", dataAmount: "1GB", validity: "7 days", price: 250 },
  { id: "airtel_1.5gb2d", network: "airtel_cg", planCode: "1.5gb2d", name: "Airtel 1.5GB 2-Days", dataAmount: "1.5GB", validity: "2 days", price: 300 },
  { id: "airtel_1.5gb1w", network: "airtel_cg", planCode: "1.5gb1w", name: "Airtel 1.5GB Weekly", dataAmount: "1.5GB", validity: "7 days", price: 350 },
  { id: "airtel_3.5gb1w", network: "airtel_cg", planCode: "3.5gb1w", name: "Airtel 3.5GB Weekly", dataAmount: "3.5GB", validity: "7 days", price: 500 },
  { id: "airtel_6gb1w", network: "airtel_cg", planCode: "6gb1w", name: "Airtel 6GB Weekly", dataAmount: "6GB", validity: "7 days", price: 750 },
  { id: "airtel_10gb1w", network: "airtel_cg", planCode: "10gb1w", name: "Airtel 10GB Weekly", dataAmount: "10GB", validity: "7 days", price: 1000 },
  { id: "airtel_15gb1w", network: "airtel_cg", planCode: "15gb1w", name: "Airtel 15GB Weekly", dataAmount: "15GB", validity: "7 days", price: 1500 },
  { id: "airtel_2gb1m", network: "airtel_cg", planCode: "2gb1m", name: "Airtel 2GB Monthly", dataAmount: "2GB", validity: "30 days", price: 500 },
  { id: "airtel_3gb1m", network: "airtel_cg", planCode: "3gb1m", name: "Airtel 3GB Monthly", dataAmount: "3GB", validity: "30 days", price: 750 },
  { id: "airtel_4gb1m", network: "airtel_cg", planCode: "4gb1m", name: "Airtel 4GB Monthly", dataAmount: "4GB", validity: "30 days", price: 1000 },
  { id: "airtel_8gb1m", network: "airtel_cg", planCode: "8gb1m", name: "Airtel 8GB Monthly", dataAmount: "8GB", validity: "30 days", price: 1500 },
  { id: "airtel_10gb1m", network: "airtel_cg", planCode: "10gb1m", name: "Airtel 10GB Monthly", dataAmount: "10GB", validity: "30 days", price: 2000 },
  { id: "airtel_13gb1m", network: "airtel_cg", planCode: "13gb1m", name: "Airtel 13GB Monthly", dataAmount: "13GB", validity: "30 days", price: 2500 },
  { id: "airtel_18gb1m", network: "airtel_cg", planCode: "18gb1m", name: "Airtel 18GB Monthly", dataAmount: "18GB", validity: "30 days", price: 3000 },
  { id: "airtel_25gb1m", network: "airtel_cg", planCode: "25gb1m", name: "Airtel 25GB Monthly", dataAmount: "25GB", validity: "30 days", price: 4000 },
  { id: "airtel_35gb1m", network: "airtel_cg", planCode: "35gb1m", name: "Airtel 35GB Monthly", dataAmount: "35GB", validity: "30 days", price: 5500 },
];

// Combine all plans
const ALL_BASE_PLANS = [...MTN_PLANS, ...GLO_PLANS, ...AIRTEL_PLANS];

// Calculate discounted price
function calculateDiscountedPrice(price: number, discountRate: number = DEFAULT_DISCOUNT_RATE): number {
  return Math.round(price * (1 - discountRate));
}

// Get all plans with discounts applied
export function getAllDataPlans(discountRate: number = DEFAULT_DISCOUNT_RATE): DataPlan[] {
  return ALL_BASE_PLANS.map(plan => ({
    ...plan,
    discountedPrice: calculateDiscountedPrice(plan.price, discountRate),
  }));
}

// Get plans by network
export function getDataPlansByNetwork(network: NetworkType, discountRate: number = DEFAULT_DISCOUNT_RATE): DataPlan[] {
  return getAllDataPlans(discountRate).filter(plan => plan.network === network);
}

// Get a single plan by ID
export function getDataPlanById(planId: string, discountRate: number = DEFAULT_DISCOUNT_RATE): DataPlan | undefined {
  const plan = ALL_BASE_PLANS.find(p => p.id === planId);
  if (!plan) return undefined;
  return {
    ...plan,
    discountedPrice: calculateDiscountedPrice(plan.price, discountRate),
  };
}

// Network mapping for API calls
const NETWORK_API_MAP: Record<NetworkType, string> = {
  mtn_sme: "mtn",
  glo_cg: "glo",
  airtel_cg: "airtel",
};

// Nigerian phone prefixes by network
const MTN_PREFIXES = [
  "0803", "0806", "0703", "0704", "0706", "0810", "0813", "0814", "0816",
  "0903", "0906", "0913", "0916", "0702"
];
const GLO_PREFIXES = ["0805", "0807", "0705", "0815", "0811", "0905", "0915"];
const AIRTEL_PREFIXES = ["0802", "0808", "0708", "0812", "0701", "0902", "0901", "0907", "0912"];

const ALL_VALID_PREFIXES = [...MTN_PREFIXES, ...GLO_PREFIXES, ...AIRTEL_PREFIXES];

// Normalize Nigerian phone number
export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.startsWith("234")) {
    cleaned = "0" + cleaned.substring(3);
  } else if (cleaned.startsWith("+234")) {
    cleaned = "0" + cleaned.substring(4);
  } else if (!cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "0" + cleaned;
  }
  
  return cleaned;
}

// Validate Nigerian phone number
export function isValidNigerianPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length !== 11 || !normalized.startsWith("0")) {
    return false;
  }
  const prefix = normalized.substring(0, 4);
  return ALL_VALID_PREFIXES.includes(prefix);
}

// Detect network from phone number
export function detectNetwork(phone: string): NetworkType | null {
  const normalized = normalizePhoneNumber(phone);
  const prefix = normalized.substring(0, 4);
  
  if (MTN_PREFIXES.includes(prefix)) return "mtn_sme";
  if (GLO_PREFIXES.includes(prefix)) return "glo_cg";
  if (AIRTEL_PREFIXES.includes(prefix)) return "airtel_cg";
  
  return null;
}

// Check if SME Data API is configured
export function isSMEDataConfigured(): boolean {
  return !!SME_API_KEY && SME_API_KEY !== "";
}

// Purchase data from SME Data API
// Endpoint: GET https://smedata.ng/wp-json/api/v1/data
// Parameters: token, network, phone, size
export async function purchaseData(
  network: NetworkType,
  phoneNumber: string,
  planCode: string
): Promise<SMEDataResponse> {
  if (!isSMEDataConfigured()) {
    return {
      success: false,
      message: "VTU service is not configured. Please contact support.",
      error: "API_NOT_CONFIGURED",
    };
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const apiNetwork = NETWORK_API_MAP[network];

  try {
    const params = new URLSearchParams({
      token: SME_API_KEY,
      network: apiNetwork,
      phone: normalizedPhone,
      size: planCode,
    });

    console.log("[SME Data] Purchase request:", `${SMEDATA_BASE_URL}/data?token=***&network=${apiNetwork}&phone=${normalizedPhone}&size=${planCode}`);

    const response = await fetch(`${SMEDATA_BASE_URL}/data?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    console.log("[SME Data] Purchase response:", JSON.stringify(data));

    const isSuccess = data.code === "success";

    return {
      success: isSuccess,
      message: data.message || (isSuccess ? "Data purchase successful" : "Data purchase failed"),
      orderId: data.data?.order_id?.toString(),
      reference: data.data?.order_id?.toString(),
      data: data.data,
      error: isSuccess ? undefined : (data.message || data.error),
    };
  } catch (error: any) {
    console.error("[SME Data] Purchase error:", error);
    return {
      success: false,
      message: "Failed to process data purchase. Please try again.",
      error: error.message || "NETWORK_ERROR",
    };
  }
}

// Purchase airtime from SME Data API
// Endpoint: GET https://smedata.ng/wp-json/api/v1/airtime
// Parameters: token, network, phone, amount
export async function purchaseAirtime(
  network: NetworkType,
  phoneNumber: string,
  amount: number
): Promise<SMEDataResponse> {
  if (!isSMEDataConfigured()) {
    return {
      success: false,
      message: "VTU service is not configured. Please contact support.",
      error: "API_NOT_CONFIGURED",
    };
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const apiNetwork = NETWORK_API_MAP[network];

  try {
    const params = new URLSearchParams({
      token: SME_API_KEY,
      network: apiNetwork,
      phone: normalizedPhone,
      amount: amount.toString(),
    });

    console.log("[SME Data] Airtime request:", `${SMEDATA_BASE_URL}/airtime?token=***&network=${apiNetwork}&phone=${normalizedPhone}&amount=${amount}`);

    const response = await fetch(`${SMEDATA_BASE_URL}/airtime?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    console.log("[SME Data] Airtime response:", JSON.stringify(data));

    const isSuccess = data.code === "success";

    return {
      success: isSuccess,
      message: data.message || (isSuccess ? "Airtime purchase successful" : "Airtime purchase failed"),
      orderId: data.data?.order_id?.toString(),
      reference: data.data?.order_id?.toString(),
      data: data.data,
      error: isSuccess ? undefined : (data.message || data.error),
    };
  } catch (error: any) {
    console.error("[SME Data] Airtime error:", error);
    return {
      success: false,
      message: "Failed to process airtime purchase. Please try again.",
      error: error.message || "NETWORK_ERROR",
    };
  }
}

// Requery order status
// Endpoint: GET https://smedata.ng/wp-json/api/v1/requery
// Parameters: token, orderid
export async function requeryOrder(orderId: string): Promise<SMEDataResponse> {
  if (!isSMEDataConfigured()) {
    return {
      success: false,
      message: "VTU service is not configured",
      error: "API_NOT_CONFIGURED",
    };
  }

  try {
    const params = new URLSearchParams({
      token: SME_API_KEY,
      orderid: orderId,
    });

    const response = await fetch(`${SMEDATA_BASE_URL}/requery?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    console.log("[SME Data] Requery response:", JSON.stringify(data));

    const status = data.code;

    return {
      success: status === "success",
      message: data.message || "Order status retrieved",
      data: {
        ...data.data,
        status: status, // "success", "processing", "failure"
      },
      orderId: data.data?.order_id?.toString(),
      reference: data.data?.order_id?.toString(),
    };
  } catch (error: any) {
    console.error("[SME Data] Requery error:", error);
    return {
      success: false,
      message: "Failed to check order status",
      error: error.message || "NETWORK_ERROR",
    };
  }
}

// Get discount information
export function getDiscountInfo(discountRate: number = DEFAULT_DISCOUNT_RATE): {
  rate: number;
  percentage: string;
  description: string;
} {
  return {
    rate: discountRate,
    percentage: `${(discountRate * 100).toFixed(0)}%`,
    description: `Save ${(discountRate * 100).toFixed(0)}% on all data purchases`,
  };
}

// Calculate savings for a purchase
export function calculateSavings(originalPrice: number, discountRate: number = DEFAULT_DISCOUNT_RATE): {
  originalPrice: number;
  discountedPrice: number;
  savings: number;
  savingsPercentage: string;
} {
  const discountedPrice = calculateDiscountedPrice(originalPrice, discountRate);
  const savings = originalPrice - discountedPrice;
  return {
    originalPrice,
    discountedPrice,
    savings,
    savingsPercentage: `${(discountRate * 100).toFixed(0)}%`,
  };
}

// Network display info
export const NETWORK_INFO: Record<NetworkType, {
  name: string;
  displayName: string;
  color: string;
  bgColor: string;
  textColor: string;
}> = {
  mtn_sme: {
    name: "MTN SME",
    displayName: "MTN",
    color: "bg-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    textColor: "text-yellow-700 dark:text-yellow-300",
  },
  glo_cg: {
    name: "GLO CG",
    displayName: "GLO",
    color: "bg-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-700 dark:text-green-300",
  },
  airtel_cg: {
    name: "Airtel CG",
    displayName: "Airtel",
    color: "bg-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    textColor: "text-red-700 dark:text-red-300",
  },
};

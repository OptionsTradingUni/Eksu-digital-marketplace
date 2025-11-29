// INLOMAX API Integration for VTU Services
// API Documentation: https://inlomax.com/api
// Services: Data, Airtime, Cable TV, Electricity, Exam Pins

const INLOMAX_BASE_URL = "https://inlomax.com/api";
const INLOMAX_API_KEY = process.env.MAX_API || "";

// Profit margins for competitive pricing
const PROFIT_MARGINS = {
  data: { min: 10, max: 30 }, // 10-30 naira profit per data transaction
  airtime: { percentage: 0.02 }, // 2% discount on airtime
  cable: { min: 50, max: 100 }, // 50-100 naira profit on cable
  electricity: { percentage: 0.01 }, // 1% service fee
  examPins: { fixed: 30 }, // 30 naira profit per pin
};

export interface InlomaxResponse {
  success: boolean;
  message: string;
  data?: any;
  reference?: string;
  transactionId?: string;
  error?: string;
  token?: string; // For electricity prepaid
}

// Network types - now includes 9mobile
export type NetworkType = "mtn" | "glo" | "airtel" | "9mobile";
export type DataPlanType = "sme" | "direct" | "cg" | "social" | "awoof";
export type CableProvider = "dstv" | "gotv" | "startimes";
export type DiscoType = "ikeja" | "eko" | "ibadan" | "kaduna" | "kano" | "jos" | "enugu" | "abuja" | "portharcourt" | "benin" | "yola" | "aba";
export type ExamType = "waec" | "neco" | "nabteb";

// Data plan structure with market price comparison
export interface DataPlan {
  id: string;
  network: NetworkType;
  planType: DataPlanType;
  planCode: string;
  name: string;
  dataAmount: string;
  validity: string;
  apiPrice: number; // Inlomax cost price
  marketPrice: number; // What networks/competitors charge
  sellingPrice: number; // Our price (cheaper than market, profit over API)
  profit: number; // Our profit per transaction
  savingsAmount: number; // Customer savings vs market
  savingsPercentage: number; // Savings percentage
}

// Cable TV plan structure
export interface CablePlan {
  id: string;
  provider: CableProvider;
  planCode: string;
  name: string;
  price: number;
  apiPrice: number;
  sellingPrice: number;
  profit: number;
  duration: string;
}

// Electricity DISCO info
export interface DiscoInfo {
  id: DiscoType;
  name: string;
  code: string;
}

// Exam PIN info
export interface ExamPinInfo {
  type: ExamType;
  name: string;
  apiPrice: number;
  sellingPrice: number;
  profit: number;
}

// ============================================
// DATA PLANS - Competitive Pricing from Inlomax
// ============================================

// MTN Data Plans - Various types (SME, Direct, CG, Social, Awoof)
const MTN_DATA_PLANS: Omit<DataPlan, 'sellingPrice' | 'profit' | 'savingsAmount' | 'savingsPercentage'>[] = [
  // SME Plans - Most affordable
  { id: "mtn_sme_500mb", network: "mtn", planType: "sme", planCode: "500", name: "MTN 500MB SME", dataAmount: "500MB", validity: "30 days", apiPrice: 140, marketPrice: 180 },
  { id: "mtn_sme_1gb", network: "mtn", planType: "sme", planCode: "M1024", name: "MTN 1GB SME", dataAmount: "1GB", validity: "30 days", apiPrice: 260, marketPrice: 350 },
  { id: "mtn_sme_2gb", network: "mtn", planType: "sme", planCode: "M2024", name: "MTN 2GB SME", dataAmount: "2GB", validity: "30 days", apiPrice: 520, marketPrice: 700 },
  { id: "mtn_sme_3gb", network: "mtn", planType: "sme", planCode: "3000", name: "MTN 3GB SME", dataAmount: "3GB", validity: "30 days", apiPrice: 780, marketPrice: 1000 },
  { id: "mtn_sme_5gb", network: "mtn", planType: "sme", planCode: "5000", name: "MTN 5GB SME", dataAmount: "5GB", validity: "30 days", apiPrice: 1300, marketPrice: 1800 },
  { id: "mtn_sme_10gb", network: "mtn", planType: "sme", planCode: "10000", name: "MTN 10GB SME", dataAmount: "10GB", validity: "30 days", apiPrice: 2600, marketPrice: 3500 },
  
  // Direct/Gifting Plans
  { id: "mtn_direct_500mb_7d", network: "mtn", planType: "direct", planCode: "500-7", name: "MTN 500MB Direct", dataAmount: "500MB", validity: "7 days", apiPrice: 380, marketPrice: 400 },
  { id: "mtn_direct_1gb_7d", network: "mtn", planType: "direct", planCode: "1024-7", name: "MTN 1GB Direct", dataAmount: "1GB", validity: "7 days", apiPrice: 460, marketPrice: 550 },
  { id: "mtn_direct_2gb_30d", network: "mtn", planType: "direct", planCode: "2048-30", name: "MTN 2GB Direct", dataAmount: "2GB", validity: "30 days", apiPrice: 1030, marketPrice: 1100 },
  { id: "mtn_direct_3gb_30d", network: "mtn", planType: "direct", planCode: "3072-30", name: "MTN 3GB Direct", dataAmount: "3GB", validity: "30 days", apiPrice: 1530, marketPrice: 1600 },
  { id: "mtn_direct_5gb_30d", network: "mtn", planType: "direct", planCode: "5120-30", name: "MTN 5GB Direct", dataAmount: "5GB", validity: "30 days", apiPrice: 1950, marketPrice: 2500 },
  { id: "mtn_direct_10gb_30d", network: "mtn", planType: "direct", planCode: "10240-30", name: "MTN 10GB Direct", dataAmount: "10GB", validity: "30 days", apiPrice: 3500, marketPrice: 4000 },
  
  // Corporate Gifting (CG) Plans
  { id: "mtn_cg_1gb", network: "mtn", planType: "cg", planCode: "CG1024", name: "MTN 1GB CG", dataAmount: "1GB", validity: "30 days", apiPrice: 280, marketPrice: 400 },
  { id: "mtn_cg_2gb", network: "mtn", planType: "cg", planCode: "CG2048", name: "MTN 2GB CG", dataAmount: "2GB", validity: "30 days", apiPrice: 560, marketPrice: 800 },
  { id: "mtn_cg_5gb", network: "mtn", planType: "cg", planCode: "CG5120", name: "MTN 5GB CG", dataAmount: "5GB", validity: "30 days", apiPrice: 1400, marketPrice: 2000 },
];

// GLO Data Plans
const GLO_DATA_PLANS: Omit<DataPlan, 'sellingPrice' | 'profit' | 'savingsAmount' | 'savingsPercentage'>[] = [
  { id: "glo_cg_500mb", network: "glo", planType: "cg", planCode: "G500", name: "GLO 500MB CG", dataAmount: "500MB", validity: "30 days", apiPrice: 130, marketPrice: 200 },
  { id: "glo_cg_1gb", network: "glo", planType: "cg", planCode: "G1024", name: "GLO 1GB CG", dataAmount: "1GB", validity: "30 days", apiPrice: 260, marketPrice: 400 },
  { id: "glo_cg_2gb", network: "glo", planType: "cg", planCode: "G2048", name: "GLO 2GB CG", dataAmount: "2GB", validity: "30 days", apiPrice: 520, marketPrice: 800 },
  { id: "glo_cg_3gb", network: "glo", planType: "cg", planCode: "G3072", name: "GLO 3GB CG", dataAmount: "3GB", validity: "30 days", apiPrice: 780, marketPrice: 1100 },
  { id: "glo_cg_5gb", network: "glo", planType: "cg", planCode: "G5120", name: "GLO 5GB CG", dataAmount: "5GB", validity: "30 days", apiPrice: 1300, marketPrice: 1800 },
  { id: "glo_cg_10gb", network: "glo", planType: "cg", planCode: "G10240", name: "GLO 10GB CG", dataAmount: "10GB", validity: "30 days", apiPrice: 2600, marketPrice: 3500 },
  
  // Direct Plans
  { id: "glo_direct_1gb_7d", network: "glo", planType: "direct", planCode: "GD1024-7", name: "GLO 1GB Direct", dataAmount: "1GB", validity: "7 days", apiPrice: 410, marketPrice: 500 },
  { id: "glo_direct_2gb_30d", network: "glo", planType: "direct", planCode: "GD2048-30", name: "GLO 2GB Direct", dataAmount: "2GB", validity: "30 days", apiPrice: 1000, marketPrice: 1200 },
];

// Airtel Data Plans
const AIRTEL_DATA_PLANS: Omit<DataPlan, 'sellingPrice' | 'profit' | 'savingsAmount' | 'savingsPercentage'>[] = [
  { id: "airtel_cg_500mb", network: "airtel", planType: "cg", planCode: "A500", name: "Airtel 500MB CG", dataAmount: "500MB", validity: "30 days", apiPrice: 140, marketPrice: 200 },
  { id: "airtel_cg_1gb", network: "airtel", planType: "cg", planCode: "A1024", name: "Airtel 1GB CG", dataAmount: "1GB", validity: "30 days", apiPrice: 280, marketPrice: 400 },
  { id: "airtel_cg_2gb", network: "airtel", planType: "cg", planCode: "A2048", name: "Airtel 2GB CG", dataAmount: "2GB", validity: "30 days", apiPrice: 560, marketPrice: 800 },
  { id: "airtel_cg_5gb", network: "airtel", planType: "cg", planCode: "A5120", name: "Airtel 5GB CG", dataAmount: "5GB", validity: "30 days", apiPrice: 1400, marketPrice: 2000 },
  { id: "airtel_cg_10gb", network: "airtel", planType: "cg", planCode: "A10240", name: "Airtel 10GB CG", dataAmount: "10GB", validity: "30 days", apiPrice: 2800, marketPrice: 4000 },
  
  // Direct Plans  
  { id: "airtel_direct_2gb_30d", network: "airtel", planType: "direct", planCode: "AD2048-30", name: "Airtel 2GB Direct", dataAmount: "2GB", validity: "30 days", apiPrice: 1470, marketPrice: 1500 },
  { id: "airtel_direct_5gb_30d", network: "airtel", planType: "direct", planCode: "AD5120-30", name: "Airtel 5GB Direct", dataAmount: "5GB", validity: "30 days", apiPrice: 2450, marketPrice: 2700 },
  { id: "airtel_direct_10gb_30d", network: "airtel", planType: "direct", planCode: "AD10240-30", name: "Airtel 10GB Direct", dataAmount: "10GB", validity: "30 days", apiPrice: 3920, marketPrice: 4000 },
];

// 9Mobile Data Plans
const NINMOBILE_DATA_PLANS: Omit<DataPlan, 'sellingPrice' | 'profit' | 'savingsAmount' | 'savingsPercentage'>[] = [
  { id: "9mobile_500mb", network: "9mobile", planType: "direct", planCode: "9M500", name: "9Mobile 500MB", dataAmount: "500MB", validity: "30 days", apiPrice: 150, marketPrice: 200 },
  { id: "9mobile_1gb", network: "9mobile", planType: "direct", planCode: "9M1024", name: "9Mobile 1GB", dataAmount: "1GB", validity: "30 days", apiPrice: 300, marketPrice: 400 },
  { id: "9mobile_1_5gb", network: "9mobile", planType: "direct", planCode: "9M1536", name: "9Mobile 1.5GB", dataAmount: "1.5GB", validity: "30 days", apiPrice: 450, marketPrice: 600 },
  { id: "9mobile_2gb", network: "9mobile", planType: "direct", planCode: "9M2048", name: "9Mobile 2GB", dataAmount: "2GB", validity: "30 days", apiPrice: 600, marketPrice: 800 },
  { id: "9mobile_3gb", network: "9mobile", planType: "direct", planCode: "9M3072", name: "9Mobile 3GB", dataAmount: "3GB", validity: "30 days", apiPrice: 900, marketPrice: 1200 },
  { id: "9mobile_4_5gb", network: "9mobile", planType: "direct", planCode: "9M4608", name: "9Mobile 4.5GB", dataAmount: "4.5GB", validity: "30 days", apiPrice: 1200, marketPrice: 1600 },
  { id: "9mobile_11gb", network: "9mobile", planType: "direct", planCode: "9M11264", name: "9Mobile 11GB", dataAmount: "11GB", validity: "30 days", apiPrice: 2800, marketPrice: 3500 },
  { id: "9mobile_15gb", network: "9mobile", planType: "direct", planCode: "9M15360", name: "9Mobile 15GB", dataAmount: "15GB", validity: "30 days", apiPrice: 3800, marketPrice: 4500 },
];

// Combine all base plans
const ALL_BASE_DATA_PLANS = [
  ...MTN_DATA_PLANS,
  ...GLO_DATA_PLANS,
  ...AIRTEL_DATA_PLANS,
  ...NINMOBILE_DATA_PLANS,
];

// ============================================
// CABLE TV PLANS
// ============================================

const DSTV_PLANS: Omit<CablePlan, 'sellingPrice' | 'profit'>[] = [
  { id: "dstv_padi", provider: "dstv", planCode: "DSTV-PADI", name: "DStv Padi", price: 2500, apiPrice: 2400, duration: "1 Month" },
  { id: "dstv_yanga", provider: "dstv", planCode: "DSTV-YANGA", name: "DStv Yanga", price: 3500, apiPrice: 3350, duration: "1 Month" },
  { id: "dstv_confam", provider: "dstv", planCode: "DSTV-CONFAM", name: "DStv Confam", price: 6200, apiPrice: 6050, duration: "1 Month" },
  { id: "dstv_compact", provider: "dstv", planCode: "DSTV-COMPACT", name: "DStv Compact", price: 10500, apiPrice: 10300, duration: "1 Month" },
  { id: "dstv_compact_plus", provider: "dstv", planCode: "DSTV-COMPACTPLUS", name: "DStv Compact Plus", price: 16600, apiPrice: 16400, duration: "1 Month" },
  { id: "dstv_premium", provider: "dstv", planCode: "DSTV-PREMIUM", name: "DStv Premium", price: 24500, apiPrice: 24200, duration: "1 Month" },
];

const GOTV_PLANS: Omit<CablePlan, 'sellingPrice' | 'profit'>[] = [
  { id: "gotv_smallie", provider: "gotv", planCode: "GOTV-SMALLIE", name: "GOtv Smallie", price: 1100, apiPrice: 1000, duration: "1 Month" },
  { id: "gotv_jinja", provider: "gotv", planCode: "GOTV-JINJA", name: "GOtv Jinja", price: 2250, apiPrice: 2150, duration: "1 Month" },
  { id: "gotv_jolli", provider: "gotv", planCode: "GOTV-JOLLI", name: "GOtv Jolli", price: 3300, apiPrice: 3200, duration: "1 Month" },
  { id: "gotv_max", provider: "gotv", planCode: "GOTV-MAX", name: "GOtv Max", price: 4850, apiPrice: 4700, duration: "1 Month" },
  { id: "gotv_supa", provider: "gotv", planCode: "GOTV-SUPA", name: "GOtv Supa", price: 6400, apiPrice: 6250, duration: "1 Month" },
];

const STARTIMES_PLANS: Omit<CablePlan, 'sellingPrice' | 'profit'>[] = [
  { id: "startimes_nova", provider: "startimes", planCode: "STAR-NOVA", name: "StarTimes Nova", price: 1200, apiPrice: 1100, duration: "1 Month" },
  { id: "startimes_basic", provider: "startimes", planCode: "STAR-BASIC", name: "StarTimes Basic", price: 1900, apiPrice: 1800, duration: "1 Month" },
  { id: "startimes_smart", provider: "startimes", planCode: "STAR-SMART", name: "StarTimes Smart", price: 2800, apiPrice: 2700, duration: "1 Month" },
  { id: "startimes_classic", provider: "startimes", planCode: "STAR-CLASSIC", name: "StarTimes Classic", price: 2800, apiPrice: 2700, duration: "1 Month" },
  { id: "startimes_super", provider: "startimes", planCode: "STAR-SUPER", name: "StarTimes Super", price: 4900, apiPrice: 4750, duration: "1 Month" },
];

const ALL_CABLE_PLANS = [...DSTV_PLANS, ...GOTV_PLANS, ...STARTIMES_PLANS];

// ============================================
// ELECTRICITY DISCOS
// ============================================

export const DISCOS: DiscoInfo[] = [
  { id: "ikeja", name: "Ikeja Electric (IKEDC)", code: "IKEDC" },
  { id: "eko", name: "Eko Electricity (EKEDC)", code: "EKEDC" },
  { id: "ibadan", name: "Ibadan Electricity (IBEDC)", code: "IBEDC" },
  { id: "kaduna", name: "Kaduna Electric (KAEDC)", code: "KAEDC" },
  { id: "kano", name: "Kano Electricity (KEDC)", code: "KEDCO" },
  { id: "jos", name: "Jos Electricity (JED)", code: "JEDC" },
  { id: "enugu", name: "Enugu Electricity (EEDC)", code: "EEDC" },
  { id: "abuja", name: "Abuja Electricity (AEDC)", code: "AEDC" },
  { id: "portharcourt", name: "Port Harcourt Electric (PHED)", code: "PHED" },
  { id: "benin", name: "Benin Electricity (BEDC)", code: "BEDC" },
  { id: "yola", name: "Yola Electricity (YEDC)", code: "YEDC" },
  { id: "aba", name: "Aba Power (APLE)", code: "APLE" },
];

// ============================================
// EXAM PINS
// ============================================

export const EXAM_PINS: ExamPinInfo[] = [
  { type: "waec", name: "WAEC Result Checker", apiPrice: 3370, sellingPrice: 3400, profit: 30 },
  { type: "neco", name: "NECO Result Checker", apiPrice: 1280, sellingPrice: 1310, profit: 30 },
  { type: "nabteb", name: "NABTEB Result Checker", apiPrice: 890, sellingPrice: 920, profit: 30 },
];

// ============================================
// PRICING CALCULATIONS
// ============================================

// Calculate selling price with competitive margin
function calculateDataPricing(plan: Omit<DataPlan, 'sellingPrice' | 'profit' | 'savingsAmount' | 'savingsPercentage'>): DataPlan {
  // Set selling price between API price + min profit and market price
  // Goal: Cheaper than market, but profitable
  const minPrice = plan.apiPrice + PROFIT_MARGINS.data.min;
  const maxPrice = plan.marketPrice - 10; // Always at least 10 naira cheaper than market
  
  // Price should be closer to market but still profitable
  const sellingPrice = Math.min(maxPrice, Math.round(plan.apiPrice * 1.05 + 15)); // 5% markup + 15 naira
  const profit = sellingPrice - plan.apiPrice;
  const savingsAmount = plan.marketPrice - sellingPrice;
  const savingsPercentage = Math.round((savingsAmount / plan.marketPrice) * 100);
  
  return {
    ...plan,
    sellingPrice,
    profit,
    savingsAmount,
    savingsPercentage,
  };
}

function calculateCablePricing(plan: Omit<CablePlan, 'sellingPrice' | 'profit'>): CablePlan {
  const sellingPrice = plan.apiPrice + 50; // 50 naira profit
  const profit = sellingPrice - plan.apiPrice;
  return { ...plan, sellingPrice, profit };
}

// ============================================
// PLAN GETTERS
// ============================================

export function getAllDataPlans(): DataPlan[] {
  return ALL_BASE_DATA_PLANS.map(calculateDataPricing);
}

export function getDataPlansByNetwork(network: NetworkType): DataPlan[] {
  return getAllDataPlans().filter(plan => plan.network === network);
}

export function getDataPlansByType(planType: DataPlanType): DataPlan[] {
  return getAllDataPlans().filter(plan => plan.planType === planType);
}

export function getDataPlanById(planId: string): DataPlan | undefined {
  return getAllDataPlans().find(plan => plan.id === planId);
}

export function getAllCablePlans(): CablePlan[] {
  return ALL_CABLE_PLANS.map(calculateCablePricing);
}

export function getCablePlansByProvider(provider: CableProvider): CablePlan[] {
  return getAllCablePlans().filter(plan => plan.provider === provider);
}

export function getCablePlanById(planId: string): CablePlan | undefined {
  return getAllCablePlans().find(plan => plan.id === planId);
}

export function getExamPins(): ExamPinInfo[] {
  return EXAM_PINS;
}

export function getExamPinByType(type: ExamType): ExamPinInfo | undefined {
  return EXAM_PINS.find(pin => pin.type === type);
}

export function getDiscos(): DiscoInfo[] {
  return DISCOS;
}

export function getDiscoById(id: DiscoType): DiscoInfo | undefined {
  return DISCOS.find(disco => disco.id === id);
}

// ============================================
// PHONE NUMBER UTILITIES
// ============================================

const MTN_PREFIXES = ["0803", "0806", "0703", "0704", "0706", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916", "0702"];
const GLO_PREFIXES = ["0805", "0807", "0705", "0815", "0811", "0905", "0915"];
const AIRTEL_PREFIXES = ["0802", "0808", "0708", "0812", "0701", "0902", "0901", "0907", "0912"];
const NINMOBILE_PREFIXES = ["0809", "0817", "0818", "0908", "0909"];

const ALL_PREFIXES = [...MTN_PREFIXES, ...GLO_PREFIXES, ...AIRTEL_PREFIXES, ...NINMOBILE_PREFIXES];

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

export function isValidNigerianPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length !== 11 || !normalized.startsWith("0")) {
    return false;
  }
  const prefix = normalized.substring(0, 4);
  return ALL_PREFIXES.includes(prefix);
}

export function detectNetwork(phone: string): NetworkType | null {
  const normalized = normalizePhoneNumber(phone);
  const prefix = normalized.substring(0, 4);
  
  if (MTN_PREFIXES.includes(prefix)) return "mtn";
  if (GLO_PREFIXES.includes(prefix)) return "glo";
  if (AIRTEL_PREFIXES.includes(prefix)) return "airtel";
  if (NINMOBILE_PREFIXES.includes(prefix)) return "9mobile";
  
  return null;
}

// ============================================
// API CONFIGURATION CHECK
// ============================================

export function isInlomaxConfigured(): boolean {
  return !!INLOMAX_API_KEY && INLOMAX_API_KEY !== "";
}

// ============================================
// API CALLS
// ============================================

// Generic API request handler
async function makeInlomaxRequest(endpoint: string, params: Record<string, string>): Promise<InlomaxResponse> {
  if (!isInlomaxConfigured()) {
    return {
      success: false,
      message: "VTU service is not configured. Please contact support.",
      error: "API_NOT_CONFIGURED",
    };
  }

  try {
    const url = new URL(`${INLOMAX_BASE_URL}/${endpoint}`);
    url.searchParams.append("api_key", INLOMAX_API_KEY);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    console.log(`[Inlomax] Request: ${endpoint}`, { ...params, api_key: "***" });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });

    const data = await response.json();
    console.log(`[Inlomax] Response:`, JSON.stringify(data));

    const isSuccess = data.status === "success" || data.code === "success" || data.success === true;

    return {
      success: isSuccess,
      message: data.message || (isSuccess ? "Transaction successful" : "Transaction failed"),
      transactionId: data.transaction_id || data.trans_id || data.reference,
      reference: data.reference || data.order_id,
      data: data.data || data,
      token: data.token,
      error: isSuccess ? undefined : (data.message || data.error || "Unknown error"),
    };
  } catch (error: any) {
    console.error(`[Inlomax] Error:`, error);
    return {
      success: false,
      message: "Network error. Please try again.",
      error: error.message || "NETWORK_ERROR",
    };
  }
}

// Purchase Data
export async function purchaseData(
  network: NetworkType,
  phoneNumber: string,
  planCode: string
): Promise<InlomaxResponse> {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  return makeInlomaxRequest("data", {
    network,
    phone: normalizedPhone,
    plan: planCode,
  });
}

// Purchase Airtime
export async function purchaseAirtime(
  network: NetworkType,
  phoneNumber: string,
  amount: number
): Promise<InlomaxResponse> {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  return makeInlomaxRequest("airtime", {
    network,
    phone: normalizedPhone,
    amount: amount.toString(),
  });
}

// Validate Smart Card / IUC Number
export async function validateSmartCard(
  provider: CableProvider,
  smartCardNumber: string
): Promise<InlomaxResponse> {
  return makeInlomaxRequest("cable/validate", {
    provider,
    smartcard: smartCardNumber,
  });
}

// Subscribe Cable TV
export async function subscribeCableTV(
  provider: CableProvider,
  smartCardNumber: string,
  planCode: string
): Promise<InlomaxResponse> {
  return makeInlomaxRequest("cable/subscribe", {
    provider,
    smartcard: smartCardNumber,
    plan: planCode,
  });
}

// Validate Meter Number
export async function validateMeterNumber(
  disco: DiscoType,
  meterNumber: string,
  meterType: "prepaid" | "postpaid"
): Promise<InlomaxResponse> {
  return makeInlomaxRequest("electricity/validate", {
    disco,
    meter: meterNumber,
    type: meterType,
  });
}

// Pay Electricity Bill
export async function payElectricityBill(
  disco: DiscoType,
  meterNumber: string,
  meterType: "prepaid" | "postpaid",
  amount: number,
  customerName: string
): Promise<InlomaxResponse> {
  return makeInlomaxRequest("electricity/pay", {
    disco,
    meter: meterNumber,
    type: meterType,
    amount: amount.toString(),
    customer_name: customerName,
  });
}

// Purchase Exam PIN
export async function purchaseExamPin(
  examType: ExamType,
  quantity: number = 1
): Promise<InlomaxResponse> {
  return makeInlomaxRequest("education/exam", {
    exam: examType,
    quantity: quantity.toString(),
  });
}

// Check Transaction Status
export async function checkTransactionStatus(transactionId: string): Promise<InlomaxResponse> {
  return makeInlomaxRequest("transaction/status", {
    transaction_id: transactionId,
  });
}

// Get Wallet Balance (API balance)
export async function getApiBalance(): Promise<InlomaxResponse> {
  return makeInlomaxRequest("balance", {});
}

// ============================================
// NETWORK DISPLAY INFO
// ============================================

export const NETWORK_INFO: Record<NetworkType, {
  name: string;
  displayName: string;
  color: string;
  bgColor: string;
  textColor: string;
  airtimeDiscount: number;
}> = {
  mtn: {
    name: "MTN",
    displayName: "MTN",
    color: "bg-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    textColor: "text-yellow-700 dark:text-yellow-300",
    airtimeDiscount: 0.025, // 2.5%
  },
  glo: {
    name: "GLO",
    displayName: "GLO",
    color: "bg-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-700 dark:text-green-300",
    airtimeDiscount: 0.04, // 4%
  },
  airtel: {
    name: "Airtel",
    displayName: "Airtel",
    color: "bg-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    textColor: "text-red-700 dark:text-red-300",
    airtimeDiscount: 0.025, // 2.5%
  },
  "9mobile": {
    name: "9mobile",
    displayName: "9mobile",
    color: "bg-green-500",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    textColor: "text-emerald-700 dark:text-emerald-300",
    airtimeDiscount: 0.04, // 4%
  },
};

export const CABLE_PROVIDER_INFO: Record<CableProvider, {
  name: string;
  displayName: string;
  color: string;
  bgColor: string;
  textColor: string;
}> = {
  dstv: {
    name: "DStv",
    displayName: "DStv",
    color: "bg-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-700 dark:text-blue-300",
  },
  gotv: {
    name: "GOtv",
    displayName: "GOtv",
    color: "bg-orange-500",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    textColor: "text-orange-700 dark:text-orange-300",
  },
  startimes: {
    name: "StarTimes",
    displayName: "StarTimes",
    color: "bg-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    textColor: "text-red-700 dark:text-red-300",
  },
};

// ============================================
// DISCOUNT/SAVINGS INFO
// ============================================

export function getDiscountInfo(): {
  description: string;
  averageSavings: string;
} {
  return {
    description: "Save up to 15% on all data purchases compared to network prices",
    averageSavings: "Up to 15%",
  };
}

export function calculateSavings(marketPrice: number, ourPrice: number): {
  savingsAmount: number;
  savingsPercentage: number;
  formattedSavings: string;
} {
  const savingsAmount = marketPrice - ourPrice;
  const savingsPercentage = Math.round((savingsAmount / marketPrice) * 100);
  return {
    savingsAmount,
    savingsPercentage,
    formattedSavings: `${savingsPercentage}% OFF`,
  };
}

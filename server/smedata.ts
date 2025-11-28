// SMEDATA.NG API Integration for VTU Data Sales
// API Documentation: https://smedata.ng/api-documentation
// Correct endpoint: https://smedata.ng/wp-json/api/v1/

const SMEDATA_BASE_URL = "https://smedata.ng/wp-json/api/v1";
const SME_API_KEY = process.env.SME_API || "";

interface SMEDataResponse {
  success: boolean;
  message: string;
  data?: any;
  reference?: string;
  error?: string;
}

interface DataPurchaseRequest {
  network: string;
  phone: string;
  plan_code: string;
  bypass?: boolean;
}

interface NINVerificationRequest {
  nin: string;
  firstname: string;
  lastname: string;
  dob: string; // YYYY-MM-DD format
}

interface NINVerificationResponse {
  success: boolean;
  message: string;
  data?: {
    nin: string;
    firstname: string;
    middlename?: string;
    surname: string;
    birthdate: string;
    gender: string;
    phone?: string;
    photo?: string; // Base64 encoded photo
    vnin?: string;
  };
  error?: string;
}

// SME Data API Plan structure
export interface SMEDataPlan {
  network: string;
  size: string;
  validity: string;
  price: number;
  planCode?: string;
}

// Parsed VTU Plan for database storage
export interface ParsedVtuPlan {
  network: "mtn_sme" | "glo_cg" | "airtel_cg" | "9mobile";
  planName: string;
  dataAmount: string;
  validity: string;
  costPrice: string;
  sellingPrice: string;
  planCode: string;
  isActive: boolean;
  sortOrder: number;
}

// Network mapping for SMEDATA API
const NETWORK_MAP: Record<string, string> = {
  mtn_sme: "MTN",
  glo_cg: "GLO",
  airtel_cg: "AIRTEL",
  "9mobile": "9MOBILE",
};

// Reverse network mapping (API response to our enum)
const NETWORK_REVERSE_MAP: Record<string, "mtn_sme" | "glo_cg" | "airtel_cg" | "9mobile"> = {
  MTN: "mtn_sme",
  GLO: "glo_cg",
  AIRTEL: "airtel_cg",
  "9MOBILE": "9mobile",
  ETISALAT: "9mobile",
};

// Check if SMEDATA API is configured
export function isSMEDataConfigured(): boolean {
  return !!SME_API_KEY && SME_API_KEY !== "";
}

// Get wallet balance from SMEDATA
export async function getSMEDataBalance(): Promise<{ balance: number; success: boolean }> {
  if (!isSMEDataConfigured()) {
    return { balance: 0, success: false };
  }

  try {
    // SME Data API uses token parameter instead of Bearer header
    const response = await fetch(`${SMEDATA_BASE_URL}/user?token=${encodeURIComponent(SME_API_KEY)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    
    if (data.success || data.status === "success") {
      return { balance: parseFloat(data.data?.balance || data.balance || "0"), success: true };
    }
    
    return { balance: 0, success: false };
  } catch (error) {
    console.error("SMEDATA balance check error:", error);
    return { balance: 0, success: false };
  }
}

// Purchase data from SMEDATA using GET method with token parameter
// API docs: https://smedata.ng/mtn-sme-data-api-documentation-for-developers/
export async function purchaseData(
  network: string,
  phoneNumber: string,
  dataSize: string // Data size like "1GB", "500MB", "2GB" etc.
): Promise<SMEDataResponse> {
  if (!isSMEDataConfigured()) {
    return {
      success: false,
      message: "VTU service is not configured. Please contact support.",
      error: "API_NOT_CONFIGURED",
    };
  }

  // Normalize phone number (remove country code, add 0 prefix if needed)
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  // Map our network to SMEDATA network (uppercase for API)
  const smedataNetwork = network === "mtn_sme" ? "MTN" : 
                         network === "glo_cg" ? "GLO" :
                         network === "airtel_cg" ? "AIRTEL" :
                         network === "9mobile" ? "9MOBILE" :
                         network.toUpperCase();

  try {
    // SME Data API uses GET method with size parameter
    const params = new URLSearchParams({
      token: SME_API_KEY,
      network: smedataNetwork,
      phone: normalizedPhone,
      size: dataSize.toUpperCase(), // e.g., "1GB", "500MB"
    });

    console.log("SME Data API Request:", `${SMEDATA_BASE_URL}/data?${params.toString().replace(SME_API_KEY, "***")}`);

    const response = await fetch(`${SMEDATA_BASE_URL}/data?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    console.log("SME Data API Response:", JSON.stringify(data));
    
    const isSuccess = data.code === "success" || data.success || data.status === "success";
    
    return {
      success: isSuccess,
      message: data.message || (isSuccess ? "Data purchase successful" : "Data purchase failed"),
      reference: data.data?.order_id?.toString() || data.reference || data.transid,
      data: data.data || data,
      error: isSuccess ? undefined : (data.message || data.error),
    };
  } catch (error: any) {
    console.error("SMEDATA purchase error:", error);
    return {
      success: false,
      message: "Failed to process data purchase. Please try again.",
      error: error.message || "NETWORK_ERROR",
    };
  }
}

// Verify NIN and get photo for KYC
export async function verifyNIN(
  nin: string,
  firstName: string,
  lastName: string,
  dateOfBirth: string
): Promise<NINVerificationResponse> {
  if (!isSMEDataConfigured()) {
    return {
      success: false,
      message: "KYC service is not configured. Please contact support.",
      error: "API_NOT_CONFIGURED",
    };
  }

  try {
    const response = await fetch(`${SMEDATA_BASE_URL}/kyc/nin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SME_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nin: nin,
        firstname: firstName,
        lastname: lastName,
        dob: dateOfBirth,
      } as NINVerificationRequest),
    });

    const data = await response.json();
    
    if (data.success || data.status === "success") {
      return {
        success: true,
        message: "NIN verification successful",
        data: data.data,
      };
    }

    return {
      success: false,
      message: data.message || "NIN verification failed",
      error: data.error || "VERIFICATION_FAILED",
    };
  } catch (error: any) {
    console.error("SMEDATA NIN verification error:", error);
    return {
      success: false,
      message: "Failed to verify NIN. Please try again.",
      error: error.message || "NETWORK_ERROR",
    };
  }
}

// NOTE: SMEDATA.NG API does NOT have a /plans endpoint to fetch available plans
// Plans must be predefined in the database and managed by admin
// The API only supports direct purchases via /data endpoint with size parameter
// Reference: https://smedata.ng/mtn-sme-data-api-documentation-for-developers/

// Check order status via requery endpoint
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

    return {
      success: data.code === "success",
      message: data.message || "Order status retrieved",
      data: data.data,
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

// Helper function to normalize Nigerian phone numbers
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");
  
  // Handle different formats
  if (cleaned.startsWith("234")) {
    // Remove country code and add 0
    cleaned = "0" + cleaned.substring(3);
  } else if (cleaned.startsWith("+234")) {
    cleaned = "0" + cleaned.substring(4);
  } else if (!cleaned.startsWith("0") && cleaned.length === 10) {
    // Add leading 0 if missing
    cleaned = "0" + cleaned;
  }
  
  return cleaned;
}

// Complete Nigerian mobile phone prefixes (updated 2024)
const MTN_PREFIXES = [
  "0803", "0806", "0703", "0704", "0706", "0810", "0813", "0814", "0816",
  "0903", "0906", "0913", "0916", "0702"
];
const GLO_PREFIXES = ["0805", "0807", "0705", "0815", "0811", "0905", "0915"];
const AIRTEL_PREFIXES = ["0802", "0808", "0708", "0812", "0701", "0902", "0901", "0907", "0912"];
const NINE_MOBILE_PREFIXES = ["0809", "0818", "0817", "0909", "0908"];

const ALL_VALID_PREFIXES = [
  ...MTN_PREFIXES,
  ...GLO_PREFIXES,
  ...AIRTEL_PREFIXES,
  ...NINE_MOBILE_PREFIXES,
];

// Validate Nigerian phone number
export function isValidNigerianPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Nigerian numbers are 11 digits starting with 0
  if (normalized.length !== 11 || !normalized.startsWith("0")) {
    return false;
  }
  
  const prefix = normalized.substring(0, 4);
  return ALL_VALID_PREFIXES.includes(prefix);
}

// Detect network from phone number
export function detectNetwork(phone: string): string | null {
  const normalized = normalizePhoneNumber(phone);
  const prefix = normalized.substring(0, 4);
  
  if (MTN_PREFIXES.includes(prefix)) return "mtn_sme";
  if (GLO_PREFIXES.includes(prefix)) return "glo_cg";
  if (AIRTEL_PREFIXES.includes(prefix)) return "airtel_cg";
  if (NINE_MOBILE_PREFIXES.includes(prefix)) return "9mobile";
  
  return null;
}

// Purchase airtime from SMEDATA
export async function purchaseAirtime(
  network: string,
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
  const smedataNetwork = NETWORK_MAP[network] || network.toUpperCase();

  try {
    const response = await fetch(`${SMEDATA_BASE_URL}/airtime`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SME_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        network: smedataNetwork,
        phone: normalizedPhone,
        amount: amount,
      }),
    });

    const data = await response.json();
    
    return {
      success: data.success || data.status === "success",
      message: data.message || "Airtime purchase processed",
      reference: data.reference || data.data?.reference,
      data: data.data,
      error: data.error,
    };
  } catch (error: any) {
    console.error("SMEDATA airtime purchase error:", error);
    return {
      success: false,
      message: "Failed to process airtime purchase. Please try again.",
      error: error.message || "NETWORK_ERROR",
    };
  }
}

// ===========================================
// BILL PAYMENTS (Cable TV & Electricity)
// ===========================================

// Service type mapping for SMEDATA API
const BILL_SERVICE_MAP: Record<string, { apiName: string; type: string }> = {
  // Cable TV
  dstv: { apiName: "dstv", type: "cable" },
  gotv: { apiName: "gotv", type: "cable" },
  startimes: { apiName: "startimes", type: "cable" },
  showmax: { apiName: "showmax", type: "cable" },
  // Electricity
  ekedc: { apiName: "ekedc", type: "electricity" },
  ikedc: { apiName: "ikedc", type: "electricity" },
  aedc: { apiName: "aedc", type: "electricity" },
  ibedc: { apiName: "ibedc", type: "electricity" },
  phedc: { apiName: "phedc", type: "electricity" },
  eedc: { apiName: "eedc", type: "electricity" },
};

interface CustomerValidationResponse {
  success: boolean;
  message: string;
  data?: {
    customerName: string;
    customerId: string;
    accountStatus?: string;
    dueDate?: string;
    currentBalance?: number;
    meterType?: string; // prepaid or postpaid for electricity
  };
  error?: string;
}

interface BillPackage {
  code: string;
  name: string;
  amount: number;
  validity?: string;
}

interface BillPackagesResponse {
  success: boolean;
  message: string;
  packages?: BillPackage[];
  error?: string;
}

interface BillPaymentResponse {
  success: boolean;
  message: string;
  reference?: string;
  token?: string; // For electricity prepaid
  data?: any;
  error?: string;
}

// Validate decoder/meter number
export async function validateBillCustomer(
  serviceType: string,
  customerId: string
): Promise<CustomerValidationResponse> {
  if (!isSMEDataConfigured()) {
    return {
      success: false,
      message: "Bill payment service is not configured. Please contact support.",
      error: "API_NOT_CONFIGURED",
    };
  }

  const serviceInfo = BILL_SERVICE_MAP[serviceType];
  if (!serviceInfo) {
    return {
      success: false,
      message: "Invalid service type",
      error: "INVALID_SERVICE",
    };
  }

  try {
    const response = await fetch(`${SMEDATA_BASE_URL}/bills/validate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SME_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service: serviceInfo.apiName,
        customer_id: customerId,
      }),
    });

    const data = await response.json();
    
    if (data.success || data.status === "success") {
      return {
        success: true,
        message: "Customer validated successfully",
        data: {
          customerName: data.data?.customer_name || data.data?.name || "Customer",
          customerId: customerId,
          accountStatus: data.data?.status,
          dueDate: data.data?.due_date,
          currentBalance: data.data?.balance ? parseFloat(data.data.balance) : undefined,
          meterType: data.data?.meter_type,
        },
      };
    }

    return {
      success: false,
      message: data.message || "Customer validation failed",
      error: data.error || "VALIDATION_FAILED",
    };
  } catch (error: any) {
    console.error("SMEDATA bill validation error:", error);
    return {
      success: false,
      message: "Failed to validate customer. Please try again.",
      error: error.message || "NETWORK_ERROR",
    };
  }
}

// Get available packages for cable TV services
export async function getCablePackages(serviceType: string): Promise<BillPackagesResponse> {
  if (!isSMEDataConfigured()) {
    return {
      success: false,
      message: "Bill payment service is not configured.",
      error: "API_NOT_CONFIGURED",
    };
  }

  const serviceInfo = BILL_SERVICE_MAP[serviceType];
  if (!serviceInfo || serviceInfo.type !== "cable") {
    return {
      success: false,
      message: "Invalid cable service type",
      error: "INVALID_SERVICE",
    };
  }

  try {
    const response = await fetch(`${SMEDATA_BASE_URL}/bills/packages/${serviceInfo.apiName}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SME_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    
    if (data.success || data.status === "success" || data.data) {
      const packages: BillPackage[] = (data.data || data.packages || []).map((pkg: any) => ({
        code: pkg.code || pkg.plan_code || pkg.id,
        name: pkg.name || pkg.plan_name || pkg.description,
        amount: parseFloat(pkg.amount || pkg.price || "0"),
        validity: pkg.validity || pkg.duration,
      }));

      return {
        success: true,
        message: "Packages retrieved successfully",
        packages,
      };
    }

    return {
      success: false,
      message: data.message || "Failed to get packages",
      error: data.error || "FETCH_FAILED",
    };
  } catch (error: any) {
    console.error("SMEDATA get packages error:", error);
    return {
      success: false,
      message: "Failed to get packages. Please try again.",
      error: error.message || "NETWORK_ERROR",
    };
  }
}

// Process bill payment
export async function payBill(
  serviceType: string,
  customerId: string,
  amount: number,
  packageCode?: string
): Promise<BillPaymentResponse> {
  if (!isSMEDataConfigured()) {
    return {
      success: false,
      message: "Bill payment service is not configured. Please contact support.",
      error: "API_NOT_CONFIGURED",
    };
  }

  const serviceInfo = BILL_SERVICE_MAP[serviceType];
  if (!serviceInfo) {
    return {
      success: false,
      message: "Invalid service type",
      error: "INVALID_SERVICE",
    };
  }

  try {
    const requestBody: any = {
      service: serviceInfo.apiName,
      customer_id: customerId,
      amount: amount,
    };

    // Add package code for cable TV
    if (serviceInfo.type === "cable" && packageCode) {
      requestBody.package_code = packageCode;
    }

    const response = await fetch(`${SMEDATA_BASE_URL}/bills/pay`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SME_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    
    if (data.success || data.status === "success") {
      return {
        success: true,
        message: data.message || "Bill payment successful",
        reference: data.reference || data.data?.reference,
        token: data.data?.token, // For electricity prepaid
        data: data.data,
      };
    }

    return {
      success: false,
      message: data.message || "Bill payment failed",
      error: data.error || "PAYMENT_FAILED",
    };
  } catch (error: any) {
    console.error("SMEDATA bill payment error:", error);
    return {
      success: false,
      message: "Failed to process bill payment. Please try again.",
      error: error.message || "NETWORK_ERROR",
    };
  }
}

// Get bill service display info
export function getBillServiceInfo(serviceType: string): { name: string; type: string } | null {
  const serviceNames: Record<string, string> = {
    dstv: "DSTV",
    gotv: "GOtv",
    startimes: "StarTimes",
    showmax: "Showmax",
    ekedc: "Eko Electricity (EKEDC)",
    ikedc: "Ikeja Electricity (IKEDC)",
    aedc: "Abuja Electricity (AEDC)",
    ibedc: "Ibadan Electricity (IBEDC)",
    phedc: "Port Harcourt Electricity (PHEDC)",
    eedc: "Enugu Electricity (EEDC)",
  };

  const info = BILL_SERVICE_MAP[serviceType];
  if (!info) return null;

  return {
    name: serviceNames[serviceType] || serviceType.toUpperCase(),
    type: info.type,
  };
}

export { normalizePhoneNumber };

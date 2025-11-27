// SMEDATA.NG API Integration for VTU Data Sales
// API Documentation: https://smedata.ng/api-documentation

const SMEDATA_BASE_URL = "https://smedata.ng/api/v1";
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

// Network mapping for SMEDATA API
const NETWORK_MAP: Record<string, string> = {
  mtn_sme: "MTN",
  glo_cg: "GLO",
  airtel_cg: "AIRTEL",
  "9mobile": "9MOBILE",
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
    const response = await fetch(`${SMEDATA_BASE_URL}/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SME_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    
    if (data.success) {
      return { balance: parseFloat(data.data?.balance || "0"), success: true };
    }
    
    return { balance: 0, success: false };
  } catch (error) {
    console.error("SMEDATA balance check error:", error);
    return { balance: 0, success: false };
  }
}

// Purchase data from SMEDATA
export async function purchaseData(
  network: string,
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

  // Normalize phone number (remove country code, add 0 prefix if needed)
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  // Map our network to SMEDATA network
  const smedataNetwork = NETWORK_MAP[network] || network.toUpperCase();

  try {
    const response = await fetch(`${SMEDATA_BASE_URL}/data`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SME_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        network: smedataNetwork,
        phone: normalizedPhone,
        plan_code: planCode,
        bypass: false, // Don't bypass network validation
      } as DataPurchaseRequest),
    });

    const data = await response.json();
    
    return {
      success: data.success || data.status === "success",
      message: data.message || "Data purchase processed",
      reference: data.reference || data.data?.reference,
      data: data.data,
      error: data.error,
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

// Get available data plans from SMEDATA (for syncing)
export async function getAvailablePlans(): Promise<SMEDataResponse> {
  if (!isSMEDataConfigured()) {
    return {
      success: false,
      message: "API not configured",
    };
  }

  try {
    const response = await fetch(`${SMEDATA_BASE_URL}/plans`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SME_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return {
      success: true,
      message: "Plans retrieved",
      data: data.data || data,
    };
  } catch (error: any) {
    console.error("SMEDATA get plans error:", error);
    return {
      success: false,
      message: "Failed to get plans",
      error: error.message,
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

export { normalizePhoneNumber };

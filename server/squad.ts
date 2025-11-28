/**
 * Squad by Habari Payment Gateway Integration
 * 
 * This module handles all Squad API interactions including:
 * - Payment initialization (with instant bank transfer support)
 * - Transaction verification
 * - Disbursements (payouts)
 * - Webhook handling
 * 
 * Squad offers:
 * - Bank Transfer: Instant settlement (T+0) - RECOMMENDED
 * - Card Payments: Standard settlement (T+1)
 * - USSD: Standard settlement (T+1)
 */

import crypto from 'crypto';

// Squad API URL - use sandbox for testing, production for live
// The secret key prefix determines which environment: sk_test_ = sandbox, sk_live_ = production
const getSquadBaseUrl = (): string => {
  const secretKey = process.env.SQUAD_SECRET_KEY || '';
  // If using test key, use sandbox URL
  if (secretKey.startsWith('sk_test_') || secretKey.startsWith('sandbox_sk_')) {
    return 'https://sandbox-api-d.squadco.com';
  }
  return 'https://api.squadco.com';
};

const SQUAD_BASE_URL = getSquadBaseUrl();

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;

// Error types for better categorization
export enum SquadErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

// Custom error class for Squad API errors
export class SquadApiError extends Error {
  public readonly type: SquadErrorType;
  public readonly statusCode: number;
  public readonly rawError: any;
  public readonly userMessage: string;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    type: SquadErrorType,
    statusCode: number,
    rawError?: any,
    userMessage?: string
  ) {
    super(message);
    this.name = 'SquadApiError';
    this.type = type;
    this.statusCode = statusCode;
    this.rawError = rawError;
    this.userMessage = userMessage || getDefaultUserMessage(type);
    this.isRetryable = isRetryableError(type, statusCode);
  }
}

// Get user-friendly error message based on error type
function getDefaultUserMessage(type: SquadErrorType): string {
  switch (type) {
    case SquadErrorType.NETWORK_ERROR:
      return 'Unable to connect to payment service. Please check your internet connection and try again.';
    case SquadErrorType.TIMEOUT:
      return 'Payment request timed out. Please try again.';
    case SquadErrorType.INVALID_CREDENTIALS:
      return 'Payment service configuration error. Please contact support.';
    case SquadErrorType.INVALID_REQUEST:
      return 'Invalid payment details. Please check and try again.';
    case SquadErrorType.INSUFFICIENT_FUNDS:
      return 'Payment could not be processed due to insufficient funds.';
    case SquadErrorType.RATE_LIMITED:
      return 'Too many payment requests. Please wait a moment and try again.';
    case SquadErrorType.SERVER_ERROR:
      return 'Payment service is temporarily unavailable. Please try again later.';
    default:
      return 'An error occurred processing your payment. Please try again or contact support.';
  }
}

// Determine if an error is retryable
function isRetryableError(type: SquadErrorType, statusCode: number): boolean {
  // Retry on network errors, timeouts, rate limiting, and 5xx server errors
  if (type === SquadErrorType.NETWORK_ERROR || 
      type === SquadErrorType.TIMEOUT ||
      type === SquadErrorType.RATE_LIMITED ||
      type === SquadErrorType.SERVER_ERROR) {
    return true;
  }
  // Also retry on 502, 503, 504 status codes
  if (statusCode >= 500 && statusCode < 600) {
    return true;
  }
  return false;
}

// Parse error response from Squad API
function parseSquadError(response: Response, data: any): { type: SquadErrorType; message: string; userMessage?: string } {
  const status = response.status;
  const errorMessage = data?.message || data?.error || data?.error_message || '';
  const errorCode = data?.error_code || data?.code || '';
  
  // Log full error details for debugging
  console.error(`[Squad API] Full error response:`, {
    status,
    statusText: response.statusText,
    errorMessage,
    errorCode,
    data: JSON.stringify(data, null, 2),
  });

  // Categorize based on status code
  if (status === 401 || status === 403) {
    return {
      type: SquadErrorType.INVALID_CREDENTIALS,
      message: `Authentication failed: ${errorMessage}`,
      userMessage: 'Payment service authentication failed. Please contact support.',
    };
  }

  if (status === 400) {
    // Parse specific validation errors
    let details = errorMessage;
    if (data?.errors && typeof data.errors === 'object') {
      const errorDetails = Object.entries(data.errors)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join('; ');
      details = errorDetails || errorMessage;
    }
    return {
      type: SquadErrorType.INVALID_REQUEST,
      message: `Invalid request: ${details}`,
      userMessage: parseValidationError(data),
    };
  }

  if (status === 402 || errorMessage.toLowerCase().includes('insufficient')) {
    return {
      type: SquadErrorType.INSUFFICIENT_FUNDS,
      message: `Insufficient funds: ${errorMessage}`,
    };
  }

  if (status === 429) {
    return {
      type: SquadErrorType.RATE_LIMITED,
      message: 'Rate limited by Squad API',
    };
  }

  if (status >= 500) {
    return {
      type: SquadErrorType.SERVER_ERROR,
      message: `Squad server error (${status}): ${errorMessage}`,
    };
  }

  return {
    type: SquadErrorType.UNKNOWN,
    message: errorMessage || `HTTP ${status}: ${response.statusText}`,
  };
}

// Parse validation errors into user-friendly messages
function parseValidationError(data: any): string {
  if (data?.errors) {
    if (data.errors.email) return 'Please provide a valid email address.';
    if (data.errors.amount) return 'The payment amount is invalid.';
    if (data.errors.phone || data.errors.mobile_num) return 'Please provide a valid phone number.';
  }
  if (data?.message?.toLowerCase().includes('email')) {
    return 'Please provide a valid email address.';
  }
  if (data?.message?.toLowerCase().includes('amount')) {
    return 'The payment amount is invalid. Please check and try again.';
  }
  return 'Please check your payment details and try again.';
}

// Sleep function for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate exponential backoff delay
function getRetryDelay(attempt: number): number {
  const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * delay; // Add 0-30% jitter
  return Math.min(delay + jitter, MAX_RETRY_DELAY_MS);
}

export interface SquadCredentials {
  secretKey: string;
  publicKey: string;
}

function getCredentials(): SquadCredentials {
  const secretKey = process.env.SQUAD_SECRET_KEY;
  const publicKey = process.env.SQUAD_PUBLIC_KEY;

  if (!secretKey || !publicKey) {
    throw new SquadApiError(
      'Squad credentials not configured',
      SquadErrorType.INVALID_CREDENTIALS,
      500,
      null,
      'Payment service is not configured. Please contact support.'
    );
  }

  return { secretKey, publicKey };
}

/**
 * Make authenticated API request to Squad with retry logic
 */
async function squadRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  retryCount: number = 0
): Promise<T> {
  const { secretKey } = getCredentials();
  const baseUrl = getSquadBaseUrl();
  const requestId = crypto.randomBytes(4).toString('hex');

  console.log(`[Squad API] [${requestId}] ${method} ${baseUrl}${endpoint} (attempt ${retryCount + 1}/${MAX_RETRIES})`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error(`[Squad API] [${requestId}] Failed to parse response:`, parseError);
      throw new SquadApiError(
        'Invalid response from payment service',
        SquadErrorType.SERVER_ERROR,
        response.status
      );
    }

    console.log(`[Squad API] [${requestId}] Response status: ${response.status}, success: ${data.success}`);

    if (!response.ok || !data.success) {
      const { type, message, userMessage } = parseSquadError(response, data);
      const error = new SquadApiError(message, type, response.status, data, userMessage);
      
      // Retry if error is retryable and we haven't exceeded max retries
      if (error.isRetryable && retryCount < MAX_RETRIES - 1) {
        const delay = getRetryDelay(retryCount);
        console.log(`[Squad API] [${requestId}] Retryable error, waiting ${delay}ms before retry...`);
        await sleep(delay);
        return squadRequest<T>(endpoint, method, body, retryCount + 1);
      }
      
      throw error;
    }

    return data.data as T;
  } catch (error: any) {
    // Handle fetch errors (network, timeout, etc.)
    if (error instanceof SquadApiError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      const squadError = new SquadApiError(
        'Request timed out',
        SquadErrorType.TIMEOUT,
        0
      );
      
      if (squadError.isRetryable && retryCount < MAX_RETRIES - 1) {
        const delay = getRetryDelay(retryCount);
        console.log(`[Squad API] [${requestId}] Timeout, waiting ${delay}ms before retry...`);
        await sleep(delay);
        return squadRequest<T>(endpoint, method, body, retryCount + 1);
      }
      
      throw squadError;
    }

    // Network error
    const networkError = new SquadApiError(
      `Network error: ${error.message}`,
      SquadErrorType.NETWORK_ERROR,
      0,
      error
    );

    if (networkError.isRetryable && retryCount < MAX_RETRIES - 1) {
      const delay = getRetryDelay(retryCount);
      console.log(`[Squad API] [${requestId}] Network error, waiting ${delay}ms before retry...`);
      await sleep(delay);
      return squadRequest<T>(endpoint, method, body, retryCount + 1);
    }

    throw networkError;
  }
}

export interface InitializePaymentRequest {
  amount: number;
  email: string;
  currency?: string;
  initiateType?: 'inline' | 'redirect';
  transactionRef?: string;
  customerName?: string;
  callbackUrl?: string;
  paymentChannels?: ('card' | 'bank' | 'ussd' | 'transfer')[];
  metadata?: Record<string, any>;
  passCharge?: boolean;
}

export interface InitializePaymentResponse {
  transactionRef: string;
  checkoutUrl: string;
  merchantInfo: {
    merchantName: string;
    merchantLogo: string;
  };
}

/**
 * Initialize a payment transaction
 * 
 * Payment channels:
 * - 'transfer': Bank Transfer - Instant settlement (T+0) - FASTEST
 * - 'card': Debit/Credit Card - Standard settlement (T+1)
 * - 'ussd': USSD - Standard settlement (T+1)
 * - 'bank': Direct bank debit
 */
export async function initializePayment(
  request: InitializePaymentRequest
): Promise<InitializePaymentResponse> {
  const amountInKobo = Math.round(request.amount * 100);

  const response = await squadRequest<InitializePaymentResponse>(
    '/transaction/initiate',
    'POST',
    {
      amount: amountInKobo,
      email: request.email,
      currency: request.currency || 'NGN',
      initiate_type: request.initiateType || 'redirect',
      transaction_ref: request.transactionRef,
      customer_name: request.customerName,
      callback_url: request.callbackUrl,
      payment_channels: request.paymentChannels || ['transfer', 'card', 'ussd'],
      metadata: request.metadata,
      pass_charge: request.passCharge ?? false,
    }
  );

  return {
    transactionRef: response.transactionRef || request.transactionRef || '',
    checkoutUrl: response.checkoutUrl || `https://checkout.squadco.com/${response.transactionRef}`,
    merchantInfo: response.merchantInfo,
  };
}

// Raw response from Squad API (snake_case)
interface SquadTransactionResponse {
  transaction_amount: number;
  transaction_ref: string;
  email: string;
  transaction_status: string;
  transaction_currency_id: string;
  created_at: string;
  transaction_type: string;
  merchant_name: string;
  merchant_business_name: string | null;
  gateway_transaction_ref: string;
  recurring: string | null;
  merchant_email: string;
  plan_code: string | null;
}

// Normalized TypeScript interface (camelCase)
export interface TransactionStatus {
  transactionRef: string;
  transactionStatus: 'success' | 'pending' | 'failed' | 'abandoned';
  transactionAmount: number;
  transactionCurrencyId: string;
  email: string;
  createdAt: string;
  transactionType: string;
  merchantName: string;
  gatewayTransactionRef: string;
}

/**
 * Verify a transaction by its reference
 * Note: Squad returns amounts in the currency unit (naira), not kobo
 */
export async function verifyTransaction(
  transactionRef: string
): Promise<TransactionStatus> {
  const raw = await squadRequest<SquadTransactionResponse>(
    `/transaction/verify/${transactionRef}`,
    'GET'
  );
  
  // Normalize snake_case response to camelCase
  return {
    transactionRef: raw.transaction_ref,
    transactionStatus: raw.transaction_status.toLowerCase() as TransactionStatus['transactionStatus'],
    transactionAmount: raw.transaction_amount,
    transactionCurrencyId: raw.transaction_currency_id,
    email: raw.email,
    createdAt: raw.created_at,
    transactionType: raw.transaction_type,
    merchantName: raw.merchant_name,
    gatewayTransactionRef: raw.gateway_transaction_ref,
  };
}

export interface CreateVirtualAccountRequest {
  customerIdentifier: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email: string;
  bvn?: string;
  dob?: string;
  address?: string;
  gender?: string;
  beneficiaryAccount?: string;
}

export interface VirtualAccountResponse {
  accountNumber: string;
  accountName: string;
  bankName: string;
  expectedAmount?: number;
  transactionRef?: string;
}

/**
 * Create a dynamic virtual account for receiving payments
 */
export async function createVirtualAccount(
  request: CreateVirtualAccountRequest
): Promise<VirtualAccountResponse> {
  return squadRequest<VirtualAccountResponse>(
    '/virtual-account',
    'POST',
    {
      customer_identifier: request.customerIdentifier,
      first_name: request.firstName,
      last_name: request.lastName,
      mobile_num: request.mobileNumber,
      email: request.email,
      bvn: request.bvn,
      dob: request.dob,
      address: request.address,
      gender: request.gender,
      beneficiary_account: request.beneficiaryAccount,
    }
  );
}

export interface TransferRequest {
  transactionReference: string;
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  currencyId?: string;
  remark?: string;
}

export interface TransferResponse {
  transactionReference: string;
  responseCode: string;
  responseDescription: string;
  transactionStatus: 'pending' | 'success' | 'failed';
  amount: number;
  beneficiaryAccountNumber: string;
  beneficiaryName: string;
}

/**
 * Initiate a transfer/disbursement to a bank account
 */
export async function initiateTransfer(
  request: TransferRequest
): Promise<TransferResponse> {
  const amountInKobo = Math.round(request.amount * 100);

  return squadRequest<TransferResponse>(
    '/payout/transfer',
    'POST',
    {
      transaction_reference: request.transactionReference,
      amount: amountInKobo,
      bank_code: request.bankCode,
      account_number: request.accountNumber,
      account_name: request.accountName,
      currency_id: request.currencyId || 'NGN',
      remark: request.remark || 'EKSU Marketplace Payout',
    }
  );
}

export interface BankAccountDetails {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

/**
 * Verify/resolve bank account number
 */
export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<BankAccountDetails> {
  const result = await squadRequest<{ account_name: string; account_number: string }>(
    '/payout/account/lookup',
    'POST',
    {
      bank_code: bankCode,
      account_number: accountNumber,
    }
  );

  return {
    accountNumber: result.account_number,
    accountName: result.account_name,
    bankCode,
  };
}

export interface Bank {
  name: string;
  code: string;
}

/**
 * Get list of all supported banks
 */
export async function getBankList(): Promise<Bank[]> {
  try {
    const response = await fetch('https://api.squadco.com/payout/banks/all', {
      headers: {
        'Authorization': `Bearer ${getCredentials().secretKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (data.success && Array.isArray(data.data)) {
      return data.data.map((bank: any) => ({
        name: bank.name,
        code: bank.code || bank.bankCode,
      }));
    }
    
    return getDefaultBanks();
  } catch (error) {
    console.error('Error fetching banks from Squad:', error);
    return getDefaultBanks();
  }
}

function getDefaultBanks(): Bank[] {
  return [
    { name: 'Access Bank', code: '044' },
    { name: 'Citibank Nigeria', code: '023' },
    { name: 'Ecobank Nigeria', code: '050' },
    { name: 'Fidelity Bank', code: '070' },
    { name: 'First Bank of Nigeria', code: '011' },
    { name: 'First City Monument Bank', code: '214' },
    { name: 'Globus Bank', code: '00103' },
    { name: 'Guaranty Trust Bank', code: '058' },
    { name: 'Heritage Bank', code: '030' },
    { name: 'Keystone Bank', code: '082' },
    { name: 'Kuda Bank', code: '50211' },
    { name: 'Moniepoint MFB', code: '50515' },
    { name: 'OPay', code: '999992' },
    { name: 'Palmpay', code: '999991' },
    { name: 'Polaris Bank', code: '076' },
    { name: 'Providus Bank', code: '101' },
    { name: 'Stanbic IBTC Bank', code: '221' },
    { name: 'Standard Chartered Bank', code: '068' },
    { name: 'Sterling Bank', code: '232' },
    { name: 'Suntrust Bank', code: '100' },
    { name: 'Union Bank of Nigeria', code: '032' },
    { name: 'United Bank for Africa', code: '033' },
    { name: 'Unity Bank', code: '215' },
    { name: 'VFD Microfinance Bank', code: '566' },
    { name: 'Wema Bank', code: '035' },
    { name: 'Zenith Bank', code: '057' },
  ];
}

/**
 * Verify Squad webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const { secretKey } = getCredentials();
  const computedHash = crypto
    .createHmac('sha512', secretKey)
    .update(payload)
    .digest('hex');
  
  return computedHash.toLowerCase() === signature.toLowerCase();
}

export interface SquadWebhookPayload {
  Event: string;
  TransactionRef: string;
  Body: {
    amount: number;
    transaction_ref: string;
    gateway_ref: string;
    transaction_status: 'success' | 'pending' | 'failed' | 'abandoned';
    email: string;
    merchant_amount: number;
    merchant_id: string;
    currency: string;
    transaction_type: string;
    merchant_name: string;
    created_at: string;
    payment_information?: {
      payment_type: string;
      bank_code?: string;
      account_number?: string;
    };
    meta?: Record<string, any>;
    customer_mobile?: string;
  };
}

/**
 * Generate a unique payment reference
 */
export function generatePaymentReference(prefix: string = 'EKSU'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate a unique transfer/disbursement reference
 */
export function generateTransferReference(): string {
  return generatePaymentReference('PAYOUT');
}

/**
 * Check if Squad is properly configured
 */
export function isSquadConfigured(): boolean {
  return !!(
    process.env.SQUAD_SECRET_KEY &&
    process.env.SQUAD_PUBLIC_KEY
  );
}

/**
 * Get detailed Squad configuration status for admin dashboard
 */
export function getSquadConfigStatus(): {
  configured: boolean;
  mode: 'sandbox' | 'live' | 'unknown';
  baseUrl: string;
  hasSecretKey: boolean;
  hasPublicKey: boolean;
  keyPrefix: string;
} {
  const secretKey = process.env.SQUAD_SECRET_KEY || '';
  const publicKey = process.env.SQUAD_PUBLIC_KEY || '';
  
  let mode: 'sandbox' | 'live' | 'unknown' = 'unknown';
  if (secretKey.startsWith('sk_test_') || secretKey.startsWith('sandbox_sk_')) {
    mode = 'sandbox';
  } else if (secretKey.startsWith('sk_live_') || (secretKey && !secretKey.startsWith('sk_test_'))) {
    mode = 'live';
  }
  
  return {
    configured: isSquadConfigured(),
    mode,
    baseUrl: getSquadBaseUrl(),
    hasSecretKey: !!secretKey,
    hasPublicKey: !!publicKey,
    keyPrefix: secretKey ? secretKey.substring(0, 8) + '...' : 'not set',
  };
}

/**
 * Payment method messaging for checkout
 * Bank Transfer is highlighted as instant (T+0)
 */
export const paymentMethodMessages = {
  BANK_TRANSFER: {
    title: "Pay with Bank Transfer / Virtual Account",
    speed: "Instant Settlement (T+0)",
    description: "Funds reach us immediately, ensuring the **FASTEST** possible confirmation and order processing.",
    styleClass: "text-green-700 font-bold bg-green-50 p-2 rounded-md border-2 border-green-300",
    recommended: true,
  },
  CARD: {
    title: "Pay with Debit / Credit Card",
    speed: "Standard Settlement (T+1)",
    description: "Funds clear in 1-2 business days. Order processing may be slightly delayed until the payment is fully reconciled.",
    styleClass: "text-gray-700 bg-gray-50 p-2 rounded-md border border-gray-300",
    recommended: false,
  },
  USSD: {
    title: "Pay with USSD",
    speed: "Standard Settlement (T+1)",
    description: "Funds clear in 1-2 business days. Use Bank Transfer for faster order confirmation.",
    styleClass: "text-gray-700 bg-gray-50 p-2 rounded-md border border-gray-300",
    recommended: false,
  },
};

export const squad = {
  initializePayment,
  verifyTransaction,
  createVirtualAccount,
  initiateTransfer,
  verifyBankAccount,
  getBankList,
  verifyWebhookSignature,
  generatePaymentReference,
  generateTransferReference,
  isSquadConfigured,
  getSquadConfigStatus,
  paymentMethodMessages,
};

export default squad;

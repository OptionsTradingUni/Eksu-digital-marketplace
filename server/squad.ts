/**
 * Squad Payment Gateway Integration
 * 
 * Clean implementation following official Squad API documentation:
 * https://docs.squadco.com
 * 
 * Features:
 * - Payment initialization (Card, Bank Transfer, USSD)
 * - Transaction verification
 * - Disbursements/Transfers to bank accounts
 * - Account lookup/verification
 * - Webhook signature verification
 */

import crypto from 'crypto';

// Squad API Configuration
const SQUAD_CONFIG = {
  // Production URL (api-d.squadco.com) vs Sandbox (sandbox-api-d.squadco.com)
  getBaseUrl: (): string => {
    const secretKey = process.env.SQUAD_SECRET_KEY || '';
    // Test keys start with sandbox_sk_ or sk_test_
    if (secretKey.startsWith('sandbox_sk_') || secretKey.startsWith('sk_test_')) {
      return 'https://sandbox-api-d.squadco.com';
    }
    return 'https://api-d.squadco.com';
  },
  getSecretKey: (): string => process.env.SQUAD_SECRET_KEY || '',
  getPublicKey: (): string => process.env.SQUAD_PUBLIC_KEY || '',
};

// Error types for categorization
export enum SquadErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

// Custom error class
export class SquadApiError extends Error {
  public readonly type: SquadErrorType;
  public readonly statusCode: number;
  public readonly rawError: any;
  public readonly userMessage: string;

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
    this.userMessage = userMessage || this.getDefaultUserMessage(type);
  }

  private getDefaultUserMessage(type: SquadErrorType): string {
    switch (type) {
      case SquadErrorType.NETWORK_ERROR:
        return 'Unable to connect to payment service. Please check your internet and try again.';
      case SquadErrorType.TIMEOUT:
        return 'Payment request timed out. Please try again.';
      case SquadErrorType.AUTHENTICATION_ERROR:
        return 'Payment service configuration error. Please contact support.';
      case SquadErrorType.VALIDATION_ERROR:
        return 'Invalid payment details. Please check and try again.';
      case SquadErrorType.INSUFFICIENT_FUNDS:
        return 'Insufficient funds to complete this transaction.';
      case SquadErrorType.RATE_LIMITED:
        return 'Too many requests. Please wait a moment and try again.';
      case SquadErrorType.SERVER_ERROR:
        return 'Payment service is temporarily unavailable. Please try again later.';
      default:
        return 'An error occurred processing your payment. Please try again.';
    }
  }
}

// Type definitions
export interface InitializePaymentRequest {
  amount: number; // Amount in Naira (will be converted to kobo)
  email: string;
  currency?: 'NGN' | 'USD';
  transactionRef?: string;
  callbackUrl?: string;
  paymentChannels?: ('card' | 'bank' | 'ussd' | 'transfer')[];
  passCharge?: boolean;
  customerName?: string;
  metadata?: Record<string, any>;
}

export interface InitializePaymentResponse {
  transactionRef: string;
  checkoutUrl: string;
  transactionAmount: number;
  merchantAmount: number;
  currency: string;
}

export interface TransactionVerificationResponse {
  transactionRef: string;
  transactionStatus: 'success' | 'pending' | 'failed' | 'abandoned';
  transactionAmount: number;
  email: string;
  currency: string;
  createdAt: string;
  transactionType: string;
  merchantName: string;
  gatewayRef: string;
}

export interface AccountLookupRequest {
  bankCode: string;
  accountNumber: string;
}

export interface AccountLookupResponse {
  accountName: string;
  accountNumber: string;
}

export interface TransferRequest {
  transactionReference: string;
  amount: number; // Amount in Naira (will be converted to kobo)
  bankCode: string;
  accountNumber: string;
  accountName: string;
  remark?: string;
}

export interface TransferResponse {
  transactionReference: string;
  responseDescription: string;
  status: 'success' | 'pending' | 'failed';
  amount: number;
  accountNumber: string;
  accountName: string;
  bankName?: string;
}

export interface Bank {
  name: string;
  code: string;
}

export interface WebhookPayload {
  Event: string;
  TransactionRef: string;
  Body: {
    amount: number;
    transaction_ref: string;
    gateway_ref: string;
    transaction_status: 'success' | 'pending' | 'failed' | 'abandoned';
    email: string;
    merchant_amount: number;
    currency: string;
    transaction_type: string;
    created_at: string;
    meta?: Record<string, any>;
  };
}

// Helper: Make authenticated API request to Squad
async function squadRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
): Promise<T> {
  const secretKey = SQUAD_CONFIG.getSecretKey();
  const baseUrl = SQUAD_CONFIG.getBaseUrl();

  if (!secretKey) {
    throw new SquadApiError(
      'Squad secret key not configured',
      SquadErrorType.AUTHENTICATION_ERROR,
      500,
      null,
      'Payment service is not properly configured. Please contact support.'
    );
  }

  const requestId = crypto.randomBytes(4).toString('hex');
  console.log(`[Squad API] [${requestId}] ${method} ${baseUrl}${endpoint}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
    } catch {
      throw new SquadApiError(
        'Invalid response from Squad API',
        SquadErrorType.SERVER_ERROR,
        response.status
      );
    }

    console.log(`[Squad API] [${requestId}] Status: ${response.status}, Success: ${data.success}`);

    if (!response.ok || !data.success) {
      const errorType = categorizeError(response.status, data);
      throw new SquadApiError(
        data.message || `HTTP ${response.status}`,
        errorType,
        response.status,
        data
      );
    }

    return data.data as T;
  } catch (error: any) {
    if (error instanceof SquadApiError) throw error;

    if (error.name === 'AbortError') {
      throw new SquadApiError(
        'Request timed out',
        SquadErrorType.TIMEOUT,
        0
      );
    }

    throw new SquadApiError(
      `Network error: ${error.message}`,
      SquadErrorType.NETWORK_ERROR,
      0,
      error
    );
  }
}

// Categorize API errors
function categorizeError(status: number, data: any): SquadErrorType {
  // Check for specific error messages from Squad
  const message = data?.message?.toLowerCase() || '';
  
  // Authentication errors
  if (status === 401) return SquadErrorType.INVALID_CREDENTIALS;
  if (status === 403) return SquadErrorType.AUTHENTICATION_ERROR;
  
  // Invalid request errors (malformed requests, missing fields)
  if (status === 400) {
    if (message.includes('invalid') || message.includes('missing') || message.includes('required')) {
      return SquadErrorType.INVALID_REQUEST;
    }
    return SquadErrorType.VALIDATION_ERROR;
  }
  
  // Other specific errors
  if (status === 402) return SquadErrorType.INSUFFICIENT_FUNDS;
  if (status === 422) return SquadErrorType.VALIDATION_ERROR;
  if (status === 429) return SquadErrorType.RATE_LIMITED;
  if (status >= 500) return SquadErrorType.SERVER_ERROR;
  
  return SquadErrorType.UNKNOWN;
}

// Generate unique payment reference
export function generatePaymentReference(prefix: string = 'EKSU'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
}

// Generate transfer reference
export function generateTransferReference(): string {
  return generatePaymentReference('PAYOUT');
}

/**
 * Initialize a payment transaction
 * Redirects user to Squad checkout page
 */
export async function initializePayment(
  request: InitializePaymentRequest
): Promise<InitializePaymentResponse> {
  // Convert amount from Naira to Kobo (multiply by 100)
  const amountInKobo = Math.round(request.amount * 100);

  const payload = {
    amount: amountInKobo,
    email: request.email,
    currency: request.currency || 'NGN',
    initiate_type: 'inline',
    transaction_ref: request.transactionRef || generatePaymentReference(),
    callback_url: request.callbackUrl,
    payment_channels: request.paymentChannels || ['card', 'bank', 'ussd', 'transfer'],
    pass_charge: request.passCharge ?? false,
    customer_name: request.customerName,
    metadata: request.metadata,
  };

  const response = await squadRequest<{
    transaction_ref: string;
    checkout_url: string;
    transaction_amount: number;
    merchant_amount: number;
    currency: string;
  }>('/transaction/initiate', 'POST', payload);

  return {
    transactionRef: response.transaction_ref,
    checkoutUrl: response.checkout_url,
    transactionAmount: response.transaction_amount,
    merchantAmount: response.merchant_amount,
    currency: response.currency,
  };
}

/**
 * Verify a transaction by its reference
 */
export async function verifyTransaction(
  transactionRef: string
): Promise<TransactionVerificationResponse> {
  const response = await squadRequest<{
    transaction_ref: string;
    transaction_status: string;
    transaction_amount: number;
    email: string;
    transaction_currency_id: string;
    created_at: string;
    transaction_type: string;
    merchant_name: string;
    gateway_transaction_ref: string;
  }>(`/transaction/verify/${transactionRef}`, 'GET');

  return {
    transactionRef: response.transaction_ref,
    transactionStatus: response.transaction_status.toLowerCase() as TransactionVerificationResponse['transactionStatus'],
    transactionAmount: response.transaction_amount,
    email: response.email,
    currency: response.transaction_currency_id,
    createdAt: response.created_at,
    transactionType: response.transaction_type,
    merchantName: response.merchant_name,
    gatewayRef: response.gateway_transaction_ref,
  };
}

/**
 * Look up bank account details (verify account before transfer)
 */
export async function lookupBankAccount(
  request: AccountLookupRequest
): Promise<AccountLookupResponse> {
  const response = await squadRequest<{
    account_name: string;
    account_number: string;
  }>('/payout/account/lookup', 'POST', {
    bank_code: request.bankCode,
    account_number: request.accountNumber,
  });

  return {
    accountName: response.account_name,
    accountNumber: response.account_number,
  };
}

/**
 * Verify bank account (alias for lookupBankAccount)
 * Used to verify account details before making a transfer
 */
export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<AccountLookupResponse> {
  return lookupBankAccount({ accountNumber, bankCode });
}

/**
 * Initiate a transfer/payout to a bank account
 */
export async function initiateTransfer(
  request: TransferRequest
): Promise<TransferResponse> {
  // Convert amount from Naira to Kobo
  const amountInKobo = Math.round(request.amount * 100);

  const response = await squadRequest<{
    transaction_reference: string;
    response_description: string;
    status?: string;
    amount: number;
    account_number: string;
    account_name: string;
    destination_institution_name?: string;
  }>('/payout/transfer', 'POST', {
    transaction_reference: request.transactionReference,
    amount: amountInKobo.toString(),
    bank_code: request.bankCode,
    account_number: request.accountNumber,
    account_name: request.accountName,
    currency_id: 'NGN',
    remark: request.remark || 'EKSU Marketplace Payout',
  });

  return {
    transactionReference: response.transaction_reference,
    responseDescription: response.response_description,
    status: (response.status?.toLowerCase() || 'pending') as TransferResponse['status'],
    amount: response.amount,
    accountNumber: response.account_number,
    accountName: response.account_name,
    bankName: response.destination_institution_name,
  };
}

/**
 * Requery transfer status
 */
export async function requeryTransfer(transactionReference: string): Promise<TransferResponse> {
  const response = await squadRequest<{
    transaction_reference: string;
    response_description: string;
    amount: string;
    account_number: string;
    account_name: string;
    destination_institution_name?: string;
  }>('/payout/requery', 'POST', {
    transaction_reference: transactionReference,
  });

  return {
    transactionReference: response.transaction_reference,
    responseDescription: response.response_description,
    status: response.response_description.toLowerCase().includes('success') ? 'success' : 'pending',
    amount: parseFloat(response.amount),
    accountNumber: response.account_number,
    accountName: response.account_name,
    bankName: response.destination_institution_name,
  };
}

/**
 * Get list of Nigerian banks
 */
export async function getBankList(): Promise<Bank[]> {
  try {
    const secretKey = SQUAD_CONFIG.getSecretKey();
    const baseUrl = SQUAD_CONFIG.getBaseUrl();

    const response = await fetch(`${baseUrl}/payout/banks/all`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
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
    console.error('[Squad] Error fetching banks:', error);
    return getDefaultBanks();
  }
}

// Default Nigerian banks fallback
function getDefaultBanks(): Bank[] {
  return [
    { name: 'Access Bank', code: '000014' },
    { name: 'Citibank Nigeria', code: '000009' },
    { name: 'Ecobank Nigeria', code: '000010' },
    { name: 'Fidelity Bank', code: '000007' },
    { name: 'First Bank of Nigeria', code: '000016' },
    { name: 'First City Monument Bank', code: '000003' },
    { name: 'Globus Bank', code: '000027' },
    { name: 'Guaranty Trust Bank', code: '000013' },
    { name: 'Heritage Bank', code: '000020' },
    { name: 'Keystone Bank', code: '000002' },
    { name: 'Kuda Bank', code: '090267' },
    { name: 'Moniepoint MFB', code: '090405' },
    { name: 'OPay', code: '100004' },
    { name: 'Palmpay', code: '100033' },
    { name: 'Polaris Bank', code: '000008' },
    { name: 'Providus Bank', code: '000023' },
    { name: 'Stanbic IBTC Bank', code: '000012' },
    { name: 'Standard Chartered Bank', code: '000021' },
    { name: 'Sterling Bank', code: '000001' },
    { name: 'Union Bank of Nigeria', code: '000018' },
    { name: 'United Bank for Africa', code: '000004' },
    { name: 'Unity Bank', code: '000011' },
    { name: 'Wema Bank', code: '000017' },
    { name: 'Zenith Bank', code: '000015' },
  ];
}

/**
 * Verify Squad webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): boolean {
  const secretKey = SQUAD_CONFIG.getSecretKey();
  if (!secretKey) return false;

  const computedHash = crypto
    .createHmac('sha512', secretKey)
    .update(payload)
    .digest('hex');

  return computedHash.toLowerCase() === signature.toLowerCase();
}

/**
 * Check if Squad is properly configured
 */
export function isSquadConfigured(): boolean {
  return !!(SQUAD_CONFIG.getSecretKey() && SQUAD_CONFIG.getPublicKey());
}

/**
 * Get Squad configuration status (for debugging)
 */
export function getSquadConfigStatus(): {
  configured: boolean;
  mode: 'sandbox' | 'live' | 'unknown';
  baseUrl: string;
  hasSecretKey: boolean;
  hasPublicKey: boolean;
} {
  const secretKey = SQUAD_CONFIG.getSecretKey();
  const publicKey = SQUAD_CONFIG.getPublicKey();

  let mode: 'sandbox' | 'live' | 'unknown' = 'unknown';
  if (secretKey.startsWith('sandbox_sk_') || secretKey.startsWith('sk_test_')) {
    mode = 'sandbox';
  } else if (secretKey) {
    mode = 'live';
  }

  return {
    configured: isSquadConfigured(),
    mode,
    baseUrl: SQUAD_CONFIG.getBaseUrl(),
    hasSecretKey: !!secretKey,
    hasPublicKey: !!publicKey,
  };
}

/**
 * Calculate Squad payment fee estimate
 * Squad charges approximately 1% capped at ₦2,000
 */
export function calculateSquadFee(amount: number): number {
  const feePercentage = 0.01; // 1%
  const maxFee = 2000; // ₦2,000 cap
  const calculatedFee = amount * feePercentage;
  return Math.min(calculatedFee, maxFee);
}

// Export Squad instance for convenient access
export const squad = {
  initializePayment,
  verifyTransaction,
  lookupBankAccount,
  verifyBankAccount,
  initiateTransfer,
  requeryTransfer,
  getBankList,
  verifyWebhookSignature,
  isConfigured: isSquadConfigured,
  getConfigStatus: getSquadConfigStatus,
  generatePaymentReference,
  generateTransferReference,
  calculateFee: calculateSquadFee,
};

export default squad;

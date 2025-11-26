/**
 * Monnify Payment Gateway Integration
 * 
 * This module handles all Monnify API interactions including:
 * - Authentication (OAuth 2.0)
 * - Payment initialization
 * - Transaction verification
 * - Disbursements (instant payouts)
 * - Webhook handling
 */

import crypto from 'crypto';

// Environment URLs
const SANDBOX_BASE_URL = 'https://sandbox.monnify.com';
const LIVE_BASE_URL = 'https://api.monnify.com';

// Get base URL based on environment
function getBaseUrl(): string {
  const isLive = process.env.MONNIFY_ENVIRONMENT === 'LIVE';
  return isLive ? LIVE_BASE_URL : SANDBOX_BASE_URL;
}

// Token cache for authentication
let accessToken: string | null = null;
let tokenExpiry: number = 0;

export interface MonnifyCredentials {
  apiKey: string;
  secretKey: string;
  contractCode: string;
}

function getCredentials(): MonnifyCredentials {
  const apiKey = process.env.MONNIFY_API_KEY;
  const secretKey = process.env.MONNIFY_SECRET_KEY;
  const contractCode = process.env.MONNIFY_CONTRACT_CODE;

  if (!apiKey || !secretKey || !contractCode) {
    throw new Error('Monnify credentials not configured. Please set MONNIFY_API_KEY, MONNIFY_SECRET_KEY, and MONNIFY_CONTRACT_CODE environment variables.');
  }

  return { apiKey, secretKey, contractCode };
}

/**
 * Get OAuth access token from Monnify
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  const { apiKey, secretKey } = getCredentials();
  const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

  const response = await fetch(`${getBaseUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Monnify authentication failed: ${error}`);
  }

  const data = await response.json();
  
  if (!data.requestSuccessful) {
    throw new Error(`Monnify authentication failed: ${data.responseMessage}`);
  }

  accessToken = data.responseBody.accessToken;
  // Token expires in 5 minutes, cache for 4 minutes
  tokenExpiry = Date.now() + 4 * 60 * 1000;

  return accessToken!;
}

/**
 * Make authenticated API request to Monnify
 */
async function monnifyRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${getBaseUrl()}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!data.requestSuccessful) {
    throw new Error(`Monnify API error: ${data.responseMessage}`);
  }

  return data.responseBody as T;
}

// ==================== PAYMENT INITIALIZATION ====================

export interface InitializePaymentRequest {
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentReference: string;
  paymentDescription: string;
  redirectUrl: string;
  paymentMethods?: ('CARD' | 'ACCOUNT_TRANSFER' | 'USSD' | 'PHONE_NUMBER')[];
  metadata?: Record<string, any>;
}

export interface InitializePaymentResponse {
  transactionReference: string;
  paymentReference: string;
  merchantName: string;
  apiKey: string;
  enabledPaymentMethod: string[];
  checkoutUrl: string;
}

/**
 * Initialize a one-time payment transaction
 */
export async function initializePayment(
  request: InitializePaymentRequest
): Promise<InitializePaymentResponse> {
  const { contractCode } = getCredentials();

  return monnifyRequest<InitializePaymentResponse>(
    '/api/v1/merchant/transactions/init-transaction',
    'POST',
    {
      amount: request.amount,
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      paymentReference: request.paymentReference,
      paymentDescription: request.paymentDescription,
      currencyCode: 'NGN',
      contractCode,
      redirectUrl: request.redirectUrl,
      paymentMethods: request.paymentMethods || ['CARD', 'ACCOUNT_TRANSFER', 'USSD'],
      metaData: request.metadata,
    }
  );
}

// ==================== TRANSACTION VERIFICATION ====================

export interface TransactionStatus {
  transactionReference: string;
  paymentReference: string;
  amountPaid: number;
  totalPayable: number;
  paymentStatus: 'PAID' | 'PENDING' | 'OVERPAID' | 'PARTIALLY_PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  paymentDescription: string;
  currency: string;
  paymentMethod: string;
  product: {
    type: string;
    reference: string;
  };
  metaData: Record<string, any>;
  customer: {
    email: string;
    name: string;
  };
  paidOn?: string;
  createdOn: string;
}

/**
 * Verify a transaction by its reference
 */
export async function verifyTransaction(
  transactionReference: string
): Promise<TransactionStatus> {
  const encodedReference = encodeURIComponent(transactionReference);
  return monnifyRequest<TransactionStatus>(
    `/api/v2/transactions/${encodedReference}`,
    'GET'
  );
}

/**
 * Get transaction status by payment reference
 */
export async function getTransactionByPaymentReference(
  paymentReference: string
): Promise<TransactionStatus> {
  return monnifyRequest<TransactionStatus>(
    `/api/v2/merchant/transactions/query?paymentReference=${encodeURIComponent(paymentReference)}`,
    'GET'
  );
}

// ==================== DISBURSEMENTS (PAYOUTS) ====================

export interface DisbursementRequest {
  amount: number;
  reference: string;
  narration: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  currency?: string;
  sourceAccountNumber?: string;
}

export interface DisbursementResponse {
  amount: number;
  reference: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  dateCreated: string;
  totalFee: number;
  destinationAccountName: string;
  destinationBankName: string;
  destinationAccountNumber: string;
  destinationBankCode: string;
}

/**
 * Initiate a single transfer (disbursement) to a bank account
 */
export async function initiateDisbursement(
  request: DisbursementRequest
): Promise<DisbursementResponse> {
  return monnifyRequest<DisbursementResponse>(
    '/api/v2/disbursements/single',
    'POST',
    {
      amount: request.amount,
      reference: request.reference,
      narration: request.narration,
      destinationBankCode: request.destinationBankCode,
      destinationAccountNumber: request.destinationAccountNumber,
      currency: request.currency || 'NGN',
      sourceAccountNumber: request.sourceAccountNumber || process.env.MONNIFY_WALLET_ACCOUNT,
    }
  );
}

/**
 * Get disbursement status by reference
 */
export async function getDisbursementStatus(
  reference: string
): Promise<DisbursementResponse> {
  return monnifyRequest<DisbursementResponse>(
    `/api/v2/disbursements/single/summary?reference=${encodeURIComponent(reference)}`,
    'GET'
  );
}

// ==================== BANK VERIFICATION ====================

export interface BankAccountDetails {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

/**
 * Verify bank account number and get account name
 */
export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<BankAccountDetails> {
  return monnifyRequest<BankAccountDetails>(
    `/api/v1/disbursements/account/validate?accountNumber=${accountNumber}&bankCode=${bankCode}`,
    'GET'
  );
}

// ==================== BANK LIST ====================

export interface Bank {
  name: string;
  code: string;
  ussdTemplate?: string;
  baseUssdCode?: string;
  transferUssdTemplate?: string;
}

/**
 * Get list of all supported banks
 */
export async function getBankList(): Promise<Bank[]> {
  return monnifyRequest<Bank[]>('/api/v1/banks', 'GET');
}

// ==================== WEBHOOK VERIFICATION ====================

/**
 * Verify Monnify webhook signature
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
  
  return computedHash === signature;
}

export interface MonnifyWebhookPayload {
  transactionReference: string;
  paymentReference: string;
  amountPaid: number;
  totalPayable: number;
  settlementAmount: number;
  paidOn: string;
  paymentStatus: 'PAID' | 'PENDING' | 'OVERPAID' | 'PARTIALLY_PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  paymentDescription: string;
  transactionHash: string;
  currency: string;
  paymentMethod: string;
  product: {
    type: string;
    reference: string;
  };
  cardDetails?: {
    cardType: string;
    last4: string;
    expMonth: string;
    expYear: string;
    bin: string;
    bankCode: string;
    bankName: string;
    reusable: boolean;
    countryCode: string;
    cardToken: string;
    supportsTokenization: boolean;
  };
  accountDetails?: {
    accountName: string;
    accountNumber: string;
    bankCode: string;
    amountPaid: number;
  };
  accountPayments?: Array<{
    accountName: string;
    accountNumber: string;
    bankCode: string;
    amountPaid: number;
  }>;
  customer: {
    email: string;
    name: string;
  };
  metaData?: Record<string, any>;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate a unique payment reference
 */
export function generatePaymentReference(prefix: string = 'EKSU'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate a unique disbursement reference
 */
export function generateDisbursementReference(): string {
  return generatePaymentReference('PAYOUT');
}

/**
 * Check if Monnify is properly configured
 */
export function isMonnifyConfigured(): boolean {
  return !!(
    process.env.MONNIFY_API_KEY &&
    process.env.MONNIFY_SECRET_KEY &&
    process.env.MONNIFY_CONTRACT_CODE
  );
}

// Export all functions
export const monnify = {
  initializePayment,
  verifyTransaction,
  getTransactionByPaymentReference,
  initiateDisbursement,
  getDisbursementStatus,
  verifyBankAccount,
  getBankList,
  verifyWebhookSignature,
  generatePaymentReference,
  generateDisbursementReference,
  isMonnifyConfigured,
};

export default monnify;

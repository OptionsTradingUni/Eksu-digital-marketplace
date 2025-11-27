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

const SQUAD_BASE_URL = 'https://api.squadco.com';

export interface SquadCredentials {
  secretKey: string;
  publicKey: string;
}

function getCredentials(): SquadCredentials {
  const secretKey = process.env.SQUAD_SECRET_KEY;
  const publicKey = process.env.SQUAD_PUBLIC_KEY;

  if (!secretKey || !publicKey) {
    throw new Error('Squad credentials not configured. Please set SQUAD_SECRET_KEY and SQUAD_PUBLIC_KEY environment variables.');
  }

  return { secretKey, publicKey };
}

/**
 * Make authenticated API request to Squad
 */
async function squadRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const { secretKey } = getCredentials();

  const response = await fetch(`${SQUAD_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(`Squad API error: ${data.message || 'Unknown error'}`);
  }

  return data.data as T;
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
  paymentMethodMessages,
};

export default squad;

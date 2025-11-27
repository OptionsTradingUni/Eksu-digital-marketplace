/**
 * Pricing Calculator for EKSU Marketplace
 * 
 * This module handles all financial calculations including:
 * - Squad transaction fees
 * - Platform commission (website fee)
 * - Seller net profit
 * - Buyer total price
 * - Security deposit calculations
 */

const DEFAULT_COMMISSION_RATE = 0.10; // 10%
const DEFAULT_SECURITY_DEPOSIT = 0; // Naira

/**
 * Get the website commission rate from environment variables
 */
export function getCommissionRate(): number {
  const rate = process.env.WEBSITE_COMMISSION_RATE;
  if (rate) {
    const parsed = parseFloat(rate);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }
  return DEFAULT_COMMISSION_RATE;
}

/**
 * Get the security deposit amount from environment variables
 */
export function getSecurityDepositAmount(): number {
  const amount = process.env.SECURITY_DEPOSIT_AMOUNT;
  if (amount) {
    const parsed = parseFloat(amount);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return DEFAULT_SECURITY_DEPOSIT;
}

/**
 * Squad Fee Structure for Nigeria
 * - Bank Transfer: 1.0% (capped at ₦1,000) - Instant settlement (T+0)
 * - Card Payments: 1.5% (capped at ₦2,000)
 * - USSD: 1.5% (capped at ₦2,000)
 */
export interface SquadFeeResult {
  feePercentage: number;
  totalFee: number;
  cappedFee: number;
}

export type PaymentMethod = 'CARD' | 'BANK_TRANSFER' | 'USSD' | 'TRANSFER';

/**
 * Calculate Squad transaction fee based on amount and payment method
 */
export function calculateSquadFee(
  amount: number,
  paymentMethod: PaymentMethod = 'BANK_TRANSFER'
): SquadFeeResult {
  let feePercentage: number;
  let feeCap: number;
  
  switch (paymentMethod) {
    case 'BANK_TRANSFER':
    case 'TRANSFER':
      feePercentage = 0.01; // 1.0% for bank transfers (instant settlement)
      feeCap = 1000; // ₦1,000 cap
      break;
    case 'CARD':
      feePercentage = 0.015; // 1.5% for cards
      feeCap = 2000; // ₦2,000 cap
      break;
    case 'USSD':
      feePercentage = 0.015; // 1.5%
      feeCap = 2000;
      break;
    default:
      feePercentage = 0.015;
      feeCap = 2000;
  }
  
  const totalFee = amount * feePercentage;
  const cappedFee = Math.min(totalFee, feeCap);
  
  return {
    feePercentage,
    totalFee,
    cappedFee,
  };
}

/**
 * Pricing breakdown for a product listing
 */
export interface PricingBreakdown {
  sellerPrice: number;
  platformCommission: number;
  paymentFee: number;
  buyerPays: number;
  sellerReceives: number;
  commissionRate: number;
}

/**
 * Calculate full pricing breakdown based on seller's desired price
 */
export function calculatePricingFromSellerPrice(
  sellerDesiredProfit: number,
  paymentMethod: PaymentMethod = 'BANK_TRANSFER'
): PricingBreakdown {
  const commissionRate = getCommissionRate();
  
  const platformCommission = Math.round(sellerDesiredProfit * commissionRate * 100) / 100;
  
  const squadResult = calculateSquadFee(sellerDesiredProfit, paymentMethod);
  const paymentFee = Math.round(squadResult.cappedFee * 100) / 100;
  
  const buyerPays = Math.round((sellerDesiredProfit + platformCommission + paymentFee) * 100) / 100;
  
  const sellerReceives = Math.round((sellerDesiredProfit - platformCommission) * 100) / 100;
  
  return {
    sellerPrice: sellerDesiredProfit,
    platformCommission,
    paymentFee,
    buyerPays,
    sellerReceives,
    commissionRate,
  };
}

/**
 * Calculate pricing breakdown from the buyer's perspective
 */
export function calculatePricingFromBuyerPrice(
  buyerPrice: number,
  paymentMethod: PaymentMethod = 'BANK_TRANSFER'
): PricingBreakdown {
  const commissionRate = getCommissionRate();
  
  let estimatedSellerPrice = buyerPrice / (1 + commissionRate);
  
  const squadResult = calculateSquadFee(estimatedSellerPrice, paymentMethod);
  estimatedSellerPrice = (buyerPrice - squadResult.cappedFee) / (1 + commissionRate);
  
  return calculatePricingFromSellerPrice(Math.round(estimatedSellerPrice * 100) / 100, paymentMethod);
}

/**
 * Recalculate pricing for a negotiated offer
 */
export function calculateNegotiationPricing(
  offerPrice: number,
  paymentMethod: PaymentMethod = 'BANK_TRANSFER'
): PricingBreakdown {
  return calculatePricingFromSellerPrice(offerPrice, paymentMethod);
}

/**
 * Calculate security deposit requirement
 */
export function calculateSecurityDepositRequired(
  currentLockedAmount: number
): { required: number; amountToLock: number } {
  const requiredAmount = getSecurityDepositAmount();
  const amountToLock = Math.max(0, requiredAmount - currentLockedAmount);
  
  return {
    required: requiredAmount,
    amountToLock,
  };
}

/**
 * Check if withdrawal is allowed based on verification status and amount
 */
export function isWithdrawalAllowed(
  amount: number,
  isVerified: boolean,
  balance: number,
  securityDepositLocked: number
): { allowed: boolean; reason?: string } {
  const UNVERIFIED_WITHDRAWAL_LIMIT = 5000;
  
  if (amount > balance) {
    return { allowed: false, reason: 'Insufficient balance' };
  }
  
  if (!isVerified && amount > UNVERIFIED_WITHDRAWAL_LIMIT) {
    return { 
      allowed: false, 
      reason: `Unverified sellers can only withdraw up to ₦${UNVERIFIED_WITHDRAWAL_LIMIT.toLocaleString()}. Please complete verification to withdraw larger amounts.`
    };
  }
  
  return { allowed: true };
}

/**
 * Format amount as Nigerian Naira
 */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Parse Naira string to number
 */
export function parseNaira(nairaString: string): number {
  const cleaned = nairaString.replace(/[₦,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export const pricingConfig = {
  getCommissionRate,
  getSecurityDepositAmount,
  calculateSquadFee,
  calculatePricingFromSellerPrice,
  calculatePricingFromBuyerPrice,
  calculateNegotiationPricing,
  calculateSecurityDepositRequired,
  isWithdrawalAllowed,
  formatNaira,
  parseNaira,
};

export default pricingConfig;

/**
 * Pricing Calculator for EKSU Marketplace
 * 
 * This module handles all financial calculations including:
 * - Monnify transaction fees
 * - Platform commission (website fee)
 * - Seller net profit
 * - Buyer total price
 * - Security deposit calculations
 */

// Environment variable defaults (will be overridden by actual env vars)
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
 * Monnify Fee Structure for Nigeria (2024)
 * - Local Card Payments: 1.5% + ₦50 fixed fee
 * - Account Transfer/USSD: 1.0% (lower than cards)
 * - Fee Cap: ₦2,000 maximum per transaction
 * - Waiver: ₦50 fixed fee waived for transactions below ₦2,500
 */
export interface MonnifyFeeResult {
  feePercentage: number;
  fixedFee: number;
  totalFee: number;
  cappedFee: number; // After applying ₦2,000 cap
}

export type PaymentMethod = 'CARD' | 'ACCOUNT_TRANSFER' | 'USSD' | 'PHONE_NUMBER';

/**
 * Calculate Monnify transaction fee based on amount and payment method
 */
export function calculateMonnifyFee(
  amount: number,
  paymentMethod: PaymentMethod = 'CARD'
): MonnifyFeeResult {
  const FEE_CAP = 2000; // Maximum fee in Naira
  const WAIVER_THRESHOLD = 2500; // ₦50 waived for transactions below this
  
  let feePercentage: number;
  let fixedFee: number;
  
  switch (paymentMethod) {
    case 'CARD':
      feePercentage = 0.015; // 1.5%
      fixedFee = amount < WAIVER_THRESHOLD ? 0 : 50;
      break;
    case 'ACCOUNT_TRANSFER':
    case 'USSD':
      feePercentage = 0.01; // 1.0% for bank transfers
      fixedFee = amount < WAIVER_THRESHOLD ? 0 : 50;
      break;
    case 'PHONE_NUMBER':
      feePercentage = 0.015; // 1.5%
      fixedFee = amount < WAIVER_THRESHOLD ? 0 : 50;
      break;
    default:
      feePercentage = 0.015;
      fixedFee = amount < WAIVER_THRESHOLD ? 0 : 50;
  }
  
  const percentageFee = amount * feePercentage;
  const totalFee = percentageFee + fixedFee;
  const cappedFee = Math.min(totalFee, FEE_CAP);
  
  return {
    feePercentage,
    fixedFee,
    totalFee,
    cappedFee,
  };
}

/**
 * Pricing breakdown for a product listing
 */
export interface PricingBreakdown {
  sellerPrice: number; // What the seller wants to receive (input)
  platformCommission: number; // Amount to CampusPlug (WEBSITE_COMMISSION_RATE * sellerPrice)
  monnifyFee: number; // Payment processing fee
  buyerPays: number; // Total amount buyer pays (sellerPrice + platformCommission + monnifyFee)
  sellerReceives: number; // Net amount seller receives (sellerPrice - platformCommission)
  commissionRate: number; // The commission rate used
}

/**
 * Calculate full pricing breakdown based on seller's desired price
 * This is used when seller is listing a product
 * 
 * Formula (from documentation):
 * - Total Buyer Pays = Calculated Price (A+B+C)
 * - Amount to CampusPlug (B) = Seller Price * WEBSITE_COMMISSION_RATE
 * - Amount to Monnify (C) = 1.5% of Seller Price + ₦100 (capped at ₦2000)
 * - Amount Seller Receives = Seller Price - (B + C)
 */
export function calculatePricingFromSellerPrice(
  sellerDesiredProfit: number,
  paymentMethod: PaymentMethod = 'CARD'
): PricingBreakdown {
  const commissionRate = getCommissionRate();
  
  // Platform commission on the seller price
  const platformCommission = Math.round(sellerDesiredProfit * commissionRate * 100) / 100;
  
  // Monnify fee calculation
  const monnifyResult = calculateMonnifyFee(sellerDesiredProfit, paymentMethod);
  const monnifyFee = Math.round(monnifyResult.cappedFee * 100) / 100;
  
  // Total buyer pays = seller price + platform commission + monnify fee
  const buyerPays = Math.round((sellerDesiredProfit + platformCommission + monnifyFee) * 100) / 100;
  
  // Seller receives = seller price - platform commission (monnify fee is added to buyer total)
  const sellerReceives = Math.round((sellerDesiredProfit - platformCommission) * 100) / 100;
  
  return {
    sellerPrice: sellerDesiredProfit,
    platformCommission,
    monnifyFee,
    buyerPays,
    sellerReceives,
    commissionRate,
  };
}

/**
 * Calculate pricing breakdown from the buyer's perspective (reverse calculation)
 * Given what the buyer pays, calculate seller's profit
 */
export function calculatePricingFromBuyerPrice(
  buyerPrice: number,
  paymentMethod: PaymentMethod = 'CARD'
): PricingBreakdown {
  const commissionRate = getCommissionRate();
  
  // This requires solving for sellerPrice from:
  // buyerPrice = sellerPrice + (sellerPrice * commissionRate) + monnifyFee(sellerPrice)
  // 
  // Simplified: buyerPrice = sellerPrice * (1 + commissionRate) + monnifyFee
  // Since monnify fee depends on sellerPrice, we use iterative approximation
  
  // First approximation without monnify fee
  let estimatedSellerPrice = buyerPrice / (1 + commissionRate);
  
  // Refine with monnify fee (one iteration is usually enough)
  const monnifyResult = calculateMonnifyFee(estimatedSellerPrice, paymentMethod);
  estimatedSellerPrice = (buyerPrice - monnifyResult.cappedFee) / (1 + commissionRate);
  
  // Now calculate the actual breakdown
  return calculatePricingFromSellerPrice(Math.round(estimatedSellerPrice * 100) / 100, paymentMethod);
}

/**
 * Recalculate pricing for a negotiated offer
 * Used when a buyer makes an offer or seller accepts
 */
export function calculateNegotiationPricing(
  offerPrice: number,
  paymentMethod: PaymentMethod = 'CARD'
): PricingBreakdown {
  return calculatePricingFromSellerPrice(offerPrice, paymentMethod);
}

/**
 * Calculate security deposit requirement
 * Returns the amount that should be locked when seller makes first sale
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
  const UNVERIFIED_WITHDRAWAL_LIMIT = 5000; // ₦5,000 limit for unverified sellers
  
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

// Export for use in API routes
export const pricingConfig = {
  getCommissionRate,
  getSecurityDepositAmount,
  calculateMonnifyFee,
  calculatePricingFromSellerPrice,
  calculatePricingFromBuyerPrice,
  calculateNegotiationPricing,
  calculateSecurityDepositRequired,
  isWithdrawalAllowed,
  formatNaira,
  parseNaira,
};

export default pricingConfig;

/**
 * Shared Pricing Calculator for EKSU Marketplace
 * 
 * This module can be used on both frontend and backend for consistent
 * pricing calculations. It handles:
 * - Monnify transaction fees
 * - Platform commission
 * - Buyer/Seller price breakdowns
 */

// Default values (can be overridden)
export const DEFAULT_COMMISSION_RATE = 0.10; // 10%
export const MONNIFY_FEE_CAP = 2000; // Maximum fee in Naira
export const WAIVER_THRESHOLD = 2500; // ₦50 fixed fee waived below this amount

export type PaymentMethod = 'CARD' | 'ACCOUNT_TRANSFER' | 'USSD' | 'PHONE_NUMBER';

export interface MonnifyFeeResult {
  feePercentage: number;
  fixedFee: number;
  totalFee: number;
  cappedFee: number;
}

export interface PricingBreakdown {
  sellerPrice: number;
  platformCommission: number;
  monnifyFee: number;
  buyerPays: number;
  sellerReceives: number;
  commissionRate: number;
}

/**
 * Calculate Monnify transaction fee based on amount and payment method
 */
export function calculateMonnifyFee(
  amount: number,
  paymentMethod: PaymentMethod = 'CARD'
): MonnifyFeeResult {
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
  const cappedFee = Math.min(totalFee, MONNIFY_FEE_CAP);
  
  return {
    feePercentage,
    fixedFee,
    totalFee,
    cappedFee,
  };
}

/**
 * Calculate full pricing breakdown based on seller's desired price
 * 
 * Formula:
 * - Platform Commission (B) = Seller Price * WEBSITE_COMMISSION_RATE
 * - Monnify Fee (C) = 1.5% of Seller Price + ₦50 (capped at ₦2000)
 * - Total Buyer Pays = Seller Price + B + C
 * - Seller Receives = Seller Price - B
 */
export function calculatePricingFromSellerPrice(
  sellerDesiredProfit: number,
  commissionRate: number = DEFAULT_COMMISSION_RATE,
  paymentMethod: PaymentMethod = 'CARD'
): PricingBreakdown {
  // Platform commission on the seller price
  const platformCommission = Math.round(sellerDesiredProfit * commissionRate * 100) / 100;
  
  // Monnify fee calculation
  const monnifyResult = calculateMonnifyFee(sellerDesiredProfit, paymentMethod);
  const monnifyFee = Math.round(monnifyResult.cappedFee * 100) / 100;
  
  // Total buyer pays = seller price + platform commission + monnify fee
  const buyerPays = Math.round((sellerDesiredProfit + platformCommission + monnifyFee) * 100) / 100;
  
  // Seller receives = seller price - platform commission
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

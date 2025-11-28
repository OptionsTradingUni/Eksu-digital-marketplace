/**
 * Shared Pricing Calculator for EKSU Marketplace
 * 
 * This module can be used on both frontend and backend for consistent
 * pricing calculations. It handles:
 * - Squad transaction fees (official pricing)
 * - Platform commission
 * - Buyer/Seller price breakdowns
 */

// Default values (can be overridden)
export const DEFAULT_COMMISSION_RATE = 0.10; // 10%

// Squad Official Pricing (2024)
export const SQUAD_FEE_CONFIG = {
  CARD: {
    percentage: 0.012,  // 1.2%
    cap: 1500,
  },
  TRANSFER: {
    percentage: 0.0025, // 0.25%
    cap: 1000,
  },
  USSD: {
    percentage: 0.012,  // 1.2%
    cap: 1500,
  },
  BANK: {
    percentage: 0.0025, // 0.25%
    cap: 1000,
  },
};

export type PaymentMethod = 'CARD' | 'TRANSFER' | 'USSD' | 'BANK';

export interface SquadFeeResult {
  feePercentage: number;
  totalFee: number;
  cappedFee: number;
}

export interface PricingBreakdown {
  sellerPrice: number;
  platformCommission: number;
  paymentFee: number;
  buyerPays: number;
  sellerReceives: number;
  commissionRate: number;
}

/**
 * Calculate Squad transaction fee based on amount and payment method
 * Official Squad Pricing: https://squadco.com/pricing
 */
export function calculateSquadFee(
  amount: number,
  paymentMethod: PaymentMethod = 'CARD'
): SquadFeeResult {
  const feeConfig = SQUAD_FEE_CONFIG[paymentMethod];
  
  if (!feeConfig) {
    throw new Error(`Unknown payment method: ${paymentMethod}`);
  }
  
  const feePercentage = feeConfig.percentage;
  const totalFee = amount * feePercentage;
  const cappedFee = Math.min(totalFee, feeConfig.cap);
  
  return {
    feePercentage,
    totalFee,
    cappedFee,
  };
}

/**
 * Calculate full pricing breakdown based on seller's desired price
 * 
 * Formula:
 * - Platform Commission (B) = Seller Price * COMMISSION_RATE
 * - Squad Fee (C) = Squad fee based on payment method
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
  
  // Squad fee calculation
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

/**
 * Get payment method info with correct Squad pricing
 * Based on official pricing: https://squadco.com/pricing
 */
export function getPaymentMethodInfo(method: PaymentMethod) {
  const info = {
    CARD: {
      title: 'Debit/Credit Card',
      description: 'Standard settlement (T+1)',
      fee: '1.2% (max ₦1,500)',
    },
    TRANSFER: {
      title: 'Bank Transfer',
      description: 'Instant settlement via Virtual Account',
      fee: '0.25% (max ₦1,000)',
      recommended: true,
    },
    USSD: {
      title: 'USSD',
      description: 'Standard settlement (T+1)',
      fee: '1.2% (max ₦1,500)',
    },
    BANK: {
      title: 'Bank Account',
      description: 'Instant settlement via Virtual Account',
      fee: '0.25% (max ₦1,000)',
    },
  };
  
  return info[method] || info.CARD;
}

// Re-export for backward compatibility
export function getCommissionRate(): number {
  return DEFAULT_COMMISSION_RATE;
}

export function getSecurityDepositAmount(amount: number): number {
  return Math.round(amount * 0.05); // 5% security deposit
}

export function isWithdrawalAllowed(availableBalance: number, withdrawalAmount: number): boolean {
  return availableBalance >= withdrawalAmount && withdrawalAmount > 0;
}

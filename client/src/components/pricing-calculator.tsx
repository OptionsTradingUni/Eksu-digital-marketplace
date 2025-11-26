import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calculator, Info, CreditCard, Building2, Smartphone } from "lucide-react";
import {
  calculatePricingFromSellerPrice,
  calculateMonnifyFee,
  formatNaira,
  type PaymentMethod,
  type PricingBreakdown,
  DEFAULT_COMMISSION_RATE,
} from "@shared/pricing";

interface PricingCalculatorProps {
  initialPrice?: number;
  onPriceChange?: (breakdown: PricingBreakdown) => void;
  compact?: boolean;
  showPaymentMethodSelect?: boolean;
}

export function PricingCalculator({
  initialPrice = 0,
  onPriceChange,
  compact = false,
  showPaymentMethodSelect = true,
}: PricingCalculatorProps) {
  const [sellerPrice, setSellerPrice] = useState<string>(initialPrice.toString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const [breakdown, setBreakdown] = useState<PricingBreakdown | null>(null);

  useEffect(() => {
    const price = parseFloat(sellerPrice) || 0;
    if (price > 0) {
      const newBreakdown = calculatePricingFromSellerPrice(
        price,
        DEFAULT_COMMISSION_RATE,
        paymentMethod
      );
      setBreakdown(newBreakdown);
      onPriceChange?.(newBreakdown);
    } else {
      setBreakdown(null);
    }
  }, [sellerPrice, paymentMethod, onPriceChange]);

  const handlePriceChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setSellerPrice(cleaned);
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case "CARD":
        return <CreditCard className="h-4 w-4" />;
      case "ACCOUNT_TRANSFER":
        return <Building2 className="h-4 w-4" />;
      case "USSD":
        return <Smartphone className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  if (compact) {
    return (
      <div className="space-y-3" data-testid="pricing-calculator-compact">
        <div className="flex items-center gap-2">
          <Label htmlFor="price-input" className="text-sm text-muted-foreground">
            Your Price
          </Label>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              ₦
            </span>
            <Input
              id="price-input"
              type="text"
              value={sellerPrice}
              onChange={(e) => handlePriceChange(e.target.value)}
              placeholder="0.00"
              className="pl-7"
              data-testid="input-seller-price"
            />
          </div>
        </div>

        {breakdown && breakdown.sellerPrice > 0 && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between items-center p-2 rounded-md bg-muted/50">
              <span className="text-muted-foreground">Buyer Pays</span>
              <span className="font-medium" data-testid="text-buyer-pays">
                {formatNaira(breakdown.buyerPays)}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-md bg-muted/50">
              <span className="text-muted-foreground">You Receive</span>
              <span className="font-medium text-green-600" data-testid="text-seller-receives">
                {formatNaira(breakdown.sellerReceives)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card data-testid="pricing-calculator">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5" />
          Pricing Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="seller-price">Your Desired Price (₦)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              ₦
            </span>
            <Input
              id="seller-price"
              type="text"
              value={sellerPrice}
              onChange={(e) => handlePriceChange(e.target.value)}
              placeholder="Enter your price"
              className="pl-8 text-lg"
              data-testid="input-seller-price"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter the price you want for your item
          </p>
        </div>

        {showPaymentMethodSelect && (
          <div className="space-y-2">
            <Label>Expected Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
            >
              <SelectTrigger data-testid="select-payment-method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CARD">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Card Payment
                  </div>
                </SelectItem>
                <SelectItem value="ACCOUNT_TRANSFER">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Bank Transfer
                  </div>
                </SelectItem>
                <SelectItem value="USSD">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    USSD
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Different methods have slightly different fees
            </p>
          </div>
        )}

        {breakdown && breakdown.sellerPrice > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-medium text-sm">Price Breakdown</h4>

            <div className="space-y-2">
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Your Price</span>
                </div>
                <span className="font-medium" data-testid="text-seller-price">
                  {formatNaira(breakdown.sellerPrice)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Platform Fee</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{(breakdown.commissionRate * 100).toFixed(0)}% commission on your price</p>
                    </TooltipContent>
                  </Tooltip>
                  <Badge variant="secondary" className="text-xs">
                    {(breakdown.commissionRate * 100).toFixed(0)}%
                  </Badge>
                </div>
                <span className="text-muted-foreground" data-testid="text-platform-fee">
                  +{formatNaira(breakdown.platformCommission)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Payment Fee</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        Monnify fee:{" "}
                        {paymentMethod === "ACCOUNT_TRANSFER" || paymentMethod === "USSD"
                          ? "1%"
                          : "1.5%"}{" "}
                        + ₦50 (waived under ₦2,500). Capped at ₦2,000 max.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  {getPaymentMethodIcon(paymentMethod)}
                </div>
                <span className="text-muted-foreground" data-testid="text-monnify-fee">
                  +{formatNaira(breakdown.monnifyFee)}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-t-2 border-dashed">
                <span className="font-medium">Buyer Pays</span>
                <span className="text-lg font-bold" data-testid="text-buyer-total">
                  {formatNaira(breakdown.buyerPays)}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 bg-green-50 dark:bg-green-950/30 rounded-md px-3 -mx-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-green-700 dark:text-green-400">
                    You Receive
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-green-600 dark:text-green-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Your price minus platform fee</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span
                  className="text-lg font-bold text-green-700 dark:text-green-400"
                  data-testid="text-seller-receives"
                >
                  {formatNaira(breakdown.sellerReceives)}
                </span>
              </div>
            </div>
          </div>
        )}

        {(!breakdown || breakdown.sellerPrice <= 0) && (
          <div className="text-center py-6 text-muted-foreground">
            <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Enter a price to see the breakdown</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PricingCalculator;

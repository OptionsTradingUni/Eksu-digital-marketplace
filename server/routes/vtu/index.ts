import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { getUserId, isAdminUser } from "../common";
import {
  purchaseVtuSchema,
  purchaseAirtimeSchema,
  createBeneficiarySchema,
  createScheduledPurchaseApiSchema,
  createGiftDataApiSchema,
  purchaseExamPinSchema,
} from "../../../shared/schema";
import {
  purchaseData,
  purchaseAirtime,
  isInlomaxConfigured,
  isValidNigerianPhone,
  checkTransactionStatus,
  getAllDataPlans,
  getDataPlanById,
  getDataPlansByNetwork,
  detectNetwork,
  getDiscountInfo,
  NETWORK_INFO,
  getAllCablePlans,
  getCablePlanById,
  getCablePlansByProvider,
  validateSmartCard,
  subscribeCableTV,
  validateMeterNumber,
  payElectricityBill,
  purchaseExamPin,
  getExamPins,
  getDiscos,
  CABLE_PROVIDER_INFO,
  type NetworkType,
  type DataPlan,
} from "../../inlomax";

// Helper function to generate random gift code
function generateGiftCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export function registerVtuRoutes(app: Express): void {
  // ==================== VTU BENEFICIARIES ====================

  // Get user's saved beneficiaries
  app.get("/api/vtu/beneficiaries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const beneficiaries = await storage.getUserBeneficiaries(userId);
      res.json(beneficiaries);
    } catch (error) {
      console.error("Error fetching beneficiaries:", error);
      res.status(500).json({ message: "Failed to fetch beneficiaries" });
    }
  });

  // Create a new beneficiary
  app.post("/api/vtu/beneficiaries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = createBeneficiarySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const beneficiary = await storage.createBeneficiary({
        userId,
        ...validationResult.data,
      });
      res.json(beneficiary);
    } catch (error) {
      console.error("Error creating beneficiary:", error);
      res.status(500).json({ message: "Failed to create beneficiary" });
    }
  });

  // Update a beneficiary
  app.put("/api/vtu/beneficiaries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const beneficiary = await storage.getBeneficiary(id);
      
      if (!beneficiary) {
        return res.status(404).json({ message: "Beneficiary not found" });
      }
      
      if (beneficiary.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this beneficiary" });
      }

      const updated = await storage.updateBeneficiary(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating beneficiary:", error);
      res.status(500).json({ message: "Failed to update beneficiary" });
    }
  });

  // Delete a beneficiary
  app.delete("/api/vtu/beneficiaries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const beneficiary = await storage.getBeneficiary(id);
      
      if (!beneficiary) {
        return res.status(404).json({ message: "Beneficiary not found" });
      }
      
      if (beneficiary.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this beneficiary" });
      }

      await storage.deleteBeneficiary(id);
      res.json({ success: true, message: "Beneficiary deleted" });
    } catch (error) {
      console.error("Error deleting beneficiary:", error);
      res.status(500).json({ message: "Failed to delete beneficiary" });
    }
  });

  // ==================== VTU TRANSACTIONS ====================

  // Get user's VTU transaction history with filters
  app.get("/api/vtu/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status, network, startDate, endDate } = req.query;
      
      const filters: { status?: string; network?: string; startDate?: Date; endDate?: Date } = {};
      if (status && typeof status === "string") filters.status = status;
      if (network && typeof network === "string") filters.network = network;
      if (startDate && typeof startDate === "string") filters.startDate = new Date(startDate);
      if (endDate && typeof endDate === "string") filters.endDate = new Date(endDate);

      const transactions = await storage.getUserVtuTransactions(userId, filters);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching VTU transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Export VTU transactions as JSON (for frontend to process into PDF/Excel)
  app.get("/api/vtu/transactions/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status, network, startDate, endDate, format = "json" } = req.query;
      
      const filters: { status?: string; network?: string; startDate?: Date; endDate?: Date } = {};
      if (status && typeof status === "string" && status !== "all") filters.status = status;
      if (network && typeof network === "string" && network !== "all") filters.network = network;
      if (startDate && typeof startDate === "string") filters.startDate = new Date(startDate);
      if (endDate && typeof endDate === "string") filters.endDate = new Date(endDate);

      const transactions = await storage.getUserVtuTransactions(userId, filters);
      const user = await storage.getUser(userId);

      res.json({
        success: true,
        exportData: {
          userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User" : "User",
          exportDate: new Date().toISOString(),
          filters: {
            status: filters.status || "all",
            network: filters.network || "all",
            startDate: filters.startDate?.toISOString() || null,
            endDate: filters.endDate?.toISOString() || null,
          },
          transactions: transactions.map((tx: any) => ({
            id: tx.id,
            date: tx.createdAt,
            type: tx.serviceType || "data",
            network: tx.network,
            phoneNumber: tx.phoneNumber,
            plan: tx.planName || tx.planId || "N/A",
            amount: tx.amount,
            status: tx.status,
            reference: tx.apiReference || tx.id,
          })),
          summary: {
            totalTransactions: transactions.length,
            totalAmount: transactions.reduce((sum: number, tx: any) => sum + parseFloat(tx.amount || 0), 0),
            successfulCount: transactions.filter((tx: any) => tx.status === "success" || tx.status === "completed").length,
            pendingCount: transactions.filter((tx: any) => tx.status === "pending").length,
            failedCount: transactions.filter((tx: any) => tx.status === "failed").length,
          },
        },
      });
    } catch (error) {
      console.error("Error exporting VTU transactions:", error);
      res.status(500).json({ message: "Failed to export transactions" });
    }
  });

  // ==================== BULK VTU PURCHASE ====================

  // Bulk VTU purchase - purchase data/airtime for multiple numbers
  app.post("/api/vtu/bulk-purchase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { purchases, serviceType = "data" } = req.body;

      if (!Array.isArray(purchases) || purchases.length === 0) {
        return res.status(400).json({ message: "Purchases array is required and cannot be empty" });
      }

      if (purchases.length > 50) {
        return res.status(400).json({ message: "Maximum 50 purchases per bulk request" });
      }

      // Validate all phone numbers first
      for (const purchase of purchases) {
        if (!isValidNigerianPhone(purchase.phoneNumber)) {
          return res.status(400).json({ 
            message: `Invalid phone number: ${purchase.phoneNumber}`,
            invalidNumber: purchase.phoneNumber
          });
        }
      }

      // Calculate total amount needed
      let totalAmount = 0;
      const purchasesWithPlans: any[] = [];

      for (const purchase of purchases) {
        if (serviceType === "data") {
          const plan = getDataPlanById(purchase.planId);
          if (!plan) {
            return res.status(400).json({ 
              message: `Data plan not found: ${purchase.planId}`,
              invalidPlan: purchase.planId
            });
          }
          totalAmount += plan.sellingPrice;
          purchasesWithPlans.push({ ...purchase, plan });
        } else if (serviceType === "airtime") {
          const amount = parseFloat(purchase.amount);
          if (isNaN(amount) || amount < 50 || amount > 50000) {
            return res.status(400).json({ 
              message: `Invalid airtime amount for ${purchase.phoneNumber}. Must be between 50 and 50,000.`,
            });
          }
          totalAmount += amount;
          purchasesWithPlans.push({ ...purchase, amount });
        }
      }

      // Check wallet balance
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < totalAmount) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance for bulk purchase",
          required: totalAmount,
          available: walletBalance
        });
      }

      // Check if API is configured
      if (!isInlomaxConfigured()) {
        return res.status(503).json({ message: "VTU service is temporarily unavailable" });
      }

      // Process each purchase
      const results: any[] = [];
      let totalSuccess = 0;
      let totalFailed = 0;
      let amountDeducted = 0;

      for (const purchase of purchasesWithPlans) {
        try {
          const purchaseAmount = serviceType === "data" ? purchase.plan.sellingPrice : purchase.amount;
          
          // Deduct from wallet
          await storage.updateWalletBalance(userId, purchaseAmount.toString(), "subtract");
          amountDeducted += purchaseAmount;

          // Create transaction record
          const walletTx = await storage.createTransaction({
            walletId: wallet.id,
            type: "purchase",
            amount: `-${purchaseAmount}`,
            status: "pending",
            description: serviceType === "data" 
              ? `Bulk Data: ${purchase.plan.dataAmount} for ${purchase.phoneNumber}`
              : `Bulk Airtime: ₦${purchase.amount} for ${purchase.phoneNumber}`,
            relatedUserId: userId,
          });

          let purchaseResult;
          if (serviceType === "data") {
            purchaseResult = await purchaseData(purchase.plan.network, purchase.phoneNumber, purchase.plan.planCode);
          } else {
            purchaseResult = await purchaseAirtime(purchase.network || "mtn", purchase.phoneNumber, purchase.amount);
          }

          if (purchaseResult.success) {
            await storage.updateTransaction(walletTx.id, { status: "completed" });
            totalSuccess++;
            results.push({
              phoneNumber: purchase.phoneNumber,
              status: "success",
              amount: purchaseAmount,
              reference: purchaseResult.reference,
              message: serviceType === "data" 
                ? `${purchase.plan.dataAmount} sent successfully`
                : `₦${purchase.amount} airtime sent successfully`,
            });
          } else {
            // Refund on failure
            await storage.updateWalletBalance(userId, purchaseAmount.toString(), "add");
            amountDeducted -= purchaseAmount;
            await storage.updateTransaction(walletTx.id, { status: "failed" });
            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: purchaseAmount.toString(),
              status: "completed",
              description: `Refund: Bulk ${serviceType} for ${purchase.phoneNumber} - ${purchaseResult.message}`,
              relatedUserId: userId,
            });
            totalFailed++;
            results.push({
              phoneNumber: purchase.phoneNumber,
              status: "failed",
              amount: purchaseAmount,
              message: purchaseResult.message || "Purchase failed",
            });
          }
        } catch (purchaseError: any) {
          totalFailed++;
          results.push({
            phoneNumber: purchase.phoneNumber,
            status: "error",
            message: purchaseError.message || "Network error",
          });
        }
      }

      // Award reward points for successful bulk purchases (10 points per 1000 naira)
      if (amountDeducted > 0) {
        const pointsEarned = Math.floor(amountDeducted / 1000) * 10;
        if (pointsEarned > 0) {
          await storage.addRewardPoints(
            userId,
            pointsEarned,
            `Earned from bulk VTU purchase of ₦${amountDeducted.toLocaleString()}`,
            undefined,
            "vtu_bulk_purchase"
          );
        }
      }

      res.json({
        success: true,
        message: `Bulk purchase completed: ${totalSuccess} successful, ${totalFailed} failed`,
        results,
        summary: {
          total: purchases.length,
          successful: totalSuccess,
          failed: totalFailed,
          totalAmountDeducted: amountDeducted,
        },
      });
    } catch (error) {
      console.error("Error processing bulk VTU purchase:", error);
      res.status(500).json({ message: "Failed to process bulk purchase" });
    }
  });

  // ==================== VTU DATA PLANS ====================

  // Get all VTU data plans (optionally filter by network and/or planType)
  app.get("/api/vtu/plans", async (req, res) => {
    try {
      const { network, planType } = req.query;
      const discountInfo = getDiscountInfo();
      
      let plans: DataPlan[] = getAllDataPlans();
      
      // Filter by network if provided (supports: mtn, glo, airtel, 9mobile)
      if (network && typeof network === "string") {
        const validNetworks = ["mtn", "glo", "airtel", "9mobile"];
        if (validNetworks.includes(network.toLowerCase())) {
          plans = plans.filter(p => p.network === network.toLowerCase());
        }
      }
      
      // Filter by planType if provided (supports: sme, direct, cg, social, awoof)
      if (planType && typeof planType === "string") {
        plans = plans.filter(p => p.planType === planType.toLowerCase());
      }
      
      // Include market price and savings info in response
      const plansWithSavings = plans.map(plan => ({
        ...plan,
        marketPrice: plan.marketPrice,
        savingsAmount: plan.savingsAmount,
        savingsPercentage: plan.savingsPercentage,
        formattedSavings: `${plan.savingsPercentage}% OFF`,
      }));
      
      res.json({
        plans: plansWithSavings,
        discount: discountInfo,
        networks: NETWORK_INFO,
        totalPlans: plansWithSavings.length,
      });
    } catch (error) {
      console.error("Error fetching VTU plans:", error);
      res.status(500).json({ message: "Failed to fetch VTU plans" });
    }
  });

  // ==================== VTU DATA PURCHASE ====================

  // Purchase VTU data using Inlomax API
  app.post("/api/vtu/purchase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const validationResult = purchaseVtuSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const { planId, phoneNumber } = validationResult.data;

      // Validate Nigerian phone number
      if (!isValidNigerianPhone(phoneNumber)) {
        return res.status(400).json({ message: "Invalid Nigerian phone number" });
      }

      // Get the data plan from Inlomax plans
      const plan = getDataPlanById(planId);
      if (!plan) {
        return res.status(404).json({ message: "Data plan not found" });
      }

      // Use Inlomax pricing structure
      const planPrice = plan.sellingPrice;
      const costPrice = plan.apiPrice;
      const profit = plan.profit;
      const savingsAmount = plan.savingsAmount;
      const savingsPercentage = plan.savingsPercentage;

      // Get user's wallet
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      // Check sufficient balance
      if (walletBalance < planPrice) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance",
          required: planPrice,
          available: walletBalance
        });
      }

      // Deduct from wallet first and track for potential refund
      let walletDeducted = false;
      let walletTransaction: any = null;

      try {
        await storage.updateWalletBalance(userId, planPrice.toString(), "subtract");
        walletDeducted = true;

        // Create wallet transaction record
        walletTransaction = await storage.createTransaction({
          walletId: wallet.id,
          type: "purchase",
          amount: `-${planPrice}`,
          status: "pending",
          description: `Data Purchase: ${plan.name} (${plan.dataAmount}) for ${phoneNumber}`,
          relatedUserId: userId,
        });

        // Process the actual purchase if API is configured
        if (!isInlomaxConfigured()) {
          throw new Error("VTU_SERVICE_UNAVAILABLE");
        }

        const purchaseResult = await purchaseData(plan.network, phoneNumber, plan.planCode);
        
        if (purchaseResult.success) {
          // Update wallet transaction as completed
          await storage.updateTransaction(walletTransaction.id, { status: "completed" });

          // Award reward points (10 points per ₦1,000 spent)
          let pointsEarned = 0;
          try {
            const rewards = await storage.getOrCreateRewardPoints(userId);
            const tierMultiplier: Record<string, number> = {
              bronze: 1,
              silver: 1.25,
              gold: 1.5,
              platinum: 2,
            };
            const multiplier = tierMultiplier[rewards.tier] || 1;
            pointsEarned = Math.floor((planPrice / 1000) * 10 * multiplier);
            
            if (pointsEarned > 0) {
              await storage.addRewardPoints(
                userId,
                pointsEarned,
                `Earned from ${plan.dataAmount} data purchase (₦${planPrice.toLocaleString()})`,
                walletTransaction.id,
                "vtu_data_purchase"
              );
            }
          } catch (rewardError) {
            console.error("Error adding reward points:", rewardError);
          }

          return res.json({
            success: true,
            message: `${plan.dataAmount} data purchased successfully for ${phoneNumber}`,
            pointsEarned,
            transaction: {
              id: walletTransaction.id,
              network: plan.network,
              planType: plan.planType,
              planName: plan.name,
              dataAmount: plan.dataAmount,
              amount: planPrice,
              costPrice: costPrice,
              profit: profit,
              savingsAmount: savingsAmount,
              savingsPercentage: savingsPercentage,
              marketPrice: plan.marketPrice,
              phoneNumber,
              status: "success",
              reference: purchaseResult.reference,
              transactionId: purchaseResult.transactionId,
            },
          });
        } else {
          throw new Error(purchaseResult.message || "API_PURCHASE_FAILED");
        }
      } catch (purchaseError: any) {
        // Refund the user if wallet was deducted
        if (walletDeducted) {
          try {
            await storage.updateWalletBalance(userId, planPrice.toString(), "add");
            
            if (walletTransaction) {
              await storage.updateTransaction(walletTransaction.id, { status: "failed" });
            }

            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: planPrice.toString(),
              status: "completed",
              description: `Refund: ${plan.dataAmount} data for ${phoneNumber}`,
              relatedUserId: userId,
            });
          } catch (refundError) {
            console.error("VTU refund error:", refundError);
          }
        }

        const errorMessage = purchaseError.message === "VTU_SERVICE_UNAVAILABLE"
          ? "VTU service is temporarily unavailable. Please try again later."
          : purchaseError.message === "API_PURCHASE_FAILED"
          ? "Data purchase failed. Amount refunded to wallet."
          : "Data purchase failed due to network error. Amount refunded to wallet.";

        const statusCode = purchaseError.message === "VTU_SERVICE_UNAVAILABLE" ? 503 : 500;

        console.error("VTU purchase error:", purchaseError);
        return res.status(statusCode).json({
          success: false,
          message: walletDeducted ? errorMessage : "Failed to process VTU purchase",
        });
      }
    } catch (error) {
      console.error("Error processing VTU purchase:", error);
      res.status(500).json({ message: "Failed to process VTU purchase" });
    }
  });

  // ==================== AIRTIME PURCHASE ====================

  // Purchase airtime using Inlomax API
  app.post("/api/vtu/airtime", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = purchaseAirtimeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const { phoneNumber, amount, network } = validationResult.data;

      if (!isValidNigerianPhone(phoneNumber)) {
        return res.status(400).json({ message: "Invalid Nigerian phone number" });
      }

      // Validate network - supports mtn, glo, airtel, 9mobile
      const validNetworks: NetworkType[] = ["mtn", "glo", "airtel", "9mobile"];
      let networkToUse: NetworkType;
      
      if (network && validNetworks.includes(network.toLowerCase() as NetworkType)) {
        networkToUse = network.toLowerCase() as NetworkType;
      } else {
        // Auto-detect network from phone number
        const detectedNetwork = detectNetwork(phoneNumber);
        if (!detectedNetwork) {
          return res.status(400).json({ 
            message: "Could not detect network for this phone number. Supported networks: MTN, GLO, Airtel, 9mobile." 
          });
        }
        networkToUse = detectedNetwork;
      }

      // Validate amount (minimum airtime amount)
      if (amount < 50) {
        return res.status(400).json({ message: "Minimum airtime amount is ₦50" });
      }

      if (amount > 50000) {
        return res.status(400).json({ message: "Maximum airtime amount is ₦50,000" });
      }

      // Get network info for discount calculation
      const networkInfo = NETWORK_INFO[networkToUse];
      const discount = networkInfo?.airtimeDiscount || 0;
      const discountAmount = Math.round(amount * discount);

      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < amount) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance",
          required: amount,
          available: walletBalance
        });
      }

      // Deduct from wallet first and track for potential refund
      let walletDeducted = false;
      let walletTransaction: any = null;

      try {
        await storage.updateWalletBalance(userId, amount.toString(), "subtract");
        walletDeducted = true;

        walletTransaction = await storage.createTransaction({
          walletId: wallet.id,
          type: "purchase",
          amount: `-${amount}`,
          status: "pending",
          description: `Airtime Purchase: ₦${amount} for ${phoneNumber} (${networkInfo?.displayName || networkToUse.toUpperCase()})`,
          relatedUserId: userId,
        });

        // Process the actual purchase if API is configured
        if (!isInlomaxConfigured()) {
          throw new Error("VTU_SERVICE_UNAVAILABLE");
        }

        const purchaseResult = await purchaseAirtime(networkToUse, phoneNumber, amount);
        
        if (purchaseResult.success) {
          await storage.updateTransaction(walletTransaction.id, { status: "completed" });

          // Award reward points (10 points per ₦1,000 spent)
          let pointsEarned = 0;
          try {
            const rewards = await storage.getOrCreateRewardPoints(userId);
            const tierMultiplier: Record<string, number> = {
              bronze: 1,
              silver: 1.25,
              gold: 1.5,
              platinum: 2,
            };
            const multiplier = tierMultiplier[rewards.tier] || 1;
            pointsEarned = Math.floor((amount / 1000) * 10 * multiplier);
            
            if (pointsEarned > 0) {
              await storage.addRewardPoints(
                userId,
                pointsEarned,
                `Earned from ₦${amount.toLocaleString()} airtime purchase`,
                walletTransaction.id,
                "vtu_airtime_purchase"
              );
            }
          } catch (rewardError) {
            console.error("Error adding reward points:", rewardError);
          }

          return res.json({
            success: true,
            message: `₦${amount} airtime purchased successfully for ${phoneNumber}`,
            pointsEarned,
            transaction: {
              id: walletTransaction.id,
              network: networkToUse,
              networkName: networkInfo?.displayName || networkToUse.toUpperCase(),
              amount,
              discountAmount,
              discountPercentage: Math.round(discount * 100),
              phoneNumber,
              status: "success",
              reference: purchaseResult.reference,
              transactionId: purchaseResult.transactionId,
            },
          });
        } else {
          throw new Error(purchaseResult.message || "API_PURCHASE_FAILED");
        }
      } catch (purchaseError: any) {
        // Refund the user if wallet was deducted
        if (walletDeducted) {
          try {
            await storage.updateWalletBalance(userId, amount.toString(), "add");
            
            if (walletTransaction) {
              await storage.updateTransaction(walletTransaction.id, { status: "failed" });
            }

            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: amount.toString(),
              status: "completed",
              description: `Refund: ₦${amount} airtime for ${phoneNumber}`,
              relatedUserId: userId,
            });
          } catch (refundError) {
            console.error("Airtime refund error:", refundError);
          }
        }

        const errorMessage = purchaseError.message === "VTU_SERVICE_UNAVAILABLE"
          ? "VTU service is temporarily unavailable. Please try again later."
          : purchaseError.message === "API_PURCHASE_FAILED"
          ? "Airtime purchase failed. Amount refunded to wallet."
          : "Airtime purchase failed due to network error. Amount refunded to wallet.";

        const statusCode = purchaseError.message === "VTU_SERVICE_UNAVAILABLE" ? 503 : 500;

        console.error("Airtime purchase error:", purchaseError);
        return res.status(statusCode).json({
          success: false,
          message: walletDeducted ? errorMessage : "Failed to process airtime purchase",
        });
      }
    } catch (error) {
      console.error("Error processing airtime purchase:", error);
      res.status(500).json({ message: "Failed to process airtime purchase" });
    }
  });

  // ==================== CABLE TV ENDPOINTS ====================

  // Get all cable TV plans
  app.get("/api/vtu/cable/plans", async (req, res) => {
    try {
      const plans = getAllCablePlans();
      res.json({
        plans,
        providers: CABLE_PROVIDER_INFO,
        totalPlans: plans.length,
      });
    } catch (error) {
      console.error("Error fetching cable TV plans:", error);
      res.status(500).json({ message: "Failed to fetch cable TV plans" });
    }
  });

  // Get cable TV plans by provider (dstv, gotv, startimes)
  app.get("/api/vtu/cable/plans/:provider", async (req, res) => {
    try {
      const { provider } = req.params;
      const validProviders = ["dstv", "gotv", "startimes"];
      
      if (!validProviders.includes(provider.toLowerCase())) {
        return res.status(400).json({ 
          message: "Invalid provider. Supported providers: dstv, gotv, startimes" 
        });
      }

      const plans = getCablePlansByProvider(provider.toLowerCase() as any);
      const providerInfo = CABLE_PROVIDER_INFO[provider.toLowerCase() as keyof typeof CABLE_PROVIDER_INFO];
      
      res.json({
        provider: providerInfo,
        plans,
        totalPlans: plans.length,
      });
    } catch (error) {
      console.error("Error fetching cable TV plans by provider:", error);
      res.status(500).json({ message: "Failed to fetch cable TV plans" });
    }
  });

  // Validate smart card / IUC number
  app.post("/api/vtu/cable/validate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { provider, smartCardNumber } = req.body;

      if (!provider || !smartCardNumber) {
        return res.status(400).json({ message: "Provider and smart card number are required" });
      }

      const validProviders = ["dstv", "gotv", "startimes"];
      if (!validProviders.includes(provider.toLowerCase())) {
        return res.status(400).json({ 
          message: "Invalid provider. Supported providers: dstv, gotv, startimes" 
        });
      }

      if (!isInlomaxConfigured()) {
        return res.status(503).json({ message: "VTU service is temporarily unavailable" });
      }

      const validationResult = await validateSmartCard(provider.toLowerCase(), smartCardNumber);

      if (validationResult.success) {
        res.json({
          success: true,
          message: "Smart card validated successfully",
          customerName: validationResult.data?.customer_name || validationResult.data?.name || "Customer",
          smartCardNumber,
          provider: provider.toLowerCase(),
        });
      } else {
        res.status(400).json({
          success: false,
          message: validationResult.message || "Smart card validation failed",
        });
      }
    } catch (error) {
      console.error("Error validating smart card:", error);
      res.status(500).json({ message: "Failed to validate smart card" });
    }
  });

  // Subscribe to cable TV
  app.post("/api/vtu/cable/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { provider, smartCardNumber, planId, customerName } = req.body;

      if (!provider || !smartCardNumber || !planId) {
        return res.status(400).json({ 
          message: "Provider, smart card number, and plan ID are required" 
        });
      }

      const validProviders = ["dstv", "gotv", "startimes"];
      if (!validProviders.includes(provider.toLowerCase())) {
        return res.status(400).json({ 
          message: "Invalid provider. Supported providers: dstv, gotv, startimes" 
        });
      }

      // Get the cable plan
      const plan = getCablePlanById(planId);
      if (!plan) {
        return res.status(404).json({ message: "Cable TV plan not found" });
      }

      if (plan.provider !== provider.toLowerCase()) {
        return res.status(400).json({ message: "Plan does not match provider" });
      }

      const planPrice = plan.sellingPrice;
      const costPrice = plan.apiPrice;
      const profit = plan.profit;

      // Get user's wallet
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < planPrice) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance",
          required: planPrice,
          available: walletBalance
        });
      }

      // Deduct from wallet first and track for potential refund
      let walletDeducted = false;
      let walletTransaction: any = null;

      try {
        await storage.updateWalletBalance(userId, planPrice.toString(), "subtract");
        walletDeducted = true;

        walletTransaction = await storage.createTransaction({
          walletId: wallet.id,
          type: "purchase",
          amount: `-${planPrice}`,
          status: "pending",
          description: `Cable TV: ${plan.name} for ${smartCardNumber}`,
          relatedUserId: userId,
        });

        if (!isInlomaxConfigured()) {
          throw new Error("VTU_SERVICE_UNAVAILABLE");
        }

        const purchaseResult = await subscribeCableTV(plan.provider, smartCardNumber, plan.planCode);

        if (purchaseResult.success) {
          await storage.updateTransaction(walletTransaction.id, { status: "completed" });

          return res.json({
            success: true,
            message: `${plan.name} subscription successful for ${smartCardNumber}`,
            transaction: {
              id: walletTransaction.id,
              provider: plan.provider,
              planName: plan.name,
              duration: plan.duration,
              amount: planPrice,
              costPrice,
              profit,
              smartCardNumber,
              customerName: customerName || "Customer",
              status: "success",
              reference: purchaseResult.reference,
              transactionId: purchaseResult.transactionId,
            },
          });
        } else {
          throw new Error(purchaseResult.message || "API_PURCHASE_FAILED");
        }
      } catch (purchaseError: any) {
        if (walletDeducted) {
          try {
            await storage.updateWalletBalance(userId, planPrice.toString(), "add");
            
            if (walletTransaction) {
              await storage.updateTransaction(walletTransaction.id, { status: "failed" });
            }

            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: planPrice.toString(),
              status: "completed",
              description: `Refund: ${plan.name} for ${smartCardNumber}`,
              relatedUserId: userId,
            });
          } catch (refundError) {
            console.error("Cable TV refund error:", refundError);
          }
        }

        const errorMessage = purchaseError.message === "VTU_SERVICE_UNAVAILABLE"
          ? "VTU service is temporarily unavailable. Please try again later."
          : purchaseError.message === "API_PURCHASE_FAILED"
          ? "Cable TV subscription failed. Amount refunded to wallet."
          : "Cable TV subscription failed due to network error. Amount refunded to wallet.";

        const statusCode = purchaseError.message === "VTU_SERVICE_UNAVAILABLE" ? 503 : 500;

        console.error("Cable TV subscription error:", purchaseError);
        return res.status(statusCode).json({
          success: false,
          message: walletDeducted ? errorMessage : "Failed to process cable TV subscription",
        });
      }
    } catch (error) {
      console.error("Error processing cable TV subscription:", error);
      res.status(500).json({ message: "Failed to process cable TV subscription" });
    }
  });

  // ==================== ELECTRICITY ENDPOINTS ====================

  // Get all electricity distribution companies (DISCOs)
  app.get("/api/vtu/electricity/discos", async (req, res) => {
    try {
      const discos = getDiscos();
      res.json({
        discos,
        totalDiscos: discos.length,
      });
    } catch (error) {
      console.error("Error fetching DISCOs:", error);
      res.status(500).json({ message: "Failed to fetch electricity companies" });
    }
  });

  // Validate meter number
  app.post("/api/vtu/electricity/validate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { disco, meterNumber, meterType } = req.body;

      if (!disco || !meterNumber || !meterType) {
        return res.status(400).json({ 
          message: "DISCO, meter number, and meter type are required" 
        });
      }

      if (!["prepaid", "postpaid"].includes(meterType.toLowerCase())) {
        return res.status(400).json({ 
          message: "Invalid meter type. Must be 'prepaid' or 'postpaid'" 
        });
      }

      if (!isInlomaxConfigured()) {
        return res.status(503).json({ message: "VTU service is temporarily unavailable" });
      }

      const validationResult = await validateMeterNumber(
        disco.toLowerCase(),
        meterNumber,
        meterType.toLowerCase() as "prepaid" | "postpaid"
      );

      if (validationResult.success) {
        res.json({
          success: true,
          message: "Meter number validated successfully",
          customerName: validationResult.data?.customer_name || validationResult.data?.name || "Customer",
          customerAddress: validationResult.data?.address || "",
          meterNumber,
          disco,
          meterType: meterType.toLowerCase(),
        });
      } else {
        res.status(400).json({
          success: false,
          message: validationResult.message || "Meter number validation failed",
        });
      }
    } catch (error) {
      console.error("Error validating meter number:", error);
      res.status(500).json({ message: "Failed to validate meter number" });
    }
  });

  // Pay electricity bill
  app.post("/api/vtu/electricity/pay", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { disco, meterNumber, meterType, amount, customerName } = req.body;

      if (!disco || !meterNumber || !meterType || !amount) {
        return res.status(400).json({ 
          message: "DISCO, meter number, meter type, and amount are required" 
        });
      }

      if (!["prepaid", "postpaid"].includes(meterType.toLowerCase())) {
        return res.status(400).json({ 
          message: "Invalid meter type. Must be 'prepaid' or 'postpaid'" 
        });
      }

      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount < 500) {
        return res.status(400).json({ message: "Minimum electricity payment is ₦500" });
      }

      if (paymentAmount > 100000) {
        return res.status(400).json({ message: "Maximum electricity payment is ₦100,000" });
      }

      // Get user's wallet
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < paymentAmount) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance",
          required: paymentAmount,
          available: walletBalance
        });
      }

      // Deduct from wallet first and track for potential refund
      let walletDeducted = false;
      let walletTransaction: any = null;

      try {
        await storage.updateWalletBalance(userId, paymentAmount.toString(), "subtract");
        walletDeducted = true;

        walletTransaction = await storage.createTransaction({
          walletId: wallet.id,
          type: "purchase",
          amount: `-${paymentAmount}`,
          status: "pending",
          description: `Electricity: ₦${paymentAmount} for ${meterNumber} (${disco.toUpperCase()})`,
          relatedUserId: userId,
        });

        if (!isInlomaxConfigured()) {
          throw new Error("VTU_SERVICE_UNAVAILABLE");
        }

        const purchaseResult = await payElectricityBill(
          disco.toLowerCase(),
          meterNumber,
          meterType.toLowerCase() as "prepaid" | "postpaid",
          paymentAmount,
          customerName || "Customer"
        );

        if (purchaseResult.success) {
          await storage.updateTransaction(walletTransaction.id, { status: "completed" });

          return res.json({
            success: true,
            message: `₦${paymentAmount} electricity payment successful for ${meterNumber}`,
            transaction: {
              id: walletTransaction.id,
              disco,
              meterNumber,
              meterType: meterType.toLowerCase(),
              amount: paymentAmount,
              customerName: customerName || "Customer",
              token: purchaseResult.token,
              status: "success",
              reference: purchaseResult.reference,
              transactionId: purchaseResult.transactionId,
            },
          });
        } else {
          throw new Error(purchaseResult.message || "API_PURCHASE_FAILED");
        }
      } catch (purchaseError: any) {
        if (walletDeducted) {
          try {
            await storage.updateWalletBalance(userId, paymentAmount.toString(), "add");
            
            if (walletTransaction) {
              await storage.updateTransaction(walletTransaction.id, { status: "failed" });
            }

            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: paymentAmount.toString(),
              status: "completed",
              description: `Refund: ₦${paymentAmount} electricity for ${meterNumber}`,
              relatedUserId: userId,
            });
          } catch (refundError) {
            console.error("Electricity refund error:", refundError);
          }
        }

        const errorMessage = purchaseError.message === "VTU_SERVICE_UNAVAILABLE"
          ? "VTU service is temporarily unavailable. Please try again later."
          : purchaseError.message === "API_PURCHASE_FAILED"
          ? "Electricity payment failed. Amount refunded to wallet."
          : "Electricity payment failed due to network error. Amount refunded to wallet.";

        const statusCode = purchaseError.message === "VTU_SERVICE_UNAVAILABLE" ? 503 : 500;

        console.error("Electricity payment error:", purchaseError);
        return res.status(statusCode).json({
          success: false,
          message: walletDeducted ? errorMessage : "Failed to process electricity payment",
        });
      }
    } catch (error) {
      console.error("Error processing electricity payment:", error);
      res.status(500).json({ message: "Failed to process electricity payment" });
    }
  });

  // ==================== EXAM PINS ENDPOINTS ====================

  // Get all exam pin types with prices
  app.get("/api/vtu/exam-pins", async (req, res) => {
    try {
      const examPins = getExamPins();
      res.json({
        examPins,
        totalTypes: examPins.length,
      });
    } catch (error) {
      console.error("Error fetching exam pins:", error);
      res.status(500).json({ message: "Failed to fetch exam pins" });
    }
  });

  // Purchase exam pins
  app.post("/api/vtu/exam-pins/purchase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const validationResult = purchaseExamPinSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const { examType, quantity } = validationResult.data;

      // Get exam pin info
      const examPins = getExamPins();
      const examPin = examPins.find(p => p.type === examType);
      if (!examPin) {
        return res.status(404).json({ message: "Exam pin type not found" });
      }

      const totalPrice = examPin.sellingPrice * quantity;
      const totalCostPrice = examPin.apiPrice * quantity;
      const totalProfit = examPin.profit * quantity;

      // Get user's wallet
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < totalPrice) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance",
          required: totalPrice,
          available: walletBalance
        });
      }

      // Deduct from wallet first and track for potential refund
      let walletDeducted = false;
      let walletTransaction: any = null;

      try {
        await storage.updateWalletBalance(userId, totalPrice.toString(), "subtract");
        walletDeducted = true;

        walletTransaction = await storage.createTransaction({
          walletId: wallet.id,
          type: "purchase",
          amount: `-${totalPrice}`,
          status: "pending",
          description: `Exam Pin: ${examPin.name} x${quantity}`,
          relatedUserId: userId,
        });

        if (!isInlomaxConfigured()) {
          throw new Error("VTU_SERVICE_UNAVAILABLE");
        }

        const purchaseResult = await purchaseExamPin(examType as any, quantity);

        if (purchaseResult.success) {
          await storage.updateTransaction(walletTransaction.id, { status: "completed" });

          return res.json({
            success: true,
            message: `${quantity} ${examPin.name} pin(s) purchased successfully`,
            transaction: {
              id: walletTransaction.id,
              examType,
              examName: examPin.name,
              quantity,
              unitPrice: examPin.sellingPrice,
              totalAmount: totalPrice,
              costPrice: totalCostPrice,
              profit: totalProfit,
              pins: purchaseResult.data?.pins || [],
              status: "success",
              reference: purchaseResult.reference,
              transactionId: purchaseResult.transactionId,
            },
          });
        } else {
          throw new Error(purchaseResult.message || "API_PURCHASE_FAILED");
        }
      } catch (purchaseError: any) {
        if (walletDeducted) {
          try {
            await storage.updateWalletBalance(userId, totalPrice.toString(), "add");
            
            if (walletTransaction) {
              await storage.updateTransaction(walletTransaction.id, { status: "failed" });
            }

            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: totalPrice.toString(),
              status: "completed",
              description: `Refund: ${examPin.name} x${quantity}`,
              relatedUserId: userId,
            });
          } catch (refundError) {
            console.error("Exam pin refund error:", refundError);
          }
        }

        const errorMessage = purchaseError.message === "VTU_SERVICE_UNAVAILABLE"
          ? "VTU service is temporarily unavailable. Please try again later."
          : purchaseError.message === "API_PURCHASE_FAILED"
          ? "Exam pin purchase failed. Amount refunded to wallet."
          : "Exam pin purchase failed due to network error. Amount refunded to wallet.";

        const statusCode = purchaseError.message === "VTU_SERVICE_UNAVAILABLE" ? 503 : 500;

        console.error("Exam pin purchase error:", purchaseError);
        return res.status(statusCode).json({
          success: false,
          message: walletDeducted ? errorMessage : "Failed to process exam pin purchase",
        });
      }
    } catch (error) {
      console.error("Error processing exam pin purchase:", error);
      res.status(500).json({ message: "Failed to process exam pin purchase" });
    }
  });

  // ==================== SCHEDULED VTU PURCHASES ====================

  // Get user's scheduled purchases
  app.get("/api/vtu/scheduled-purchases", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const purchases = await storage.getScheduledPurchases(userId);
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching scheduled purchases:", error);
      res.status(500).json({ message: "Failed to fetch scheduled purchases" });
    }
  });

  // Create a scheduled purchase
  app.post("/api/vtu/scheduled-purchases", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = createScheduledPurchaseApiSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors,
        });
      }

      const { serviceType, planId, network, phoneNumber, amount, frequency, dayOfWeek, dayOfMonth, timeOfDay } = validationResult.data;

      if (!isValidNigerianPhone(phoneNumber)) {
        return res.status(400).json({ message: "Invalid Nigerian phone number" });
      }

      // Validate that data purchases have planId
      if (serviceType === "data" && !planId) {
        return res.status(400).json({ message: "Plan ID is required for data purchases" });
      }

      // Validate that airtime purchases have amount
      if (serviceType === "airtime" && !amount) {
        return res.status(400).json({ message: "Amount is required for airtime purchases" });
      }

      // Validate frequency-specific fields
      if (frequency === "weekly" && (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6)) {
        return res.status(400).json({ message: "Day of week (0-6) is required for weekly frequency" });
      }
      if (frequency === "monthly" && (dayOfMonth === undefined || dayOfMonth < 1 || dayOfMonth > 28)) {
        return res.status(400).json({ message: "Day of month (1-28) is required for monthly frequency" });
      }

      // Calculate next run time
      const now = new Date();
      let nextRunAt = new Date();
      const [hours, minutes] = (timeOfDay || "09:00").split(":").map(Number);
      nextRunAt.setHours(hours, minutes, 0, 0);

      if (frequency === "daily") {
        if (nextRunAt <= now) {
          nextRunAt.setDate(nextRunAt.getDate() + 1);
        }
      } else if (frequency === "weekly") {
        const currentDay = now.getDay();
        let daysUntilTarget = (dayOfWeek! - currentDay + 7) % 7;
        if (daysUntilTarget === 0 && nextRunAt <= now) {
          daysUntilTarget = 7;
        }
        nextRunAt.setDate(now.getDate() + daysUntilTarget);
      } else if (frequency === "monthly") {
        nextRunAt.setDate(dayOfMonth!);
        if (nextRunAt <= now) {
          nextRunAt.setMonth(nextRunAt.getMonth() + 1);
        }
      }

      const purchase = await storage.createScheduledPurchase({
        userId,
        serviceType,
        planId: planId || null,
        network,
        phoneNumber,
        amount: amount?.toString() || null,
        frequency,
        dayOfWeek: dayOfWeek ?? null,
        dayOfMonth: dayOfMonth ?? null,
        timeOfDay: timeOfDay || "09:00",
        nextRunAt,
        status: "active",
      });

      res.status(201).json(purchase);
    } catch (error) {
      console.error("Error creating scheduled purchase:", error);
      res.status(500).json({ message: "Failed to create scheduled purchase" });
    }
  });

  // Update a scheduled purchase
  app.put("/api/vtu/scheduled-purchases/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const existing = await storage.getScheduledPurchase(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Scheduled purchase not found" });
      }

      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this scheduled purchase" });
      }

      const updateData: Record<string, any> = {};
      const { status, phoneNumber, timeOfDay, frequency, dayOfWeek, dayOfMonth } = req.body;

      if (status && ["active", "paused", "cancelled"].includes(status)) {
        updateData.status = status;
      }

      if (phoneNumber) {
        if (!isValidNigerianPhone(phoneNumber)) {
          return res.status(400).json({ message: "Invalid Nigerian phone number" });
        }
        updateData.phoneNumber = phoneNumber;
      }

      if (timeOfDay) {
        updateData.timeOfDay = timeOfDay;
      }

      if (frequency) {
        updateData.frequency = frequency;
        if (frequency === "weekly" && dayOfWeek !== undefined) {
          updateData.dayOfWeek = dayOfWeek;
        }
        if (frequency === "monthly" && dayOfMonth !== undefined) {
          updateData.dayOfMonth = dayOfMonth;
        }
      }

      const updated = await storage.updateScheduledPurchase(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating scheduled purchase:", error);
      res.status(500).json({ message: "Failed to update scheduled purchase" });
    }
  });

  // Delete a scheduled purchase
  app.delete("/api/vtu/scheduled-purchases/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const existing = await storage.getScheduledPurchase(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Scheduled purchase not found" });
      }

      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this scheduled purchase" });
      }

      await storage.deleteScheduledPurchase(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting scheduled purchase:", error);
      res.status(500).json({ message: "Failed to delete scheduled purchase" });
    }
  });

  // ==================== GIFT DATA ====================

  // Get user's sent gifts
  app.get("/api/vtu/gift-data", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const gifts = await storage.getGiftsByUser(userId);
      res.json(gifts);
    } catch (error) {
      console.error("Error fetching gifts:", error);
      res.status(500).json({ message: "Failed to fetch gifts" });
    }
  });

  // Create a gift data
  app.post("/api/vtu/gift-data", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = createGiftDataApiSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors,
        });
      }

      const { recipientPhone, planId, network, message } = validationResult.data;

      if (!isValidNigerianPhone(recipientPhone)) {
        return res.status(400).json({ message: "Invalid Nigerian phone number" });
      }

      // Verify the plan exists
      const plan = await storage.getVtuPlan(planId);
      if (!plan) {
        return res.status(400).json({ message: "Invalid data plan" });
      }

      // Check if user has sufficient balance
      const wallet = await storage.getOrCreateWallet(userId);
      const planPrice = parseFloat(plan.sellingPrice);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < planPrice) {
        return res.status(400).json({
          message: "Insufficient wallet balance",
          required: planPrice,
          available: walletBalance,
        });
      }

      // Deduct from wallet
      await storage.updateWalletBalance(userId, planPrice.toString(), "subtract");

      // Create transaction record
      await storage.createTransaction({
        walletId: wallet.id,
        type: "purchase",
        amount: `-${planPrice}`,
        status: "completed",
        description: `Gift Data: ${plan.dataAmount} for ${recipientPhone}`,
      });

      // Generate unique gift code
      let giftCode = generateGiftCode();
      let existingGift = await storage.getGiftByCode(giftCode);
      while (existingGift) {
        giftCode = generateGiftCode();
        existingGift = await storage.getGiftByCode(giftCode);
      }

      // Set expiry (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const gift = await storage.createGiftData({
        senderId: userId,
        recipientPhone,
        planId,
        network,
        message: message || null,
        giftCode,
        status: "pending",
        expiresAt,
      });

      res.status(201).json({
        ...gift,
        plan,
        message: `Gift created successfully. Share the code ${giftCode} with the recipient.`,
      });
    } catch (error) {
      console.error("Error creating gift:", error);
      res.status(500).json({ message: "Failed to create gift" });
    }
  });

  // Claim a gift using gift code
  app.post("/api/vtu/gift-data/:code/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { code } = req.params;
      const gift = await storage.getGiftByCode(code.toUpperCase());

      if (!gift) {
        return res.status(404).json({ message: "Gift code not found" });
      }

      if (gift.status === "claimed") {
        return res.status(400).json({ message: "This gift has already been claimed" });
      }

      if (gift.status === "expired") {
        return res.status(400).json({ message: "This gift has expired" });
      }

      if (gift.status === "cancelled") {
        return res.status(400).json({ message: "This gift has been cancelled" });
      }

      if (gift.expiresAt && new Date(gift.expiresAt) < new Date()) {
        // Update status to expired
        await storage.claimGiftData(gift.id, userId);
        return res.status(400).json({ message: "This gift has expired" });
      }

      // Verify the plan still exists
      const plan = await storage.getVtuPlan(gift.planId);
      if (!plan) {
        return res.status(400).json({ message: "Data plan no longer available" });
      }

      // Process the data purchase if Inlomax is configured
      if (isInlomaxConfigured()) {
        try {
          // Map VTU network types to Inlomax network types
          const networkMapping: Record<string, string> = {
            'mtn_sme': 'mtn',
            'glo_cg': 'glo',
            'airtel_cg': 'airtel',
            '9mobile': '9mobile'
          };
          const mappedNetwork = networkMapping[gift.network] || gift.network;
          
          const purchaseResult = await purchaseData(mappedNetwork as any, gift.recipientPhone, plan.dataAmount);
          
          if (purchaseResult.success) {
            // Create VTU transaction record
            const transaction = await storage.createVtuTransaction({
              userId: gift.senderId,
              planId: gift.planId,
              network: gift.network,
              phoneNumber: gift.recipientPhone,
              amount: plan.sellingPrice,
              costPrice: plan.costPrice,
              profit: (parseFloat(plan.sellingPrice) - parseFloat(plan.costPrice)).toFixed(2),
              status: "success",
              smedataReference: purchaseResult.reference,
            });

            // Update gift as claimed with transaction reference
            const claimedGift = await storage.claimGiftData(gift.id, userId);

            res.json({
              success: true,
              message: `Gift claimed successfully! ${plan.dataAmount} data sent to ${gift.recipientPhone}`,
              gift: claimedGift,
            });
          } else {
            res.status(400).json({
              success: false,
              message: purchaseResult.message || "Failed to process the gift data. Please try again.",
            });
          }
        } catch (apiError: any) {
          console.error("Gift data claim API error:", apiError);
          res.status(500).json({
            success: false,
            message: "Failed to process gift due to network error. Please try again.",
          });
        }
      } else {
        // Inlomax not configured - just mark as claimed
        const claimedGift = await storage.claimGiftData(gift.id, userId);
        res.json({
          success: true,
          message: "Gift claimed successfully! Your data will be delivered shortly.",
          gift: claimedGift,
        });
      }
    } catch (error) {
      console.error("Error claiming gift:", error);
      res.status(500).json({ message: "Failed to claim gift" });
    }
  });

  // ==================== ADMIN VTU ENDPOINTS ====================

  // Admin endpoint: Update VTU plan pricing (manual management)
  app.post("/api/admin/vtu/update-plan", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can update VTU plans" });
      }

      const { planId, costPrice, sellingPrice, isActive } = req.body;
      
      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }

      const plan = await storage.getVtuPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: "VTU plan not found" });
      }

      // Update plan with new pricing
      await storage.upsertVtuPlan({
        network: plan.network as any,
        planName: plan.planName,
        dataAmount: plan.dataAmount,
        validity: plan.validity,
        costPrice: costPrice ?? plan.costPrice,
        sellingPrice: sellingPrice ?? plan.sellingPrice,
        planCode: plan.planCode,
        isActive: isActive ?? plan.isActive,
        sortOrder: plan.sortOrder ?? 0,
      });

      console.log(`[VTU Admin] Updated plan ${plan.planName}: cost=${costPrice}, sell=${sellingPrice}, active=${isActive}`);

      res.json({
        success: true,
        message: `Plan "${plan.planName}" updated successfully`,
      });
    } catch (error: any) {
      console.error("[VTU Admin] Error updating VTU plan:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to update VTU plan",
      });
    }
  });

  // Admin endpoint: Add new VTU plan
  app.post("/api/admin/vtu/add-plan", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can add VTU plans" });
      }

      const { network, planName, dataAmount, validity, costPrice, sellingPrice, planCode, sortOrder } = req.body;
      
      if (!network || !planName || !dataAmount || !costPrice || !sellingPrice) {
        return res.status(400).json({ 
          message: "Missing required fields: network, planName, dataAmount, costPrice, sellingPrice" 
        });
      }

      // Validate network (only MTN, GLO, AIRTEL supported - no 9mobile)
      const validNetworks = ["mtn_sme", "glo_cg", "airtel_cg"];
      if (!validNetworks.includes(network)) {
        return res.status(400).json({ message: "Invalid network. Must be one of: " + validNetworks.join(", ") });
      }

      // Check for duplicate
      const existing = await storage.getVtuPlanByNetworkAndDataAmount(network, dataAmount);
      if (existing) {
        return res.status(409).json({ message: `Plan for ${network} ${dataAmount} already exists` });
      }

      await storage.upsertVtuPlan({
        network: network as any,
        planName,
        dataAmount: dataAmount.toUpperCase(),
        validity: validity || "30 days",
        costPrice,
        sellingPrice,
        planCode: planCode || `${network}_${dataAmount}`.toLowerCase().replace(/\s+/g, "_"),
        isActive: true,
        sortOrder: sortOrder ?? 0,
      });

      console.log(`[VTU Admin] Added new plan: ${planName}`);

      res.json({
        success: true,
        message: `Plan "${planName}" added successfully`,
      });
    } catch (error: any) {
      console.error("[VTU Admin] Error adding VTU plan:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to add VTU plan",
      });
    }
  });

  // Admin endpoint: Requery order/transaction status
  app.post("/api/admin/vtu/requery", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can requery orders" });
      }

      const { transactionId } = req.body;
      if (!transactionId) {
        return res.status(400).json({ message: "Transaction ID is required" });
      }

      if (!isInlomaxConfigured()) {
        return res.status(503).json({ 
          success: false,
          message: "VTU service is not configured",
        });
      }

      const result = await checkTransactionStatus(transactionId);
      res.json(result);
    } catch (error: any) {
      console.error("[VTU Admin] Error requerying transaction:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to requery transaction",
      });
    }
  });

  // Admin endpoint: Get all VTU plans (including inactive)
  app.get("/api/admin/vtu/all-plans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can view all VTU plans" });
      }

      const plans = await storage.getAllVtuPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching all VTU plans:", error);
      res.status(500).json({ message: "Failed to fetch VTU plans" });
    }
  });
}

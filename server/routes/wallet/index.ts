import type { Express } from "express";
import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { isAuthenticated } from "../../auth";
import { storage } from "../../storage";
import { 
  squad, 
  generatePaymentReference, 
  generateTransferReference, 
  isSquadConfigured, 
  getSquadConfigStatus, 
  getTestCardInfo,
  SquadApiError, 
  SquadErrorType 
} from "../../squad";
import { 
  calculatePricingFromSellerPrice, 
  getCommissionRate, 
  getSecurityDepositAmount, 
  isWithdrawalAllowed 
} from "../../pricing";
import { 
  getUserId, 
  requireEmailVerified, 
  requireAdmin,
  createAndBroadcastNotification 
} from "../common";
import { sendErrorReportToAdmin, sendOrderEmail } from "../../email-service";
import { isInlomaxConfigured } from "../../inlomax";
import { 
  initiateSquadPaymentSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  type Order 
} from "../../../shared/schema";

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EKSU-${timestamp}-${random}`;
}

const validStatusTransitions: Record<string, string[]> = {
  'pending': ['paid', 'cancelled'],
  'paid': ['seller_confirmed', 'cancelled', 'disputed'],
  'seller_confirmed': ['preparing', 'cancelled', 'disputed'],
  'preparing': ['ready_for_pickup', 'shipped', 'cancelled', 'disputed'],
  'ready_for_pickup': ['shipped', 'out_for_delivery', 'delivered', 'cancelled', 'disputed'],
  'shipped': ['out_for_delivery', 'delivered', 'cancelled', 'disputed'],
  'out_for_delivery': ['delivered', 'cancelled', 'disputed'],
  'delivered': ['buyer_confirmed', 'disputed'],
  'buyer_confirmed': ['completed'],
  'completed': [],
  'cancelled': [],
  'disputed': ['refunded', 'completed'],
  'refunded': [],
};

const statusTransitionPermissions: Record<string, 'buyer' | 'seller' | 'both' | 'system'> = {
  'paid': 'system',
  'seller_confirmed': 'seller',
  'preparing': 'seller',
  'ready_for_pickup': 'seller',
  'shipped': 'seller',
  'out_for_delivery': 'seller',
  'delivered': 'seller',
  'buyer_confirmed': 'buyer',
  'completed': 'system',
  'cancelled': 'both',
  'disputed': 'both',
  'refunded': 'system',
};

function getHttpStatusForSquadError(errorType: SquadErrorType): number {
  switch (errorType) {
    case SquadErrorType.INVALID_REQUEST:
      return 400;
    case SquadErrorType.INVALID_CREDENTIALS:
      return 503;
    case SquadErrorType.INSUFFICIENT_FUNDS:
      return 402;
    case SquadErrorType.RATE_LIMITED:
      return 429;
    case SquadErrorType.TIMEOUT:
    case SquadErrorType.NETWORK_ERROR:
    case SquadErrorType.SERVER_ERROR:
      return 503;
    default:
      return 500;
  }
}

export function registerWalletRoutes(app: Express): void {
  
  // ==================== WALLET ROUTES ====================

  app.get('/api/wallet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const wallet = await storage.getOrCreateWallet(userId);
      res.json(wallet);
    } catch (error) {
      console.error("Error fetching wallet:", error);
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  app.get('/api/wallet/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const wallet = await storage.getOrCreateWallet(userId);
      const transactions = await storage.getUserTransactions(wallet.id);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post('/api/wallet/deposit', isAuthenticated, requireEmailVerified, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { amount } = req.body;

      if (!amount || parseFloat(amount) < 100) {
        return res.status(400).json({ message: "Minimum deposit is 100 NGN" });
      }

      const wallet = await storage.getOrCreateWallet(userId);
      
      await storage.createTransaction({
        walletId: wallet.id,
        type: 'deposit',
        amount: amount.toString(),
        description: 'Wallet deposit',
        status: 'pending',
      });

      res.json({ 
        message: "Deposit initiated. Please complete payment.",
        amount: amount
      });
    } catch (error) {
      console.error("Error initiating deposit:", error);
      res.status(500).json({ message: "Failed to initiate deposit" });
    }
  });

  app.post('/api/wallet/withdraw', isAuthenticated, requireEmailVerified, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { amount, bankName, accountNumber, accountName, pin } = req.body;

      if (!amount || parseFloat(amount) < 500) {
        return res.status(400).json({ message: "Minimum withdrawal is 500 NGN" });
      }

      if (!bankName || !accountNumber || !accountName) {
        return res.status(400).json({ message: "Bank details are required" });
      }

      const pinData = await storage.getTransactionPin(userId);
      if (pinData?.transactionPinSet) {
        if (!pin) {
          return res.status(400).json({ 
            message: "Transaction PIN is required for withdrawals",
            pinRequired: true
          });
        }

        const isLocked = await storage.isUserPinLocked(userId);
        if (isLocked) {
          const lockUntil = pinData?.pinLockUntil;
          const remainingMinutes = lockUntil ? Math.ceil((new Date(lockUntil).getTime() - Date.now()) / 60000) : 30;
          return res.status(429).json({ 
            message: `PIN is temporarily locked. Try again in ${remainingMinutes} minutes.`,
            locked: true,
            remainingMinutes
          });
        }

        const isValid = await bcrypt.compare(pin, pinData.transactionPin!);
        if (!isValid) {
          const attempts = await storage.incrementPinAttempts(userId);
          const remainingAttempts = 5 - attempts;
          
          if (remainingAttempts <= 0) {
            const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
            await storage.lockPin(userId, lockUntil);
            return res.status(429).json({ 
              message: "Too many failed attempts. PIN is locked for 30 minutes.",
              locked: true,
              remainingMinutes: 30
            });
          }
          
          return res.status(401).json({ 
            message: `Incorrect PIN. ${remainingAttempts} attempts remaining.`,
            remainingAttempts
          });
        }

        await storage.resetPinAttempts(userId);
      }

      const wallet = await storage.getOrCreateWallet(userId);
      
      if (parseFloat(wallet.balance) < parseFloat(amount)) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      await storage.updateWalletBalance(userId, amount.toString(), 'subtract');
      
      await storage.createTransaction({
        walletId: wallet.id,
        type: 'withdrawal',
        amount: amount.toString(),
        description: `Withdrawal to ${bankName} - ${accountNumber}`,
        status: 'pending',
      });

      res.json({ message: "Withdrawal request submitted successfully" });
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // ==================== SQUAD PAYMENT ROUTES ====================

  app.get('/api/squad/test-cards', (req, res) => {
    const testInfo = getTestCardInfo();
    
    if (!testInfo.isSandbox) {
      return res.json({
        isSandbox: false,
        message: "Test cards are only available in sandbox mode. Current mode is production.",
        testCards: [],
        instructions: []
      });
    }
    
    res.json(testInfo);
  });

  app.get('/api/squad/status', (req, res) => {
    const status = getSquadConfigStatus();
    
    const testCards = status.mode === 'sandbox' ? {
      success: {
        cardNumber: '5200000000000007',
        expiryDate: '12/25',
        cvv: '123',
        pin: '1234',
        otp: '123456',
        description: 'Successful transaction'
      },
      declined: {
        cardNumber: '5200000000000015',
        expiryDate: '12/25',
        cvv: '123',
        pin: '1234',
        otp: '123456',
        description: 'Declined transaction'
      },
      insufficientFunds: {
        cardNumber: '5200000000000023',
        expiryDate: '12/25',
        cvv: '123',
        pin: '1234',
        otp: '123456',
        description: 'Insufficient funds'
      }
    } : null;
    
    res.json({ 
      configured: status.configured,
      mode: status.mode,
      testCards,
      message: status.mode === 'sandbox' 
        ? 'Sandbox mode: Use test cards above for testing. For bank transfer, payments complete instantly.'
        : status.configured ? 'Live mode: Real transactions enabled' : 'Payment not configured'
    });
  });

  app.post('/api/squad/initialize', isAuthenticated, async (req: any, res) => {
    const requestId = crypto.randomBytes(4).toString('hex');
    
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ 
          message: "Payment service is not configured. Please contact support.",
          code: "SERVICE_UNAVAILABLE"
        });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const validated = initiateSquadPaymentSchema.parse(req.body);
      const amount = parseFloat(validated.amount);

      if (amount < 100) {
        return res.status(400).json({ message: "Minimum payment amount is ₦100" });
      }

      const paymentReference = generatePaymentReference();
      const redirectUrl = `${process.env.APP_URL || 'https://eksu-marketplace.replit.app'}/payment/callback`;

      const paymentChannels: ('card' | 'bank' | 'ussd' | 'transfer')[] = validated.paymentChannel 
        ? [validated.paymentChannel] 
        : ['transfer', 'card', 'ussd'];

      console.log(`[Payment ${requestId}] Initializing Squad payment for user ${userId}, amount: ₦${amount}`);

      const paymentResult = await squad.initializePayment({
        amount,
        email: user.email,
        customerName: `${user.firstName} ${user.lastName}`,
        transactionRef: paymentReference,
        callbackUrl: redirectUrl,
        paymentChannels,
        metadata: {
          userId,
          purpose: validated.purpose,
          paymentDescription: validated.paymentDescription || `${validated.purpose} - EKSU Marketplace`,
        },
      });

      await storage.createSquadPayment({
        userId,
        transactionRef: paymentResult.transactionRef,
        amount: amount.toString(),
        purpose: validated.purpose,
        status: 'pending',
        paymentDescription: validated.paymentDescription || null,
      });

      console.log(`[Payment ${requestId}] Squad payment initialized successfully: ${paymentResult.transactionRef}`);

      res.json({
        checkoutUrl: paymentResult.checkoutUrl,
        transactionReference: paymentResult.transactionRef,
        paymentReference,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid payment details. Please check your input and try again.",
          code: "VALIDATION_ERROR",
          errors: error.errors 
        });
      }

      if (error instanceof SquadApiError) {
        console.error(`[Payment ${requestId}] Squad API Error:`, {
          type: error.type,
          message: error.message,
          statusCode: error.statusCode,
          userMessage: error.userMessage,
        });

        if (!error.isRetryable) {
          sendErrorReportToAdmin(
            `Squad Payment Error [${requestId}]`,
            error.message,
            {
              type: error.type,
              statusCode: error.statusCode,
              rawError: error.rawError,
              userId: req.user?.id,
            }
          ).catch(console.error);
        }

        return res.status(getHttpStatusForSquadError(error.type)).json({
          message: error.userMessage,
          code: error.type,
          isRetryable: error.isRetryable,
        });
      }

      console.error(`[Payment ${requestId}] Unexpected error initializing Squad payment:`, error);
      
      sendErrorReportToAdmin(
        `Unexpected Payment Error [${requestId}]`,
        error instanceof Error ? error.message : 'Unknown error',
        { stack: error instanceof Error ? error.stack : undefined, userId: req.user?.id }
      ).catch(console.error);

      res.status(500).json({ 
        message: "Unable to process your payment at this time. Please try again later or contact support.",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.get('/api/squad/verify/:reference', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ message: "Payment service is not configured" });
      }

      const { reference } = req.params;
      const userId = req.user.id;

      const payment = await storage.getSquadPaymentByReference(reference);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      if (payment.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to verify this payment" });
      }

      const transactionStatus = await squad.verifyTransaction(reference);

      const paidAt = transactionStatus.transactionStatus === 'success' && transactionStatus.createdAt
        ? new Date(transactionStatus.createdAt)
        : undefined;
      
      await storage.updateSquadPaymentStatus(reference, transactionStatus.transactionStatus, paidAt);

      if (transactionStatus.transactionStatus === 'success' && payment.status !== 'successful') {
        const wallet = await storage.getOrCreateWallet(userId);
        await storage.updateWalletBalance(userId, payment.amount, 'add');
        
        await storage.createTransaction({
          walletId: wallet.id,
          type: 'deposit',
          amount: payment.amount,
          description: `Squad deposit - ${payment.purpose}`,
          status: 'completed',
        });
      }

      res.json({
        status: transactionStatus.transactionStatus,
        amountPaid: transactionStatus.transactionAmount,
        paymentMethod: transactionStatus.transactionType || 'unknown',
        paidOn: transactionStatus.createdAt,
      });
    } catch (error) {
      console.error("Error verifying Squad payment:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to verify payment" });
    }
  });

  app.get('/api/squad/payments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const payments = await storage.getUserSquadPayments(userId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching Squad payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post('/api/squad/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['squad-signature'] as string;
      const payload = req.body.toString();

      if (!signature || !squad.verifyWebhookSignature(payload, signature)) {
        console.error("Invalid Squad webhook signature");
        return res.status(401).json({ message: "Invalid signature" });
      }

      const webhookData = JSON.parse(payload);
      const { transactionReference, paymentStatus, amountPaid, paidOn } = webhookData;

      const payment = await storage.getSquadPaymentByReference(transactionReference);
      if (!payment) {
        console.error(`Squad webhook: Payment not found for reference ${transactionReference}`);
        return res.status(404).json({ message: "Payment not found" });
      }

      const paidAtDate = paymentStatus === 'success' && paidOn ? new Date(paidOn) : undefined;
      await storage.updateSquadPaymentStatus(transactionReference, paymentStatus, paidAtDate);

      if (paymentStatus === 'success' && payment.status !== 'successful') {
        const wallet = await storage.getOrCreateWallet(payment.userId);
        await storage.updateWalletBalance(payment.userId, amountPaid.toString(), 'add');
        
        await storage.createTransaction({
          walletId: wallet.id,
          type: 'deposit',
          amount: amountPaid.toString(),
          description: `Squad deposit - ${payment.purpose}`,
          status: 'completed',
        });

        console.log(`Squad webhook: Credited ₦${amountPaid} to user ${payment.userId}`);
      }

      res.json({ message: "Webhook processed successfully" });
    } catch (error) {
      console.error("Error processing Squad webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  app.get('/api/squad/banks', async (req, res) => {
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ message: "Payment service is not configured" });
      }

      const banks = await squad.getBankList();
      res.json(banks);
    } catch (error) {
      console.error("Error fetching bank list:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch bank list" });
    }
  });

  app.post('/api/squad/verify-bank', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ message: "Payment service is not configured" });
      }

      const { accountNumber, bankCode } = req.body;

      if (!accountNumber || !bankCode) {
        return res.status(400).json({ message: "Account number and bank code are required" });
      }

      const accountDetails = await squad.verifyBankAccount(accountNumber, bankCode);
      res.json(accountDetails);
    } catch (error) {
      console.error("Error verifying bank account:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to verify bank account" });
    }
  });

  app.get('/api/squad/verify-account', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ message: "Payment service is not configured" });
      }

      const { accountNumber, bankCode } = req.query;

      if (!accountNumber || !bankCode) {
        return res.status(400).json({ message: "Account number and bank code are required" });
      }

      if (typeof accountNumber !== 'string' || accountNumber.length !== 10) {
        return res.status(400).json({ message: "Account number must be 10 digits" });
      }

      if (typeof bankCode !== 'string') {
        return res.status(400).json({ message: "Bank code is required" });
      }

      const accountDetails = await squad.verifyBankAccount(accountNumber, bankCode);
      res.json(accountDetails);
    } catch (error) {
      console.error("Error verifying bank account:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to verify bank account" });
    }
  });

  app.post('/api/squad/withdraw', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ message: "Payment service is not configured" });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { amount, bankCode, bankName, accountNumber, accountName } = req.body;
      const withdrawAmount = parseFloat(amount);

      if (!withdrawAmount || withdrawAmount < 500) {
        return res.status(400).json({ message: "Minimum withdrawal is ₦500" });
      }

      if (!bankCode || !bankName || !accountNumber || !accountName) {
        return res.status(400).json({ message: "Bank details are required" });
      }

      const wallet = await storage.getOrCreateWallet(userId);
      const balance = parseFloat(wallet.balance);

      const withdrawalCheck = isWithdrawalAllowed(
        withdrawAmount,
        user.isVerified || false,
        balance,
        0
      );

      if (!withdrawalCheck.allowed) {
        return res.status(400).json({ message: withdrawalCheck.reason });
      }

      const reference = generateTransferReference();

      await storage.createSquadTransfer({
        userId,
        transactionRef: reference,
        amount: withdrawAmount.toString(),
        bankCode,
        accountNumber,
        accountName,
        status: 'pending',
      });

      await storage.updateWalletBalance(userId, withdrawAmount.toString(), 'subtract');

      await storage.createTransaction({
        walletId: wallet.id,
        type: 'withdrawal',
        amount: withdrawAmount.toString(),
        description: `Withdrawal to ${bankName} - ${accountNumber}`,
        status: 'pending',
      });

      try {
        const transferResult = await squad.initiateTransfer({
          amount: withdrawAmount,
          transactionReference: reference,
          remark: `EKSU Marketplace withdrawal - ${user.firstName} ${user.lastName}`,
          bankCode,
          accountNumber,
          accountName,
        });

        await storage.updateSquadTransferStatus(
          reference,
          transferResult.status,
          undefined,
          transferResult.status === 'success' ? new Date() : undefined
        );

        res.json({
          message: "Withdrawal initiated successfully",
          reference,
          status: transferResult.status,
        });
      } catch (transferError: any) {
        const errorMessage = transferError?.message?.toLowerCase() || '';
        const isSquadError = transferError?.name === 'SquadApiError';
        
        const isMerchantEligibilityError = isSquadError && (
          errorMessage.includes('not eligible') || 
          errorMessage.includes('merchant') ||
          transferError?.type === 'INVALID_CREDENTIALS'
        );
        
        if (isMerchantEligibilityError) {
          console.log('[Withdrawal] Merchant eligibility issue detected, marking for manual processing');
          
          await storage.updateSquadTransferStatus(reference, 'manual_review', 'Merchant account requires transfer activation - manual payout required');
          
          return res.json({ 
            message: "Withdrawal request accepted. Due to a temporary system issue, your withdrawal will be processed manually within 24 hours. You will receive a notification when complete.",
            reference,
            status: 'manual_review',
            amount: withdrawAmount,
            bankDetails: { bankName, accountNumber, accountName },
            manualProcessing: true
          });
        }
        
        await storage.updateWalletBalance(userId, withdrawAmount.toString(), 'add');
        await storage.updateSquadTransferStatus(reference, 'failed', String(transferError));
        
        throw transferError;
      }
    } catch (error: any) {
      console.error("Error processing Squad withdrawal:", error);
      
      const userMessage = error?.userMessage || error?.message || "Failed to process withdrawal";
      res.status(500).json({ message: userMessage });
    }
  });

  // ==================== NEGOTIATION ROUTES ====================

  app.post('/api/negotiations', isAuthenticated, requireEmailVerified, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const { productId, offerPrice, message } = req.body;

      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }
      if (!offerPrice || isNaN(parseFloat(offerPrice))) {
        return res.status(400).json({ message: "Valid offer price is required" });
      }

      const offerPriceNum = parseFloat(offerPrice);

      if (offerPriceNum <= 0) {
        return res.status(400).json({ message: "Offer price must be greater than 0" });
      }

      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (!product.isAvailable || product.isSold) {
        return res.status(400).json({ message: "Product is not available for negotiation" });
      }

      if (product.sellerId === userId) {
        return res.status(400).json({ message: "You cannot make an offer on your own product" });
      }

      const originalPrice = parseFloat(product.price);
      if (offerPriceNum > originalPrice) {
        return res.status(400).json({ message: "Offer price cannot be higher than the original price" });
      }

      const negotiation = await storage.createNegotiation({
        productId,
        buyerId: userId,
        sellerId: product.sellerId,
        originalPrice: product.price,
        offerPrice: offerPriceNum.toFixed(2),
        message: message || null,
        status: 'pending',
      });

      res.status(201).json({
        ...negotiation,
        product: {
          id: product.id,
          title: product.title,
          price: product.price,
          images: product.images,
        },
      });
    } catch (error) {
      console.error("Error creating negotiation:", error);
      res.status(500).json({ message: "Failed to create negotiation" });
    }
  });

  app.get('/api/negotiations/received', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const statusFilter = req.query.status as string | undefined;

      const negotiations = await storage.getUserNegotiations(userId);
      
      let receivedNegotiations = negotiations.filter(n => n.sellerId === userId);

      if (statusFilter) {
        receivedNegotiations = receivedNegotiations.filter(n => n.status === statusFilter);
      }

      const enrichedNegotiations = await Promise.all(
        receivedNegotiations.map(async (negotiation) => {
          const product = await storage.getProduct(negotiation.productId);
          const buyer = await storage.getUser(negotiation.buyerId);
          return {
            ...negotiation,
            product: product ? {
              id: product.id,
              title: product.title,
              price: product.price,
              images: product.images,
            } : null,
            buyer: buyer ? {
              id: buyer.id,
              firstName: buyer.firstName,
              lastName: buyer.lastName,
              profileImageUrl: buyer.profileImageUrl,
            } : null,
          };
        })
      );

      res.json(enrichedNegotiations);
    } catch (error) {
      console.error("Error fetching received negotiations:", error);
      res.status(500).json({ message: "Failed to fetch received negotiations" });
    }
  });

  app.get('/api/negotiations/sent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const negotiations = await storage.getUserNegotiations(userId);
      
      const sentNegotiations = negotiations.filter(n => n.buyerId === userId);

      const enrichedNegotiations = await Promise.all(
        sentNegotiations.map(async (negotiation) => {
          const product = await storage.getProduct(negotiation.productId);
          const seller = await storage.getUser(negotiation.sellerId);
          return {
            ...negotiation,
            product: product ? {
              id: product.id,
              title: product.title,
              price: product.price,
              images: product.images,
            } : null,
            seller: seller ? {
              id: seller.id,
              firstName: seller.firstName,
              lastName: seller.lastName,
              profileImageUrl: seller.profileImageUrl,
            } : null,
          };
        })
      );

      res.json(enrichedNegotiations);
    } catch (error) {
      console.error("Error fetching sent negotiations:", error);
      res.status(500).json({ message: "Failed to fetch sent negotiations" });
    }
  });

  app.get('/api/negotiations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const negotiation = await storage.getNegotiation(id);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }

      if (negotiation.buyerId !== userId && negotiation.sellerId !== userId) {
        return res.status(403).json({ message: "You do not have access to this negotiation" });
      }

      const product = await storage.getProduct(negotiation.productId);
      const buyer = await storage.getUser(negotiation.buyerId);
      const seller = await storage.getUser(negotiation.sellerId);

      res.json({
        ...negotiation,
        product: product ? {
          id: product.id,
          title: product.title,
          price: product.price,
          images: product.images,
          description: product.description,
        } : null,
        buyer: buyer ? {
          id: buyer.id,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          profileImageUrl: buyer.profileImageUrl,
        } : null,
        seller: seller ? {
          id: seller.id,
          firstName: seller.firstName,
          lastName: seller.lastName,
          profileImageUrl: seller.profileImageUrl,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching negotiation:", error);
      res.status(500).json({ message: "Failed to fetch negotiation" });
    }
  });

  app.post('/api/negotiations/:id/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const negotiation = await storage.getNegotiation(id);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }

      if (negotiation.sellerId !== userId) {
        return res.status(403).json({ message: "Only the seller can accept an offer" });
      }

      if (negotiation.status !== 'pending') {
        return res.status(400).json({ message: `Cannot accept a negotiation with status '${negotiation.status}'` });
      }

      const updated = await storage.updateNegotiationStatus(id, 'accepted', {
        acceptedAt: new Date(),
      });

      if (!updated) {
        return res.status(500).json({ message: "Failed to update negotiation" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error accepting negotiation:", error);
      res.status(500).json({ message: "Failed to accept negotiation" });
    }
  });

  app.post('/api/negotiations/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const negotiation = await storage.getNegotiation(id);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }

      if (negotiation.sellerId !== userId) {
        return res.status(403).json({ message: "Only the seller can reject an offer" });
      }

      if (negotiation.status !== 'pending') {
        return res.status(400).json({ message: `Cannot reject a negotiation with status '${negotiation.status}'` });
      }

      const updated = await storage.updateNegotiationStatus(id, 'rejected', {
        rejectedAt: new Date(),
      });

      if (!updated) {
        return res.status(500).json({ message: "Failed to update negotiation" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error rejecting negotiation:", error);
      res.status(500).json({ message: "Failed to reject negotiation" });
    }
  });

  app.post('/api/negotiations/:id/counter', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { counterPrice, counterMessage } = req.body;

      if (!counterPrice || isNaN(parseFloat(counterPrice))) {
        return res.status(400).json({ message: "Valid counter price is required" });
      }

      const counterPriceNum = parseFloat(counterPrice);
      if (counterPriceNum <= 0) {
        return res.status(400).json({ message: "Counter price must be greater than 0" });
      }

      const negotiation = await storage.getNegotiation(id);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }

      if (negotiation.sellerId !== userId) {
        return res.status(403).json({ message: "Only the seller can make a counter offer" });
      }

      if (negotiation.status !== 'pending') {
        return res.status(400).json({ message: `Cannot counter a negotiation with status '${negotiation.status}'` });
      }

      const offerPriceNum = parseFloat(negotiation.offerPrice);
      const originalPriceNum = parseFloat(negotiation.originalPrice);
      
      if (counterPriceNum < offerPriceNum) {
        return res.status(400).json({ message: "Counter price cannot be lower than the buyer's offer" });
      }
      if (counterPriceNum > originalPriceNum) {
        return res.status(400).json({ message: "Counter price cannot be higher than the original price" });
      }

      const updated = await storage.updateNegotiationStatus(id, 'countered', {
        counterOfferPrice: counterPriceNum.toFixed(2),
        sellerMessage: counterMessage || null,
        rejectedAt: new Date(),
      });

      if (!updated) {
        return res.status(500).json({ message: "Failed to update negotiation" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error creating counter offer:", error);
      res.status(500).json({ message: "Failed to create counter offer" });
    }
  });

  app.post('/api/negotiations/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const negotiation = await storage.getNegotiation(id);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }

      if (negotiation.buyerId !== userId) {
        return res.status(403).json({ message: "Only the buyer can cancel an offer" });
      }

      if (negotiation.status !== 'pending') {
        return res.status(400).json({ message: `Cannot cancel a negotiation with status '${negotiation.status}'` });
      }

      const updated = await storage.updateNegotiationStatus(id, 'cancelled', {});

      if (!updated) {
        return res.status(500).json({ message: "Failed to update negotiation" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error cancelling negotiation:", error);
      res.status(500).json({ message: "Failed to cancel negotiation" });
    }
  });

  // ==================== PRICING ROUTES ====================

  app.post('/api/pricing/calculate', (req, res) => {
    try {
      const { sellerPrice, paymentMethod } = req.body;
      
      if (!sellerPrice || isNaN(parseFloat(sellerPrice))) {
        return res.status(400).json({ message: "Valid seller price is required" });
      }

      const pricing = calculatePricingFromSellerPrice(
        parseFloat(sellerPrice),
        paymentMethod || 'CARD'
      );

      res.json(pricing);
    } catch (error) {
      console.error("Error calculating pricing:", error);
      res.status(500).json({ message: "Failed to calculate pricing" });
    }
  });

  app.get('/api/pricing/config', (req, res) => {
    res.json({
      commissionRate: getCommissionRate(),
      securityDepositAmount: getSecurityDepositAmount(),
    });
  });

  // ==================== ORDER ROUTES ====================

  app.post("/api/orders", isAuthenticated, requireEmailVerified, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = createOrderSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.flatten().fieldErrors 
        });
      }

      const { productId, deliveryMethod, deliveryAddress, deliveryNotes, quantity } = validationResult.data;
      const { negotiationId } = req.body;

      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      if (!product.isAvailable) {
        return res.status(400).json({ message: "Product is not available" });
      }

      if (product.sellerId === userId) {
        return res.status(400).json({ message: "You cannot purchase your own product" });
      }

      let itemPriceNum = parseFloat(product.price as string);
      
      if (negotiationId) {
        const negotiation = await storage.getNegotiation(negotiationId);
        if (negotiation && negotiation.status === 'accepted' && negotiation.buyerId === userId) {
          const negotiatedPrice = negotiation.counterOfferPrice || negotiation.offerPrice;
          itemPriceNum = parseFloat(negotiatedPrice as string);
        }
      }

      const pricing = calculatePricingFromSellerPrice(itemPriceNum);
      
      const orderNumber = generateOrderNumber();

      const order = await storage.createOrder({
        buyerId: userId,
        sellerId: product.sellerId,
        productId,
        totalAmount: pricing.buyerPays.toFixed(2),
        deliveryMethod: deliveryMethod || "meetup",
        deliveryAddress: deliveryAddress || null,
        deliveryFee: "0.00",
        quantity: String(quantity || 1),
        notes: deliveryNotes || null,
      });

      await storage.addOrderStatusHistory({
        orderId: order.id,
        status: "pending",
        changedBy: userId,
        note: "Order created",
      });

      const buyer = await storage.getUser(userId);
      if (buyer) {
        const buyerName = buyer.firstName && buyer.lastName 
          ? `${buyer.firstName} ${buyer.lastName}` 
          : buyer.email;
        
        await createAndBroadcastNotification({
          userId: product.sellerId,
          type: "order_placed",
          title: "New Order Received",
          message: `${buyerName} placed an order for "${product.title}" - Order #${orderNumber}`,
          link: `/seller-dashboard`,
          relatedUserId: userId,
          relatedProductId: productId,
        });
      }

      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.get("/api/orders/buyer", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const orders = await storage.getBuyerOrders(userId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching buyer orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/seller", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const orders = await storage.getSellerOrders(userId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching seller orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const order = await storage.getOrder(id);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.buyerId !== userId && order.sellerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to view this order" });
      }

      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.put("/api/orders/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const validationResult = updateOrderStatusSchema.safeParse({ orderId: id, ...req.body });
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.flatten().fieldErrors 
        });
      }

      const { status, note } = validationResult.data;

      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const isBuyer = order.buyerId === userId;
      const isSeller = order.sellerId === userId;

      if (!isBuyer && !isSeller) {
        return res.status(403).json({ message: "You don't have permission to update this order" });
      }

      const currentStatus = order.status;
      const allowedTransitions = validStatusTransitions[currentStatus] || [];
      
      if (!allowedTransitions.includes(status)) {
        return res.status(400).json({ 
          message: `Cannot transition from '${currentStatus}' to '${status}'`,
          allowedTransitions 
        });
      }

      const requiredRole = statusTransitionPermissions[status];
      if (requiredRole === 'buyer' && !isBuyer) {
        return res.status(403).json({ message: "Only the buyer can set this status" });
      }
      if (requiredRole === 'seller' && !isSeller) {
        return res.status(403).json({ message: "Only the seller can set this status" });
      }
      if (requiredRole === 'system') {
        return res.status(403).json({ message: "This status can only be set by the system" });
      }

      const updatedOrder = await storage.updateOrderStatus(id, status, userId, note);

      try {
        const buyer = order.buyerId ? await storage.getUser(order.buyerId) : null;
        const seller = order.sellerId ? await storage.getUser(order.sellerId) : null;
        const product = order.productId ? await storage.getProduct(order.productId) : null;
        
        if (buyer && product && seller) {
          const statusMessages: Record<string, 'confirmation' | 'shipped' | 'delivered' | 'completed'> = {
            'awaiting_payment': 'confirmation',
            'confirmed': 'confirmation',
            'shipped': 'shipped',
            'delivered': 'delivered',
            'completed': 'completed',
          };
          
          const emailType = statusMessages[status] || 'confirmation';
          const sellerName = seller.firstName && seller.lastName ? `${seller.firstName} ${seller.lastName}` : seller.username || seller.email;
          const buyerDisplayName = buyer.firstName || undefined;
          
          sendOrderEmail(buyer.email, {
            orderId: id,
            productName: product.title,
            totalAmount: order.totalAmount.toString(),
            sellerName,
            buyerName: buyerDisplayName,
            type: emailType,
          }).catch(err => console.error("Failed to send buyer order email:", err));
          
          const buyerName = buyer.firstName && buyer.lastName ? `${buyer.firstName} ${buyer.lastName}` : buyer.username || buyer.email;
          sendOrderEmail(seller.email, {
            orderId: id,
            productName: product.title,
            totalAmount: order.totalAmount.toString(),
            sellerName: buyerName,
            type: emailType,
          }).catch(err => console.error("Failed to send seller order email:", err));
        }
      } catch (emailErr) {
        console.error("Error sending order emails:", emailErr);
      }

      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  app.get("/api/orders/:id/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const order = await storage.getOrder(id);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.buyerId !== userId && order.sellerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to view this order history" });
      }

      const history = await storage.getOrderStatusHistory(id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching order history:", error);
      res.status(500).json({ message: "Failed to fetch order history" });
    }
  });
}

import { storage } from "./storage";
import { log } from "./app";
import { 
  purchaseData, 
  purchaseAirtime, 
  getDataPlanById,
  isInlomaxConfigured,
  detectNetwork,
  normalizePhoneNumber,
  type NetworkType
} from "./inlomax";
import type { ScheduledVtuPurchase, User } from "@shared/schema";

const SCHEDULED_JOB_INTERVAL = 60000;
const MAX_CONCURRENT_EXECUTIONS = 5;

let scheduledJobInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let executionCount = 0;

function logJob(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] [scheduled-jobs] ${message}`, JSON.stringify(data));
  } else {
    console.log(`[${timestamp}] [scheduled-jobs] ${message}`);
  }
  log(message, "scheduled-jobs");
}

function calculateNextRunDate(
  schedule: ScheduledVtuPurchase,
  currentRunDate: Date
): Date {
  const nextRun = new Date(currentRunDate);
  
  switch (schedule.frequency) {
    case "daily":
      nextRun.setDate(nextRun.getDate() + 1);
      break;
      
    case "weekly":
      nextRun.setDate(nextRun.getDate() + 7);
      if (schedule.dayOfWeek !== null && schedule.dayOfWeek !== undefined) {
        const currentDayOfWeek = nextRun.getDay();
        const targetDayOfWeek = schedule.dayOfWeek;
        const daysUntilTarget = (targetDayOfWeek - currentDayOfWeek + 7) % 7 || 7;
        nextRun.setDate(nextRun.getDate() + daysUntilTarget - 7);
      }
      break;
      
    case "monthly":
      const dayOfMonth = schedule.dayOfMonth || nextRun.getDate();
      nextRun.setMonth(nextRun.getMonth() + 1);
      const lastDayOfMonth = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate();
      nextRun.setDate(Math.min(dayOfMonth, lastDayOfMonth));
      break;
  }
  
  if (schedule.timeOfDay) {
    const [hours, minutes] = schedule.timeOfDay.split(":").map(Number);
    nextRun.setHours(hours || 9, minutes || 0, 0, 0);
  }
  
  return nextRun;
}

async function executeScheduledPurchase(
  schedule: ScheduledVtuPurchase & { user: User }
): Promise<{ success: boolean; error?: string }> {
  const scheduleId = schedule.id;
  const userId = schedule.userId;
  
  logJob(`Executing scheduled purchase ${scheduleId} for user ${userId}`);
  
  try {
    if (!isInlomaxConfigured()) {
      logJob(`VTU service not configured, skipping schedule ${scheduleId}`);
      return { success: false, error: "VTU_SERVICE_UNAVAILABLE" };
    }
    
    const wallet = await storage.getOrCreateWallet(userId);
    const walletBalance = parseFloat(wallet.balance);
    
    let purchaseAmount = 0;
    let planDetails: {
      name: string;
      dataAmount?: string;
      planCode?: string;
      network: NetworkType;
    } | null = null;
    
    if (schedule.serviceType === "data" && schedule.planId) {
      const plan = getDataPlanById(schedule.planId);
      if (!plan) {
        logJob(`Plan ${schedule.planId} not found for schedule ${scheduleId}`);
        return { success: false, error: "PLAN_NOT_FOUND" };
      }
      purchaseAmount = plan.sellingPrice;
      planDetails = {
        name: plan.name,
        dataAmount: plan.dataAmount,
        planCode: plan.planCode,
        network: plan.network,
      };
    } else if (schedule.serviceType === "airtime" && schedule.amount) {
      purchaseAmount = parseFloat(schedule.amount);
      const network = detectNetwork(schedule.phoneNumber);
      if (!network) {
        logJob(`Could not detect network for ${schedule.phoneNumber}`);
        return { success: false, error: "NETWORK_DETECTION_FAILED" };
      }
      planDetails = {
        name: `Airtime ₦${purchaseAmount}`,
        network: network,
      };
    } else {
      logJob(`Invalid schedule configuration for ${scheduleId}`);
      return { success: false, error: "INVALID_SCHEDULE_CONFIG" };
    }
    
    if (walletBalance < purchaseAmount) {
      logJob(`Insufficient balance for schedule ${scheduleId}. Required: ₦${purchaseAmount}, Available: ₦${walletBalance}`);
      
      await storage.pauseScheduledPurchase(scheduleId, "Insufficient wallet balance");
      
      try {
        await storage.createNotification({
          userId,
          type: "system",
          title: "Scheduled Purchase Paused",
          message: `Your scheduled ${schedule.serviceType} purchase for ${schedule.phoneNumber} has been paused due to insufficient wallet balance. Please fund your wallet and resume the schedule.`,
          link: "/vtu/scheduled",
        });
        logJob(`Notification created for user ${userId} about paused schedule`);
      } catch (notifError: any) {
        logJob(`Failed to create notification: ${notifError.message}`);
      }
      
      return { success: false, error: "INSUFFICIENT_BALANCE" };
    }
    
    await storage.updateWalletBalance(userId, purchaseAmount.toString(), "subtract");
    logJob(`Wallet debited ₦${purchaseAmount} for schedule ${scheduleId}`);
    
    const walletTransaction = await storage.createTransaction({
      walletId: wallet.id,
      type: "purchase",
      amount: `-${purchaseAmount}`,
      status: "pending",
      description: `Scheduled ${schedule.serviceType === "data" ? "Data" : "Airtime"} Purchase: ${planDetails.name} for ${schedule.phoneNumber}`,
      relatedUserId: userId,
    });
    
    let purchaseResult;
    if (schedule.serviceType === "data" && planDetails.planCode) {
      purchaseResult = await purchaseData(
        planDetails.network,
        schedule.phoneNumber,
        planDetails.planCode
      );
    } else {
      purchaseResult = await purchaseAirtime(
        planDetails.network,
        schedule.phoneNumber,
        purchaseAmount
      );
    }
    
    if (purchaseResult.success) {
      await storage.updateTransaction(walletTransaction.id, { status: "completed" });
      
      const networkForDb = schedule.serviceType === "data" && schedule.network 
        ? schedule.network 
        : planDetails.network === "mtn" ? "mtn_sme" 
        : planDetails.network === "glo" ? "glo_cg" 
        : planDetails.network === "airtel" ? "airtel_cg" 
        : "9mobile";
      
      const existingPlans = await storage.getVtuPlans();
      const defaultPlan = existingPlans[0];
      
      await storage.createVtuTransaction({
        userId,
        planId: schedule.planId || defaultPlan?.id || "",
        network: networkForDb as any,
        phoneNumber: normalizePhoneNumber(schedule.phoneNumber),
        amount: purchaseAmount.toString(),
        costPrice: (purchaseAmount * 0.95).toFixed(2),
        profit: (purchaseAmount * 0.05).toFixed(2),
        status: "success",
        smedataReference: purchaseResult.transactionId || purchaseResult.reference,
        smedataResponse: purchaseResult.data,
        walletTransactionId: walletTransaction.id,
        scheduleId: scheduleId,
        isScheduledPurchase: true,
      });
      
      const now = new Date();
      const nextRunAt = calculateNextRunDate(schedule, now);
      
      await storage.updateScheduledPurchase(scheduleId, {
        lastRunAt: now,
        nextRunAt: nextRunAt,
        runCount: (schedule.runCount || 0) + 1,
      });
      
      logJob(`Successfully executed schedule ${scheduleId}. Next run: ${nextRunAt.toISOString()}`);
      
      try {
        await storage.createNotification({
          userId,
          type: "system",
          title: "Scheduled Purchase Successful",
          message: `Your scheduled ${schedule.serviceType === "data" ? "data" : "airtime"} purchase of ${planDetails.name} for ${schedule.phoneNumber} was successful.`,
          link: "/vtu/history",
        });
      } catch (notifError: any) {
        logJob(`Failed to create success notification: ${notifError.message}`);
      }
      
      return { success: true };
    } else {
      await storage.updateWalletBalance(userId, purchaseAmount.toString(), "add");
      await storage.updateTransaction(walletTransaction.id, { status: "failed" });
      
      logJob(`Purchase failed for schedule ${scheduleId}: ${purchaseResult.message}`);
      
      try {
        await storage.createNotification({
          userId,
          type: "system",
          title: "Scheduled Purchase Failed",
          message: `Your scheduled purchase for ${schedule.phoneNumber} failed: ${purchaseResult.message}. Your wallet has been refunded.`,
          link: "/vtu/scheduled",
        });
      } catch (notifError: any) {
        logJob(`Failed to create failure notification: ${notifError.message}`);
      }
      
      return { success: false, error: purchaseResult.message };
    }
  } catch (error: any) {
    logJob(`Error executing schedule ${scheduleId}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function processScheduledPurchases() {
  if (isRunning) {
    logJob("Previous job still running, skipping this cycle");
    return;
  }
  
  isRunning = true;
  executionCount++;
  
  try {
    const dueSchedules = await storage.getActiveScheduledPurchases();
    
    if (dueSchedules.length === 0) {
      return;
    }
    
    logJob(`Found ${dueSchedules.length} schedules due for execution`);
    
    const batchSize = Math.min(dueSchedules.length, MAX_CONCURRENT_EXECUTIONS);
    
    for (let i = 0; i < dueSchedules.length; i += batchSize) {
      const batch = dueSchedules.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(schedule => executeScheduledPurchase(schedule))
      );
      
      results.forEach((result, index) => {
        const schedule = batch[index];
        if (result.status === "rejected") {
          logJob(`Batch execution failed for schedule ${schedule.id}: ${result.reason}`);
        } else if (!result.value.success) {
          logJob(`Schedule ${schedule.id} failed: ${result.value.error}`);
        }
      });
      
      if (i + batchSize < dueSchedules.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    logJob(`Completed processing ${dueSchedules.length} scheduled purchases`);
  } catch (error: any) {
    logJob(`Error in scheduled job processing: ${error.message}`);
  } finally {
    isRunning = false;
  }
}

export function startScheduledJobService(): void {
  if (scheduledJobInterval) {
    logJob("Scheduled job service already running");
    return;
  }
  
  logJob("Starting scheduled VTU purchase job service");
  
  setTimeout(() => {
    processScheduledPurchases();
  }, 5000);
  
  scheduledJobInterval = setInterval(() => {
    processScheduledPurchases();
  }, SCHEDULED_JOB_INTERVAL);
  
  logJob(`Scheduled job service started. Interval: ${SCHEDULED_JOB_INTERVAL}ms`);
}

export function stopScheduledJobService(): void {
  if (scheduledJobInterval) {
    clearInterval(scheduledJobInterval);
    scheduledJobInterval = null;
    logJob("Scheduled job service stopped");
  }
}

export function getScheduledJobStatus(): {
  running: boolean;
  intervalActive: boolean;
  executionCount: number;
} {
  return {
    running: isRunning,
    intervalActive: scheduledJobInterval !== null,
    executionCount,
  };
}

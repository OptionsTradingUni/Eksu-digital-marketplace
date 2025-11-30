import { Router, type Express } from "express";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { updateResellerWithdrawalSchema } from "../../../shared/schema";
import { getSquadConfigStatus, isSquadConfigured } from "../../squad";
import { isInlomaxConfigured } from "../../inlomax";
import { sendTestEmail } from "../../email-service";
import {
  getUserId,
  requireAdmin,
  isAdminUser,
} from "../common";

const router = Router();

router.get("/admin/payment/config", isAuthenticated, requireAdmin, async (req: any, res) => {
  try {
    const squadStatus = getSquadConfigStatus();
    const inlomaxConfigured = isInlomaxConfigured();

    res.json({
      squad: squadStatus,
      vtu: {
        configured: inlomaxConfigured,
        provider: "Inlomax",
      },
      message: squadStatus.configured 
        ? `Squad is configured in ${squadStatus.mode} mode`
        : "Squad is not configured. Please set SQUAD_SECRET_KEY and SQUAD_PUBLIC_KEY environment variables.",
    });
  } catch (error) {
    console.error("Error fetching payment config:", error);
    res.status(500).json({ message: "Failed to fetch payment configuration" });
  }
});

router.get("/admin/tickets", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const user = await storage.getUser(userId);
    
    if (user?.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    const { status, priority, category, page = 1, limit = 20 } = req.query;
    const allTickets = await storage.getAllSupportTickets();
    
    let filteredTickets = allTickets;
    if (status) {
      filteredTickets = filteredTickets.filter(t => t.status === status);
    }
    if (priority) {
      filteredTickets = filteredTickets.filter(t => t.priority === priority);
    }
    if (category) {
      filteredTickets = filteredTickets.filter(t => t.category === category);
    }
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;
    const paginatedTickets = filteredTickets.slice(offset, offset + limitNum);
    
    const ticketsWithUsers = await Promise.all(
      paginatedTickets.map(async (ticket) => {
        const ticketUser = await storage.getUser(ticket.userId);
        return {
          ...ticket,
          user: ticketUser ? { 
            id: ticketUser.id, 
            username: ticketUser.username, 
            email: ticketUser.email,
            profileImageUrl: ticketUser.profileImageUrl 
          } : null,
        };
      })
    );
    
    res.json({
      tickets: ticketsWithUsers,
      total: filteredTickets.length,
      page: pageNum,
      totalPages: Math.ceil(filteredTickets.length / limitNum),
    });
  } catch (error) {
    console.error("Error fetching admin tickets:", error);
    res.status(500).json({ message: "Failed to fetch tickets" });
  }
});

router.patch("/admin/tickets/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const user = await storage.getUser(userId);
    
    if (user?.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    const { id } = req.params;
    const { status, priority, assignedTo } = req.body;
    
    const updateData: any = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    
    const ticket = await storage.updateSupportTicket(id, updateData);
    res.json(ticket);
  } catch (error) {
    console.error("Error updating ticket:", error);
    res.status(500).json({ message: "Failed to update ticket" });
  }
});

router.get("/admin/tickets/stats", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const user = await storage.getUser(userId);
    
    if (user?.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    const allTickets = await storage.getAllSupportTickets();
    
    const stats = {
      total: allTickets.length,
      open: allTickets.filter(t => t.status === 'open').length,
      pending: allTickets.filter(t => t.status === 'pending').length,
      inProgress: allTickets.filter(t => t.status === 'in_progress').length,
      resolved: allTickets.filter(t => t.status === 'resolved').length,
      closed: allTickets.filter(t => t.status === 'closed').length,
      byPriority: {
        low: allTickets.filter(t => t.priority === 'low').length,
        medium: allTickets.filter(t => t.priority === 'medium').length,
        high: allTickets.filter(t => t.priority === 'high').length,
        urgent: allTickets.filter(t => t.priority === 'urgent').length,
      },
      byCategory: {
        technical: allTickets.filter(t => t.category === 'technical').length,
        payment: allTickets.filter(t => t.category === 'payment').length,
        account: allTickets.filter(t => t.category === 'account').length,
        scam_report: allTickets.filter(t => t.category === 'scam_report').length,
        general: allTickets.filter(t => t.category === 'general').length,
      },
    };
    
    res.json(stats);
  } catch (error) {
    console.error("Error fetching ticket stats:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

router.get("/admin/users", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const users = await storage.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.put("/admin/users/:id/verify", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await storage.verifyUser(req.params.id);
    res.json(updated);
  } catch (error: any) {
    console.error("Error verifying user:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(500).json({ message: "Failed to verify user" });
  }
});

router.put("/admin/users/:id/ban", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await storage.banUser(req.params.id, req.body.reason || "Violation of terms");
    res.json(updated);
  } catch (error: any) {
    console.error("Error banning user:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(500).json({ message: "Failed to ban user" });
  }
});

router.get("/admin/products", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const products = await storage.getProducts({});
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

router.put("/admin/products/:id/approve", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await storage.approveProduct(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error("Error approving product:", error);
    res.status(500).json({ message: "Failed to approve product" });
  }
});

router.get("/admin/announcements", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const announcements = await storage.getAnnouncements(true);
    res.json(announcements);
  } catch (error) {
    console.error("Error fetching announcements for admin:", error);
    res.status(500).json({ message: "Failed to fetch announcements" });
  }
});

router.get("/admin/metrics/tables", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await storage.executeRawSQL<{
      table_name: string;
      row_estimate: number;
      total_size_bytes: number;
      indexes_size_bytes: number;
      table_size_bytes: number;
    }>(
      `
      SELECT 
        schemaname || '.' || tablename as table_name,
        n_live_tup as row_estimate,
        pg_total_relation_size(schemaname||'.'||tablename) as total_size_bytes,
        pg_indexes_size(schemaname||'.'||tablename) as indexes_size_bytes,
        pg_relation_size(schemaname||'.'||tablename) as table_size_bytes
      FROM pg_stat_user_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY total_size_bytes DESC
      LIMIT 50
      `
    );

    const dbSize = await storage.executeRawSQL<{ db_size_bytes: number }>(
      "SELECT pg_database_size(current_database()) as db_size_bytes"
    );

    res.json({
      tables: result,
      totalDatabaseSize: dbSize[0]?.db_size_bytes || 0,
    });
  } catch (error) {
    console.error("Error fetching table metrics:", error);
    res.status(500).json({ message: "Failed to fetch table metrics" });
  }
});

router.get("/admin/metrics/activity", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const connections = await storage.executeRawSQL<{
      state: string;
      count: number;
    }>(
      `
      SELECT 
        state,
        COUNT(*) as count
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state
      `
    );

    const stats = await storage.executeRawSQL<{
      total_connections: number;
      max_connection_age_seconds: number;
    }>(
      `
      SELECT 
        COUNT(*) as total_connections,
        EXTRACT(EPOCH FROM MAX(NOW() - state_change)) as max_connection_age_seconds
      FROM pg_stat_activity
      WHERE datname = current_database()
      `
    );

    res.json({
      connectionsByState: connections,
      totalConnections: stats[0]?.total_connections || 0,
      maxConnectionAge: stats[0]?.max_connection_age_seconds || 0,
    });
  } catch (error) {
    console.error("Error fetching activity metrics:", error);
    res.status(500).json({ message: "Failed to fetch activity metrics" });
  }
});

router.get("/admin/metrics/performance", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const hasExtension = await storage.executeRawSQL<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') as exists`
    );

    let queryStats: Array<{
      query: string;
      calls: number;
      total_time_ms: number;
      mean_time_ms: number;
      rows: number;
    }> = [];
    if (hasExtension[0]?.exists) {
      queryStats = await storage.executeRawSQL<{
        query: string;
        calls: number;
        total_time_ms: number;
        mean_time_ms: number;
        rows: number;
      }>(
        `
        SELECT 
          LEFT(query, 100) as query,
          calls,
          total_exec_time as total_time_ms,
          mean_exec_time as mean_time_ms,
          rows
        FROM pg_stat_statements
        WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
        ORDER BY mean_exec_time DESC
        LIMIT 20
        `
      );
    }

    const dbStats = await storage.executeRawSQL<{
      deadlocks: number;
      temp_files: number;
      temp_bytes: number;
    }>(
      `
      SELECT 
        deadlocks,
        temp_files,
        temp_bytes
      FROM pg_stat_database
      WHERE datname = current_database()
      `
    );

    res.json({
      queryStats,
      databaseStats: dbStats[0] || { deadlocks: 0, temp_files: 0, temp_bytes: 0 },
      extensionAvailable: hasExtension[0]?.exists || false,
    });
  } catch (error) {
    console.error("Error fetching performance metrics:", error);
    res.status(500).json({ message: "Failed to fetch performance metrics" });
  }
});

router.get("/admin/platform-settings", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const settings = await storage.getAllPlatformSettings();
    res.json(settings);
  } catch (error) {
    console.error("Error fetching platform settings:", error);
    res.status(500).json({ message: "Failed to fetch platform settings" });
  }
});

router.patch("/admin/platform-settings/:key", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await isAdminUser(userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { key } = req.params;
    const { value } = req.body;

    if (!key) {
      return res.status(400).json({ message: "Setting key is required" });
    }

    if (typeof value !== "string") {
      return res.status(400).json({ message: "Value must be a string" });
    }

    const setting = await storage.updatePlatformSetting(key, value, userId);
    res.json(setting);
  } catch (error) {
    console.error("Error updating platform setting:", error);
    res.status(500).json({ message: "Failed to update platform setting" });
  }
});

router.post("/admin/send-test-email", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    const superAdminIds = (process.env.SUPER_ADMIN_IDS || "").split(",").map(id => id.trim());
    if (!user || !superAdminIds.includes(userId)) {
      return res.status(403).json({ message: "Only admins can send test emails" });
    }
    
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email address is required" });
    }
    
    const result = await sendTestEmail(email);
    
    if (result.success) {
      console.log(`Test email sent successfully to ${email}`);
      res.json({ 
        success: true, 
        message: `Test email sent successfully to ${email}`,
        messageId: result.messageId 
      });
    } else {
      console.error(`Failed to send test email to ${email}:`, result.error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to send test email: ${result.error}` 
      });
    }
  } catch (error: any) {
    console.error("Error sending test email:", error);
    res.status(500).json({ message: error.message || "Failed to send test email" });
  }
});

router.get("/admin/reseller-withdrawals", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const withdrawals = await storage.getAllResellerWithdrawals();
    res.json(withdrawals);
  } catch (error) {
    console.error("Error fetching all withdrawals:", error);
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
});

router.patch("/admin/reseller-withdrawals/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { id } = req.params;
    
    const validation = updateResellerWithdrawalSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: validation.error.errors 
      });
    }

    const { status, adminNote } = validation.data;

    const withdrawal = await storage.getResellerWithdrawalById(id);
    if (!withdrawal) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    if (["completed", "failed", "rejected"].includes(withdrawal.status || "")) {
      return res.status(400).json({ 
        message: `Cannot update withdrawal with status: ${withdrawal.status}` 
      });
    }

    const updatedWithdrawal = await storage.updateResellerWithdrawalStatus(
      id, 
      status, 
      adminNote, 
      userId
    );

    res.json({
      message: `Withdrawal ${status === "completed" ? "approved" : status === "rejected" ? "rejected" : "updated"} successfully`,
      withdrawal: updatedWithdrawal,
    });
  } catch (error) {
    console.error("Error updating withdrawal:", error);
    res.status(500).json({ message: "Failed to update withdrawal" });
  }
});

export function registerAdminRoutes(app: Express) {
  app.use("/api", router);
}

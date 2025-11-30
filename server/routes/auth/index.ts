import { Router, type Express } from "express";
import passport from "passport";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { 
  registerSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema 
} from "../../../shared/schema";
import { 
  sendEmailVerificationCode, 
  sendWelcomeEmail,
  sendEmail,
  sendErrorReportToAdmin
} from "../../email-service";
import {
  getUserId,
  isSuperAdmin,
  hasSupportAccess,
  createAndBroadcastNotification
} from "../common";

const router = Router();

const usernameCheckRateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX_REQUESTS = 30;

router.get("/check-username/:username", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    
    const rateLimit = usernameCheckRateLimits.get(clientIp);
    if (rateLimit) {
      if (now < rateLimit.resetTime) {
        if (rateLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
          return res.status(429).json({ 
            message: "Too many requests. Please try again later.",
            available: false
          });
        }
        rateLimit.count++;
      } else {
        usernameCheckRateLimits.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      }
    } else {
      usernameCheckRateLimits.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }
    
    const { username } = req.params;
    
    if (!username || username.length < 3) {
      return res.status(400).json({ 
        available: false, 
        message: "Username must be at least 3 characters" 
      });
    }
    
    if (username.length > 30) {
      return res.status(400).json({ 
        available: false, 
        message: "Username must be at most 30 characters" 
      });
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ 
        available: false, 
        message: "Username can only contain letters, numbers, and underscores" 
      });
    }
    
    const existingUser = await storage.getUserByUsername(username.toLowerCase());
    
    if (existingUser) {
      return res.json({ 
        available: false, 
        message: "Username is already taken" 
      });
    }
    
    return res.json({ 
      available: true, 
      message: "Username is available" 
    });
  } catch (error: any) {
    console.error("Error checking username:", error);
    return res.status(500).json({ 
      available: false, 
      message: "Error checking username availability" 
    });
  }
});

router.post("/register", async (req, res) => {
  try {
    const validationResult = registerSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.flatten();
      console.log("Registration validation failed:", errors);
      return res.status(400).json({ 
        message: "Validation failed",
        errors: errors.fieldErrors
      });
    }

    const { email, password, firstName, lastName, username, phoneNumber, role, referralCode } = validationResult.data;

    const existingUser = await storage.getUserByEmail(email.toLowerCase().trim());
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const existingUsername = await storage.getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const userData: { 
      email: string; 
      password: string; 
      firstName: string; 
      lastName: string;
      username: string; 
      phoneNumber?: string; 
      role: "buyer" | "seller" | "both" 
    } = {
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username,
      role: role || "buyer",
    };
    
    if (phoneNumber && phoneNumber.trim().length > 0) {
      userData.phoneNumber = phoneNumber.trim();
    }

    console.log("Creating user with data:", { ...userData, password: "[HIDDEN]" });

    const user = await storage.createUser(userData);

    if (referralCode && referralCode.trim().length > 0) {
      try {
        const trimmedCode = referralCode.trim().toUpperCase();
        const referrer = await storage.getUserByReferralCode(trimmedCode);
        
        if (referrer && referrer.id !== user.id) {
          await storage.createReferral(referrer.id, user.id);
          console.log(`Referral created: ${referrer.email} referred ${user.email}`);
        } else if (!referrer) {
          console.log(`Invalid referral code: ${trimmedCode} (user not found)`);
        }
      } catch (referralError: any) {
        console.error("Error processing referral code:", referralError.message);
      }
    }

    const systemUserId = process.env.SYSTEM_USER_ID;
    if (systemUserId) {
      try {
        const systemUser = await storage.getUser(systemUserId);
        if (systemUser) {
          await storage.followUser(user.id, systemUserId);
          console.log(`New user ${user.email} now follows system user @${systemUser.firstName || 'EKSUMarketplace'}`);
          
          const welcomeMessage = `Welcome to EKSU Marketplace! We're excited to have you join our campus trading community.

Here are some quick tips to get started:
1. Complete your profile to build trust with other users
2. Always use our in-app payment system for safe transactions
3. Meet in public places on campus for item exchanges
4. Report any suspicious activity to keep our community safe

Need help? Just reply to this message or use the Help button in the app.

Happy trading!`;

          await storage.createMessage({
            senderId: systemUserId,
            receiverId: user.id,
            content: welcomeMessage,
          });
          console.log(`Welcome DM sent to ${user.email} from system user`);
          
          await createAndBroadcastNotification({
            userId: user.id,
            type: "welcome",
            title: "Welcome to EKSU Marketplace!",
            message: `Hey ${user.firstName || 'there'}! Your account is ready. Start exploring deals on campus or list your own items to sell.`,
            link: "/",
            relatedUserId: systemUserId,
          });
          console.log(`Welcome notification sent to ${user.email}`);
        } else {
          console.log(`System user with ID ${systemUserId} not found`);
        }
      } catch (autoFollowError: any) {
        console.error("Error processing auto-follow/welcome DM:", autoFollowError.message);
      }
    }

    try {
      const { token, code } = await storage.createEmailVerificationToken(user.id);
      const appUrl = process.env.APP_URL || 'https://eksuplug.com.ng';
      const verificationLink = `${appUrl}/verify-email?token=${token}`;
      await sendEmailVerificationCode(user.email, user.firstName || 'User', code, verificationLink);
      console.log(`Verification email sent to ${user.email}`);
    } catch (emailError: any) {
      console.error("Error sending verification email:", emailError.message);
    }

    try {
      await sendWelcomeEmail(user.email, user.firstName || 'User');
      console.log(`Welcome email sent to ${user.email}`);
    } catch (welcomeEmailError: any) {
      console.error("Error sending welcome email:", welcomeEmailError.message);
    }

    const { password: _, ...safeUser } = user;

    req.login(safeUser, (err) => {
      if (err) {
        console.error("Error logging in after registration:", err);
        return res.status(500).json({ message: "Registration successful but login failed" });
      }
      console.log("User registered and logged in successfully:", safeUser.email);
      res.json(safeUser);
    });
  } catch (error: any) {
    console.error("Error registering user:", error);
    
    if (error.message?.includes("duplicate key") || error.code === "23505") {
      return res.status(400).json({ message: "Email already registered" });
    }
    
    const userMessage = "Failed to create account. Please try again or contact support.";
    
    sendErrorReportToAdmin("Registration Error", error.message, { 
      email: req.body.email,
      stack: error.stack 
    }).catch(err => {
      console.error("Failed to send registration error email:", err);
    });

    res.status(500).json({ message: userMessage });
  }
});

router.post("/send-verification-email", isAuthenticated, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const { token, code } = await storage.createEmailVerificationToken(userId);
    
    const appUrl = process.env.APP_URL || 'https://eksu-marketplace.com';
    const verificationLink = `${appUrl}/verify-email?token=${token}`;

    await sendEmailVerificationCode(user.email, user.firstName || 'User', code, verificationLink);

    console.log(`Verification email sent to ${user.email}`);
    res.json({ 
      message: "Verification email sent successfully",
      success: true 
    });
  } catch (error: any) {
    console.error("Error sending verification email:", error);
    res.status(500).json({ message: "Failed to send verification email" });
  }
});

router.get("/verify-email/:token", async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ message: "Verification token is required" });
    }

    const verified = await storage.verifyEmailToken(token);
    
    if (!verified) {
      return res.status(400).json({ 
        message: "Invalid or expired verification link. Please request a new one.",
        success: false 
      });
    }

    console.log(`Email verified via link token`);
    res.json({ 
      message: "Email verified successfully!",
      success: true 
    });
  } catch (error: any) {
    console.error("Error verifying email token:", error);
    res.status(500).json({ message: "Failed to verify email" });
  }
});

router.post("/verify-email-code", isAuthenticated, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { code } = req.body;
    
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({ message: "Valid 6-digit verification code is required" });
    }

    const verified = await storage.verifyEmailCode(userId, code);
    
    if (!verified) {
      return res.status(400).json({ 
        message: "Invalid or expired verification code. Please request a new one.",
        success: false 
      });
    }

    console.log(`Email verified via code for user ${userId}`);
    res.json({ 
      message: "Email verified successfully!",
      success: true 
    });
  } catch (error: any) {
    console.error("Error verifying email code:", error);
    res.status(500).json({ message: "Failed to verify email" });
  }
});

router.get("/email-verification-status", isAuthenticated, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const isVerified = await storage.isUserEmailVerified(userId);
    res.json({ emailVerified: isVerified });
  } catch (error: any) {
    console.error("Error checking email verification status:", error);
    res.status(500).json({ message: "Failed to check email verification status" });
  }
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) {
      console.error("Error during login:", err);
      return res.status(500).json({ message: "Login failed" });
    }
    if (!user) {
      return res.status(401).json({ message: info?.message || "Invalid credentials" });
    }
    const { password: _, ...safeUser } = user;
    
    req.login(safeUser, (err) => {
      if (err) {
        console.error("Error establishing session:", err);
        return res.status(500).json({ message: "Failed to establish session" });
      }
      res.json(safeUser);
    });
  })(req, res, next);
});

router.post("/logout", (req, res) => {
  const sessionId = req.sessionID;
  
  req.logout((err) => {
    if (err) {
      console.error("Error logging out:", err);
      return res.status(500).json({ message: "Failed to logout" });
    }
    
    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        console.error("Error destroying session:", sessionErr);
      }
      
      res.clearCookie("connect.sid", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
      });
      
      console.log("User logged out, session destroyed:", sessionId);
      res.json({ message: "Logged out successfully" });
    });
  });
});

router.post("/forgot-password", async (req, res) => {
  try {
    const validationResult = forgotPasswordSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    const { email } = validationResult.data;
    
    const user = await storage.getUserByEmail(email.toLowerCase().trim());
    
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return res.json({ 
        message: "If an account exists with this email, a password reset link will be sent.",
        success: true
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    await storage.createPasswordResetToken(user.id, resetToken, expiresAt);
    
    console.log(`Password reset token generated for user: ${email}`);
    console.log(`Reset token (for development): ${resetToken}`);
    
    res.json({ 
      message: "If an account exists with this email, a password reset link will be sent.",
      success: true,
      ...(process.env.NODE_ENV === "development" && { resetToken })
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({ message: "Failed to process request" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const validationResult = resetPasswordSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.flatten();
      return res.status(400).json({ 
        message: "Validation failed",
        errors: errors.fieldErrors
      });
    }

    const { token, password } = validationResult.data;
    
    const resetToken = await storage.getPasswordResetToken(token);
    
    if (!resetToken) {
      return res.status(400).json({ 
        message: "Invalid or expired reset token. Please request a new password reset." 
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    await storage.updateUserPassword(resetToken.userId, hashedPassword);
    
    await storage.markPasswordResetTokenUsed(token);
    
    console.log(`Password reset successful for user: ${resetToken.userId}`);
    
    res.json({ 
      message: "Password has been reset successfully. You can now log in with your new password.",
      success: true
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

router.get("/validate-reset-token", async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== "string") {
      return res.status(400).json({ valid: false, message: "Token is required" });
    }
    
    const resetToken = await storage.getPasswordResetToken(token);
    
    if (!resetToken) {
      return res.json({ 
        valid: false, 
        message: "Invalid or expired reset token" 
      });
    }
    
    res.json({ valid: true });
  } catch (error) {
    console.error("Error validating reset token:", error);
    res.status(500).json({ valid: false, message: "Failed to validate token" });
  }
});

router.post("/pin/setup", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { pin, confirmPin } = req.body;

    if (!pin || typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be 4-6 digits" });
    }

    if (pin !== confirmPin) {
      return res.status(400).json({ message: "PINs do not match" });
    }

    const pinData = await storage.getTransactionPin(userId);
    if (pinData?.transactionPinSet) {
      return res.status(400).json({ message: "Transaction PIN is already set. Use change PIN instead." });
    }

    const hashedPin = await bcrypt.hash(pin, 10);
    await storage.setTransactionPin(userId, hashedPin);

    res.json({ message: "Transaction PIN set successfully", success: true });
  } catch (error) {
    console.error("Error setting up PIN:", error);
    res.status(500).json({ message: "Failed to set up transaction PIN" });
  }
});

router.post("/pin/change", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { currentPin, newPin, confirmNewPin } = req.body;

    if (!currentPin || typeof currentPin !== "string" || !/^\d{4,6}$/.test(currentPin)) {
      return res.status(400).json({ message: "Current PIN must be 4-6 digits" });
    }

    if (!newPin || typeof newPin !== "string" || !/^\d{4,6}$/.test(newPin)) {
      return res.status(400).json({ message: "New PIN must be 4-6 digits" });
    }

    if (newPin !== confirmNewPin) {
      return res.status(400).json({ message: "New PINs do not match" });
    }

    const isLocked = await storage.isUserPinLocked(userId);
    if (isLocked) {
      return res.status(429).json({ 
        message: "PIN is temporarily locked due to too many failed attempts. Please try again later.",
        locked: true
      });
    }

    const pinData = await storage.getTransactionPin(userId);
    if (!pinData?.transactionPin || !pinData.transactionPinSet) {
      return res.status(400).json({ message: "No transaction PIN set. Use setup PIN instead." });
    }

    const isValid = await bcrypt.compare(currentPin, pinData.transactionPin);
    if (!isValid) {
      const attempts = await storage.incrementPinAttempts(userId);
      const remainingAttempts = 5 - attempts;
      
      if (remainingAttempts <= 0) {
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        await storage.lockPin(userId, lockUntil);
        return res.status(429).json({ 
          message: "Too many failed attempts. PIN is locked for 30 minutes.",
          locked: true
        });
      }
      
      return res.status(401).json({ 
        message: `Incorrect PIN. ${remainingAttempts} attempts remaining.`,
        remainingAttempts
      });
    }

    await storage.resetPinAttempts(userId);

    const hashedPin = await bcrypt.hash(newPin, 10);
    await storage.setTransactionPin(userId, hashedPin);

    res.json({ message: "Transaction PIN changed successfully", success: true });
  } catch (error) {
    console.error("Error changing PIN:", error);
    res.status(500).json({ message: "Failed to change transaction PIN" });
  }
});

router.post("/pin/verify", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { pin } = req.body;

    if (!pin || typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be 4-6 digits" });
    }

    const isLocked = await storage.isUserPinLocked(userId);
    if (isLocked) {
      const pinData = await storage.getTransactionPin(userId);
      const lockUntil = pinData?.pinLockUntil;
      const remainingMinutes = lockUntil ? Math.ceil((new Date(lockUntil).getTime() - Date.now()) / 60000) : 30;
      
      return res.status(429).json({ 
        message: `PIN is temporarily locked. Try again in ${remainingMinutes} minutes.`,
        locked: true,
        remainingMinutes
      });
    }

    const pinData = await storage.getTransactionPin(userId);
    if (!pinData?.transactionPin || !pinData.transactionPinSet) {
      return res.status(400).json({ message: "No transaction PIN set", pinRequired: false });
    }

    const isValid = await bcrypt.compare(pin, pinData.transactionPin);
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
        verified: false,
        remainingAttempts
      });
    }

    await storage.resetPinAttempts(userId);

    res.json({ verified: true, message: "PIN verified successfully" });
  } catch (error) {
    console.error("Error verifying PIN:", error);
    res.status(500).json({ message: "Failed to verify PIN" });
  }
});

router.get("/pin/status", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const pinData = await storage.getTransactionPin(userId);
    const isLocked = await storage.isUserPinLocked(userId);

    let lockRemainingMinutes = 0;
    if (isLocked && pinData?.pinLockUntil) {
      lockRemainingMinutes = Math.ceil((new Date(pinData.pinLockUntil).getTime() - Date.now()) / 60000);
    }

    res.json({
      pinSet: pinData?.transactionPinSet || false,
      isLocked,
      lockRemainingMinutes: isLocked ? lockRemainingMinutes : 0,
      attemptsRemaining: pinData?.pinAttempts ? 5 - pinData.pinAttempts : 5,
    });
  } catch (error) {
    console.error("Error getting PIN status:", error);
    res.status(500).json({ message: "Failed to get PIN status" });
  }
});

router.post("/pin/reset-request", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await storage.createPasswordResetToken(userId, `PIN_RESET_${resetCode}`, expiresAt);

    await sendEmail(
      user.email,
      "EKSUPlug - PIN Reset Code",
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">PIN Reset Code</h2>
          <p>Your PIN reset code is:</p>
          <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 32px; letter-spacing: 8px; font-family: monospace; margin: 20px 0;">
            ${resetCode}
          </div>
          <p>This code expires in <strong>15 minutes</strong>.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this PIN reset, please ignore this email.</p>
        </div>
      `
    );

    res.json({ message: "PIN reset code sent to your email", success: true });
  } catch (error) {
    console.error("Error requesting PIN reset:", error);
    res.status(500).json({ message: "Failed to send PIN reset code" });
  }
});

router.post("/pin/reset-confirm", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { code, newPin, confirmNewPin } = req.body;

    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Invalid reset code format" });
    }

    if (!newPin || typeof newPin !== "string" || !/^\d{4,6}$/.test(newPin)) {
      return res.status(400).json({ message: "New PIN must be 4-6 digits" });
    }

    if (newPin !== confirmNewPin) {
      return res.status(400).json({ message: "New PINs do not match" });
    }

    const tokenKey = `PIN_RESET_${code}`;
    const resetToken = await storage.getPasswordResetToken(tokenKey);
    
    if (!resetToken || resetToken.userId !== userId) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    await storage.markPasswordResetTokenUsed(tokenKey);

    await storage.resetPinAttempts(userId);
    const hashedPin = await bcrypt.hash(newPin, 10);
    await storage.setTransactionPin(userId, hashedPin);

    res.json({ message: "Transaction PIN reset successfully", success: true });
  } catch (error) {
    console.error("Error resetting PIN:", error);
    res.status(500).json({ message: "Failed to reset transaction PIN" });
  }
});

router.get("/user", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const { password: _, ...safeUser } = user;
    
    const isAdmin = user.role === "admin" || isSuperAdmin(userId);
    const isSupport = hasSupportAccess(userId);
    
    res.json({
      ...safeUser,
      isAdmin,
      isSupport,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

router.get("/ws-token", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = jwt.sign(
      { userId, purpose: "websocket" },
      process.env.SESSION_SECRET!,
      { expiresIn: "15m" }
    );

    res.json({ token });
  } catch (error) {
    console.error("Error generating WebSocket token:", error);
    res.status(500).json({ message: "Failed to generate token" });
  }
});

export function registerAuthRoutes(app: Express) {
  app.use("/api/auth", router);
}

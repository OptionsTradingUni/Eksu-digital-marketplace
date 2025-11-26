import { db, pool } from "../server/db";
import { users, wallets } from "@shared/schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

const SYSTEM_ACCOUNT_EMAIL = "system@eksuplug.com";
const SYSTEM_ACCOUNT_FIRST_NAME = "Campus";
const SYSTEM_ACCOUNT_LAST_NAME = "Hub";
const SYSTEM_ACCOUNT_BIO = "Official EKSU Marketplace System Account. Stay updated with announcements, safety tips, and community updates. This is an automated account - replies may not be monitored.";

function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%^&*';
  
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = 0; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function seedSystemAccount() {
  console.log("Seeding system account for EKSU Marketplace...");
  
  try {
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, SYSTEM_ACCOUNT_EMAIL))
      .limit(1);
    
    if (existingUser.length > 0) {
      console.log("System account already exists!");
      console.log("System Account ID:", existingUser[0].id);
      console.log("Email:", existingUser[0].email);
      console.log("\nTo update SYSTEM_USER_ID in your environment:");
      console.log(`SYSTEM_USER_ID=${existingUser[0].id}`);
      return existingUser[0];
    }
    
    const plainPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);
    const referralCode = generateReferralCode();
    
    const [systemUser] = await db
      .insert(users)
      .values({
        email: SYSTEM_ACCOUNT_EMAIL,
        password: hashedPassword,
        firstName: SYSTEM_ACCOUNT_FIRST_NAME,
        lastName: SYSTEM_ACCOUNT_LAST_NAME,
        bio: SYSTEM_ACCOUNT_BIO,
        role: "admin",
        referralCode: referralCode,
        isVerified: true,
        verificationBadges: ["email", "phone", "student_id"],
        isTrustedSeller: true,
        trustScore: "5.0",
        totalRatings: 0,
        isActive: true,
        isBanned: false,
      })
      .returning();
    
    console.log("System account created successfully!");
    console.log("System Account ID:", systemUser.id);
    console.log("Email:", systemUser.email);
    
    await db
      .insert(wallets)
      .values({
        userId: systemUser.id,
        balance: "0.00",
        escrowBalance: "0.00",
        securityDepositLocked: "0.00",
      })
      .onConflictDoNothing();
    
    console.log("Wallet created for system account.");
    
    const credentialsContent = `# EKSU Marketplace System Account Credentials
# =============================================
# IMPORTANT: Keep this file secure and do not commit to version control
# Generated: ${new Date().toISOString()}

## Account Details
- **Account ID:** ${systemUser.id}
- **Email:** ${SYSTEM_ACCOUNT_EMAIL}
- **Password:** ${plainPassword}
- **Role:** admin
- **Display Name:** ${SYSTEM_ACCOUNT_FIRST_NAME} ${SYSTEM_ACCOUNT_LAST_NAME}

## Environment Variable
Add this to your environment:
\`\`\`
SYSTEM_USER_ID=${systemUser.id}
\`\`\`

## Purpose
This account is used for:
1. Sending welcome messages to new users
2. Posting official announcements in "The Plug" social feed
3. System notifications and updates
4. Auto-followed by all new users

## Security Notes
- This is an admin account with elevated privileges
- Change the password after first login if needed
- Regular users cannot follow back or message this account
- Keep this file in a secure location
`;
    
    const credentialsPath = path.join(process.cwd(), "SYSTEM_ACCOUNT_CREDENTIALS.md");
    fs.writeFileSync(credentialsPath, credentialsContent);
    console.log(`\nCredentials saved to: ${credentialsPath}`);
    
    console.log("\n=== IMPORTANT: SET THIS ENVIRONMENT VARIABLE ===");
    console.log(`SYSTEM_USER_ID=${systemUser.id}`);
    console.log("================================================\n");
    
    return systemUser;
  } catch (error) {
    console.error("Error seeding system account:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedSystemAccount()
  .then(() => {
    console.log("System account seeding completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to seed system account:", error);
    process.exit(1);
  });

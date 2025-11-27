import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const APP_NAME = process.env.APP_NAME || 'EKSU Marketplace';
const APP_URL = process.env.APP_URL || 'https://campusplug.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@campusplug.com';

interface EmailProvider {
  name: string;
  priority: number;
  dailyLimit: number;
  usedToday: number;
  lastReset: Date;
  isConfigured: boolean;
  send: (to: string, subject: string, html: string) => Promise<{ success: boolean; messageId?: string; error?: string }>;
}

interface EmailUsageStats {
  provider: string;
  sent: number;
  failed: number;
  lastUsed: Date;
}

const emailUsage = new Map<string, EmailUsageStats>();

let resendClient: Resend | null = null;
let gmailTransporter: nodemailer.Transporter | null = null;

function initResend(): boolean {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    resendClient = new Resend(apiKey);
    return true;
  }
  return false;
}

function initGmail(): boolean {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (user && pass) {
    gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
    return true;
  }
  return false;
}

async function sendWithResend(to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!resendClient) {
    return { success: false, error: 'Resend not configured' };
  }
  try {
    const { data, error } = await resendClient.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Resend error' };
  }
}

async function sendWithBrevo(to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Brevo not configured' };
  }
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: APP_NAME },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    const data = await response.json() as { messageId?: string; message?: string };
    if (!response.ok) {
      return { success: false, error: data.message || 'Brevo API error' };
    }
    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Brevo error' };
  }
}

async function sendWithMailgun(to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    return { success: false, error: 'Mailgun not configured' };
  }
  try {
    const auth = Buffer.from(`api:${apiKey}`).toString('base64');
    const formData = new URLSearchParams();
    formData.append('from', `${APP_NAME} <${FROM_EMAIL}>`);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', html);

    const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    const data = await response.json() as { id?: string; message?: string };
    if (!response.ok) {
      return { success: false, error: data.message || 'Mailgun API error' };
    }
    return { success: true, messageId: data.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Mailgun error' };
  }
}

async function sendWithGmail(to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!gmailTransporter) {
    return { success: false, error: 'Gmail not configured' };
  }
  try {
    const info = await gmailTransporter.sendMail({
      from: `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gmail error' };
  }
}

const providers: EmailProvider[] = [
  {
    name: 'resend',
    priority: 1,
    dailyLimit: 100,
    usedToday: 0,
    lastReset: new Date(),
    isConfigured: false,
    send: sendWithResend,
  },
  {
    name: 'brevo',
    priority: 2,
    dailyLimit: 300,
    usedToday: 0,
    lastReset: new Date(),
    isConfigured: !!process.env.BREVO_API_KEY,
    send: sendWithBrevo,
  },
  {
    name: 'mailgun',
    priority: 3,
    dailyLimit: 1000,
    usedToday: 0,
    lastReset: new Date(),
    isConfigured: !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN),
    send: sendWithMailgun,
  },
  {
    name: 'gmail',
    priority: 4,
    dailyLimit: 500,
    usedToday: 0,
    lastReset: new Date(),
    isConfigured: false,
    send: sendWithGmail,
  },
];

providers[0].isConfigured = initResend();
providers[3].isConfigured = initGmail();

function resetDailyLimits() {
  const now = new Date();
  providers.forEach(p => {
    if (now.getDate() !== p.lastReset.getDate()) {
      p.usedToday = 0;
      p.lastReset = now;
    }
  });
}

function getAvailableProvider(): EmailProvider | null {
  resetDailyLimits();
  const shuffled = providers
    .filter(p => p.isConfigured && p.usedToday < p.dailyLimit)
    .sort((a, b) => a.priority - b.priority);
  
  if (shuffled.length === 0) return null;
  const topPriority = shuffled[0].priority;
  const samePriority = shuffled.filter(p => p.priority === topPriority);
  return samePriority[Math.floor(Math.random() * samePriority.length)];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

export async function sendEmail(to: string, subject: string, html: string, retries = 3): Promise<EmailResult> {
  const attempted = new Set<string>();
  
  for (let i = 0; i < retries; i++) {
    const provider = providers
      .filter(p => p.isConfigured && p.usedToday < p.dailyLimit && !attempted.has(p.name))
      .sort((a, b) => a.priority - b.priority)[0];
    
    if (!provider) {
      break;
    }
    
    attempted.add(provider.name);
    const result = await provider.send(to, subject, html);
    
    const stats = emailUsage.get(provider.name) || { provider: provider.name, sent: 0, failed: 0, lastUsed: new Date() };
    
    if (result.success) {
      provider.usedToday++;
      stats.sent++;
      stats.lastUsed = new Date();
      emailUsage.set(provider.name, stats);
      console.log(`[Email] Sent via ${provider.name} to ${to}`);
      return { ...result, provider: provider.name };
    } else {
      stats.failed++;
      emailUsage.set(provider.name, stats);
      console.warn(`[Email] ${provider.name} failed: ${result.error}`);
    }
  }
  
  console.error(`[Email] All providers failed for ${to}`);
  return { success: false, error: 'All email providers failed' };
}

export function getEmailStats(): EmailUsageStats[] {
  return Array.from(emailUsage.values());
}

export function getProviderStatus(): Array<{ name: string; isConfigured: boolean; usedToday: number; dailyLimit: number }> {
  return providers.map(p => ({
    name: p.name,
    isConfigured: p.isConfigured,
    usedToday: p.usedToday,
    dailyLimit: p.dailyLimit,
  }));
}

function getBaseTemplate(title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${title}</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        ${content}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </p>
      </div>
    </body>
    </html>
  `;
}

export async function sendWelcomeEmail(email: string, firstName: string): Promise<EmailResult> {
  const content = `
    <p style="font-size: 18px; margin-top: 0;">Hey ${firstName}! Welcome to EKSU Marketplace</p>
    <p>We're excited to have you join our campus community. Here's what you can do:</p>
    <ul style="padding-left: 20px;">
      <li><strong>Buy & Sell:</strong> List items or find great deals</li>
      <li><strong>Safe Transactions:</strong> Escrow protects every trade</li>
      <li><strong>Connect:</strong> Chat with buyers and sellers</li>
      <li><strong>Games:</strong> Play Ludo, Whot, and more with friends</li>
      <li><strong>The Plug:</strong> Stay updated with campus news</li>
    </ul>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">Start Exploring</a>
    </div>
  `;
  return sendEmail(email, `Welcome to ${APP_NAME}!`, getBaseTemplate(`Welcome to ${APP_NAME}!`, content));
}

export async function sendVerificationEmail(email: string, status: 'approved' | 'rejected' | 'pending', reason?: string): Promise<EmailResult> {
  const config = {
    approved: { title: 'Verification Approved!', color: '#16a34a', icon: 'Verified Badge Activated' },
    rejected: { title: 'Verification Update', color: '#ef4444', icon: 'Action Required' },
    pending: { title: 'Verification In Progress', color: '#f59e0b', icon: 'Under Review' },
  };
  const c = config[status];
  const content = `
    <p style="font-size: 16px; margin-top: 0;">${c.icon}</p>
    ${status === 'approved' ? '<p>Congratulations! Your account is now verified. You have a verified badge on your profile showing your department, level, and name.</p>' : ''}
    ${status === 'rejected' && reason ? `<p style="background: #fef2f2; padding: 15px; border-radius: 8px;"><strong>Reason:</strong> ${reason}</p>` : ''}
    ${status === 'pending' ? '<p>We received your verification documents. Review usually takes 1-2 hours.</p>' : ''}
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/profile" style="display: inline-block; background: ${c.color}; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">View Profile</a>
    </div>
  `;
  return sendEmail(email, c.title, getBaseTemplate(c.title, content));
}

export async function sendOrderEmail(email: string, orderDetails: {
  orderId: string;
  productName: string;
  totalAmount: string;
  sellerName: string;
  buyerName?: string;
  type: 'confirmation' | 'shipped' | 'delivered' | 'completed';
}): Promise<EmailResult> {
  const titles = {
    confirmation: 'Order Confirmed!',
    shipped: 'Order Shipped!',
    delivered: 'Order Delivered!',
    completed: 'Transaction Complete!',
  };
  const content = `
    <p style="font-size: 16px; margin-top: 0;">Order #${orderDetails.orderId}</p>
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Product:</strong> ${orderDetails.productName}</p>
      <p><strong>Amount:</strong> NGN ${orderDetails.totalAmount}</p>
      <p><strong>Seller:</strong> ${orderDetails.sellerName}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/messages" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">View Order</a>
    </div>
  `;
  return sendEmail(email, titles[orderDetails.type], getBaseTemplate(titles[orderDetails.type], content));
}

export async function sendStreakRewardEmail(email: string, streakDays: number, rewardAmount: number): Promise<EmailResult> {
  const content = `
    <div style="text-align: center;">
      <p style="font-size: 48px; margin: 0;">🔥</p>
      <p style="font-size: 24px; font-weight: bold; margin: 10px 0;">${streakDays} Day Streak!</p>
      <p style="font-size: 18px; color: #16a34a;">You earned NGN ${rewardAmount}!</p>
      <p>Keep it going! Log in daily to maintain your streak and earn more rewards.</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">Continue Streak</a>
    </div>
  `;
  return sendEmail(email, `${streakDays} Day Streak! You earned NGN ${rewardAmount}`, getBaseTemplate('Streak Reward!', content));
}

export async function sendMessageNotification(email: string, senderName: string): Promise<EmailResult> {
  const content = `
    <p style="font-size: 16px; margin-top: 0;">You have a new message from <strong>${senderName}</strong>!</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/messages" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">View Message</a>
    </div>
    <p style="color: #666; font-size: 14px;">Quick responses build trust with buyers and sellers!</p>
  `;
  return sendEmail(email, `New message from ${senderName}`, getBaseTemplate('New Message', content));
}

export async function sendStoryViewNotification(email: string, viewerName: string): Promise<EmailResult> {
  const content = `
    <p style="font-size: 16px; margin-top: 0;"><strong>${viewerName}</strong> viewed your story!</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/the-plug" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">View Stories</a>
    </div>
  `;
  return sendEmail(email, `${viewerName} viewed your story`, getBaseTemplate('Story View', content));
}

export async function sendConfessionReaction(email: string, reaction: string): Promise<EmailResult> {
  const content = `
    <p style="font-size: 16px; margin-top: 0;">Someone reacted to your confession!</p>
    <div style="text-align: center; margin: 20px 0;">
      <span style="font-size: 48px;">${reaction}</span>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/confessions" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">View Confession</a>
    </div>
  `;
  return sendEmail(email, 'New reaction on your confession', getBaseTemplate('Confession Reaction', content));
}

export async function sendGameInvite(email: string, inviterName: string, gameType: string, stakeAmount: string): Promise<EmailResult> {
  const content = `
    <p style="font-size: 16px; margin-top: 0;"><strong>${inviterName}</strong> invited you to play ${gameType}!</p>
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p style="font-size: 24px; margin: 0;">Stake: NGN ${stakeAmount}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/games" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">Accept Challenge</a>
    </div>
  `;
  return sendEmail(email, `${inviterName} challenged you to ${gameType}!`, getBaseTemplate('Game Invitation', content));
}

export async function sendPasswordReset(email: string, resetLink: string): Promise<EmailResult> {
  const content = `
    <p style="font-size: 16px; margin-top: 0;">You requested a password reset.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">Reset Password</a>
    </div>
    <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
  `;
  return sendEmail(email, 'Reset Your Password', getBaseTemplate('Password Reset', content));
}

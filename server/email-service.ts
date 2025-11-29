import { Resend } from 'resend';

const APP_NAME = process.env.APP_NAME || 'EKSU Plug';
const APP_URL = process.env.APP_URL || 'https://eksuplug.com.ng';
const FROM_EMAIL = process.env.FROM_EMAIL || 'system@eksuplug.com.ng';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'eksucampusmarketplace@gmail.com';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured');
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function logSuccess(functionName: string, to: string): void {
  console.log(`[Email] ${functionName}: Email sent successfully to ${to}`);
}

function logError(functionName: string, error: any): void {
  console.error(`[Email] ${functionName} failed:`, error?.message || error);
}

function logWarning(functionName: string): void {
  console.warn(`[Email] ${functionName}: Resend not configured. Email not sent.`);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    logWarning('sendEmail');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      logError('sendEmail', error);
      return { success: false, error: error.message };
    }

    logSuccess('sendEmail', to);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    logError('sendEmail', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
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
    <p style="font-size: 18px; margin-top: 0;">Hey ${firstName}! Welcome to ${APP_NAME}</p>
    <p>We're super excited to have you join our campus community. Here's what you can do:</p>
    <ul style="padding-left: 20px;">
      <li><strong>Buy & Sell:</strong> List items or find great deals from fellow students</li>
      <li><strong>Safe Transactions:</strong> Our escrow system protects every trade</li>
      <li><strong>Connect:</strong> Chat with buyers and sellers directly</li>
      <li><strong>Games:</strong> Play Ludo, Whot, and more with friends</li>
      <li><strong>The Plug:</strong> Stay updated with campus news and gist</li>
      <li><strong>VTU Services:</strong> Buy airtime and data at discounted rates</li>
    </ul>
    <p style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <strong>Pro tip:</strong> Complete your profile verification to get a verified badge and build trust with other users!
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">Start Exploring</a>
    </div>
    <p style="color: #666; font-size: 14px;">Questions? Just reply to this email or reach out to our support team.</p>
  `;
  return sendEmail(email, `Welcome to ${APP_NAME}!`, getBaseTemplate(`Welcome to ${APP_NAME}!`, content));
}

export async function sendEmailVerificationCode(
  email: string, 
  firstName: string, 
  verificationCode: string, 
  verificationLink: string
): Promise<EmailResult> {
  const content = `
    <p style="font-size: 18px; margin-top: 0;">Hey ${firstName}, verify your email</p>
    <p>Thanks for signing up! Please verify your email address to complete your registration and unlock all features.</p>
    
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 30px; border-radius: 12px; margin: 25px 0; text-align: center; border: 2px dashed #16a34a;">
      <p style="font-size: 14px; color: #166534; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
      <p style="font-size: 36px; font-weight: bold; color: #15803d; margin: 0; letter-spacing: 8px; font-family: monospace;">${verificationCode}</p>
      <p style="font-size: 12px; color: #166534; margin: 15px 0 0 0;">Code expires in 24 hours</p>
    </div>
    
    <p style="text-align: center; color: #666;">Or click the button below to verify instantly:</p>
    
    <div style="text-align: center; margin: 25px 0;">
      <a href="${verificationLink}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">Verify Email Address</a>
    </div>
    
    <div style="background: #fefce8; padding: 15px; border-radius: 8px; margin-top: 20px;">
      <p style="margin: 0; font-size: 13px; color: #854d0e;">
        <strong>Security tip:</strong> If you didn't create an account on ${APP_NAME}, please ignore this email.
      </p>
    </div>
  `;
  return sendEmail(email, `Verify your email - ${APP_NAME}`, getBaseTemplate('Verify Your Email', content));
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

export async function sendMessageNotification(
  email: string, 
  senderName: string,
  options?: {
    messagePreview?: string;
    productName?: string;
    productId?: string;
    senderId?: string;
    isReply?: boolean;
  }
): Promise<EmailResult> {
  const messagePreview = options?.messagePreview 
    ? (options.messagePreview.length > 100 
        ? options.messagePreview.substring(0, 100) + '...' 
        : options.messagePreview)
    : null;
  
  const productContext = options?.productName 
    ? `<div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #16a34a;">
        <p style="margin: 0; font-size: 13px; color: #166534;">
          <strong>Regarding:</strong> ${options.productName}
        </p>
      </div>`
    : '';
  
  const messageBox = messagePreview 
    ? `<div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #374151; font-style: italic;">"${messagePreview}"</p>
      </div>`
    : '';
  
  const actionText = options?.isReply ? 'Continue Conversation' : 'View Message';
  const linkUrl = options?.senderId 
    ? `${APP_URL}/messages?user=${options.senderId}` 
    : `${APP_URL}/messages`;
  
  const content = `
    <p style="font-size: 16px; margin-top: 0;">You have a new message from <strong>${senderName}</strong>!</p>
    ${productContext}
    ${messageBox}
    <div style="text-align: center; margin: 30px 0;">
      <a href="${linkUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">${actionText}</a>
    </div>
    <p style="color: #666; font-size: 14px;">Quick responses build trust with buyers and sellers!</p>
    <p style="color: #999; font-size: 12px; text-align: center;">
      <a href="${APP_URL}/settings" style="color: #16a34a; text-decoration: none;">Manage notification preferences</a>
    </p>
  `;
  
  const subject = options?.isReply 
    ? `${senderName} replied to your message` 
    : `New message from ${senderName}`;
  
  return sendEmail(email, subject, getBaseTemplate('New Message', content));
}

export async function sendOrderMessageNotification(
  email: string,
  details: {
    senderName: string;
    senderId: string;
    messagePreview: string;
    orderId: string;
    productName: string;
    productId?: string;
    orderStatus?: string;
    isBuyerMessage: boolean;
  }
): Promise<EmailResult> {
  const truncatedPreview = details.messagePreview.length > 150 
    ? details.messagePreview.substring(0, 150) + '...' 
    : details.messagePreview;
  
  const roleLabel = details.isBuyerMessage ? 'Buyer' : 'Seller';
  const statusBadge = details.orderStatus 
    ? `<span style="display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; margin-left: 10px;">${details.orderStatus}</span>`
    : '';
  
  const content = `
    <p style="font-size: 16px; margin-top: 0;">
      <strong>${details.senderName}</strong> (${roleLabel}) sent you a message about your order!
    </p>
    
    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <p style="margin: 0; font-size: 14px; color: #166534;">
          <strong>Order:</strong> #${details.orderId.substring(0, 8)}...
        </p>
        ${statusBadge}
      </div>
      <p style="margin: 0; font-size: 14px; color: #166534;">
        <strong>Product:</strong> ${details.productName}
      </p>
    </div>
    
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Message Preview</p>
      <p style="margin: 0; color: #374151; font-style: italic;">"${truncatedPreview}"</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/messages?user=${details.senderId}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">Reply to Message</a>
    </div>
    
    <p style="color: #666; font-size: 14px; text-align: center;">
      Respond quickly to keep your transaction moving smoothly!
    </p>
    <p style="color: #999; font-size: 12px; text-align: center;">
      <a href="${APP_URL}/settings" style="color: #16a34a; text-decoration: none;">Manage notification preferences</a>
    </p>
  `;
  
  return sendEmail(
    email, 
    `Message about your order: ${details.productName}`, 
    getBaseTemplate('Order Message', content)
  );
}

export async function sendMessageReplyNotification(
  email: string,
  details: {
    senderName: string;
    senderId: string;
    messagePreview: string;
    productName?: string;
    productId?: string;
  }
): Promise<EmailResult> {
  const truncatedPreview = details.messagePreview.length > 100 
    ? details.messagePreview.substring(0, 100) + '...' 
    : details.messagePreview;
  
  const productContext = details.productName 
    ? `<div style="background: #f0fdf4; padding: 12px 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #16a34a;">
        <p style="margin: 0; font-size: 13px; color: #166534;">
          <strong>About:</strong> ${details.productName}
        </p>
      </div>`
    : '';
  
  const content = `
    <p style="font-size: 16px; margin-top: 0;"><strong>${details.senderName}</strong> replied to your conversation!</p>
    ${productContext}
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; color: #374151; font-style: italic;">"${truncatedPreview}"</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/messages?user=${details.senderId}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">Continue Conversation</a>
    </div>
    <p style="color: #666; font-size: 14px; text-align: center;">Quick responses build trust!</p>
  `;
  
  return sendEmail(email, `${details.senderName} replied to you`, getBaseTemplate('New Reply', content));
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

export async function sendNewFollowerEmail(email: string, followerName: string, followerUsername: string): Promise<EmailResult> {
  const content = `
    <p style="font-size: 16px; margin-top: 0;">Great news! <strong>${followerName}</strong> (@${followerUsername}) just started following you!</p>
    <p>They'll now see your posts and products in their feed. Keep sharing great content to grow your audience!</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/profile/${followerUsername}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">View Their Profile</a>
    </div>
  `;
  return sendEmail(email, `${followerName} started following you!`, getBaseTemplate('New Follower', content));
}

export async function sendNewPostFromFollowingEmail(
  email: string, 
  authorName: string, 
  authorUsername: string,
  postPreview: string,
  postId: string
): Promise<EmailResult> {
  const truncatedPreview = postPreview.length > 150 ? postPreview.substring(0, 150) + '...' : postPreview;
  const content = `
    <p style="font-size: 16px; margin-top: 0;"><strong>${authorName}</strong> (@${authorUsername}) just shared a new post!</p>
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
      <p style="margin: 0; color: #374151; font-style: italic;">"${truncatedPreview}"</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/the-plug?post=${postId}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">View Post</a>
    </div>
    <p style="color: #666; font-size: 14px; text-align: center;">
      <a href="${APP_URL}/settings" style="color: #16a34a; text-decoration: none;">Manage notification preferences</a>
    </p>
  `;
  return sendEmail(email, `${authorName} shared a new post`, getBaseTemplate('New Post', content));
}

export async function sendNewProductFromFollowingEmail(
  email: string, 
  sellerName: string, 
  sellerUsername: string,
  productName: string,
  productPrice: string,
  productId: string,
  productImage?: string
): Promise<EmailResult> {
  const content = `
    <p style="font-size: 16px; margin-top: 0;"><strong>${sellerName}</strong> (@${sellerUsername}) just listed a new product!</p>
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      ${productImage ? `<img src="${productImage}" alt="${productName}" style="width: 100%; max-width: 300px; border-radius: 8px; margin-bottom: 15px;">` : ''}
      <h3 style="margin: 0 0 10px 0; color: #111;">${productName}</h3>
      <p style="font-size: 24px; font-weight: bold; color: #16a34a; margin: 0;">NGN ${productPrice}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/product/${productId}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">View Product</a>
    </div>
    <p style="color: #666; font-size: 14px; text-align: center;">
      <a href="${APP_URL}/settings" style="color: #16a34a; text-decoration: none;">Manage notification preferences</a>
    </p>
  `;
  return sendEmail(email, `${sellerName} listed: ${productName}`, getBaseTemplate('New Product Listed', content));
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

export async function sendErrorReportToAdmin(
  errorTitle: string,
  errorMessage: string,
  details?: Record<string, any>
): Promise<EmailResult> {
  const timestamp = new Date().toISOString();
  
  let detailsHtml = '';
  if (details) {
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.token;
    delete sanitizedDetails.apiKey;
    delete sanitizedDetails.secretKey;
    
    detailsHtml = `
      <div style="background: #1e1e1e; padding: 15px; border-radius: 8px; margin: 15px 0; overflow-x: auto;">
        <pre style="color: #d4d4d4; font-family: 'Monaco', 'Consolas', monospace; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; margin: 0;">${JSON.stringify(sanitizedDetails, null, 2)}</pre>
      </div>
    `;
  }
  
  const content = `
    <div style="background: #fef2f2; border: 2px solid #ef4444; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
      <h2 style="color: #dc2626; margin: 0 0 10px 0; font-size: 20px;">Error Report: ${errorTitle}</h2>
      <p style="color: #7f1d1d; margin: 0;">An error occurred in the ${APP_NAME} application</p>
    </div>
    
    <div style="margin: 20px 0;">
      <h3 style="color: #374151; margin: 0 0 10px 0;">Error Message</h3>
      <div style="background: #fff1f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
        <p style="color: #dc2626; margin: 0; font-family: monospace;">${errorMessage}</p>
      </div>
    </div>
    
    <div style="margin: 20px 0;">
      <h3 style="color: #374151; margin: 0 0 10px 0;">Timestamp</h3>
      <p style="color: #6b7280; margin: 0;">${timestamp}</p>
    </div>
    
    ${details ? `
    <div style="margin: 20px 0;">
      <h3 style="color: #374151; margin: 0 0 10px 0;">Technical Details</h3>
      ${detailsHtml}
    </div>
    ` : ''}
    
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 25px;">
      <p style="margin: 0; font-size: 13px; color: #6b7280;">
        This is an automated error notification from the ${APP_NAME} system.
      </p>
    </div>
  `;
  
  console.log(`[Email] Sending error report to admin: ${errorTitle}`);
  return sendEmail(ADMIN_EMAIL, `[ERROR] ${APP_NAME}: ${errorTitle}`, getBaseTemplate('Error Report', content));
}

export async function sendVtuSyncReport(
  syncResult: { success: boolean; message: string; plansUpdated?: number; plansCreated?: number; errors?: string[] }
): Promise<EmailResult> {
  const statusColor = syncResult.success ? '#16a34a' : '#dc2626';
  const statusText = syncResult.success ? 'Success' : 'Failed';
  const timestamp = new Date().toISOString();
  
  let errorsHtml = '';
  if (syncResult.errors && syncResult.errors.length > 0) {
    errorsHtml = `
      <div style="margin: 20px 0;">
        <h3 style="color: #374151; margin: 0 0 10px 0;">Errors (${syncResult.errors.length})</h3>
        <ul style="background: #fef2f2; padding: 15px 15px 15px 30px; border-radius: 8px; margin: 0;">
          ${syncResult.errors.map(err => `<li style="color: #dc2626; margin: 5px 0;">${err}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  const content = `
    <div style="background: ${syncResult.success ? '#f0fdf4' : '#fef2f2'}; border: 2px solid ${statusColor}; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
      <h2 style="color: ${statusColor}; margin: 0 0 10px 0; font-size: 20px;">VTU Plans Sync: ${statusText}</h2>
      <p style="color: #374151; margin: 0;">${syncResult.message}</p>
    </div>
    
    ${syncResult.success ? `
    <div style="display: flex; gap: 20px; margin: 20px 0;">
      <div style="flex: 1; background: #f0fdf4; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="font-size: 32px; font-weight: bold; color: #16a34a; margin: 0;">${syncResult.plansUpdated || 0}</p>
        <p style="color: #166534; margin: 5px 0 0 0;">Plans Updated</p>
      </div>
      <div style="flex: 1; background: #eff6ff; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="font-size: 32px; font-weight: bold; color: #2563eb; margin: 0;">${syncResult.plansCreated || 0}</p>
        <p style="color: #1d4ed8; margin: 5px 0 0 0;">Plans Created</p>
      </div>
    </div>
    ` : ''}
    
    ${errorsHtml}
    
    <div style="margin: 20px 0;">
      <h3 style="color: #374151; margin: 0 0 10px 0;">Timestamp</h3>
      <p style="color: #6b7280; margin: 0;">${timestamp}</p>
    </div>
    
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 25px;">
      <p style="margin: 0; font-size: 13px; color: #6b7280;">
        This is an automated VTU sync notification from the ${APP_NAME} system.
      </p>
    </div>
  `;
  
  return sendEmail(ADMIN_EMAIL, `[VTU Sync] ${APP_NAME}: ${statusText}`, getBaseTemplate('VTU Plans Sync Report', content));
}

export async function sendTestEmail(to: string): Promise<EmailResult> {
  const content = `
    <p style="font-size: 18px; margin-top: 0;">Test Email Successful!</p>
    <p>This is a test email from ${APP_NAME} to verify that the Resend email integration is working correctly.</p>
    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p style="font-size: 24px; color: #16a34a; margin: 0;">Email Service is Working!</p>
      <p style="color: #166534; margin: 10px 0 0 0;">Sent from: ${FROM_EMAIL}</p>
    </div>
    <p style="color: #666; font-size: 14px;">If you received this email, the Resend integration is configured correctly.</p>
  `;
  return sendEmail(to, `Test Email from ${APP_NAME}`, getBaseTemplate('Test Email', content));
}

export async function sendNewTicketNotificationToAdmin(ticket: {
  id: string;
  ticketNumber?: string;
  subject: string;
  description: string;
  priority: string;
  category: string;
  userName?: string;
  userEmail?: string;
}): Promise<EmailResult> {
  const priorityColors: Record<string, string> = {
    urgent: '#dc2626',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };
  
  const priorityColor = priorityColors[ticket.priority] || '#6b7280';
  const truncatedDescription = ticket.description.length > 300 
    ? ticket.description.substring(0, 300) + '...' 
    : ticket.description;
  
  const content = `
    <div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
      <h2 style="color: #92400e; margin: 0 0 10px 0; font-size: 20px;">New Support Ticket</h2>
      <p style="color: #78350f; margin: 0;">A new support ticket has been submitted and requires attention.</p>
    </div>
    
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <div style="margin-bottom: 15px;">
        <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Ticket #</p>
        <p style="margin: 5px 0 0 0; font-weight: bold; color: #111;">${ticket.ticketNumber || ticket.id.substring(0, 8)}</p>
      </div>
      
      <div style="margin-bottom: 15px;">
        <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Subject</p>
        <p style="margin: 5px 0 0 0; font-weight: bold; color: #111;">${ticket.subject}</p>
      </div>
      
      <div style="display: flex; gap: 20px; margin-bottom: 15px;">
        <div>
          <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Priority</p>
          <span style="display: inline-block; background: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; margin-top: 5px; text-transform: capitalize;">${ticket.priority}</span>
        </div>
        <div>
          <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Category</p>
          <span style="display: inline-block; background: #e5e7eb; color: #374151; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; margin-top: 5px; text-transform: capitalize;">${ticket.category}</span>
        </div>
      </div>
      
      ${ticket.userName ? `
      <div style="margin-bottom: 15px;">
        <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Submitted By</p>
        <p style="margin: 5px 0 0 0; color: #111;">${ticket.userName} ${ticket.userEmail ? `(${ticket.userEmail})` : ''}</p>
      </div>
      ` : ''}
    </div>
    
    <div style="margin: 20px 0;">
      <h3 style="color: #374151; margin: 0 0 10px 0;">Description</h3>
      <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #374151; white-space: pre-wrap;">${truncatedDescription}</p>
      </div>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/admin" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">View in Admin Panel</a>
    </div>
    
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 25px;">
      <p style="margin: 0; font-size: 13px; color: #6b7280;">
        This is an automated notification from the ${APP_NAME} support system.
      </p>
    </div>
  `;
  
  console.log(`[Email] Sending new ticket notification to admin for ticket: ${ticket.ticketNumber || ticket.id}`);
  return sendEmail(ADMIN_EMAIL, `[Support Ticket] ${ticket.priority.toUpperCase()}: ${ticket.subject}`, getBaseTemplate('New Support Ticket', content));
}

export async function sendTicketReplyNotification(
  recipientEmail: string,
  details: {
    ticketId: string;
    ticketNumber?: string;
    ticketSubject: string;
    replyMessage: string;
    replierName: string;
    isAdminReply: boolean;
  }
): Promise<EmailResult> {
  const truncatedReply = details.replyMessage.length > 500 
    ? details.replyMessage.substring(0, 500) + '...' 
    : details.replyMessage;
  
  const replySource = details.isAdminReply ? 'Support Team' : details.replierName;
  
  const content = `
    <p style="font-size: 16px; margin-top: 0;">
      <strong>${replySource}</strong> has replied to your support ticket.
    </p>
    
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
      <p style="margin: 0; font-size: 13px; color: #166534;">
        <strong>Ticket #${details.ticketNumber || details.ticketId.substring(0, 8)}:</strong> ${details.ticketSubject}
      </p>
    </div>
    
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Reply Message</p>
      <p style="margin: 0; color: #374151; white-space: pre-wrap;">${truncatedReply}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/support" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">View Full Conversation</a>
    </div>
    
    <p style="color: #666; font-size: 14px; text-align: center;">
      Reply to this ticket directly on ${APP_NAME} to continue the conversation.
    </p>
  `;
  
  const subject = details.isAdminReply 
    ? `[Support Reply] Re: ${details.ticketSubject}` 
    : `New reply on ticket: ${details.ticketSubject}`;
  
  console.log(`[Email] Sending ticket reply notification to ${recipientEmail} for ticket: ${details.ticketNumber || details.ticketId}`);
  return sendEmail(recipientEmail, subject, getBaseTemplate('Support Ticket Reply', content));
}

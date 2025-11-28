import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@eksu-marketplace.com';
const APP_NAME = process.env.APP_NAME || 'EKSU Marketplace';

let resend: Resend | null = null;

export function isResendConfigured(): boolean {
  return !!RESEND_API_KEY;
}

function getResendClient(): Resend | null {
  if (!RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(RESEND_API_KEY);
  }
  return resend;
}

function logWarning(functionName: string): void {
  console.warn(`[Email] ${functionName}: RESEND_API_KEY not configured. Email not sent.`);
}

function logError(functionName: string, error: any): void {
  console.error(`[Email] ${functionName} failed:`, error?.message || error);
}

function logSuccess(functionName: string, to: string): void {
  console.log(`[Email] ${functionName}: Email sent successfully to ${to}`);
}

export interface OrderDetails {
  orderId: string;
  productName: string;
  quantity: number;
  totalAmount: string;
  sellerName: string;
  deliveryAddress?: string;
  estimatedDelivery?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWelcomeEmail(
  email: string,
  firstName: string
): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    logWarning('sendWelcomeEmail');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Welcome to ${APP_NAME}! 🎉`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${APP_NAME}!</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; margin-top: 0;">Hey ${firstName}! 👋</p>
            <p>We're thrilled to have you join our campus marketplace community. Here's what you can do:</p>
            <ul style="padding-left: 20px;">
              <li><strong>Buy & Sell:</strong> List your items or discover deals from fellow students</li>
              <li><strong>Safe Transactions:</strong> Use our secure escrow system for peace of mind</li>
              <li><strong>Connect:</strong> Chat with buyers and sellers directly in the app</li>
              <li><strong>Earn Rewards:</strong> Refer friends and earn bonus credits</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL || 'https://eksu-marketplace.com'}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">Start Exploring</a>
            </div>
            <p style="color: #666; font-size: 14px;">Need help? Reply to this email or visit our support page.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      logError('sendWelcomeEmail', error);
      return { success: false, error: error.message };
    }

    logSuccess('sendWelcomeEmail', email);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    logError('sendWelcomeEmail', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

export async function sendOrderConfirmationEmail(
  email: string,
  orderDetails: OrderDetails
): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    logWarning('sendOrderConfirmationEmail');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Order Confirmed - ${orderDetails.orderId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Order Confirmed! ✅</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-top: 0;">Your order has been placed successfully!</p>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Order Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Order ID:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${orderDetails.orderId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Product:</td>
                  <td style="padding: 8px 0;">${orderDetails.productName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Quantity:</td>
                  <td style="padding: 8px 0;">${orderDetails.quantity}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Seller:</td>
                  <td style="padding: 8px 0;">${orderDetails.sellerName}</td>
                </tr>
                ${orderDetails.deliveryAddress ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Delivery To:</td>
                  <td style="padding: 8px 0;">${orderDetails.deliveryAddress}</td>
                </tr>
                ` : ''}
                ${orderDetails.estimatedDelivery ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Est. Delivery:</td>
                  <td style="padding: 8px 0;">${orderDetails.estimatedDelivery}</td>
                </tr>
                ` : ''}
              </table>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
              <table style="width: 100%;">
                <tr>
                  <td style="font-size: 18px; font-weight: bold;">Total:</td>
                  <td style="font-size: 18px; font-weight: bold; text-align: right; color: #059669;">₦${orderDetails.totalAmount}</td>
                </tr>
              </table>
            </div>

            <p style="color: #666; font-size: 14px;">
              Your payment is held securely in escrow until you confirm receipt of your item.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL || 'https://eksu-marketplace.com'}/messages" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">Contact Seller</a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      logError('sendOrderConfirmationEmail', error);
      return { success: false, error: error.message };
    }

    logSuccess('sendOrderConfirmationEmail', email);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    logError('sendOrderConfirmationEmail', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

export async function sendVerificationStatusEmail(
  email: string,
  status: 'approved' | 'rejected' | 'pending',
  reason?: string
): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    logWarning('sendVerificationStatusEmail');
    return { success: false, error: 'Resend not configured' };
  }

  const statusConfig = {
    approved: {
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      icon: '✅',
      title: 'Verification Approved!',
      message: 'Congratulations! Your account has been verified. You now have access to all features and a verified badge on your profile.',
    },
    rejected: {
      color: '#ef4444',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      icon: '❌',
      title: 'Verification Not Approved',
      message: 'Unfortunately, we were unable to verify your account at this time.',
    },
    pending: {
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      icon: '⏳',
      title: 'Verification In Progress',
      message: 'Your verification documents have been received and are being reviewed. This usually takes 1-2 business days.',
    },
  };

  const config = statusConfig[status];

  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${config.icon} ${config.title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${config.gradient}; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${config.title}</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-top: 0;">${config.message}</p>
            
            ${reason ? `
            <div style="background: #fef2f2; border-left: 4px solid ${config.color}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <strong>Reason:</strong>
              <p style="margin: 5px 0 0 0;">${reason}</p>
            </div>
            ` : ''}
            
            ${status === 'rejected' ? `
            <p style="color: #666; font-size: 14px;">
              You can resubmit your verification documents after addressing the issues mentioned above.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL || 'https://eksu-marketplace.com'}/kyc" style="display: inline-block; background: ${config.gradient}; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">Resubmit Documents</a>
            </div>
            ` : ''}
            
            ${status === 'approved' ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL || 'https://eksu-marketplace.com'}/profile" style="display: inline-block; background: ${config.gradient}; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">View Your Profile</a>
            </div>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      logError('sendVerificationStatusEmail', error);
      return { success: false, error: error.message };
    }

    logSuccess('sendVerificationStatusEmail', email);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    logError('sendVerificationStatusEmail', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

export async function sendNewMessageNotification(
  email: string,
  senderName: string
): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    logWarning('sendNewMessageNotification');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `💬 New message from ${senderName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">New Message 💬</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; margin-top: 0;">You have a new message!</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <p style="margin: 0; font-size: 16px;">
                <strong>${senderName}</strong> sent you a message on ${APP_NAME}.
              </p>
            </div>

            <p style="color: #666; font-size: 14px;">
              Log in to view and reply to your message. Quick responses help build trust with buyers and sellers!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL || 'https://eksu-marketplace.com'}/messages" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">View Message</a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              You're receiving this because you have email notifications enabled.<br>
              <a href="${process.env.APP_URL || 'https://eksu-marketplace.com'}/settings" style="color: #3b82f6; text-decoration: none;">Manage notification preferences</a>
            </p>
            <p style="color: #999; font-size: 12px; text-align: center; margin: 10px 0 0 0;">
              © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      logError('sendNewMessageNotification', error);
      return { success: false, error: error.message };
    }

    logSuccess('sendNewMessageNotification', email);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    logError('sendNewMessageNotification', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

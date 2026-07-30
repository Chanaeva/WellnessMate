import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

function createTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('Gmail credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendPasswordResetEmail(toEmail: string, resetCode: string, firstName?: string): Promise<boolean> {
  try {
    const transporter = createTransporter();

    const msg = {
      from: `"Wolf Mother Wellness" <${GMAIL_USER}>`,
      to: toEmail,
      subject: 'Wolf Mother Wellness - Password Reset Code',
      text: `Hi ${firstName || 'there'},\n\nYour password reset code is: ${resetCode}\n\nThis code will expire in 15 minutes.\n\nIf you did not request a password reset, please ignore this email.\n\nBest regards,\nWolf Mother Wellness Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5d4a;">Wolf Mother Wellness</h2>
          <p>Hi ${firstName || 'there'},</p>
          <p>Your password reset code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #4a5d4a;">${resetCode}</span>
          </div>
          <p>This code will expire in <strong>15 minutes</strong>.</p>
          <p style="color: #666; font-size: 14px;">If you did not request a password reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Best regards,<br>Wolf Mother Wellness Team</p>
        </div>
      `
    };

    await transporter.sendMail(msg);
    console.log(`Password reset email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('Gmail email error:', error);
    return false;
  }
}

export async function sendSessionBookingNotification(
  memberName: string,
  memberEmail: string,
  sessionType: string,
  bookingDate: string
): Promise<boolean> {
  try {
    const transporter = createTransporter();

    const formattedDate = new Date(bookingDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const sessionLabel = sessionType === 'morning' ? 'Morning Session' : 'Evening Session';

    const msg = {
      from: `"Wolf Mother Wellness" <${GMAIL_USER}>`,
      to: 'info@wolfmothertulsa.com',
      subject: `Session Booking: ${memberName} - ${sessionLabel} on ${formattedDate}`,
      text: `New Session Booking\n\nMember: ${memberName}\nEmail: ${memberEmail}\nSession: ${sessionLabel}\nDate: ${formattedDate}\n\nThis is an automated notification from Wolf Mother Wellness.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5d4a;">Wolf Mother Wellness - New Session Booking</h2>
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-weight: bold; width: 120px;">Member:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #ddd;">${memberName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-weight: bold;">Email:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><a href="mailto:${memberEmail}">${memberEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-weight: bold;">Session:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #ddd;">${sessionLabel}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold;">Date:</td>
                <td style="padding: 10px 0;">${formattedDate}</td>
              </tr>
            </table>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">This is an automated notification from Wolf Mother Wellness.</p>
        </div>
      `
    };

    await transporter.sendMail(msg);
    console.log(`Session booking notification sent for ${memberName} - ${sessionLabel} on ${formattedDate}`);
    return true;
  } catch (error) {
    console.error('Gmail session booking notification error:', error);
    return false;
  }
}

export async function sendWaitlistNotificationEmail(
  toEmail: string,
  name: string,
  date: string
): Promise<boolean> {
  try {
    const transporter = createTransporter();

    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const msg = {
      from: `"Wolf Mother Wellness" <${GMAIL_USER}>`,
      to: toEmail,
      subject: `Wolf Mother Wellness — Space Available for ${formattedDate}`,
      text: `Hi ${name},\n\nGreat news! A spot has opened up for ${formattedDate} at Wolf Mother Wellness. Please contact us or stop by as soon as possible to reserve your place — spots are limited and fill quickly.\n\nWe look forward to seeing you!\n\nBest regards,\nWolf Mother Wellness Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5d4a;">Wolf Mother Wellness</h2>
          <p>Hi ${name},</p>
          <p>Great news! A spot has opened up for <strong>${formattedDate}</strong> at Wolf Mother Wellness.</p>
          <div style="background-color: #f0f4f0; border-left: 4px solid #4a5d4a; padding: 16px 20px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #333;">Please contact us or stop by as soon as possible to reserve your place — spots are limited and fill quickly.</p>
          </div>
          <p>We look forward to seeing you!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Best regards,<br>Wolf Mother Wellness Team</p>
        </div>
      `,
    };

    await transporter.sendMail(msg);
    console.log(`Waitlist notification email sent to ${toEmail} for ${date}`);
    return true;
  } catch (error) {
    console.error('Waitlist notification email error:', error);
    return false;
  }
}

export async function sendPaymentFailedMemberEmail(
  toEmail: string,
  firstName: string,
  planName: string,
  amountDue: number,
  invoiceNumber: string,
  portalUrl: string
): Promise<boolean> {
  try {
    const transporter = createTransporter();
    const amountDisplay = `$${(amountDue / 100).toFixed(2)}`;

    const msg = {
      from: `"Wolf Mother Wellness" <${GMAIL_USER}>`,
      to: toEmail,
      subject: 'Wolf Mother Wellness — Action Required: Payment Failed',
      text: `Hi ${firstName},\n\nWe were unable to process your renewal payment of ${amountDisplay} for your ${planName} membership (Invoice ${invoiceNumber}).\n\nTo keep your membership active, please update your payment method by logging in to your member portal. Stripe will automatically retry the charge — if payment continues to fail your membership will be paused.\n\nLog in at: ${portalUrl}\n\nIf you have any questions, reply to this email or contact us directly.\n\nBest regards,\nWolf Mother Wellness Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5d4a;">Wolf Mother Wellness</h2>
          <p>Hi ${firstName},</p>
          <p>We were unable to process your renewal payment for your <strong>${planName}</strong> membership.</p>
          <div style="background-color: #fff3cd; border-left: 4px solid #e6a817; padding: 16px 20px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #856404;">Payment Failed</p>
            <p style="margin: 0; color: #533f03;">Amount due: <strong>${amountDisplay}</strong> &nbsp;|&nbsp; Invoice: ${invoiceNumber}</p>
          </div>
          <p>Stripe will automatically retry the charge. To avoid any interruption to your membership, please log in and update your payment method:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${portalUrl}" style="background-color: #4a5d4a; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Update Payment Method</a>
          </div>
          <p style="color: #666; font-size: 14px;">If you have any questions, reply to this email or contact us directly.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Best regards,<br>Wolf Mother Wellness Team</p>
        </div>
      `
    };

    await transporter.sendMail(msg);
    console.log(`Payment failed member email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('Payment failed member email error:', error);
    return false;
  }
}

export async function sendPaymentFailedAdminEmail(
  adminEmail: string,
  memberName: string,
  memberEmail: string,
  planName: string,
  amountDue: number,
  invoiceNumber: string,
  attemptCount: number
): Promise<boolean> {
  try {
    const transporter = createTransporter();
    const amountDisplay = `$${(amountDue / 100).toFixed(2)}`;

    const msg = {
      from: `"Wolf Mother Wellness" <${GMAIL_USER}>`,
      to: adminEmail,
      subject: `Payment Failed — ${memberName} (${planName})`,
      text: `Payment Failure Alert\n\nMember: ${memberName}\nEmail: ${memberEmail}\nPlan: ${planName}\nAmount Due: ${amountDisplay}\nInvoice: ${invoiceNumber}\nAttempt #: ${attemptCount}\n\nStripe will retry automatically. The member has been notified by email.\n\nView in Stripe Dashboard: https://dashboard.stripe.com/customers`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5d4a;">Wolf Mother Wellness — Payment Failure Alert</h2>
          <div style="background-color: #f8d7da; border-left: 4px solid #c9393e; padding: 16px 20px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #721c24;">A membership renewal payment has failed.</p>
          </div>
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd; font-weight: bold; width: 130px;">Member:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${memberName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd; font-weight: bold;">Email:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><a href="mailto:${memberEmail}">${memberEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd; font-weight: bold;">Plan:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${planName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd; font-weight: bold;">Amount Due:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${amountDisplay}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd; font-weight: bold;">Invoice:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Attempt #:</td>
                <td style="padding: 8px 0;">${attemptCount}</td>
              </tr>
            </table>
          </div>
          <p style="color: #555;">Stripe will retry the charge automatically. The member has been notified by email to update their payment method.</p>
          <p><a href="https://dashboard.stripe.com/customers" style="color: #4a5d4a;">View in Stripe Dashboard →</a></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Automated alert from Wolf Mother Wellness</p>
        </div>
      `
    };

    await transporter.sendMail(msg);
    console.log(`Payment failed admin alert sent to ${adminEmail} for ${memberEmail}`);
    return true;
  } catch (error) {
    console.error('Payment failed admin email error:', error);
    return false;
  }
}

function buildNewsletterHtml(greeting: string, htmlBody: string, logoUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #4a5d4a 0%, #6b8e5a 100%); padding: 20px 32px; border-radius: 8px 8px 0 0; text-align: center;">
        <img src="${logoUrl}" alt="Wolf Mother Wellness" style="max-height: 90px; width: auto; display: block; margin: 0 auto;" />
      </div>
      <div style="padding: 32px; border: 1px solid #e8e8e8; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 20px 0; font-size: 15px;">${greeting}</p>
        ${htmlBody}
        <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 20px 0;">
        <p style="color: #aaa; font-size: 11px; margin: 0;">
          You're receiving this because you are a member of Wolf Mother Wellness.<br>
          &copy; ${new Date().getFullYear()} Wolf Mother Wellness
        </p>
      </div>
    </div>
  `;
}

/**
 * Send a newsletter to a list of recipients via Gmail using a single pooled
 * SMTP connection. Emails are delivered sequentially with a short delay to
 * avoid Gmail rate limits. Returns the number of successfully delivered emails.
 */
export async function sendNewsletterBatch(
  recipients: Array<{ email: string; firstName: string }>,
  subject: string,
  htmlBody: string,
  plainBody: string,
  appBaseUrl: string,
): Promise<number> {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('Gmail credentials not configured.');
  }

  const logoUrl = `${appBaseUrl}/wm-logo.png`;

  // One pooled transporter for the entire batch — avoids repeated SMTP auth
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: 1,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  let successCount = 0;

  for (const recipient of recipients) {
    const greeting = recipient.firstName ? `Hi ${recipient.firstName},` : 'Hi there,';

    try {
      await transporter.sendMail({
        from: `"Wolf Mother Wellness" <${GMAIL_USER}>`,
        to: recipient.email,
        subject,
        text: `${greeting}\n\n${plainBody}`,
        html: buildNewsletterHtml(greeting, htmlBody, logoUrl),
      });
      console.log(`Newsletter "${subject}" sent to ${recipient.email}`);
      successCount++;
    } catch (error) {
      console.error(`Newsletter email error for ${recipient.email}:`, error);
    }

    // Brief pause between sends to stay within Gmail's rate limits
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  transporter.close();
  return successCount;
}

export async function sendGiftCardEmail(
  recipientEmail: string,
  recipientName: string,
  purchaserName: string,
  giftCardCode: string,
  giftCardType: string,
  amount: number,
  personalMessage?: string | null,
  waiverUrl?: string,
  packageName?: string,
): Promise<boolean> {
  try {
    const transporter = createTransporter();

    const isMonetary = giftCardType === 'monetary';
    const valueDisplay = isMonetary 
      ? `$${(amount / 100).toFixed(2)}` 
      : `${amount} Day Pass${amount > 1 ? 'es' : ''}`;
    const cardTitle = packageName || (isMonetary ? 'Gift Card' : 'Day Pass Bundle');

    const waiverSection = waiverUrl ? `\n\nBefore your first visit, please sign our facility waiver at: ${waiverUrl}\nClick "Guest Check-In (Waiver Only)" to complete your waiver — it only takes a minute.` : '';

    const waiverHtml = waiverUrl ? `
      <div style="background-color: #fff8e6; border: 1px solid #f5c842; padding: 16px 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="font-size: 15px; font-weight: bold; color: #7a5c00; margin: 0 0 8px 0;">📋 Sign Your Waiver Before Visiting</p>
        <p style="color: #7a5c00; font-size: 14px; margin: 0 0 14px 0;">Stop by the kiosk and click "Guest Check-In (Waiver Only)" to sign your liability waiver — it only takes a minute and is required before your first visit.</p>
        <a href="${waiverUrl}" style="background-color: #4a5d4a; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Sign Waiver at Kiosk →</a>
      </div>
    ` : '';

    const msg = {
      from: `"Wolf Mother Wellness" <${GMAIL_USER}>`,
      to: recipientEmail,
      subject: `You've received a Wolf Mother Wellness ${cardTitle}!`,
      text: `Hi ${recipientName},\n\n${purchaserName} has sent you a ${cardTitle} worth ${valueDisplay}!\n\nYour gift card code is: ${giftCardCode}\n\n${personalMessage ? `Personal message: "${personalMessage}"\n\n` : ''}To redeem, visit Wolf Mother Wellness and enter this code during checkout or at the front desk.${waiverSection}\n\nBest regards,\nWolf Mother Wellness Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5d4a;">Wolf Mother Wellness</h2>
          <p>Hi ${recipientName},</p>
          <p><strong>${purchaserName}</strong> has sent you a ${cardTitle}!</p>
          <div style="background: linear-gradient(135deg, #4a5d4a 0%, #6b8e5a 100%); color: white; padding: 30px; border-radius: 12px; margin: 20px 0; text-align: center;">
            <p style="font-size: 14px; margin: 0 0 10px 0; opacity: 0.9;">WOLF MOTHER WELLNESS</p>
            <p style="font-size: 28px; font-weight: bold; margin: 0 0 5px 0;">${valueDisplay}</p>
            <p style="font-size: 12px; margin: 0; opacity: 0.8;">${cardTitle}</p>
            <div style="background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 8px; margin-top: 20px;">
              <p style="font-size: 12px; margin: 0 0 5px 0; opacity: 0.9;">YOUR CODE</p>
              <p style="font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 0;">${giftCardCode}</p>
            </div>
          </div>
          ${personalMessage ? `
            <div style="background-color: #f9f9f9; padding: 15px 20px; border-left: 4px solid #4a5d4a; border-radius: 4px; margin: 20px 0;">
              <p style="font-style: italic; margin: 0; color: #555;">"${personalMessage}"</p>
              <p style="margin: 5px 0 0 0; color: #888; font-size: 12px;">— ${purchaserName}</p>
            </div>
          ` : ''}
          ${waiverHtml}
          <p>To redeem your ${cardTitle.toLowerCase()}, visit Wolf Mother Wellness and enter your code during checkout or at the front desk.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Best regards,<br>Wolf Mother Wellness Team</p>
        </div>
      `
    };

    await transporter.sendMail(msg);
    console.log(`Gift card email sent to ${recipientEmail} (code: ${giftCardCode})`);
    return true;
  } catch (error) {
    console.error('Gmail gift card email error:', error);
    return false;
  }
}

export async function sendBackupAlertEmail(
  toEmail: string,
  schedule: string,
  errorMessage: string
): Promise<boolean> {
  try {
    const transporter = createTransporter();
    const now = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

    await transporter.sendMail({
      from: `"Wolf Mother Wellness" <${GMAIL_USER}>`,
      to: toEmail,
      subject: 'Wolf Mother Wellness - Scheduled Database Backup Failed',
      text: `A scheduled database backup failed.\n\nSchedule: ${schedule}\nTime: ${now}\nError: ${errorMessage}\n\nPlease check the server logs and create a manual backup from the admin Configuration page.\n\nWolf Mother Wellness System`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #b91c1c;">⚠ Scheduled Database Backup Failed</h2>
          <p>A scheduled backup did not complete successfully.</p>
          <table style="width:100%; border-collapse:collapse; margin:16px 0;">
            <tr><td style="padding:6px 10px; background:#f4f4f4; font-weight:bold; width:120px;">Schedule</td><td style="padding:6px 10px;">${schedule}</td></tr>
            <tr><td style="padding:6px 10px; background:#f4f4f4; font-weight:bold;">Time</td><td style="padding:6px 10px;">${now} CT</td></tr>
            <tr><td style="padding:6px 10px; background:#f4f4f4; font-weight:bold;">Error</td><td style="padding:6px 10px; color:#b91c1c; font-family:monospace;">${errorMessage}</td></tr>
          </table>
          <p>Please check the server logs and create a manual backup from the <strong>Admin → Configuration</strong> page.</p>
          <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
          <p style="color:#999; font-size:12px;">Wolf Mother Wellness System</p>
        </div>
      `,
    });

    console.log(`Backup failure alert sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('Gmail backup alert email error:', error);
    return false;
  }
}

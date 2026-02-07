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

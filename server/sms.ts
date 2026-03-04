import twilio from 'twilio';

function createTwilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER required)');
  }
  return { client: twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN), from: TWILIO_PHONE_NUMBER };
}

export async function sendSMS(to: string, message: string): Promise<void> {
  const { client, from } = createTwilioClient();
  try {
    await client.messages.create({ body: message, from, to });
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw new Error('Failed to send SMS message');
  }
}

export async function sendWaitlistNotificationSMS(
  toPhone: string,
  name: string,
  date: string
): Promise<boolean> {
  try {
    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const message = `Hi ${name}, a spot has opened up at Wolf Mother Wellness for ${formattedDate}! Please contact us soon to reserve your place. Spots fill quickly.`;
    await sendSMS(toPhone, message);
    console.log(`Waitlist notification SMS sent to ${toPhone} for ${date}`);
    return true;
  } catch (error: any) {
    console.error('Waitlist notification SMS error:', error.message);
    return false;
  }
}

export function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

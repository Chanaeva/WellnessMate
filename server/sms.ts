import twilio from 'twilio';

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
  throw new Error('Missing required Twilio environment variables');
}

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendSMS(to: string, message: string): Promise<void> {
  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw new Error('Failed to send SMS message');
  }
}

export function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
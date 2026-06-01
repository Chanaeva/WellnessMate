import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error('❌ GMAIL_USER or GMAIL_APP_PASSWORD not set');
  process.exit(1);
}

console.log(`Sending test email from ${GMAIL_USER}...`);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,
  maxConnections: 1,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

try {
  await transporter.sendMail({
    from: `"Wolf Mother Wellness" <${GMAIL_USER}>`,
    to: GMAIL_USER,
    subject: 'Gmail connection test — Wolf Mother Wellness',
    text: 'Gmail is unblocked and newsletter sending will work.',
  });
  console.log('✅ Gmail is unblocked — test email sent successfully!');
} catch (err) {
  if (err.responseCode === 454 || /too many login/i.test(err.message)) {
    console.error('🔒 Gmail is still blocked by Google. Wait a bit longer and try again.');
  } else {
    console.error('❌ Unexpected error:', err.message);
  }
} finally {
  transporter.close();
}

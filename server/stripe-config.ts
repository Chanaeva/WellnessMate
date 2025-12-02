import Stripe from "stripe";

// Simplified configuration: Always use the production/live keys
// User has requested to use only production keys for both dev and prod environments

// Always use the production keys (STRIPE_SECRET_KEY and VITE_STRIPE_PUBLIC_KEY)
// Trim whitespace to prevent issues with copy/paste
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
const VITE_STRIPE_PUBLIC_KEY = process.env.VITE_STRIPE_PUBLIC_KEY?.trim();

// Debug: Log what we're using (including length and last 4 chars to verify correct key)
console.log('🔧 Stripe Key Configuration:', {
  nodeEnv: process.env.NODE_ENV,
  secretKeyPrefix: STRIPE_SECRET_KEY?.substring(0, 15),
  secretKeyLength: STRIPE_SECRET_KEY?.length,
  secretKeyLast4: STRIPE_SECRET_KEY?.slice(-4),
  publicKeyPrefix: VITE_STRIPE_PUBLIC_KEY?.substring(0, 15),
  publicKeyLength: VITE_STRIPE_PUBLIC_KEY?.length,
  publicKeyLast4: VITE_STRIPE_PUBLIC_KEY?.slice(-4),
});

const requiredStripeEnvVars = {
  STRIPE_SECRET_KEY,
  VITE_STRIPE_PUBLIC_KEY,
} as const;

// Validate required environment variables
for (const [key, value] of Object.entries(requiredStripeEnvVars)) {
  if (!value) {
    throw new Error(`Missing required Stripe environment variable: ${key}`);
  }
}

// Environment flags
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Log key type info
const keyType = STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test';
console.log(`✅ Using Stripe ${keyType} keys`);

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn('⚠️  Warning: STRIPE_WEBHOOK_SECRET not configured (webhooks may not work)');
}

// Function to create a fresh Stripe client (reads env var at call time)
export function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  console.log('🔑 Creating Stripe client with key ending in:', key.slice(-4));
  return new Stripe(key, {
    apiVersion: "2025-05-28.basil",
    typescript: true,
    telemetry: false,
    maxNetworkRetries: 3,
    timeout: 30000,
    appInfo: {
      name: "Wolf Mother Wellness",
      version: "1.0.0",
      url: "https://wolfmotherwellness.com",
    },
  });
}

// Initialize Stripe with production-ready configuration
export const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
  typescript: true,
  telemetry: false, // Disable telemetry for production
  maxNetworkRetries: 3,
  timeout: 30000, // 30 seconds
  appInfo: {
    name: "Wolf Mother Wellness",
    version: "1.0.0",
    url: "https://wolfmotherwellness.com",
  },
});

// Stripe webhook configuration
export const STRIPE_WEBHOOK_CONFIG = {
  secret: process.env.STRIPE_WEBHOOK_SECRET,
  tolerance: 300, // 5 minutes tolerance for webhook timestamps
  enabledEvents: [
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'setup_intent.succeeded',
    'checkout.session.completed',
    'checkout.session.expired',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
  ] as const,
};

// Stripe configuration constants
export const STRIPE_CONFIG = {
  currency: 'usd',
  paymentMethodTypes: ['card'],
  automaticPaymentMethods: { enabled: true },
  
  // Payment intent configuration
  paymentIntentConfig: {
    capture_method: 'automatic' as const,
    confirmation_method: 'automatic' as const,
    payment_method_types: ['card'] as string[],
  },
  
  // Setup intent configuration
  setupIntentConfig: {
    payment_method_types: ['card'] as string[],
    usage: 'off_session' as const,
  },
  
  // Customer configuration
  customerConfig: {
    metadata: {
      source: 'wolf_mother_wellness',
      environment: process.env.NODE_ENV || 'development',
    },
  },
  
  // Tax configuration for checkout sessions
  taxConfig: {
    automaticTax: { enabled: true },
    // Collect billing address for tax calculation
    billingAddressCollection: 'auto' as const,
    // Update customer with new address information
    customerUpdate: {
      address: 'auto' as const,
      shipping: 'auto' as const,
    },
    // Allowed countries for shipping address collection (US-focused for now)
    shippingAddressCollection: {
      allowed_countries: ['US'] as const,
    },
  },
} as const;

// Helper function to format amounts for Stripe (convert to cents)
export const formatAmountForStripe = (amount: number): number => {
  return Math.round(amount * 100);
};

// Helper function to format amounts from Stripe (convert from cents)
export const formatAmountFromStripe = (amount: number): number => {
  return amount / 100;
};

// Environment info for logging
export const STRIPE_ENV_INFO = {
  environment: process.env.NODE_ENV || 'development',
  isProduction,
  isDevelopment,
  hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
  keyType: STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test',
  publicKeyType: VITE_STRIPE_PUBLIC_KEY?.startsWith('pk_live_') ? 'live' : 'test',
  publicKey: VITE_STRIPE_PUBLIC_KEY,
};

// Log configuration on startup
if (isDevelopment) {
  console.log('🔧 Stripe Configuration:', {
    environment: STRIPE_ENV_INFO.environment,
    keyType: STRIPE_ENV_INFO.keyType,
    publicKeyType: STRIPE_ENV_INFO.publicKeyType,
    webhookConfigured: STRIPE_ENV_INFO.hasWebhookSecret,
  });
}
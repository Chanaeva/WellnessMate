import Stripe from "stripe";

// Environment validation with test key support
const isDevelopment = process.env.NODE_ENV === 'development';

// Debug: Log what we're seeing
console.log('🔍 Environment Debug:', {
  isDev: isDevelopment,
  nodeEnv: process.env.NODE_ENV,
  hasDEV_SECRET: !!process.env.DEV_STRIPE_SECRET,
  hasDEV_PUBLIC: !!process.env.DEV_STRIPE_PUBLIC,
  hasPROD_SECRET: !!process.env.STRIPE_SECRET_KEY,
  hasPROD_PUBLIC: !!process.env.VITE_STRIPE_PUBLIC_KEY,
  DEV_SECRET_starts: process.env.DEV_STRIPE_SECRET?.substring(0, 15),
  DEV_PUBLIC_starts: process.env.DEV_STRIPE_PUBLIC?.substring(0, 15),
  PROD_SECRET_starts: process.env.STRIPE_SECRET_KEY?.substring(0, 15),
  PROD_PUBLIC_starts: process.env.VITE_STRIPE_PUBLIC_KEY?.substring(0, 15),
});

// In development, prefer testing keys if available (try new names first, then old names)
const STRIPE_SECRET_KEY = isDevelopment && (process.env.DEV_STRIPE_SECRET || process.env.TESTING_STRIPE_SECRET_KEY)
  ? (process.env.DEV_STRIPE_SECRET || process.env.TESTING_STRIPE_SECRET_KEY)
  : process.env.STRIPE_SECRET_KEY;

const VITE_STRIPE_PUBLIC_KEY = isDevelopment && (process.env.DEV_STRIPE_PUBLIC || process.env.TESTING_VITE_STRIPE_PUBLIC_KEY)
  ? (process.env.DEV_STRIPE_PUBLIC || process.env.TESTING_VITE_STRIPE_PUBLIC_KEY)
  : process.env.VITE_STRIPE_PUBLIC_KEY;

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

// Validate environment-specific keys
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Production validation
  if (!STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
    throw new Error('Production environment requires live Stripe secret key (sk_live_...)');
  }
  if (!VITE_STRIPE_PUBLIC_KEY?.startsWith('pk_live_')) {
    console.warn('⚠️  Warning: Production environment should use live Stripe public key (pk_live_...)');
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('⚠️  Warning: Production environment should have STRIPE_WEBHOOK_SECRET configured');
  }
} else if (isDevelopment) {
  // Development validation
  if (STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
    console.warn('⚠️  Warning: Using live Stripe keys in development environment');
  } else if (STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    console.log('✅ Using Stripe test keys in development');
  }
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
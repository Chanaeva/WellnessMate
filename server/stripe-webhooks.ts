import type { Express, Request, Response } from "express";
import { stripe, STRIPE_WEBHOOK_CONFIG } from "./stripe-config";
import { storage } from "./storage";
import Stripe from "stripe";

// Raw body parser for webhook signature verification
export const stripeWebhookMiddleware = (req: Request, res: Response, next: any) => {
  if (req.path === '/api/stripe/webhook') {
    req.body = req.body || Buffer.from('');
    return next();
  }
  next();
};

// Webhook event handlers
const handlePaymentIntentSucceeded = async (paymentIntent: Stripe.PaymentIntent) => {
  console.log('✅ Payment succeeded:', paymentIntent.id);
  
  try {
    // Find the user by customer ID
    const customerId = paymentIntent.customer as string;
    if (!customerId) {
      console.warn('⚠️  Payment intent without customer ID:', paymentIntent.id);
      return;
    }
    
    const user = await storage.getUserByCustomerId(customerId);
    if (!user) {
      console.warn('⚠️  User not found for customer:', customerId);
      return;
    }
    
    // Record successful payment
    await storage.createPayment({
      userId: user.id,
      amount: paymentIntent.amount / 100, // Convert from cents
      status: 'successful',
      description: `Payment ${paymentIntent.id}`,
      method: 'credit_card',
      stripePaymentIntentId: paymentIntent.id,
      stripePaymentMethodId: paymentIntent.payment_method as string,
    });
    
    console.log('💳 Payment recorded for user:', user.email);
  } catch (error) {
    console.error('❌ Error handling payment success:', error);
  }
};

const handlePaymentIntentFailed = async (paymentIntent: Stripe.PaymentIntent) => {
  console.log('❌ Payment failed:', paymentIntent.id);
  
  try {
    const customerId = paymentIntent.customer as string;
    if (!customerId) return;
    
    const user = await storage.getUserByCustomerId(customerId);
    if (!user) return;
    
    // Record failed payment
    await storage.createPayment({
      userId: user.id,
      amount: paymentIntent.amount / 100, // Convert from cents
      status: 'failed',
      description: `Failed payment ${paymentIntent.id}`,
      method: 'credit_card',
      stripePaymentIntentId: paymentIntent.id,
      stripePaymentMethodId: paymentIntent.payment_method as string,
    });
    
    console.log('💳 Failed payment recorded for user:', user.email);
  } catch (error) {
    console.error('❌ Error handling payment failure:', error);
  }
};

const handleSetupIntentSucceeded = async (setupIntent: Stripe.SetupIntent) => {
  console.log('✅ Setup intent succeeded:', setupIntent.id);
  
  try {
    const customerId = setupIntent.customer as string;
    const paymentMethodId = setupIntent.payment_method as string;
    
    if (!customerId || !paymentMethodId) {
      console.warn('⚠️  Setup intent missing customer or payment method');
      return;
    }
    
    // Payment method will be saved when user completes the flow on frontend
    console.log('💳 Setup intent completed for customer:', customerId);
  } catch (error) {
    console.error('❌ Error handling setup intent:', error);
  }
};

const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session) => {
  console.log('✅ Checkout session completed:', session.id);
  
  try {
    const customerId = session.customer as string;
    if (!customerId) {
      console.warn('⚠️  Checkout session without customer ID:', session.id);
      return;
    }
    
    const user = await storage.getUserByCustomerId(customerId);
    if (!user) {
      console.warn('⚠️  User not found for customer:', customerId);
      return;
    }
    
    // Record successful payment with tax information
    const totalAmount = session.amount_total || 0;
    const taxAmount = session.total_details?.amount_tax || 0;
    const subtotalAmount = totalAmount - taxAmount;
    
    await storage.createPayment({
      userId: user.id,
      amount: totalAmount / 100, // Convert from cents
      status: 'successful',
      description: `Checkout Session ${session.id}`,
      method: 'credit_card',
      stripePaymentIntentId: session.payment_intent as string,
      stripePaymentMethodId: (session as any).payment_method || '',
    });
    
    console.log('💳 Checkout payment recorded:', {
      user: user.email,
      total: totalAmount / 100,
      tax: taxAmount / 100,
      subtotal: subtotalAmount / 100,
    });
    
  } catch (error) {
    console.error('❌ Error handling checkout session completion:', error);
  }
};

const handleCheckoutSessionExpired = async (session: Stripe.Checkout.Session) => {
  console.log('⏰ Checkout session expired:', session.id);
  // Could track abandoned checkouts for analytics
};

// Resolve a membership from a subscription — matches by stripeSubscriptionId first,
// then falls back to the user's primary membership if it has no subscription ID yet.
const resolveMembershipForSubscription = async (subscription: Stripe.Subscription) => {
  // Primary lookup: find the exact membership with this subscription ID
  const bySubId = await storage.getMembershipByStripeSubscriptionId(subscription.id);
  if (bySubId) return bySubId;

  // Fallback: look up by customer → user, only accept if the membership has no subscription
  // attached yet (so we don't overwrite a different subscription's membership)
  const customerId = subscription.customer as string;
  if (!customerId) return null;
  const user = await storage.getUserByCustomerId(customerId);
  if (!user) return null;
  const membership = await storage.getMembershipByUserId(user.id);
  if (membership && !membership.stripeSubscriptionId) return membership;

  if (!bySubId) {
    console.warn(`⚠️  No membership found for subscription ${subscription.id} (customer ${customerId})`);
  }
  return null;
};

// Handle subscription creation/updates
const handleSubscriptionUpdated = async (subscription: Stripe.Subscription) => {
  console.log('📋 Subscription updated:', subscription.id, 'Status:', subscription.status);
  
  try {
    const membership = await resolveMembershipForSubscription(subscription);
    if (!membership) return;
    
    // Map Stripe subscription status to membership status
    let membershipStatus: 'active' | 'inactive' | 'expired' | 'frozen' = 'inactive';
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      membershipStatus = 'active';
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      membershipStatus = 'expired';
    } else if (subscription.status === 'past_due') {
      membershipStatus = 'frozen';
    }
    
    // Update membership with Stripe subscription data
    const currentPeriodEnd = (subscription as any).current_period_end;
    await storage.updateMembership(membership.membershipId, {
      status: membershipStatus,
      stripeSubscriptionId: subscription.id,
      endDate: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString().split('T')[0] : undefined,
      autoRenew: !subscription.cancel_at_period_end,
    });
    
    console.log('✅ Membership updated:', membership.membershipId, 'Status:', membershipStatus);
  } catch (error) {
    console.error('❌ Error handling subscription update:', error);
  }
};

// Handle subscription deletion
const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  console.log('🗑️ Subscription deleted:', subscription.id);
  
  try {
    const membership = await resolveMembershipForSubscription(subscription);
    if (!membership) return;
    
    // Mark membership as expired
    await storage.updateMembership(membership.membershipId, {
      status: 'expired',
      autoRenew: false,
    });
    
    console.log('✅ Membership expired:', membership.membershipId);
  } catch (error) {
    console.error('❌ Error handling subscription deletion:', error);
  }
};

// Handle invoice payment for recurring subscriptions
const handleInvoicePaymentSucceeded = async (invoice: Stripe.Invoice) => {
  console.log('🧾 Invoice paid:', invoice.id, 'Amount:', invoice.amount_paid / 100);
  
  try {
    const customerId = invoice.customer as string;
    const subscriptionId = (invoice as any).subscription as string;
    
    if (!customerId) return;
    
    const user = await storage.getUserByCustomerId(customerId);
    if (!user) return;
    
    // Record the payment
    const paymentIntentId = (invoice as any).payment_intent as string;
    await storage.createPayment({
      userId: user.id,
      amount: invoice.amount_paid,
      status: 'successful',
      description: subscriptionId 
        ? `Subscription renewal - Invoice ${invoice.number || invoice.id}`
        : `Payment - Invoice ${invoice.number || invoice.id}`,
      method: 'credit_card',
      membershipId: subscriptionId || 'invoice-payment',
      stripePaymentIntentId: paymentIntentId,
    });
    
    console.log('💳 Invoice payment recorded for user:', user.email);
    
    // If this is a subscription renewal, update the membership end date
    if (subscriptionId) {
      const membership = await storage.getMembershipByUserId(user.id);
      if (membership && membership.stripeSubscriptionId === subscriptionId) {
        const periodEnd = (invoice.lines.data[0] as any)?.period?.end;
        if (periodEnd) {
          await storage.updateMembership(membership.membershipId, {
            status: 'active',
            endDate: new Date(periodEnd * 1000).toISOString().split('T')[0],
          });
          console.log('📅 Membership renewed until:', new Date(periodEnd * 1000));
        }
      }
    }
  } catch (error) {
    console.error('❌ Error handling invoice payment:', error);
  }
};

// Handle failed invoice payment
const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  console.log('❌ Invoice payment failed:', invoice.id);
  
  try {
    const customerId = invoice.customer as string;
    if (!customerId) return;
    
    const user = await storage.getUserByCustomerId(customerId);
    if (!user) return;
    
    // Record the failed payment
    const paymentIntentId = (invoice as any).payment_intent as string;
    await storage.createPayment({
      userId: user.id,
      amount: invoice.amount_due,
      status: 'failed',
      description: `Failed subscription payment - Invoice ${invoice.number || invoice.id}`,
      method: 'credit_card',
      stripePaymentIntentId: paymentIntentId,
    });
    
    // Optionally freeze the membership after payment failure
    const membership = await storage.getMembershipByUserId(user.id);
    if (membership) {
      await storage.updateMembership(membership.membershipId, {
        status: 'frozen',
      });
      console.log('⚠️ Membership frozen due to payment failure for user:', user.email);
    }
  } catch (error) {
    console.error('❌ Error handling failed invoice:', error);
  }
};

// Main webhook handler
export const setupStripeWebhooks = (app: Express) => {
  app.post('/api/stripe/webhook', async (req: Request, res: Response) => {
    if (!STRIPE_WEBHOOK_CONFIG.secret) {
      console.warn('⚠️  Stripe webhook received but STRIPE_WEBHOOK_SECRET not configured');
      return res.status(400).send('Webhook secret not configured');
    }
    
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      console.warn('⚠️  Webhook received without signature');
      return res.status(400).send('No signature provided');
    }
    
    let event: Stripe.Event;
    
    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_CONFIG.secret,
        STRIPE_WEBHOOK_CONFIG.tolerance
      );
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Check if event type is enabled
    if (!STRIPE_WEBHOOK_CONFIG.enabledEvents.includes(event.type as any)) {
      console.log('ℹ️  Ignoring unhandled webhook event:', event.type);
      return res.json({ received: true });
    }
    
    console.log('🔔 Processing webhook event:', event.type, 'ID:', event.id);
    
    try {
      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
          
        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;
          
        case 'setup_intent.succeeded':
          await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
          break;
          
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
          
        case 'checkout.session.expired':
          await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
          break;
          
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
          
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
          
        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
          
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
          
        default:
          console.log('❓ Unhandled event type:', event.type);
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      res.status(500).send('Webhook processing failed');
    }
  });
  
  console.log('🔗 Stripe webhooks configured at /api/stripe/webhook');
};
# Stripe Production Setup Guide

This guide covers setting up Stripe for production use in the Wolf Mother Wellness application.

## Environment Configuration

### Required Environment Variables

```bash
# Production Stripe keys
STRIPE_SECRET_KEY=sk_live_...          # Live secret key from Stripe dashboard
VITE_STRIPE_PUBLIC_KEY=pk_live_...     # Live publishable key from Stripe dashboard  
STRIPE_WEBHOOK_SECRET=whsec_...        # Webhook signing secret from Stripe

# Environment
NODE_ENV=production
```

### Getting Your Stripe Keys

1. **Login to Stripe Dashboard**: https://dashboard.stripe.com
2. **Enable Stripe Tax**: Navigate to Products > Tax and enable Stripe Tax for your account
3. **API Keys**: Navigate to Developers > API keys
   - Copy your **Live publishable key** (starts with `pk_live_`) to `VITE_STRIPE_PUBLIC_KEY`
   - Copy your **Live secret key** (starts with `sk_live_`) to `STRIPE_SECRET_KEY`

### Setting Up Webhooks

1. **Navigate to Webhooks**: In Stripe dashboard, go to Developers > Webhooks
2. **Add Endpoint**: Click "Add endpoint"
   - **URL**: `https://yourdomain.com/api/stripe/webhook`
   - **Events**: Select the following events:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `setup_intent.succeeded`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
3. **Copy signing secret**: After creating the webhook, copy the signing secret (starts with `whsec_`) to `STRIPE_WEBHOOK_SECRET`

## Security Features

### Environment Validation
- Automatic validation of environment-specific keys
- Warnings for mismatched environments (e.g., test keys in production)
- Required webhook secret validation for production

### Stripe Configuration
- Production-ready timeout settings (30 seconds)
- Network retry configuration (3 retries)
- Telemetry disabled for production
- Proper app info for Stripe records

### Webhook Security
- Signature verification with configurable tolerance (5 minutes)
- Event type filtering to handle only expected events
- Comprehensive error handling and logging

### Automatic Tax Collection
- **Stripe Tax Integration**: Automatically calculates and collects sales tax based on customer location
- **Address Collection**: Collects billing and shipping addresses for accurate tax calculation
- **Tax-Inclusive Pricing**: Displays tax amounts separately in checkout sessions
- **Compliance**: Handles tax compliance across different jurisdictions automatically
- **Webhook Processing**: Automatically records tax amounts in payment records

## Production Checklist

### Before Deploying
- [ ] Stripe account activated for live payments
- [ ] Live API keys configured in environment
- [ ] Webhook endpoint configured and tested
- [ ] SSL certificate installed and working
- [ ] Database backup strategy in place

### Testing Production Setup
1. **Test API Keys**: The application will log key types on startup in development
2. **Test Webhook**: Use Stripe CLI to test webhook delivery:
   ```bash
   stripe listen --forward-to https://yourdomain.com/api/stripe/webhook
   ```
3. **Test Payments**: Process a small test payment to verify the flow

### Monitoring and Logging
- Monitor Stripe webhook delivery in dashboard
- Set up alerts for failed payments
- Monitor application logs for Stripe-related errors
- Track key metrics: successful payments, failed payments, setup intents

## Common Issues and Solutions

### Key Validation Errors
**Issue**: "Production environment requires live Stripe secret key"
**Solution**: Ensure you're using keys that start with `sk_live_` and `pk_live_` in production

### Webhook Signature Verification Failed
**Issue**: Webhook requests fail signature verification
**Solution**: 
1. Verify `STRIPE_WEBHOOK_SECRET` is correctly set
2. Ensure webhook URL matches exactly
3. Check that raw request body is being passed to verification

### Payment Intent Creation Fails
**Issue**: Payment intents fail to create
**Solution**:
1. Verify customer exists in Stripe
2. Check amount formatting (should be in cents)
3. Ensure required fields are provided

## Support

For Stripe-specific issues:
- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com

For application-specific issues:
- Check application logs for detailed error messages
- Verify environment variable configuration
- Test with Stripe's test mode first before going live
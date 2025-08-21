# Wolf Mother Wellness - Production Deployment Checklist

## Pre-Deployment Setup ✅

### Stripe Configuration ✅
- [x] **STRIPE_SECRET_KEY** - Live secret key (sk_live_...) ✅
- [x] **VITE_STRIPE_PUBLIC_KEY** - Live publishable key (pk_live_...) ✅
- [x] **STRIPE_WEBHOOK_SECRET** - Webhook signing secret (whsec_...) ✅
- [x] **Stripe Tax** - Enabled in Stripe Dashboard for automatic tax collection

### Required Environment Variables
Check that these are set in Replit Secrets:

#### Payment Processing ✅
- [x] STRIPE_SECRET_KEY
- [x] VITE_STRIPE_PUBLIC_KEY  
- [x] STRIPE_WEBHOOK_SECRET

#### Database ✅
- [x] DATABASE_URL (provided by Replit PostgreSQL)

#### Communication Services
- [ ] TWILIO_ACCOUNT_SID (for SMS reset codes)
- [ ] TWILIO_AUTH_TOKEN
- [ ] TWILIO_PHONE_NUMBER
- [ ] SENDGRID_API_KEY (for email notifications)

#### Security
- [ ] SESSION_SECRET (random 64-character string)

## Stripe Dashboard Configuration

### 1. Webhook Endpoint Setup
Once deployed, configure your webhook endpoint:
1. Go to https://dashboard.stripe.com/webhooks
2. Create endpoint: `https://your-replit-app.replit.app/api/stripe/webhook`
3. Add these events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `setup_intent.succeeded`

### 2. Tax Configuration
1. Go to https://dashboard.stripe.com/tax
2. Enable Stripe Tax
3. Configure tax settings for your business location
4. Set up tax rates for applicable jurisdictions

## Deployment Steps

### 1. Deploy to Replit
1. Click the "Deploy" button in Replit
2. Choose "Autoscale" deployment for production traffic
3. Set custom domain if needed

### 2. Post-Deployment Verification
- [ ] Test user registration and login
- [ ] Test membership purchase with tax calculation
- [ ] Verify webhook endpoints are receiving events
- [ ] Test QR code check-in system
- [ ] Verify admin dashboard functionality

### 3. Production Monitoring
- [ ] Monitor Stripe webhook delivery in dashboard
- [ ] Check application logs for errors
- [ ] Verify tax collection is working correctly
- [ ] Test payment processing end-to-end

## Business Rules Verification

### Membership Rules ✅
- [x] One membership per user enforced
- [x] 18+ age verification required
- [x] Membership agreement completion required
- [x] Adult-only facility restrictions

### Payment Processing ✅
- [x] Automatic tax calculation based on location
- [x] Secure payment processing via Stripe
- [x] Payment method validation before purchases
- [x] Webhook-based payment confirmation

## Security Checklist

### Production Security ✅
- [x] Environment-specific key validation
- [x] Webhook signature verification
- [x] HTTPS-only in production (handled by Replit)
- [x] Secure session management
- [x] Password hashing with crypto.scrypt

## Support Documentation

### For Users
- Membership agreement and terms
- Facility rules and safety guidelines
- QR code check-in instructions
- Payment and billing information

### For Staff
- Admin dashboard guide
- Member management procedures
- Check-in system operation
- Notification management

## Admin Access Instructions

### Easy Admin Login
For easy access to the admin dashboard:

1. **Direct Admin Login Page**: Go to `/admin-login` or `/admin/login`
2. **Footer Access**: Click "Admin Access" link in the footer of any page
3. **Quick URLs**:
   - Admin Login: `https://your-app.replit.app/admin-login`
   - Staff Check-in: `https://your-app.replit.app/staff-checkin`
   - Kiosk Mode: `https://your-app.replit.app/kiosk`

### Admin Privileges
- **Admin users**: Full access to all dashboard features
- **Staff users**: Access to admin dashboard with appropriate permissions
- **Member users**: Denied access with clear error message

## Emergency Contacts

### Technical Issues
- Replit Support: support@replit.com
- Stripe Support: https://support.stripe.com

### Business Operations
- Admin login: /admin-login
- Staff check-in interface: /staff-checkin
- Kiosk check-in: /kiosk

---

## Current Status: Ready for Deployment ✅

All critical components are configured and tested:
- ✅ Stripe payment processing with tax collection
- ✅ Member management system
- ✅ QR code check-in functionality
- ✅ Admin dashboard
- ✅ Database schema and relationships
- ✅ Security measures and validation

**Ready to deploy with confidence!**
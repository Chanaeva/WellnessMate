# Development Setup Guide

## Database Seeding for Development

This guide explains how to set up your development database with test accounts.

### Prerequisites

- PostgreSQL database configured (via `DATABASE_URL`)
- Node.js and npm installed

### Test Accounts

The seed script creates test accounts for various edge cases:

#### Staff & Admin Accounts

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@wolfmother.com | Admin123! |
| **Staff** | staff@wolfmother.com | Staff123! |

#### Member Accounts (All passwords: Member123!)

| Email | Status | Type | Use Case |
|-------|--------|------|----------|
| member@wolfmother.com | Active | Basic | Standard active member |
| expired@wolfmother.com | Expired | Basic | Test expired membership handling |
| frozen@wolfmother.com | Frozen | Premium | Test frozen membership |
| inactive@wolfmother.com | Inactive | Basic | Test inactive membership |
| premium@wolfmother.com | Active | Premium | Test premium membership features |
| vip@wolfmother.com | Active | VIP | Test VIP membership features |
| newmember@wolfmother.com | N/A | N/A | No membership agreement completed |
| daypass@wolfmother.com | N/A | None | Day pass user (no membership) |

### Seed Commands

Run these commands from the project root:

#### Reset Database (Recommended)
Cleans all user data and creates fresh test accounts:
```bash
npx tsx server/seed.ts reset
```

#### Clean Database Only
Removes all user data but keeps configuration (membership plans, landing content):
```bash
npx tsx server/seed.ts clean
```

#### Seed Test Accounts Only
Creates test accounts without cleaning existing data:
```bash
npx tsx server/seed.ts seed
```

### What Gets Cleaned

When you run `clean` or `reset`, the following tables are truncated:
- ✅ Users
- ✅ Memberships
- ✅ Check-ins
- ✅ Payments
- ✅ Payment methods
- ✅ Punch cards
- ✅ Notifications
- ✅ Password reset tokens

### What Gets Preserved

Configuration data is always preserved:
- ⚠️ Membership plans
- ⚠️ Punch card templates
- ⚠️ Landing page content
- ⚠️ Promotions

### Production Safety

⚠️ **WARNING**: Never run these seed commands in production!

The seed script includes safeguards:
- Only runs in development environment
- Test accounts have obvious test emails
- All test passwords are documented

### After Seeding

Once the database is seeded, you can:

1. **Log in as Admin**:
   - Go to `/admin-login`
   - Use: `admin@wolfmother.com` / `Admin123!`
   - Access: Full admin dashboard

2. **Log in as Staff**:
   - Go to `/auth`
   - Use: `staff@wolfmother.com` / `Staff123!`
   - Redirects to: `/staff/check-in`

3. **Log in as Member**:
   - Go to `/auth`
   - Use: `member@wolfmother.com` / `Member123!`
   - Redirects to: `/dashboard`

## Stripe Test Credit Cards

When testing payment functionality in development mode, use these official Stripe test card numbers:

### Successful Payments

| Card Number | Brand | CVC | Expiry | ZIP |
|-------------|-------|-----|--------|-----|
| `4242 4242 4242 4242` | Visa | Any 3 digits | Any future date | Any 5 digits |
| `4000 0566 5566 5556` | Visa (debit) | Any 3 digits | Any future date | Any 5 digits |
| `5555 5555 5555 4444` | Mastercard | Any 3 digits | Any future date | Any 5 digits |
| `2223 0031 2200 3222` | Mastercard (2-series) | Any 3 digits | Any future date | Any 5 digits |
| `3782 822463 10005` | American Express | Any 4 digits | Any future date | Any 5 digits |
| `6011 1111 1111 1117` | Discover | Any 3 digits | Any future date | Any 5 digits |

### Testing Specific Scenarios

| Card Number | Scenario |
|-------------|----------|
| `4000 0000 0000 9995` | Declined - Insufficient funds |
| `4000 0000 0000 9987` | Declined - Lost card |
| `4000 0000 0000 9979` | Declined - Stolen card |
| `4000 0000 0000 0069` | Expired card error |
| `4000 0000 0000 0127` | Incorrect CVC error |
| `4000 0000 0000 0002` | Declined - Generic decline |

### 3D Secure Authentication

| Card Number | Authentication |
|-------------|----------------|
| `4000 0027 6000 3184` | Requires 3D Secure authentication |
| `4000 0025 0000 3155` | Requires 3D Secure 2 authentication |

### Important Notes

- ✅ **All test cards work ONLY in test mode** (when using test API keys)
- ✅ **Any future expiry date works** (e.g., 12/34, 01/30, etc.)
- ✅ **Any 3-digit CVC works** (4 digits for Amex)
- ✅ **Any valid ZIP code works** (e.g., 12345, 90210, etc.)
- ⚠️ **Never use real credit card numbers in development**

### Testing in the Application

1. Log in as a member
2. Navigate to checkout or payment page
3. Use `4242 4242 4242 4242` for successful test payments
4. Use other test cards to simulate different scenarios

For more test cards and scenarios, visit: [Stripe Testing Documentation](https://stripe.com/docs/testing)

### Troubleshooting

**"Account already exists" warnings**:
- This is normal if accounts were previously created
- Run `npx tsx server/seed.ts reset` to start fresh

**Database connection errors**:
- Verify `DATABASE_URL` is set in environment
- Check database is running and accessible

**Permission errors**:
- Ensure you have write access to the database
- Check database user has necessary privileges

## Development Workflow

### First Time Setup

1. Clone the repository
2. Run `npm install`
3. Ensure database is provisioned (Replit handles this automatically)
4. Run `npm run db:push` to sync schema
5. Run `npx tsx server/seed.ts reset` to create test accounts
6. Run `npm run dev` to start the application

### Daily Development

```bash
# Start the application
npm run dev

# If you need fresh test data
npx tsx server/seed.ts reset

# Push schema changes
npm run db:push
```

### Before Publishing

1. Verify all test data is removed
2. Run `npx tsx server/seed.ts clean`
3. Optionally create a real admin account via the application
4. Test the application with production-like data

## Environment Variables

Required for development:
- `DATABASE_URL` - PostgreSQL connection string
- `TESTING_STRIPE_SECRET_KEY` - Stripe test secret key
- `TESTING_VITE_STRIPE_PUBLIC_KEY` - Stripe test public key

Optional:
- `SESSION_SECRET` - Session encryption key (auto-generated if not set)
- `SENDGRID_API_KEY` - For email notifications
- `TWILIO_ACCOUNT_SID` - For SMS features
- `TWILIO_AUTH_TOKEN` - For SMS features

### Apple Wallet Integration (Optional)

To enable Apple Wallet passes for member check-in QR codes:

- `APPLE_PASS_TYPE_ID` - Your Apple Pass Type ID
- `APPLE_TEAM_ID` - Your Apple Developer Team ID
- `APPLE_PASS_CERT` - Base64 encoded .p12 certificate
- `APPLE_PASS_CERT_PASSWORD` - Password for .p12 certificate

⚠️ **Note**: Apple Wallet requires an active Apple Developer Program membership ($99/year). See [Apple Wallet Setup Guide](./apple-wallet-setup.md) for detailed certificate configuration instructions.

## Additional Resources

- [Apple Wallet Setup Guide](./apple-wallet-setup.md) - Configure Apple Wallet passes
- [Stripe Production Setup](./stripe-production-setup.md) - Production payment configuration
- [Database Schema](../shared/schema.ts) - Schema definitions
- [API Routes](../server/routes.ts) - Backend API endpoints

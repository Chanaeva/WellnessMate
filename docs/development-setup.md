# Development Setup Guide

## Database Seeding for Development

This guide explains how to set up your development database with test accounts.

### Prerequisites

- PostgreSQL database configured (via `DATABASE_URL`)
- Node.js and npm installed

### Test Accounts

The seed script creates three test accounts for development:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@wolfmother.com | Admin123! |
| **Staff** | staff@wolfmother.com | Staff123! |
| **Member** | member@wolfmother.com | Member123! |

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

## Additional Resources

- [Stripe Production Setup](./stripe-production-setup.md)
- [Database Schema](../shared/schema.ts)
- [API Routes](../server/routes.ts)

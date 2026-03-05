# Wolf Mother Wellness - Thermal Wellness Center Membership Management System

## Overview
Wolf Mother Wellness is a full-stack web application designed for managing a thermal wellness center's membership system. It provides comprehensive membership management, efficient check-in functionalities, streamlined payment processing, and robust administrative tools. The project aims to enhance operational efficiency and member satisfaction through a seamless experience for both members and staff, leveraging modern web technologies. The business vision is to create a leading platform for wellness center management, with potential for market expansion and increased member engagement.

## User Preferences
- Preferred communication style: Simple, everyday language.
- API Development: Always create full CRUD operations (Create, Read, Update, Delete) for new endpoints.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system and brand colors (e.g., transparent moss green logo, Romulus and Remus mythology themed placeholders, water-like effects).
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy, session-based auth, and role-based access control (member, staff, admin). Includes email password reset.
- **Session Storage**: PostgreSQL-backed sessions using `connect-pg-simple`.
- **API Design**: RESTful API with consistent error handling and logging.

### Database
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM with type-safe schema definitions.
- **Schema Management**: Drizzle Kit for migrations.

### Core Features
- **Authentication**: Session-based, secure password hashing (scrypt), role-based access control, password reset (email-only), and protected routes. Includes a one-time admin setup for production environments.
- **Membership Management**: Supports multiple plan types, status tracking (active, inactive, expired, frozen), auto-renewal, upgrade/downgrade, age verification (18+), and a one-active-membership-per-user policy. Packages and day passes support purchase channel configuration (kiosk, website, cart) allowing admins to control where each package can be purchased. Multi-membership purchases allow buying multiple memberships at once (configurable limit via admin Package Management page, default is 4). Additional memberships are linked via `managedByUserId` field, allowing the purchaser to view and manage them from their dashboard's "Family Memberships" section. Membership cancellation with friction dialog showing what member will lose, optional reason capture, and choice between immediate or end-of-period cancellation - integrates with Stripe to cancel recurring subscriptions. Stripe Sync tool in the admin Members page reconciles all memberships that have a `stripeSubscriptionId` against live Stripe data, correcting status mismatches caused by missed webhooks or manual overrides.
- **Stripe Sync reliability**: Webhook handlers use `getMembershipByStripeSubscriptionId` as the primary lookup (matching on exact subscription ID) with a customer→user fallback only for memberships that don't yet have a subscription ID attached. `getMembershipByUserId` orders results by active status first, then newest creation date, so multi-membership users get the correct primary membership.
- **Check-in System**: Features manual lookup by name/email at the kiosk, real-time tracking, and day pass confirmation. Kiosk provides self-service check-in via member search. Includes session booking validation - members must book a session before checking in.
- **Session Booking System**: Configurable morning and evening sessions with customizable times, capacity limits, and day-of-week availability controls. Admins can specify which days of the week each session is available (e.g., weekdays only, weekends only, or custom days) via the Session Management page. Members book sessions from their dashboard, and check-in validation ensures they have a valid booking for the current session. Sessions unavailable on a given day are grayed out in the member booking UI. Admin dashboard provides session configuration management. Session times are displayed on the landing page footer. Business timezone is set to 'America/Chicago' (Central Time) for booking time validation - adjust BUSINESS_TIMEZONE constant in server/routes.ts if needed.
- **Special Events System**: Admins can create one-time bookable events (e.g., Moonlit Soak Night, Wellness Workshop) from the Sessions admin tab. Each event has a title, optional description, specific date, start/end time, capacity, and active/hidden toggle. Members see upcoming active events in a "Special Events" card on their dashboard and can book or cancel them with a single click. Booking counts are tracked per event. Tables: `events`, `event_bookings`. API: `/api/events` (member), `/api/admin/events` (admin CRUD), `/api/event-bookings` (member book/cancel).
- **Item Checkout System**: Comprehensive front desk inventory management for borrowed items (robes, shoes, towels, lockers) with full CRUD operations for admins, staff checkout/check-in workflows, automatic availability tracking, member dashboard display of checked-out items, and integrated Stripe charging for priced items.
- **Payment Integration**: Stripe for memberships and punch cards, including payment method management, history, webhook handling, and automatic tax collection via Stripe Tax. Stripe Terminal integration for physical card readers at kiosk - connection token endpoint is public for SDK init, all other Terminal endpoints require admin/staff auth. Kiosk membership purchases create recurring Stripe subscriptions (Terminal: PaymentIntent with setup_future_usage saves card, then subscription created with 30-day billing anchor; Online: subscription created directly with incomplete status). Day passes remain one-time PaymentIntents. Apple Pay and Google Pay support via Stripe Payment Request Button on both online checkout and kiosk flows (shows automatically on supported devices/browsers). Custom splash screen support for WisePOS E readers via Stripe Terminal Configuration API - admins can upload branded 720x1280 images from the "Card Reader" tab in the admin dashboard.
- **Operational Checklists**: Three shift-based checklists (Opening, Closing, Hourly) accessible from a dedicated "Checklists" admin tab. Items are fully configurable (add, edit, delete, categorize, mark required). Staff start a run for the day, check off items in real time (grouped by category, with progress bar), and mark the checklist complete with optional notes. The admin Overview tab shows a "Shift Checklists" card with live completion status for all three types, auto-refreshing every 60 seconds. Tables: `checklist_items`, `checklist_runs`, `checklist_run_items`. API: `/api/admin/checklist-items`, `/api/admin/checklist-runs`, `/api/admin/checklist-summary`.
- **Admin Dashboard**: Centralized management for members (CRUD, status, roles), check-ins, notifications, pricing/packages, inventory, and dynamic landing page content (footer, hero, features, benefits, partners sections are database-driven).
- **Hours of Operation Management**: Administrators can set and update daily hours of operation, including members-only hours and closed days, which are then displayed on the public landing page.
- **User Experience**: Themed form placeholders, streamlined dashboards, consolidated payment/membership views, and a promotional landing page.
- **Registration Flow**: A two-step process involving account creation followed by membership agreement, simplified using email as the primary identifier.
- **Account Claim Flow**: Kiosk-created members can claim their account at /claim-account using SMS verification to set a portal password. Rate limiting (3 requests per 15 min, 5 verification attempts per 15 min) prevents brute-force attacks. Staff can optionally set a password during kiosk member creation for immediate portal access.

## External Dependencies

- **Database**: Neon PostgreSQL serverless database
- **Payments**: Stripe (for payment processing and tax calculation via Stripe Tax)
- **Email**: Gmail SMTP via Nodemailer (for transactional emails including password reset and session booking notifications)
- **SMS**: Twilio (for SMS messaging, used for account claim verification)
- **UI Components**: Radix UI primitives
- **Apple Wallet**: `passkit-generator` library (for generating Apple Wallet passes)

## Important Notes & Debugging

### Development vs Production Databases
**CRITICAL**: Development and Production use SEPARATE PostgreSQL databases. This is how Replit's infrastructure works:
- When running in development mode (`npm run dev`), you're connected to the **development database**
- When deployed/published, the app connects to the **production database**
- Data created in development (members, check-ins, settings) does NOT appear in production
- Data created in production does NOT appear in development

**Common Issue**: If check-ins or member data "resets" after deployment, you may be:
1. Looking at production data while testing was done in development
2. Need to configure settings (hours, packages, etc.) separately in production via admin dashboard

**To verify which database you're using**:
- Check the URL - development uses the Replit preview URL, production uses the deployed `.replit.app` domain
- Production admin setup is separate - use the one-time admin setup flow at first production launch

### Kiosk M2 Card Reader Connection
- The M2 reader connects via Bluetooth - ensure Bluetooth is enabled on the kiosk device
- New readers must be registered in Stripe Dashboard (dashboard.stripe.com/terminal/readers) before use
- The kiosk shows connection status: Initializing → Searching → Connecting → Connected
- Troubleshooting tips are displayed if connection fails
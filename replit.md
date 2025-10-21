# Wolf Mother Wellness - Thermal Wellness Center Membership Management System

## Overview
Wolf Mother Wellness is a full-stack web application designed to manage a thermal wellness center's membership system. The project aims to provide comprehensive membership management, efficient check-in functionalities, streamlined payment processing, and robust administrative tools. Its vision is to create a seamless and immersive experience for both members and staff, leveraging modern web technologies to enhance operational efficiency and member satisfaction within the wellness industry.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system and brand colors (e.g., transparent moss green logo, Romulus and Remus mythology themed placeholders, water-like effects in hero section).
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy, session-based auth, and role-based access control (member, staff, admin). Includes SMS and email password reset.
- **Session Storage**: PostgreSQL-backed sessions using `connect-pg-simple`.
- **API Design**: RESTful API with consistent error handling and logging.

### Database
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM with type-safe schema definitions.
- **Schema Management**: Drizzle Kit for migrations.

### Core Features
- **Authentication**: Session-based authentication, secure password hashing (scrypt), role-based access control, password reset (email/SMS), and protected routes.
- **Membership Management**: Multiple plan types, status tracking (active, inactive, expired, frozen), auto-renewal, and upgrade/downgrade capabilities. Enforces one active membership per user and 18+ age verification.
- **Check-in System**: QR code generation, multiple check-in methods (QR scan, manual), real-time tracking, and day pass confirmation system.
- **Payment Integration**: Stripe for memberships and punch cards, payment method management, payment history, and webhook handling. Includes automatic tax collection via Stripe Tax.
- **Admin Dashboard**: Member management (CRUD, status toggle, role management), check-in monitoring, notification system, pricing/package management (CRUD for plans), and landing page content management.
- **User Experience**: Immersive background music and sound effects, themed form placeholders, streamlined dashboard layout, consolidated payment and membership functionalities, and a promotional landing page with marketing cards.
- **Registration Flow**: Two-step registration (account creation then membership agreement), and a simplified process using email as the primary identifier.

## External Dependencies

- **Database**: Neon PostgreSQL serverless database
- **Payments**: Stripe for payment processing and Stripe Tax for automatic tax calculation.
- **Email**: SendGrid for transactional emails.
- **SMS**: Twilio for SMS messaging (e.g., password reset).
- **UI Components**: Radix UI primitives.

## Recent Fixes and Improvements (October 2025)

### Availability Dates Feature
- Added availability date tracking for membership plans, punch card templates, and promotions
- Fixed timezone issues in date display (now uses UTC components to prevent date shifting)
- Added availability date badges to:
  - Landing page membership cards
  - Packages page membership and day pass cards
  - Admin promotion cards

### Kiosk and Access Improvements
- Fixed critical React hooks error in kiosk check-in (useEffect now called before conditional returns)
- Made packages page publicly accessible (removed authentication requirement for browsing)
- Added `/kiosk/member-creation` route to enable kiosk-based member registration with payment
- Fixed price formatting bug in kiosk member creation (prices now display as $45.00 instead of $4500)
- Added comprehensive logging to kiosk payment flow for debugging

### Stripe Configuration (October 21, 2025)
- **Development Environment**: Successfully configured Stripe test keys using `DEV_STRIPE_SECRET` and `DEV_STRIPE_PUBLIC` environment variables
- **Test Keys**: Application now correctly uses Stripe test keys (sk_test_*, pk_test_*) in development
- **Dynamic Key Loading**: `/api/stripe/config` endpoint dynamically provides correct Stripe public key to frontend
- **Kiosk Payment Testing**: End-to-end testing confirmed successful payment processing with Stripe test cards
- **Member Creation Flow**: Verified that kiosk member creation creates user accounts, activates memberships, and records payments correctly
- **Note**: Production Stripe keys (STRIPE_SECRET_KEY, VITE_STRIPE_PUBLIC_KEY) should be configured separately for deployment
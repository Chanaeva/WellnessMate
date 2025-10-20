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
- Updated Stripe configuration to prefer test keys in development
- Added `/api/stripe/config` endpoint to dynamically provide Stripe public key to frontend

### Known Configuration Issues
- **Stripe Testing**: The application is configured to use TESTING_STRIPE_SECRET_KEY and TESTING_VITE_STRIPE_PUBLIC_KEY environment variables in development, but these need to be set with actual Stripe test API keys (starting with `sk_test_` and `pk_test_`) for kiosk payment testing to work properly.
- Until test keys are configured, kiosk member creation with payment will fail with "live mode, but used a known test card" errors.
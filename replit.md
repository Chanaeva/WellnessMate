# Wolf Mother Wellness - Thermal Wellness Center Membership Management System

## Overview
Wolf Mother Wellness is a full-stack web application for managing a thermal wellness center's membership system. It provides comprehensive membership management, efficient check-in functionalities, streamlined payment processing, and robust administrative tools. The project aims to create a seamless experience for members and staff, enhancing operational efficiency and member satisfaction using modern web technologies.

## User Preferences
Preferred communication style: Simple, everyday language.

## Development Environment

### Test Accounts (Development Only)

For development and testing purposes, use these pre-configured accounts:

**Admin & Staff** (Admin123! / Staff123!):
- admin@wolfmother.com (Admin)
- staff@wolfmother.com (Staff)

**Members** (All use password: Member123!):
- member@wolfmother.com - Active basic membership
- expired@wolfmother.com - Expired membership
- frozen@wolfmother.com - Frozen premium membership
- inactive@wolfmother.com - Inactive membership
- premium@wolfmother.com - Active premium membership
- vip@wolfmother.com - Active VIP membership
- newmember@wolfmother.com - No membership agreement
- daypass@wolfmother.com - Day pass user (no membership)

### Database Management

**Seed Commands** (run from project root):
- `npx tsx server/seed.ts reset` - Clean database and create test accounts (recommended)
- `npx tsx server/seed.ts clean` - Remove all user data, keep configuration
- `npx tsx server/seed.ts seed` - Create test accounts only

**What Gets Cleaned**: Users, memberships, check-ins, payments, notifications
**What's Preserved**: Membership plans, landing content, promotions

⚠️ **Production Safety**: Never run seed commands in production. Always clean test data before publishing.

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
- **Authentication**: Passport.js with local strategy, session-based auth, and role-based access control (member, staff, admin). Includes email password reset.
- **Session Storage**: PostgreSQL-backed sessions using `connect-pg-simple`.
- **API Design**: RESTful API with consistent error handling and logging.

### Database
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM with type-safe schema definitions.
- **Schema Management**: Drizzle Kit for migrations.

### Core Features
- **Authentication**: Session-based, secure password hashing (scrypt), role-based access control, password reset (email-only), and protected routes.
- **Membership Management**: Multiple plan types, status tracking (active, inactive, expired, frozen), auto-renewal, upgrade/downgrade capabilities, one active membership per user, and 18+ age verification.
- **Check-in System**: QR code generation, multiple check-in methods (QR scan, manual lookup by staff), real-time tracking, and day pass confirmation system. Integrates Apple Wallet for QR pass.
- **Payment Integration**: Stripe for memberships and punch cards, payment method management, payment history, webhook handling, and automatic tax collection via Stripe Tax.
- **Admin Dashboard**: Member management (CRUD, status toggle, role management), check-in monitoring, notification system, pricing/package management (CRUD for plans), and comprehensive landing page content management (footer, hero, features, benefits, partners sections are database-driven).
- **User Experience**: Immersive background music/sound effects, themed form placeholders, streamlined dashboard, consolidated payment/membership, promotional landing page with marketing cards.
- **Registration Flow**: Two-step registration (account creation then membership agreement), simplified using email as primary identifier.

## External Dependencies

- **Database**: Neon PostgreSQL serverless database
- **Payments**: Stripe for payment processing and Stripe Tax for automatic tax calculation.
- **Email**: SendGrid for transactional emails.
- **SMS**: Twilio for SMS messaging (e.g., password reset functionality previously, now simplified to email for password reset).
- **UI Components**: Radix UI primitives.
- **Apple Wallet**: `passkit-generator` library for generating Apple Wallet passes.

## Recent Updates

### Enhanced Admin/Staff Account Management (November 10, 2025)
- **Admin-Only Staff/Admin Creation**: Administrators can now create staff and admin accounts through a dedicated interface
- **Backend Implementation**:
  - POST `/api/admin/users` - Create staff or admin accounts (admin-only, requires authentication)
  - GET `/api/admin/users` - List all staff and admin accounts (admin-only)
  - Auto-generates usernames from email addresses (handles collisions with numeric suffixes)
  - Validates email uniqueness before account creation
  - Passwords hashed with scrypt before storage
  - Staff/admin accounts bypass membership agreement workflow (auto-completed)
  - Schema validation via `createStaffAdminSchema` (email, password, firstName, lastName, role, phoneNumber)
- **Frontend Implementation** (`/admin/staff-management`):
  - Admin-only page for creating and managing staff/admin accounts
  - Creation dialog with React Hook Form + Zod validation
  - Table view showing name, email, phone, role badge, and creation date
  - Role selection: Staff or Admin
  - TanStack Query integration for data fetching and mutations
  - Comprehensive data-testid attributes for E2E testing
- **Enhanced Login Experience**:
  - Staff users now redirect to `/staff/check-in` after login (previously redirected to dashboard)
  - Admin users redirect to `/admin` dashboard
  - Member users redirect to `/dashboard` or `/membership-agreement` if incomplete
- **Security Features**:
  - Admin-only access enforced with `isAdmin` middleware
  - Email as primary identifier (unique constraint enforced)
  - No passwords returned in API responses
  - Session-based authentication required for all operations
- **User Management**:
  - Auto-generated usernames from email prefix (e.g., john.doe@example.com → john.doe)
  - Collision handling with numeric suffixes (john.doe_1, john.doe_2, etc.)
  - Staff/admin accounts marked as membership agreement completed
  - No age verification required for staff/admin accounts
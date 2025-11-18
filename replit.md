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
- **Item Checkout System**: Front desk inventory management for tracking borrowed items (robes, shoes, towels, lockers). Admin CRUD operations for inventory, staff checkout/checkin workflows with member search, automatic availability tracking, and member dashboard display of checked-out items.
- **Payment Integration**: Stripe for memberships and punch cards, payment method management, payment history, webhook handling, and automatic tax collection via Stripe Tax.
- **Admin Dashboard**: Member management (CRUD, status toggle, role management), check-in monitoring, notification system, pricing/package management (CRUD for plans), inventory management (item CRUD, availability tracking), and comprehensive landing page content management (footer, hero, features, benefits, partners sections are database-driven).
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

### Front Desk Item Checkout System (November 17, 2025)
- **Complete Inventory Management**: Full CRUD system for tracking physical items that members can borrow (robes, shoes, towels, lockers, etc.)
- **Database Schema** (`shared/schema.ts`):
  - `inventory_items` table: Tracks item details, categories, sizes, total/available quantities, and active status
  - `item_checkouts` table: Records checkout/checkin transactions with timestamps and user associations
  - Atomic operations with row-level locking to prevent double-booking
- **Backend Implementation** (`server/storage.ts`, `server/routes.ts`):
  - Admin routes: POST/GET/PATCH/DELETE `/api/admin/inventory/items` for CRUD operations
  - Staff routes: POST/GET/DELETE `/api/staff/item-checkouts` for checkout/checkin/lookup operations
  - Member routes: GET `/api/member/item-checkouts` for viewing personal checkout history
  - Transaction safeguards: `FOR UPDATE` row locks, availability validation, automated quantity tracking
  - Zod schema validation on all routes with proper error handling
- **Admin Inventory Page** (`/admin` → Inventory tab):
  - Integrated into admin dashboard as dedicated tab (no standalone Header/Footer)
  - Create/edit/delete inventory items with form validation
  - Real-time availability tracking (e.g., "8/10 available")
  - Category filtering (Robe, Shoes, Towel, Locker, Other)
  - Active/inactive status toggle with badge indicators
  - Comprehensive data-testid attributes for E2E testing
- **Staff Checkout Page** (`/staff/items`):
  - Dedicated route accessible from staff navigation
  - Member search by email with real-time lookup
  - Available items display with instant checkout capability
  - Automatic inventory quantity updates on checkout/checkin
  - Member's currently checked-out items table with one-click return
  - Optimistic UI updates with TanStack Query cache invalidation
- **Member Dashboard Integration**:
  - "Items Checked Out" section displays currently borrowed items
  - Shows item name, category, size, checkout timestamp
  - Empty state messaging when no items checked out
- **Technical Highlights**:
  - Fixed checkbox onChange handlers to pass boolean values for Zod validation
  - Removed duplicate Header/Footer structure from admin inventory component
  - Row-level locking prevents concurrent checkout race conditions
  - All operations properly invalidate React Query caches for real-time UI updates

### Kiosk Check-In Improvements (November 18, 2025)
- **Manual Entry Fallback**: Members can now check in using email or membership ID when QR scanning fails
- **Backend Implementation** (`server/routes.ts`):
  - GET `/api/kiosk/search-member?query={email|membershipId}` - Secure member lookup (email or membershipId only)
  - Returns minimal member info: id, firstName, lastName, email, membershipId
  - Case-insensitive email search, exact membership ID match
  - 404 response for member not found
- **Frontend Implementation** (`client/src/pages/kiosk-checkin.tsx`):
  - Added manual-entry scanner mode with search input
  - Debounced search (triggers after ≥3 characters)
  - Visual feedback: Loading state ("Searching..."), success (green card with member info), error (red card with "Member not found")
  - "Check In" button validates membershipId before proceeding
  - Comprehensive data-testid attributes for E2E testing
- **Streamlined State Machine**:
  - Auto-resume: Success state auto-returns to "Ready to Check In" after 5 seconds
  - Auto-resume: Error state auto-returns to "Ready to Check In" after 4 seconds
  - Fixed day pass confirmation UI with explicit "Use Membership" and "Use Day Pass" buttons
  - Proper scanner lifecycle management: await scanner.clear() before re-initialization
  - Query lifecycle safeguards prevent empty/invalid searches
- **Buy Day Pass Flow**:
  - "Buy Day Pass" button redirects to existing member creation flow (supports day pass purchases)
  - Simplified SelectItem components (removed nested divs/icons for accessibility)
- **Security & Performance**:
  - Manual search restricted to email/membershipId only (prevents broad data exposure)
  - Query only enabled when scannerMode === 'manual-entry' and valid search term
  - staleTime: 0 and gcTime: 0 prevent stale query caching
  - Proper DOM cleanup prevents scanner canvas leaks
- **E2E Testing**:
  - ✅ Manual entry by email: Search → Display → Check-in → Success
  - ✅ Member not found error handling with visual feedback
  - ✅ Auto-resume functionality after success/error
  - ✅ All kiosk navigation buttons functional
  - ⚠️ QR scanning not testable in headless Playwright (expected limitation)

### Weekly Hours of Operation Management (November 18, 2025)
- **Enhanced Hours Management**: Administrators can now set different hours for each day of the week
- **Database Schema** (`shared/schema.ts`):
  - `hours_of_operation` table: Tracks daily schedules with day_of_week enum (Monday-Sunday)
  - Columns: open_time, close_time, members_only_start, members_only_end, is_closed (boolean)
  - Seeded with default hours for all 7 days
- **Backend Implementation** (`server/routes.ts`):
  - GET `/api/admin/hours-of-operation` - Fetch all weekly hours (admin-only)
  - PUT `/api/admin/hours-of-operation/:id` - Update specific day hours (admin-only)
  - GET `/api/hours-of-operation` - Public endpoint for landing page display
  - Zod validation with insertHoursOfOperationSchema
- **Admin UI** (`/admin/landing-page` → Settings tab):
  - Weekly schedule editor with day-by-day cards
  - Each day shows: open/close time, members-only hours, closed toggle
  - Optimistic UI updates with onBlur save for time inputs
  - Switch component for marking days as closed (hides time inputs when closed)
  - Real-time updates with TanStack Query cache invalidation
- **Landing Page Footer** (`/` footer):
  - Displays weekly hours schedule instead of simple text
  - Format: "Monday: 6:00 AM - 10:00 PM" or "Sunday: Closed"
  - Graceful fallback to legacy format if no data
- **E2E Testing**:
  - ✅ Admin can update hours for each day
  - ✅ Closed toggle works and hides time inputs
  - ✅ Changes reflected on landing page footer
  - ✅ Weekly schedule displays correctly for all 7 days
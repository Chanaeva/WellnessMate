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
- **Membership Management**: Supports multiple plan types, status tracking (active, inactive, expired, frozen), auto-renewal, upgrade/downgrade, age verification (18+), and a one-active-membership-per-user policy.
- **Check-in System**: Features QR code generation, multiple check-in methods (QR scan, manual lookup), real-time tracking, day pass confirmation, and Apple Wallet integration for QR passes. Manual entry fallback via email or membership ID is available for kiosk check-ins. Includes session booking validation - members must book a session before checking in.
- **Session Booking System**: Configurable morning and evening sessions with customizable times and capacity limits. Members book sessions from their dashboard, and check-in validation ensures they have a valid booking for the current session. Admin dashboard provides session configuration management. Session times are displayed on the landing page footer.
- **Item Checkout System**: Comprehensive front desk inventory management for borrowed items (robes, shoes, towels, lockers) with full CRUD operations for admins, staff checkout/check-in workflows, automatic availability tracking, member dashboard display of checked-out items, and integrated Stripe charging for priced items.
- **Payment Integration**: Stripe for memberships and punch cards, including payment method management, history, webhook handling, and automatic tax collection via Stripe Tax. Stripe Terminal integration for physical card readers at kiosk - connection token endpoint is public for SDK init, all other Terminal endpoints require admin/staff auth.
- **Admin Dashboard**: Centralized management for members (CRUD, status, roles), check-ins, notifications, pricing/packages, inventory, and dynamic landing page content (footer, hero, features, benefits, partners sections are database-driven).
- **Hours of Operation Management**: Administrators can set and update daily hours of operation, including members-only hours and closed days, which are then displayed on the public landing page.
- **User Experience**: Themed form placeholders, streamlined dashboards, consolidated payment/membership views, and a promotional landing page.
- **Registration Flow**: A two-step process involving account creation followed by membership agreement, simplified using email as the primary identifier.

## External Dependencies

- **Database**: Neon PostgreSQL serverless database
- **Payments**: Stripe (for payment processing and tax calculation via Stripe Tax)
- **Email**: SendGrid (for transactional emails)
- **SMS**: Twilio (for SMS messaging, previously used for password reset)
- **UI Components**: Radix UI primitives
- **Apple Wallet**: `passkit-generator` library (for generating Apple Wallet passes)
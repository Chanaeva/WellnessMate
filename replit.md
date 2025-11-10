# Wolf Mother Wellness - Thermal Wellness Center Membership Management System

## Overview
Wolf Mother Wellness is a full-stack web application for managing a thermal wellness center's membership system. It provides comprehensive membership management, efficient check-in functionalities, streamlined payment processing, and robust administrative tools. The project aims to create a seamless experience for members and staff, enhancing operational efficiency and member satisfaction using modern web technologies.

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
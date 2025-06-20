# Wolf Mother Wellness - Thermal Wellness Center Membership Management System

## Overview

This is a full-stack web application for managing a thermal wellness center's membership system. The application provides membership management, check-in functionality, payment processing, and administrative tools for Wolf Mother Wellness center.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system and brand colors
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **API Design**: RESTful API with consistent error handling and logging

### Database Architecture
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection**: Neon serverless connection with WebSocket support

## Key Components

### Authentication System
- Session-based authentication with secure password hashing (scrypt)
- Role-based access control (member, staff, admin)
- Password reset functionality with time-limited tokens
- Protected routes for different user roles

### Membership Management
- Multiple membership plan types (basic, premium, vip, daily)
- Membership status tracking (active, inactive, expired, frozen)
- Auto-renewal capabilities
- Stripe integration for payment processing

### Check-in System
- QR code generation for member check-ins
- Multiple check-in methods (QR scan, manual entry)
- Real-time check-in tracking and history
- Staff check-in interface for manual processing

### Payment Integration
- Stripe payment processing for memberships and punch cards
- Payment method management
- Payment history tracking
- Webhook handling for payment events

### Admin Dashboard
- Member management and statistics
- Check-in monitoring and reporting
- Notification system for announcements
- Pricing and package management

## Data Flow

### User Registration/Login Flow
1. User submits credentials via React form
2. Frontend validates with Zod schemas
3. Backend authenticates using Passport.js
4. Session created and stored in PostgreSQL
5. User data cached in React Query

### Check-in Flow
1. Member generates QR code containing membership ID
2. Staff scans QR code or manually enters membership ID
3. Backend validates membership status and creates check-in record
4. Real-time feedback provided to both member and staff

### Payment Flow
1. User selects membership or punch card package
2. Stripe payment intent created on backend
3. Frontend handles secure payment processing
4. Webhook confirms payment completion
5. Membership or punch card activated in database

## External Dependencies

### Core Dependencies
- **Database**: Neon PostgreSQL serverless database
- **Payments**: Stripe for payment processing
- **Email**: SendGrid for transactional emails
- **UI Components**: Radix UI primitives for accessible components

### Development Tools
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast production builds
- **Vite**: Development server with HMR
- **Tailwind CSS**: Utility-first styling

### Authentication & Security
- **Passport.js**: Authentication middleware
- **Crypto**: Built-in Node.js crypto for password hashing
- **Session Management**: Secure session handling with PostgreSQL storage

## Deployment Strategy

### Development Environment
- Replit-based development with hot module replacement
- PostgreSQL module for database provisioning
- Environment variable management for API keys

### Production Build
- Vite builds optimized frontend bundle
- ESBuild creates single-file backend bundle
- Static assets served from Express server
- Deployment target: Autoscale on Replit

### Environment Configuration
- Database URL for PostgreSQL connection
- Stripe public/secret keys for payment processing
- SendGrid API key for email functionality
- Session secret for secure authentication

## Recent Changes

- June 18, 2025: Improved mobile usability of add payment method form ✓
  - Separated card inputs into individual fields (card number, expiry, CVC)
  - Increased font size from 16px to 18px for better readability
  - Changed from dark theme to light theme for better form visibility
  - Added responsive button layout (stacked on mobile, side-by-side on desktop)
  - Enhanced touch targets with larger padding
  - Added visual feedback states for card input validation
  - Included security reassurance text
  - User confirmed: "Looks much better"

- June 18, 2025: Reorganized payments page layout ✓
  - Moved Transaction History section below Payment Methods section
  - Removed export option from Transaction History
  - Maintained all existing functionality with cleaner structure
  - User confirmed: "Yeah I like it much better"

- June 18, 2025: Fixed punch card purchase loading states on dashboard ✓
  - Added specific tracking for which punch card is being purchased
  - Only the selected button shows loading state instead of all buttons
  - Improved user experience with precise feedback

- June 18, 2025: Added payment method validation for purchases ✓
  - Users must have a payment method on file before purchasing
  - Added validation for both punch card and membership purchases
  - Redirects users to payments page to add card if none exists
  - Shows clear error message explaining requirement

- June 18, 2025: Enhanced payment method requirement notifications ✓
  - Replaced small toast with prominent full-screen alert dialog
  - Added warning icon and red styling for immediate attention
  - Clear explanation of why payment method is needed
  - Large accessible buttons with clear actions
  - Add payment method form now opens by default on payments page

- June 18, 2025: Consolidated membership page into dashboard for simplification ✓
  - Removed standalone membership page and integrated functionality into dashboard
  - Updated navigation to include packages page instead of membership page
  - Unified user experience with all member features in single dashboard view
  - Enhanced member card with additional membership details

- June 18, 2025: Created shopping cart system for packages and memberships ✓
  - Added cart context provider for state management
  - Created cart sidebar component with add/remove functionality
  - Built comprehensive checkout page with order summary
  - Added "Add to Cart" buttons to packages page
  - Integrated cart icon in header navigation
  - Added backend checkout endpoint to process cart purchases
  - Cleaned up old test purchase data from database

- June 18, 2025: Simplified dashboard Quick Purchase section ✓
  - Removed complex Quick Purchase cards section
  - Replaced with simple "View Plans & Packages" button
  - Cleaner, more focused dashboard design
  - Directs users to comprehensive packages page for shopping

- June 18, 2025: Consolidated payments functionality into dashboard ✓
  - Moved payment methods management to dashboard sidebar
  - Integrated recent transactions display
  - Removed standalone payments page for unified experience
  - Updated navigation to remove payments link
  - All payment features now accessible from main dashboard

- June 18, 2025: Streamlined dashboard layout for better UX ✓
  - Removed Quick Actions card to reduce clutter
  - Made plans & packages button conditional based on membership status
  - Active members see "Explore More" at bottom, inactive see main CTA prominently
  - Simplified checkout flow with payment method management only in cart/dashboard

- June 18, 2025: Centralized payment method management to checkout page only ✓
  - Removed payment method management from dashboard sidebar
  - Removed payment method management from cart sidebar  
  - Payment methods can only be added/managed on checkout page
  - Streamlined single location for payment handling

- June 18, 2025: Added payment methods display to dashboard ✓
  - Members can now view their saved payment methods in dashboard
  - Read-only display showing card details and default status
  - Payment method addition still only available at checkout
  - Provides confirmation to users that their cards are saved

- June 20, 2025: Cleaned up packages page layout ✓
  - Removed "Ready to Start Your Wellness Journey?" CTA section
  - Streamlined page to focus on product selection
  - Maintained facility overview section for educational content

- June 20, 2025: Lightened card header backgrounds ✓
  - Changed bg-black/20 to bg-black/5 across all card headers
  - Applied to member card, dashboard welcome banner, and admin pricing cards
  - Created lighter, more subtle overlay effect

## Changelog

Changelog:
- June 18, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.
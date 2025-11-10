# Wolf Mother Wellness - Check-In Workflows Documentation

## Overview
This document outlines all in-person check-in methods for members and day pass holders at Wolf Mother Wellness thermal wellness center.

---

## Check-In Methods Summary

| Method | Location | Who Can Use | Authentication Required |
|--------|----------|-------------|------------------------|
| **Member QR Code Check-In** | Kiosk or Staff | Members with active membership or day passes | No (public kiosk endpoint) |
| **Staff Manual Check-In** | Front Desk | Staff/Admin only | Yes (staff/admin login) |
| **New Member Registration + Check-In** | Kiosk | New visitors | No (creates account during flow) |

---

## 1. Member QR Code Check-In at Kiosk

**Location**: `/kiosk/check-in` (public access, no login required)

### Flow A: Member with Active Membership

```
1. Member arrives at kiosk
2. Member opens QR code on their phone (from /qr-code page in member app)
   OR uses Apple Wallet pass (if configured)
3. Kiosk scans QR code using device camera
4. System validates QR code:
   - Checks if QR code is for today (daily rotation for security)
   - Extracts membership ID from QR code
   - Format: {"type":"member_daily_checkin","membershipId":"WM-XXX","userId":123,"date":"YYYY-MM-DD"}
5. System checks membership status:
   - Finds user by membership ID
   - Verifies membership is active
6. ✅ Check-in successful!
7. System records:
   - User ID
   - Membership ID
   - Timestamp
   - Location: "Kiosk Check-in"
   - Method: "qr"
8. Display success screen with:
   - Member name
   - Membership type
   - Check-in confirmation
9. Auto-reset kiosk after 7 seconds
```

**API Endpoint**: `POST /api/kiosk-check-in`
**Request**: `{ membershipId: "WM-XXX" }`
**Response**: 
```json
{
  "success": true,
  "member": {
    "firstName": "Jane",
    "lastName": "Doe",
    "membershipType": "premium",
    "membershipStatus": "active"
  },
  "message": "Welcome Jane! Enjoy your wellness session."
}
```

---

### Flow B: Member with Expired Membership BUT Active Day Passes

```
1-4. [Same as Flow A - QR scan and validation]
5. System checks membership status:
   - Membership is expired/inactive
6. System checks for day passes:
   - Queries punch cards for this user
   - Finds active day pass packages with remaining punches
7. ⚠️ Show confirmation screen:
   - "Your membership is expired"
   - "You have [X] day passes remaining"
   - "Use a day pass for today's visit?"
   - [Use Day Pass] or [Cancel] buttons
8. Member selects "Use Day Pass"
9. System processes:
   - Deducts 1 punch from oldest day pass package
   - Creates check-in record with membershipId: "day-pass-{punchCardId}"
10. ✅ Check-in successful!
11. Display success screen with:
    - Member name
    - Day passes used: 1
    - Remaining day passes across all packages
12. Auto-reset kiosk after 7 seconds
```

**API Endpoint**: `POST /api/kiosk-check-in`
**Request**: `{ membershipId: "WM-XXX", useDayPass: true }`
**Response**: 
```json
{
  "success": true,
  "member": {
    "firstName": "Jane",
    "lastName": "Doe"
  },
  "dayPassInfo": {
    "used": true,
    "totalRemaining": 9,
    "packages": [
      {
        "id": 5,
        "name": "10-Visit Day Pass Package",
        "remaining": 9,
        "total": 10
      }
    ]
  },
  "message": "Day pass used successfully! You have 9 visits remaining."
}
```

---

### Flow C: Member with No Valid Access

```
1-4. [Same as Flow A - QR scan and validation]
5. System checks membership status: EXPIRED/INACTIVE
6. System checks for day passes: NONE FOUND
7. ❌ Show error screen:
   - "Your membership has expired"
   - "No day passes available"
   - "Please see staff to renew or purchase day passes"
8. Auto-reset kiosk after 3 seconds
```

**API Response**: 
```json
{
  "success": false,
  "message": "Your membership has expired and you have no day passes available. Please see staff to renew."
}
```

---

## 2. Staff Manual Check-In at Front Desk

**Location**: `/staff/check-in` (requires staff/admin login)

### Workflow

```
1. Staff member logs into system
2. Navigates to Staff Check-In page
3. Three options available:
   
   OPTION A: QR Code Scan
   - Staff uses device camera to scan member's QR code
   - System auto-processes check-in (same validation as kiosk)
   - Success confirmation appears
   
   OPTION B: Manual Lookup (NEW)
   - Staff searches for member by name, email, or phone
   - Search is debounced (300ms) and requires 2+ characters
   - Results show:
     * Member name, email, phone
     * Active membership status with plan type and expiration
     * Day pass count (if any)
   - Staff clicks "Check In" for active members
   - Staff clicks "Use Day Pass" for day pass confirmation
   - System validates and processes
   - Success confirmation appears
   
   OPTION C: Backup Entry (Legacy)
   - Currently disabled in favor of Manual Lookup
   - Previously allowed manual membership ID entry

4. System creates check-in record:
   - User ID
   - Membership ID (or day-pass-{id} for day pass check-ins)
   - Timestamp
   - Location: "Front Desk - Manual"
   - Method: "manual"
   
5. Display last check-in info:
   - Member username
   - Member email
   - Check-in time
```

### Manual Lookup Flow (OPTION B Details)

```
SCENARIO 1: Active Membership Check-In
1. Staff searches "jane" in Manual Lookup tab
2. System searches members by name/email/phone containing "jane"
3. Results show "Jane Doe" with:
   - Active: Premium badge (green)
   - "Until 2026-01-15"
   - Check In button
4. Staff clicks "Check In"
5. ✅ Immediate check-in using membership ID
6. Success message appears

SCENARIO 2: Day Pass Check-In
1. Staff searches for member
2. Results show member with:
   - Membership: expired badge (gray)
   - "5 Day Passes" badge (blue)
   - "Use Day Pass" button
3. Staff clicks "Use Day Pass"
4. ⚠️ Confirmation dialog appears:
   - Shows member name
   - Shows "5 day passes available"
   - Shows "After check-in: 4 remaining"
   - [Cancel] or [Confirm Check-in] buttons
5. Staff clicks "Confirm Check-in"
6. ✅ System deducts 1 day pass and completes check-in
7. Success message appears
8. Search results refresh with updated day pass count (4)

SCENARIO 3: No Access Available
1. Staff searches for member
2. Results show member with:
   - "No Active Access" badge (yellow)
   - "No Access" button (disabled)
3. Staff cannot check in member
4. Staff directs member to purchase membership or day passes
```

**API Endpoints**:

**Search Members**: `GET /api/staff/search-members?query={searchTerm}`
**Authentication**: Required (staff or admin role)
**Response**: 
```json
[
  {
    "id": 123,
    "username": "janedoe",
    "email": "jane@example.com",
    "phoneNumber": "555-1234",
    "firstName": "Jane",
    "lastName": "Doe",
    "membership": {
      "membershipId": "WM-123",
      "status": "active",
      "planType": "premium",
      "startDate": "2025-01-15",
      "endDate": "2026-01-15"
    },
    "dayPassCount": 5
  }
]
```

**Manual Check-In**: `POST /api/admin/manual-checkin`
**Authentication**: Required (staff or admin role)
**Request (Membership)**: `{ membershipId: "WM-XXX", userId: 123 }`
**Request (Day Pass)**: `{ userId: 123, useDayPass: true }`
**Response**: 
```json
{
  "message": "Check-in successful",
  "checkIn": {
    "id": 456,
    "userId": 123,
    "membershipId": "WM-XXX",
    "timestamp": "2025-11-05T14:30:00Z",
    "location": "Front Desk - Manual"
  },
  "member": {
    "username": "janedoe",
    "email": "jane@example.com"
  }
}
```

---

## 3. New Member Registration + First Check-In at Kiosk

**Location**: `/kiosk/member-creation` (public access, no login required)

### Workflow

```
1. New visitor approaches kiosk
2. Selects "New Member" or "Purchase Day Pass"
3. STEP 1: Member Information Form
   - First Name
   - Last Name
   - Email Address
   - Phone Number (optional)
   - Package Type: [Membership] or [Day Pass]
   - Package Selection: Dropdown of available plans/packages
   
4. STEP 2: Payment Processing
   - Shows selected package and price
   - Stripe credit card payment form
   - Member enters card details
   - Processes payment with Stripe
   
5. Payment Success:
   - System creates user account:
     - Generates username from email
     - Sets temporary password (sent via email)
     - Role: "member"
     - Stores contact info
   
   IF MEMBERSHIP SELECTED:
   - Creates active membership record
   - Generates unique membership ID (e.g., WM-123)
   - Sets start date (today) and end date (based on plan)
   - Records payment in database
   
   IF DAY PASS SELECTED:
   - Creates punch card record
   - Sets remaining punches based on package (e.g., 10 visits)
   - Records payment in database
   
6. ✅ Success Screen:
   - "Welcome to Wolf Mother Wellness!"
   - Shows membership ID or day pass count
   - Instructions sent to email
   - Member can now check in immediately
   
7. Auto-reset kiosk after 10 seconds
```

**API Endpoints**:

**Create Payment Intent**: `POST /api/kiosk/create-member-payment`
```json
Request: {
  "memberData": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "phoneNumber": "555-1234",
    "packageType": "membership",
    "packageId": "3"
  },
  "packageData": {
    "id": 3,
    "type": "membership",
    "planType": "premium",
    "price": 8500
  }
}

Response: {
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

**Confirm Member Creation**: `POST /api/kiosk/confirm-member-creation`
```json
Request: {
  "paymentIntentId": "pi_xxx",
  "memberData": { ... },
  "packageData": { ... }
}

Response: {
  "success": true,
  "user": { id: 123, username: "jane@example.com", ... },
  "membership": { id: 45, membershipId: "WM-123", ... } // or punchCard if day pass
}
```

---

## Database Schema

### Check-Ins Table
```sql
check_ins (
  id: serial PRIMARY KEY,
  user_id: integer (references users.id),
  membership_id: text (e.g., "WM-123" or "day-pass-5"),
  timestamp: timestamp DEFAULT NOW,
  location: text DEFAULT 'Main Entrance',
  method: enum('qr', 'manual') DEFAULT 'qr'
)
```

### Key Relationships
- `user_id` → `users.id`
- `membership_id` → Can reference `memberships.membership_id` OR be formatted as "day-pass-{punchCardId}"

---

## QR Code Format

### Member Daily Check-In QR Code
Generated fresh each day for security. Displayed on member's QR Code page (`/qr-code`).

```json
{
  "type": "member_daily_checkin",
  "membershipId": "WM-123",
  "userId": 45,
  "date": "2025-11-05"
}
```

**Security Features**:
- QR code expires daily (must match current date)
- Contains membership ID for validation
- Can be stored in Apple Wallet for offline access

---

## Day Pass System

### How Day Passes Work
- Purchased as "punch cards" (e.g., 10-visit package)
- Each check-in deducts 1 punch from the oldest active package
- Multiple packages can be active simultaneously
- Totals are aggregated across all packages

### Day Pass Check-In Logic
1. Check if member has active membership → Use membership
2. If membership expired → Check for day passes
3. If day passes available → Prompt for confirmation
4. Use oldest day pass package first (FIFO)
5. Deduct 1 punch, record check-in

### Punch Card Table
```sql
punch_cards (
  id: serial PRIMARY KEY,
  user_id: integer,
  template_id: integer (references punch_card_templates),
  remaining_punches: integer,
  total_punches: integer,
  purchase_date: date,
  expiration_date: date,
  status: enum('active', 'expired', 'exhausted')
)
```

---

## Admin Check-In Monitoring

### Today's Check-Ins
**Endpoint**: `GET /api/admin/check-ins/today`
**Returns**: All check-ins from today with member details

### All Check-Ins (Paginated)
**Endpoint**: `GET /api/admin/check-ins?page=1&limit=20`
**Returns**: Paginated list of all check-ins

### Member Check-In History
**Endpoint**: `GET /api/admin/members/:id/check-ins`
**Returns**: All check-ins for a specific member

---

## Edge Cases & Error Handling

### Invalid QR Code
- **Expired Date**: "This QR code has expired. Please generate today's code."
- **Invalid Format**: "Unable to read QR code. Please see staff."
- **Missing Data**: "QR code missing required information."

### Membership Issues
- **Not Found**: "Membership ID not found. Please see staff."
- **Expired + No Day Passes**: "Membership expired. No day passes available."
- **Frozen**: "Membership is currently frozen. Contact staff to reactivate."

### Payment Issues (Kiosk Registration)
- **Payment Failed**: Stripe error message displayed
- **Network Error**: "Unable to process payment. Please try again."
- **Duplicate Email**: "Account already exists with this email."

### System Errors
- All errors logged to console
- User-friendly messages displayed
- Kiosk auto-resets after 3 seconds on error
- Staff can manually override and check in member

---

## Security & Privacy

### Kiosk Security
- No login required (public endpoint)
- QR codes expire daily
- Membership ID validation prevents unauthorized access
- No sensitive data displayed on success screen

### Staff Portal Security
- Requires authentication (staff/admin role)
- Session-based authentication
- Activity logged in database

### Payment Security
- All payments processed through Stripe
- No card data stored in database
- PCI-DSS compliant payment handling
- Stripe webhook verification for payment confirmation

---

## Future Enhancements (Potential)

1. **Biometric Check-In**: Fingerprint or facial recognition
2. **Mobile App Check-In**: Member checks in from their phone before arriving
3. **Capacity Monitoring**: Alert when facility reaches capacity
4. **Visit History**: Members can view their check-in history in app
5. **Waitlist System**: Queue management for busy times
6. **Loyalty Rewards**: Track visits and offer rewards
7. **Guest Passes**: Members can bring guests with special passes

---

## Technical Stack

- **Frontend**: React + TypeScript, Wouter routing
- **Backend**: Node.js + Express, TypeScript
- **Database**: PostgreSQL (Neon serverless)
- **Payments**: Stripe
- **QR Scanning**: html5-qrcode library
- **Authentication**: Passport.js (session-based)
- **Wallet Integration**: Apple Wallet (passkit-generator)

---

*Last Updated: November 10, 2025*

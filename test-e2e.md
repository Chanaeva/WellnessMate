# End-to-End Testing Plan for Wolf Mother Wellness Membership Business Rules

## Test Scenarios

### 1. Age Verification Testing (18+ Requirement)

#### Test Case 1.1: Valid Age Registration
- **Setup**: Navigate to registration page
- **Actions**: 
  1. Fill out registration form with user who is 18+ years old
  2. Select date of birth showing age 25 (born 2000-01-01)
  3. Check age confirmation checkbox
  4. Submit registration
- **Expected**: Registration succeeds, user can proceed to membership agreement

#### Test Case 1.2: Invalid Age Registration
- **Setup**: Navigate to registration page
- **Actions**:
  1. Fill out registration form with user under 18
  2. Select date of birth showing age 16 (born 2009-01-01)
  3. Try to check age confirmation checkbox
  4. Submit registration
- **Expected**: Registration fails with age validation error

#### Test Case 1.3: Missing Age Confirmation
- **Setup**: Navigate to registration page
- **Actions**:
  1. Fill out registration form with valid age (25 years old)
  2. Select valid date of birth
  3. Do NOT check age confirmation checkbox
  4. Submit registration
- **Expected**: Form validation prevents submission, shows error message

### 2. One Membership Per Member Testing

#### Test Case 2.1: First Membership Purchase
- **Setup**: Registered member with no active membership
- **Actions**:
  1. Login to member dashboard
  2. Navigate to packages page
  3. Add Basic Membership to cart
  4. Proceed to checkout
  5. Complete purchase
- **Expected**: Membership purchased successfully, appears in dashboard

#### Test Case 2.2: Attempt Second Membership Purchase
- **Setup**: Member with active Basic Membership
- **Actions**:
  1. Navigate to packages page
  2. Try to add Premium Membership to cart
  3. Observe error message
- **Expected**: Error dialog appears: "You already have an active membership. Please cancel your current membership before purchasing a new one."

#### Test Case 2.3: Membership Upgrade Flow
- **Setup**: Member with active Basic Membership
- **Actions**:
  1. Navigate to packages page
  2. Click "Upgrade" button on Premium Membership
  3. Complete checkout process
- **Expected**: Basic membership is replaced with Premium membership, no duplicate memberships

### 3. Membership Cancellation Testing

#### Test Case 3.1: Cancel Active Membership
- **Setup**: Member with active membership
- **Actions**:
  1. Login to member dashboard
  2. Locate membership management section
  3. Click "Cancel Membership" button
  4. Confirm cancellation in dialog
- **Expected**: 
  - Membership status changes to "cancelled"
  - End date set to current date
  - No prorated refund processed
  - Member can purchase new membership

#### Test Case 3.2: Attempt to Cancel Non-existent Membership
- **Setup**: Member with no active membership
- **Actions**:
  1. Make direct API call to `/api/membership/cancel`
- **Expected**: API returns 400 error: "No active membership found to cancel"

#### Test Case 3.3: Post-Cancellation Purchase
- **Setup**: Member who just cancelled membership
- **Actions**:
  1. Navigate to packages page
  2. Add new membership to cart
  3. Complete purchase
- **Expected**: New membership purchase succeeds

### 4. Cart Validation Testing

#### Test Case 4.1: Multiple Punch Cards in Cart
- **Setup**: Member with no active membership
- **Actions**:
  1. Add Day Pass Package (5 visits) to cart
  2. Add Day Pass Package (10 visits) to cart
  3. Proceed to checkout
- **Expected**: Both punch cards can be purchased together

#### Test Case 4.2: Membership + Punch Cards in Cart
- **Setup**: Member with no active membership
- **Actions**:
  1. Add Basic Membership to cart
  2. Add Day Pass Package to cart
  3. Proceed to checkout
- **Expected**: Both items can be purchased together

#### Test Case 4.3: Multiple Memberships in Cart Prevention
- **Setup**: Member with no active membership
- **Actions**:
  1. Add Basic Membership to cart
  2. Try to add Premium Membership to cart
- **Expected**: Error message prevents adding second membership

### 5. Admin Business Rules Testing

#### Test Case 5.1: Admin Member Management
- **Setup**: Admin user logged in
- **Actions**:
  1. Navigate to admin member management
  2. View member with active membership
  3. Change member status to inactive
  4. Verify membership is also affected
- **Expected**: Member deactivation follows business rules

#### Test Case 5.2: Admin Membership Plan Management
- **Setup**: Admin user logged in
- **Actions**:
  1. Create new membership plan
  2. Set plan to inactive
  3. Verify inactive plans don't appear in member packages page
- **Expected**: Only active plans visible to members

## Automated Test Implementation

### Test Data Setup
```javascript
// Test users for different scenarios
const testUsers = {
  validAdult: {
    firstName: "Romulus",
    lastName: "Lupus", 
    username: "romulus_test",
    email: "romulus@test.com",
    dateOfBirth: "2000-01-01", // 25 years old
    ageConfirmation: true
  },
  underageUser: {
    firstName: "Young",
    lastName: "Wolf",
    username: "young_test", 
    email: "young@test.com",
    dateOfBirth: "2009-01-01", // 16 years old
    ageConfirmation: false
  }
};
```

### Test Execution Order
1. **Setup Phase**: Clean database, create test admin user
2. **Registration Tests**: Test age verification and form validation
3. **Membership Purchase Tests**: Test one membership limitation
4. **Cancellation Tests**: Test membership cancellation flow
5. **Cart Validation Tests**: Test cart business rules
6. **Cleanup Phase**: Remove test data

## Success Criteria
- All age verification rules enforced
- One membership per member strictly enforced
- Membership cancellation works with immediate effect
- No prorated refunds processed
- Cart prevents multiple membership additions
- Admin controls maintain business rule integrity

## Test Environment Requirements
- Clean database state for each test run
- Test Stripe keys for payment processing
- Test admin account for administrative functions
- Mock date/time functions for age calculations
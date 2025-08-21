#!/usr/bin/env node

// Wolf Mother Wellness - Test User Account Information
// Use these accounts for manual testing and validation

/**
 * ADMIN ACCOUNT
 * Full administrative access to dashboard and management features
 */
export const ADMIN_ACCOUNT = {
  email: 'admin@wolfmothertulsa.com',
  password: 'WolfAdmin123!',
  role: 'admin',
  description: 'Full admin dashboard access for managing members, plans, and analytics'
};

/**
 * MEMBER TEST ACCOUNTS
 * Pre-created member accounts for testing member features
 */
export const MEMBER_ACCOUNTS = [
  {
    email: 'diana@wolfmother.com',
    username: 'diana_demo',
    password: 'DianaPass123!', // Estimated password pattern
    role: 'member',
    firstName: 'Diana',
    lastName: 'Lupus',
    description: 'Demo member account for testing member dashboard and features'
  },
  {
    email: 'romulus@test.com',
    username: 'romulus_test',
    password: 'TestPass123!', // Estimated password pattern  
    role: 'member',
    firstName: 'Romulus',
    lastName: 'Lupus',
    description: 'Roman mythology themed test account'
  },
  {
    email: 'valid_adult_1755790325077@test.com',
    password: 'TestPass123!',
    role: 'member',
    firstName: 'Valid',
    lastName: 'Adult',
    description: 'Age-verified adult member account from testing'
  }
];

/**
 * AGE VERIFICATION TEST ACCOUNTS  
 * These accounts test the 18+ age verification system
 */
export const AGE_TEST_ACCOUNTS = [
  {
    email: 'underage@test.com',
    username: 'underage_test',
    role: 'member',
    firstName: 'Under',
    lastName: 'Age',
    description: 'Tests age verification - should be restricted'
  },
  {
    email: 'test_under_18@test.com',
    username: 'test_under_18',
    role: 'member',
    firstName: 'Test',
    lastName: 'Underage',
    description: 'Additional underage test account for boundary testing'
  },
  {
    email: 'young@test.com',
    username: 'young_test',
    role: 'member',
    firstName: 'Young',
    lastName: 'Wolf',
    description: 'Youth account for age verification edge case testing'
  }
];

/**
 * DYNAMICALLY CREATED TEST ACCOUNTS
 * These are generated during E2E test runs with timestamps
 */
export const DYNAMIC_TEST_PATTERNS = {
  membershipRules: 'valid_adult_{timestamp}@test.com',
  dayPassPurchase: 'purchaser_{timestamp}@test.com',
  kioskRegistration: 'kiosk_member_{timestamp}@test.com',
  adminTesting: 'admin_test_{timestamp}@test.com',
  description: 'E2E tests create accounts with these patterns using current timestamp'
};

/**
 * TEST MEMBERSHIP PLANS
 * Available membership plans for testing
 */
export const TEST_MEMBERSHIP_PLANS = [
  {
    id: 516,
    name: 'Basic Membership',
    planType: 'basic',
    monthlyPrice: 9900, // $99.00 in cents
    description: 'Foundling\'s Path - Begin your wellness journey'
  }
];

/**
 * TEST DAY PASS OPTIONS
 * Available day passes/punch cards for testing
 */
export const TEST_DAY_PASS_OPTIONS = [
  {
    name: 'Drop-In',
    totalPunches: 1,
    totalPrice: 3500, // $35.00 in cents
    pricePerPunch: 3500,
    description: 'Single day access pass'
  },
  {
    name: '5-Day Pass',
    totalPunches: 5,
    totalPrice: 15000, // $150.00 in cents  
    pricePerPunch: 3000,
    description: 'Five day access package'
  }
];

/**
 * KIOSK TESTING INFORMATION
 * Self-service kiosk registration details
 */
export const KIOSK_INFO = {
  url: '/kiosk',
  features: [
    'Self-service member registration',
    'Package selection (memberships & day passes)',
    'Stripe payment processing',
    'QR code check-in system',
    'Age verification (18+)',
    'Email validation'
  ],
  testFlow: [
    '1. Navigate to /kiosk',
    '2. Select "Create New Member"',
    '3. Fill out registration form',
    '4. Select membership or day pass package',
    '5. Complete Stripe payment',
    '6. Receive member credentials'
  ]
};

/**
 * API ENDPOINTS FOR TESTING
 * Key endpoints used in E2E tests
 */
export const API_ENDPOINTS = {
  // Authentication
  login: 'POST /api/login',
  register: 'POST /api/register',
  
  // Member Management
  membershipPlans: 'GET /api/membership-plans',
  punchCardOptions: 'GET /api/punch-cards/options',
  membership: 'GET /api/membership',
  punchCards: 'GET /api/punch-cards',
  
  // Admin Features
  adminMembers: 'GET /api/admin/members',
  adminPunchCardTemplates: 'GET /api/admin/punch-card-templates',
  createPunchCardTemplate: 'POST /api/admin/punch-card-templates',
  
  // Kiosk System
  kioskCreatePayment: 'POST /api/kiosk/create-member-payment',
  kioskConfirmMember: 'POST /api/kiosk/confirm-member-creation',
  kioskCheckIn: 'POST /api/kiosk-check-in',
  
  // Purchase Flow
  checkout: 'POST /api/checkout',
  createCheckoutSession: 'POST /api/create-checkout-session'
};

/**
 * TESTING SCENARIOS
 * Common test scenarios and their purposes
 */
export const TEST_SCENARIOS = {
  membershipRules: {
    file: 'test-membership-rules.js',
    purpose: 'Validates age verification, one membership per user, and business rules',
    keyTests: [
      'Age verification (18+)',
      'Single membership enforcement',
      'Admin user management',
      'Member registration flow',
      'Membership cancellation'
    ]
  },
  
  dayPassFlow: {
    file: 'test-day-pass-e2e.js',
    purpose: 'Tests complete day pass creation and purchase workflow',
    keyTests: [
      'Admin creates day pass template',
      'Day pass appears in public options',
      'Member purchases day pass',
      'Punch card created in account',
      'Usage tracking works',
      'Payment recorded correctly'
    ]
  },
  
  kioskRegistration: {
    file: 'test-kiosk-member-creation.js',
    purpose: 'Validates self-service kiosk member registration system',
    keyTests: [
      'Package selection available',
      'Payment intent creation',
      'Member account confirmation', 
      'Age verification enforcement',
      'Email validation',
      'Security measures'
    ]
  }
};

/**
 * How to Use This Information
 * 
 * 1. MANUAL TESTING
 *    - Use ADMIN_ACCOUNT to access dashboard at /admin-login
 *    - Use MEMBER_ACCOUNTS to test member features
 *    - Test kiosk at /kiosk with new registrations
 * 
 * 2. AUTOMATED TESTING  
 *    - Run: node tests/test-membership-rules.js
 *    - Run: node tests/test-day-pass-e2e.js
 *    - Run: node tests/test-kiosk-member-creation.js
 * 
 * 3. API TESTING
 *    - Use API_ENDPOINTS for direct API testing
 *    - Test with curl or Postman using provided endpoints
 * 
 * 4. DEVELOPMENT
 *    - Reference TEST_SCENARIOS for understanding test coverage
 *    - Use DYNAMIC_TEST_PATTERNS for new test account creation
 */

// Helper function to generate test account email
export const generateTestEmail = (prefix = 'test') => {
  const timestamp = Date.now();
  return `${prefix}_${timestamp}@test.com`;
};

// Helper function to display account info  
export const displayAccountInfo = () => {
  console.log('\n🐺 Wolf Mother Wellness - Test Accounts\n');
  
  console.log('🔐 ADMIN LOGIN:');
  console.log(`   Email: ${ADMIN_ACCOUNT.email}`);
  console.log(`   Password: ${ADMIN_ACCOUNT.password}`);
  console.log(`   Access: Full admin dashboard\n`);
  
  console.log('👤 MEMBER ACCOUNTS:');
  MEMBER_ACCOUNTS.forEach(account => {
    console.log(`   Email: ${account.email}`);
    console.log(`   Name: ${account.firstName} ${account.lastName}`);
    console.log(`   Purpose: ${account.description}\n`);
  });
  
  console.log('🏪 KIOSK TESTING:');
  console.log(`   URL: ${KIOSK_INFO.url}`);
  console.log(`   Features: ${KIOSK_INFO.features.join(', ')}\n`);
  
  console.log('🧪 RUN TESTS:');
  Object.values(TEST_SCENARIOS).forEach(scenario => {
    console.log(`   ${scenario.file} - ${scenario.purpose}`);
  });
  console.log('');
};

// Run display function if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  displayAccountInfo();
}

export default {
  ADMIN_ACCOUNT,
  MEMBER_ACCOUNTS,
  AGE_TEST_ACCOUNTS,
  DYNAMIC_TEST_PATTERNS,
  TEST_MEMBERSHIP_PLANS,
  TEST_DAY_PASS_OPTIONS,
  KIOSK_INFO,
  API_ENDPOINTS,
  TEST_SCENARIOS,
  generateTestEmail,
  displayAccountInfo
};
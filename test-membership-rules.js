#!/usr/bin/env node

// E2E Test Script for Wolf Mother Wellness Membership Business Rules
// Tests: Age verification, one membership per member, cancellation

import http from 'http';

const BASE_URL = 'http://localhost:5000';

class TestRunner {
  constructor() {
    this.testResults = [];
    this.cookies = '';
    this.adminCookies = '';
    this.testUserId = null;
    this.adminUserId = null;
  }

  async makeRequest(method, path, data = null, useCookies = true) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(useCookies && this.cookies && { 'Cookie': this.cookies })
        }
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        
        // Capture cookies from response
        if (res.headers['set-cookie'] && useCookies) {
          this.cookies = res.headers['set-cookie'].join('; ');
        }

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = responseData ? JSON.parse(responseData) : {};
            resolve({
              statusCode: res.statusCode,
              data: parsedData,
              headers: res.headers
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              data: responseData,
              headers: res.headers
            });
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  logTest(testName, passed, details = '') {
    const result = { testName, passed, details, timestamp: new Date().toISOString() };
    this.testResults.push(result);
    console.log(`${passed ? '✅' : '❌'} ${testName}${details ? ` - ${details}` : ''}`);
    return passed;
  }

  async loginUser(email, password, isAdmin = false) {
    const loginData = { email, password };
    const response = await this.makeRequest('POST', '/api/login', loginData, false);
    
    if (response.statusCode === 200 && response.headers['set-cookie']) {
      if (isAdmin) {
        this.adminCookies = response.headers['set-cookie'].join('; ');
      } else {
        this.cookies = response.headers['set-cookie'].join('; ');
      }
    }
    
    return response;
  }

  async createAdminUser() {
    console.log('\n--- Creating Admin Test User ---');
    
    const adminUser = {
      firstName: "Admin",
      lastName: "User",
      username: "admin_test_" + Date.now(),
      email: `admin_test_${Date.now()}@test.com`,
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      phoneNumber: "+1234567999",
      dateOfBirth: "1990-01-01",
      ageConfirmation: true,
      role: "admin"
    };

    const response = await this.makeRequest('POST', '/api/register', adminUser, false);
    
    if (response.statusCode === 201) {
      this.adminUserId = response.data.user?.id;
      // Login as admin to get session
      await this.loginUser(adminUser.email, adminUser.password, true);
      return this.logTest(
        'Admin User Creation',
        true,
        `Admin User ID: ${this.adminUserId}`
      );
    }
    
    return this.logTest(
      'Admin User Creation',
      false,
      `Status: ${response.statusCode}, Message: ${response.data.message}`
    );
  }

  async testAgeVerificationRejectsUnderage() {
    console.log('\n--- Testing Age Verification (Underage Rejection) ---');
    
    const underageUser = {
      firstName: "Under",
      lastName: "Age",
      username: "underage_" + Date.now(),
      email: `underage_${Date.now()}@test.com`,
      password: "TestPass123!",
      confirmPassword: "TestPass123!",
      phoneNumber: "+1234567890",
      dateOfBirth: "2010-01-01", // 15 years old
      ageConfirmation: false,
      role: "member"
    };

    const response = await this.makeRequest('POST', '/api/register', underageUser, false);
    
    return this.logTest(
      'Age Verification - Reject Underage User',
      response.statusCode === 400 && response.data.message?.includes('18 years or older'),
      `Status: ${response.statusCode}, Message: ${response.data.message}`
    );
  }

  async testAgeVerificationAcceptsValidAge() {
    console.log('\n--- Testing Age Verification (Valid Age Acceptance) ---');
    
    const validUser = {
      firstName: "Valid",
      lastName: "Adult",
      username: "valid_adult_" + Date.now(),
      email: `valid_adult_${Date.now()}@test.com`,
      password: "TestPass123!",
      confirmPassword: "TestPass123!",
      phoneNumber: "+1234567891",
      dateOfBirth: "1995-01-01", // 30 years old
      ageConfirmation: true,
      role: "member"
    };

    const response = await this.makeRequest('POST', '/api/register', validUser, false);
    
    if (response.statusCode === 201) {
      this.testUserId = response.data.user?.id;
      // Login the user to get session cookies
      await this.loginUser(validUser.email, validUser.password);
    }
    
    return this.logTest(
      'Age Verification - Accept Valid Adult',
      response.statusCode === 201 && response.data.message === "Registration successful",
      `Status: ${response.statusCode}, User ID: ${response.data.user?.id}`
    );
  }

  async testMembershipAgreementRequired() {
    console.log('\n--- Testing Membership Agreement Requirement ---');
    
    // Try to access dashboard without completing agreement
    const dashboardResponse = await this.makeRequest('GET', '/api/user');
    
    return this.logTest(
      'Membership Agreement Required',
      dashboardResponse.data.membershipAgreementCompleted === false,
      `Agreement Status: ${dashboardResponse.data.membershipAgreementCompleted}`
    );
  }

  async testFirstMembershipPurchase() {
    console.log('\n--- Testing First Membership Purchase ---');
    
    // Get available membership plans
    const plansResponse = await this.makeRequest('GET', '/api/membership-plans');
    
    if (plansResponse.statusCode !== 200 || !plansResponse.data.length) {
      return this.logTest(
        'First Membership Purchase - Get Plans',
        false,
        'No membership plans available'
      );
    }

    const plan = plansResponse.data[0];
    
    // Try to purchase membership (will fail without payment method, but tests business logic)
    const checkoutData = {
      items: [{
        id: `membership_${plan.id}`,
        name: plan.name,
        price: plan.monthlyPrice / 100,
        type: "membership",
        data: {
          monthlyPrice: plan.monthlyPrice,
          name: plan.name,
          planId: plan.id
        }
      }],
      totalAmount: plan.monthlyPrice / 100
    };

    const checkoutResponse = await this.makeRequest('POST', '/api/checkout', checkoutData);
    
    return this.logTest(
      'First Membership Purchase - Business Logic',
      checkoutResponse.statusCode === 400 && checkoutResponse.data.error?.includes('payment method'),
      `Status: ${checkoutResponse.statusCode}, Error: ${checkoutResponse.data.error}`
    );
  }

  async testMultipleMembershipPrevention() {
    console.log('\n--- Testing Multiple Membership Prevention ---');
    
    if (!this.testUserId || !this.adminUserId) {
      return this.logTest(
        'Multiple Membership Prevention - Setup',
        false,
        'Missing test or admin user IDs'
      );
    }

    // Use admin cookies to create a membership directly
    const originalCookies = this.cookies;
    this.cookies = this.adminCookies;
    
    const createMembershipResponse = await this.makeRequest('POST', '/api/admin/memberships', {
      userId: this.testUserId,
      membershipId: `test_membership_${Date.now()}`,
      planType: "basic",
      status: "active",
      startDate: new Date().toISOString().split('T')[0], // Date format YYYY-MM-DD
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      autoRenew: true
    });

    // Switch back to regular user cookies
    this.cookies = originalCookies;

    if (createMembershipResponse.statusCode !== 201) {
      return this.logTest(
        'Multiple Membership Prevention - Setup',
        false,
        `Cannot create test membership - Status: ${createMembershipResponse.statusCode}`
      );
    }

    // Now try to add another membership to cart as regular user
    const cartData = {
      items: [{
        id: "membership_516",
        name: "Another Membership",
        price: 65.00,
        type: "membership",
        data: {
          monthlyPrice: 6500, // Price in cents
          name: "Another Membership",
          planId: 516
        }
      }],
      totalAmount: 65.00
    };

    const cartResponse = await this.makeRequest('POST', '/api/checkout', cartData);
    
    return this.logTest(
      'Multiple Membership Prevention',
      cartResponse.statusCode === 400 && cartResponse.data.error?.includes('active membership'),
      `Status: ${cartResponse.statusCode}, Error: ${cartResponse.data.error}`
    );
  }

  async testMembershipCancellation() {
    console.log('\n--- Testing Membership Cancellation ---');
    
    // Try to cancel membership
    const cancelResponse = await this.makeRequest('DELETE', '/api/membership/cancel');
    
    const passed = cancelResponse.statusCode === 200 || 
                   (cancelResponse.statusCode === 400 && cancelResponse.data.error?.includes('No active membership'));
    
    return this.logTest(
      'Membership Cancellation',
      passed,
      `Status: ${cancelResponse.statusCode}, Message: ${cancelResponse.data.message || cancelResponse.data.error}`
    );
  }

  async runAllTests() {
    console.log('🐺 Starting Wolf Mother Wellness E2E Tests 🐺\n');
    
    const tests = [
      () => this.testAgeVerificationRejectsUnderage(),
      () => this.testAgeVerificationAcceptsValidAge(),
      () => this.createAdminUser(),
      () => this.testMembershipAgreementRequired(),
      () => this.testFirstMembershipPurchase(),
      () => this.testMultipleMembershipPrevention(),
      () => this.testMembershipCancellation()
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        const result = await test();
        if (result) passed++;
        else failed++;
      } catch (error) {
        console.log(`❌ Test failed with error: ${error.message}`);
        failed++;
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));

    // Print detailed results
    console.log('\nDetailed Results:');
    this.testResults.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.testName}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });

    return { passed, failed, results: this.testResults };
  }
}

// Run tests if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner();
  runner.runAllTests().catch(console.error);
}

export default TestRunner;
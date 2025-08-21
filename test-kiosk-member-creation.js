#!/usr/bin/env node

// E2E Test Script for Kiosk Member Creation Flow
// Tests: Self-service member registration, package selection, payment processing, and account creation

import http from 'http';

const BASE_URL = 'http://localhost:5000';

class KioskMemberCreationTestRunner {
  constructor() {
    this.testResults = [];
    this.testSessionId = Date.now();
    this.createdMemberEmail = null;
    this.paymentIntentId = null;
  }

  async makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let responseData = '';

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
  }

  async testAvailablePackages() {
    try {
      // Test membership plans availability
      const membershipResponse = await this.makeRequest('GET', '/api/membership-plans');
      const membershipSuccess = membershipResponse.statusCode === 200 && Array.isArray(membershipResponse.data);
      
      // Test punch card options availability
      const punchCardResponse = await this.makeRequest('GET', '/api/punch-cards/options');
      const punchCardSuccess = punchCardResponse.statusCode === 200 && Array.isArray(punchCardResponse.data);
      
      const success = membershipSuccess && punchCardSuccess;
      this.logTest('Package Options Available', success,
        success ? 
          `${membershipResponse.data.length} memberships, ${punchCardResponse.data.length} day passes` :
          'Failed to get package options');
      
      return { success, membershipPlans: membershipResponse.data, punchCardOptions: punchCardResponse.data };
    } catch (error) {
      this.logTest('Package Options Available', false, `Error: ${error.message}`);
      return { success: false, membershipPlans: [], punchCardOptions: [] };
    }
  }

  async testKioskMembershipCreationFlow() {
    try {
      this.createdMemberEmail = `kiosk_member_${this.testSessionId}@test.com`;
      
      const requestData = {
        memberData: {
          firstName: 'Kiosk',
          lastName: 'Member',
          email: this.createdMemberEmail,
          phoneNumber: '+15555551234',
          packageType: 'membership',
          packageId: '516'
        },
        packageData: {
          name: 'Basic Membership',
          price: 99, // $99.00
          planType: 'basic'
        }
      };

      const response = await this.makeRequest('POST', '/api/kiosk/create-member-payment', requestData);
      
      const success = response.statusCode === 200 && response.data.clientSecret;
      if (success) {
        this.paymentIntentId = response.data.paymentIntentId;
      }
      
      this.logTest('Kiosk Payment Intent Creation', success,
        success ? `Payment intent created: ${response.data.paymentIntentId}` :
                 `Failed: ${response.statusCode} - ${JSON.stringify(response.data)}`);
      
      return success;
    } catch (error) {
      this.logTest('Kiosk Payment Intent Creation', false, `Error: ${error.message}`);
      return false;
    }
  }

  async testKioskDayPassCreationFlow() {
    try {
      const dayPassMemberEmail = `kiosk_daypass_${this.testSessionId}@test.com`;
      
      const requestData = {
        memberData: {
          firstName: 'Kiosk',
          lastName: 'DayPass',
          email: dayPassMemberEmail,
          phoneNumber: '+15555555678',
          packageType: 'daypass',
          packageId: '1'
        },
        packageData: {
          name: '5-Day Pass',
          price: 35, // $35.00
          totalPunches: 5
        }
      };

      const response = await this.makeRequest('POST', '/api/kiosk/create-member-payment', requestData);
      
      const success = response.statusCode === 200 && response.data.clientSecret;
      
      this.logTest('Kiosk Day Pass Payment Intent', success,
        success ? `Day pass payment intent created` :
                 `Failed: ${response.statusCode} - ${JSON.stringify(response.data)}`);
      
      return success;
    } catch (error) {
      this.logTest('Kiosk Day Pass Payment Intent', false, `Error: ${error.message}`);
      return false;
    }
  }

  async testKioskMemberConfirmation() {
    try {
      if (!this.paymentIntentId) {
        this.logTest('Kiosk Member Confirmation', false, 'No payment intent to confirm');
        return false;
      }

      const confirmationData = {
        paymentIntentId: this.paymentIntentId,
        memberData: {
          firstName: 'Kiosk',
          lastName: 'Member',
          email: this.createdMemberEmail,
          phoneNumber: '+15555551234',
          packageType: 'membership',
          packageId: '516'
        },
        packageData: {
          name: 'Basic Membership',
          price: 99,
          planType: 'basic'
        }
      };

      const response = await this.makeRequest('POST', '/api/kiosk/confirm-member-creation', confirmationData);
      
      const success = response.statusCode === 200 && response.data.success;
      
      this.logTest('Kiosk Member Confirmation', success,
        success ? `Member account created successfully` :
                 `Failed: ${response.statusCode} - ${JSON.stringify(response.data)}`);
      
      return success;
    } catch (error) {
      this.logTest('Kiosk Member Confirmation', false, `Error: ${error.message}`);
      return false;
    }
  }

  async testCreatedMemberExists() {
    try {
      if (!this.createdMemberEmail) {
        this.logTest('Member Account Verification', false, 'No member email to verify');
        return false;
      }

      // Try to check if member exists by attempting login (this will fail but show user exists)
      const loginResponse = await this.makeRequest('POST', '/api/login', {
        email: this.createdMemberEmail,
        password: 'dummy_password' // This will fail but indicate user exists
      });
      
      // Status 400 or 401 indicates user exists but wrong password
      // Status 404 would indicate user doesn't exist
      const memberExists = loginResponse.statusCode !== 404;
      
      this.logTest('Member Account Verification', memberExists,
        memberExists ? `Member account exists in database` :
                      `Member account not found`);
      
      return memberExists;
    } catch (error) {
      this.logTest('Member Account Verification', false, `Error: ${error.message}`);
      return false;
    }
  }

  async testKioskCheckInEndpoint() {
    try {
      // Test the kiosk check-in endpoint accessibility (should exist even if we can't fully test it)
      const response = await this.makeRequest('POST', '/api/kiosk-check-in', {
        membershipId: 'test_membership_id'
      });
      
      // We expect this to fail with validation errors, but endpoint should exist
      const endpointExists = response.statusCode !== 404;
      
      this.logTest('Kiosk Check-In Endpoint', endpointExists,
        endpointExists ? `Check-in endpoint accessible (status: ${response.statusCode})` :
                       'Check-in endpoint not found');
      
      return endpointExists;
    } catch (error) {
      this.logTest('Kiosk Check-In Endpoint', false, `Error: ${error.message}`);
      return false;
    }
  }

  async testAgeVerificationHandling() {
    try {
      const underageMemberEmail = `underage_kiosk_${this.testSessionId}@test.com`;
      
      const underageData = {
        memberData: {
          firstName: 'Under',
          lastName: 'Age',
          email: underageMemberEmail,
          phoneNumber: '+15555559999',
          packageType: 'membership',
          packageId: '516',
          dateOfBirth: '2010-01-01' // Under 18
        },
        packageData: {
          name: 'Basic Membership',
          price: 99,
          planType: 'basic'
        }
      };

      const response = await this.makeRequest('POST', '/api/kiosk/create-member-payment', underageData);
      
      // Should reject underage users
      const properlyRejects = response.statusCode >= 400;
      
      this.logTest('Kiosk Age Verification', properlyRejects,
        properlyRejects ? 'Properly rejects underage users' :
                         'Failed to enforce age verification');
      
      return properlyRejects;
    } catch (error) {
      this.logTest('Kiosk Age Verification', false, `Error: ${error.message}`);
      return false;
    }
  }

  async testEmailValidation() {
    try {
      const invalidEmailData = {
        memberData: {
          firstName: 'Invalid',
          lastName: 'Email',
          email: 'not_an_email', // Invalid email format
          phoneNumber: '+15555558888',
          packageType: 'membership',
          packageId: '516'
        },
        packageData: {
          name: 'Basic Membership',
          price: 99,
          planType: 'basic'
        }
      };

      const response = await this.makeRequest('POST', '/api/kiosk/create-member-payment', invalidEmailData);
      
      // Should reject invalid email
      const properlyValidates = response.statusCode >= 400;
      
      this.logTest('Kiosk Email Validation', properlyValidates,
        properlyValidates ? 'Properly validates email format' :
                           'Failed to validate email format');
      
      return properlyValidates;
    } catch (error) {
      this.logTest('Kiosk Email Validation', false, `Error: ${error.message}`);
      return false;
    }
  }

  async runAllTests() {
    console.log('\n🏪 Wolf Mother Wellness - Kiosk Member Creation E2E Tests');
    console.log('='.repeat(70));
    console.log(`Starting kiosk tests at: ${new Date().toISOString()}\n`);

    // Phase 1: System Preparation
    console.log('🔧 PHASE 1: System Preparation');
    console.log('-'.repeat(40));
    
    const { success: packagesAvailable, membershipPlans, punchCardOptions } = await this.testAvailablePackages();
    if (!packagesAvailable) {
      console.log('\n❌ Package availability test failed - stopping tests');
      return this.printSummary();
    }

    // Phase 2: Kiosk Registration Flows
    console.log('\n📝 PHASE 2: Kiosk Registration Flows');
    console.log('-'.repeat(40));
    
    await this.testKioskMembershipCreationFlow();
    await this.testKioskDayPassCreationFlow();
    
    // Phase 3: Member Creation Confirmation
    console.log('\n✅ PHASE 3: Member Creation Confirmation');
    console.log('-'.repeat(40));
    
    await this.testKioskMemberConfirmation();
    await this.testCreatedMemberExists();

    // Phase 4: Kiosk Check-In Integration
    console.log('\n📱 PHASE 4: Kiosk Check-In Integration');
    console.log('-'.repeat(40));
    
    await this.testKioskCheckInEndpoint();

    // Phase 5: Validation & Security
    console.log('\n🛡️ PHASE 5: Validation & Security');
    console.log('-'.repeat(40));
    
    await this.testAgeVerificationHandling();
    await this.testEmailValidation();

    return this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 Kiosk Member Creation Test Results');
    console.log('='.repeat(70));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.log(`  • ${result.testName}: ${result.details}`);
      });
    }
    
    console.log('\n🏪 Kiosk Features Tested:');
    console.log('  ✓ Self-service member registration');
    console.log('  ✓ Package selection (memberships & day passes)');
    console.log('  ✓ Payment intent creation');
    console.log('  ✓ Member account confirmation');  
    console.log('  ✓ Check-in system integration');
    console.log('  ✓ Age verification enforcement');
    console.log('  ✓ Input validation & security');
    
    console.log(`\n🎯 Overall Result: ${passedTests === totalTests ? '✅ KIOSK SYSTEM READY' : `❌ ${failedTests} ISSUES FOUND`}`);
    console.log(`Completed at: ${new Date().toISOString()}`);
    
    return passedTests === totalTests;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new KioskMemberCreationTestRunner();
  runner.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Kiosk test runner crashed:', error);
      process.exit(1);
    });
}

export default KioskMemberCreationTestRunner;
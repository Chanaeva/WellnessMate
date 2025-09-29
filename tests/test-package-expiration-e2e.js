#!/usr/bin/env node

// End-to-End Test for Admin Creating Membership Packages with Expiration Dates
// Tests: Admin creates package with expiration → Admin creates package without expiration → Verify both packages exist

import http from 'http';

const BASE_URL = 'http://localhost:5000';

class PackageExpirationTestRunner {
  constructor() {
    this.testResults = [];
    this.adminCookies = '';
    this.expiringPlanId = null;
    this.nonExpiringPlanId = null;
  }

  async makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.adminCookies && { 'Cookie': this.adminCookies })
        }
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        
        // Capture cookies from response
        if (res.headers['set-cookie']) {
          this.adminCookies = res.headers['set-cookie'].join('; ');
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
  }

  async adminLogin() {
    try {
      const response = await this.makeRequest('POST', '/api/login', {
        email: 'admin@wolfmothertulsa.com',
        password: 'WolfAdmin123!'
      });

      const success = response.statusCode === 200 && response.data.role === 'admin';
      this.logTest('Admin Login', success);
      return success;
    } catch (error) {
      this.logTest('Admin Login', false, `Error: ${error.message}`);
      return false;
    }
  }

  async createPackageWithExpiration() {
    try {
      const timestamp = Date.now();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days from now
      
      const packageData = {
        planType: 'premium',
        name: `Limited Time Premium ${timestamp}`,
        monthlyPrice: 12900, // $129.00 in cents
        description: 'Limited time premium package with expiration date',
        features: ['Unlimited sauna access', 'Cold plunge therapy', 'Limited time offer'],
        isActive: true,
        expiresAt: futureDate.toISOString()
      };

      const response = await this.makeRequest('POST', '/api/admin/membership-plans', packageData);
      
      const success = response.statusCode === 201 && response.data.id;
      if (success) {
        this.expiringPlanId = response.data.id;
        
        // Verify the expiration date was saved
        const hasExpiration = !!response.data.expiresAt;
        this.logTest('Create Package with Expiration', hasExpiration,
          hasExpiration ? `Plan ID: ${response.data.id}, Expires: ${new Date(response.data.expiresAt).toLocaleDateString()}` : 
                         `Plan created but expiration date not saved`);
        return hasExpiration;
      } else {
        this.logTest('Create Package with Expiration', false,
          `Failed: ${response.statusCode} - ${JSON.stringify(response.data)}`);
        return false;
      }
    } catch (error) {
      this.logTest('Create Package with Expiration', false, `Error: ${error.message}`);
      return false;
    }
  }

  async createPackageWithoutExpiration() {
    try {
      const timestamp = Date.now();
      
      const packageData = {
        planType: 'basic',
        name: `Lifetime Basic ${timestamp}`,
        monthlyPrice: 7900, // $79.00 in cents
        description: 'Basic package with no expiration date',
        features: ['Basic sauna access', 'Community events', 'No expiration'],
        isActive: true,
        expiresAt: null // Explicitly set to null for no expiration
      };

      const response = await this.makeRequest('POST', '/api/admin/membership-plans', packageData);
      
      const success = response.statusCode === 201 && response.data.id;
      if (success) {
        this.nonExpiringPlanId = response.data.id;
        
        // Verify there's no expiration date
        const noExpiration = !response.data.expiresAt;
        this.logTest('Create Package without Expiration', noExpiration,
          noExpiration ? `Plan ID: ${response.data.id}, No expiration set` : 
                        `Plan created but expiration date was set unexpectedly`);
        return noExpiration;
      } else {
        this.logTest('Create Package without Expiration', false,
          `Failed: ${response.statusCode} - ${JSON.stringify(response.data)}`);
        return false;
      }
    } catch (error) {
      this.logTest('Create Package without Expiration', false, `Error: ${error.message}`);
      return false;
    }
  }

  async verifyPackagesExist() {
    try {
      const response = await this.makeRequest('GET', '/api/admin/membership-plans', null);
      
      if (response.statusCode !== 200) {
        this.logTest('Verify Packages Exist', false, `Failed to get plans: ${response.statusCode}`);
        return false;
      }

      const expiringPlan = response.data.find(p => p.id === this.expiringPlanId);
      const nonExpiringPlan = response.data.find(p => p.id === this.nonExpiringPlanId);

      const bothExist = !!expiringPlan && !!nonExpiringPlan;
      
      if (bothExist) {
        this.logTest('Both Packages Found', true,
          `Expiring: ${expiringPlan.name}, Non-expiring: ${nonExpiringPlan.name}`);
        
        // Verify expiration dates are correct
        const expirationCorrect = !!expiringPlan.expiresAt;
        this.logTest('Expiring Package Has Expiration Date', expirationCorrect,
          expirationCorrect ? `Expires: ${new Date(expiringPlan.expiresAt).toLocaleDateString()}` : 
                             'No expiration date found');
        
        const noExpirationCorrect = !nonExpiringPlan.expiresAt;
        this.logTest('Non-Expiring Package Has No Expiration', noExpirationCorrect,
          noExpirationCorrect ? 'Correctly has no expiration' : 
                               `Unexpectedly has expiration: ${nonExpiringPlan.expiresAt}`);
        
        return expirationCorrect && noExpirationCorrect;
      } else {
        this.logTest('Verify Packages Exist', false,
          `Expiring plan found: ${!!expiringPlan}, Non-expiring plan found: ${!!nonExpiringPlan}`);
        return false;
      }
    } catch (error) {
      this.logTest('Verify Packages Exist', false, `Error: ${error.message}`);
      return false;
    }
  }

  async updatePackageExpiration() {
    try {
      if (!this.nonExpiringPlanId) {
        this.logTest('Update Package Expiration', false, 'No package ID to update');
        return false;
      }

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60); // 60 days from now
      
      const updateData = {
        expiresAt: futureDate.toISOString()
      };

      const response = await this.makeRequest('PUT', `/api/admin/membership-plans/${this.nonExpiringPlanId}`, updateData);
      
      const success = response.statusCode === 200 && response.data.expiresAt;
      this.logTest('Update Package to Add Expiration', success,
        success ? `Now expires: ${new Date(response.data.expiresAt).toLocaleDateString()}` : 
                 `Failed: ${response.statusCode}`);
      
      return success;
    } catch (error) {
      this.logTest('Update Package Expiration', false, `Error: ${error.message}`);
      return false;
    }
  }

  async removePackageExpiration() {
    try {
      if (!this.expiringPlanId) {
        this.logTest('Remove Package Expiration', false, 'No package ID to update');
        return false;
      }
      
      const updateData = {
        expiresAt: null
      };

      const response = await this.makeRequest('PUT', `/api/admin/membership-plans/${this.expiringPlanId}`, updateData);
      
      const success = response.statusCode === 200 && !response.data.expiresAt;
      this.logTest('Update Package to Remove Expiration', success,
        success ? 'Expiration successfully removed' : 
                 `Failed: ${response.statusCode}`);
      
      return success;
    } catch (error) {
      this.logTest('Remove Package Expiration', false, `Error: ${error.message}`);
      return false;
    }
  }

  async cleanupTestData() {
    try {
      let cleanupSuccess = true;

      // Delete the expiring plan
      if (this.expiringPlanId) {
        const deleteResponse1 = await this.makeRequest('DELETE', `/api/admin/membership-plans/${this.expiringPlanId}`, null);
        const deleted1 = deleteResponse1.statusCode === 204 || deleteResponse1.statusCode === 200;
        this.logTest('Cleanup Expiring Package', deleted1, 
          deleted1 ? `Deleted plan ID: ${this.expiringPlanId}` : `Failed: ${deleteResponse1.statusCode}`);
        cleanupSuccess = cleanupSuccess && deleted1;
      }

      // Delete the non-expiring plan
      if (this.nonExpiringPlanId) {
        const deleteResponse2 = await this.makeRequest('DELETE', `/api/admin/membership-plans/${this.nonExpiringPlanId}`, null);
        const deleted2 = deleteResponse2.statusCode === 204 || deleteResponse2.statusCode === 200;
        this.logTest('Cleanup Non-Expiring Package', deleted2, 
          deleted2 ? `Deleted plan ID: ${this.nonExpiringPlanId}` : `Failed: ${deleteResponse2.statusCode}`);
        cleanupSuccess = cleanupSuccess && deleted2;
      }

      return cleanupSuccess;
    } catch (error) {
      this.logTest('Cleanup', false, `Error: ${error.message}`);
      return false;
    }
  }

  async runAllTests() {
    console.log('\n🐺 Wolf Mother Wellness - Package Expiration E2E Tests');
    console.log('='.repeat(70));
    console.log(`Starting package expiration tests at: ${new Date().toISOString()}\n`);

    // Phase 1: Admin Login
    console.log('👤 PHASE 1: Admin Authentication');
    console.log('-'.repeat(45));
    
    if (!await this.adminLogin()) return this.printSummary();

    // Phase 2: Create Packages
    console.log('\n📦 PHASE 2: Create Packages with Different Expiration Settings');
    console.log('-'.repeat(45));
    
    if (!await this.createPackageWithExpiration()) return this.printSummary();
    if (!await this.createPackageWithoutExpiration()) return this.printSummary();

    // Phase 3: Verify Packages
    console.log('\n✅ PHASE 3: Verify Package Creation');
    console.log('-'.repeat(45));
    
    if (!await this.verifyPackagesExist()) return this.printSummary();

    // Phase 4: Update Package Expiration
    console.log('\n🔄 PHASE 4: Update Package Expiration Settings');
    console.log('-'.repeat(45));
    
    await this.updatePackageExpiration();
    await this.removePackageExpiration();

    // Phase 5: Cleanup
    console.log('\n🧹 PHASE 5: Cleanup Test Data');
    console.log('-'.repeat(45));
    
    await this.cleanupTestData();

    return this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 Package Expiration Test Results');
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

    console.log('\n📋 Test Coverage Summary:');
    console.log('  ✓ Admin authentication');
    console.log('  ✓ Create package with expiration date');
    console.log('  ✓ Create package without expiration (no expiration)');
    console.log('  ✓ Verify both packages exist');
    console.log('  ✓ Verify expiration dates are correctly set');
    console.log('  ✓ Update package to add expiration');
    console.log('  ✓ Update package to remove expiration');
    console.log('  ✓ Cleanup test data');
    
    console.log(`\n🎯 Overall Result: ${passedTests === totalTests ? '✅ COMPLETE SUCCESS' : `❌ ${failedTests} TESTS FAILED`}`);
    console.log(`Completed at: ${new Date().toISOString()}`);
    
    return passedTests === totalTests;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new PackageExpirationTestRunner();
  runner.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner crashed:', error);
      process.exit(1);
    });
}

export default PackageExpirationTestRunner;

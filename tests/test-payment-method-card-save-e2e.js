#!/usr/bin/env node

// E2E Test: Payment Method Card Save — Stripe Default Propagation
//
// Covers:
//  1. Member with an active subscription saves a new card (same fingerprint, new expiry)
//     → subscription's default_payment_method updated to the new PM ID
//  2. Member with no subscription saves their first card
//     → Stripe customer's invoice_settings.default_payment_method updated
//  3. Old card with same fingerprint removed from DB and detached from Stripe
//
// Requires: running server on :5000 AND a Stripe test-mode key (sk_test_...).
// Exits 0 (skipped) when a live key is detected.

import http from 'http';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function makeRequester(cookieStore) {
  return function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const body = data ? JSON.stringify(data) : null;
      const options = {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookieStore.value && { Cookie: cookieStore.value }),
        },
      };
      const req = http.request(options, (res) => {
        let raw = '';
        if (res.headers['set-cookie']) {
          cookieStore.value = res.headers['set-cookie'].join('; ');
        }
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: raw ? JSON.parse(raw) : {} });
          } catch {
            resolve({ statusCode: res.statusCode, data: raw });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  };
}

// ─── Test runner ──────────────────────────────────────────────────────────────

class PaymentMethodCardSaveTestRunner {
  constructor() {
    this.testResults = [];

    this.adminCookies = { value: '' };
    this.adminRequest = makeRequester(this.adminCookies);

    this.subMemberCookies = { value: '' };
    this.subMemberRequest = makeRequester(this.subMemberCookies);

    this.noSubMemberCookies = { value: '' };
    this.noSubMemberRequest = makeRequester(this.noSubMemberCookies);

    this.stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil',
      typescript: false,
    });

    // All Stripe IDs created during setup — used for cleanup.
    this.stripeCustomerIds = [];
    this.stripeSubscriptionIds = [];
    this.stripeProductId = null;
    this.stripePriceId = null;
  }

  // ── Logging ───────────────────────────────────────────────────────────────

  /** Record a test result and return `passed` so callers can gate on it. */
  logTest(name, passed, details = '') {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}${details ? ` — ${details}` : ''}`);
    this.testResults.push({ name, passed, details });
    return passed;
  }

  // ── Stripe guard ──────────────────────────────────────────────────────────

  isTestMode() {
    return STRIPE_SECRET_KEY?.startsWith('sk_test_');
  }

  // ── Admin helpers ─────────────────────────────────────────────────────────

  async adminLogin() {
    const res = await this.adminRequest('POST', '/api/login', {
      email: 'admin@wolfmothertulsa.com',
      password: 'WolfAdmin123!',
    });
    const ok = res.statusCode === 200 && res.data.role === 'admin';
    return this.logTest('Admin login', ok, ok ? `as ${res.data.email}` : `HTTP ${res.statusCode}`);
  }

  /** Register a test member and log in; returns { userId, email } or { userId: null }. */
  async registerMember(label, requestFn) {
    const ts = Date.now() + Math.floor(Math.random() * 10000);
    const email = `pm_test_${label}_${ts}@test-e2e.invalid`;
    const pw = 'Test@CardSave1!';

    const reg = await requestFn('POST', '/api/register', {
      firstName: 'CardTest',
      lastName: label,
      username: `pm_${label}_${ts}`,
      email,
      password: pw,
      confirmPassword: pw,
      phoneNumber: '+15550001234',
      dateOfBirth: '1990-01-01',
      ageConfirmation: true,
    });

    if (!this.logTest(`Register member (${label})`, reg.statusCode === 201,
      reg.statusCode === 201 ? email : `HTTP ${reg.statusCode}: ${JSON.stringify(reg.data)}`)) {
      return { userId: null, email };
    }

    const login = await requestFn('POST', '/api/login', { email, password: pw });
    if (!this.logTest(`Login member (${label})`, login.statusCode === 200,
      login.statusCode === 200 ? `userId=${login.data.id}` : `HTTP ${login.statusCode}`)) {
      return { userId: null, email };
    }

    return { userId: login.data.id, email };
  }

  /**
   * Create a DB membership for a user (admin). Returns the membership object or null.
   * NOTE: call this BEFORE linking a Stripe customer so the admin endpoint does not
   * see a linked customer+card and auto-create an untracked Stripe subscription.
   */
  async adminCreateMembership(userId) {
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res = await this.adminRequest('POST', '/api/admin/memberships', {
      userId,
      planType: 'basic',
      status: 'active',
      startDate,
      endDate,
      autoRenew: true,
    });
    const ok = res.statusCode === 201 && res.data.membershipId;
    if (!this.logTest(`Admin create membership for user ${userId}`, ok,
      ok ? `membershipId=${res.data.membershipId}` : `HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`)) {
      return null;
    }

    // Track any subscription the admin endpoint may have auto-created (e.g. when
    // a Stripe customer is already linked from a previous attempt). This ensures we
    // clean it up even though it is not the subscription under test.
    if (res.data.stripeSubscriptionId) {
      this.stripeSubscriptionIds.push(res.data.stripeSubscriptionId);
    }

    return res.data;
  }

  /** Link a Stripe customer ID to a user (force=true bypasses email-match check). */
  async adminLinkStripeCustomer(userId, stripeCustomerId) {
    const res = await this.adminRequest('POST', `/api/admin/members/${userId}/link-stripe-customer`,
      { stripeCustomerId, force: true });
    return this.logTest(`Admin link Stripe customer to user ${userId}`, res.statusCode === 200,
      res.statusCode === 200 ? stripeCustomerId : `HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`);
  }

  /** Patch a membership record (admin). */
  async adminPatchMembership(membershipId, patch) {
    const res = await this.adminRequest('PATCH', `/api/admin/memberships/${membershipId}`, patch);
    return this.logTest(`Admin patch membership ${membershipId}`, res.statusCode === 200,
      res.statusCode === 200 ? JSON.stringify(patch) : `HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`);
  }

  // ── Stripe test-object helpers ────────────────────────────────────────────

  async createStripeTestCustomer(email) {
    const customer = await this.stripe.customers.create({
      email,
      name: 'CardTest E2E',
      metadata: { source: 'e2e_test' },
    });
    this.stripeCustomerIds.push(customer.id);
    return customer;
  }

  async createAndAttachTestPM(customerId, token = 'tok_visa') {
    const pm = await this.stripe.paymentMethods.create({
      type: 'card',
      card: { token },
    });
    await this.stripe.paymentMethods.attach(pm.id, { customer: customerId });
    return pm;
  }

  /** Create a test product + monthly price (cached after first call). */
  async ensureTestPrice() {
    if (this.stripePriceId) return this.stripePriceId;

    const product = await this.stripe.products.create({
      name: 'E2E Test Membership (delete me)',
      metadata: { source: 'e2e_test' },
    });
    this.stripeProductId = product.id;

    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: 100,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    this.stripePriceId = price.id;
    return price.id;
  }

  /** Create a trialing Stripe subscription so no real charge fires. */
  async createTestSubscription(customerId, defaultPaymentMethodId) {
    const priceId = await this.ensureTestPrice();
    const trialEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const sub = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: defaultPaymentMethodId,
      trial_end: trialEnd,
      metadata: { source: 'e2e_test' },
    });
    this.stripeSubscriptionIds.push(sub.id);
    return sub;
  }

  // ── Scenario 1: subscription member saves a new card ─────────────────────

  async testSubscriptionMemberCardSave() {
    console.log('\n📋 Scenario 1: member with active subscription saves a new card');
    console.log('-'.repeat(60));

    // 1a. Register member
    const { userId, email } = await this.registerMember('sub', this.subMemberRequest);
    if (!userId) return false;

    // 1b. Create DB membership BEFORE linking a Stripe customer.
    //     This prevents POST /api/admin/memberships from seeing a customer+card
    //     and auto-creating an untracked subscription.
    const membership = await this.adminCreateMembership(userId);
    if (!membership) return false;

    // 1c. Create Stripe objects: customer → old PM → subscription
    let customer, oldPm, subscription;
    try {
      customer = await this.createStripeTestCustomer(email);
      oldPm = await this.createAndAttachTestPM(customer.id, 'tok_visa');
      await this.stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: oldPm.id },
      });
      subscription = await this.createTestSubscription(customer.id, oldPm.id);
      this.logTest('Create Stripe customer + old PM + subscription', true,
        `cus=${customer.id} pm=${oldPm.id} sub=${subscription.id}`);
    } catch (err) {
      this.logTest('Create Stripe customer + old PM + subscription', false, err.message);
      return false;
    }

    // 1d. Link Stripe customer to DB user (done after membership creation).
    if (!await this.adminLinkStripeCustomer(userId, customer.id)) return false;

    // 1e. Link the Stripe subscription to the DB membership.
    if (!await this.adminPatchMembership(membership.membershipId, {
      stripeSubscriptionId: subscription.id,
    })) return false;

    // 1f. Seed old PM into the DB (as member, now that the customer is linked).
    const seedRes = await this.subMemberRequest('POST', '/api/payment-methods',
      { paymentMethodId: oldPm.id });
    if (!this.logTest('Seed old PM into DB', seedRes.statusCode === 200,
      seedRes.statusCode === 200 ? oldPm.id : `HTTP ${seedRes.statusCode}: ${JSON.stringify(seedRes.data)}`)) {
      return false;
    }

    // 1g. Member creates a NEW payment method (same card → same fingerprint in Stripe).
    let newPm;
    try {
      newPm = await this.stripe.paymentMethods.create({
        type: 'card',
        card: { token: 'tok_visa' },
      });
      this.logTest('Create new test PM (same card/fingerprint)', true, newPm.id);
    } catch (err) {
      this.logTest('Create new test PM', false, err.message);
      return false;
    }

    // 1h. POST /api/payment-methods — the call under test.
    const saveRes = await this.subMemberRequest('POST', '/api/payment-methods',
      { paymentMethodId: newPm.id });
    if (!this.logTest('POST /api/payment-methods (new card save)',
      saveRes.statusCode === 200 && saveRes.data.stripePaymentMethodId === newPm.id,
      saveRes.statusCode === 200
        ? `saved PM=${newPm.id}`
        : `HTTP ${saveRes.statusCode}: ${JSON.stringify(saveRes.data)}`)) {
      return false;
    }

    // ── Assertions (each failure drives the scenario result) ──────────────

    let allAssertionsPassed = true;

    // A: Subscription default_payment_method → new PM
    try {
      const updatedSub = await this.stripe.subscriptions.retrieve(subscription.id);
      const subPm = typeof updatedSub.default_payment_method === 'string'
        ? updatedSub.default_payment_method
        : updatedSub.default_payment_method?.id;
      if (!this.logTest(
        'Stripe subscription default_payment_method → new PM',
        subPm === newPm.id,
        subPm === newPm.id ? newPm.id : `got ${subPm}, expected ${newPm.id}`
      )) allAssertionsPassed = false;
    } catch (err) {
      this.logTest('Stripe subscription default_payment_method check', false, err.message);
      allAssertionsPassed = false;
    }

    // B: Customer invoice_settings.default_payment_method → new PM
    try {
      const updatedCust = await this.stripe.customers.retrieve(customer.id);
      const custPm = typeof updatedCust.invoice_settings?.default_payment_method === 'string'
        ? updatedCust.invoice_settings.default_payment_method
        : updatedCust.invoice_settings?.default_payment_method?.id;
      if (!this.logTest(
        'Stripe customer invoice_settings.default_payment_method → new PM',
        custPm === newPm.id,
        custPm === newPm.id ? newPm.id : `got ${custPm}, expected ${newPm.id}`
      )) allAssertionsPassed = false;
    } catch (err) {
      this.logTest('Stripe customer invoice_settings check', false, err.message);
      allAssertionsPassed = false;
    }

    // C: Old PM removed from DB (duplicate fingerprint)
    try {
      const listRes = await this.subMemberRequest('GET', '/api/payment-methods');
      const pms = Array.isArray(listRes.data) ? listRes.data : [];
      const oldGone = !pms.some(p => p.stripePaymentMethodId === oldPm.id);
      const newPresent = pms.some(p => p.stripePaymentMethodId === newPm.id);
      if (!this.logTest('Old PM removed from DB (fingerprint duplicate)', oldGone,
        oldGone ? 'not in list' : `still present: ${JSON.stringify(pms.map(p => p.stripePaymentMethodId))}`
      )) allAssertionsPassed = false;
      if (!this.logTest('New PM present in DB', newPresent,
        newPresent ? newPm.id : `not found: ${JSON.stringify(pms.map(p => p.stripePaymentMethodId))}`
      )) allAssertionsPassed = false;
    } catch (err) {
      this.logTest('DB payment method list check', false, err.message);
      allAssertionsPassed = false;
    }

    // D: Old PM detached from Stripe customer
    try {
      const oldPmCheck = await this.stripe.paymentMethods.retrieve(oldPm.id);
      const detached = !oldPmCheck.customer;
      if (!this.logTest('Old PM detached from Stripe customer', detached,
        detached ? 'customer=null' : `still attached to ${oldPmCheck.customer}`
      )) allAssertionsPassed = false;
    } catch (err) {
      // resource_missing → fully gone from Stripe — acceptable
      const gone = err.code === 'resource_missing';
      if (!this.logTest('Old PM detached from Stripe', gone,
        gone ? 'resource_missing (acceptable)' : err.message
      )) allAssertionsPassed = false;
    }

    return allAssertionsPassed;
  }

  // ── Scenario 2: no-subscription member saves first card ──────────────────

  async testNoSubscriptionMemberCardSave() {
    console.log('\n📋 Scenario 2: member with no subscription saves first card');
    console.log('-'.repeat(60));

    // 2a. Register member (no membership record created — tests the no-subscription path)
    const { userId, email } = await this.registerMember('nosub', this.noSubMemberRequest);
    if (!userId) return false;

    // 2b. Create Stripe customer (no subscription) — do this before any admin
    //     membership creation so there is nothing to auto-link.
    let customer;
    try {
      customer = await this.createStripeTestCustomer(email);
      this.logTest('Create Stripe customer (no subscription)', true, customer.id);
    } catch (err) {
      this.logTest('Create Stripe customer', false, err.message);
      return false;
    }

    // 2c. Link Stripe customer to DB user (no membership exists, so no auto-link fires).
    if (!await this.adminLinkStripeCustomer(userId, customer.id)) return false;

    // 2d. Member creates their first PM.
    let firstPm;
    try {
      firstPm = await this.stripe.paymentMethods.create({
        type: 'card',
        card: { token: 'tok_mastercard' },
      });
      this.logTest('Create first test PM (Mastercard)', true, firstPm.id);
    } catch (err) {
      this.logTest('Create first test PM', false, err.message);
      return false;
    }

    // 2e. POST /api/payment-methods — the call under test.
    const saveRes = await this.noSubMemberRequest('POST', '/api/payment-methods',
      { paymentMethodId: firstPm.id });
    if (!this.logTest('POST /api/payment-methods (first card, no subscription)',
      saveRes.statusCode === 200 && saveRes.data.stripePaymentMethodId === firstPm.id,
      saveRes.statusCode === 200
        ? `saved PM=${firstPm.id}`
        : `HTTP ${saveRes.statusCode}: ${JSON.stringify(saveRes.data)}`)) {
      return false;
    }

    // ── Assertions ────────────────────────────────────────────────────────

    let allAssertionsPassed = true;

    // A: Customer invoice_settings.default_payment_method set to first PM
    try {
      const updatedCust = await this.stripe.customers.retrieve(customer.id);
      const custPm = typeof updatedCust.invoice_settings?.default_payment_method === 'string'
        ? updatedCust.invoice_settings.default_payment_method
        : updatedCust.invoice_settings?.default_payment_method?.id;
      if (!this.logTest(
        'Stripe customer invoice_settings.default_payment_method set to first PM',
        custPm === firstPm.id,
        custPm === firstPm.id ? firstPm.id : `got ${custPm}, expected ${firstPm.id}`
      )) allAssertionsPassed = false;
    } catch (err) {
      this.logTest('Stripe customer invoice_settings check', false, err.message);
      allAssertionsPassed = false;
    }

    // B: PM present in DB as default
    try {
      const listRes = await this.noSubMemberRequest('GET', '/api/payment-methods');
      const pms = Array.isArray(listRes.data) ? listRes.data : [];
      const found = pms.some(p => p.stripePaymentMethodId === firstPm.id && p.isDefault);
      if (!this.logTest('First PM saved in DB as default', found,
        found ? firstPm.id : `not found or not default: ${JSON.stringify(pms)}`
      )) allAssertionsPassed = false;
    } catch (err) {
      this.logTest('DB payment method check', false, err.message);
      allAssertionsPassed = false;
    }

    return allAssertionsPassed;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  async cleanupStripeObjects() {
    console.log('\n🧹 Cleaning up Stripe test objects');
    console.log('-'.repeat(60));

    for (const subId of this.stripeSubscriptionIds) {
      try {
        await this.stripe.subscriptions.cancel(subId);
        console.log(`  ↩️  Cancelled subscription ${subId}`);
      } catch (err) {
        if (err.code !== 'resource_missing') {
          console.log(`  ⚠️  Could not cancel subscription ${subId}: ${err.message}`);
        }
      }
    }

    for (const cusId of this.stripeCustomerIds) {
      try {
        await this.stripe.customers.del(cusId);
        console.log(`  ↩️  Deleted customer ${cusId}`);
      } catch (err) {
        if (err.code !== 'resource_missing') {
          console.log(`  ⚠️  Could not delete customer ${cusId}: ${err.message}`);
        }
      }
    }

    if (this.stripePriceId) {
      try {
        await this.stripe.prices.update(this.stripePriceId, { active: false });
        console.log(`  ↩️  Deactivated price ${this.stripePriceId}`);
      } catch (err) {
        console.log(`  ⚠️  Could not deactivate price: ${err.message}`);
      }
    }

    if (this.stripeProductId) {
      try {
        await this.stripe.products.update(this.stripeProductId, { active: false });
        console.log(`  ↩️  Deactivated product ${this.stripeProductId}`);
      } catch (err) {
        console.log(`  ⚠️  Could not deactivate product: ${err.message}`);
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  printSummary() {
    console.log('\n' + '='.repeat(65));
    console.log('📊 Payment Method Card Save — Test Results');
    console.log('='.repeat(65));

    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = total - passed;

    console.log(`Total:  ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success rate: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);

    if (failed > 0) {
      console.log('\n❌ Failed tests:');
      this.testResults.filter(r => !r.passed).forEach(r => {
        console.log(`  • ${r.name}: ${r.details}`);
      });
    }

    const overall = failed === 0;
    console.log(`\n🎯 Overall: ${overall ? '✅ ALL TESTS PASSED' : `❌ ${failed} TEST(S) FAILED`}`);
    console.log(`Completed at: ${new Date().toISOString()}`);
    return overall;
  }

  // ── Entry point ───────────────────────────────────────────────────────────

  async runAllTests() {
    console.log('='.repeat(65));
    console.log('💳 Payment Method Card Save E2E Tests');
    console.log('='.repeat(65));

    if (!STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY is not set — aborting.');
      process.exit(1);
    }

    if (!this.isTestMode()) {
      console.warn('⚠️  STRIPE_SECRET_KEY is a LIVE key.');
      console.warn('   These tests require a Stripe test-mode account (sk_test_...).');
      console.warn('   Skipping to avoid mutating real Stripe data.');
      console.log('\n✅ Skipped (live-mode key detected) — exit 0');
      return true; // Not a test failure; just not runnable in live mode.
    }

    console.log(`Stripe mode: TEST (key ends …${STRIPE_SECRET_KEY.slice(-4)})`);

    // Phase 0: Admin login
    console.log('\n🔐 PHASE 0: Admin Login');
    console.log('-'.repeat(60));
    if (!await this.adminLogin()) {
      console.error('Cannot proceed without admin session');
      this.printSummary();
      return false;
    }

    let scenario1Ok = false;
    let scenario2Ok = false;

    // Phase 1: Subscription scenario
    console.log('\n🔵 PHASE 1: Subscription Member Card Save');
    try {
      scenario1Ok = await this.testSubscriptionMemberCardSave();
    } catch (err) {
      console.error('Scenario 1 threw:', err);
      this.logTest('Scenario 1 (unexpected error)', false, err.message);
      scenario1Ok = false;
    }

    // Phase 2: No-subscription scenario
    console.log('\n🟢 PHASE 2: No-Subscription Member Card Save');
    try {
      scenario2Ok = await this.testNoSubscriptionMemberCardSave();
    } catch (err) {
      console.error('Scenario 2 threw:', err);
      this.logTest('Scenario 2 (unexpected error)', false, err.message);
      scenario2Ok = false;
    }

    // Cleanup always runs
    await this.cleanupStripeObjects();

    return this.printSummary();
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new PaymentMethodCardSaveTestRunner();
  runner.runAllTests()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('Test runner crashed:', err);
      process.exit(1);
    });
}

export default PaymentMethodCardSaveTestRunner;

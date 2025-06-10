import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import Stripe from "stripe";

const scryptAsync = promisify(scrypt);
import { 
  insertMembershipSchema, 
  insertCheckInSchema, 
  insertPaymentSchema, 
  insertMembershipPlanSchema,
  insertPunchCardTemplateSchema,
  insertPunchCardSchema,
  insertNotificationSchema
} from "@shared/schema";
import { z } from "zod";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-05-28.basil",
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Authenticated routes middleware
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Admin middleware
  const isAdmin = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user.role === 'admin') {
      return next();
    }
    res.status(403).json({ message: "Forbidden" });
  };

  // Get membership for current user
  app.get("/api/membership", isAuthenticated, async (req, res) => {
    try {
      const membership = await storage.getMembershipByUserId(req.user!.id);
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }
      res.json(membership);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update membership for current user
  app.patch("/api/membership", isAuthenticated, async (req, res) => {
    try {
      const { planType, status } = req.body;
      const membership = await storage.getMembershipByUserId(req.user!.id);
      
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }

      const updatedMembership = await storage.updateMembership(membership.membershipId, {
        planType: planType,
        status: status
      });

      res.json(updatedMembership);
    } catch (error: any) {
      console.error("Membership update error:", error);
      res.status(500).json({ message: "Server error: " + error.message });
    }
  });

  // Get check-ins for current user
  app.get("/api/check-ins", isAuthenticated, async (req, res) => {
    try {
      const checkIns = await storage.getCheckInsByUserId(req.user!.id);
      res.json(checkIns);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get payments for current user
  app.get("/api/payments", isAuthenticated, async (req, res) => {
    try {
      const payments = await storage.getPaymentsByUserId(req.user!.id);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get available membership plans
  app.get("/api/membership-plans", async (req, res) => {
    try {
      const plans = await storage.getAllMembershipPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Create or update membership plan (admin-only endpoint)
  app.post("/api/admin/membership-plans", isAdmin, async (req, res) => {
    console.log('POST /api/admin/membership-plans hit with body:', req.body);
    try {
      const validatedData = insertMembershipPlanSchema.parse(req.body);
      console.log('Validated data:', validatedData);
      const plan = await storage.createOrUpdateMembershipPlan(validatedData);
      console.log('Created plan:', plan);
      res.status(201).json(plan);
    } catch (error) {
      console.error('Membership plan creation error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Check in using QR code
  app.post("/api/check-in", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertCheckInSchema.parse(req.body);
      const userId = req.user!.id;
      
      // Check if user has active membership
      const membership = await storage.getMembershipByUserId(userId);
      
      // Check if user has day pass packages (punch cards)
      const userPunchCards = await storage.getPunchCardsByUserId(userId);
      const activeDayPasses = userPunchCards.filter(card => 
        card.status === 'active' && card.remainingPunches > 0
      );
      
      // User needs either active monthly membership or day passes
      if ((!membership || membership.status !== 'active') && activeDayPasses.length === 0) {
        return res.status(400).json({ 
          message: "No active membership found. Please purchase a monthly membership or day pass package." 
        });
      }
      
      // If user has day passes, use those first (they're more expensive per visit)
      if (activeDayPasses.length > 0) {
        const oldestDayPass = activeDayPasses.sort((a, b) => 
          new Date(a.purchasedAt || '1970-01-01').getTime() - new Date(b.purchasedAt || '1970-01-01').getTime()
        )[0];
        
        // Use one visit from the day pass
        await storage.usePunchCardEntry(oldestDayPass.id);
        
        // Create check-in record
        const checkIn = await storage.createCheckIn({
          userId: userId,
          membershipId: membership?.membershipId || `day-pass-${oldestDayPass.id}`,
          location: validatedData.location || 'QR Code Check-in',
          method: 'qr'
        });

        res.status(201).json({ 
          checkIn, 
          message: `Check-in successful using day pass! Remaining visits: ${oldestDayPass.remainingPunches - 1}`,
          dayPassUsed: true,
          remainingVisits: oldestDayPass.remainingPunches - 1,
          packageName: oldestDayPass.name
        });
      } else {
        // Use monthly membership
        const checkIn = await storage.createCheckIn({
          userId: userId,
          membershipId: membership!.membershipId,
          location: validatedData.location || 'QR Code Check-in',
          method: 'qr'
        });

        res.status(201).json({ 
          checkIn, 
          message: "Check-in successful!",
          membershipUsed: true
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin routes

  // Get all members
  app.get("/api/admin/members", isAdmin, async (req, res) => {
    try {
      const members = await storage.getAllMembers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get all check-ins (with pagination)
  app.get("/api/admin/check-ins", isAdmin, async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const checkIns = await storage.getAllCheckIns(page, limit);
      res.json(checkIns);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get today's check-ins
  app.get("/api/admin/check-ins/today", isAdmin, async (req, res) => {
    try {
      const checkIns = await storage.getTodayCheckIns();
      res.json(checkIns);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Create a new membership
  app.post("/api/admin/memberships", isAdmin, async (req, res) => {
    try {
      const validatedData = insertMembershipSchema.parse(req.body);
      const membership = await storage.createMembership(validatedData);
      res.status(201).json(membership);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update a membership
  app.patch("/api/admin/memberships/:id", isAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const membership = await storage.getMembershipById(id);
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }

      const updatedMembership = await storage.updateMembership(id, req.body);
      res.json(updatedMembership);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Create a payment record
  app.post("/api/admin/payments", isAdmin, async (req, res) => {
    try {
      const validatedData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(validatedData);
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get membership plans for admin
  app.get("/api/admin/membership-plans", isAdmin, async (req, res) => {
    try {
      const plans = await storage.getAllMembershipPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Create or update a membership plan
  app.post("/api/admin/membership-plans", isAdmin, async (req, res) => {
    try {
      const validatedData = insertMembershipPlanSchema.parse(req.body);
      const plan = await storage.createOrUpdateMembershipPlan(validatedData);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update a membership plan  
  app.put("/api/admin/membership-plans/:id", isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const validatedData = insertMembershipPlanSchema.parse(req.body);
      const plan = await storage.updateMembershipPlan(id, validatedData);
      res.json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Delete a membership plan
  app.delete("/api/admin/membership-plans/:id", isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteMembershipPlan(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin punch card template management
  app.get("/api/admin/punch-card-templates", isAdmin, async (req, res) => {
    try {
      const templates = await storage.getAllPunchCardTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/punch-card-templates", isAdmin, async (req, res) => {
    try {
      const validatedData = insertPunchCardTemplateSchema.parse(req.body);
      const template = await storage.createPunchCardTemplate(validatedData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/admin/punch-card-templates/:id", isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const validatedData = insertPunchCardTemplateSchema.partial().parse(req.body);
      const template = await storage.updatePunchCardTemplate(id, validatedData);
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/admin/punch-card-templates/:id", isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deletePunchCardTemplate(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Punch card routes

  // Get available punch card options
  app.get("/api/punch-cards/options", async (req, res) => {
    try {
      const options = await storage.getAvailablePunchCardOptions();
      res.json(options);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get user's punch cards
  app.get("/api/punch-cards", isAuthenticated, async (req, res) => {
    try {
      const punchCards = await storage.getPunchCardsByUserId(req.user!.id);
      res.json(punchCards);
    } catch (error) {
      console.error("Error fetching punch cards:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Purchase a punch card
  app.post("/api/punch-cards", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertPunchCardSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });
      const punchCard = await storage.createPunchCard(validatedData);
      res.status(201).json(punchCard);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Use a punch from a card
  app.post("/api/punch-cards/:id/use", isAuthenticated, async (req, res) => {
    try {
      const cardId = Number(req.params.id);
      const punchCard = await storage.getPunchCardById(cardId);
      
      if (!punchCard) {
        return res.status(404).json({ message: "Punch card not found" });
      }
      
      if (punchCard.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not your punch card" });
      }

      const updatedCard = await storage.usePunchCardEntry(cardId);
      res.json(updatedCard);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Payment management routes
  
  // Create or get Stripe customer
  app.post("/api/stripe/customer", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      
      if (user.stripeCustomerId) {
        // Return existing customer
        const customer = await stripe.customers.retrieve(user.stripeCustomerId);
        return res.json({ customer });
      }
      
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id.toString() }
      });
      
      // Save customer ID to user
      await storage.updateUserStripeCustomerId(user.id, customer.id);
      
      res.json({ customer });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to create customer: " + error.message });
    }
  });

  // Get user's payment methods
  app.get("/api/payment-methods", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const paymentMethods = await storage.getPaymentMethodsByUserId(user.id);
      res.json(paymentMethods);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch payment methods: " + error.message });
    }
  });

  // Create setup intent for adding new payment method
  app.post("/api/stripe/setup-intent", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      
      // Ensure user has Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: { userId: user.id.toString() }
        });
        customerId = customer.id;
        await storage.updateUserStripeCustomerId(user.id, customerId);
      }
      
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session'
      });
      
      res.json({ clientSecret: setupIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to create setup intent: " + error.message });
    }
  });

  // Save payment method after successful setup
  app.post("/api/payment-methods", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { paymentMethodId } = req.body;
      
      // Retrieve payment method from Stripe
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      if (!paymentMethod.card) {
        return res.status(400).json({ message: "Invalid payment method" });
      }
      
      // Check if this is the user's first payment method to make it default
      const existingMethods = await storage.getPaymentMethodsByUserId(user.id);
      const isDefault = existingMethods.length === 0;
      
      // Save to database
      const savedMethod = await storage.createPaymentMethod({
        userId: user.id,
        stripePaymentMethodId: paymentMethod.id,
        cardLast4: paymentMethod.card.last4,
        cardBrand: paymentMethod.card.brand,
        cardExpMonth: paymentMethod.card.exp_month,
        cardExpYear: paymentMethod.card.exp_year,
        isDefault
      });
      
      res.json(savedMethod);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to save payment method: " + error.message });
    }
  });

  // Set default payment method
  app.put("/api/payment-methods/:paymentMethodId/default", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { paymentMethodId } = req.params;
      
      await storage.setDefaultPaymentMethod(user.id, paymentMethodId);
      res.json({ message: "Default payment method updated" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to update default payment method: " + error.message });
    }
  });

  // Delete payment method
  app.delete("/api/payment-methods/:paymentMethodId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { paymentMethodId } = req.params;
      
      // Detach from Stripe
      await stripe.paymentMethods.detach(paymentMethodId);
      
      // Remove from database
      await storage.deletePaymentMethod(paymentMethodId);
      
      res.json({ message: "Payment method deleted" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete payment method: " + error.message });
    }
  });

  // Create payment intent for membership or day pass
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, description } = req.body;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        description: description || 'Wolf Mother Wellness Payment',
        automatic_payment_methods: {
          enabled: true,
        },
      });
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id 
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to create payment intent: " + error.message });
    }
  });

  // Confirm payment and record in database
  app.post("/api/confirm-payment", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { paymentIntentId, membershipId, description, planType } = req.body;
      
      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      // For demo purposes, simulate successful payment
      // In production, you would actually process the payment through Stripe
      const simulatedSuccessfulPayment = {
        userId: user.id,
        membershipId: membershipId || 'general-purchase',
        amount: paymentIntent.amount, // Already in cents
        description,
        status: 'successful' as const,
        method: 'credit_card' as const,
        stripePaymentIntentId: paymentIntent.id,
        stripePaymentMethodId: 'pm_simulated_success'
      };
      
      // Record payment in database
      const payment = await storage.createPayment(simulatedSuccessfulPayment);
      
      // If this is a membership or day pass purchase, create or update the membership
      if (planType || (description && (description.includes('Membership') || description.includes('membership') || description.includes('Day Pass') || description.includes('day pass')))) {
        try {
          // Use provided planType or extract from description
          let membershipPlanType = planType;
          if (!membershipPlanType) {
            if (description.toLowerCase().includes('basic')) membershipPlanType = 'basic';
            else if (description.toLowerCase().includes('premium')) membershipPlanType = 'premium';
            else if (description.toLowerCase().includes('vip')) membershipPlanType = 'vip';
            else if (description.toLowerCase().includes('day pass')) membershipPlanType = 'daily';
            else membershipPlanType = 'basic'; // default
          }
          
          // Check if user already has a membership
          const existingMembership = await storage.getMembershipByUserId(user.id);
          
          // Calculate end date based on plan type
          let endDate;
          let autoRenew = true;
          
          if (membershipPlanType === 'daily') {
            // Day pass expires at end of day
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            autoRenew = false; // Day passes don't auto-renew
          } else {
            // Monthly memberships last 30 days
            endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          }
          
          if (existingMembership) {
            // Update existing membership
            await storage.updateMembership(existingMembership.id.toString(), {
              planType: membershipPlanType,
              status: 'active',
              startDate: new Date().toISOString(),
              endDate: endDate.toISOString(),
              autoRenew: autoRenew
            });
          } else {
            // Create new membership
            const newMembershipId = `WM-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}-${String(user.id).padStart(4, '0')}`;
            
            await storage.createMembership({
              userId: user.id,
              membershipId: newMembershipId,
              planType: membershipPlanType,
              status: 'active',
              startDate: new Date().toISOString(),
              endDate: endDate.toISOString(),
              autoRenew: autoRenew
            });
          }
        } catch (membershipError) {
          console.error('Failed to create/update membership:', membershipError);
          // Don't fail the payment if membership creation fails, but log the error
        }
      }
      
      res.json({ payment, message: "Payment successful" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to confirm payment: " + error.message });
    }
  });

  // Admin analytics routes
  app.get("/api/admin/dashboard-summary", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    try {
      const summary = await storage.getDashboardSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/visit-analytics", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    try {
      const period = req.query.period as string || 'week';
      const analytics = await storage.getVisitAnalytics(period);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/peak-hours", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    try {
      const peakHours = await storage.getPeakHoursAnalytics();
      res.json(peakHours);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new member (admin only)
  app.post("/api/admin/create-member", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.sendStatus(403);
    }
    
    try {
      const { firstName, lastName, email, username, password, planType } = req.body;
      
      // Hash password using crypto functions
      const crypto = await import('crypto');
      const salt = crypto.randomBytes(16).toString("hex");
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;

      // Create user
      const newUser = await storage.createUser({
        firstName,
        lastName,
        email,
        username,
        password: hashedPassword,
        role: 'member'
      });

      // Generate unique membership ID
      const membershipId = `WM-${String(newUser.id).padStart(3, '0')}`;
      
      // Create membership with required dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 1 month from now
      
      const membership = await storage.createMembership({
        userId: newUser.id,
        membershipId,
        planType,
        status: 'active',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      res.json({ 
        user: { ...newUser, password: undefined }, 
        membership 
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to create member: " + error.message });
    }
  });

  // Manual check-in for staff
  app.post("/api/admin/manual-checkin", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    try {
      const { membershipId } = req.body;
      
      // Find user by membership ID
      const user = await storage.getUserByMembershipId(membershipId);
      if (!user) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Create check-in record  
      const checkIn = await storage.createCheckIn({
        userId: user.id,
        membershipId: membershipId,
        location: 'Front Desk - Manual'
      });

      res.status(201).json({ 
        message: "Check-in successful",
        checkIn,
        member: { username: user.username, email: user.email }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin check-ins route with pagination
  app.get("/api/admin/check-ins", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.sendStatus(403);
    }
    
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const result = await storage.getAllCheckIns(page, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Today's check-ins
  app.get("/api/check-ins/today", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const todayCheckIns = await storage.getTodayCheckIns();
      res.json(todayCheckIns);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== NOTIFICATION ROUTES =====
  
  // Get all notifications (Admin only)
  app.get("/api/admin/notifications", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.sendStatus(403);
    }
    
    try {
      const notifications = await storage.getAllNotifications();
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get active notifications (for member dashboard)
  app.get("/api/notifications/active", async (req, res) => {
    try {
      const notifications = await storage.getActiveNotifications();
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single notification (Admin only)
  app.get("/api/admin/notifications/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.sendStatus(403);
    }
    
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.getNotificationById(id);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create notification (Admin only)
  app.post("/api/admin/notifications", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.sendStatus(403);
    }
    
    try {
      const validatedData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(validatedData);
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update notification (Admin only)
  app.put("/api/admin/notifications/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.sendStatus(403);
    }
    
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.updateNotification(id, req.body);
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete notification (Admin only)
  app.delete("/api/admin/notifications/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.sendStatus(403);
    }
    
    try {
      const id = parseInt(req.params.id);
      await storage.deleteNotification(id);
      res.json({ message: "Notification deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { stripe, STRIPE_CONFIG, formatAmountForStripe, formatAmountFromStripe, STRIPE_ENV_INFO } from "./stripe-config";
import { setupStripeWebhooks } from "./stripe-webhooks";
import { walletService } from "./wallet/wallet-service";
import { eq, or, sql } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
import { 
  insertMembershipSchema, 
  insertCheckInSchema, 
  insertPaymentSchema, 
  insertMembershipPlanSchema,
  insertPunchCardTemplateSchema,
  insertPunchCardSchema,
  insertNotificationSchema,
  insertUserSchema,
  insertPromotionSchema,
  users as usersTable
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Stripe webhooks
  setupStripeWebhooks(app);
  
  // Setup authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Expose Stripe public key to frontend
  app.get("/api/stripe/config", (req, res) => {
    res.json({ publicKey: STRIPE_ENV_INFO.publicKey });
  });

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

  // Cancel membership endpoint
  app.delete("/api/membership/cancel", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const membership = await storage.getMembershipByUserId(userId);
      
      if (!membership || membership.status !== 'active') {
        return res.status(400).json({ 
          error: "No active membership found to cancel" 
        });
      }

      // Update membership status to cancelled
      await storage.updateMembership(membership.id.toString(), { 
        status: 'inactive',
        endDate: new Date().toISOString().split('T')[0] // Set end date to now for immediate cancellation
      });

      res.json({ 
        message: "Membership cancelled successfully",
        membership: await storage.getMembershipByUserId(userId)
      });
    } catch (error: any) {
      console.error("Error cancelling membership:", error);
      res.status(500).json({ 
        error: "Failed to cancel membership",
        details: error.message 
      });
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

  // ===== ADMIN MEMBERSHIP PLANS CRUD =====

  // Get all membership plans (Admin only - includes inactive plans)
  app.get("/api/admin/membership-plans", isAdmin, async (req, res) => {
    try {
      const plans = await storage.getAllMembershipPlans();
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create membership plan (Admin only)
  app.post("/api/admin/membership-plans", isAdmin, async (req, res) => {
    try {
      const validatedData = insertMembershipPlanSchema.parse(req.body);
      const plan = await storage.createMembershipPlan(validatedData);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update membership plan (Admin only)
  app.put("/api/admin/membership-plans/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertMembershipPlanSchema.partial().parse(req.body);
      const plan = await storage.updateMembershipPlan(id, validatedData);
      res.json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Delete membership plan (Admin only)
  app.delete("/api/admin/membership-plans/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMembershipPlan(id);
      res.json({ message: "Membership plan deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

  // Kiosk check-in using membership ID from QR code
  app.post("/api/kiosk-check-in", async (req, res) => {
    try {
      const { membershipId, useDayPass } = req.body;
      
      if (!membershipId) {
        return res.status(400).json({ 
          success: false,
          message: "Membership ID is required" 
        });
      }

      // Find user by membership ID
      const user = await storage.getUserByMembershipId(membershipId);
      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: "Member not found. Please see staff for assistance." 
        });
      }

      // Check if user has active membership
      const membership = await storage.getMembershipByUserId(user.id);
      
      // Check if user has day pass packages (punch cards)
      const userPunchCards = await storage.getPunchCardsByUserId(user.id);
      const activeDayPasses = userPunchCards.filter(card => 
        card.status === 'active' && card.remainingPunches > 0
      );
      
      // User needs either active monthly membership or day passes
      if ((!membership || membership.status !== 'active') && activeDayPasses.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: "No active membership or day passes found. Please purchase a membership or day pass package." 
        });
      }
      
      // If user has both membership and day passes, ask which to use
      if ((membership && membership.status === 'active') && activeDayPasses.length > 0 && useDayPass === undefined) {
        const totalDaysRemaining = activeDayPasses.reduce((sum, card) => sum + card.remainingPunches, 0);
        return res.json({
          requiresConfirmation: true,
          member: {
            firstName: user.firstName,
            lastName: user.lastName,
            membershipType: membership.planType,
            membershipStatus: membership.status
          },
          dayPasses: {
            available: true,
            totalRemaining: totalDaysRemaining,
            packages: activeDayPasses.map(card => ({
              id: card.id,
              name: card.name || 'Day Pass Package',
              remaining: card.remainingPunches,
              total: card.totalPunches
            }))
          },
          message: `Hi ${user.firstName}! Would you like to use your membership or a day pass?`
        });
      }
      
      // If user only has day passes, ask for confirmation
      if ((!membership || membership.status !== 'active') && activeDayPasses.length > 0 && useDayPass === undefined) {
        const totalDaysRemaining = activeDayPasses.reduce((sum, card) => sum + card.remainingPunches, 0);
        return res.json({
          requiresConfirmation: true,
          member: {
            firstName: user.firstName,
            lastName: user.lastName,
            membershipType: 'Day Pass',
            membershipStatus: 'day-pass'
          },
          dayPasses: {
            available: true,
            totalRemaining: totalDaysRemaining,
            packages: activeDayPasses.map(card => ({
              id: card.id,
              name: card.name || 'Day Pass Package',
              remaining: card.remainingPunches,
              total: card.totalPunches
            }))
          },
          message: `Hi ${user.firstName}! Use a day from your pass? (${totalDaysRemaining} remaining)`
        });
      }
      
      let membershipType = membership?.planType || 'Day Pass';
      let usedDayPass = false;
      
      // Process day pass usage if requested or if only option
      if ((useDayPass === true) || ((!membership || membership.status !== 'active') && activeDayPasses.length > 0)) {
        const oldestDayPass = activeDayPasses.sort((a, b) => 
          new Date(a.purchasedAt || '1970-01-01').getTime() - new Date(b.purchasedAt || '1970-01-01').getTime()
        )[0];
        
        // Use one visit from the day pass
        const updatedCard = await storage.usePunchCardEntry(oldestDayPass.id);
        membershipType = 'Day Pass';
        usedDayPass = true;
      }
      
      // Create check-in record
      const checkIn = await storage.createCheckIn({
        userId: user.id,
        membershipId: membership?.membershipId || 'day-pass-checkin',
        location: "Kiosk Check-in"
      });

      // Get updated day pass info if used
      let dayPassInfo = null;
      if (usedDayPass) {
        const updatedPunchCards = await storage.getPunchCardsByUserId(user.id);
        const updatedActiveDayPasses = updatedPunchCards.filter(card => 
          card.status === 'active' && card.remainingPunches >= 0
        );
        const totalRemaining = updatedActiveDayPasses.reduce((sum, card) => sum + card.remainingPunches, 0);
        
        dayPassInfo = {
          used: true,
          totalRemaining: totalRemaining,
          packages: updatedActiveDayPasses.map(card => ({
            id: card.id,
            name: card.name || 'Day Pass Package',
            remaining: card.remainingPunches,
            total: card.totalPunches
          }))
        };
      }

      res.json({
        success: true,
        member: {
          firstName: user.firstName,
          lastName: user.lastName,
          membershipType: membershipType,
          membershipStatus: membership?.status || 'day-pass'
        },
        dayPassInfo: dayPassInfo,
        message: `Welcome back, ${user.firstName}! Enjoy your session ✨`
      });
      
    } catch (error: any) {
      console.error("Kiosk check-in error:", error);
      res.status(500).json({ 
        success: false,
        message: "System error. Please see staff for assistance." 
      });
    }
  });

  // Check in using QR code (authenticated users)
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

  // Generate Apple Wallet pass for member
  app.post("/api/wallet/generate-pass", isAuthenticated, async (req, res) => {
    try {
      // Check if Apple Wallet is configured
      if (!walletService.isConfigured()) {
        return res.status(503).json({ 
          message: "Apple Wallet is not configured on this server. Please contact support.",
          configured: false
        });
      }

      const userId = req.user!.id;
      const membership = await storage.getMembershipByUserId(userId);
      
      if (!membership) {
        return res.status(404).json({ message: "No active membership found" });
      }

      // Generate QR code data (same format as the QR code page)
      const qrCodeData = JSON.stringify({
        type: "member_daily_checkin",
        membershipId: membership.membershipId,
        userId: userId,
        date: new Date().toISOString().split('T')[0],
        facility: "wolf_mother_wellness",
        memberName: `${req.user!.firstName} ${req.user!.lastName}`,
      });

      // Generate the pass
      const passBuffer = await walletService.generateMemberPass({
        membershipId: membership.membershipId,
        userId: userId,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
        status: membership.status,
        qrCodeData: qrCodeData
      });

      // Send the pass file
      res.set({
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${membership.membershipId}.pkpass"`
      });
      res.send(passBuffer);

    } catch (error) {
      console.error("Error generating Apple Wallet pass:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate Apple Wallet pass"
      });
    }
  });

  // Check Apple Wallet configuration status
  app.get("/api/wallet/status", isAuthenticated, async (req, res) => {
    res.json({ 
      configured: walletService.isConfigured(),
      message: walletService.isConfigured() 
        ? "Apple Wallet is ready to use" 
        : "Apple Wallet is not configured. Contact support to enable this feature."
    });
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

  // Update member details (Admin only)
  app.put("/api/admin/members/:id", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const { password, ...updateData } = req.body;
      
      // If password is provided, hash it
      if (password && password.trim()) {
        const salt = randomBytes(32);
        const hashedPassword = await scryptAsync(password, salt, 64) as Buffer;
        updateData.password = `${salt.toString('hex')}:${hashedPassword.toString('hex')}`;
      }
      
      const updatedUser = await storage.updateUser(memberId, updateData);
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Toggle member active status (Admin only)
  app.patch("/api/admin/members/:id/status", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const { isActive } = req.body;
      
      // Note: User schema doesn't have isActive field, this functionality may need to be implemented differently
      // const updatedUser = await storage.updateUser(memberId, { isActive });
      const updatedUser = { message: 'Status update not yet implemented - user schema lacks isActive field' };
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete member (Admin only)
  app.delete("/api/admin/members/:id", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      await storage.deleteUser(memberId);
      res.json({ message: "Member deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get member's payment history (Admin only)
  app.get("/api/admin/members/:id/payments", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const payments = await storage.getPaymentsByUserId(memberId);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get member's check-in history (Admin only)
  app.get("/api/admin/members/:id/check-ins", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const checkIns = await storage.getCheckInsByUserId(memberId);
      res.json(checkIns);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
      console.log(`Attempting to delete punch card template with ID: ${id}`);
      await storage.deletePunchCardTemplate(id);
      console.log(`Successfully deleted punch card template with ID: ${id}`);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting punch card template:", error);
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
      
      // Create new Stripe customer with production-ready config
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: user.id.toString(),
          ...STRIPE_CONFIG.customerConfig.metadata
        }
      });
      
      // Save customer ID to user
      await storage.updateUserStripeCustomerId(user.id, customer.id);
      
      res.json({ customer });
    } catch (error: any) {
      console.error('Failed to create Stripe customer:', error);
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
          metadata: {
            userId: user.id.toString(),
            ...STRIPE_CONFIG.customerConfig.metadata
          }
        });
        customerId = customer.id;
        await storage.updateUserStripeCustomerId(user.id, customerId);
      }
      
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        ...STRIPE_CONFIG.setupIntentConfig
      });
      
      res.json({ clientSecret: setupIntent.client_secret });
    } catch (error: any) {
      console.error('Failed to create setup intent:', error);
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

  // Create payment intent for membership or day pass (legacy)
  app.post("/api/create-payment-intent", isAuthenticated, async (req, res) => {
    try {
      const { amount, description, customerId } = req.body;
      const user = req.user!;
      
      // Ensure customer ID is available
      let stripeCustomerId = customerId || user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: {
            userId: user.id.toString(),
            ...STRIPE_CONFIG.customerConfig.metadata
          }
        });
        stripeCustomerId = customer.id;
        await storage.updateUserStripeCustomerId(user.id, stripeCustomerId);
      }
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: formatAmountForStripe(amount),
        currency: STRIPE_CONFIG.currency,
        customer: stripeCustomerId,
        description: description || 'Wolf Mother Wellness Payment',
        ...STRIPE_CONFIG.paymentIntentConfig,
        automatic_payment_methods: STRIPE_CONFIG.automaticPaymentMethods,
      });
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id 
      });
    } catch (error: any) {
      console.error('Failed to create payment intent:', error);
      res.status(500).json({ message: "Failed to create payment intent: " + error.message });
    }
  });

  // Create checkout session with automatic tax collection
  app.post("/api/create-checkout-session", isAuthenticated, async (req, res) => {
    try {
      const { items, mode = 'payment', successUrl, cancelUrl } = req.body;
      const user = req.user!;
      
      // Ensure customer ID is available
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: {
            userId: user.id.toString(),
            ...STRIPE_CONFIG.customerConfig.metadata
          }
        });
        stripeCustomerId = customer.id;
        await storage.updateUserStripeCustomerId(user.id, stripeCustomerId);
      }

      // Convert cart items to Stripe line items
      const lineItems = items.map((item: any) => ({
        price_data: {
          currency: STRIPE_CONFIG.currency,
          product_data: {
            name: item.name,
            description: item.description || `${item.name} - Wolf Mother Wellness`,
            metadata: {
              itemType: item.type, // 'membership' or 'punch_card'
              planType: item.planType || '',
              userId: user.id.toString(),
            }
          },
          unit_amount: formatAmountForStripe(item.price),
        },
        quantity: item.quantity || 1,
      }));

      const sessionConfig: any = {
        customer: stripeCustomerId,
        line_items: lineItems,
        mode,
        success_url: successUrl || `${req.headers.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${req.headers.origin}/checkout/cancel`,
        
        // Enable automatic tax collection
        automatic_tax: STRIPE_CONFIG.taxConfig.automaticTax,
        
        // Billing address collection for tax calculation
        billing_address_collection: STRIPE_CONFIG.taxConfig.billingAddressCollection,
        
        // Update customer with address information
        customer_update: STRIPE_CONFIG.taxConfig.customerUpdate,
        
        // Collect shipping address for more accurate tax calculation
        shipping_address_collection: STRIPE_CONFIG.taxConfig.shippingAddressCollection,
        
        // Metadata for tracking
        metadata: {
          userId: user.id.toString(),
          source: 'wolf_mother_wellness_checkout',
          environment: process.env.NODE_ENV || 'development',
        },
        
        // Allow promotion codes
        allow_promotion_codes: true,
      };

      const session = await stripe.checkout.sessions.create(sessionConfig);
      
      console.log('🛒 Checkout session created:', {
        sessionId: session.id,
        customer: stripeCustomerId,
        automaticTax: session.automatic_tax?.enabled,
        totalDetails: session.total_details,
      });
      
      res.json({ 
        sessionId: session.id,
        url: session.url,
        customer: stripeCustomerId,
        automaticTaxEnabled: session.automatic_tax?.enabled
      });
    } catch (error: any) {
      console.error('Failed to create checkout session:', error);
      res.status(500).json({ message: "Failed to create checkout session: " + error.message });
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

  // Search members for manual check-in (by name, email, phone, or membership ID)
  app.get("/api/admin/search-member", async (req, res) => {
    if (!req.isAuthenticated() || (req.user.role !== 'admin' && req.user.role !== 'staff')) {
      return res.sendStatus(403);
    }
    
    try {
      const { query } = req.query;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Search query required" });
      }

      const searchTerm = query.toLowerCase().trim();
      
      // Search users by name, email, or phone
      const users = await db
        .select()
        .from(usersTable)
        .where(
          or(
            sql`LOWER(${usersTable.firstName}) LIKE ${`%${searchTerm}%`}`,
            sql`LOWER(${usersTable.lastName}) LIKE ${`%${searchTerm}%`}`,
            sql`LOWER(${usersTable.email}) LIKE ${`%${searchTerm}%`}`,
            sql`${usersTable.phoneNumber} LIKE ${`%${searchTerm}%`}`
          )
        )
        .limit(10);

      // For each user, get their membership and day pass info
      const results = await Promise.all(users.map(async (user) => {
        const membership = await storage.getMembershipByUserId(user.id);
        const punchCards = await storage.getPunchCardsByUserId(user.id);
        
        const activeDayPasses = punchCards.filter(card => 
          card.status === 'active' && card.remainingPunches > 0
        );
        
        const totalDayPasses = activeDayPasses.reduce((sum, card) => sum + card.remainingPunches, 0);

        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          membership: membership ? {
            membershipId: membership.membershipId,
            planType: membership.planType,
            status: membership.status,
            endDate: membership.endDate
          } : null,
          dayPasses: {
            total: totalDayPasses,
            packages: activeDayPasses.map(card => ({
              id: card.id,
              name: `${card.totalPunches}-Visit Pass`,
              remaining: card.remainingPunches
            }))
          }
        };
      }));

      res.json(results);
    } catch (error: any) {
      console.error("Member search error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Manual check-in for staff (enhanced with day pass support)
  app.post("/api/admin/manual-checkin", async (req, res) => {
    if (!req.isAuthenticated() || (req.user.role !== 'admin' && req.user.role !== 'staff')) {
      return res.sendStatus(403);
    }
    
    try {
      const { userId, useDayPass } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Get user info
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Get membership
      const membership = await storage.getMembershipByUserId(userId);
      
      // Check if using day pass
      if (useDayPass) {
        const punchCards = await storage.getPunchCardsByUserId(userId);
        const activeDayPasses = punchCards.filter(card => 
          card.status === 'active' && card.remainingPunches > 0
        );
        
        if (activeDayPasses.length === 0) {
          return res.status(400).json({ message: "No day passes available" });
        }
        
        // Use the oldest day pass
        const oldestDayPass = activeDayPasses.sort((a, b) => 
          new Date(a.purchasedAt || new Date()).getTime() - new Date(b.purchasedAt || new Date()).getTime()
        )[0];
        
        await storage.usePunchCardEntry(oldestDayPass.id);
        
        // Create check-in record with day pass reference
        const checkIn = await storage.createCheckIn({
          userId: userId,
          membershipId: `day-pass-${oldestDayPass.id}`,
          location: 'Front Desk - Manual',
          method: 'manual'
        });

        return res.status(201).json({ 
          message: "Check-in successful using day pass",
          checkIn,
          member: { 
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email 
          },
          dayPassUsed: true,
          remainingPasses: oldestDayPass.remainingPunches - 1
        });
      }

      // Regular membership check-in
      if (!membership) {
        return res.status(404).json({ message: "Member has no membership" });
      }

      // Create check-in record  
      const checkIn = await storage.createCheckIn({
        userId: user.id,
        membershipId: membership.membershipId,
        location: 'Front Desk - Manual',
        method: 'manual'
      });

      res.status(201).json({ 
        message: "Check-in successful",
        checkIn,
        member: { 
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email 
        }
      });
    } catch (error: any) {
      console.error("Manual check-in error:", error);
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

  // Cart checkout with payment processing
  app.post("/api/checkout-with-payment", isAuthenticated, async (req, res) => {
    try {
      const { items, paymentMethodId, promoCode } = req.body;
      const userId = req.user!.id;

      if (!paymentMethodId) {
        return res.status(400).json({ message: "Payment method is required" });
      }

      // Calculate subtotal from authoritative pricing (fetch from database)
      let subtotal = 0;
      const validatedItems: Array<{ type: string; data: any; quantity: number; price: number }> = [];
      
      for (const item of items) {
        let itemPrice = 0;
        
        if (item.type === 'membership') {
          // Fetch authoritative membership plan pricing from database
          const plans = await storage.getAllMembershipPlans();
          const plan = plans.find(p => p.planType === item.data?.planType);
          
          if (!plan) {
            return res.status(400).json({ message: `Invalid membership plan: ${item.data?.planType}` });
          }
          
          itemPrice = plan.monthlyPrice;
          validatedItems.push({ type: 'membership', data: plan, quantity: 1, price: itemPrice });
        } else if (item.type === 'punch_card') {
          // Fetch authoritative punch card template pricing from database
          const templates = await storage.getAllPunchCardTemplates();
          const template = templates.find(t => t.id === item.data?.templateId);
          
          if (!template) {
            return res.status(400).json({ message: `Invalid punch card template: ${item.data?.templateId}` });
          }
          
          itemPrice = template.totalPrice;
          const quantity = item.quantity || 1;
          validatedItems.push({ type: 'punch_card', data: template, quantity, price: itemPrice });
          subtotal += itemPrice * quantity;
          continue; // Skip the subtotal addition below since we handled quantity here
        }
        
        subtotal += itemPrice;
      }

      // Validate and apply promo code discount (server-side)
      let discount = 0;
      let validatedPromo = null;
      if (promoCode && promoCode.code) {
        try {
          // Re-fetch promotion from database to ensure it's current and valid
          const promotion = await storage.getPromotionByCode(promoCode.code);
          
          if (!promotion) {
            return res.status(400).json({ message: "Invalid promo code" });
          }

          // Check if promotion is active
          if (!promotion.isActive) {
            return res.status(400).json({ message: "This promo code is no longer active" });
          }

          // Check if promotion is expired
          if (promotion.validUntil) {
            const expiryDate = new Date(promotion.validUntil);
            if (expiryDate < new Date()) {
              return res.status(400).json({ message: "This promo code has expired" });
            }
          }

          // Calculate discount based on type
          if (promotion.discountType === 'percentage') {
            discount = Math.round(subtotal * (promotion.discountValue / 100));
          } else if (promotion.discountType === 'fixed_amount') {
            discount = Math.min(promotion.discountValue, subtotal); // Cap discount at subtotal
          }

          validatedPromo = promotion;
        } catch (error) {
          console.error('Error validating promo code:', error);
          return res.status(400).json({ message: "Failed to validate promo code" });
        }
      }

      // Calculate final amount (subtotal - discount, minimum $0.50 for Stripe)
      const finalAmount = Math.max(50, subtotal - discount);

      // Build metadata
      const metadata: any = {
        userId: userId.toString(),
        itemCount: validatedItems.length.toString(),
        subtotal: subtotal.toString(),
        discount: discount.toString(),
        finalAmount: finalAmount.toString()
      };

      // Add validated promo code to metadata
      if (validatedPromo) {
        metadata.promoCode = validatedPromo.code;
        metadata.promoId = validatedPromo.id.toString();
        metadata.discountType = validatedPromo.discountType;
        metadata.discountValue = validatedPromo.discountValue.toString();
      }

      // Create payment intent with Stripe using server-calculated amount
      const paymentIntent = await stripe.paymentIntents.create({
        amount: finalAmount,
        currency: 'usd',
        customer: req.user!.stripeCustomerId || undefined,
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        },
        metadata
      });

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment failed" });
      }

      // Process validated items (create memberships/punch cards)
      const itemDescriptions: string[] = [];
      for (const validatedItem of validatedItems) {
        if (validatedItem.type === 'membership') {
          // Create or update membership using validated plan data
          const planData = validatedItem.data;
          const existingMembership = await storage.getMembershipByUserId(userId);
          
          const startDate = new Date().toISOString().split('T')[0];
          const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 1 year from now
          
          if (existingMembership) {
            // Update existing membership
            await storage.updateMembership(existingMembership.membershipId, {
              planType: planData.planType,
              status: 'active',
              startDate: startDate,
              endDate: endDate,
              autoRenew: true
            });
          } else {
            // Create new membership with generated ID
            await storage.createMembership({
              userId,
              membershipId: `mem_${userId}_${Date.now()}`,
              planType: planData.planType,
              status: 'active',
              startDate: startDate,
              endDate: endDate,
              autoRenew: true
            });
          }
          itemDescriptions.push(`${planData.name} - Monthly Membership`);
        } else if (validatedItem.type === 'punch_card') {
          // Create punch cards using validated template data
          const templateData = validatedItem.data;
          const quantity = validatedItem.quantity;
          
          for (let i = 0; i < quantity; i++) {
            await storage.createPunchCard({
              userId,
              templateId: templateData.id,
              name: templateData.name,
              totalPunches: templateData.totalPunches,
              remainingPunches: templateData.totalPunches,
              pricePerPunch: templateData.pricePerPunch,
              totalPrice: templateData.totalPrice,
              status: 'active'
            });
          }
          itemDescriptions.push(`${templateData.name} - Day Pass Package${quantity > 1 ? ` (x${quantity})` : ''}`);
        }
      }

      // Create single payment record with discounted amount
      const paymentDescription = itemDescriptions.join(', ') + (validatedPromo ? ` (Promo: ${validatedPromo.code})` : '');
      await storage.createPayment({
        userId,
        membershipId: "cart-purchase",
        amount: finalAmount, // Use the server-calculated discounted amount
        description: paymentDescription,
        status: "successful",
        method: "credit_card",
        stripePaymentIntentId: paymentIntent.id,
        stripePaymentMethodId: paymentMethodId,
        promoCode: validatedPromo?.code || undefined
      });

      res.json({ success: true, message: "Purchase completed successfully", paymentIntentId: paymentIntent.id });
    } catch (error: any) {
      console.error("Checkout with payment error:", error);
      res.status(500).json({ message: error.message || "Error processing checkout" });
    }
  });

  // Create HTTP server
  // Cart checkout endpoint (legacy - no payment processing)
  app.post("/api/checkout", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { items, totalAmount } = req.body;
      const userId = req.user.id;

      // Process each item in the cart
      for (const item of items) {
        if (item.type === 'membership') {
          // Create payment record for membership
          const planData = item.data;
          await storage.createPayment({
            userId,
            membershipId: "general-purchase",
            amount: planData.monthlyPrice,
            description: `${planData.name} - Monthly Membership`,
            status: "successful",
            method: "credit_card",
            stripePaymentIntentId: "cart_" + Date.now(),
            stripePaymentMethodId: "default"
          });
        } else if (item.type === 'punch_card') {
          // Create punch card
          const cardData = item.data;
          const quantity = item.quantity || 1;
          
          for (let i = 0; i < quantity; i++) {
            await storage.createPunchCard({
              userId,
              templateId: cardData.templateId || null,
              name: cardData.name,
              totalPunches: cardData.totalPunches,
              remainingPunches: cardData.totalPunches,
              pricePerPunch: cardData.pricePerPunch,
              totalPrice: cardData.totalPrice,
              status: 'active'
            });

            await storage.createPayment({
              userId,
              membershipId: "general-purchase",
              amount: cardData.totalPrice,
              description: `${cardData.name} - Day Pass Package`,
              status: "successful",
              method: "credit_card",
              stripePaymentIntentId: "cart_" + Date.now(),
              stripePaymentMethodId: "default"
            });
          }
        }
      }

      res.json({ success: true, message: "Purchase completed successfully" });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: "Error processing checkout: " + error.message });
    }
  });

  // SMS Password Reset - Request code
  app.post("/api/auth/reset-password/sms/request", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Find user by phone number
      const user = await storage.getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return res.status(404).json({ message: "No account found with this phone number" });
      }

      // Generate reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Create reset token in database
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await storage.createPasswordResetToken({
        userId: user.id,
        token: resetCode,
        method: 'sms',
        expiresAt,
        used: false
      });

      // Send SMS
      const message = `Your Wolf Mother Wellness password reset code is: ${resetCode}. This code expires in 15 minutes.`;
      // TODO: Implement SMS functionality
      console.log(`SMS would be sent to ${phoneNumber}: ${message}`);

      res.json({ message: "Reset code sent successfully" });
    } catch (error: any) {
      console.error("SMS reset request error:", error);
      res.status(500).json({ message: "Failed to send reset code" });
    }
  });

  // SMS Password Reset - Verify code and reset password
  app.post("/api/auth/reset-password/sms/verify", async (req, res) => {
    try {
      const { phoneNumber, code, newPassword } = req.body;
      
      if (!phoneNumber || !code || !newPassword) {
        return res.status(400).json({ message: "Phone number, code, and new password are required" });
      }

      // Find user by phone number
      const user = await storage.getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return res.status(404).json({ message: "No account found with this phone number" });
      }

      // Verify reset token
      const resetToken = await storage.getPasswordResetToken(code);
      if (!resetToken || resetToken.userId !== user.id || resetToken.used || resetToken.method !== 'sms') {
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "Reset code has expired" });
      }

      // Update password
      await storage.updateUserPassword(user.id, newPassword);
      
      // Mark token as used
      await storage.markTokenAsUsed(resetToken.id);

      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("SMS reset verification error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Landing page content routes (Admin only)
  app.get("/api/admin/landing-content", isAdmin, async (req, res) => {
    try {
      const content = await storage.getAllLandingPageContent();
      res.json(content);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/landing-content", isAdmin, async (req, res) => {
    try {
      const content = await storage.createLandingPageContent(req.body);
      res.status(201).json(content);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/landing-content/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const content = await storage.updateLandingPageContent(id, req.body);
      res.json(content);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/landing-content/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLandingPageContent(id);
      res.json({ message: "Content deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Promotion routes (Admin only)
  app.get("/api/admin/promotions", isAdmin, async (req, res) => {
    try {
      const promotions = await storage.getAllPromotions();
      res.json(promotions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/promotions", isAdmin, async (req, res) => {
    try {
      const validatedData = insertPromotionSchema.parse(req.body);
      const promotion = await storage.createPromotion(validatedData);
      res.status(201).json(promotion);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/promotions/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertPromotionSchema.parse(req.body);
      const promotion = await storage.updatePromotion(id, validatedData);
      res.json(promotion);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/promotions/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePromotion(id);
      res.json({ message: "Promotion deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Site settings route (Admin only)
  app.post("/api/admin/site-settings", isAdmin, async (req, res) => {
    try {
      const settings = req.body;
      const settingsToSave = [
        { section: 'footer', key: 'hoursOfOperation', value: settings.hoursOfOperation, isActive: true },
        { section: 'footer', key: 'hoursMembers', value: settings.hoursMembers, isActive: true },
        { section: 'footer', key: 'hoursDayPass', value: settings.hoursDayPass, isActive: true },
        { section: 'footer', key: 'address', value: settings.address, isActive: true },
        { section: 'footer', key: 'addressLine2', value: settings.addressLine2, isActive: true },
        { section: 'footer', key: 'copyrightYear', value: settings.copyrightYear, isActive: true },
        { section: 'footer', key: 'instagramHandle', value: settings.instagramHandle, isActive: true },
      ];

      // Delete existing footer settings
      const existingFooterSettings = await storage.getLandingPageContentBySection('footer');
      for (const setting of existingFooterSettings) {
        await storage.deleteLandingPageContent(setting.id);
      }

      // Create new settings
      for (const setting of settingsToSave) {
        await storage.createLandingPageContent(setting);
      }

      res.json({ message: 'Site settings saved successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public routes for landing page
  app.get("/api/promotions", async (req, res) => {
    try {
      const promotions = await storage.getActivePromotions();
      res.json(promotions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validate promo code
  app.post("/api/validate-promo-code", async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Promo code is required" });
      }

      // Get promotion by code
      const promotion = await storage.getPromotionByCode(code.toUpperCase());
      
      if (!promotion) {
        return res.status(404).json({ message: "Invalid promo code" });
      }

      // Check if promotion is active
      if (!promotion.isActive) {
        return res.status(400).json({ message: "This promo code is no longer active" });
      }

      // Check availability dates
      const now = new Date();
      if (promotion.availableFrom && new Date(promotion.availableFrom) > now) {
        return res.status(400).json({ message: "This promo code is not yet available" });
      }
      if (promotion.availableUntil && new Date(promotion.availableUntil) < now) {
        return res.status(400).json({ message: "This promo code has expired" });
      }

      // Return promotion details
      res.json({
        id: promotion.id,
        title: promotion.title,
        description: promotion.description,
        code: promotion.code,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        validUntil: promotion.validUntil,
      });
    } catch (error: any) {
      console.error("Promo code validation error:", error);
      res.status(500).json({ message: "Failed to validate promo code: " + error.message });
    }
  });

  app.get("/api/landing-content/:section", async (req, res) => {
    try {
      const section = req.params.section;
      const content = await storage.getLandingPageContentBySection(section);
      res.json(content);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Kiosk member creation endpoint
  app.post("/api/kiosk/create-member-payment", async (req, res) => {
    try {
      const { memberData, packageData } = req.body;
      console.log('🎫 Kiosk create-member-payment request:', { memberData, packageData });
      
      // Validate the request data
      const memberFormSchema = z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phoneNumber: z.string().optional(),
        packageType: z.enum(["membership", "daypass"]),
        packageId: z.string().min(1),
      });
      
      const validatedMemberData = memberFormSchema.parse(memberData);
      console.log('✅ Validated member data:', validatedMemberData);
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(validatedMemberData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(packageData.price * 100), // Convert to cents
        currency: 'usd',
        description: `${packageData.name} - ${validatedMemberData.firstName} ${validatedMemberData.lastName}`,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          memberFirstName: validatedMemberData.firstName,
          memberLastName: validatedMemberData.lastName,
          memberEmail: validatedMemberData.email,
          memberPhone: validatedMemberData.phoneNumber || '',
          packageType: validatedMemberData.packageType,
          packageId: validatedMemberData.packageId,
          packageName: packageData.name,
        },
      });
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id 
      });
    } catch (error: any) {
      console.error("Kiosk member creation error:", error);
      res.status(500).json({ message: "Failed to create member payment: " + error.message });
    }
  });

  // Confirm member creation after successful payment
  app.post("/api/kiosk/confirm-member-creation", async (req, res) => {
    try {
      const { paymentIntentId, memberData, packageData } = req.body;
      console.log('🔄 Kiosk confirm-member-creation request:', { paymentIntentId, memberData, packageData });
      
      // Verify payment was successful
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log('💳 Payment Intent status:', paymentIntent.status);
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment not completed" });
      }
      
      // Create the member account
      const salt = randomBytes(16).toString('hex');
      const tempPassword = Math.random().toString(36).slice(-8);
      const key = await scryptAsync(tempPassword, salt, 64) as Buffer;
      
      const newUser = await storage.createUser({
        username: memberData.email,
        email: memberData.email,
        password: `${key.toString('hex')}:${salt}`,
        firstName: memberData.firstName,
        lastName: memberData.lastName,
        phoneNumber: memberData.phoneNumber || undefined,
        role: 'member',
        membershipAgreementCompleted: false, // They'll need to complete agreement on first login
      });
      
      // Create membership or punch card based on package type
      if (memberData.packageType === 'membership') {
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        const membershipId = `WM-${Date.now()}-${Math.random().toString(36).slice(-4).toUpperCase()}`;
        
        await storage.createMembership({
          membershipId: membershipId,
          userId: newUser.id,
          planType: packageData.planType || 'basic',
          status: 'active',
          startDate: new Date().toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          autoRenew: true,
        });
      } else if (memberData.packageType === 'daypass') {
        await storage.createPunchCard({
          userId: newUser.id,
          templateId: parseInt(memberData.packageId),
          name: packageData.name || 'Day Pass Package',
          totalPunches: packageData.totalPunches || 5,
          remainingPunches: packageData.totalPunches || 5,
          pricePerPunch: Math.round((packageData.price || 2000) / (packageData.totalPunches || 5)),
          totalPrice: packageData.price || 2000,
          status: 'active',
        });
      }
      
      // Record the payment
      await storage.createPayment({
        userId: newUser.id,
        membershipId: memberData.packageType === 'membership' ? `WM-${Date.now()}-${Math.random().toString(36).slice(-4).toUpperCase()}` : 'punch-card',
        amount: packageData.price,
        description: `${packageData.name} - Kiosk Purchase`,
        status: 'successful',
        method: 'credit_card',
        stripePaymentIntentId: paymentIntent.id,
        stripePaymentMethodId: paymentIntent.payment_method as string,
      });
      
      console.log(`Successfully created member: ${memberData.firstName} ${memberData.lastName}`);
      
      res.json({ 
        message: "Member created successfully",
        user: {
          id: newUser.id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email
        }
      });
    } catch (error: any) {
      console.error("Member creation confirmation error:", error);
      res.status(500).json({ message: "Failed to create member: " + error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

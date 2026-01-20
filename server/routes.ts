import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import path from "path";
import fs from "fs";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { stripe, createStripeClient, STRIPE_CONFIG, formatAmountForStripe, formatAmountFromStripe, STRIPE_ENV_INFO } from "./stripe-config";
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
  insertGalleryImageSchema,
  createStaffAdminSchema,
  users as usersTable,
  memberships as membershipsTable,
  hoursOfOperation,
  insertHoursOfOperationSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve attached_assets as static files
  app.use("/attached_assets", express.static(path.join(process.cwd(), "attached_assets")));
  
  // Setup Stripe webhooks
  setupStripeWebhooks(app);
  
  // Setup authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);
  
  // File upload endpoint for gallery images (admin only) - MUST be after setupAuth
  app.post("/api/admin/upload-image", express.raw({ type: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/*'], limit: '10mb' }), async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.sendStatus(403);
    }
    
    try {
      const contentType = req.headers['content-type'] || 'image/jpeg';
      console.log('Upload request - Content-Type:', contentType, 'Body type:', typeof req.body, 'Body length:', req.body?.length || 0);
      
      // Check if body is valid
      if (!req.body || (Buffer.isBuffer(req.body) && req.body.length === 0)) {
        console.error('Upload error: Empty body received');
        return res.status(400).json({ message: 'No image data received. Please try again.' });
      }
      
      const extension = contentType.includes('png') ? 'png' : 
                       contentType.includes('gif') ? 'gif' : 
                       contentType.includes('webp') ? 'webp' : 'jpg';
      
      const filename = `gallery_${Date.now()}_${randomBytes(4).toString('hex')}.${extension}`;
      const uploadDir = path.join(process.cwd(), 'attached_assets', 'gallery');
      
      // Ensure gallery directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, req.body);
      
      console.log('Image uploaded successfully:', filePath);
      const imageUrl = `/attached_assets/gallery/${filename}`;
      res.json({ success: true, imageUrl });
    } catch (error: any) {
      console.error('Image upload error:', error);
      res.status(500).json({ message: 'Failed to upload image: ' + error.message });
    }
  });

  // Expose Stripe public key to frontend
  app.get("/api/stripe/config", (req, res) => {
    res.json({ publicKey: STRIPE_ENV_INFO.publicKey });
  });

  // ============================================
  // STRIPE TERMINAL ROUTES (for card reader)
  // ============================================
  
  // Create connection token for Stripe Terminal JS SDK
  // This endpoint needs to be public for the kiosk to initialize the Terminal SDK
  app.post("/api/stripe/terminal/connection-token", async (req, res) => {
    try {
      const connectionToken = await stripe.terminal.connectionTokens.create();
      res.json({ secret: connectionToken.secret });
    } catch (error: any) {
      console.error("Failed to create Terminal connection token:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin-only: List registered card readers
  app.get("/api/stripe/terminal/readers", async (req, res) => {
    if (!req.isAuthenticated() || !['admin', 'staff'].includes(req.user?.role || '')) {
      return res.sendStatus(403);
    }
    try {
      const readers = await stripe.terminal.readers.list({ limit: 10 });
      res.json({ readers: readers.data });
    } catch (error: any) {
      console.error("Failed to list Terminal readers:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin-only: Get or create Terminal location
  app.get("/api/stripe/terminal/location", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.sendStatus(403);
    }
    try {
      const locations = await stripe.terminal.locations.list({ limit: 1 });
      
      if (locations.data.length > 0) {
        res.json({ location: locations.data[0] });
      } else {
        const location = await stripe.terminal.locations.create({
          display_name: 'Wolf Mother Wellness - Front Desk',
          address: {
            line1: '123 Wellness Way',
            city: 'Austin',
            state: 'TX',
            postal_code: '78701',
            country: 'US',
          },
        });
        res.json({ location });
      }
    } catch (error: any) {
      console.error("Failed to get/create Terminal location:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // ONE-TIME ADMIN SETUP ROUTES (for production)
  // ============================================
  
  // Check if initial admin setup is needed
  app.get("/api/setup/status", async (req, res) => {
    try {
      const adminCount = await db.select({ count: sql<number>`count(*)` })
        .from(usersTable)
        .where(eq(usersTable.role, 'admin'));
      
      const hasAdmin = Number(adminCount[0]?.count || 0) > 0;
      res.json({ setupRequired: !hasAdmin, hasAdmin });
    } catch (error) {
      console.error("Error checking setup status:", error);
      res.status(500).json({ message: "Failed to check setup status" });
    }
  });

  // Create the first admin account (only works when no admins exist)
  // Uses a transaction with atomic check to prevent race conditions
  app.post("/api/setup/admin", async (req, res) => {
    try {
      // Validate input first (before transaction)
      const setupSchema = z.object({
        email: z.string().email("Please enter a valid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
      });

      const adminData = setupSchema.parse(req.body);
      
      // Hash password before transaction
      const hashedPassword = await hashPassword(adminData.password);
      
      // Generate username from email
      const baseUsername = adminData.email.split('@')[0].toLowerCase();

      // Use a transaction to atomically check and create admin
      const result = await db.transaction(async (tx) => {
        // Check if any admin exists (within transaction)
        const adminCount = await tx.select({ count: sql<number>`count(*)` })
          .from(usersTable)
          .where(eq(usersTable.role, 'admin'));
        
        if (Number(adminCount[0]?.count || 0) > 0) {
          throw new Error("ADMIN_EXISTS");
        }

        // Check if email already exists
        const existingEmail = await tx.select()
          .from(usersTable)
          .where(eq(usersTable.email, adminData.email))
          .limit(1);
        
        if (existingEmail.length > 0) {
          throw new Error("EMAIL_EXISTS");
        }

        // Check for unique username within transaction
        let username = baseUsername;
        let counter = 1;
        while (true) {
          const existingUsername = await tx.select()
            .from(usersTable)
            .where(eq(usersTable.username, username))
            .limit(1);
          
          if (existingUsername.length === 0) break;
          username = `${baseUsername}_${counter}`;
          counter++;
        }

        // Insert the admin user
        const [newAdmin] = await tx.insert(usersTable).values({
          email: adminData.email,
          password: hashedPassword,
          firstName: adminData.firstName,
          lastName: adminData.lastName,
          username: username,
          role: 'admin',
        }).returning();

        return newAdmin;
      });

      console.log(`✅ Initial admin account created: ${adminData.email}`);

      const { password, ...adminWithoutPassword } = result;
      res.status(201).json({
        message: "Admin account created successfully! You can now log in.",
        user: adminWithoutPassword,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Validation failed" });
      }
      if (error.message === "ADMIN_EXISTS") {
        return res.status(409).json({ 
          message: "Admin setup already completed. This endpoint is disabled." 
        });
      }
      if (error.message === "EMAIL_EXISTS") {
        return res.status(400).json({ message: "Email already exists" });
      }
      console.error("Error creating initial admin:", error);
      res.status(500).json({ message: "Failed to create admin account" });
    }
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

  // Admin or Staff middleware
  const isAdminOrStaff = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && (req.user.role === 'admin' || req.user.role === 'staff')) {
      return next();
    }
    res.status(403).json({ message: "Forbidden" });
  };

  // Admin-only: Create staff or admin account
  app.post("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const staffAdminData = createStaffAdminSchema.parse(req.body);
      
      const existingEmail = await storage.getUserByEmail(staffAdminData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(staffAdminData.password);
      
      const user = await storage.createStaffAdmin({
        ...staffAdminData,
        password: hashedPassword,
      });

      const { password, ...userWithoutPassword } = user;
      res.status(201).json({
        message: "User created successfully",
        user: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error("Error creating staff/admin account:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Admin-only: List all staff and admin accounts
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.listStaffAdmins();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error listing staff/admin accounts:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin-only: Update staff or admin account
  app.patch("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const existingUser = await storage.getUser(userId);
      if (!existingUser || (existingUser.role !== 'staff' && existingUser.role !== 'admin')) {
        return res.status(404).json({ message: "Staff/Admin user not found" });
      }

      const updateData: any = {};
      
      if (req.body.email !== undefined && req.body.email !== existingUser.email) {
        const emailTaken = await storage.getUserByEmail(req.body.email);
        if (emailTaken && emailTaken.id !== userId) {
          return res.status(400).json({ message: "Email already exists" });
        }
        updateData.email = req.body.email;
      }
      
      if (req.body.firstName !== undefined) updateData.firstName = req.body.firstName;
      if (req.body.lastName !== undefined) updateData.lastName = req.body.lastName;
      if (req.body.phoneNumber !== undefined) updateData.phoneNumber = req.body.phoneNumber;
      if (req.body.role !== undefined && (req.body.role === 'staff' || req.body.role === 'admin')) {
        updateData.role = req.body.role;
      }
      if (req.body.mustChangePassword !== undefined) updateData.mustChangePassword = req.body.mustChangePassword;
      
      if (req.body.password) {
        updateData.password = await hashPassword(req.body.password);
      }

      const updatedUser = await storage.updateStaffAdmin(userId, updateData);
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json({
        message: "User updated successfully",
        user: userWithoutPassword,
      });
    } catch (error) {
      console.error("Error updating staff/admin account:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Admin-only: Delete staff or admin account
  app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const existingUser = await storage.getUser(userId);
      if (!existingUser || (existingUser.role !== 'staff' && existingUser.role !== 'admin')) {
        return res.status(404).json({ message: "Staff/Admin user not found" });
      }

      // Prevent admin from deleting themselves
      if (userId === req.user!.id) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }

      await storage.deleteStaffAdmin(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting staff/admin account:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin-only: Get staff login history
  app.get("/api/admin/login-events", isAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      
      let events;
      if (userId) {
        events = await storage.getLoginEventsByUserId(userId, limit);
        const eventsWithUser = await Promise.all(
          events.map(async (event) => {
            const user = await storage.getUser(event.userId);
            const { password, ...userWithoutPassword } = user || {};
            return { ...event, user: userWithoutPassword };
          })
        );
        res.json(eventsWithUser);
      } else {
        events = await storage.getAllStaffLoginEvents(limit);
        const eventsWithoutPasswords = events.map(({ user, ...event }) => ({
          ...event,
          user: user ? { ...user, password: undefined } : undefined,
        }));
        res.json(eventsWithoutPasswords);
      }
    } catch (error) {
      console.error("Error fetching login events:", error);
      res.status(500).json({ message: "Failed to fetch login events" });
    }
  });

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
  
  // Get subscription billing info from Stripe
  app.get("/api/membership/billing-info", isAuthenticated, async (req, res) => {
    try {
      const membership = await storage.getMembershipByUserId(req.user!.id);
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }
      
      // If there's no Stripe subscription, return the database endDate
      if (!membership.stripeSubscriptionId) {
        return res.json({
          nextBillingDate: membership.endDate,
          source: 'database'
        });
      }
      
      // Fetch subscription from Stripe to get the actual next billing date
      try {
        const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
        
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          // Type assertion for current_period_end since Stripe types don't always expose it
          const currentPeriodEnd = (subscription as any).current_period_end as number;
          const nextBillingDate = new Date(currentPeriodEnd * 1000).toISOString().split('T')[0];
          return res.json({
            nextBillingDate,
            source: 'stripe',
            subscriptionStatus: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end
          });
        } else {
          // Subscription not active, return database date
          return res.json({
            nextBillingDate: membership.endDate,
            source: 'database',
            subscriptionStatus: subscription.status
          });
        }
      } catch (stripeError: any) {
        console.error("Error fetching Stripe subscription:", stripeError.message);
        // Fall back to database date if Stripe fails
        return res.json({
          nextBillingDate: membership.endDate,
          source: 'database',
          error: stripeError.message
        });
      }
    } catch (error: any) {
      console.error("Billing info error:", error);
      res.status(500).json({ message: "Failed to get billing info: " + error.message });
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

      // If there's a Stripe subscription, cancel it first
      if (membership.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.del(membership.stripeSubscriptionId);
          console.log(`Cancelled Stripe subscription: ${membership.stripeSubscriptionId}`);
        } catch (stripeError: any) {
          // Log but don't fail if Stripe cancellation fails (subscription might already be cancelled)
          console.error("Stripe subscription cancellation error:", stripeError.message);
          // Only fail if it's not a "subscription not found" error
          if (stripeError.code !== 'resource_missing') {
            throw stripeError;
          }
        }
      }

      // Update membership status to cancelled
      await storage.updateMembership(membership.membershipId, { 
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

  // Update membership plan (Admin only) - auto-syncs with Stripe
  app.put("/api/admin/membership-plans/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertMembershipPlanSchema.partial().parse(req.body);
      let plan = await storage.updateMembershipPlan(id, validatedData);
      
      // Auto-sync with Stripe
      try {
        const freshStripe = createStripeClient();
        let productId = plan.stripeProductId;
        let priceId = plan.stripePriceId;
        
        // Create or update Stripe Product
        if (!productId) {
          const product = await freshStripe.products.create({
            name: plan.name,
            description: plan.description,
            metadata: {
              planType: plan.planType,
              planId: plan.id.toString(),
            },
          });
          productId = product.id;
        } else {
          // Update existing product
          await freshStripe.products.update(productId, {
            name: plan.name,
            description: plan.description,
          });
        }
        
        // Check if price changed and create new price if needed
        if (priceId) {
          const existingPrice = await freshStripe.prices.retrieve(priceId);
          if (existingPrice.unit_amount !== plan.monthlyPrice) {
            // Archive old price and create new one
            await freshStripe.prices.update(priceId, { active: false });
            const newPrice = await freshStripe.prices.create({
              product: productId,
              unit_amount: plan.monthlyPrice,
              currency: 'usd',
              recurring: { interval: 'month' },
              metadata: {
                planType: plan.planType,
                planId: plan.id.toString(),
              },
            });
            priceId = newPrice.id;
          }
        } else {
          // Create new price
          const price = await freshStripe.prices.create({
            product: productId,
            unit_amount: plan.monthlyPrice,
            currency: 'usd',
            recurring: { interval: 'month' },
            metadata: {
              planType: plan.planType,
              planId: plan.id.toString(),
            },
          });
          priceId = price.id;
        }
        
        // Update plan with Stripe IDs (only update the specific fields)
        plan = await storage.updateMembershipPlan(plan.id, {
          stripeProductId: productId,
          stripePriceId: priceId,
        });
        console.log('Plan synced with Stripe:', { productId, priceId });
      } catch (stripeError: any) {
        console.error('Failed to sync with Stripe:', stripeError.message);
      }
      
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

  // Create or update membership plan (admin-only endpoint) - auto-syncs with Stripe
  app.post("/api/admin/membership-plans", isAdmin, async (req, res) => {
    console.log('POST /api/admin/membership-plans hit with body:', req.body);
    try {
      const validatedData = insertMembershipPlanSchema.parse(req.body);
      console.log('Validated data:', validatedData);
      let plan = await storage.createOrUpdateMembershipPlan(validatedData);
      console.log('Created plan:', plan);
      
      // Auto-sync with Stripe
      try {
        const freshStripe = createStripeClient();
        let productId = plan.stripeProductId;
        let priceId = plan.stripePriceId;
        
        // Create Stripe Product if it doesn't exist
        if (!productId) {
          const product = await freshStripe.products.create({
            name: plan.name,
            description: plan.description,
            metadata: {
              planType: plan.planType,
              planId: plan.id.toString(),
            },
          });
          productId = product.id;
        }
        
        // Create Stripe Price if it doesn't exist
        if (!priceId) {
          const price = await freshStripe.prices.create({
            product: productId,
            unit_amount: plan.monthlyPrice,
            currency: 'usd',
            recurring: { interval: 'month' },
            metadata: {
              planType: plan.planType,
              planId: plan.id.toString(),
            },
          });
          priceId = price.id;
        }
        
        // Update plan with Stripe IDs (only update the specific fields)
        plan = await storage.updateMembershipPlan(plan.id, {
          stripeProductId: productId,
          stripePriceId: priceId,
        });
        console.log('Plan synced with Stripe:', { productId, priceId });
      } catch (stripeError: any) {
        console.error('Failed to sync with Stripe:', stripeError.message);
        // Don't fail the request, just log the error - admin can manually sync later
      }
      
      res.status(201).json(plan);
    } catch (error) {
      console.error('Membership plan creation error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Kiosk member search by email, name, or membership ID - returns multiple results for dropdown
  app.get("/api/kiosk/search-member", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Search query required" });
      }

      const searchTerm = query.toLowerCase().trim();
      const results: Array<{
        id: number;
        firstName: string;
        lastName: string;
        email: string;
        membershipId: string | null;
        membershipStatus: string;
        dayPassesRemaining: number;
      }> = [];
      
      // Search by email or name (partial match)
      const users = await db
        .select()
        .from(usersTable)
        .where(
          or(
            sql`LOWER(${usersTable.email}) LIKE ${`%${searchTerm}%`}`,
            sql`LOWER(${usersTable.firstName}) LIKE ${`%${searchTerm}%`}`,
            sql`LOWER(${usersTable.lastName}) LIKE ${`%${searchTerm}%`}`,
            sql`LOWER(CONCAT(${usersTable.firstName}, ' ', ${usersTable.lastName})) LIKE ${`%${searchTerm}%`}`
          )
        )
        .limit(10);
      
      // Also search by partial membership ID match
      const membershipMatches = await db
        .select({ userId: membershipsTable.userId })
        .from(membershipsTable)
        .where(sql`LOWER(${membershipsTable.membershipId}) LIKE ${`%${searchTerm}%`}`)
        .limit(10);
      
      // Add users found by membership ID if not already in results
      for (const match of membershipMatches) {
        if (!users.find(u => u.id === match.userId)) {
          const user = await db.select().from(usersTable).where(eq(usersTable.id, match.userId)).limit(1);
          if (user[0]) {
            users.push(user[0]);
          }
        }
      }
      
      // Get membership and day pass info for each user
      for (const user of users) {
        const membership = await storage.getMembershipByUserId(user.id);
        const punchCards = await storage.getPunchCardsByUserId(user.id);
        const activeDayPasses = punchCards.filter(card => 
          card.status === 'active' && card.remainingPunches > 0
        );
        const dayPassesRemaining = activeDayPasses.reduce((sum, card) => sum + card.remainingPunches, 0);
        
        let membershipStatus = 'none';
        if (membership?.status === 'active') {
          membershipStatus = 'active';
        } else if (dayPassesRemaining > 0) {
          membershipStatus = 'day-pass';
        } else if (membership?.status) {
          membershipStatus = membership.status;
        }
        
        results.push({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          membershipId: membership?.membershipId || null,
          membershipStatus,
          dayPassesRemaining
        });
      }

      res.json({ members: results });
    } catch (error: any) {
      console.error("Kiosk member search error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Kiosk check-in using membership ID from QR code or user ID for day pass users
  app.post("/api/kiosk-check-in", async (req, res) => {
    try {
      const { membershipId, userId, useDayPass } = req.body;
      
      if (!membershipId && !userId) {
        return res.status(400).json({ 
          success: false,
          message: "Membership ID or User ID is required" 
        });
      }

      // Find user by membership ID or user ID
      let user;
      if (membershipId) {
        user = await storage.getUserByMembershipId(membershipId);
      } else if (userId) {
        user = await storage.getUser(userId);
      }
      
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

      // Helper function to parse time string to minutes since midnight
      const parseTimeToMinutes = (timeStr: string): number => {
        // Handle various formats: "7:00 AM", "7 AM", "7:00AM", "14:00", etc.
        const normalized = timeStr.trim().toUpperCase();
        const isPM = normalized.includes('PM');
        const isAM = normalized.includes('AM');
        const cleaned = normalized.replace(/\s?(AM|PM)/gi, '').trim();
        
        let hours: number, minutes: number = 0;
        
        if (cleaned.includes(':')) {
          const parts = cleaned.split(':');
          hours = parseInt(parts[0], 10) || 0;
          minutes = parseInt(parts[1], 10) || 0;
        } else {
          hours = parseInt(cleaned, 10) || 0;
        }
        
        // Convert 12-hour to 24-hour format
        if (isPM && hours !== 12) {
          hours += 12;
        } else if (isAM && hours === 12) {
          hours = 0;
        }
        
        return hours * 60 + minutes;
      };

      const now = new Date();
      const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
      
      // Determine if user is using a day pass (explicitly or implicitly)
      const hasActiveMembership = membership && membership.status === 'active';
      const hasDayPasses = activeDayPasses.length > 0;
      const willUseDayPass = useDayPass === true || (!hasActiveMembership && hasDayPasses);
      
      // Day pass users (explicit choice or day-pass-only users) must check in during day pass hours
      if (willUseDayPass) {
        const dayPassHoursConfig = await storage.getDayPassHours();
        
        if (dayPassHoursConfig && dayPassHoursConfig.isEnabled) {
          const dayPassStart = parseTimeToMinutes(dayPassHoursConfig.startTime);
          const dayPassEnd = parseTimeToMinutes(dayPassHoursConfig.endTime);
          
          if (currentTimeMinutes < dayPassStart || currentTimeMinutes >= dayPassEnd) {
            return res.status(400).json({
              success: false,
              message: `Day pass check-in is only available during open hours: ${dayPassHoursConfig.startTime} - ${dayPassHoursConfig.endTime}. Please come back during these hours.`
            });
          }
        }
        // Day pass hours check passed or not configured - allow check-in
      }
      // Members with active membership can check in anytime - no booking requirement
      
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

      // Mark session booking as checked in if sessions are enabled and user is a member
      if (!usedDayPass && membership && membership.status === 'active') {
        const allSessionConfigs = await storage.getAllSessionConfigs();
        const enabledSessionsForCheckin = allSessionConfigs.filter(s => s.isEnabled);
        
        if (enabledSessionsForCheckin.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const nowTime = new Date();
          const currentTimeMin = nowTime.getHours() * 60 + nowTime.getMinutes();
          
          for (const session of enabledSessionsForCheckin) {
            const sessionStartMinutes = parseTimeToMinutes(session.startTime);
            const sessionEndMinutes = parseTimeToMinutes(session.endTime);
            
            if (currentTimeMin >= sessionStartMinutes && currentTimeMin < sessionEndMinutes) {
              // Mark this session booking as checked in
              await storage.markSessionBookingCheckedIn(user.id, today, session.sessionType as 'morning' | 'evening');
              break;
            }
          }
        }
      }

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
          id: user.id,
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

  // Kiosk: Get available inventory items for member self-checkout
  app.get("/api/kiosk/inventory-items", async (req, res) => {
    try {
      const items = await storage.getAllInventoryItems();
      // Only return active items with available quantity
      const availableItems = items.filter(item => item.isActive && item.quantityAvailable > 0);
      res.json(availableItems);
    } catch (error: any) {
      console.error("Kiosk inventory items error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Kiosk: Member self-checkout item (no payment for free items, or with saved card)
  app.post("/api/kiosk/checkout-item", async (req, res) => {
    try {
      const checkoutDataSchema = z.object({
        userId: z.number().int().positive(),
        itemId: z.number().int().positive(),
      });
      const validatedData = checkoutDataSchema.parse(req.body);
      
      // Verify the user exists
      const user = await storage.getUser(validatedData.userId);
      if (!user) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      // Get the item
      const items = await storage.getAllInventoryItems();
      const item = items.find(i => i.id === validatedData.itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      if (!item.isActive || item.quantityAvailable <= 0) {
        return res.status(400).json({ message: "Item is not available" });
      }
      
      // If item has a price, check for saved payment method
      if (item.priceInCents && item.priceInCents > 0) {
        // Get user's payment methods
        const paymentMethods = await storage.getPaymentMethodsByUserId(validatedData.userId);
        const defaultMethod = paymentMethods.find(pm => pm.isDefault) || paymentMethods[0];
        
        if (!user.stripeCustomerId || !defaultMethod) {
          return res.status(400).json({ 
            message: "No payment method on file. Please see staff for assistance.",
            requiresPayment: true,
            priceInCents: item.priceInCents
          });
        }
        
        // Attempt to charge the card first before creating checkout
        try {
          const freshStripe = createStripeClient();
          const paymentIntent = await freshStripe.paymentIntents.create({
            amount: item.priceInCents,
            currency: 'usd',
            customer: user.stripeCustomerId,
            payment_method: defaultMethod.stripePaymentMethodId,
            off_session: true,
            confirm: true,
            description: `Kiosk item checkout: ${item.name}${item.size ? ` (${item.size})` : ''}`,
            metadata: {
              itemId: item.id.toString(),
              userId: validatedData.userId.toString(),
              itemName: item.name,
              source: 'kiosk'
            }
          });
          
          // Payment succeeded - now create checkout record
          const checkout = await storage.checkoutItem({
            itemId: validatedData.itemId,
            userId: validatedData.userId,
            checkedOutByStaffId: validatedData.userId,
            notes: "Self-checkout via kiosk"
          });
          
          // Update checkout with payment info
          await storage.updateCheckoutPayment(checkout.id, {
            paymentStatus: 'charged',
            stripePaymentIntentId: paymentIntent.id,
            chargedAmountCents: paymentIntent.amount,
          });
          
          res.status(201).json({
            success: true,
            checkout,
            charged: true,
            amountCharged: item.priceInCents,
            message: `${item.name} checked out successfully! $${(item.priceInCents / 100).toFixed(2)} charged to your card.`
          });
        } catch (stripeError: any) {
          console.error("Kiosk checkout payment error:", stripeError);
          // Payment failed before checkout was created - no cleanup needed
          const errorMessage = stripeError.code === 'authentication_required' 
            ? "Card requires authentication. Please see staff for assistance."
            : stripeError.code === 'card_declined'
            ? "Card was declined. Please see staff for assistance."
            : "Payment failed. Please see staff for assistance.";
          
          return res.status(400).json({ 
            success: false,
            message: errorMessage,
            requiresStaffAssistance: true
          });
        }
      } else {
        // Free item - just checkout without payment (use userId as staff ID for self-checkout)
        const checkout = await storage.checkoutItem({
          itemId: validatedData.itemId,
          userId: validatedData.userId,
          checkedOutByStaffId: validatedData.userId,
          notes: "Self-checkout via kiosk (free item)"
        });
        
        res.status(201).json({
          success: true,
          checkout,
          charged: false,
          message: `${item.name} checked out successfully!`
        });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Kiosk checkout error:", error);
      res.status(400).json({ message: error.message });
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

  // Download member's membership agreement PDF (Admin only)
  app.get("/api/admin/members/:id/agreement-pdf", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const user = await storage.getUserById(memberId);
      
      if (!user) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      if (!user.membershipAgreementCompleted) {
        return res.status(400).json({ message: "No membership agreement found for this member" });
      }

      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Wolf_Mother_Wellness_Agreement_${user.firstName}_${user.lastName}.pdf`);
      
      doc.pipe(res);

      doc.fontSize(24).font('Helvetica-Bold').text('Wolf Mother Wellness', { align: 'center' });
      doc.fontSize(16).font('Helvetica').text('Membership Agreement & Waiver', { align: 'center' });
      doc.moveDown();
      
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      doc.fontSize(14).font('Helvetica-Bold').text('Member Information');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Name: ${user.firstName} ${user.lastName}`);
      doc.text(`Email: ${user.email}`);
      doc.text(`Phone: ${user.phoneNumber || 'Not provided'}`);
      doc.text(`Date of Birth: ${user.dateOfBirth || 'Not provided'}`);
      doc.text(`Address: ${user.address || 'Not provided'}`);
      doc.moveDown();

      doc.fontSize(14).font('Helvetica-Bold').text('Emergency Contact');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Contact Name: ${user.emergencyContact || 'Not provided'}`);
      doc.text(`Contact Phone: ${user.emergencyPhone || 'Not provided'}`);
      doc.moveDown();

      doc.fontSize(14).font('Helvetica-Bold').text('Agreement Details');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Membership Type: ${user.preferredMembershipType || 'Standard'}`);
      doc.text(`Agreement Date: ${user.membershipAgreementDate ? new Date(user.membershipAgreementDate).toLocaleDateString() : 'Not available'}`);
      doc.moveDown();

      doc.fontSize(14).font('Helvetica-Bold').text('Acknowledgments & Agreements');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      
      const acknowledgments = [
        'I certify that I am in good physical health and have no medical conditions that would prevent safe participation.',
        'I have consulted with a healthcare provider if I have any health concerns.',
        'I understand and accept the inherent risks of thermal wellness activities.',
        'I confirm I am not pregnant or will notify staff if I become pregnant.',
        'I voluntarily choose to participate in thermal wellness activities.',
        'I assume all risks associated with using the facilities.',
        'I release Wolf Mother Wellness from liability for any injuries.',
        'I agree to follow all facility rules and guidelines.',
        'I will behave respectfully toward staff and other members.',
        'I acknowledge the privacy policy and consent to necessary emergency medical treatment.',
        'I confirm I am 18 years of age or older.'
      ];

      acknowledgments.forEach((ack, index) => {
        doc.text(`${index + 1}. ${ack}`);
        doc.moveDown(0.3);
      });

      doc.moveDown();

      doc.fontSize(14).font('Helvetica-Bold').text('Digital Signature');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Signed by: ${user.firstName} ${user.lastName}`);
      doc.text(`Date: ${user.membershipAgreementDate ? new Date(user.membershipAgreementDate).toLocaleDateString() : new Date().toLocaleDateString()}`);
      doc.text('This document was signed electronically and is legally binding.');
      
      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').fillColor('gray');
      doc.text('Wolf Mother Wellness - Thermal Wellness Center', { align: 'center' });
      doc.text('This agreement is valid as of the signature date above.', { align: 'center' });

      doc.end();
    } catch (error: any) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: "Failed to generate PDF" });
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

  // Sync membership plans with Stripe Products/Prices
  app.post("/api/admin/membership-plans/sync-stripe", isAdmin, async (req, res) => {
    try {
      const freshStripe = createStripeClient();
      const plans = await storage.getAllMembershipPlans();
      const results = [];

      for (const plan of plans) {
        try {
          let productId = plan.stripeProductId;
          let priceId = plan.stripePriceId;

          // Create or update Stripe Product
          if (!productId) {
            const product = await freshStripe.products.create({
              name: plan.name,
              description: plan.description,
              metadata: {
                planType: plan.planType,
                planId: plan.id.toString(),
              },
            });
            productId = product.id;
          } else {
            // Update existing product
            await freshStripe.products.update(productId, {
              name: plan.name,
              description: plan.description,
            });
          }

          // Create new Stripe Price (prices are immutable, so we create a new one if price changed)
          // Check if we need a new price
          let needNewPrice = !priceId;
          if (priceId) {
            const existingPrice = await freshStripe.prices.retrieve(priceId);
            if (existingPrice.unit_amount !== plan.monthlyPrice) {
              // Price changed, archive old one and create new
              await freshStripe.prices.update(priceId, { active: false });
              needNewPrice = true;
            }
          }

          if (needNewPrice) {
            const price = await freshStripe.prices.create({
              product: productId,
              unit_amount: plan.monthlyPrice,
              currency: 'usd',
              recurring: { interval: 'month' },
              metadata: {
                planType: plan.planType,
                planId: plan.id.toString(),
              },
            });
            priceId = price.id;
          }

          // Update database with Stripe IDs
          await storage.updateMembershipPlan(plan.id, {
            ...plan,
            stripeProductId: productId,
            stripePriceId: priceId,
          });

          results.push({ planId: plan.id, planType: plan.planType, productId, priceId, status: 'synced' });
        } catch (error: any) {
          results.push({ planId: plan.id, planType: plan.planType, status: 'error', error: error.message });
        }
      }

      res.json({ message: 'Stripe sync completed', results });
    } catch (error: any) {
      console.error('Failed to sync with Stripe:', error);
      res.status(500).json({ message: "Failed to sync with Stripe: " + error.message });
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

  // Public endpoint for punch card templates (day passes) - for packages page
  app.get("/api/punch-card-templates", async (req, res) => {
    try {
      const templates = await storage.getAllPunchCardTemplates();
      // Filter to only return active templates
      const activeTemplates = templates.filter(t => t.isActive);
      res.json(activeTemplates);
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

  // Create setup intent for adding new payment method (standalone card storage)
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

  // Create checkout session - uses Subscriptions for memberships, PaymentIntent for day passes
  app.post("/api/stripe/create-payment-intent", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { items, promoCode } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ message: "Cart items are required" });
      }

      // Separate memberships from day passes
      const membershipItems = items.filter((i: any) => i.type === 'membership');
      const dayPassItems = items.filter((i: any) => i.type === 'punch_card');

      // For now, only allow one type per checkout to simplify
      if (membershipItems.length > 0 && dayPassItems.length > 0) {
        return res.status(400).json({ 
          message: "Please checkout memberships and day passes separately" 
        });
      }

      const freshStripe = createStripeClient();

      // Ensure user has Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await freshStripe.customers.create({
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

      // MEMBERSHIPS: Use Stripe Subscriptions with SetupIntent-first flow
      if (membershipItems.length > 0) {
        const item = membershipItems[0];
        const plans = await storage.getAllMembershipPlans();
        const plan = plans.find(p => p.planType === item.data?.planType);
        
        if (!plan) {
          return res.status(400).json({ message: `Invalid membership plan: ${item.data?.planType}` });
        }

        if (!plan.stripePriceId) {
          return res.status(400).json({ 
            message: "Membership plan not configured for payments. Admin needs to sync with Stripe." 
          });
        }

        // Check if user already has an active subscription for this plan
        const existingMembership = await storage.getMembershipByUserId(user.id);
        if (existingMembership?.stripeSubscriptionId) {
          // Check if subscription is active in Stripe
          try {
            const existingSub = await freshStripe.subscriptions.retrieve(existingMembership.stripeSubscriptionId);
            if (existingSub.status === 'active' || existingSub.status === 'trialing') {
              return res.status(400).json({ 
                message: "You already have an active subscription. Please manage it from your dashboard." 
              });
            }
          } catch (e) {
            // Subscription doesn't exist anymore, proceed
          }
        }

        // Verify price exists in Stripe before creating subscription
        try {
          const stripePrice = await freshStripe.prices.retrieve(plan.stripePriceId);
          console.log('Verified Stripe price exists:', {
            priceId: stripePrice.id,
            active: stripePrice.active,
            productId: stripePrice.product,
            unitAmount: stripePrice.unit_amount,
          });
          
          if (!stripePrice.active) {
            console.error('Stripe price is inactive:', plan.stripePriceId);
            return res.status(400).json({ 
              message: "This membership plan is currently unavailable. Please contact support." 
            });
          }
        } catch (priceError: any) {
          console.error('Stripe price verification failed:', {
            error: priceError.message,
            code: priceError.code,
            priceId: plan.stripePriceId,
          });
          return res.status(400).json({ 
            message: `Membership plan configuration error: ${priceError.message}. Please contact support.` 
          });
        }

        // Check for saved payment method - if user has one, we can use it for the subscription
        const savedPaymentMethods = await storage.getPaymentMethodsByUserId(user.id);
        const defaultPaymentMethod = savedPaymentMethods.find(pm => pm.isDefault) || savedPaymentMethods[0];
        
        console.log('Creating Stripe subscription:', {
          customerId,
          priceId: plan.stripePriceId,
          planType: plan.planType,
          planName: plan.name,
          userId: user.id,
          hasDefaultPaymentMethod: !!defaultPaymentMethod,
        });

        // If user has a saved payment method, attach it to customer and use for subscription
        let paymentMethodToUse: string | undefined;
        
        if (defaultPaymentMethod?.stripePaymentMethodId) {
          try {
            // Ensure payment method is attached to customer
            await freshStripe.paymentMethods.attach(defaultPaymentMethod.stripePaymentMethodId, {
              customer: customerId,
            });
          } catch (attachError: any) {
            // May already be attached, that's fine
            if (attachError.code !== 'resource_already_exists') {
              console.log('Payment method already attached or error:', attachError.message);
            }
          }
          
          // Set as customer's default payment method
          await freshStripe.customers.update(customerId, {
            invoice_settings: {
              default_payment_method: defaultPaymentMethod.stripePaymentMethodId,
            },
          });
          
          paymentMethodToUse = defaultPaymentMethod.stripePaymentMethodId;
          console.log('Using saved payment method:', paymentMethodToUse);
        }

        let subscription;
        try {
          const subscriptionParams: any = {
            customer: customerId,
            items: [{ price: plan.stripePriceId }],
            collection_method: 'charge_automatically',
            payment_behavior: 'default_incomplete',
            payment_settings: {
              payment_method_types: ['card'],
              save_default_payment_method: 'on_subscription',
            },
            expand: ['latest_invoice.payment_intent'],
            metadata: {
              userId: user.id.toString(),
              planType: plan.planType,
              planId: plan.id.toString(),
            },
          };
          
          // If we have a saved payment method, use it as default
          if (paymentMethodToUse) {
            subscriptionParams.default_payment_method = paymentMethodToUse;
          }
          
          subscription = await freshStripe.subscriptions.create(subscriptionParams);
        } catch (stripeError: any) {
          console.error('Stripe subscription creation failed:', {
            error: stripeError.message,
            code: stripeError.code,
            type: stripeError.type,
            priceId: plan.stripePriceId,
            customerId,
          });
          return res.status(400).json({ 
            message: `Failed to create subscription: ${stripeError.message}. Please contact support.` 
          });
        }

        let invoice = subscription.latest_invoice as any;
        let paymentIntent = invoice?.payment_intent;

        console.log('Subscription created with invoice:', {
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          invoiceId: invoice?.id,
          invoiceStatus: invoice?.status,
          paymentIntentId: paymentIntent?.id,
          paymentIntentStatus: paymentIntent?.status,
          hasClientSecret: !!paymentIntent?.client_secret,
          defaultPaymentMethod: subscription.default_payment_method,
        });

        // If we have a PaymentIntent client secret, return it for confirmation
        if (paymentIntent?.client_secret) {
          console.log('Returning invoice PaymentIntent for confirmation');
          return res.json({
            type: 'subscription',
            clientSecret: paymentIntent.client_secret,
            subscriptionId: subscription.id,
            paymentIntentId: paymentIntent.id,
            amount: plan.monthlyPrice,
          });
        }

        // If invoice is open but no PaymentIntent, try to pay it with the saved payment method
        if (paymentMethodToUse && invoice?.id && invoice.status === 'open') {
          console.log('Attempting to pay open invoice with saved payment method...');
          
          try {
            const paidInvoice = await freshStripe.invoices.pay(invoice.id, {
              payment_method: paymentMethodToUse,
            });
            
            console.log('Invoice paid successfully:', {
              invoiceId: paidInvoice.id,
              status: paidInvoice.status,
            });
            
            // Retrieve updated subscription
            const updatedSubscription = await freshStripe.subscriptions.retrieve(subscription.id);
            
            return res.json({
              type: 'subscription',
              subscriptionId: subscription.id,
              subscriptionStatus: updatedSubscription.status,
              invoiceId: paidInvoice.id,
              amount: plan.monthlyPrice,
              alreadyPaid: true, // Flag indicating payment was processed with saved card
            });
          } catch (payError: any) {
            console.error('Failed to pay invoice with saved method:', {
              error: payError.message,
              code: payError.code,
            });
            // Continue to fallback flow
          }
        }

        // Fallback: Create a SetupIntent so user can provide payment method
        // This handles the case where no saved payment method exists
        console.log('No payment method available, returning SetupIntent for card collection...');
        
        const setupIntent = await freshStripe.setupIntents.create({
          customer: customerId,
          payment_method_types: ['card'],
          metadata: {
            userId: user.id.toString(),
            subscriptionId: subscription.id,
            planType: plan.planType,
            flow: 'subscription_setup',
          },
        });
        
        return res.json({
          type: 'subscription_setup',
          clientSecret: setupIntent.client_secret,
          subscriptionId: subscription.id,
          amount: plan.monthlyPrice,
          requiresPaymentMethod: true, // Flag indicating card collection is needed first
        });
      }

      // DAY PASSES: Use one-time PaymentIntent
      if (dayPassItems.length > 0) {
        let subtotal = 0;
        for (const item of dayPassItems) {
          const templates = await storage.getAllPunchCardTemplates();
          // Support both templateId and id (frontend passes whole template object with .id)
          const templateId = item.data?.templateId || item.data?.id;
          const template = templates.find(t => t.id === templateId);
          if (!template) {
            return res.status(400).json({ message: `Invalid day pass: ${templateId}` });
          }
          const quantity = item.quantity || 1;
          subtotal += template.totalPrice * quantity;
        }

        // Apply promo code discount if provided
        let discount = 0;
        if (promoCode && promoCode.code) {
          const promotion = await storage.getPromotionByCode(promoCode.code.toUpperCase());
          if (promotion && promotion.isActive && promotion.discountValue !== null) {
            if (promotion.discountType === 'percentage') {
              discount = Math.round(subtotal * (promotion.discountValue / 100));
            } else {
              discount = promotion.discountValue;
            }
          }
        }

        const totalAmount = Math.max(subtotal - discount, 0);

        if (totalAmount < 50) {
          return res.status(400).json({ message: "Minimum charge amount is $0.50" });
        }

        const paymentIntent = await freshStripe.paymentIntents.create({
          amount: totalAmount,
          currency: 'usd',
          customer: customerId,
          setup_future_usage: 'off_session',
          automatic_payment_methods: {
            enabled: true,
          },
          metadata: {
            userId: user.id.toString(),
            itemCount: dayPassItems.length.toString(),
            type: 'day_pass',
          },
        });

        console.log('Created PaymentIntent for day passes:', paymentIntent.id, 'Amount:', totalAmount);

        return res.json({
          type: 'payment_intent',
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: totalAmount,
        });
      }

      return res.status(400).json({ message: "No valid items in cart" });
    } catch (error: any) {
      console.error('Failed to create checkout:', error);
      res.status(500).json({ message: "Failed to create checkout: " + error.message });
    }
  });

  // Finalize order after successful payment
  app.post("/api/stripe/finalize-order", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { paymentIntentId, subscriptionId, items, promoCode, type } = req.body;

      console.log('Finalize order request:', { paymentIntentId, subscriptionId, type, userId: user.id });

      const freshStripe = createStripeClient();
      
      // Track resolved payment identifiers for recording payments
      let resolvedPaymentMethodId: string | undefined;
      let resolvedPaymentIntentId: string | undefined;
      
      // Helper to resolve payment identifiers from a subscription's invoice
      const resolvePaymentIdsFromSubscription = async (subId: string): Promise<{ intentId: string; methodId: string } | null> => {
        try {
          const sub = await freshStripe.subscriptions.retrieve(subId, {
            expand: ['latest_invoice.payment_intent'],
          });
          const invoice = sub.latest_invoice as any;
          const pi = invoice?.payment_intent;
          
          if (!pi || !pi.id) {
            console.log('No payment intent on invoice');
            return null;
          }
          
          const methodId = pi.payment_method as string || sub.default_payment_method as string;
          
          if (!methodId) {
            console.log('No payment method found on payment intent or subscription');
            return null;
          }
          
          return { intentId: pi.id, methodId };
        } catch (e: any) {
          console.error('Failed to resolve payment IDs from subscription:', e.message);
          return null;
        }
      };

      // Handle subscription_setup_complete flow - card was collected via SetupIntent
      if (type === 'subscription_setup_complete' && subscriptionId) {
        console.log('Completing subscription with new payment method:', { 
          paymentMethodId: paymentIntentId, // In this flow, paymentIntentId is actually the payment_method ID
          subscriptionId,
          userId: user.id 
        });
        
        const paymentMethodId = paymentIntentId;
        
        // Ensure customer has the payment method and it's set as default
        let customerId = user.stripeCustomerId;
        if (!customerId) {
          const customer = await freshStripe.customers.create({
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
          });
          customerId = customer.id;
          await storage.updateUserStripeCustomerId(user.id, customerId);
        }
        
        // Attach payment method to customer
        try {
          await freshStripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
        } catch (attachError: any) {
          if (attachError.code !== 'resource_already_exists') {
            console.log('Payment method already attached or error:', attachError.message);
          }
        }
        
        // Set as customer's default
        await freshStripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
        
        // Update subscription to use this payment method
        await freshStripe.subscriptions.update(subscriptionId, {
          default_payment_method: paymentMethodId,
        });
        
        // Save the payment method locally
        const paymentMethod = await freshStripe.paymentMethods.retrieve(paymentMethodId);
        if (paymentMethod.card) {
          const existingMethods = await storage.getPaymentMethodsByUserId(user.id);
          const isDefault = existingMethods.length === 0;
          const existingMethod = existingMethods.find(m => m.stripePaymentMethodId === paymentMethod.id);
          
          if (!existingMethod) {
            await storage.createPaymentMethod({
              userId: user.id,
              stripePaymentMethodId: paymentMethod.id,
              cardLast4: paymentMethod.card.last4,
              cardBrand: paymentMethod.card.brand,
              cardExpMonth: paymentMethod.card.exp_month,
              cardExpYear: paymentMethod.card.exp_year,
              isDefault
            });
          }
        }
        
        // Now pay the subscription's pending invoice (only if still open and not already paid)
        const subscriptionForInvoice = await freshStripe.subscriptions.retrieve(subscriptionId, {
          expand: ['latest_invoice.payment_intent'],
        });
        
        const invoiceForPayment = subscriptionForInvoice.latest_invoice as any;
        console.log('Invoice state for SetupIntent completion:', {
          invoiceId: invoiceForPayment?.id,
          invoiceStatus: invoiceForPayment?.status,
          paymentIntentStatus: invoiceForPayment?.payment_intent?.status,
          invoicePaymentMethod: invoiceForPayment?.payment_intent?.payment_method,
          expectedPaymentMethod: paymentMethodId,
        });
        
        // Only pay if invoice is still open and hasn't been paid yet
        if (invoiceForPayment?.id && invoiceForPayment.status === 'open') {
          // Check if the PaymentIntent is already succeeded (avoid duplicate charge)
          const existingPiStatus = invoiceForPayment.payment_intent?.status;
          if (existingPiStatus !== 'succeeded') {
            console.log('Paying subscription invoice with collected card:', invoiceForPayment.id);
            await freshStripe.invoices.pay(invoiceForPayment.id, { payment_method: paymentMethodId });
          } else {
            console.log('Invoice PaymentIntent already succeeded, skipping manual pay');
          }
        } else if (invoiceForPayment?.status === 'paid') {
          console.log('Invoice already paid, continuing to activation');
        }
        
        // Resolve payment identifiers from the subscription's invoice
        const setupIds = await resolvePaymentIdsFromSubscription(subscriptionId);
        if (setupIds) {
          resolvedPaymentIntentId = setupIds.intentId;
          resolvedPaymentMethodId = setupIds.methodId;
        } else {
          // Fallback: use the payment method we just attached
          resolvedPaymentMethodId = paymentMethodId;
          resolvedPaymentIntentId = invoiceForPayment?.payment_intent?.id || `setup_${subscriptionId}`;
          console.log('Using fallback payment IDs for SetupIntent flow:', { 
            resolvedPaymentMethodId, 
            resolvedPaymentIntentId 
          });
        }
        
        // Continue to activate membership below
      }
      
      // Handle saved card payment flow - already paid during create-payment-intent
      if (paymentIntentId === 'saved_card_payment' && subscriptionId) {
        console.log('Finalizing saved card subscription:', { subscriptionId, userId: user.id });
        
        // Use the helper to resolve payment identifiers
        const savedCardIds = await resolvePaymentIdsFromSubscription(subscriptionId);
        
        if (savedCardIds) {
          resolvedPaymentIntentId = savedCardIds.intentId;
          resolvedPaymentMethodId = savedCardIds.methodId;
          console.log('Resolved payment IDs from saved card subscription:', {
            resolvedPaymentIntentId,
            resolvedPaymentMethodId,
          });
        } else {
          // Fallback: create reference identifiers for tracking
          console.error('Could not resolve payment IDs for saved card subscription - using fallback references');
          resolvedPaymentIntentId = `saved_card_${subscriptionId}`;
          resolvedPaymentMethodId = `subscription_${subscriptionId}`;
        }
      } else if (type !== 'subscription_setup_complete') {
        // Normal PaymentIntent flow - verify payment succeeded
        const paymentIntent = await freshStripe.paymentIntents.retrieve(paymentIntentId);
        console.log('Payment intent status:', paymentIntent.status);
        
        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({ message: "Payment has not been completed" });
        }
        
        // Set resolved identifiers from the PaymentIntent
        resolvedPaymentIntentId = paymentIntent.id;
        resolvedPaymentMethodId = paymentIntent.payment_method as string | undefined;

        // Save the payment method from the successful payment
        if (paymentIntent.payment_method) {
          const paymentMethod = await freshStripe.paymentMethods.retrieve(paymentIntent.payment_method as string);
          
          if (paymentMethod.card) {
            const existingMethods = await storage.getPaymentMethodsByUserId(user.id);
            const isDefault = existingMethods.length === 0;
            
            const existingMethod = existingMethods.find(m => m.stripePaymentMethodId === paymentMethod.id);
            
            if (!existingMethod) {
              await storage.createPaymentMethod({
                userId: user.id,
                stripePaymentMethodId: paymentMethod.id,
                cardLast4: paymentMethod.card.last4,
                cardBrand: paymentMethod.card.brand,
                cardExpMonth: paymentMethod.card.exp_month,
                cardExpYear: paymentMethod.card.exp_year,
                isDefault
              });
            }
          }
        }
      }

      // Handle SUBSCRIPTION (membership) orders
      if ((type === 'subscription' || type === 'subscription_setup_complete') && subscriptionId) {
        console.log('Finalizing subscription order:', { subscriptionId, paymentIntentId, userId: user.id });
        
        // Retry logic for subscription retrieval (Stripe might need a moment to process)
        let subscription;
        let lastError;
        const maxRetries = 3;
        const retryDelay = 1000; // 1 second
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            subscription = await freshStripe.subscriptions.retrieve(subscriptionId);
            console.log('Retrieved subscription (attempt', attempt, '):', { 
              id: subscription.id, 
              status: subscription.status,
              currentPeriodEnd: (subscription as any).current_period_end
            });
            break; // Success, exit loop
          } catch (subError: any) {
            lastError = subError;
            console.error(`Failed to retrieve subscription (attempt ${attempt}/${maxRetries}):`, subError.message, subError.code);
            
            if (attempt < maxRetries) {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
          }
        }
        
        if (!subscription) {
          console.error('All subscription retrieval attempts failed:', lastError?.message);
          return res.status(400).json({ 
            message: `Failed to retrieve subscription after ${maxRetries} attempts: ${lastError?.message}. The payment was processed but membership activation failed. Please contact support with subscription ID: ${subscriptionId}` 
          });
        }
        
        // Guard: Check subscription is in a valid state for activation
        // After paying the invoice, subscription might still be incomplete - that's OK for manual flow
        const validStatuses = ['active', 'trialing', 'incomplete'];
        if (!validStatuses.includes(subscription.status)) {
          console.error('Subscription in unexpected state:', { 
            status: subscription.status, 
            subscriptionId,
            paymentIntentId 
          });
          return res.status(400).json({ 
            message: `Subscription is in '${subscription.status}' state and cannot be activated yet. If your payment was successful, please wait a moment and refresh. Contact support if this persists.` 
          });
        }
        
        const planType = subscription.metadata?.planType as any;
        console.log('Subscription metadata:', subscription.metadata);
        
        const plans = await storage.getAllMembershipPlans();
        console.log('Available plans:', plans.map(p => ({ id: p.id, planType: p.planType, name: p.name })));
        
        const plan = plans.find(p => p.planType === planType);

        if (!plan) {
          console.error('Plan not found for planType:', planType);
          return res.status(400).json({ 
            message: `Membership plan '${planType}' not found. Please contact support.` 
          });
        }

        if (plan) {
          const existingMembership = await storage.getMembershipByUserId(user.id);
          
          // Calculate end date from subscription period (current_period_end is on the raw subscription object)
          const currentPeriodEnd = (subscription as any).current_period_end;
          const endDate = currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const startDate = new Date().toISOString().split('T')[0];
          
          if (existingMembership) {
            await storage.updateMembership(existingMembership.membershipId, {
              planType: plan.planType,
              status: 'active',
              startDate,
              endDate,
              stripeSubscriptionId: subscriptionId,
              autoRenew: true,
            });
          } else {
            await storage.createMembership({
              membershipId: `MEM-${Date.now()}`,
              planType: plan.planType,
              status: 'active',
              startDate,
              endDate,
              autoRenew: true,
              stripeSubscriptionId: subscriptionId,
              userId: user.id
            });
          }
          
          // Use the already-resolved payment identifiers (set earlier in the flow)
          // Fall back to subscription defaults only if not already resolved
          const finalPaymentIntentId = resolvedPaymentIntentId || paymentIntentId || `sub_${subscriptionId}`;
          const finalPaymentMethodId = resolvedPaymentMethodId || subscription.default_payment_method as string || `sub_method_${subscriptionId}`;
          
          console.log('Recording subscription payment with identifiers:', {
            finalPaymentIntentId,
            finalPaymentMethodId,
            resolvedPaymentIntentId,
            resolvedPaymentMethodId,
          });
          
          await storage.createPayment({
            userId: user.id,
            membershipId: subscriptionId,
            amount: plan.monthlyPrice,
            description: `${plan.name} - Monthly Subscription`,
            status: "successful",
            method: "credit_card",
            stripePaymentIntentId: finalPaymentIntentId,
            stripePaymentMethodId: finalPaymentMethodId
          });
        }

        return res.json({ success: true, message: "Subscription activated successfully" });
      }

      // Handle DAY PASS (one-time) orders
      for (const item of items) {
        if (item.type === 'punch_card') {
          const templates = await storage.getAllPunchCardTemplates();
          // Support both templateId and id (frontend passes whole template object with .id)
          const templateId = item.data?.templateId || item.data?.id;
          const template = templates.find(t => t.id === templateId);
          
          if (template) {
            const quantity = item.quantity || 1;
            
            for (let i = 0; i < quantity; i++) {
              await storage.createPunchCard({
                userId: user.id,
                templateId: template.id,
                name: template.name,
                totalPunches: template.totalPunches,
                remainingPunches: template.totalPunches,
                pricePerPunch: template.pricePerPunch,
                totalPrice: template.totalPrice,
                status: 'active'
              });

              await storage.createPayment({
                userId: user.id,
                membershipId: "day-pass-purchase",
                amount: template.totalPrice,
                description: `${template.name} - Day Pass Package`,
                status: "successful",
                method: "credit_card",
                stripePaymentIntentId: resolvedPaymentIntentId || paymentIntentId,
                stripePaymentMethodId: resolvedPaymentMethodId || "default"
              });
            }
          }
        }
      }

      res.json({ success: true, message: "Order finalized successfully" });
    } catch (error: any) {
      console.error('Failed to finalize order:', error);
      res.status(500).json({ message: "Failed to finalize order: " + error.message });
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

  // Get active day pass holders (admin only)
  app.get("/api/admin/day-pass-holders", isAdmin, async (req, res) => {
    try {
      const holders = await storage.getActiveDayPassHolders();
      res.json(holders);
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
      const body = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
        endDate: req.body.endDate ? new Date(req.body.endDate) : null
      };
      const validatedData = insertNotificationSchema.parse(body);
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
      const body = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : (req.body.endDate === null ? null : undefined)
      };
      const notification = await storage.updateNotification(id, body);
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
          // Support both templateId and id (frontend passes whole template object with .id)
          const templateId = item.data?.templateId || item.data?.id;
          const template = templates.find(t => t.id === templateId);
          
          if (!template) {
            return res.status(400).json({ message: `Invalid punch card template: ${templateId}` });
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
          if (promotion.discountValue !== null) {
            if (promotion.discountType === 'percentage') {
              discount = Math.round(subtotal * (promotion.discountValue / 100));
            } else if (promotion.discountType === 'fixed_amount') {
              discount = Math.min(promotion.discountValue, subtotal); // Cap discount at subtotal
            }
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
        metadata.discountValue = validatedPromo.discountValue !== null ? validatedPromo.discountValue.toString() : '0';
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
        stripePaymentMethodId: paymentMethodId
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

  // Hours of Operation routes (Admin only)
  app.get("/api/admin/hours-of-operation", isAdmin, async (req, res) => {
    try {
      const hours = await db.select().from(hoursOfOperation);
      res.json(hours);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/hours-of-operation/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertHoursOfOperationSchema.parse(req.body);
      
      const [updated] = await db
        .update(hoursOfOperation)
        .set(validatedData)
        .where(eq(hoursOfOperation.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Hours not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Public hours of operation endpoint
  app.get("/api/hours-of-operation", async (req, res) => {
    try {
      const hours = await db.select().from(hoursOfOperation);
      res.json(hours);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SESSION MANAGEMENT ROUTES
  // ============================================

  // Admin: Get all session configurations
  app.get("/api/admin/sessions", isAdmin, async (req, res) => {
    try {
      const sessions = await storage.getAllSessionConfigs();
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update session configuration
  app.put("/api/admin/sessions/:type", isAdmin, async (req, res) => {
    try {
      const sessionType = req.params.type as 'morning' | 'evening';
      if (!['morning', 'evening'].includes(sessionType)) {
        return res.status(400).json({ message: "Invalid session type" });
      }
      
      const { startTime, endTime, capacity, isEnabled } = req.body;
      const updated = await storage.updateSessionConfig(sessionType, {
        startTime,
        endTime,
        capacity,
        isEnabled
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public: Get session configurations (for landing page and member dashboard)
  app.get("/api/sessions", async (req, res) => {
    try {
      const sessions = await storage.getAllSessionConfigs();
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public: Get day pass hours (for landing page)
  app.get("/api/day-pass-hours", async (req, res) => {
    try {
      const hours = await storage.getDayPassHours();
      res.json(hours || { startTime: '10:00 AM', endTime: '5:00 PM', isEnabled: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update day pass hours
  app.put("/api/admin/day-pass-hours", isAdmin, async (req, res) => {
    try {
      const { startTime, endTime, isEnabled } = req.body;
      const updated = await storage.updateDayPassHours({ startTime, endTime, isEnabled });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get all session bookings with member details
  app.get("/api/admin/session-bookings", isAdminOrStaff, async (req, res) => {
    try {
      const fromDate = req.query.fromDate as string | undefined;
      const bookings = await storage.getAllSessionBookingsWithUsers(fromDate);
      res.json(bookings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Cancel a session booking
  app.delete("/api/admin/session-bookings/:id", isAdminOrStaff, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const cancelled = await storage.cancelSessionBooking(bookingId);
      res.json(cancelled);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Member: Get my session bookings
  app.get("/api/session-bookings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    try {
      const bookings = await storage.getSessionBookingsByUserId(req.user!.id);
      res.json(bookings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Member: Book a session
  app.post("/api/session-bookings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    try {
      const { sessionType, bookingDate } = req.body;
      
      if (!['morning', 'evening'].includes(sessionType)) {
        return res.status(400).json({ message: "Invalid session type" });
      }
      
      // Check if user already has a booking for this session
      const hasBooking = await storage.hasUserBookedSession(req.user!.id, bookingDate, sessionType);
      if (hasBooking) {
        return res.status(400).json({ message: "You already have a booking for this session" });
      }
      
      // Check capacity
      const availability = await storage.getSessionAvailability(bookingDate, sessionType);
      if (availability.booked >= availability.capacity) {
        return res.status(400).json({ message: "This session is fully booked" });
      }
      
      // Check if session is enabled
      const config = await storage.getSessionConfigByType(sessionType);
      if (!config || !config.isEnabled) {
        return res.status(400).json({ message: "This session is not available" });
      }
      
      const booking = await storage.createSessionBooking({
        userId: req.user!.id,
        sessionType,
        bookingDate,
        status: 'confirmed'
      });
      
      res.status(201).json(booking);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Member: Cancel a session booking
  app.delete("/api/session-bookings/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    try {
      const bookingId = parseInt(req.params.id);
      
      // Verify the booking belongs to this user
      const booking = await storage.getSessionBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (booking.userId !== req.user!.id) {
        return res.status(403).json({ message: "You can only cancel your own bookings" });
      }
      
      const cancelled = await storage.cancelSessionBooking(bookingId);
      res.json(cancelled);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get session availability for a specific date
  app.get("/api/sessions/availability", async (req, res) => {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ message: "Date is required" });
      }
      
      const [morningAvail, eveningAvail] = await Promise.all([
        storage.getSessionAvailability(date as string, 'morning'),
        storage.getSessionAvailability(date as string, 'evening')
      ]);
      
      const [morningConfig, eveningConfig] = await Promise.all([
        storage.getSessionConfigByType('morning'),
        storage.getSessionConfigByType('evening')
      ]);
      
      res.json({
        morning: {
          ...morningAvail,
          startTime: morningConfig?.startTime,
          endTime: morningConfig?.endTime,
          isEnabled: morningConfig?.isEnabled ?? false
        },
        evening: {
          ...eveningAvail,
          startTime: eveningConfig?.startTime,
          endTime: eveningConfig?.endTime,
          isEnabled: eveningConfig?.isEnabled ?? false
        }
      });
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

  // Gallery image routes (Admin)
  app.get("/api/admin/gallery-images", isAdmin, async (req, res) => {
    try {
      const images = await storage.getAllGalleryImages();
      res.json(images);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/gallery-images", isAdmin, async (req, res) => {
    try {
      const validatedData = insertGalleryImageSchema.parse(req.body);
      const image = await storage.createGalleryImage(validatedData);
      res.status(201).json(image);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/gallery-images/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const image = await storage.updateGalleryImage(id, req.body);
      res.json(image);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/gallery-images/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteGalleryImage(id);
      res.json({ message: "Gallery image deleted successfully" });
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

  // Admin inventory management routes
  app.get("/api/admin/inventory/items", isAdmin, async (req, res) => {
    try {
      const items = await storage.getAllInventoryItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/inventory/items", isAdmin, async (req, res) => {
    try {
      const { insertInventoryItemSchema } = await import("@shared/schema");
      const validatedData = insertInventoryItemSchema.parse(req.body);
      const item = await storage.createInventoryItem(validatedData);
      res.status(201).json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/inventory/items/:id", isAdmin, async (req, res) => {
    try {
      const { insertInventoryItemSchema } = await import("@shared/schema");
      const id = parseInt(req.params.id);
      const validatedData = insertInventoryItemSchema.partial().parse(req.body);
      const item = await storage.updateInventoryItem(id, validatedData);
      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/inventory/items/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteInventoryItem(id);
      res.json({ message: "Item deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Staff checkout routes
  const isStaffOrAdmin = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && (req.user.role === 'staff' || req.user.role === 'admin')) {
      return next();
    }
    res.status(403).json({ message: "Forbidden" });
  };

  // Staff member search for item checkout
  app.get("/api/staff/search-members", isStaffOrAdmin, async (req, res) => {
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

      // For each user, get their membership info
      const results = await Promise.all(users.map(async (user) => {
        const membership = await storage.getMembershipByUserId(user.id);
        
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
          } : null,
        };
      }));

      res.json(results);
    } catch (error: any) {
      console.error("Staff member search error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/staff/inventory/items", isStaffOrAdmin, async (req, res) => {
    try {
      const items = await storage.getAllInventoryItems();
      res.json(items.filter(item => item.isActive));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/staff/checkouts/active", isStaffOrAdmin, async (req, res) => {
    try {
      const checkouts = await storage.getActiveCheckouts();
      res.json(checkouts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/staff/checkouts", isStaffOrAdmin, async (req, res) => {
    try {
      const checkoutDataSchema = z.object({
        itemId: z.number().int().positive(),
        userId: z.number().int().positive(),
        quantity: z.number().int().positive().default(1),
        notes: z.string().optional(),
        paymentIntentId: z.string().optional(),
      });
      const validatedData = checkoutDataSchema.parse(req.body);
      const quantity = validatedData.quantity || 1;
      
      // Get the item to check availability and price
      const item = await storage.getInventoryItemById(validatedData.itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      if (item.quantityAvailable < quantity) {
        return res.status(400).json({ message: `Only ${item.quantityAvailable} available` });
      }
      
      // Create checkout records for each quantity
      const checkouts = [];
      for (let i = 0; i < quantity; i++) {
        const checkout = await storage.checkoutItem({
          itemId: validatedData.itemId,
          userId: validatedData.userId,
          notes: validatedData.notes,
          checkedOutByStaffId: req.user!.id
        });
        
        // If payment was made, update the checkout with payment info
        if (validatedData.paymentIntentId && item.priceInCents > 0) {
          await storage.updateCheckoutPayment(checkout.id, {
            paymentStatus: 'charged',
            stripePaymentIntentId: validatedData.paymentIntentId,
            chargedAmountCents: item.priceInCents,
          });
        }
        
        checkouts.push(checkout);
      }
      
      res.status(201).json({
        checkouts,
        quantity,
        charged: !!validatedData.paymentIntentId,
        chargedAmount: validatedData.paymentIntentId ? item.priceInCents * quantity : 0,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(400).json({ message: error.message });
    }
  });
  
  // Create payment intent for item checkout (before creating checkout record)
  app.post("/api/staff/item-checkout-payment-intent", isStaffOrAdmin, async (req, res) => {
    try {
      const schema = z.object({
        userId: z.number().int().positive(),
        itemId: z.number().int().positive(),
        quantity: z.number().int().positive().default(1),
      });
      const { userId, itemId, quantity } = schema.parse(req.body);
      
      const item = await storage.getInventoryItemById(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      if (item.priceInCents <= 0) {
        return res.status(400).json({ message: "This item has no price" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const totalAmount = item.priceInCents * quantity;
      
      const freshStripe = createStripeClient();
      const paymentIntent = await freshStripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd',
        description: `Item checkout: ${quantity}x ${item.name}${item.size ? ` (${item.size})` : ''} for ${user.firstName} ${user.lastName}`,
        metadata: {
          userId: userId.toString(),
          itemId: itemId.toString(),
          quantity: quantity.toString(),
          type: 'item_checkout',
        },
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Create item checkout payment intent error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Charge saved payment method for item checkout
  app.post("/api/staff/item-checkout-charge-saved", isStaffOrAdmin, async (req, res) => {
    try {
      const schema = z.object({
        userId: z.number().int().positive(),
        itemId: z.number().int().positive(),
        quantity: z.number().int().positive().default(1),
      });
      const { userId, itemId, quantity } = schema.parse(req.body);
      
      const item = await storage.getInventoryItemById(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      if (item.priceInCents <= 0) {
        return res.status(400).json({ message: "This item has no price" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get user's saved payment method
      const paymentMethods = await storage.getPaymentMethodsByUserId(userId);
      const defaultMethod = paymentMethods.find(pm => pm.isDefault) || paymentMethods[0];
      
      if (!defaultMethod || !defaultMethod.stripePaymentMethodId) {
        return res.status(400).json({ message: "No saved payment method found for this member" });
      }
      
      // Get or create Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      const freshStripe = createStripeClient();
      
      if (!stripeCustomerId) {
        // Create a new Stripe customer
        const customer = await freshStripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: { userId: userId.toString() },
        });
        stripeCustomerId = customer.id;
        await storage.updateUser(userId, { stripeCustomerId });
      }
      
      const totalAmount = item.priceInCents * quantity;
      
      // Create and confirm payment intent using saved payment method
      const paymentIntent = await freshStripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method: defaultMethod.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        description: `Item checkout: ${quantity}x ${item.name}${item.size ? ` (${item.size})` : ''} for ${user.firstName} ${user.lastName}`,
        metadata: {
          userId: userId.toString(),
          itemId: itemId.toString(),
          quantity: quantity.toString(),
          type: 'item_checkout',
        },
      });
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment failed. Card may need re-authentication." });
      }
      
      res.json({ 
        paymentIntentId: paymentIntent.id,
        amountCharged: totalAmount,
      });
    } catch (error: any) {
      console.error("Charge saved card for item checkout error:", error);
      
      // Handle specific Stripe errors
      if (error.code === 'authentication_required') {
        return res.status(400).json({ message: "Card requires authentication. Please use a new card." });
      }
      
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/staff/checkouts/:id/checkin", isStaffOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const checkinDataSchema = z.object({
        notes: z.string().optional()
      });
      const validatedData = checkinDataSchema.parse(req.body);
      const checkout = await storage.checkinItem(id, req.user!.id, validatedData.notes);
      res.json(checkout);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(400).json({ message: error.message });
    }
  });

  // Check if a member has a saved payment method (for staff checkout UI)
  app.get("/api/staff/members/:userId/payment-status", isStaffOrAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const paymentMethods = await storage.getPaymentMethodsByUserId(userId);
      const defaultMethod = paymentMethods.find(pm => pm.isDefault) || paymentMethods[0];

      res.json({
        hasPaymentMethod: !!defaultMethod,
        paymentMethod: defaultMethod ? {
          cardLast4: defaultMethod.cardLast4,
          cardBrand: defaultMethod.cardBrand,
        } : null,
      });
    } catch (error: any) {
      console.error("Payment status check error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create payment intent for one-time card payment during checkout
  app.post("/api/staff/checkouts/:id/create-payment-intent", isStaffOrAdmin, async (req, res) => {
    try {
      const checkoutId = parseInt(req.params.id);
      
      const checkout = await storage.getCheckoutById(checkoutId);
      if (!checkout) {
        return res.status(404).json({ message: "Checkout not found" });
      }

      if (checkout.paymentStatus === 'charged') {
        return res.status(400).json({ message: "This checkout has already been charged" });
      }

      if (!checkout.item) {
        return res.status(400).json({ message: "Item not found for this checkout" });
      }

      const priceInCents = checkout.item.priceInCents;
      if (!priceInCents || priceInCents <= 0) {
        return res.status(400).json({ message: "This item has no price set" });
      }

      const freshStripe = createStripeClient();

      // Create a payment intent without confirming (will be confirmed on frontend with card details)
      const paymentIntent = await freshStripe.paymentIntents.create({
        amount: priceInCents,
        currency: 'usd',
        description: `Item checkout: ${checkout.item.name} (${checkout.item.size})`,
        metadata: {
          checkoutId: checkoutId.toString(),
          itemId: checkout.itemId.toString(),
          userId: checkout.userId.toString(),
          itemName: checkout.item.name,
        }
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        amount: priceInCents,
      });
    } catch (error: any) {
      console.error("Create payment intent error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Confirm one-time payment for checkout (called after Stripe Elements confirms)
  app.post("/api/staff/checkouts/:id/confirm-payment", isStaffOrAdmin, async (req, res) => {
    try {
      const checkoutId = parseInt(req.params.id);
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID required" });
      }

      const checkout = await storage.getCheckoutById(checkoutId);
      if (!checkout) {
        return res.status(404).json({ message: "Checkout not found" });
      }

      const freshStripe = createStripeClient();
      const paymentIntent = await freshStripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: `Payment not successful: ${paymentIntent.status}` });
      }

      // Update checkout with payment info
      const updatedCheckout = await storage.updateCheckoutPayment(checkoutId, {
        paymentStatus: 'charged',
        stripePaymentIntentId: paymentIntentId,
        chargedAmountCents: paymentIntent.amount,
      });

      res.json({
        success: true,
        checkout: updatedCheckout,
        amountCharged: paymentIntent.amount,
      });
    } catch (error: any) {
      console.error("Confirm payment error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Charge a checkout item to the member's payment method
  app.post("/api/staff/checkouts/:id/charge", isStaffOrAdmin, async (req, res) => {
    try {
      const checkoutId = parseInt(req.params.id);
      
      // Get the checkout with item and user details
      const checkout = await storage.getCheckoutById(checkoutId);
      if (!checkout) {
        return res.status(404).json({ message: "Checkout not found" });
      }

      // Check if already charged
      if (checkout.paymentStatus === 'charged') {
        return res.status(400).json({ message: "This checkout has already been charged" });
      }

      // Get the item to check price
      if (!checkout.item) {
        return res.status(400).json({ message: "Item not found for this checkout" });
      }

      const priceInCents = checkout.item.priceInCents;
      if (!priceInCents || priceInCents <= 0) {
        return res.status(400).json({ message: "This item has no price set" });
      }

      // Get the user to find their Stripe customer
      if (!checkout.user) {
        return res.status(400).json({ message: "User not found for this checkout" });
      }

      if (!checkout.user.stripeCustomerId) {
        return res.status(400).json({ message: "Member does not have a payment method on file" });
      }

      // Get user's default payment method
      const paymentMethods = await storage.getPaymentMethodsByUserId(checkout.userId);
      const defaultMethod = paymentMethods.find(pm => pm.isDefault) || paymentMethods[0];
      
      if (!defaultMethod) {
        return res.status(400).json({ message: "Member does not have a payment method on file" });
      }

      const freshStripe = createStripeClient();

      // Create and confirm a payment intent
      const paymentIntent = await freshStripe.paymentIntents.create({
        amount: priceInCents,
        currency: 'usd',
        customer: checkout.user.stripeCustomerId,
        payment_method: defaultMethod.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        description: `Item checkout: ${checkout.item.name} (${checkout.item.size})`,
        metadata: {
          checkoutId: checkoutId.toString(),
          itemId: checkout.itemId.toString(),
          userId: checkout.userId.toString(),
          itemName: checkout.item.name,
        }
      });

      // Update checkout with payment info
      const updatedCheckout = await storage.updateCheckoutPayment(checkoutId, {
        paymentStatus: 'charged',
        stripePaymentIntentId: paymentIntent.id,
        chargedAmountCents: priceInCents,
      });

      res.json({
        success: true,
        checkout: updatedCheckout,
        amountCharged: priceInCents,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: any) {
      console.error("Checkout charge error:", error);
      
      // Handle Stripe-specific errors
      if (error.type === 'StripeCardError') {
        // Update checkout with failed status
        const checkoutId = parseInt(req.params.id);
        await storage.updateCheckoutPayment(checkoutId, {
          paymentStatus: 'failed',
        });
        return res.status(400).json({ message: `Payment failed: ${error.message}` });
      }
      
      res.status(500).json({ message: error.message });
    }
  });

  // Member checkout routes
  app.get("/api/checkouts/my-items", isAuthenticated, async (req, res) => {
    try {
      const checkouts = await storage.getUserCheckouts(req.user!.id);
      res.json(checkouts);
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

  // Public gallery images route for landing page
  app.get("/api/gallery-images", async (req, res) => {
    try {
      const images = await storage.getActiveGalleryImages();
      res.json(images);
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

  // Kiosk member creation endpoint - supports both online card entry and Terminal card reader
  app.post("/api/kiosk/create-member-payment", async (req, res) => {
    try {
      const { memberData, packageData, discountData, useTerminal } = req.body;
      console.log('🎫 Kiosk create-member-payment request:', { memberData, packageData, discountData, useTerminal });
      
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
      
      // Calculate final amount with discount
      const originalPrice = packageData.originalPrice || packageData.price;
      let finalAmount = packageData.finalPrice || packageData.price;
      let discountDescription = '';
      
      if (discountData && discountData.amountCents > 0) {
        finalAmount = Math.max(0, originalPrice - discountData.amountCents);
        const discountLabel = discountData.type === 'percentage' 
          ? `${discountData.value}% off` 
          : `$${(discountData.amountCents / 100).toFixed(2)} off`;
        discountDescription = ` (${discountLabel}${discountData.reason ? ` - ${discountData.reason}` : ''})`;
      }
      
      // Create payment intent - use card_present for Terminal, automatic_payment_methods for online
      const paymentIntentConfig: any = {
        amount: Math.round(finalAmount), // Final price after discount in cents
        currency: 'usd',
        description: `${packageData.name}${discountDescription} - ${validatedMemberData.firstName} ${validatedMemberData.lastName}`,
        metadata: {
          memberFirstName: validatedMemberData.firstName,
          memberLastName: validatedMemberData.lastName,
          memberEmail: validatedMemberData.email,
          memberPhone: validatedMemberData.phoneNumber || '',
          packageType: validatedMemberData.packageType,
          packageId: validatedMemberData.packageId,
          packageName: packageData.name,
          originalAmount: originalPrice.toString(),
          discountType: discountData?.type || '',
          discountValue: discountData?.value?.toString() || '',
          discountAmount: discountData?.amountCents?.toString() || '',
          discountReason: discountData?.reason || '',
          useTerminal: useTerminal ? 'true' : 'false',
        },
      };
      
      if (useTerminal) {
        // Terminal (card reader) payment
        paymentIntentConfig.payment_method_types = ['card_present'];
        paymentIntentConfig.capture_method = 'automatic';
      } else {
        // Online card entry payment
        paymentIntentConfig.automatic_payment_methods = { enabled: true };
      }
      
      const paymentIntent = await stripe.paymentIntents.create(paymentIntentConfig);
      
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
      const { paymentIntentId, memberData, packageData, agreementData, discountData } = req.body;
      console.log('🔄 Kiosk confirm-member-creation request:', { paymentIntentId, memberData, packageData, agreementData, discountData });
      
      // Validate agreement data
      const agreementSchema = z.object({
        dateOfBirth: z.string().min(1, "Date of birth is required"),
        address: z.string().min(1, "Address is required"),
        emergencyContact: z.string().min(1, "Emergency contact is required"),
        emergencyPhone: z.string().min(1, "Emergency phone is required"),
        healthConfirmation: z.boolean().refine(val => val === true, "Health confirmation required"),
        riskAcknowledgment: z.boolean().refine(val => val === true, "Risk acknowledgment required"),
        liabilityWaiver: z.boolean().refine(val => val === true, "Liability waiver required"),
        rulesAcceptance: z.boolean().refine(val => val === true, "Rules acceptance required"),
        ageConfirmation: z.boolean().refine(val => val === true, "Age confirmation required"),
      });
      
      const validatedAgreement = agreementSchema.parse(agreementData);
      console.log('✅ Validated agreement data:', validatedAgreement);
      
      // Verify payment was successful
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log('💳 Payment Intent status:', paymentIntent.status);
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment not completed" });
      }
      
      // Create the member account with agreement data
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
        // Agreement is completed during kiosk registration
        membershipAgreementCompleted: true,
        membershipAgreementDate: new Date(),
        membershipAgreementData: agreementData,
        dateOfBirth: agreementData?.dateOfBirth,
        address: agreementData?.address,
        emergencyContact: agreementData?.emergencyContact,
        emergencyPhone: agreementData?.emergencyPhone,
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
      
      // Calculate final amount and discount info
      const originalAmount = packageData.originalPrice || packageData.price;
      const finalAmount = packageData.finalPrice || packageData.price;
      const hasDiscount = discountData && discountData.amountCents > 0;
      
      // Record the payment with discount information
      await storage.createPayment({
        userId: newUser.id,
        membershipId: memberData.packageType === 'membership' ? `WM-${Date.now()}-${Math.random().toString(36).slice(-4).toUpperCase()}` : 'punch-card',
        amount: finalAmount, // Final amount after discount
        originalAmount: hasDiscount ? originalAmount : null,
        discountAmount: hasDiscount ? discountData.amountCents : null,
        discountType: hasDiscount ? discountData.type : null,
        discountValue: hasDiscount ? discountData.value : null,
        discountReason: hasDiscount ? discountData.reason : null,
        description: `${packageData.name} - Kiosk Purchase${hasDiscount ? ` (${discountData.type === 'percentage' ? discountData.value + '%' : '$' + (discountData.amountCents/100).toFixed(2)} discount)` : ''}`,
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

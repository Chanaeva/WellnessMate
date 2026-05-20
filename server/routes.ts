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
import multer from "multer";
import { ObjectStorageService } from "./replit_integrations/object_storage";
import { sendSessionBookingNotification, sendPasswordResetEmail, sendGiftCardEmail, sendWaitlistNotificationEmail } from "./email";
import { sendWaitlistNotificationSMS } from "./sms";

const scryptAsync = promisify(scrypt);

// Configure multer for file uploads
const galleryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Initialize object storage service
const objectStorageService = new ObjectStorageService();
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
  
  // Serve uploaded objects from Object Storage (public for gallery images)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error serving object:", error);
      if (error.name === "ObjectNotFoundError") {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });

  // File upload endpoint for gallery images (admin only) - MUST be after setupAuth
  // Uses presigned URL upload to Object Storage for production persistence
  app.post("/api/admin/gallery/upload-url", async (req, res) => {
    console.log('Gallery upload URL request - isAuthenticated:', req.isAuthenticated?.(), 'user:', req.user?.email, 'role:', req.user?.role);
    if (!req.isAuthenticated || !req.isAuthenticated() || req.user?.role !== 'admin') {
      console.log('Upload denied - auth check failed');
      return res.sendStatus(403);
    }
    
    try {
      const { name, size, contentType } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error: any) {
      console.error('Gallery upload URL error:', error);
      res.status(500).json({ message: 'Failed to generate upload URL: ' + error.message });
    }
  });
  
  // Legacy file upload endpoint for gallery images (admin only) - MUST be after setupAuth
  // Uses multer middleware which properly preserves session/auth unlike express.raw()
  app.post("/api/admin/upload-image", galleryUpload.single('image'), async (req, res) => {
    console.log('Upload request - isAuthenticated:', req.isAuthenticated?.(), 'user:', req.user?.email, 'role:', req.user?.role);
    if (!req.isAuthenticated || !req.isAuthenticated() || req.user?.role !== 'admin') {
      console.log('Upload denied - auth check failed');
      return res.sendStatus(403);
    }
    
    try {
      const file = req.file;
      console.log('Upload request - file:', file?.originalname, 'mimetype:', file?.mimetype, 'size:', file?.size);
      
      // Check if file is valid
      if (!file || !file.buffer || file.buffer.length === 0) {
        console.error('Upload error: No file received');
        return res.status(400).json({ message: 'No image data received. Please try again.' });
      }
      
      const extension = file.mimetype.includes('png') ? 'png' : 
                       file.mimetype.includes('gif') ? 'gif' : 
                       file.mimetype.includes('webp') ? 'webp' : 'jpg';
      
      const filename = `gallery_${Date.now()}_${randomBytes(4).toString('hex')}.${extension}`;
      const uploadDir = path.join(process.cwd(), 'attached_assets', 'gallery');
      
      // Ensure gallery directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, file.buffer);
      
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

  // Admin/Staff: List registered card readers
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

  // Server-driven reader discovery for kiosk (no auth for kiosk access)
  // This is more reliable for WisePOS E than client-side discovery
  app.get("/api/stripe/terminal/discover-readers", async (req, res) => {
    try {
      // Get the location ID if provided
      let locationId = req.query.location as string | undefined;
      
      // First, try listing readers filtered by location if provided
      // If no readers found, fall back to listing ALL readers across all locations
      let readers;
      
      if (!locationId) {
        const locations = await stripe.terminal.locations.list({ limit: 1 });
        if (locations.data.length > 0) {
          locationId = locations.data[0].id;
        }
      }
      
      if (locationId) {
        readers = await stripe.terminal.readers.list({ limit: 20, location: locationId });
      }
      
      // If no readers found at the specific location, search across ALL locations
      if (!readers || readers.data.length === 0) {
        console.log('[Terminal] No readers at primary location, searching all locations...');
        readers = await stripe.terminal.readers.list({ limit: 20 });
      }
      
      // Log all reader details for diagnostics
      readers.data.forEach(r => {
        console.log(`[Terminal] Reader: ${r.id}, type: ${r.device_type}, status: ${r.status}, label: ${r.label}, serial: ${r.serial_number}, location: ${typeof r.location === 'string' ? r.location : r.location}`);
      });
      
      // Map all readers (don't filter by status - dashboard may show online while API reports differently)
      const availableReaders = readers.data.map(r => ({
        id: r.id,
        object: 'terminal.reader',
        device_type: r.device_type,
        label: r.label || r.serial_number,
        serial_number: r.serial_number,
        ip_address: r.ip_address,
        location: r.location,
        status: r.status,
      }));
      
      console.log(`[Terminal] Server-driven discovery found ${availableReaders.length} readers (${availableReaders.filter(r => r.status === 'online').length} online)`);
      res.json({ readers: availableReaders, locationId });
    } catch (error: any) {
      console.error("Failed to discover readers:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get Terminal location (for kiosk reader discovery - no auth required)
  // This endpoint returns the location ID needed for WisePOS E discovery
  app.get("/api/stripe/terminal/location", async (req, res) => {
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
  // SERVER-DRIVEN TERMINAL PAYMENT (for WisePOS E)
  // This bypasses local network DNS issues by having
  // Stripe's servers communicate with the reader directly
  // ============================================

  // Process a payment intent on a specific reader (server-driven)
  // The reader will display the payment and wait for card tap/insert
  app.post("/api/stripe/terminal/process-payment", async (req, res) => {
    try {
      const { readerId, paymentIntentId } = req.body;
      
      if (!readerId || !paymentIntentId) {
        return res.status(400).json({ message: "readerId and paymentIntentId are required" });
      }
      
      console.log(`[Terminal] Processing payment ${paymentIntentId} on reader ${readerId}`);
      
      // Send the payment intent to the reader for collection
      const reader = await stripe.terminal.readers.processPaymentIntent(readerId, {
        payment_intent: paymentIntentId,
      });
      
      console.log(`[Terminal] Reader action started:`, reader.action?.type, reader.action?.status);
      
      res.json({ 
        success: true,
        reader: {
          id: reader.id,
          label: reader.label,
          status: reader.status,
          action: reader.action,
        }
      });
    } catch (error: any) {
      console.error("[Terminal] Failed to process payment on reader:", error);
      res.status(500).json({ message: error.message, code: error.code });
    }
  });

  // Check the status of a reader (poll for payment completion)
  app.get("/api/stripe/terminal/reader-status/:readerId", async (req, res) => {
    try {
      const { readerId } = req.params;
      
      const reader = await stripe.terminal.readers.retrieve(readerId);
      
      // Check if reader is deleted
      if ('deleted' in reader && reader.deleted) {
        return res.status(404).json({ message: "Reader not found or deleted" });
      }
      
      res.json({
        id: reader.id,
        label: (reader as any).label,
        status: (reader as any).status,
        action: (reader as any).action,
      });
    } catch (error: any) {
      console.error("[Terminal] Failed to get reader status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get payment intent status (for server-driven polling)
  app.get("/api/stripe/payment-intent-status/:paymentIntentId", async (req, res) => {
    try {
      const { paymentIntentId } = req.params;
      
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      res.json({
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
      });
    } catch (error: any) {
      console.error("[Terminal] Failed to get payment intent status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Cancel the current action on a reader
  app.post("/api/stripe/terminal/cancel-action", async (req, res) => {
    try {
      const { readerId } = req.body;
      
      if (!readerId) {
        return res.status(400).json({ message: "readerId is required" });
      }
      
      console.log(`[Terminal] Canceling action on reader ${readerId}`);
      
      const reader = await stripe.terminal.readers.cancelAction(readerId);
      
      res.json({ 
        success: true,
        reader: {
          id: reader.id,
          label: reader.label,
          status: reader.status,
          action: reader.action,
        }
      });
    } catch (error: any) {
      console.error("[Terminal] Failed to cancel reader action:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // STRIPE TERMINAL SPLASH SCREEN ROUTES
  // ============================================

  // Get current splash screen configuration
  app.get("/api/stripe/terminal/splash-screen", async (req, res) => {
    if (!req.isAuthenticated() || !['admin'].includes(req.user?.role || '')) {
      return res.sendStatus(403);
    }
    try {
      const configs = await stripe.terminal.configurations.list({ limit: 10 });
      
      let splashConfig = configs.data.find(c => 
        (c as any).bbpos_wisepos_e?.splashscreen
      );
      
      if (!splashConfig) {
        splashConfig = configs.data.find(c => (c as any).is_account_default);
      }
      
      if (splashConfig && (splashConfig as any).bbpos_wisepos_e?.splashscreen) {
        const fileId = (splashConfig as any).bbpos_wisepos_e.splashscreen;
        let fileUrl = null;
        try {
          const file = await stripe.files.retrieve(fileId);
          fileUrl = file.url;
        } catch (e) {}
        
        res.json({
          configurationId: splashConfig.id,
          fileId,
          fileUrl,
          isAccountDefault: (splashConfig as any).is_account_default || false,
        });
      } else {
        res.json({ configurationId: null, fileId: null, fileUrl: null });
      }
    } catch (error: any) {
      console.error("Failed to get splash screen config:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Upload and set splash screen for WisePOS E reader
  app.post("/api/stripe/terminal/splash-screen", galleryUpload.single('image'), async (req, res) => {
    if (!req.isAuthenticated() || !['admin'].includes(req.user?.role || '')) {
      return res.sendStatus(403);
    }
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Image file is required" });
      }

      console.log(`[Terminal] Uploading splash screen: ${req.file.originalname} (${req.file.size} bytes)`);

      const file = await stripe.files.create({
        purpose: 'terminal_reader_splashscreen' as any,
        file: {
          data: req.file.buffer,
          name: req.file.originalname,
          type: req.file.mimetype,
        },
      });

      console.log(`[Terminal] File uploaded to Stripe: ${file.id}`);

      const configs = await stripe.terminal.configurations.list({ limit: 100 });
      const accountDefault = configs.data.find(c => (c as any).is_account_default);
      const existingWithSplash = configs.data.find(c =>
        !(c as any).is_account_default && (c as any).bbpos_wisepos_e?.splashscreen
      );

      let configuration;
      if (accountDefault) {
        configuration = await stripe.terminal.configurations.update(accountDefault.id, {
          bbpos_wisepos_e: {
            splashscreen: file.id,
          },
        });
        console.log(`[Terminal] Updated account default configuration: ${configuration.id}`);
      } else if (existingWithSplash) {
        configuration = await stripe.terminal.configurations.update(existingWithSplash.id, {
          bbpos_wisepos_e: {
            splashscreen: file.id,
          },
        });
        console.log(`[Terminal] Updated existing configuration: ${configuration.id}`);
      } else {
        configuration = await stripe.terminal.configurations.create({
          bbpos_wisepos_e: {
            splashscreen: file.id,
          },
        });
        console.log(`[Terminal] Created new configuration: ${configuration.id}`);
      }

      res.json({
        success: true,
        configurationId: configuration.id,
        fileId: file.id,
        fileUrl: file.url,
        message: "Splash screen uploaded and applied. It will appear on your reader within 10 minutes.",
      });
    } catch (error: any) {
      console.error("[Terminal] Failed to set splash screen:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Remove splash screen from reader
  app.delete("/api/stripe/terminal/splash-screen", async (req, res) => {
    if (!req.isAuthenticated() || !['admin'].includes(req.user?.role || '')) {
      return res.sendStatus(403);
    }
    try {
      const configs = await stripe.terminal.configurations.list({ limit: 10 });
      const splashConfig = configs.data.find(c => 
        (c as any).bbpos_wisepos_e?.splashscreen
      );

      if (splashConfig) {
        await stripe.terminal.configurations.update(splashConfig.id, {
          bbpos_wisepos_e: {
            splashscreen: '',
          },
        });
        console.log(`[Terminal] Removed splash screen from configuration: ${splashConfig.id}`);
      }

      res.json({ success: true, message: "Splash screen removed. Reader will return to default display within 10 minutes." });
    } catch (error: any) {
      console.error("[Terminal] Failed to remove splash screen:", error);
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
  
  // Get family/gift memberships managed by current user
  app.get("/api/membership/managed", isAuthenticated, async (req, res) => {
    try {
      const managedMemberships = await storage.getManagedMemberships(req.user!.id);
      res.json(managedMemberships);
    } catch (error) {
      console.error('Error getting managed memberships:', error);
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
        const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId, {
          expand: ['items.data.price']
        });
        
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          // Type assertion for current_period_end since Stripe types don't always expose it
          const currentPeriodEnd = (subscription as any).current_period_end as number;
          if (!currentPeriodEnd || isNaN(currentPeriodEnd)) {
            console.warn('⚠️ Subscription missing current_period_end:', subscription.id);
            return res.json({
              nextBillingDate: membership.endDate,
              source: 'database',
              subscriptionStatus: subscription.status,
              billingInterval: 'month',
            });
          }
          const nextBillingDate = new Date(currentPeriodEnd * 1000).toISOString().split('T')[0];
          
          // Get billing interval from the subscription's price
          const subscriptionItem = subscription.items?.data?.[0];
          const price = subscriptionItem?.price as any;
          const billingInterval = price?.recurring?.interval || 'month';
          
          return res.json({
            nextBillingDate,
            source: 'stripe',
            subscriptionStatus: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            billingInterval: billingInterval, // 'month' or 'year'
          });
        } else {
          // Subscription not active, return database date
          return res.json({
            nextBillingDate: membership.endDate,
            source: 'database',
            subscriptionStatus: subscription.status,
            billingInterval: 'month',
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

      const cancelAtPeriodEnd = req.body?.cancelAtPeriodEnd === true;

      if (cancelAtPeriodEnd && membership.stripeSubscriptionId) {
        // Schedule cancellation at end of billing period — member keeps access until then
        try {
          const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
          if (subscription.status !== 'canceled') {
            await stripe.subscriptions.update(membership.stripeSubscriptionId, {
              cancel_at_period_end: true,
            });
            console.log(`Scheduled subscription cancellation at period end: ${membership.stripeSubscriptionId}`);
          }
        } catch (stripeError: any) {
          console.error("Stripe period-end cancel error:", stripeError.message);
          // Continue — update DB regardless
        }
        // Keep status active, just disable auto-renew and record when cancellation was requested
        await storage.updateMembership(membership.membershipId, { autoRenew: false, cancelledAt: new Date() });
        return res.json({
          message: "Your membership will not renew. You'll keep access until the end of your current billing period.",
          endDate: membership.endDate,
          membership: await storage.getMembershipByUserId(userId),
        });
      }

      // Immediate cancellation (default)
      if (membership.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
          if (subscription.status !== 'canceled') {
            await stripe.subscriptions.del(membership.stripeSubscriptionId);
            console.log(`Cancelled Stripe subscription immediately: ${membership.stripeSubscriptionId}`);
          }
        } catch (stripeError: any) {
          console.error("Stripe subscription cancellation error:", stripeError.message, stripeError.code);
        }
      }

      await storage.updateMembership(membership.membershipId, { 
        status: 'inactive',
        endDate: new Date().toISOString().split('T')[0],
        autoRenew: false,
      });

      res.json({ 
        message: "Membership cancelled successfully",
        membership: await storage.getMembershipByUserId(userId),
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
      
      // Staff can check in any member - membership/day pass status is for information only
      // Punches on day passes don't count as check-ins, so we allow all members to check in

      // Helper function to parse time string to minutes since midnight (used for session booking)
      const parseTimeToMinutes = (timeStr: string): number => {
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
        
        if (isPM && hours !== 12) {
          hours += 12;
        } else if (isAM && hours === 12) {
          hours = 0;
        }
        
        return hours * 60 + minutes;
      };

      // Determine if user is using a day pass (explicitly or implicitly)
      const hasActiveMembership = membership && membership.status === 'active';
      const hasDayPasses = activeDayPasses.length > 0;
      
      // Staff/admin can check in any member (membership or day pass) at any time
      // No day pass hours restriction since kiosk is staff-operated only
      
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
      
      let membershipType = membership?.planType || (activeDayPasses.length > 0 ? 'Day Pass' : 'Guest');
      let usedDayPass = false;
      
      // Process day pass usage ONLY if explicitly requested (useDayPass === true)
      // Punches don't count as check-ins, so we don't automatically deduct
      if (useDayPass === true && activeDayPasses.length > 0) {
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
          // Use business timezone for time comparison
          const { DateTime } = await import('luxon');
          const BUSINESS_TIMEZONE = 'America/Chicago'; // Central Time - adjust as needed
          
          const nowInBusinessTz = DateTime.now().setZone(BUSINESS_TIMEZONE);
          const today = nowInBusinessTz.toISODate(); // YYYY-MM-DD in business timezone
          const currentTimeMin = nowInBusinessTz.hour * 60 + nowInBusinessTz.minute;
          
          for (const session of enabledSessionsForCheckin) {
            const sessionStartMinutes = parseTimeToMinutes(session.startTime);
            const sessionEndMinutes = parseTimeToMinutes(session.endTime);
            
            if (currentTimeMin >= sessionStartMinutes && currentTimeMin < sessionEndMinutes) {
              // Mark this session booking as checked in
              await storage.markSessionBookingCheckedIn(user.id, today!, session.sessionType as 'morning' | 'evening');
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

      // Determine the appropriate membership status for display
      let membershipStatus = membership?.status || (activeDayPasses.length > 0 ? 'day-pass' : 'guest');
      
      res.json({
        success: true,
        member: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          membershipType: membershipType,
          membershipStatus: membershipStatus
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

  // ============================================
  // GUEST WAIVER ROUTES
  // ============================================

  // Create a guest waiver (kiosk - public endpoint for walk-in guests)
  app.post("/api/kiosk/guest-waiver", async (req, res) => {
    try {
      const waiverSchema = z.object({
        email: z.string().email("Valid email is required"),
        phoneNumber: z.string().optional(),
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        waiverAgreed: z.boolean().refine(val => val === true, "Waiver must be agreed to"),
        notes: z.string().optional(),
        answers: z.array(z.object({ questionId: z.number(), answer: z.boolean() })).optional(),
      });
      
      const validatedData = waiverSchema.parse(req.body);
      const { answers, ...waiverData } = validatedData;
      
      // Store email in lowercase for consistency
      const waiver = await storage.createGuestWaiver({
        ...waiverData,
        email: waiverData.email.toLowerCase(),
      });

      // Save answers to waiver questions if any were provided
      if (answers && answers.length > 0) {
        await storage.createGuestWaiverAnswers(
          answers.map(a => ({ guestWaiverId: waiver.id, questionId: a.questionId, answer: a.answer }))
        );
      }
      
      console.log(`Guest waiver signed: ${waiver.firstName} ${waiver.lastName} (${waiver.email})`);
      
      res.json({ 
        success: true, 
        message: "Guest checked in successfully!",
        waiver 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Guest waiver error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Public: active waiver questions for kiosk form
  app.get("/api/waiver-questions", async (req, res) => {
    try {
      const questions = await storage.getActiveWaiverQuestions();
      res.json(questions);
    } catch (error: any) {
      // Return empty array if table doesn't exist yet (new feature not yet migrated)
      res.json([]);
    }
  });

  // Get all guest waivers (Admin/Staff only)
  app.get("/api/admin/guest-waivers", isAdminOrStaff, async (req, res) => {
    try {
      const waivers = await storage.getAllGuestWaivers();
      res.json(waivers);
    } catch (error: any) {
      console.error("Error fetching guest waivers:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/guest-waivers/paginated", isAdminOrStaff, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const period = req.query.period as string || 'all';
      const search = req.query.search as string || '';
      const result = await storage.getPaginatedGuestWaivers(page, pageSize, period, search);
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching paginated guest waivers:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get today's guest waivers (Admin/Staff only)
  app.get("/api/admin/guest-waivers/today", isAdminOrStaff, async (req, res) => {
    try {
      const waivers = await storage.getTodayGuestWaivers();
      res.json(waivers);
    } catch (error: any) {
      console.error("Error fetching today's guest waivers:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get guest waiver analytics (Admin only)
  app.get("/api/admin/guest-waivers/analytics", isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getGuestWaiverAnalytics();
      res.json(analytics);
    } catch (error: any) {
      console.error("Error fetching guest waiver analytics:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Search guest waivers by email (Admin/Staff only)
  app.get("/api/admin/guest-waivers/search", isAdminOrStaff, async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ message: "Email parameter is required" });
      }
      const waivers = await storage.getGuestWaiversByEmail(email);
      res.json(waivers);
    } catch (error: any) {
      console.error("Error searching guest waivers:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: get guest waiver answers
  app.get("/api/admin/guest-waivers/:id/answers", isAdminOrStaff, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const answers = await storage.getGuestWaiverAnswers(id);
      res.json(answers);
    } catch (error: any) {
      // Return empty array if table doesn't exist yet (new feature not yet migrated)
      res.json([]);
    }
  });

  // Admin: waiver question CRUD
  app.get("/api/admin/waiver-questions", isAdminOrStaff, async (req, res) => {
    try {
      const questions = await storage.getAllWaiverQuestions();
      res.json(questions);
    } catch (error: any) {
      // Return empty array if table doesn't exist yet (new feature not yet migrated)
      res.json([]);
    }
  });

  app.post("/api/admin/waiver-questions", isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        question: z.string().min(1),
        description: z.string().optional(),
        isRequired: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      });
      const data = schema.parse(req.body);
      const q = await storage.createWaiverQuestion(data);
      res.json(q);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/waiver-questions/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schema = z.object({
        question: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        isRequired: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      });
      const data = schema.parse(req.body);
      const q = await storage.updateWaiverQuestion(id, data);
      res.json(q);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/waiver-questions/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWaiverQuestion(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

  // Sync all memberships with their Stripe subscription status (Admin only)
  app.post("/api/admin/sync-stripe-memberships", isAdmin, async (req, res) => {
    try {
      console.log('[Stripe Sync] Starting membership sync...');

      const allMembers = await storage.getAllMembers();
      const results: { membershipId: string; email: string; oldStatus: string; newStatus: string; action: string }[] = [];
      const errors: { membershipId: string; email: string; error: string }[] = [];
      const newlyLinked: { email: string; subscriptionId: string; newStatus: string }[] = [];

      const mapStripeStatus = (stripeStatus: string): 'active' | 'inactive' | 'expired' | 'frozen' => {
        if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
        if (stripeStatus === 'canceled' || stripeStatus === 'unpaid') return 'expired';
        if (stripeStatus === 'past_due') return 'frozen';
        return 'inactive';
      };

      // ── Pass 1: Reconcile memberships that already have a subscription ID ──────
      for (const member of allMembers) {
        if (!member.membership) continue;
        const { membership } = member;

        if (!membership.stripeSubscriptionId) continue;

        try {
          const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
          const correctStatus = mapStripeStatus(subscription.status);
          const currentPeriodEnd = (subscription as any).current_period_end;
          const newEndDate = currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString().split('T')[0] : undefined;
          const newAutoRenew = !subscription.cancel_at_period_end;

          if (
            membership.status !== correctStatus ||
            (newEndDate && membership.endDate !== newEndDate) ||
            membership.autoRenew !== newAutoRenew
          ) {
            await storage.updateMembership(membership.membershipId, {
              status: correctStatus,
              endDate: newEndDate || membership.endDate,
              autoRenew: newAutoRenew,
            });

            results.push({
              membershipId: membership.membershipId,
              email: member.email,
              oldStatus: membership.status,
              newStatus: correctStatus,
              action: 'updated',
            });

            console.log(`[Stripe Sync] Updated ${member.email}: ${membership.status} → ${correctStatus}`);
          } else {
            results.push({
              membershipId: membership.membershipId,
              email: member.email,
              oldStatus: membership.status,
              newStatus: correctStatus,
              action: 'ok',
            });
          }
        } catch (err: any) {
          // Subscription not found in Stripe means it was deleted
          if (err?.statusCode === 404 || err?.code === 'resource_missing') {
            if (membership.status === 'active') {
              await storage.updateMembership(membership.membershipId, {
                status: 'expired',
                autoRenew: false,
              });
              results.push({
                membershipId: membership.membershipId,
                email: member.email,
                oldStatus: membership.status,
                newStatus: 'expired',
                action: 'expired (subscription missing in Stripe)',
              });
              console.log(`[Stripe Sync] Expired ${member.email}: subscription not found in Stripe`);
            }
          } else {
            errors.push({ membershipId: membership.membershipId, email: member.email, error: err.message });
            console.error(`[Stripe Sync] Error for ${member.email}:`, err.message);
          }
        }
      }

      // ── Pass 2: Find active/trialing Stripe subscriptions not yet linked to any membership ──
      // For each member who has a stripeCustomerId, list their active and trialing Stripe
      // subscriptions. If any subscription isn't already linked to a membership in the DB,
      // link it now. Guard: only link the first unlinked sub per membership to avoid
      // overwriting the same row multiple times when a customer has multiple active subs.
      console.log('[Stripe Sync] Starting bidirectional pass — scanning Stripe subscriptions...');
      const linkedMembershipIds = new Set<string>();
      for (const member of allMembers) {
        if (!member.stripeCustomerId) continue;
        const { membership } = member;
        if (!membership) continue;

        try {
          // Fetch active and trialing subscriptions in a single call (status: 'all' with
          // client-side filtering avoids two round-trips while staying within rate limits).
          const allSubs = await stripe.subscriptions.list({
            customer: member.stripeCustomerId,
            status: 'all',
            limit: 20,
          });

          const linkableSubs = allSubs.data.filter(
            s => s.status === 'active' || s.status === 'trialing'
          );

          for (const sub of linkableSubs) {
            // Skip if this subscription is already linked to some membership in the DB
            const existingLink = await storage.getMembershipByStripeSubscriptionId(sub.id);
            if (existingLink) continue;

            // Guard: only link once per membership per sync run — if a customer somehow
            // has multiple unlinked active subs, link the first and skip the rest to
            // avoid overwriting the same row repeatedly.
            if (linkedMembershipIds.has(membership.membershipId)) {
              console.warn(`[Stripe Sync] Skipping additional unlinked sub ${sub.id} for ${member.email} — membership ${membership.membershipId} already linked in this run`);
              continue;
            }

            // This active/trialing subscription in Stripe has no matching DB membership row —
            // link it to this member's membership record.
            const correctStatus = mapStripeStatus(sub.status);
            const currentPeriodEnd = sub.current_period_end;
            const newEndDate = currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString().split('T')[0] : undefined;

            await storage.updateMembership(membership.membershipId, {
              status: correctStatus,
              stripeSubscriptionId: sub.id,
              endDate: newEndDate || membership.endDate,
              autoRenew: !sub.cancel_at_period_end,
            });

            linkedMembershipIds.add(membership.membershipId);
            newlyLinked.push({ email: member.email, subscriptionId: sub.id, newStatus: correctStatus });
            console.log(`[Stripe Sync] Newly linked subscription ${sub.id} → membership ${membership.membershipId} for ${member.email}`);
          }
        } catch (err: any) {
          errors.push({ membershipId: membership?.membershipId || 'unknown', email: member.email, error: err.message });
          console.error(`[Stripe Sync] Error in bidirectional pass for ${member.email}:`, err.message);
        }
      }

      const updated = results.filter(r => r.action !== 'ok').length;
      console.log(`[Stripe Sync] Complete. Checked ${results.length}, updated ${updated}, newly linked ${newlyLinked.length}, errors ${errors.length}`);

      res.json({
        checked: results.length,
        updated,
        newlyLinked: newlyLinked.length,
        newlyLinkedDetails: newlyLinked,
        errors: errors.length,
        results,
        errorDetails: errors,
      });
    } catch (error: any) {
      console.error('[Stripe Sync] Fatal error:', error);
      res.status(500).json({ message: error.message || 'Sync failed' });
    }
  });

  // Link a Stripe customer ID to a member (Admin only)
  app.post("/api/admin/members/:id/link-stripe-customer", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const { stripeCustomerId } = req.body;

      if (!stripeCustomerId || typeof stripeCustomerId !== 'string') {
        return res.status(400).json({ message: "stripeCustomerId is required" });
      }

      const trimmed = stripeCustomerId.trim();
      if (!trimmed.startsWith('cus_')) {
        return res.status(400).json({ message: "Invalid Stripe customer ID — must start with 'cus_'" });
      }

      // Fetch the member record
      const member = await storage.getUser(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Check if this customer ID is already linked to a different user
      const existingOwner = await storage.getUserByCustomerId(trimmed);
      if (existingOwner && existingOwner.id !== memberId) {
        return res.status(409).json({
          message: `This Stripe customer ID is already linked to another member: ${existingOwner.email}`,
        });
      }

      // Validate the customer exists in Stripe and email matches
      let stripeCustomer: any;
      try {
        stripeCustomer = await stripe.customers.retrieve(trimmed);
      } catch (err: any) {
        return res.status(400).json({ message: "Stripe customer not found — please verify the ID is correct" });
      }

      if (stripeCustomer.deleted) {
        return res.status(400).json({ message: "This Stripe customer has been deleted" });
      }

      // Error if emails don't match (unless admin explicitly forces override)
      const stripeEmail = stripeCustomer.email?.toLowerCase();
      const memberEmail = member.email?.toLowerCase();
      const emailMismatch = stripeEmail && memberEmail && stripeEmail !== memberEmail;
      const { force } = req.body;

      if (emailMismatch && !force) {
        return res.status(400).json({
          message: `Stripe customer email (${stripeCustomer.email}) does not match member email (${member.email}). Verify you have the right customer, or confirm to link anyway.`,
          emailMismatch: true,
          stripeEmail: stripeCustomer.email,
          stripeCustomerId: trimmed,
        });
      }

      await storage.updateUserStripeCustomerId(memberId, trimmed);

      res.json({
        success: true,
        stripeCustomerId: trimmed,
        stripeEmail: stripeCustomer.email,
        emailMismatch: !!emailMismatch,
        message: emailMismatch
          ? `Linked with email override. Stripe email (${stripeCustomer.email}) differs from member email (${member.email}).`
          : "Stripe customer linked successfully.",
      });
    } catch (error: any) {
      console.error('[Link Stripe Customer] Error:', error);
      res.status(500).json({ message: error.message || "Failed to link Stripe customer" });
    }
  });

  // Search Stripe customers by email (Admin only)
  app.get("/api/admin/stripe/customers/search", isAdmin, async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email || email.trim().length < 3) {
        return res.status(400).json({ message: "Please provide at least 3 characters to search" });
      }
      const customers = await stripe.customers.list({ email: email.trim(), limit: 10 });
      const results = customers.data
        .filter((c: any) => !c.deleted)
        .map((c: any) => ({
          id: c.id,
          email: c.email,
          name: c.name,
          created: c.created,
        }));
      res.json({ results });
    } catch (error: any) {
      console.error('[Stripe Customer Search] Error:', error);
      res.status(500).json({ message: error.message || "Failed to search Stripe customers" });
    }
  });

  // Update member details (Admin only)
  app.put("/api/admin/members/:id", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const { password, email, ...updateData } = req.body;
      
      // If email is being changed, check if it's already in use
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== memberId) {
          return res.status(400).json({ message: "This email address is already in use by another member" });
        }
        updateData.email = email;
      }
      
      // If password is provided, hash it using the same format as hashPassword
      if (password && password.trim()) {
        const salt = randomBytes(16).toString("hex");
        const hashedPassword = await scryptAsync(password, salt, 64) as Buffer;
        updateData.password = `${hashedPassword.toString('hex')}.${salt}`;
      }
      
      const updatedUser = await storage.updateUser(memberId, updateData);
      res.json(updatedUser);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
        return res.status(400).json({ message: "This email or username is already in use" });
      }
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

  // Archive member (Admin only) - preserves all historical data
  app.post("/api/admin/members/:id/archive", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const archived = await storage.archiveUser(memberId);
      res.json({ message: "Member archived successfully", member: archived });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Unarchive/Restore member (Admin only)
  app.post("/api/admin/members/:id/unarchive", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const restored = await storage.unarchiveUser(memberId);
      res.json({ message: "Member restored successfully", member: restored });
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

  // Get member's payment methods (Admin only)
  app.get("/api/admin/members/:id/payment-methods", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const paymentMethods = await storage.getPaymentMethodsByUserId(memberId);
      res.json(paymentMethods);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create setup intent for adding payment method to member (Admin only)
  app.post("/api/admin/members/:id/setup-intent", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const member = await storage.getUserById(memberId);
      
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      const freshStripe = createStripeClient();
      
      // Ensure customer exists in Stripe
      let customerId = member.stripeCustomerId;
      if (!customerId) {
        const customer = await freshStripe.customers.create({
          email: member.email,
          name: `${member.firstName} ${member.lastName}`,
          metadata: { userId: member.id.toString() }
        });
        customerId = customer.id;
        await storage.updateUser(member.id, { stripeCustomerId: customerId });
      }

      // Create a SetupIntent for adding a card
      const setupIntent = await freshStripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      });

      res.json({
        clientSecret: setupIntent.client_secret,
        customerId
      });
    } catch (error: any) {
      console.error('Error creating setup intent for member:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Save payment method after setup intent confirmation (Admin only)
  app.post("/api/admin/members/:id/save-payment-method", isAdmin, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const { paymentMethodId, setAsDefault } = req.body;

      if (!paymentMethodId) {
        return res.status(400).json({ message: "Payment method ID is required" });
      }

      const member = await storage.getUserById(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      const freshStripe = createStripeClient();
      
      // Retrieve the payment method from Stripe
      const paymentMethod = await freshStripe.paymentMethods.retrieve(paymentMethodId);
      
      if (!paymentMethod.card) {
        return res.status(400).json({ message: "Invalid payment method" });
      }

      // Validate that the payment method belongs to this member's Stripe customer
      if (member.stripeCustomerId && paymentMethod.customer !== member.stripeCustomerId) {
        // If the payment method isn't attached to the customer, attach it
        if (!paymentMethod.customer) {
          await freshStripe.paymentMethods.attach(paymentMethodId, {
            customer: member.stripeCustomerId
          });
        } else {
          return res.status(400).json({ 
            message: "This payment method is associated with a different customer" 
          });
        }
      }

      // Check if this payment method already exists
      const existingMethods = await storage.getPaymentMethodsByUserId(memberId);
      const alreadyExists = existingMethods.some(pm => pm.stripePaymentMethodId === paymentMethodId);
      
      if (alreadyExists) {
        return res.status(400).json({ message: "This payment method is already saved" });
      }

      // Determine if this should be the default
      const isDefault = setAsDefault || existingMethods.length === 0;

      // Save the payment method locally
      const savedPaymentMethod = await storage.createPaymentMethod({
        userId: memberId,
        stripePaymentMethodId: paymentMethodId,
        cardBrand: paymentMethod.card.brand,
        cardLast4: paymentMethod.card.last4,
        cardExpMonth: paymentMethod.card.exp_month,
        cardExpYear: paymentMethod.card.exp_year,
        isDefault
      });

      // If setting as default, update in Stripe as well
      if (isDefault && member.stripeCustomerId) {
        await freshStripe.customers.update(member.stripeCustomerId, {
          invoice_settings: { default_payment_method: paymentMethodId }
        });
        
        // Update any other methods to not be default
        if (existingMethods.length > 0) {
          await storage.setDefaultPaymentMethod(memberId, paymentMethodId);
        }
      }

      res.json(savedPaymentMethod);
    } catch (error: any) {
      console.error('Error saving payment method for member:', error);
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

  // Unified check-ins (members + guests merged, paginated)
  app.get("/api/admin/unified-check-ins", isAdminOrStaff, async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 20;
      const period = req.query.period as string | undefined;
      const search = req.query.search as string | undefined;
      const result = await storage.getUnifiedCheckIns(page, pageSize, period, search);
      res.json(result);
    } catch (error: any) {
      console.error("unified-check-ins error:", error?.message, error?.stack);
      res.status(500).json({ message: "Server error", detail: error?.message });
    }
  });

  // Today's unified count (members + guests)
  app.get("/api/admin/unified-check-ins/today-count", isAdminOrStaff, async (req, res) => {
    try {
      const count = await storage.getTodayUnifiedCount();
      res.json(count);
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

      let warning: string | undefined;

      // If admin is reactivating a membership, sync with Stripe
      if (req.body.status === 'active' && membership.status !== 'active' && membership.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);

          if (subscription.status === 'past_due') {
            // Try to pay the outstanding invoice to reactivate
            const latestInvoiceId = (subscription as any).latest_invoice as string;
            if (latestInvoiceId) {
              try {
                await stripe.invoices.pay(latestInvoiceId);
                console.log(`[Admin Reactivate] Paid invoice ${latestInvoiceId} to reactivate subscription ${membership.stripeSubscriptionId}`);
              } catch (payErr: any) {
                warning = `Could not collect payment from Stripe: ${payErr.message}. DB status updated but subscription remains past_due.`;
                console.warn('[Admin Reactivate] Invoice payment failed:', payErr.message);
              }
            }
          } else if (subscription.status === 'canceled') {
            warning = 'The Stripe subscription is canceled — billing will not resume automatically. Create a new subscription from the member profile if recurring billing is needed.';
            console.warn(`[Admin Reactivate] Subscription ${membership.stripeSubscriptionId} is canceled in Stripe.`);
          }
          // active/trialing: no Stripe action needed, just update DB below
        } catch (stripeErr: any) {
          warning = `Could not reach Stripe to verify subscription: ${stripeErr.message}`;
          console.warn('[Admin Reactivate] Stripe lookup failed:', stripeErr.message);
        }
      }

      const updatedMembership = await storage.updateMembership(id, req.body);
      res.json({ ...updatedMembership, ...(warning ? { warning } : {}) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Cancel membership and Stripe subscription
  app.post("/api/admin/memberships/:id/cancel", isAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const { cancelImmediately = false, reason } = req.body;
      
      const membership = await storage.getMembershipById(id);
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }
      
      // Cancel Stripe subscription if exists
      if (membership.stripeSubscriptionId) {
        try {
          if (cancelImmediately) {
            // Cancel immediately - ends subscription now
            await stripe.subscriptions.del(membership.stripeSubscriptionId);
            console.log(`🔴 Cancelled subscription immediately: ${membership.stripeSubscriptionId}`);
          } else {
            // Cancel at period end - lets member keep access until end date
            await stripe.subscriptions.update(membership.stripeSubscriptionId, {
              cancel_at_period_end: true,
              metadata: {
                cancelReason: reason || 'Admin cancelled',
                cancelledBy: 'admin',
              }
            });
            console.log(`🟡 Subscription set to cancel at period end: ${membership.stripeSubscriptionId}`);
          }
        } catch (stripeError: any) {
          console.error('Failed to cancel Stripe subscription:', stripeError.message);
          // Continue with local cancellation even if Stripe fails
        }
      }
      
      // Update membership status locally
      const newStatus = cancelImmediately ? 'inactive' : 'active'; // Keep active until period end
      const updatedMembership = await storage.updateMembership(id, {
        status: newStatus,
        autoRenew: false,
      });
      
      res.json({
        success: true,
        membership: updatedMembership,
        message: cancelImmediately 
          ? 'Membership cancelled immediately' 
          : 'Membership will be cancelled at the end of the billing period'
      });
    } catch (error: any) {
      console.error('Error cancelling membership:', error);
      res.status(500).json({ message: error.message || "Failed to cancel membership" });
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

  // Get memberships without Stripe subscriptions
  app.get("/api/admin/memberships-without-subscription", isAdmin, async (req, res) => {
    try {
      const memberships = await storage.getMembershipsWithoutSubscription();
      res.json(memberships);
    } catch (error: any) {
      console.error('Failed to get memberships without subscription:', error);
      res.status(500).json({ message: "Failed to get memberships: " + error.message });
    }
  });

  // Migrate a membership to have a Stripe subscription
  app.post("/api/admin/memberships/:membershipId/create-subscription", isAdmin, async (req, res) => {
    try {
      const { membershipId } = req.params;
      const freshStripe = createStripeClient();
      
      // Get the membership
      const membership = await storage.getMembershipById(membershipId);
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }
      
      if (membership.stripeSubscriptionId) {
        return res.status(400).json({ message: "Membership already has a subscription" });
      }
      
      // Get the user
      const user = await storage.getUser(membership.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get the plan for this membership
      const plans = await storage.getAllMembershipPlans();
      const plan = plans.find(p => p.planType === membership.planType);
      
      if (!plan || !plan.stripePriceId) {
        return res.status(400).json({ 
          message: "No Stripe price configured for this plan. Please sync membership plans with Stripe first." 
        });
      }
      
      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await freshStripe.customers.create({
          email: user.email || undefined,
          name: `${user.firstName} ${user.lastName}`,
          phone: user.phoneNumber || undefined,
          metadata: {
            userId: user.id.toString(),
            membershipId: membership.membershipId,
          },
        });
        customerId = customer.id;
        await storage.updateUserStripeCustomerId(user.id, customerId);
      }
      
      // Check if user has a payment method
      const paymentMethods = await freshStripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });
      
      if (paymentMethods.data.length === 0) {
        // No payment method, return info for manual setup
        return res.status(400).json({ 
          message: "No payment method on file. The member needs to add a card before creating a subscription.",
          customerId,
          needsPaymentMethod: true
        });
      }
      
      // Set default payment method
      const defaultPaymentMethod = paymentMethods.data[0].id;
      await freshStripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: defaultPaymentMethod }
      });
      
      // Calculate trial period based on membership end date
      const endDate = new Date(membership.endDate);
      const now = new Date();
      
      // Calculate days until membership ends (for trial period)
      let trialDays = 0;
      let trialEnd: number | undefined;
      
      if (endDate > now) {
        // Membership still active - set trial until end date so first charge is when membership expires
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        trialEnd = Math.floor(endDate.getTime() / 1000);
        trialDays = daysRemaining;
      } else {
        // Membership already expired - charge immediately (no trial)
        trialEnd = undefined;
        trialDays = 0;
      }
      
      // Create subscription with trial if membership is still active
      const subscriptionParams: any = {
        customer: customerId,
        items: [{ price: plan.stripePriceId }],
        default_payment_method: defaultPaymentMethod,
        metadata: {
          source: 'admin_migration',
          membershipId: membership.membershipId,
          userId: user.id.toString(),
        },
      };
      
      // Add trial_end if membership hasn't expired yet
      if (trialEnd) {
        subscriptionParams.trial_end = trialEnd;
      }
      
      const subscription = await freshStripe.subscriptions.create(subscriptionParams);
      
      // Update membership with subscription ID
      await storage.updateMembership(membership.membershipId, {
        stripeSubscriptionId: subscription.id,
      });
      
      console.log(`✅ Created subscription for membership ${membershipId}:`, subscription.id);
      
      // Calculate next billing date
      const nextBillingDate = trialEnd 
        ? new Date(trialEnd * 1000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      res.json({ 
        message: "Subscription created successfully",
        subscriptionId: subscription.id,
        nextBillingDate,
      });
    } catch (error: any) {
      console.error('Failed to create subscription:', error);
      res.status(500).json({ message: "Failed to create subscription: " + error.message });
    }
  });

  // Admin: Create membership for a member with subscription
  app.post("/api/admin/members/:userId/membership", isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      
      // Validate request body
      const bodySchema = z.object({
        planType: z.enum(['basic', 'premium', 'vip']),
      });
      
      const parseResult = bodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid plan type. Must be basic, premium, or vip." });
      }
      
      const { planType } = parseResult.data;
      
      // Get the user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user already has a membership
      const existingMembership = await storage.getMembershipByUserId(userId);
      if (existingMembership) {
        return res.status(400).json({ message: "User already has a membership. Please update or remove the existing one first." });
      }
      
      // Get the plan details
      const allPlans = await storage.getAllMembershipPlans();
      const plan = allPlans.find(p => p.planType === planType && p.isActive);
      if (!plan) {
        return res.status(404).json({ message: "Active membership plan not found for this type" });
      }
      
      if (!plan.stripePriceId) {
        return res.status(400).json({ message: "This plan doesn't have Stripe pricing configured" });
      }
      
      // Check if user has a Stripe customer ID
      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: "User doesn't have a Stripe customer ID. Please add a payment method first." });
      }
      
      // Check if user has a payment method
      const freshStripe = createStripeClient();
      const paymentMethods = await freshStripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card',
      });
      
      if (paymentMethods.data.length === 0) {
        return res.status(400).json({ message: "User doesn't have a saved payment method. Please add one first." });
      }
      
      // Set default payment method
      const defaultPaymentMethod = paymentMethods.data[0].id;
      await freshStripe.customers.update(user.stripeCustomerId, {
        invoice_settings: { default_payment_method: defaultPaymentMethod }
      });
      
      // Create membership - starts today, ends in 30 days
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      
      const membershipId = `WMW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      // Create subscription - charges immediately for first month, then recurring
      // This matches the subscription behavior used elsewhere in the system
      const subscription = await freshStripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [{ price: plan.stripePriceId }],
        default_payment_method: defaultPaymentMethod,
        metadata: {
          source: 'admin_portal',
          userId: userId.toString(),
          membershipId,
        },
      });
      
      // Create the membership
      const membership = await storage.createMembership({
        membershipId,
        planType,
        userId,
        status: 'active',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        autoRenew: true,
        stripeSubscriptionId: subscription.id,
      });
      
      console.log(`✅ Admin created membership for user ${userId}:`, membershipId);
      
      res.json({
        message: "Membership created successfully",
        membershipId,
        subscriptionId: subscription.id,
        nextBillingDate: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
      });
    } catch (error: any) {
      console.error('Failed to create membership:', error);
      res.status(500).json({ message: "Failed to create membership: " + error.message });
    }
  });

  // Admin: Remove/delete membership
  app.delete("/api/admin/memberships/:membershipId", isAdmin, async (req, res) => {
    try {
      const { membershipId } = req.params;
      
      // Get the membership
      const membership = await storage.getMembershipById(membershipId);
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }
      
      // If there's a Stripe subscription, cancel it
      if (membership.stripeSubscriptionId) {
        const freshStripe = createStripeClient();
        try {
          await freshStripe.subscriptions.del(membership.stripeSubscriptionId);
          console.log(`Cancelled Stripe subscription: ${membership.stripeSubscriptionId}`);
        } catch (stripeError: any) {
          console.error('Failed to cancel Stripe subscription:', stripeError);
          // Continue even if Stripe cancel fails (subscription might already be cancelled)
        }
      }
      
      // Delete the membership
      await storage.deleteMembership(membershipId);
      
      console.log(`✅ Admin deleted membership: ${membershipId}`);
      
      res.json({ message: "Membership removed successfully" });
    } catch (error: any) {
      console.error('Failed to remove membership:', error);
      res.status(500).json({ message: "Failed to remove membership: " + error.message });
    }
  });

  // Admin: Get all active punch cards with user info
  app.get("/api/admin/active-punch-cards", isAdmin, async (req, res) => {
    try {
      const punchCards = await storage.getActiveDayPassHolders();
      res.json(punchCards);
    } catch (error) {
      console.error("Error fetching active punch cards:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: Add days/punches to an existing day pass
  app.post("/api/admin/punch-cards/:id/add-punches", isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { punchesToAdd } = req.body;
      
      if (!punchesToAdd || punchesToAdd < 1) {
        return res.status(400).json({ message: "Must add at least 1 day" });
      }
      
      const updatedCard = await storage.addPunchesToCard(id, punchesToAdd);
      console.log(`✅ Admin added ${punchesToAdd} days to punch card ${id}`);
      res.json(updatedCard);
    } catch (error: any) {
      console.error("Error adding punches to card:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  // Admin punch card template management
  app.get("/api/admin/punch-card-templates", isAdmin, async (req, res) => {
    try {
      const templates = await storage.getAllPunchCardTemplates();
      // Attach sold count to each template so admin can see stock usage
      const withCounts = await Promise.all(
        templates.map(async (t) => ({
          ...t,
          soldCount: await storage.countPunchCardsByTemplateId(t.id),
        }))
      );
      res.json(withCounts);
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
      // Filter to only return active templates that still have stock available
      const available = await Promise.all(
        templates.filter(t => t.isActive).map(async (t) => {
          if (t.stockLimit === null || t.stockLimit === undefined) return t;
          const sold = await storage.countPunchCardsByTemplateId(t.id);
          return sold < t.stockLimit ? t : null;
        })
      );
      res.json(available.filter(Boolean));
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
          // Enforce stock limit
          if (template.stockLimit !== null && template.stockLimit !== undefined) {
            const sold = await storage.countPunchCardsByTemplateId(template.id);
            if (sold + quantity > template.stockLimit) {
              const remaining = Math.max(0, template.stockLimit - sold);
              return res.status(400).json({
                message: remaining === 0
                  ? `"${template.name}" is sold out.`
                  : `"${template.name}" only has ${remaining} package${remaining === 1 ? '' : 's'} remaining.`
              });
            }
          }
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
            // Safety check: enforce stock limit at finalize time as well
            if (template.stockLimit !== null && template.stockLimit !== undefined) {
              const sold = await storage.countPunchCardsByTemplateId(template.id);
              if (sold + quantity > template.stockLimit) {
                const remaining = Math.max(0, template.stockLimit - sold);
                return res.status(400).json({
                  message: remaining === 0
                    ? `"${template.name}" is sold out.`
                    : `"${template.name}" only has ${remaining} package${remaining === 1 ? '' : 's'} remaining.`
                });
              }
            }
            
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

  // Admin/Staff member search for manual check-in and punch deduction
  app.get("/api/admin/member-search", async (req, res) => {
    if (!req.isAuthenticated() || (req.user?.role !== 'admin' && req.user?.role !== 'staff')) {
      return res.sendStatus(403);
    }
    
    try {
      const query = (req.query.q as string || '').trim();
      
      if (query.length < 2) {
        return res.json([]);
      }

      // Search for members by name or email
      const allMembers = await storage.getAllMembers();
      const searchLower = query.toLowerCase();
      
      const matchingMembers = allMembers
        .filter(member => 
          member.firstName?.toLowerCase().includes(searchLower) ||
          member.lastName?.toLowerCase().includes(searchLower) ||
          member.email?.toLowerCase().includes(searchLower)
        )
        .slice(0, 10);

      // Get day pass info for each member
      const results = await Promise.all(matchingMembers.map(async (member) => {
        const punchCards = await storage.getPunchCardsByUserId(member.id);
        const dayPassesRemaining = punchCards
          .filter(card => card.status === 'active' && card.remainingPunches > 0)
          .reduce((sum, card) => sum + card.remainingPunches, 0);

        return {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          membershipId: member.membership?.membershipId || null,
          membershipStatus: member.membership?.status || 'none',
          dayPassesRemaining
        };
      }));

      res.json(results);
    } catch (error: any) {
      console.error("Admin member search error:", error);
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

  // Manual punch deduction (without check-in) for staff/admin
  app.post("/api/admin/manual-punch-deduction", async (req, res) => {
    if (!req.isAuthenticated() || (req.user.role !== 'admin' && req.user.role !== 'staff')) {
      return res.sendStatus(403);
    }
    
    try {
      const { userId, reason } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "Member not found" });
      }

      const punchCards = await storage.getPunchCardsByUserId(userId);
      const activeDayPasses = punchCards.filter(card => 
        card.status === 'active' && card.remainingPunches > 0
      );
      
      if (activeDayPasses.length === 0) {
        return res.status(400).json({ message: "No day passes available to deduct" });
      }
      
      // Use the oldest day pass
      const oldestDayPass = activeDayPasses.sort((a, b) => 
        new Date(a.purchasedAt || new Date()).getTime() - new Date(b.purchasedAt || new Date()).getTime()
      )[0];
      
      const updatedCard = await storage.usePunchCardEntry(oldestDayPass.id);
      
      console.log(`Manual punch deduction for user ${userId} by ${req.user.email}. Reason: ${reason || 'Not specified'}`);

      res.status(200).json({ 
        message: "Punch deducted successfully",
        member: { 
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email 
        },
        remainingPunches: updatedCard.remainingPunches
      });
    } catch (error: any) {
      console.error("Manual punch deduction error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin check-ins route with pagination
  app.get("/api/admin/check-ins", async (req, res) => {
    if (!req.isAuthenticated() || (req.user.role !== 'admin' && req.user.role !== 'staff')) {
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

      // Hash and update password
      const salt = randomBytes(16).toString("hex");
      const hashedPassword = await scryptAsync(newPassword, salt, 64) as Buffer;
      const hashedPasswordString = `${hashedPassword.toString('hex')}.${salt}`;
      await storage.updateUserPassword(user.id, hashedPasswordString);
      
      // Mark token as used
      await storage.markTokenAsUsed(resetToken.id);

      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("SMS reset verification error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Email Password Reset - Request code
  app.post("/api/password-reset-request", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ emailSent: true, message: "If an account exists with this email, a reset code will be sent." });
      }

      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await storage.createPasswordResetToken({
        userId: user.id,
        token: resetCode,
        method: 'email',
        expiresAt,
        used: false
      });

      const emailSent = await sendPasswordResetEmail(email, resetCode, user.firstName || undefined);

      if (emailSent) {
        res.json({ emailSent: true, message: "Reset code sent to your email." });
      } else {
        res.status(500).json({ message: "Failed to send reset email. Please try again later." });
      }
    } catch (error: any) {
      console.error("Email password reset request error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Email Password Reset - Verify code and reset password
  app.post("/api/password-reset", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Reset code and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken || resetToken.used || resetToken.method !== 'email') {
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "Reset code has expired" });
      }

      const salt = randomBytes(16).toString("hex");
      const hashedPassword = await scryptAsync(newPassword, salt, 64) as Buffer;
      const hashedPasswordString = `${hashedPassword.toString('hex')}.${salt}`;
      await storage.updateUserPassword(resetToken.userId, hashedPasswordString);

      await storage.markTokenAsUsed(resetToken.id);

      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Email password reset error:", error);
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
      
      const { startTime, endTime, capacity, isEnabled, bookingGraceMinutes, availableDays } = req.body;
      const updateData: any = {
        startTime,
        endTime,
        capacity,
        isEnabled,
        bookingGraceMinutes,
      };
      if (availableDays !== undefined) {
        if (!Array.isArray(availableDays) || availableDays.length === 0) {
          return res.status(400).json({ message: "At least one available day must be selected" });
        }
        const validDays = availableDays.every((d: any) => Number.isInteger(d) && d >= 0 && d <= 6);
        if (!validDays) {
          return res.status(400).json({ message: "Available days must be integers between 0 (Sunday) and 6 (Saturday)" });
        }
        updateData.availableDays = availableDays;
      }
      const updated = await storage.updateSessionConfig(sessionType, updateData);
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

  app.get("/api/business-date", async (_req, res) => {
    try {
      const { DateTime } = await import('luxon');
      const BUSINESS_TIMEZONE = 'America/Chicago';
      const now = DateTime.now().setZone(BUSINESS_TIMEZONE);
      res.json({ today: now.toISODate(), timezone: BUSINESS_TIMEZONE });
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
      
      // Validate bookingDate is a valid date string
      if (!bookingDate || typeof bookingDate !== 'string') {
        return res.status(400).json({ message: "Booking date is required" });
      }
      
      const bookingDateObj = new Date(bookingDate);
      if (isNaN(bookingDateObj.getTime())) {
        return res.status(400).json({ message: "Invalid booking date format" });
      }
      
      // Check if session is enabled first
      const config = await storage.getSessionConfigByType(sessionType);
      if (!config || !config.isEnabled) {
        return res.status(400).json({ message: "This session is not available" });
      }
      
      // Use business timezone for all date/time comparisons
      const { DateTime } = await import('luxon');
      const BUSINESS_TIMEZONE = 'America/Chicago'; // Central Time - adjust as needed
      
      const nowInBusinessTz = DateTime.now().setZone(BUSINESS_TIMEZONE);
      const todayInBusinessTz = nowInBusinessTz.startOf('day');
      const bookingDateInBusinessTz = DateTime.fromISO(bookingDate, { zone: BUSINESS_TIMEZONE }).startOf('day');
      
      // Validate booking date is not in the past
      if (bookingDateInBusinessTz < todayInBusinessTz) {
        return res.status(400).json({ message: "Cannot book sessions for past dates" });
      }
      
      // Check if session is available on this day of the week
      const dayOfWeek = bookingDateInBusinessTz.weekday % 7; // Luxon: 1=Mon..7=Sun -> convert to 0=Sun..6=Sat
      const availableDays = config.availableDays ?? [0, 1, 2, 3, 4, 5, 6];
      if (!availableDays.includes(dayOfWeek)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return res.status(400).json({ 
          message: `The ${sessionType} session is not available on ${dayNames[dayOfWeek]}s.` 
        });
      }
      
      // Parse session time to minutes helper
      const parseTimeToMinutes = (timeStr: string): number => {
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
        
        if (isPM && hours !== 12) {
          hours += 12;
        } else if (isAM && hours === 12) {
          hours = 0;
        }
        
        return hours * 60 + minutes;
      };
      
      // For same-day bookings, check if the session time window is still open for booking
      if (bookingDateInBusinessTz.equals(todayInBusinessTz)) {
        const currentMinutes = nowInBusinessTz.hour * 60 + nowInBusinessTz.minute;
        const sessionStartMinutes = parseTimeToMinutes(config.startTime);
        const sessionEndMinutes = parseTimeToMinutes(config.endTime);
        
        const bookingGraceMinutes = config.bookingGraceMinutes ?? 60;
        const bookingCutoffMinutes = Math.max(sessionStartMinutes + bookingGraceMinutes, sessionEndMinutes);
        
        if (currentMinutes >= bookingCutoffMinutes) {
          return res.status(400).json({ 
            message: `The ${sessionType} session booking window has closed. Please book a future session.` 
          });
        }
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
      
      const booking = await storage.createSessionBooking({
        userId: req.user!.id,
        sessionType,
        bookingDate,
        status: 'confirmed'
      });
      
      // Send email notification to info@wolfmothertulsa.com
      const user = req.user!;
      const memberName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      sendSessionBookingNotification(memberName, user.email, sessionType, bookingDate)
        .catch(err => console.error('Failed to send session booking notification:', err));
      
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

  // ============================================
  // GIFT CARD ROUTES
  // ============================================

  // Admin: List all gift cards with pagination, search, and status filter
  app.get("/api/admin/gift-cards", isAdminOrStaff, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const result = await storage.getAllGiftCards(page, pageSize, status, search);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get single gift card with redemption history
  app.get("/api/admin/gift-cards/:id", isAdminOrStaff, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const card = await storage.getGiftCardById(id);
      if (!card) {
        return res.status(404).json({ message: "Gift card not found" });
      }
      const redemptions = await storage.getRedemptionsByGiftCardId(id);
      res.json({ ...card, redemptions });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update gift card
  app.put("/api/admin/gift-cards/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const card = await storage.updateGiftCard(id, req.body);
      res.json(card);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Create gift card manually (for in-person sales)
  app.post("/api/admin/gift-cards", isAdmin, async (req, res) => {
    try {
      const code = randomBytes(8).toString('hex').toUpperCase();
      const { type, initialAmount, purchaserEmail, purchaserName, recipientEmail, recipientName, personalMessage, expiresAt } = req.body;

      if (!initialAmount || !purchaserEmail || !purchaserName || !recipientEmail || !recipientName) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const card = await storage.createGiftCard({
        code,
        type: type || 'monetary',
        initialAmount,
        remainingAmount: initialAmount,
        status: 'active',
        purchaserEmail,
        purchaserName,
        recipientEmail,
        recipientName,
        personalMessage: personalMessage || null,
        stripePaymentIntentId: null,
        redeemedByUserId: null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      sendGiftCardEmail(
        recipientEmail,
        recipientName,
        purchaserName,
        code,
        type || 'monetary',
        initialAmount,
        personalMessage
      ).then(async (sent) => {
        if (sent) {
          await storage.updateGiftCard(card.id, { emailSent: true, emailSentAt: new Date() });
        }
      }).catch(err => console.error('Failed to send gift card email:', err));

      res.status(201).json(card);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: List all denominations
  app.get("/api/admin/gift-card-denominations", isAdminOrStaff, async (req, res) => {
    try {
      const denominations = await storage.getAllDenominations();
      res.json(denominations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Create denomination
  app.post("/api/admin/gift-card-denominations", isAdmin, async (req, res) => {
    try {
      const denomination = await storage.createDenomination(req.body);
      res.status(201).json(denomination);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update denomination
  app.put("/api/admin/gift-card-denominations/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const denomination = await storage.updateDenomination(id, req.body);
      res.json(denomination);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Delete denomination
  app.delete("/api/admin/gift-card-denominations/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDenomination(id);
      res.json({ message: "Denomination deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public: Get active denominations (for purchase page)
  app.get("/api/gift-card-denominations", async (req, res) => {
    try {
      const denominations = await storage.getActiveDenominations();
      res.json(denominations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public: Check gift card balance
  app.get("/api/gift-cards/check/:code", async (req, res) => {
    try {
      const card = await storage.getGiftCardByCode(req.params.code);
      if (!card) {
        return res.status(404).json({ message: "Gift card not found" });
      }
      res.json({
        code: card.code,
        type: card.type,
        status: card.status,
        initialAmount: card.initialAmount,
        remainingAmount: card.remainingAmount,
        expiresAt: card.expiresAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public: Purchase a gift card (no auth required - guest checkout supported)
  app.post("/api/gift-cards/purchase", async (req, res) => {
    try {
      const { denominationId, recipientEmail, recipientName, personalMessage, purchaserEmail, purchaserName } = req.body;

      if (!denominationId || !recipientEmail || !recipientName) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const denominations = await storage.getActiveDenominations();
      const denomination = denominations.find(d => d.id === denominationId);
      if (!denomination) {
        return res.status(404).json({ message: "Denomination not found" });
      }

      const code = randomBytes(8).toString('hex').toUpperCase();

      const buyerEmail = req.isAuthenticated() ? req.user!.email : (purchaserEmail || recipientEmail);
      const buyerName = req.isAuthenticated() ? `${req.user!.firstName} ${req.user!.lastName}` : (purchaserName || 'Guest');

      const paymentIntent = await stripe.paymentIntents.create({
        amount: denomination.price,
        currency: 'usd',
        metadata: {
          type: 'gift_card_purchase',
          giftCardCode: code,
          denominationId: denomination.id.toString(),
        },
      });

      const card = await storage.createGiftCard({
        code,
        type: denomination.type,
        initialAmount: denomination.value,
        remainingAmount: denomination.value,
        status: 'active',
        purchaserEmail: buyerEmail,
        purchaserName: buyerName,
        recipientEmail,
        recipientName,
        personalMessage: personalMessage || null,
        stripePaymentIntentId: paymentIntent.id,
        redeemedByUserId: null,
        expiresAt: null,
      });

      sendGiftCardEmail(
        recipientEmail,
        recipientName,
        buyerName,
        code,
        denomination.type,
        denomination.value,
        personalMessage
      ).then(async (sent) => {
        if (sent) {
          await storage.updateGiftCard(card.id, { emailSent: true, emailSentAt: new Date() });
        }
      }).catch(err => console.error('Failed to send gift card email:', err));

      res.status(201).json({
        giftCard: card,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Authenticated: Redeem a gift card
  app.post("/api/gift-cards/redeem", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Gift card code is required" });
      }

      const card = await storage.getGiftCardByCode(code);
      if (!card) {
        return res.status(404).json({ message: "Gift card not found" });
      }
      if (card.status !== 'active') {
        return res.status(400).json({ message: `Gift card is ${card.status}` });
      }
      if (card.expiresAt && new Date(card.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Gift card has expired" });
      }
      if (card.remainingAmount <= 0) {
        return res.status(400).json({ message: "Gift card has no remaining balance" });
      }

      const userId = req.user!.id;

      if (card.type === 'day_pass_bundle') {
        const punchCard = await storage.createPunchCard({
          userId,
          name: `Gift Card Day Pass Bundle`,
          totalPunches: card.remainingAmount,
          remainingPunches: card.remainingAmount,
          pricePerPunch: 0,
          totalPrice: 0,
          status: 'active',
        });

        const redeemedCard = await storage.redeemGiftCard(
          card.id,
          userId,
          card.remainingAmount,
          `Redeemed ${card.remainingAmount} day passes`
        );

        res.json({ giftCard: redeemedCard, punchCard });
      } else {
        const amountInCents = card.remainingAmount;

        await storage.createPayment({
          userId,
          amount: amountInCents,
          description: `Gift card credit (${card.code})`,
          status: 'successful',
          method: 'credit_card',
        });

        const redeemedCard = await storage.redeemGiftCard(
          card.id,
          userId,
          amountInCents,
          `Redeemed $${(amountInCents / 100).toFixed(2)} credit`
        );

        res.json({ giftCard: redeemedCard });
      }
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

  // FAQ item routes (Admin)
  app.get("/api/admin/faq-items", isAdminOrStaff, async (req, res) => {
    try {
      const items = await storage.getAllFaqItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/faq-items", isAdminOrStaff, async (req, res) => {
    try {
      const { insertFaqItemSchema } = await import("@shared/schema");
      const validatedData = insertFaqItemSchema.parse(req.body);
      const item = await storage.createFaqItem(validatedData);
      res.status(201).json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/faq-items/:id", isAdminOrStaff, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateFaqItem(id, req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/faq-items/:id", isAdminOrStaff, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFaqItem(id);
      res.json({ message: "FAQ item deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public FAQ route
  app.get("/api/faq-items", async (req, res) => {
    try {
      const items = await storage.getActiveFaqItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Site settings route (Admin only)
  app.post("/api/admin/site-settings", isAdmin, async (req, res) => {
    try {
      const settings = req.body;
      console.log('📝 Saving site settings:', settings);
      
      // Get existing settings to merge with updates
      const existingFooterSettings = await storage.getLandingPageContentBySection('footer');
      const existingValues: Record<string, string> = {};
      for (const setting of existingFooterSettings) {
        existingValues[setting.key] = setting.value;
      }
      console.log('📋 Existing values:', existingValues);
      
      // Only update fields that are explicitly provided (not undefined)
      // This prevents accidentally overwriting with empty strings
      const settingsToSave = [
        { section: 'footer', key: 'hoursOfOperation', value: settings.hoursOfOperation !== undefined ? settings.hoursOfOperation : existingValues.hoursOfOperation || '', isActive: true },
        { section: 'footer', key: 'hoursMembers', value: settings.hoursMembers !== undefined ? settings.hoursMembers : existingValues.hoursMembers || '', isActive: true },
        { section: 'footer', key: 'hoursDayPass', value: settings.hoursDayPass !== undefined ? settings.hoursDayPass : existingValues.hoursDayPass || '', isActive: true },
        { section: 'footer', key: 'address', value: settings.address !== undefined ? settings.address : existingValues.address || '', isActive: true },
        { section: 'footer', key: 'addressLine2', value: settings.addressLine2 !== undefined ? settings.addressLine2 : existingValues.addressLine2 || '', isActive: true },
        { section: 'footer', key: 'copyrightYear', value: settings.copyrightYear !== undefined ? settings.copyrightYear : existingValues.copyrightYear || '', isActive: true },
        { section: 'footer', key: 'instagramHandle', value: settings.instagramHandle !== undefined ? settings.instagramHandle : existingValues.instagramHandle || '', isActive: true },
      ];

      // Delete existing footer settings
      console.log('🗑️ Deleting existing footer settings:', existingFooterSettings.length);
      for (const setting of existingFooterSettings) {
        await storage.deleteLandingPageContent(setting.id);
      }

      // Create new settings
      console.log('✅ Creating new settings:', settingsToSave.map(s => ({ key: s.key, value: s.value })));
      for (const setting of settingsToSave) {
        await storage.createLandingPageContent(setting);
      }

      res.json({ message: 'Site settings saved successfully' });
    } catch (error: any) {
      console.error('❌ Error saving site settings:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Site configuration settings (using site_settings table)
  // Public route to get max memberships per purchase (needed by kiosk before auth)
  app.get("/api/settings/max-memberships", async (req, res) => {
    try {
      const setting = await storage.getSiteSetting('maxMembershipsPerPurchase');
      const maxMemberships = setting ? parseInt(setting.value) : 4; // Default to 4
      res.json({ maxMemberships });
    } catch (error: any) {
      console.error('Error getting max memberships setting:', error);
      res.json({ maxMemberships: 4 }); // Default fallback
    }
  });

  // Daily capacity setting (public read)
  app.get("/api/settings/daily-capacity", async (req, res) => {
    try {
      const setting = await storage.getSiteSetting('dailyCapacity');
      const dailyCapacity = setting ? parseInt(setting.value) : 50;
      res.json({ dailyCapacity });
    } catch (error: any) {
      res.json({ dailyCapacity: 50 });
    }
  });

  // Admin: update daily capacity
  app.put("/api/admin/settings/daily-capacity", isAdmin, async (req, res) => {
    try {
      const { dailyCapacity } = req.body;
      if (typeof dailyCapacity !== 'number' || dailyCapacity < 1) {
        return res.status(400).json({ message: "dailyCapacity must be a positive number" });
      }
      await storage.upsertSiteSetting('dailyCapacity', String(dailyCapacity), 'Maximum daily space capacity for waitlist tracking');
      res.json({ dailyCapacity });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: get waitlist entries for a date
  app.get("/api/admin/waitlist", isAdminOrStaff, async (req, res) => {
    try {
      const { DateTime } = await import('luxon');
      const dateParam = req.query.date as string;
      const date = dateParam || DateTime.now().setZone('America/Chicago').toFormat('yyyy-MM-dd');
      const entries = await storage.getWaitlistEntries(date);
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: add waitlist entry
  app.post("/api/admin/waitlist", isAdminOrStaff, async (req, res) => {
    try {
      const { insertWaitlistSchema } = await import('@shared/schema');
      const parsed = insertWaitlistSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const entry = await storage.createWaitlistEntry(parsed.data);
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: update waitlist entry status
  app.patch("/api/admin/waitlist/:id", isAdminOrStaff, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      if (!['pending', 'notified', 'removed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Fetch the entry before updating so we have contact details
      const existing = await storage.getWaitlistEntryById(id);

      const entry = await storage.updateWaitlistEntry(id, { status });

      // When marking as notified, send email and/or SMS
      if (status === 'notified' && existing) {
        const notificationResults: string[] = [];

        if (existing.email) {
          const emailSent = await sendWaitlistNotificationEmail(existing.email, existing.name, existing.date);
          notificationResults.push(emailSent ? 'email sent' : 'email failed');
        }

        if (existing.phone) {
          const smsSent = await sendWaitlistNotificationSMS(existing.phone, existing.name, existing.date);
          notificationResults.push(smsSent ? 'SMS sent' : 'SMS failed');
        }

        if (notificationResults.length === 0) {
          notificationResults.push('no contact info — status updated only');
        }

        console.log(`[Waitlist] Notified entry ${id} (${existing.name}): ${notificationResults.join(', ')}`);
        return res.json({ ...entry, notificationResults });
      }

      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: delete waitlist entry
  app.delete("/api/admin/waitlist/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWaitlistEntry(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =========================================================
  // Special Events
  // =========================================================

  // Public: get all upcoming active events (for member dashboard)
  app.get("/api/events", isAuthenticated, async (req, res) => {
    try {
      const allEvents = await storage.getEvents(false);
      res.json(allEvents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: get all events (including inactive)
  app.get("/api/admin/events", isAdminOrStaff, async (req, res) => {
    try {
      const allEvents = await storage.getEvents(true);
      const withBookings = await Promise.all(
        allEvents.map(async (event) => {
          const bookings = await storage.getEventBookingsByEventIdWithUsers(event.id);
          return {
            ...event,
            bookedCount: bookings.length,
            bookings: bookings.map(b => ({
              id: b.id,
              userId: b.user.id,
              firstName: b.user.firstName,
              lastName: b.user.lastName,
              email: b.user.email,
              createdAt: b.createdAt,
            })),
          };
        })
      );
      res.json(withBookings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: create event
  app.post("/api/admin/events", isAdmin, async (req, res) => {
    try {
      const data = req.body;
      if (!data.title || !data.date || !data.startTime || !data.endTime) {
        return res.status(400).json({ message: "title, date, startTime, and endTime are required" });
      }
      const event = await storage.createEvent(data);
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: update event
  app.patch("/api/admin/events/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getEventById(id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      const updated = await storage.updateEvent(id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: delete event
  app.delete("/api/admin/events/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEvent(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Member: get my event bookings
  app.get("/api/event-bookings", isAuthenticated, async (req, res) => {
    try {
      const bookings = await storage.getEventBookingsByUserId(req.user!.id);
      res.json(bookings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Member: book an event (free events only)
  app.post("/api/event-bookings", isAuthenticated, async (req, res) => {
    try {
      const { eventId } = req.body;
      if (!eventId) return res.status(400).json({ message: "eventId is required" });

      const event = await storage.getEventById(eventId);
      if (!event || !event.isActive) {
        return res.status(404).json({ message: "Event not found or no longer available" });
      }

      if (event.price && event.price > 0) {
        return res.status(400).json({ message: "This event requires payment. Please use the paid booking flow." });
      }

      // Enforce members-only restriction
      if (event.membersOnly) {
        const membership = await storage.getMembershipByUserId(req.user!.id);
        if (!membership || membership.status !== 'active') {
          return res.status(403).json({ message: "This event is for monthly members only. Please sign up for a membership to book." });
        }
      }

      // Check capacity
      const existingBookings = await storage.getEventBookingsByEventId(eventId);
      if (existingBookings.length >= event.capacity) {
        return res.status(400).json({ message: "This event is fully booked" });
      }

      // Check for duplicate booking
      const alreadyBooked = await storage.getEventBookingByUserAndEvent(req.user!.id, eventId);
      if (alreadyBooked) {
        return res.status(400).json({ message: "You have already booked this event" });
      }

      const booking = await storage.createEventBooking({ userId: req.user!.id, eventId, status: 'confirmed' });
      res.json(booking);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Member: pay and book a priced event
  app.post("/api/event-bookings/pay", isAuthenticated, async (req, res) => {
    try {
      const { eventId } = req.body;
      if (!eventId) return res.status(400).json({ message: "eventId is required" });

      const event = await storage.getEventById(eventId);
      if (!event || !event.isActive) {
        return res.status(404).json({ message: "Event not found or no longer available" });
      }
      if (!event.price || event.price <= 0) {
        return res.status(400).json({ message: "This event is free — use the standard booking endpoint." });
      }

      // Enforce members-only restriction
      if (event.membersOnly) {
        const membership = await storage.getMembershipByUserId(req.user!.id);
        if (!membership || membership.status !== 'active') {
          return res.status(403).json({ message: "This event is for monthly members only. Please sign up for a membership to book." });
        }
      }

      // Check capacity
      const existingBookings = await storage.getEventBookingsByEventId(eventId);
      if (existingBookings.length >= event.capacity) {
        return res.status(400).json({ message: "This event is fully booked" });
      }

      // Check for duplicate booking
      const alreadyBooked = await storage.getEventBookingByUserAndEvent(req.user!.id, eventId);
      if (alreadyBooked && alreadyBooked.status === 'confirmed') {
        return res.status(400).json({ message: "You have already booked this event" });
      }

      // Get user's default payment method
      const user = req.user!;
      const paymentMethods = await storage.getPaymentMethodsByUserId(user.id);
      const defaultMethod = paymentMethods.find(pm => pm.isDefault) || paymentMethods[0];

      if (!user.stripeCustomerId || !defaultMethod?.stripePaymentMethodId) {
        return res.status(400).json({
          message: "No payment method on file. Please add a card from your dashboard first.",
          requiresPaymentMethod: true,
        });
      }

      const freshStripe = createStripeClient();

      // Charge the saved card off-session
      const paymentIntent = await freshStripe.paymentIntents.create({
        amount: event.price,
        currency: 'usd',
        customer: user.stripeCustomerId,
        payment_method: defaultMethod.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        description: `Event booking: ${event.title} — ${event.date}`,
        metadata: {
          eventId: event.id.toString(),
          userId: user.id.toString(),
          eventTitle: event.title,
          source: 'member_portal',
        },
      });

      // Payment succeeded — create the booking
      const booking = await storage.createEventBooking({
        userId: user.id,
        eventId,
        status: 'confirmed',
      });

      res.json({
        booking,
        charged: true,
        amountCharged: event.price,
        paymentIntentId: paymentIntent.id,
        message: `Booked! $${(event.price / 100).toFixed(2)} charged to your card on file.`,
      });
    } catch (error: any) {
      console.error("Event paid booking error:", error);
      if (error.code === 'card_declined') {
        return res.status(402).json({ message: "Your card was declined. Please check your payment method." });
      }
      if (error.code === 'authentication_required') {
        return res.status(402).json({ message: "Card requires authentication. Please update your payment method." });
      }
      res.status(500).json({ message: error.message || "Failed to complete booking" });
    }
  });

  // Member: cancel an event booking
  app.delete("/api/event-bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const booking = await storage.getEventBookingById(id);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== req.user!.id) return res.status(403).json({ message: "Not authorized" });
      const cancelled = await storage.cancelEventBooking(id);
      res.json(cancelled);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin route to get all site settings
  app.get("/api/admin/config-settings", isAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllSiteSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin route to update a site setting
  app.post("/api/admin/config-settings", isAdmin, async (req, res) => {
    try {
      const { key, value, description } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ message: "Key and value are required" });
      }
      const setting = await storage.upsertSiteSetting(key, String(value), description);
      res.json(setting);
    } catch (error: any) {
      console.error('Error updating site setting:', error);
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

  // Create Terminal PaymentIntent for item checkout (card reader)
  app.post("/api/staff/item-checkout-terminal-intent", isStaffOrAdmin, async (req, res) => {
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
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        description: `Item checkout: ${quantity}x ${item.name}${item.size ? ` (${item.size})` : ''} for ${user.firstName} ${user.lastName}`,
        metadata: {
          userId: userId.toString(),
          itemId: itemId.toString(),
          quantity: quantity.toString(),
          type: 'item_checkout',
        },
      });
      
      res.json({ paymentIntentId: paymentIntent.id });
    } catch (error: any) {
      console.error("Create item checkout terminal payment intent error:", error);
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
  // For memberships: Creates Stripe Subscription for recurring billing
  // For day passes: Creates one-time PaymentIntent
  app.post("/api/kiosk/create-member-payment", async (req, res) => {
    try {
      const { memberData, packageData, discountData, useTerminal, existingMemberId } = req.body;
      console.log('🎫 Kiosk create-member-payment request:', { memberData, packageData, discountData, useTerminal, existingMemberId });
      
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
      
      // Skip email check for existing members (they're purchasing additional day passes)
      if (!existingMemberId) {
        // Check if email already exists only for new members
        const existingUser = await storage.getUserByEmail(validatedMemberData.email);
        if (existingUser) {
          return res.status(400).json({ message: "Email already exists" });
        }
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
      
      // MEMBERSHIPS: Create Stripe Subscription for recurring billing
      if (validatedMemberData.packageType === 'membership') {
        // Get the membership plan to get the Stripe price ID
        const plans = await storage.getAllMembershipPlans();
        const plan = plans.find(p => p.id.toString() === validatedMemberData.packageId || p.planType === packageData.planType);
        
        if (!plan) {
          return res.status(400).json({ message: `Invalid membership plan: ${validatedMemberData.packageId}` });
        }
        
        if (!plan.stripePriceId) {
          return res.status(400).json({ 
            message: "Membership plan not configured for payments. Admin needs to sync with Stripe." 
          });
        }
        
        console.log('📋 Creating subscription for membership plan:', { planId: plan.id, planType: plan.planType, stripePriceId: plan.stripePriceId });
        
        // Create or get Stripe customer
        let customerId: string;
        
        if (existingMemberId) {
          // Existing member - get their customer ID
          const existingUser = await storage.getUser(existingMemberId);
          if (existingUser?.stripeCustomerId) {
            customerId = existingUser.stripeCustomerId;
          } else {
            // Create new customer for existing user
            const customer = await stripe.customers.create({
              email: validatedMemberData.email,
              name: `${validatedMemberData.firstName} ${validatedMemberData.lastName}`,
              phone: validatedMemberData.phoneNumber,
              metadata: { source: 'kiosk', existingMemberId: existingMemberId.toString() }
            });
            customerId = customer.id;
          }
        } else {
          // New member - create Stripe customer
          const customer = await stripe.customers.create({
            email: validatedMemberData.email,
            name: `${validatedMemberData.firstName} ${validatedMemberData.lastName}`,
            phone: validatedMemberData.phoneNumber,
            metadata: { source: 'kiosk' }
          });
          customerId = customer.id;
        }
        
        console.log('👤 Using Stripe customer:', customerId);
        
        // For Terminal payments, we need to use PaymentIntent with setup_future_usage
        // and then create the subscription after payment succeeds
        if (useTerminal) {
          // Terminal: Create PaymentIntent that saves the card for future use
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(finalAmount),
            currency: 'usd',
            customer: customerId,
            payment_method_types: ['card_present'],
            capture_method: 'automatic',
            setup_future_usage: 'off_session', // Save card for subscription
            description: `${packageData.name}${discountDescription} - ${validatedMemberData.firstName} ${validatedMemberData.lastName}`,
            metadata: {
              memberFirstName: validatedMemberData.firstName,
              memberLastName: validatedMemberData.lastName,
              memberEmail: validatedMemberData.email,
              memberPhone: validatedMemberData.phoneNumber || '',
              packageType: 'membership',
              packageId: validatedMemberData.packageId,
              packageName: packageData.name,
              planType: plan.planType,
              stripePriceId: plan.stripePriceId,
              customerId: customerId,
              isSubscription: 'true',
              useTerminal: 'true',
            },
          });
          
          console.log('💳 Created Terminal PaymentIntent for subscription:', paymentIntent.id);
          
          res.json({ 
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            customerId: customerId,
            isSubscription: true,
            stripePriceId: plan.stripePriceId,
          });
        } else {
          // Online: Use PaymentIntent-first approach (same as Terminal) for reliability
          // This creates a PaymentIntent that saves the card, then subscription is created after payment succeeds
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(finalAmount),
            currency: 'usd',
            customer: customerId,
            automatic_payment_methods: { enabled: true },
            setup_future_usage: 'off_session', // Save card for subscription
            description: `${packageData.name}${discountDescription} - ${validatedMemberData.firstName} ${validatedMemberData.lastName}`,
            metadata: {
              memberFirstName: validatedMemberData.firstName,
              memberLastName: validatedMemberData.lastName,
              memberEmail: validatedMemberData.email,
              memberPhone: validatedMemberData.phoneNumber || '',
              packageType: 'membership',
              packageId: validatedMemberData.packageId,
              packageName: packageData.name,
              planType: plan.planType,
              stripePriceId: plan.stripePriceId,
              customerId: customerId,
              isSubscription: 'true',
              useTerminal: 'false',
              source: 'kiosk',
            },
          });
          
          console.log('💳 Created Online PaymentIntent for subscription:', paymentIntent.id);
          
          res.json({ 
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            customerId: customerId,
            isSubscription: true,
            stripePriceId: plan.stripePriceId,
          });
        }
        return;
      }
      
      // DAY PASSES: Create one-time PaymentIntent (existing behavior)
      const dayPassQuantity = Math.min(Math.max(packageData.quantity || 1, 1), 10);
      const dayPassDescription = dayPassQuantity > 1 
        ? `${packageData.name} × ${dayPassQuantity}${discountDescription} - ${validatedMemberData.firstName} ${validatedMemberData.lastName}`
        : `${packageData.name}${discountDescription} - ${validatedMemberData.firstName} ${validatedMemberData.lastName}`;
      const paymentIntentConfig: any = {
        amount: Math.round(finalAmount),
        currency: 'usd',
        description: dayPassDescription,
        metadata: {
          memberFirstName: validatedMemberData.firstName,
          memberLastName: validatedMemberData.lastName,
          memberEmail: validatedMemberData.email,
          memberPhone: validatedMemberData.phoneNumber || '',
          packageType: validatedMemberData.packageType,
          packageId: validatedMemberData.packageId,
          packageName: packageData.name,
          quantity: dayPassQuantity.toString(),
          originalAmount: originalPrice.toString(),
          discountType: discountData?.type || '',
          discountValue: discountData?.value?.toString() || '',
          discountAmount: discountData?.amountCents?.toString() || '',
          discountReason: discountData?.reason || '',
          useTerminal: useTerminal ? 'true' : 'false',
        },
      };
      
      if (useTerminal) {
        paymentIntentConfig.payment_method_types = ['card_present'];
        paymentIntentConfig.capture_method = 'automatic';
      } else {
        paymentIntentConfig.automatic_payment_methods = { enabled: true };
      }
      
      const paymentIntent = await stripe.paymentIntents.create(paymentIntentConfig);
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        isSubscription: false,
      });
    } catch (error: any) {
      console.error("Kiosk member creation error:", error);
      res.status(500).json({ message: "Failed to create member payment: " + error.message });
    }
  });

  // Confirm member creation after successful payment
  // Handles both subscription (membership) and one-time (day pass) payments
  app.post("/api/kiosk/confirm-member-creation", async (req, res) => {
    try {
      const { paymentIntentId, subscriptionId, memberData, packageData, agreementData, discountData, existingMemberId, customerId, isSubscription, stripePriceId, additionalMembers } = req.body;
      console.log('🔄 Kiosk confirm-member-creation request:', { paymentIntentId, subscriptionId, memberData, packageData, agreementData, discountData, existingMemberId, isSubscription, additionalMembersCount: additionalMembers?.length || 0 });
      
      // EARLY VALIDATION: Reject if additional members exceed configured max
      // This must happen BEFORE any payment verification or membership creation
      const maxMembershipsSetting = await storage.getSiteSetting('maxMembershipsPerPurchase');
      const maxMembershipsTotal = maxMembershipsSetting ? parseInt(maxMembershipsSetting.value) : 4;
      const maxAdditionalMembers = maxMembershipsTotal - 1; // Subtract 1 for primary member
      
      if (additionalMembers && Array.isArray(additionalMembers) && additionalMembers.length > maxAdditionalMembers) {
        console.error(`❌ Early rejection: ${additionalMembers.length} additional members exceeds max of ${maxAdditionalMembers}`);
        return res.status(400).json({ 
          message: `Maximum of ${maxMembershipsTotal} memberships allowed per purchase (1 primary + ${maxAdditionalMembers} additional)`,
          error: "MAX_MEMBERSHIPS_EXCEEDED"
        });
      }
      
      // Validate agreement data only for new members (returning members already have waiver on file)
      let validatedAgreement = agreementData;
      if (!existingMemberId) {
        const agreementSchema = z.object({
          dateOfBirth: z.string().min(1, "Date of birth is required"),
          emergencyContact: z.string().min(1, "Emergency contact is required"),
          emergencyPhone: z.string().min(1, "Emergency phone is required"),
          healthConfirmation: z.boolean().refine(val => val === true, "Health confirmation required"),
          riskAcknowledgment: z.boolean().refine(val => val === true, "Risk acknowledgment required"),
          liabilityWaiver: z.boolean().refine(val => val === true, "Liability waiver required"),
          rulesAcceptance: z.boolean().refine(val => val === true, "Rules acceptance required"),
          ageConfirmation: z.boolean().refine(val => val === true, "Age confirmation required"),
        });
        
        validatedAgreement = agreementSchema.parse(agreementData);
        console.log('✅ Validated agreement data:', validatedAgreement);
      } else {
        console.log('⏭️ Skipping agreement validation for returning member:', existingMemberId);
      }
      
      // Verify payment was successful - expand latest_charge to access generated_card for Terminal
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.payment_method_details'],
      });
      console.log('💳 Payment Intent status:', paymentIntent.status, 'payment_method:', paymentIntent.payment_method);
      if (paymentIntent.status !== 'succeeded') {
        console.error(`❌ Payment not completed. PI ${paymentIntentId} status: ${paymentIntent.status}`);
        return res.status(400).json({ 
          message: `Payment not completed (status: ${paymentIntent.status}). Please wait a moment and try again.`,
          paymentStatus: paymentIntent.status,
        });
      }
      
      // For kiosk subscription payments (both Terminal and Online), create the subscription now
      let finalSubscriptionId = subscriptionId;
      if (isSubscription && !subscriptionId && paymentIntent.metadata?.isSubscription === 'true') {
        const customerIdFromIntent = paymentIntent.customer as string || customerId;
        const priceId = paymentIntent.metadata?.stripePriceId || stripePriceId;
        
        // For Terminal (card_present) payments, we need the generated_card PM, not the card_present PM.
        // card_present PMs can't be used for subscriptions - Stripe generates a reusable card PM.
        let savedPaymentMethodId = paymentIntent.payment_method as string;
        const isTerminalPayment = paymentIntent.metadata?.useTerminal === 'true';
        
        if (isTerminalPayment) {
          const latestCharge = (paymentIntent as any).latest_charge;
          const generatedCard = latestCharge?.payment_method_details?.card_present?.generated_card;
          if (generatedCard) {
            console.log('🔄 Terminal payment: using generated_card instead of card_present:', generatedCard);
            savedPaymentMethodId = generatedCard;
          } else {
            console.warn('⚠️ Terminal payment: no generated_card found, falling back to payment_method:', savedPaymentMethodId);
          }
        }
        
        if (savedPaymentMethodId && customerIdFromIntent && priceId) {
          console.log('📋 Creating subscription after kiosk payment:', { customerIdFromIntent, priceId, savedPaymentMethodId, useTerminal: paymentIntent.metadata?.useTerminal });
          
          // Attach the payment method to the customer explicitly
          try {
            await stripe.paymentMethods.attach(savedPaymentMethodId, { customer: customerIdFromIntent });
            console.log('✅ Payment method attached to customer:', savedPaymentMethodId);
          } catch (attachErr: any) {
            // If already attached (code: resource_already_exists), that's expected and fine
            if (attachErr.code === 'resource_already_exists' || attachErr.message?.includes('already been attached')) {
              console.log('ℹ️ Payment method already attached to customer (expected):', savedPaymentMethodId);
            } else {
              console.error('❌ Failed to attach payment method:', attachErr.code, attachErr.message);
              throw new Error('Failed to save card on file. Please try again.');
            }
          }
          
          // Set the payment method as default for invoices on the customer
          await stripe.customers.update(customerIdFromIntent, {
            invoice_settings: { default_payment_method: savedPaymentMethodId }
          });
          console.log('✅ Set default payment method on customer:', savedPaymentMethodId);
          
          // Create an active subscription with billing_cycle_anchor set 30 days from now.
          // The first month was already paid via the PaymentIntent, so the subscription's first
          // real charge happens at the anchor date (30 days out).
          // billing_cycle_anchor in the future + proration_behavior: 'none' = no immediate charge,
          // subscription status is 'active', and next billing date is the anchor.
          const billingAnchor = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now
          
          const subscription = await stripe.subscriptions.create({
            customer: customerIdFromIntent,
            items: [{ price: priceId }],
            default_payment_method: savedPaymentMethodId,
            billing_cycle_anchor: billingAnchor,
            proration_behavior: 'none',
            payment_behavior: 'allow_incomplete',
            metadata: {
              source: paymentIntent.metadata?.useTerminal === 'true' ? 'kiosk_terminal' : 'kiosk_online',
              memberEmail: memberData.email,
              firstPaymentIntentId: paymentIntentId,
            },
          });
          
          finalSubscriptionId = subscription.id;
          console.log('✅ Created subscription after kiosk payment:', {
            subscriptionId: finalSubscriptionId,
            status: subscription.status,
            nextBilling: new Date(billingAnchor * 1000).toISOString(),
            defaultPaymentMethod: savedPaymentMethodId,
          });
          
          if (subscription.status !== 'active') {
            console.warn('⚠️ Subscription created but status is:', subscription.status, '- expected active');
          }
        } else {
          const missingFields = [];
          if (!savedPaymentMethodId) missingFields.push('paymentMethod');
          if (!customerIdFromIntent) missingFields.push('customerId');
          if (!priceId) missingFields.push('priceId');
          console.error('❌ Missing required data for subscription creation:', missingFields.join(', '));
          return res.status(400).json({ error: `Missing required data for subscription: ${missingFields.join(', ')}` });
        }
      }
      
      let targetUser;
      
      // Check if we're adding a day pass to an existing member or creating new member
      if (existingMemberId) {
        console.log('📦 Adding day pass to existing member:', existingMemberId);
        targetUser = await storage.getUser(existingMemberId);
        if (!targetUser) {
          return res.status(404).json({ message: "Existing member not found" });
        }
      } else {
        // Create the member account with agreement data
        const salt = randomBytes(16).toString('hex');
        // Use provided password if set, otherwise generate a random one
        const passwordToHash = memberData.password && memberData.password.trim() 
          ? memberData.password 
          : Math.random().toString(36).slice(-8);
        const key = await scryptAsync(passwordToHash, salt, 64) as Buffer;
        
        targetUser = await storage.createUser({
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
          emergencyContact: agreementData?.emergencyContact,
          emergencyPhone: agreementData?.emergencyPhone,
        });
        
        // Log whether a password was set for debugging
        console.log(`Member created with ${memberData.password ? 'custom' : 'random'} password`);
      }
      
      // Use targetUser instead of newUser for remainder of function
      const newUser = targetUser;
      
      // Track additional members created (for multi-membership purchases)
      let additionalMembersCreated: Array<{email: string, firstName: string, lastName: string, status: 'created' | 'existing' | 'failed', message?: string}> = [];
      
      // Create membership or punch card based on package type
      if (memberData.packageType === 'membership') {
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        const membershipId = `WM-${Date.now()}-${Math.random().toString(36).slice(-4).toUpperCase()}`;
        
        // Get Stripe customer ID from payment intent or provided customerId
        const stripeCustomerId = (paymentIntent.customer as string) || customerId;
        
        // Update user with Stripe customer ID if not already set
        if (stripeCustomerId && !newUser.stripeCustomerId) {
          await storage.updateUserStripeCustomerId(newUser.id, stripeCustomerId);
        }
        
        await storage.createMembership({
          membershipId: membershipId,
          userId: newUser.id,
          planType: packageData.planType || 'basic',
          status: 'active',
          startDate: new Date().toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          autoRenew: true,
          stripeSubscriptionId: finalSubscriptionId || undefined, // Save subscription ID for recurring billing
        });
        
        console.log('✅ Membership created with subscription:', { membershipId, subscriptionId: finalSubscriptionId });
        
        // Handle additional members for multi-membership purchases
        // Note: Max 3 additional members validation is done at the start of this endpoint
        // The purchaser (primary member) is stored for managing additional memberships
        const purchaserUserId = newUser.id; // newUser is the primary member/purchaser
        
        if (additionalMembers && Array.isArray(additionalMembers) && additionalMembers.length > 0) {
          console.log(`📦 Creating ${additionalMembers.length} additional memberships (purchaser ID: ${purchaserUserId})`);
          
          // Validate additional members schema
          const additionalMemberSchema = z.object({
            firstName: z.string().min(1, "First name is required"),
            lastName: z.string().min(1, "Last name is required"),
            email: z.string().email("Valid email is required"),
          });
          
          for (const additionalMember of additionalMembers) {
            try {
              // Validate additional member data
              const validatedMember = additionalMemberSchema.parse(additionalMember);
              
              // Check if additional member already exists
              const existingAdditionalMember = await storage.getUserByEmail(validatedMember.email);
              if (existingAdditionalMember) {
                console.log(`⚠️ Additional member ${validatedMember.email} already exists, adding membership to existing account`);
                
                // Add membership to existing user instead of skipping
                // First, create or get Stripe customer
                let existingStripeCustomerId = existingAdditionalMember.stripeCustomerId;
                if (!existingStripeCustomerId) {
                  const newStripeCustomer = await stripe.customers.create({
                    email: validatedMember.email,
                    name: `${existingAdditionalMember.firstName} ${existingAdditionalMember.lastName}`,
                    metadata: {
                      userId: existingAdditionalMember.id.toString(),
                      source: 'kiosk_gift_membership',
                      purchasedBy: memberData.email,
                    },
                  });
                  existingStripeCustomerId = newStripeCustomer.id;
                  await storage.updateUserStripeCustomerId(existingAdditionalMember.id, newStripeCustomer.id);
                }
                
                // Create active subscription for existing member with billing anchor 30 days out
                // (first month already paid via PaymentIntent)
                const additionalBillingAnchor = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
                const existingMemberSubscription = await stripe.subscriptions.create({
                  customer: existingStripeCustomerId,
                  items: [{ price: paymentIntent.metadata?.stripePriceId || stripePriceId }],
                  billing_cycle_anchor: additionalBillingAnchor,
                  proration_behavior: 'none',
                  payment_behavior: 'allow_incomplete',
                  metadata: {
                    source: 'kiosk_gift_membership',
                    purchasedBy: memberData.email,
                    memberEmail: validatedMember.email,
                  },
                });
                
                // Create new membership for existing user (managed by the purchaser)
                const existingMemberMembershipId = `WM-${Date.now()}-${Math.random().toString(36).slice(-4).toUpperCase()}`;
                await storage.createMembership({
                  membershipId: existingMemberMembershipId,
                  userId: existingAdditionalMember.id,
                  planType: packageData.planType || 'basic',
                  status: 'active',
                  startDate: new Date().toISOString().split('T')[0],
                  endDate: endDate.toISOString().split('T')[0],
                  autoRenew: true,
                  stripeSubscriptionId: existingMemberSubscription.id,
                  managedByUserId: purchaserUserId, // The purchaser can manage this membership
                });
                
                additionalMembersCreated.push({
                  email: validatedMember.email,
                  firstName: existingAdditionalMember.firstName,
                  lastName: existingAdditionalMember.lastName,
                  status: 'existing',
                  message: 'Membership added to existing account'
                });
                console.log(`✅ Membership added to existing account for ${validatedMember.email}`);
                continue;
              }
              
              // Create user account for additional member (needs account claim)
              const salt = randomBytes(16).toString('hex');
              const tempPassword = Math.random().toString(36).slice(-12);
              const key = await scryptAsync(tempPassword, salt, 64) as Buffer;
              
              const additionalUser = await storage.createUser({
                username: validatedMember.email,
                email: validatedMember.email,
                password: `${key.toString('hex')}:${salt}`,
                firstName: validatedMember.firstName,
                lastName: validatedMember.lastName,
                role: 'member',
                membershipAgreementCompleted: false, // Additional members need to complete agreement
              });
              
              // Create Stripe customer for additional member
              const additionalStripeCustomer = await stripe.customers.create({
                email: validatedMember.email,
                name: `${validatedMember.firstName} ${validatedMember.lastName}`,
                metadata: {
                  userId: additionalUser.id.toString(),
                  source: 'kiosk_gift_membership',
                  purchasedBy: memberData.email,
                },
              });
              
              await storage.updateUserStripeCustomerId(additionalUser.id, additionalStripeCustomer.id);
              
              // Create active subscription for additional member with billing anchor 30 days out
              // (first month already paid via PaymentIntent)
              const newMemberBillingAnchor = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
              const additionalSubscription = await stripe.subscriptions.create({
                customer: additionalStripeCustomer.id,
                items: [{ price: paymentIntent.metadata?.stripePriceId || stripePriceId }],
                billing_cycle_anchor: newMemberBillingAnchor,
                proration_behavior: 'none',
                payment_behavior: 'allow_incomplete',
                metadata: {
                  source: 'kiosk_gift_membership',
                  purchasedBy: memberData.email,
                  memberEmail: validatedMember.email,
                },
              });
              
              // Create membership for additional member (managed by the purchaser)
              const additionalMembershipId = `WM-${Date.now()}-${Math.random().toString(36).slice(-4).toUpperCase()}`;
              await storage.createMembership({
                membershipId: additionalMembershipId,
                userId: additionalUser.id,
                planType: packageData.planType || 'basic',
                status: 'active',
                startDate: new Date().toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                autoRenew: true,
                stripeSubscriptionId: additionalSubscription.id,
                managedByUserId: purchaserUserId, // The purchaser can manage this membership
              });
              
              additionalMembersCreated.push({
                email: validatedMember.email,
                firstName: validatedMember.firstName,
                lastName: validatedMember.lastName,
                status: 'created',
              });
              console.log(`✅ Additional membership created for ${validatedMember.firstName} ${validatedMember.lastName}`);
              
              // TODO: Send welcome email to additional member for account claim
              
            } catch (additionalError: any) {
              console.error(`❌ Failed to create additional member ${additionalMember.email}:`, additionalError.message);
              additionalMembersCreated.push({
                email: additionalMember.email || 'unknown',
                firstName: additionalMember.firstName || 'unknown',
                lastName: additionalMember.lastName || 'unknown',
                status: 'failed',
                message: additionalError.message,
              });
              // Continue with other additional members even if one fails
            }
          }
        }
        
      } else if (memberData.packageType === 'daypass') {
        const totalPunches = Math.max(packageData.totalPunches || 5, 1); // Ensure at least 1 punch
        const dayPassQuantity = Math.min(Math.max(packageData.quantity || 1, 1), 10); // Support multiple day passes (max 10)
        const unitPrice = packageData.price || 2000;
        
        console.log(`📋 Creating ${dayPassQuantity} day pass(es) for ${newUser.firstName} ${newUser.lastName}`);
        
        let firstPunchCardId: number | null = null;
        
        for (let i = 0; i < dayPassQuantity; i++) {
          const punchCard = await storage.createPunchCard({
            userId: newUser.id,
            templateId: parseInt(memberData.packageId),
            name: packageData.name || 'Day Pass Package',
            totalPunches: totalPunches,
            remainingPunches: totalPunches,
            pricePerPunch: Math.round(unitPrice / totalPunches),
            totalPrice: unitPrice,
            status: 'active',
          });
          
          if (i === 0) {
            firstPunchCardId = punchCard.id;
          }
        }
        
        // Only check in and use a punch if member wants to use day pass today (uses first punch card)
        if (memberData.useDayPassToday !== false && firstPunchCardId) {
          await storage.usePunchCardEntry(firstPunchCardId);
          await storage.createCheckIn({
            userId: newUser.id,
            membershipId: `day-pass-${firstPunchCardId}`,
            location: 'Kiosk Registration',
            method: 'manual',
          });
          console.log(`✅ Day pass user ${newUser.firstName} ${newUser.lastName} automatically checked in`);
        } else {
          console.log(`📋 ${dayPassQuantity} day pass(es) purchased for ${newUser.firstName} ${newUser.lastName} - saved for later use`);
        }
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
        description: `${packageData.name}${(packageData.quantity || 1) > 1 ? ` × ${packageData.quantity}` : ''} - Kiosk Purchase${hasDiscount ? ` (${discountData.type === 'percentage' ? discountData.value + '%' : '$' + (discountData.amountCents/100).toFixed(2)} discount)` : ''}`,
        status: 'successful',
        method: 'credit_card',
        stripePaymentIntentId: paymentIntent.id,
        stripePaymentMethodId: paymentIntent.payment_method as string,
      });
      
      console.log(`Successfully created member: ${memberData.firstName} ${memberData.lastName}`);
      
      // Check for any failed additional members
      const failedMembers = additionalMembersCreated?.filter(m => m.status === 'failed') || [];
      const successfulMembers = additionalMembersCreated?.filter(m => m.status !== 'failed') || [];
      
      const responseMessage = failedMembers.length > 0
        ? `Member created with ${failedMembers.length} additional member(s) failed`
        : additionalMembersCreated?.length > 0
        ? `Successfully created ${1 + successfulMembers.length} membership(s)`
        : "Member created successfully";
      
      res.json({ 
        message: responseMessage,
        user: {
          id: newUser.id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email
        },
        additionalMembers: additionalMembersCreated || [],
        summary: {
          primaryMember: true,
          additionalMembersAttempted: additionalMembers?.length || 0,
          additionalMembersSuccessful: successfulMembers.length,
          additionalMembersFailed: failedMembers.length,
        }
      });
    } catch (error: any) {
      console.error("Member creation confirmation error:", error);
      res.status(500).json({ message: "Failed to create member: " + error.message });
    }
  });

  // ─── Checklist Routes ─────────────────────────────────────────────────────

  // Summary for overview cards (today's completion counts for all three types)
  app.get("/api/admin/checklist-summary", isAdminOrStaff, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const summary = await storage.getTodayChecklistSummary(today);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get items for a checklist type (or all)
  app.get("/api/admin/checklist-items", isAdminOrStaff, async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const items = await storage.getChecklistItems(type);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/checklist-items", isAdminOrStaff, async (req, res) => {
    try {
      const item = await storage.createChecklistItem(req.body);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/admin/checklist-items/:id", isAdminOrStaff, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const item = await storage.updateChecklistItem(id, req.body);
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/admin/checklist-items/:id", isAdminOrStaff, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteChecklistItem(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get runs for a type + date
  app.get("/api/admin/checklist-runs", isAdminOrStaff, async (req, res) => {
    try {
      const { type, date } = req.query as { type: string; date: string };
      if (!type || !date) return res.status(400).json({ message: "type and date required" });
      const runs = await storage.getChecklistRuns(type, date);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/checklist-runs", isAdminOrStaff, async (req, res) => {
    try {
      const userId = req.user?.id;
      const run = await storage.createChecklistRun({ ...req.body, startedByUserId: userId });
      res.status(201).json(run);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/admin/checklist-runs/:id", isAdminOrStaff, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const run = await storage.updateChecklistRun(id, req.body);
      res.json(run);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get checked items for a run
  app.get("/api/admin/checklist-runs/:id/items", isAdminOrStaff, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const items = await storage.getChecklistRunItems(id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Check an item (mark done)
  app.post("/api/admin/checklist-runs/:id/items/:itemId", isAdminOrStaff, async (req, res) => {
    try {
      const runId = Number(req.params.id);
      const itemId = Number(req.params.itemId);
      const userId = req.user?.id;
      const runItem = await storage.checkChecklistItem(runId, itemId, userId);
      res.status(201).json(runItem);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Uncheck an item
  app.delete("/api/admin/checklist-runs/:id/items/:itemId", isAdminOrStaff, async (req, res) => {
    try {
      const runId = Number(req.params.id);
      const itemId = Number(req.params.itemId);
      await storage.uncheckChecklistItem(runId, itemId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

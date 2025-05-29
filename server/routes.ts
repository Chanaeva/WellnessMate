import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { 
  insertMembershipSchema, 
  insertCheckInSchema, 
  insertPaymentSchema, 
  insertMembershipPlanSchema,
  insertPunchCardSchema
} from "@shared/schema";
import { z } from "zod";

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
      const membership = await storage.getMembershipByUserId(req.user.id);
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }
      res.json(membership);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get check-ins for current user
  app.get("/api/check-ins", isAuthenticated, async (req, res) => {
    try {
      const checkIns = await storage.getCheckInsByUserId(req.user.id);
      res.json(checkIns);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get payments for current user
  app.get("/api/payments", isAuthenticated, async (req, res) => {
    try {
      const payments = await storage.getPaymentsByUserId(req.user.id);
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

  // Check in using QR code
  app.post("/api/check-in", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertCheckInSchema.parse(req.body);
      
      // Verify membership is active
      const membership = await storage.getMembershipById(validatedData.membershipId);
      if (!membership || membership.status !== 'active') {
        return res.status(400).json({ message: "Invalid or inactive membership" });
      }

      // Create check-in record
      const checkIn = await storage.createCheckIn({
        ...validatedData,
        userId: req.user.id,
      });

      res.status(201).json(checkIn);
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
      const punchCards = await storage.getPunchCardsByUserId(req.user.id);
      res.json(punchCards);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Purchase a punch card
  app.post("/api/punch-cards", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertPunchCardSchema.parse({
        ...req.body,
        userId: req.user.id,
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
      
      if (punchCard.userId !== req.user.id) {
        return res.status(403).json({ message: "Not your punch card" });
      }

      const updatedCard = await storage.usePunchCardEntry(cardId);
      res.json(updatedCard);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || "wellness-center-secret";
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      secure: process.env.NODE_ENV === "production"
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: 'email' }, // Use email field instead of username
      async (email, password, done) => {
        try {
          // First try to find by email, then fallback to username for existing users
          let user = await storage.getUserByEmail(email);
          if (!user) {
            user = await storage.getUserByUsername(email);
          }
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false);
          } else {
            return done(null, user);
          }
        } catch (error) {
          return done(error);
        }
      }
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate user input
      const userInput = insertUserSchema.parse(req.body);
      
      // Age verification: Check if user is 18 or older
      if (userInput.dateOfBirth) {
        const birthDate = new Date(userInput.dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        // Adjust age if birthday hasn't occurred this year
        const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
          ? age - 1 
          : age;
        
        if (actualAge < 18) {
          return res.status(400).json({ 
            message: "You must be 18 years or older to register. Wolf Mother Wellness is an adult-only facility." 
          });
        }
      }
      
      // Age confirmation checkbox validation (optional for demo)
      // if (!userInput.ageConfirmation) {
      //   return res.status(400).json({ 
      //     message: "You must confirm that you are 18 years or older to register." 
      //   });
      // }
      
      const existingUser = await storage.getUserByUsername(userInput.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(userInput.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash password before storing
      const hashedPassword = await hashPassword(userInput.password);
      
      const user = await storage.createUser({
        ...userInput,
        password: hashedPassword,
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      // Login the user after registration
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({
          message: "Registration successful",
          user: userWithoutPassword,
          redirectTo: "/membership-agreement"
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        
        // Determine redirect based on user status
        let redirectTo = "/dashboard";
        if (userWithoutPassword.role === "admin") {
          redirectTo = "/admin";
        } else if (!userWithoutPassword.membershipAgreementCompleted) {
          redirectTo = "/membership-agreement";
        }
        
        res.status(200).json({
          ...userWithoutPassword,
          redirectTo
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Remove password from response
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Submit membership agreement
  app.post("/api/membership-agreement", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userId = req.user!.id;
      const agreementData = req.body;
      
      // Update the user with agreement completion and data
      await storage.updateUser(userId, {
        membershipAgreementCompleted: true,
        membershipAgreementDate: new Date(),
        emergencyContact: agreementData.emergencyContact,
        emergencyPhone: agreementData.emergencyPhone,
        dateOfBirth: agreementData.dateOfBirth,
        address: agreementData.address,
        preferredMembershipType: agreementData.membershipType
      });

      res.json({ 
        message: "Membership agreement completed successfully"
      });
    } catch (error: any) {
      console.log(`Membership agreement error: ${error.message}`);
      res.status(500).json({ message: "Failed to complete membership agreement" });
    }
  });

  // Password reset request endpoint
  app.post("/api/password-reset-request", async (req, res, next) => {
    try {
      const { email } = req.body;
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists for security
        return res.status(200).json({ message: "If an account with that email exists, a reset link has been sent." });
      }

      // Generate secure reset token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Store reset token
      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
        used: false
      });

      // For now, just return success (email would be sent here with SendGrid)
      res.status(200).json({ 
        message: "If an account with that email exists, a reset link has been sent.",
        // In development, include the token for testing
        ...(process.env.NODE_ENV === 'development' && { resetToken: token })
      });
    } catch (error) {
      next(error);
    }
  });

  // Password reset endpoint
  app.post("/api/password-reset", async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;

      // Find and validate token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken || resetToken.used || new Date() > new Date(resetToken.expiresAt!)) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      await storage.updateUserPassword(resetToken.userId, hashedPassword);

      // Mark token as used
      await storage.markTokenAsUsed(resetToken.id);

      res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
      next(error);
    }
  });
}

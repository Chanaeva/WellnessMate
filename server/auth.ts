import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import PDFDocument from "pdfkit";
import Twilio from "twilio";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
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
  
  // In Replit environment, even dev mode is served over HTTPS via proxy
  const isReplit = !!process.env.REPL_ID || !!process.env.REPLIT_DEV_DOMAIN;
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      path: "/",
      // Always use secure cookies in Replit (even dev is HTTPS)
      secure: isReplit || process.env.NODE_ENV === "production",
      // Use "none" for cross-site cookies in Replit webview (requires secure: true)
      sameSite: isReplit ? "none" : "lax",
      httpOnly: true
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
        let birthDate: Date;
        
        // Parse date from MM/DD/YYYY format
        const dateRegex = /^(0[1-9]|1[0-2]|[1-9])\/(0[1-9]|[12][0-9]|3[01]|[1-9])\/(\d{4})$/;
        const match = userInput.dateOfBirth.match(dateRegex);
        
        if (match) {
          const month = parseInt(match[1], 10);
          const day = parseInt(match[2], 10);
          const year = parseInt(match[3], 10);
          birthDate = new Date(year, month - 1, day);
          
          // Validate it's a real date
          if (birthDate.getFullYear() !== year || 
              birthDate.getMonth() !== month - 1 || 
              birthDate.getDate() !== day) {
            return res.status(400).json({ 
              message: "Please enter a valid date in MM/DD/YYYY format." 
            });
          }
        } else {
          // Try to parse as standard date format for backwards compatibility
          birthDate = new Date(userInput.dateOfBirth);
          if (isNaN(birthDate.getTime())) {
            return res.status(400).json({ 
              message: "Please enter a valid date in MM/DD/YYYY format." 
            });
          }
        }
        
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

  app.post("/api/login", async (req, res, next) => {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    passport.authenticate("local", async (err: Error | null, user: SelectUser | false, info: { message: string } | undefined) => {
      if (err) return next(err);
      
      if (!user) {
        // Record failed login attempt if we can identify the user by email
        try {
          const attemptedUser = await storage.getUserByEmail(req.body.email);
          if (attemptedUser && (attemptedUser.role === 'staff' || attemptedUser.role === 'admin')) {
            await storage.createLoginEvent({
              userId: attemptedUser.id,
              ipAddress,
              userAgent,
              wasSuccessful: false,
            });
          }
        } catch (e) {
          // Ignore login event errors
        }
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      req.login(user, async (err) => {
        if (err) return next(err);
        
        // Record successful login for staff/admin users
        if (user.role === 'staff' || user.role === 'admin') {
          try {
            await storage.createLoginEvent({
              userId: user.id,
              ipAddress,
              userAgent,
              wasSuccessful: true,
            });
            await storage.updateUserLastLogin(user.id);
          } catch (e) {
            console.error('Failed to record login event:', e);
          }
        }
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        
        // Determine redirect based on user role and status
        let redirectTo = "/dashboard";
        
        // Check if user must change password (staff/admin first login)
        if (user.mustChangePassword && (user.role === 'staff' || user.role === 'admin')) {
          redirectTo = "/set-password";
        } else if (userWithoutPassword.role === "admin") {
          redirectTo = "/admin";
        } else if (userWithoutPassword.role === "staff") {
          redirectTo = "/staff/check-in";
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

  // Staff/Admin: Set password on first login
  app.post("/api/set-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = req.user!;
    
    // Only allow staff/admin users who must change password
    if (!user.mustChangePassword || (user.role !== 'staff' && user.role !== 'admin')) {
      return res.status(400).json({ message: "Password change not required" });
    }

    try {
      const { password, confirmPassword } = req.body;
      
      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      const hashedPassword = await hashPassword(password);
      
      await storage.updateStaffAdmin(user.id, {
        password: hashedPassword,
        mustChangePassword: false,
      });

      // Determine redirect based on role
      let redirectTo = "/staff/check-in";
      if (user.role === 'admin') {
        redirectTo = "/admin";
      }

      res.json({ 
        message: "Password set successfully",
        redirectTo
      });
    } catch (error: any) {
      console.error("Set password error:", error);
      res.status(500).json({ message: "Failed to set password" });
    }
  });

  // Submit membership agreement
  app.post("/api/membership-agreement", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userId = req.user!.id;
      const agreementData = req.body;
      
      // Update the user with agreement completion and data (store full agreement for PDF generation)
      await storage.updateUser(userId, {
        membershipAgreementCompleted: true,
        membershipAgreementDate: new Date(),
        membershipAgreementData: agreementData, // Store full agreement data for PDF
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

  // Download membership agreement as PDF
  app.get("/api/membership-agreement/pdf", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = req.user!;
      
      if (!user.membershipAgreementCompleted) {
        return res.status(400).json({ message: "No membership agreement found" });
      }

      // Create a PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Wolf_Mother_Wellness_Agreement_${user.firstName}_${user.lastName}.pdf`);
      
      // Pipe PDF to response
      doc.pipe(res);

      // PDF Header
      doc.fontSize(24).font('Helvetica-Bold').text('Wolf Mother Wellness', { align: 'center' });
      doc.fontSize(16).font('Helvetica').text('Membership Agreement & Waiver', { align: 'center' });
      doc.moveDown();
      
      // Horizontal line
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // Member Information Section
      doc.fontSize(14).font('Helvetica-Bold').text('Member Information');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Name: ${user.firstName} ${user.lastName}`);
      doc.text(`Email: ${user.email}`);
      doc.text(`Phone: ${user.phoneNumber || 'Not provided'}`);
      doc.text(`Date of Birth: ${user.dateOfBirth || 'Not provided'}`);
      doc.text(`Address: ${user.address || 'Not provided'}`);
      doc.moveDown();

      // Emergency Contact Section
      doc.fontSize(14).font('Helvetica-Bold').text('Emergency Contact');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Contact Name: ${user.emergencyContact || 'Not provided'}`);
      doc.text(`Contact Phone: ${user.emergencyPhone || 'Not provided'}`);
      doc.moveDown();

      // Agreement Date
      doc.fontSize(14).font('Helvetica-Bold').text('Agreement Details');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Membership Type: ${user.preferredMembershipType || 'Standard'}`);
      doc.text(`Agreement Date: ${user.membershipAgreementDate ? new Date(user.membershipAgreementDate).toLocaleDateString() : 'Not available'}`);
      doc.moveDown();

      // Acknowledgments Section
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

      // Signature Section
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

      // Finalize the PDF
      doc.end();
    } catch (error: any) {
      console.log(`PDF generation error: ${error.message}`);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Password reset request endpoint (email-based)
  app.post("/api/password-reset-request", async (req, res, next) => {
    try {
      const { email } = req.body;
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists for security
        return res.status(200).json({ message: "If an account with that email exists, a reset code has been sent." });
      }

      // Generate a 6-digit reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const token = resetCode;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store reset token
      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
        used: false
      });

      // Send email via SendGrid
      const { sendPasswordResetEmail } = await import("./email");
      
      try {
        const emailSent = await sendPasswordResetEmail(email, resetCode, user.firstName || undefined);
        
        if (emailSent) {
          console.log(`Password reset email sent to ${email} for user ${user.id}`);
          res.status(200).json({ 
            message: "A password reset code has been sent to your email.",
            emailSent: true
          });
        } else {
          console.error("Failed to send password reset email");
          return res.status(500).json({ message: "Failed to send reset code. Please try again or contact support." });
        }
      } catch (emailError: any) {
        console.error("Failed to send email:", emailError.message);
        return res.status(500).json({ message: "Failed to send reset code. Please try again or contact support." });
      }
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
      if (!resetToken) {
        return res.status(400).json({ message: "That code doesn't match our records. Please double-check and try again." });
      }
      if (resetToken.used) {
        return res.status(400).json({ message: "This reset code has already been used. Please request a new one." });
      }
      if (new Date() > new Date(resetToken.expiresAt!)) {
        return res.status(400).json({ message: "This reset code has expired. Please request a new one." });
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

  // Simple in-memory rate limiting for claim account requests
  const claimAttempts = new Map<string, { count: number; lastAttempt: Date }>();
  const MAX_CLAIM_ATTEMPTS = 3;
  const CLAIM_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  // Claim account - request verification code for kiosk-created members
  app.post("/api/claim-account/request", async (req, res, next) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Rate limiting by email
      const normalizedEmail = email.toLowerCase().trim();
      const now = new Date();
      const attempts = claimAttempts.get(normalizedEmail);
      
      if (attempts) {
        const timeSinceFirst = now.getTime() - attempts.lastAttempt.getTime();
        if (timeSinceFirst < CLAIM_WINDOW_MS && attempts.count >= MAX_CLAIM_ATTEMPTS) {
          console.log(`Rate limit exceeded for ${normalizedEmail}`);
          return res.status(429).json({ 
            message: "Too many attempts. Please wait 15 minutes before trying again.",
            rateLimited: true
          });
        }
        if (timeSinceFirst >= CLAIM_WINDOW_MS) {
          claimAttempts.set(normalizedEmail, { count: 1, lastAttempt: now });
        } else {
          attempts.count++;
          attempts.lastAttempt = now;
        }
      } else {
        claimAttempts.set(normalizedEmail, { count: 1, lastAttempt: now });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(200).json({ 
          message: "No account found with that email.",
          notFound: true
        });
      }

      // Check if user is a member (not staff/admin)
      if (user.role !== 'member') {
        return res.status(200).json({ 
          message: "Staff and admin accounts should use the admin login page.",
          notMember: true
        });
      }

      // Check if user has a phone number for SMS
      if (!user.phoneNumber) {
        console.log(`Account claim requested for user ${user.id} but no phone number on file`);
        return res.status(200).json({ 
          message: "No phone number on file. Please visit our front desk to add your phone number.",
          needsPhone: true
        });
      }

      // Generate a 6-digit verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Invalidate any existing unused tokens for this user before creating a new one
      // (The storage method should mark all previous tokens as used)
      
      // Store token
      await storage.createPasswordResetToken({
        userId: user.id,
        token: verificationCode,
        expiresAt,
        used: false
      });

      // Send SMS via Twilio
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        console.error("Twilio credentials not configured");
        return res.status(500).json({ message: "SMS service not configured. Please contact support." });
      }

      try {
        const twilioClient = Twilio(twilioAccountSid, twilioAuthToken);
        
        await twilioClient.messages.create({
          body: `Your Wolf Mother Wellness verification code is: ${verificationCode}. This code expires in 15 minutes.`,
          from: twilioPhoneNumber,
          to: user.phoneNumber
        });

        console.log(`Account claim verification SMS sent to ${user.phoneNumber} for user ${user.id}`);
        
        res.status(200).json({ 
          message: "A verification code has been sent to your phone.",
          phoneLastFour: user.phoneNumber.slice(-4)
        });
      } catch (smsError: any) {
        console.error("Failed to send SMS:", smsError.message);
        return res.status(500).json({ message: "Failed to send verification code. Please try again or contact support." });
      }
    } catch (error) {
      next(error);
    }
  });

  // Rate limiting for verification attempts
  const verifyAttempts = new Map<string, { count: number; lastAttempt: Date }>();
  const MAX_VERIFY_ATTEMPTS = 5;
  const VERIFY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  // Claim account - verify code and set password
  app.post("/api/claim-account/verify", async (req, res, next) => {
    try {
      const { email, code, newPassword } = req.body;

      if (!email || !code || !newPassword) {
        return res.status(400).json({ message: "Email, code, and password are required" });
      }

      // Rate limiting by email
      const normalizedEmail = email.toLowerCase().trim();
      const now = new Date();
      const attempts = verifyAttempts.get(normalizedEmail);
      
      if (attempts) {
        const timeSinceFirst = now.getTime() - attempts.lastAttempt.getTime();
        if (timeSinceFirst < VERIFY_WINDOW_MS && attempts.count >= MAX_VERIFY_ATTEMPTS) {
          console.log(`Verification rate limit exceeded for ${normalizedEmail}`);
          return res.status(429).json({ 
            message: "Too many verification attempts. Please wait 15 minutes before trying again.",
            rateLimited: true
          });
        }
        if (timeSinceFirst >= VERIFY_WINDOW_MS) {
          verifyAttempts.set(normalizedEmail, { count: 1, lastAttempt: now });
        } else {
          attempts.count++;
          attempts.lastAttempt = now;
        }
      } else {
        verifyAttempts.set(normalizedEmail, { count: 1, lastAttempt: now });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid email or verification code" });
      }

      // Find and validate token - lookup by userId first, then verify code matches
      const resetToken = await storage.getPasswordResetToken(code);
      if (!resetToken || resetToken.userId !== user.id || resetToken.used || new Date() > new Date(resetToken.expiresAt!)) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      await storage.updateUserPassword(user.id, hashedPassword);

      // Mark token as used
      await storage.markTokenAsUsed(resetToken.id);

      console.log(`Account claimed successfully for user ${user.id} (${user.email})`);

      res.status(200).json({ message: "Account activated successfully" });
    } catch (error) {
      next(error);
    }
  });
}

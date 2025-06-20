import { pgTable, text, varchar, serial, integer, boolean, timestamp, date, pgEnum, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles enum
export const roleEnum = pgEnum('role', ['member', 'admin', 'staff']);

// User table definition
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phoneNumber: text("phone_number"),
  role: roleEnum("role").notNull().default('member'),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reset method enum
export const resetMethodEnum = pgEnum('reset_method', ['email', 'sms']);

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  method: resetMethodEnum("method").notNull().default('email'),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Membership plan types enum
export const planTypeEnum = pgEnum('plan_type', ['basic', 'premium', 'vip', 'daily']);

// Membership status enum
export const membershipStatusEnum = pgEnum('membership_status', ['active', 'inactive', 'expired', 'frozen']);

// Memberships table definition
export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  membershipId: text("membership_id").notNull().unique(),
  planType: planTypeEnum("plan_type").notNull(),
  status: membershipStatusEnum("status").notNull().default('active'),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  autoRenew: boolean("auto_renew").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Check-in method enum
export const checkInMethodEnum = pgEnum('check_in_method', ['qr', 'manual']);

// Check-in records table definition
export const checkIns = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  membershipId: text("membership_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  location: text("location").notNull().default('Main Entrance'),
  method: checkInMethodEnum("method").notNull().default('qr'),
});

// Payment status enum
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'successful', 'failed', 'refunded']);

// Payment method enum
export const paymentMethodEnum = pgEnum('payment_method', ['credit_card', 'debit_card', 'cash', 'check']);

// Treatment type enum
export const treatmentTypeEnum = pgEnum('treatment_type', ['sauna', 'cold_plunge', 'infrared', 'steam', 'contrast', 'kneipp', 'hammam']);

// Punch card status enum
export const punchCardStatusEnum = pgEnum('punch_card_status', ['active', 'expired', 'exhausted']);

// Payments table definition
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  membershipId: text("membership_id"),
  amount: integer("amount").notNull(), // Stored in cents
  description: text("description").notNull(),
  status: paymentStatusEnum("status").notNull(),
  method: paymentMethodEnum("method").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  transactionDate: timestamp("transaction_date").defaultNow(),
});

// Payment methods table for storing user's saved cards
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  stripePaymentMethodId: text("stripe_payment_method_id").notNull().unique(),
  cardLast4: text("card_last4").notNull(),
  cardBrand: text("card_brand").notNull(),
  cardExpMonth: integer("card_exp_month").notNull(),
  cardExpYear: integer("card_exp_year").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Plan pricing table
export const membershipPlans = pgTable("membership_plans", {
  id: serial("id").primaryKey(),
  planType: planTypeEnum("plan_type").notNull().unique(),
  name: text("name").notNull(),
  monthlyPrice: integer("monthly_price").notNull(), // Stored in cents
  description: text("description").notNull(),
  features: text("features").array().notNull(),
});

// Punch card templates for admin management
export const punchCardTemplates = pgTable("punch_card_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  totalPunches: integer("total_punches").notNull(),
  pricePerPunch: integer("price_per_punch").notNull(), // in cents
  totalPrice: integer("total_price").notNull(), // in cents
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

// Punch cards table for day pass packages
export const punchCards = pgTable("punch_cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  templateId: integer("template_id").references(() => punchCardTemplates.id),
  name: text("name").notNull(), // e.g., "5-Day Pass Package"
  totalPunches: integer("total_punches").notNull(), // Number of day passes included
  remainingPunches: integer("remaining_punches").notNull(),
  pricePerPunch: integer("price_per_punch").notNull(), // Stored in cents
  totalPrice: integer("total_price").notNull(), // Stored in cents
  status: punchCardStatusEnum("status").default('active'),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional expiration date
});

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  phoneNumber: z.string().optional(),
});

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  createdAt: true,
});

export const insertCheckInSchema = createInsertSchema(checkIns).omit({
  id: true,
  timestamp: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  transactionDate: true,
});

export const insertMembershipPlanSchema = createInsertSchema(membershipPlans).omit({
  id: true,
});

export const insertPunchCardTemplateSchema = createInsertSchema(punchCardTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPunchCardSchema = createInsertSchema(punchCards).omit({
  id: true,
  purchasedAt: true,
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
  createdAt: true,
});

// Define types for insert and select
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Membership = typeof memberships.$inferSelect;

export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type CheckIn = typeof checkIns.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export type InsertMembershipPlan = z.infer<typeof insertMembershipPlanSchema>;
export type MembershipPlan = typeof membershipPlans.$inferSelect;

export type InsertPunchCardTemplate = z.infer<typeof insertPunchCardTemplateSchema>;
export type PunchCardTemplate = typeof punchCardTemplates.$inferSelect;

export type InsertPunchCard = z.infer<typeof insertPunchCardSchema>;
export type PunchCard = typeof punchCards.$inferSelect;

export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;

// Member Temperature Preferences table
export const memberPreferences = pgTable("member_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  saunaTemperature: integer("sauna_temperature"), // Preferred temperature in Celsius
  coldPlungeTemperature: integer("cold_plunge_temperature"), // Preferred temperature in Celsius
  preferredDuration: integer("preferred_duration"), // Preferred duration in minutes
  favoriteTherapies: treatmentTypeEnum("favorite_therapies").array(),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Thermal Therapy Sessions table (for tracking effectiveness and stats)
export const therapySessions = pgTable("therapy_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  treatmentType: treatmentTypeEnum("treatment_type").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  duration: integer("duration_minutes").notNull(),
  temperature: integer("temperature_celsius"),
  heartRateBefore: integer("heart_rate_before"),
  heartRateAfter: integer("heart_rate_after"),
  stressLevelBefore: integer("stress_level_before"), // Scale 1-10
  stressLevelAfter: integer("stress_level_after"), // Scale 1-10
  notes: text("notes"),
  shareWithStrava: boolean("share_with_strava").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Health Metrics table - for tracking wellness outcomes
export const healthMetrics = pgTable("health_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  sleepQuality: integer("sleep_quality"), // Scale 1-10
  energyLevel: integer("energy_level"), // Scale 1-10
  stressLevel: integer("stress_level"), // Scale 1-10
  recoveryScore: integer("recovery_score"), // Scale 1-100
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Strava Integration table 
export const stravaIntegrations = pgTable("strava_integrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  athleteId: text("athlete_id"),
  lastSyncAt: timestamp("last_sync_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Create insert schemas for new tables
export const insertMemberPreferencesSchema = createInsertSchema(memberPreferences).omit({
  id: true,
  updatedAt: true
});

export const insertTherapySessionSchema = createInsertSchema(therapySessions).omit({
  id: true,
  createdAt: true
});

export const insertHealthMetricsSchema = createInsertSchema(healthMetrics).omit({
  id: true,
  createdAt: true
});

export const insertStravaIntegrationSchema = createInsertSchema(stravaIntegrations).omit({
  id: true,
  createdAt: true
});

// Create types for the new tables
export type InsertMemberPreferences = z.infer<typeof insertMemberPreferencesSchema>;
export type MemberPreferences = typeof memberPreferences.$inferSelect;

export type InsertTherapySession = z.infer<typeof insertTherapySessionSchema>;
export type TherapySession = typeof therapySessions.$inferSelect;

export type InsertHealthMetrics = z.infer<typeof insertHealthMetricsSchema>;
export type HealthMetrics = typeof healthMetrics.$inferSelect;

export type InsertStravaIntegration = z.infer<typeof insertStravaIntegrationSchema>;
export type StravaIntegration = typeof stravaIntegrations.$inferSelect;

// Define login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginData = z.infer<typeof loginSchema>;

// Password reset schema
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Password reset request schema
export const passwordResetRequestSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export type PasswordResetRequestData = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetData = z.infer<typeof passwordResetSchema>;

// Notifications table
export const notificationTypeEnum = pgEnum('notification_type', ['announcement', 'maintenance', 'promotion', 'alert']);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: notificationTypeEnum("type").notNull().default('announcement'),
  isActive: boolean("is_active").notNull().default(true),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications);

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

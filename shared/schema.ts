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
  
  // Staff/Admin first-login password setup
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  passwordSetAt: timestamp("password_set_at"),
  lastLoginAt: timestamp("last_login_at"),
  
  // Membership Agreement fields
  membershipAgreementCompleted: boolean("membership_agreement_completed").default(false),
  membershipAgreementDate: timestamp("membership_agreement_date"),
  membershipAgreementData: jsonb("membership_agreement_data"), // Stores full agreement for PDF generation
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  dateOfBirth: date("date_of_birth"),
  ageConfirmation: boolean("age_confirmation").default(false),
  address: text("address"),
  preferredMembershipType: text("preferred_membership_type"),
  
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  
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

// Discount type enum
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed_amount']);

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
  stripeSubscriptionId: text("stripe_subscription_id"),
  managedByUserId: integer("managed_by_user_id").references(() => users.id), // For family/gift memberships - the purchaser can manage these
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
  amount: integer("amount").notNull(), // Stored in cents (final amount after discount)
  originalAmount: integer("original_amount"), // Original amount before discount (in cents)
  discountAmount: integer("discount_amount"), // Discount amount in cents
  discountType: text("discount_type"), // 'percentage' or 'fixed'
  discountValue: integer("discount_value"), // The discount value (percentage or cents)
  discountReason: text("discount_reason"), // Staff notes for the discount
  discountAppliedBy: integer("discount_applied_by").references(() => users.id), // Staff who applied discount
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
  planType: planTypeEnum("plan_type").notNull(),
  name: text("name").notNull(),
  monthlyPrice: integer("monthly_price").notNull(), // Stored in cents
  description: text("description").notNull(),
  features: text("features").array().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  availableFrom: timestamp("available_from"),
  availableUntil: timestamp("available_until"),
  expiresAt: timestamp("expires_at"), // Optional expiration date for the package
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Purchase channel availability
  availableOnKiosk: boolean("available_on_kiosk").notNull().default(true),
  availableOnWebsite: boolean("available_on_website").notNull().default(true),
  availableInCart: boolean("available_in_cart").notNull().default(true),
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
  availableFrom: timestamp("available_from"),
  availableUntil: timestamp("available_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  // Purchase channel availability
  availableOnKiosk: boolean("available_on_kiosk").notNull().default(true),
  availableOnWebsite: boolean("available_on_website").notNull().default(true),
  availableInCart: boolean("available_in_cart").notNull().default(true),
});

// Punch cards table for day pass packages
export const punchCards = pgTable("punch_cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  templateId: integer("template_id").references(() => punchCardTemplates.id, { onDelete: 'set null' }),
  name: text("name").notNull(), // e.g., "5-Day Pass Package"
  totalPunches: integer("total_punches").notNull(), // Number of day passes included
  remainingPunches: integer("remaining_punches").notNull(),
  pricePerPunch: integer("price_per_punch").notNull(), // Stored in cents
  totalPrice: integer("total_price").notNull(), // Stored in cents
  status: punchCardStatusEnum("status").default('active'),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional expiration date
});

// Landing page content tables
export const landingPageContent = pgTable("landing_page_content", {
  id: serial("id").primaryKey(),
  section: text("section").notNull(), // 'hero', 'promotions', 'features', 'contact'
  key: text("key").notNull(), // specific field identifier
  value: text("value").notNull(), // content value
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  code: text("code").notNull(),
  validUntil: text("valid_until").notNull(),
  bgColor: text("bg_color").notNull().default("bg-gradient-to-r from-amber-500 to-orange-600"),
  textColor: text("text_color").notNull().default("text-white"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  availableFrom: timestamp("available_from"),
  availableUntil: timestamp("available_until"),
  discountType: discountTypeEnum("discount_type").default('percentage'),
  discountValue: integer("discount_value").default(0), // Percentage (0-100) or amount in cents
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Gallery images table for landing page image carousel/gallery
export const galleryImages = pgTable("gallery_images", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  altText: text("alt_text"),
  aspectRatio: text("aspect_ratio").notNull().default("16:9"), // 16:9, 4:3, 1:1, 3:2, 21:9
  objectFit: text("object_fit").notNull().default("cover"), // cover, contain, fill, none
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// FAQ items table for landing page
export const faqItems = pgTable("faq_items", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category"), // Optional category for grouping FAQs
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  createdAt: true,
}).extend({
  expiresAt: z.union([
    z.string()
      .datetime({ offset: true })
      .transform(v => new Date(v))
      .refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
    z.date()
      .refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
    z.null(),
    z.undefined()
  ]).optional(),
  availableFrom: z.union([
    z.string()
      .datetime({ offset: true })
      .transform(v => new Date(v))
      .refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
    z.date()
      .refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
    z.null(),
    z.undefined()
  ]).optional(),
  availableUntil: z.union([
    z.string()
      .datetime({ offset: true })
      .transform(v => new Date(v))
      .refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
    z.date()
      .refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
    z.null(),
    z.undefined()
  ]).optional(),
});

export const insertPunchCardTemplateSchema = createInsertSchema(punchCardTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  availableFrom: z.union([
    z.string()
      .datetime({ offset: true })
      .transform(v => new Date(v))
      .refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
    z.date()
      .refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
    z.null(),
    z.undefined()
  ]).optional(),
  availableUntil: z.union([
    z.string()
      .datetime({ offset: true })
      .transform(v => new Date(v))
      .refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
    z.date()
      .refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
    z.null(),
    z.undefined()
  ]).optional(),
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
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginData = z.infer<typeof loginSchema>;

// Admin staff/admin account creation schema
export const createStaffAdminSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(['staff', 'admin']),
  phoneNumber: z.string().optional(),
});

export type CreateStaffAdminData = z.infer<typeof createStaffAdminSchema>;

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

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLandingPageContentSchema = createInsertSchema(landingPageContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPromotionSchema = createInsertSchema(promotions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  availableFrom: z.union([
    z.string().transform(v => v ? new Date(v) : undefined),
    z.date(),
    z.null(),
    z.undefined()
  ]).optional(),
  availableUntil: z.union([
    z.string().transform(v => v ? new Date(v) : undefined),
    z.date(),
    z.null(),
    z.undefined()
  ]).optional(),
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type LandingPageContent = typeof landingPageContent.$inferSelect;
export type InsertLandingPageContent = z.infer<typeof insertLandingPageContentSchema>;

export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;

export const insertGalleryImageSchema = createInsertSchema(galleryImages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type GalleryImage = typeof galleryImages.$inferSelect;
export type InsertGalleryImage = z.infer<typeof insertGalleryImageSchema>;

// FAQ item schema and types
export const insertFaqItemSchema = createInsertSchema(faqItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FaqItem = typeof faqItems.$inferSelect;
export type InsertFaqItem = z.infer<typeof insertFaqItemSchema>;

// Inventory item type enum
export const itemTypeEnum = pgEnum('item_type', ['robe', 'shoes', 'other']);

// Inventory item size enum
export const itemSizeEnum = pgEnum('item_size', ['XS', 'S', 'M', 'L', 'XL', 'XXL', '6', '7', '8', '9', '10', '11', '12', '13', '14', 'One Size']);

// Checkout status enum
export const checkoutStatusEnum = pgEnum('checkout_status', ['checked_out', 'returned', 'lost']);

// Checkout payment status enum
export const checkoutPaymentStatusEnum = pgEnum('checkout_payment_status', ['not_charged', 'charged', 'failed']);

// Inventory items table
export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "Terry Robe", "Spa Slippers"
  type: itemTypeEnum("type").notNull(),
  size: itemSizeEnum("size").notNull(),
  quantityTotal: integer("quantity_total").notNull(), // Total items in inventory
  quantityAvailable: integer("quantity_available").notNull(), // Currently available
  priceInCents: integer("price_in_cents").notNull().default(0), // Price to charge for checkout
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"), // Admin notes about the item
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

// Item checkouts table
export const itemCheckouts = pgTable("item_checkouts", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => inventoryItems.id),
  userId: integer("user_id").notNull().references(() => users.id),
  checkedOutByStaffId: integer("checked_out_by_staff_id").notNull().references(() => users.id),
  checkedInByStaffId: integer("checked_in_by_staff_id").references(() => users.id),
  checkedOutAt: timestamp("checked_out_at").notNull().defaultNow(),
  checkedInAt: timestamp("checked_in_at"),
  status: checkoutStatusEnum("status").notNull().default('checked_out'),
  notes: text("notes"), // Staff notes
  // Payment tracking fields
  paymentStatus: checkoutPaymentStatusEnum("payment_status").notNull().default('not_charged'),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  chargedAmountCents: integer("charged_amount_cents"),
  chargedAt: timestamp("charged_at"),
});

// Insert schemas for inventory
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertItemCheckoutSchema = createInsertSchema(itemCheckouts).omit({
  id: true,
  checkedOutAt: true,
});

// Types for inventory
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type ItemCheckout = typeof itemCheckouts.$inferSelect;
export type InsertItemCheckout = z.infer<typeof insertItemCheckoutSchema>;

// Day of week enum for hours of operation
export const dayOfWeekEnum = pgEnum('day_of_week', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

// Hours of operation table
export const hoursOfOperation = pgTable("hours_of_operation", {
  id: serial("id").primaryKey(),
  dayOfWeek: dayOfWeekEnum("day_of_week").notNull().unique(),
  openTime: text("open_time").notNull(), // Member access start time, e.g., "6:00 AM"
  closeTime: text("close_time").notNull(), // Member access end time, e.g., "10:00 PM"
  dayPassStart: text("day_pass_start"), // Day pass access start time, e.g., "9:00 AM"
  dayPassEnd: text("day_pass_end"), // Day pass access end time, e.g., "10:00 PM"
  isClosed: boolean("is_closed").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

// Insert schema for hours of operation
export const insertHoursOfOperationSchema = createInsertSchema(hoursOfOperation).omit({
  id: true,
  updatedAt: true,
});

// Types for hours of operation
export type HoursOfOperation = typeof hoursOfOperation.$inferSelect;
export type InsertHoursOfOperation = z.infer<typeof insertHoursOfOperationSchema>;

// Login events table for tracking staff/admin logins
export const loginEvents = pgTable("login_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  wasSuccessful: boolean("was_successful").notNull().default(true),
});

// Insert schema for login events
export const insertLoginEventSchema = createInsertSchema(loginEvents).omit({
  id: true,
  occurredAt: true,
});

// Types for login events
export type LoginEvent = typeof loginEvents.$inferSelect;
export type InsertLoginEvent = z.infer<typeof insertLoginEventSchema>;

// Schema for updating staff/admin users
export const updateStaffAdminSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().optional(),
  role: z.enum(['staff', 'admin']).optional(),
  password: z.string().min(6).optional(),
  mustChangePassword: z.boolean().optional(),
});

// Session type enum
export const sessionTypeEnum = pgEnum('session_type', ['morning', 'evening']);

// Session configurations table - configurable morning/evening session times
export const sessionConfigs = pgTable("session_configs", {
  id: serial("id").primaryKey(),
  sessionType: sessionTypeEnum("session_type").notNull().unique(),
  startTime: text("start_time").notNull(), // e.g., "7:00 AM"
  endTime: text("end_time").notNull(), // e.g., "12:00 PM"
  capacity: integer("capacity").notNull().default(20), // Max members per session
  isEnabled: boolean("is_enabled").notNull().default(true),
  bookingGraceMinutes: integer("booking_grace_minutes").notNull().default(60), // Minutes after session start that booking is still allowed
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

// Session bookings table - member reservations for specific dates/sessions
export const sessionBookings = pgTable("session_bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  sessionType: sessionTypeEnum("session_type").notNull(),
  bookingDate: date("booking_date").notNull(), // The date of the booking
  status: text("status").notNull().default('confirmed'), // confirmed, cancelled, checked_in
  createdAt: timestamp("created_at").defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
});

// Insert schemas for sessions
export const insertSessionConfigSchema = createInsertSchema(sessionConfigs).omit({
  id: true,
  updatedAt: true,
});

export const insertSessionBookingSchema = createInsertSchema(sessionBookings).omit({
  id: true,
  createdAt: true,
  cancelledAt: true,
});

// Types for sessions
export type SessionConfig = typeof sessionConfigs.$inferSelect;
export type InsertSessionConfig = z.infer<typeof insertSessionConfigSchema>;
export type SessionBooking = typeof sessionBookings.$inferSelect;
export type InsertSessionBooking = z.infer<typeof insertSessionBookingSchema>;

// Day pass hours configuration - separate from member sessions
export const dayPassHours = pgTable("day_pass_hours", {
  id: serial("id").primaryKey(),
  startTime: text("start_time").notNull().default("10:00 AM"), // Default 10 AM
  endTime: text("end_time").notNull().default("5:00 PM"), // Default 5 PM
  isEnabled: boolean("is_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDayPassHoursSchema = createInsertSchema(dayPassHours).omit({
  id: true,
  updatedAt: true,
});

export type DayPassHours = typeof dayPassHours.$inferSelect;
export type InsertDayPassHours = z.infer<typeof insertDayPassHoursSchema>;

// Guest waivers table - for walk-in guests who sign waivers without creating accounts
export const guestWaivers = pgTable("guest_waivers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  phoneNumber: text("phone_number"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  waiverSignedAt: timestamp("waiver_signed_at").notNull().defaultNow(),
  waiverAgreed: boolean("waiver_agreed").notNull().default(true),
  checkInTimestamp: timestamp("check_in_timestamp").notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGuestWaiverSchema = createInsertSchema(guestWaivers).omit({
  id: true,
  createdAt: true,
  waiverSignedAt: true,
  checkInTimestamp: true,
});

export type GuestWaiver = typeof guestWaivers.$inferSelect;
export type InsertGuestWaiver = z.infer<typeof insertGuestWaiverSchema>;

// Site settings table - for configurable site-wide settings
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSiteSettingSchema = createInsertSchema(siteSettings).omit({
  id: true,
  updatedAt: true,
});

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;

// Gift card status enum
export const giftCardStatusEnum = pgEnum('gift_card_status', ['active', 'redeemed', 'expired', 'disabled']);

// Gift cards table
export const giftCards = pgTable("gift_cards", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull().default('monetary'), // 'monetary' or 'day_pass_bundle'
  initialAmount: integer("initial_amount").notNull(), // in cents for monetary, number of passes for bundles
  remainingAmount: integer("remaining_amount").notNull(), // in cents for monetary, remaining passes for bundles
  status: giftCardStatusEnum("status").notNull().default('active'),
  purchaserEmail: text("purchaser_email").notNull(),
  purchaserName: text("purchaser_name").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name").notNull(),
  personalMessage: text("personal_message"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  redeemedByUserId: integer("redeemed_by_user_id").references(() => users.id),
  redeemedAt: timestamp("redeemed_at"),
  expiresAt: timestamp("expires_at"),
  emailSent: boolean("email_sent").notNull().default(false),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGiftCardSchema = createInsertSchema(giftCards).omit({
  id: true,
  createdAt: true,
  redeemedAt: true,
  emailSent: true,
  emailSentAt: true,
});

export type GiftCard = typeof giftCards.$inferSelect;
export type InsertGiftCard = z.infer<typeof insertGiftCardSchema>;

// Gift card redemption history
export const giftCardRedemptions = pgTable("gift_card_redemptions", {
  id: serial("id").primaryKey(),
  giftCardId: integer("gift_card_id").notNull().references(() => giftCards.id),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(), // cents redeemed or passes used
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGiftCardRedemptionSchema = createInsertSchema(giftCardRedemptions).omit({
  id: true,
  createdAt: true,
});

export type GiftCardRedemption = typeof giftCardRedemptions.$inferSelect;
export type InsertGiftCardRedemption = z.infer<typeof insertGiftCardRedemptionSchema>;

// Gift card denomination templates (admin configurable)
export const giftCardDenominations = pgTable("gift_card_denominations", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default('monetary'), // 'monetary' or 'day_pass_bundle'
  label: text("label").notNull(), // e.g., "$25 Gift Card" or "5-Day Pass Bundle"
  value: integer("value").notNull(), // in cents for monetary, number of passes for bundles
  price: integer("price").notNull(), // selling price in cents
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGiftCardDenominationSchema = createInsertSchema(giftCardDenominations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type GiftCardDenomination = typeof giftCardDenominations.$inferSelect;
export type InsertGiftCardDenomination = z.infer<typeof insertGiftCardDenominationSchema>;

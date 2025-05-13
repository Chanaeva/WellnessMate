import { pgTable, text, serial, integer, boolean, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
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
  role: roleEnum("role").notNull().default('member'),
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

// Check-in records table definition
export const checkIns = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  membershipId: text("membership_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  location: text("location").notNull().default('Main Entrance'),
});

// Payment status enum
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'successful', 'failed', 'refunded']);

// Payment method enum
export const paymentMethodEnum = pgEnum('payment_method', ['credit_card', 'debit_card', 'cash', 'check']);

// Payments table definition
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  membershipId: text("membership_id").notNull(),
  amount: integer("amount").notNull(), // Stored in cents
  description: text("description").notNull(),
  status: paymentStatusEnum("status").notNull(),
  method: paymentMethodEnum("method").notNull(),
  transactionDate: timestamp("transaction_date").defaultNow(),
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

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
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

// Define login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginData = z.infer<typeof loginSchema>;

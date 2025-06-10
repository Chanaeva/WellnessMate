import { 
  users, type User, type InsertUser,
  passwordResetTokens, type PasswordResetToken, type InsertPasswordResetToken,
  memberships, type Membership, type InsertMembership,
  checkIns, type CheckIn, type InsertCheckIn,
  payments, type Payment, type InsertPayment,
  paymentMethods, type PaymentMethod, type InsertPaymentMethod,
  membershipPlans, type MembershipPlan, type InsertMembershipPlan,
  punchCardTemplates, type PunchCardTemplate, type InsertPunchCardTemplate,
  punchCards, type PunchCard, type InsertPunchCard,
  memberPreferences, type MemberPreferences, type InsertMemberPreferences,
  therapySessions, type TherapySession, type InsertTherapySession,
  healthMetrics, type HealthMetrics, type InsertHealthMetrics,
  stravaIntegrations, type StravaIntegration, type InsertStravaIntegration,
  treatmentTypeEnum
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, and, lt, gte, lte, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: number, newPassword: string): Promise<User>;

  // Password reset methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markTokenAsUsed(tokenId: number): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
  
  // Membership methods
  getMembershipByUserId(userId: number): Promise<Membership | undefined>;
  getMembershipById(id: string): Promise<Membership | undefined>;
  createMembership(membership: InsertMembership): Promise<Membership>;
  updateMembership(id: string, data: Partial<Membership>): Promise<Membership>;
  getAllMembers(): Promise<(User & {membership?: Membership})[]>;

  // Check-in methods
  getCheckInsByUserId(userId: number): Promise<CheckIn[]>;
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  getAllCheckIns(page: number, limit: number): Promise<{data: CheckIn[], total: number, page: number, limit: number}>;
  getTodayCheckIns(): Promise<CheckIn[]>;

  // Payment methods
  getPaymentsByUserId(userId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;

  // Stripe customer and payment method management
  updateUserStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User>;
  getPaymentMethodsByUserId(userId: number): Promise<PaymentMethod[]>;
  createPaymentMethod(paymentMethod: InsertPaymentMethod): Promise<PaymentMethod>;
  deletePaymentMethod(paymentMethodId: string): Promise<void>;
  setDefaultPaymentMethod(userId: number, paymentMethodId: string): Promise<void>;

  // Membership plan methods
  getAllMembershipPlans(): Promise<MembershipPlan[]>;
  createOrUpdateMembershipPlan(plan: InsertMembershipPlan): Promise<MembershipPlan>;

  // Punch card template methods
  getAllPunchCardTemplates(): Promise<PunchCardTemplate[]>;
  createPunchCardTemplate(template: InsertPunchCardTemplate): Promise<PunchCardTemplate>;
  updatePunchCardTemplate(id: number, template: Partial<PunchCardTemplate>): Promise<PunchCardTemplate>;
  deletePunchCardTemplate(id: number): Promise<void>;

  // Punch card methods
  getPunchCardsByUserId(userId: number): Promise<PunchCard[]>;
  getPunchCardById(id: number): Promise<PunchCard | undefined>;
  createPunchCard(punchCard: InsertPunchCard): Promise<PunchCard>;
  usePunchCardEntry(id: number): Promise<PunchCard>;
  getAvailablePunchCardOptions(): Promise<{name: string, totalPunches: number, totalPrice: number, pricePerPunch: number}[]>;

  // Member preferences methods
  getMemberPreferences(userId: number): Promise<MemberPreferences | undefined>;
  createOrUpdateMemberPreferences(preferences: InsertMemberPreferences): Promise<MemberPreferences>;

  // Therapy session methods
  getTherapySessionsByUserId(userId: number): Promise<TherapySession[]>;
  createTherapySession(session: InsertTherapySession): Promise<TherapySession>;
  getTherapySessionStats(userId: number): Promise<any>; // Summary stats for user's sessions

  // Health metrics methods
  getHealthMetricsByUserId(userId: number): Promise<HealthMetrics[]>;
  createHealthMetrics(metrics: InsertHealthMetrics): Promise<HealthMetrics>;
  getHealthMetricsTimeline(userId: number, days: number): Promise<HealthMetrics[]>;

  // Strava integration methods
  getStravaIntegration(userId: number): Promise<StravaIntegration | undefined>;
  createOrUpdateStravaIntegration(integration: InsertStravaIntegration): Promise<StravaIntegration>;
  disconnectStravaIntegration(userId: number): Promise<void>;

  // Visit logging and analytics methods
  getVisitAnalytics(period: string): Promise<any>;
  getPeakHoursAnalytics(): Promise<any>;
  getDashboardSummary(): Promise<any>;
  getUserByMembershipId(membershipId: string): Promise<User | undefined>;
  
  // Session store
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
    
    this.initializeMembershipPlans();
    this.initializePunchCardTemplates();
  }

  private async initializeMembershipPlans() {
    // Initialize default membership plans if they don't exist
    const defaultPlans = [
      {
        name: "Monthly Membership",
        planType: "basic" as const,
        description: "Full access to all wellness facilities",
        monthlyPrice: 6500, // $65/month in cents
        features: ["Unlimited sauna access", "Cold plunge access", "Infrared therapy", "Steam room", "All thermal treatments"]
      },
      {
        name: "Drop-in Pass",
        planType: "daily" as const,
        description: "Single day access to all facilities",
        monthlyPrice: 3000, // $30/day in cents
        features: ["Full day access", "All thermal treatments", "No commitment"]
      }
    ];

    for (const plan of defaultPlans) {
      try {
        await db.insert(membershipPlans).values(plan).onConflictDoNothing();
      } catch (error) {
        // Plans might already exist, continue
      }
    }
  }

  private async initializePunchCardTemplates() {
    // Initialize default punch card templates if they don't exist
    const defaultTemplates = [
      { name: "5-Day Pass", totalPunches: 5, totalPrice: 13500, pricePerPunch: 2700, description: "Perfect for trying out our facilities", sortOrder: 1 },
      { name: "10-Day Pass", totalPunches: 10, totalPrice: 24000, pricePerPunch: 2400, description: "Great value for regular visitors", sortOrder: 2 },
      { name: "20-Day Pass", totalPunches: 20, totalPrice: 42000, pricePerPunch: 2100, description: "Best value for committed wellness enthusiasts", sortOrder: 3 },
    ];

    for (const template of defaultTemplates) {
      try {
        await db.insert(punchCardTemplates).values(template).onConflictDoNothing();
      } catch (error) {
        // Templates might already exist, continue
      }
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ password: newPassword })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [token] = await db
      .insert(passwordResetTokens)
      .values(insertToken)
      .returning();
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken || undefined;
  }

  async markTokenAsUsed(tokenId: number): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, tokenId));
  }

  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    await db
      .delete(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.used, false),
        lt(passwordResetTokens.expiresAt, now)
      ));
  }

  async getMembershipByUserId(userId: number): Promise<Membership | undefined> {
    const [membership] = await db.select().from(memberships).where(eq(memberships.userId, userId));
    return membership || undefined;
  }

  async getMembershipById(id: string): Promise<Membership | undefined> {
    const [membership] = await db.select().from(memberships).where(eq(memberships.membershipId, id));
    return membership || undefined;
  }

  async createMembership(insertMembership: InsertMembership): Promise<Membership> {
    const [membership] = await db
      .insert(memberships)
      .values(insertMembership)
      .returning();
    return membership;
  }

  async updateMembership(id: string, data: Partial<Membership>): Promise<Membership> {
    const [membership] = await db
      .update(memberships)
      .set(data)
      .where(eq(memberships.membershipId, id))
      .returning();
    return membership;
  }

  async getAllMembers(): Promise<(User & {membership?: Membership})[]> {
    const allUsers = await db.select().from(users);
    const result = [];
    
    for (const user of allUsers) {
      const membership = await this.getMembershipByUserId(user.id);
      result.push({ ...user, membership });
    }
    
    return result;
  }

  async getCheckInsByUserId(userId: number): Promise<CheckIn[]> {
    return await db.select().from(checkIns).where(eq(checkIns.userId, userId)).orderBy(desc(checkIns.timestamp));
  }

  async createCheckIn(insertCheckIn: InsertCheckIn): Promise<CheckIn> {
    const [checkIn] = await db
      .insert(checkIns)
      .values(insertCheckIn)
      .returning();
    return checkIn;
  }

  async getAllCheckIns(page: number, limit: number): Promise<{data: CheckIn[], total: number, page: number, limit: number}> {
    const allCheckIns = await db.select().from(checkIns).orderBy(desc(checkIns.timestamp));
    const total = allCheckIns.length;
    const startIndex = (page - 1) * limit;
    const data = allCheckIns.slice(startIndex, startIndex + limit);
    
    return { data, total, page, limit };
  }

  async getTodayCheckIns(): Promise<any[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return await db.select({
      id: checkIns.id,
      userId: checkIns.userId,
      membershipId: checkIns.membershipId,
      timestamp: checkIns.timestamp,
      location: checkIns.location,
      method: sql<string>`CASE WHEN ${checkIns.location} LIKE '%Manual%' OR ${checkIns.location} LIKE '%Front Desk%' THEN 'manual' ELSE 'qr' END`,
      user: {
        username: users.username,
        email: users.email
      }
    })
    .from(checkIns)
    .leftJoin(users, eq(checkIns.userId, users.id))
    .where(gte(checkIns.timestamp, today))
    .orderBy(desc(checkIns.timestamp));
  }

  async getPaymentsByUserId(userId: number): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.transactionDate));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db
      .insert(payments)
      .values(insertPayment)
      .returning();
    return payment;
  }

  async updateUserStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ stripeCustomerId })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getPaymentMethodsByUserId(userId: number): Promise<PaymentMethod[]> {
    return await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .orderBy(desc(paymentMethods.isDefault), desc(paymentMethods.createdAt));
  }

  async createPaymentMethod(insertPaymentMethod: InsertPaymentMethod): Promise<PaymentMethod> {
    const [paymentMethod] = await db
      .insert(paymentMethods)
      .values(insertPaymentMethod)
      .returning();
    return paymentMethod;
  }

  async deletePaymentMethod(stripePaymentMethodId: string): Promise<void> {
    await db
      .delete(paymentMethods)
      .where(eq(paymentMethods.stripePaymentMethodId, stripePaymentMethodId));
  }

  async setDefaultPaymentMethod(userId: number, stripePaymentMethodId: string): Promise<void> {
    // First, unset all existing default payment methods for this user
    await db
      .update(paymentMethods)
      .set({ isDefault: false })
      .where(eq(paymentMethods.userId, userId));

    // Then set the specified payment method as default
    await db
      .update(paymentMethods)
      .set({ isDefault: true })
      .where(and(
        eq(paymentMethods.userId, userId),
        eq(paymentMethods.stripePaymentMethodId, stripePaymentMethodId)
      ));
  }

  async getAllMembershipPlans(): Promise<MembershipPlan[]> {
    return await db.select().from(membershipPlans);
  }

  async createOrUpdateMembershipPlan(insertPlan: InsertMembershipPlan): Promise<MembershipPlan> {
    const [plan] = await db
      .insert(membershipPlans)
      .values(insertPlan)
      .onConflictDoUpdate({
        target: membershipPlans.planType,
        set: insertPlan
      })
      .returning();
    return plan;
  }

  async getMemberPreferences(userId: number): Promise<MemberPreferences | undefined> {
    const [preferences] = await db.select().from(memberPreferences).where(eq(memberPreferences.userId, userId));
    return preferences || undefined;
  }

  async createOrUpdateMemberPreferences(preferences: InsertMemberPreferences): Promise<MemberPreferences> {
    const existing = await this.getMemberPreferences(preferences.userId);
    
    if (existing) {
      const [updated] = await db
        .update(memberPreferences)
        .set(preferences)
        .where(eq(memberPreferences.userId, preferences.userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(memberPreferences)
        .values(preferences)
        .returning();
      return created;
    }
  }

  async getTherapySessionsByUserId(userId: number): Promise<TherapySession[]> {
    return await db.select().from(therapySessions).where(eq(therapySessions.userId, userId)).orderBy(desc(therapySessions.createdAt));
  }

  async createTherapySession(session: InsertTherapySession): Promise<TherapySession> {
    const [newSession] = await db
      .insert(therapySessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getTherapySessionStats(userId: number): Promise<any> {
    const sessions = await this.getTherapySessionsByUserId(userId);
    
    // Calculate various stats
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, session) => {
      const start = new Date(session.startTime!);
      const end = new Date(session.endTime!);
      return sum + (end.getTime() - start.getTime()) / (1000 * 60); // minutes
    }, 0);
    
    const avgDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
    
    const treatmentCounts = sessions.reduce((counts, session) => {
      counts[session.treatmentType] = (counts[session.treatmentType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const favoritetreatment = Object.entries(treatmentCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;
    
    return {
      totalSessions,
      totalDuration: Math.round(totalDuration),
      avgDuration: Math.round(avgDuration),
      favoritetreatment,
      treatmentCounts
    };
  }

  async getHealthMetricsByUserId(userId: number): Promise<HealthMetrics[]> {
    return await db.select().from(healthMetrics).where(eq(healthMetrics.userId, userId)).orderBy(desc(healthMetrics.createdAt));
  }

  async createHealthMetrics(metrics: InsertHealthMetrics): Promise<HealthMetrics> {
    const [newMetrics] = await db
      .insert(healthMetrics)
      .values(metrics)
      .returning();
    return newMetrics;
  }

  async getHealthMetricsTimeline(userId: number, days: number = 30): Promise<HealthMetrics[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await db.select().from(healthMetrics)
      .where(and(
        eq(healthMetrics.userId, userId),
        gte(healthMetrics.createdAt, startDate)
      ))
      .orderBy(desc(healthMetrics.createdAt));
  }

  async getStravaIntegration(userId: number): Promise<StravaIntegration | undefined> {
    const [integration] = await db.select().from(stravaIntegrations).where(eq(stravaIntegrations.userId, userId));
    return integration || undefined;
  }

  async createOrUpdateStravaIntegration(integration: InsertStravaIntegration): Promise<StravaIntegration> {
    const existing = await this.getStravaIntegration(integration.userId);
    
    if (existing) {
      const [updated] = await db
        .update(stravaIntegrations)
        .set(integration)
        .where(eq(stravaIntegrations.userId, integration.userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(stravaIntegrations)
        .values(integration)
        .returning();
      return created;
    }
  }

  async disconnectStravaIntegration(userId: number): Promise<void> {
    await db.delete(stravaIntegrations).where(eq(stravaIntegrations.userId, userId));
  }

  async getPunchCardsByUserId(userId: number): Promise<PunchCard[]> {
    return await db.select().from(punchCards).where(eq(punchCards.userId, userId)).orderBy(punchCards.purchasedAt);
  }

  async getPunchCardById(id: number): Promise<PunchCard | undefined> {
    const [card] = await db.select().from(punchCards).where(eq(punchCards.id, id));
    return card || undefined;
  }

  async createPunchCard(insertPunchCard: InsertPunchCard): Promise<PunchCard> {
    const [punchCard] = await db
      .insert(punchCards)
      .values(insertPunchCard)
      .returning();
    return punchCard;
  }

  async usePunchCardEntry(id: number): Promise<PunchCard> {
    const card = await this.getPunchCardById(id);
    if (!card) {
      throw new Error("Punch card not found");
    }

    if (card.remainingPunches <= 0) {
      throw new Error("No remaining punches on this card");
    }

    const newRemaining = card.remainingPunches - 1;
    const newStatus = newRemaining === 0 ? "exhausted" : card.status;

    const [updatedCard] = await db
      .update(punchCards)
      .set({ 
        remainingPunches: newRemaining,
        status: newStatus
      })
      .where(eq(punchCards.id, id))
      .returning();

    return updatedCard;
  }

  async getAllPunchCardTemplates(): Promise<PunchCardTemplate[]> {
    return await db.select().from(punchCardTemplates).orderBy(punchCardTemplates.sortOrder, punchCardTemplates.totalPunches);
  }

  async createPunchCardTemplate(template: InsertPunchCardTemplate): Promise<PunchCardTemplate> {
    const [newTemplate] = await db
      .insert(punchCardTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async updatePunchCardTemplate(id: number, template: Partial<PunchCardTemplate>): Promise<PunchCardTemplate> {
    const [updatedTemplate] = await db
      .update(punchCardTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(punchCardTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deletePunchCardTemplate(id: number): Promise<void> {
    await db.delete(punchCardTemplates).where(eq(punchCardTemplates.id, id));
  }

  async getAvailablePunchCardOptions(): Promise<{name: string, totalPunches: number, totalPrice: number, pricePerPunch: number}[]> {
    const templates = await db.select().from(punchCardTemplates)
      .where(eq(punchCardTemplates.isActive, true))
      .orderBy(punchCardTemplates.sortOrder, punchCardTemplates.totalPunches);
    
    return templates.map(template => ({
      name: template.name,
      totalPunches: template.totalPunches,
      totalPrice: template.totalPrice,
      pricePerPunch: template.pricePerPunch
    }));
  }

  async getVisitAnalytics(period: string): Promise<any> {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const checkInResults = await db
      .select()
      .from(checkIns)
      .where(gte(checkIns.timestamp, startDate));

    // Group by date for chart data
    const visitsByDate = checkInResults.reduce((acc: any, checkIn) => {
      if (checkIn.timestamp) {
        const date = new Date(checkIn.timestamp).toDateString();
        acc[date] = (acc[date] || 0) + 1;
      }
      return acc;
    }, {});

    return {
      totalVisits: checkInResults.length,
      averageDaily: Math.round(checkInResults.length / Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)))),
      visitsByDate,
      period
    };
  }

  async getPeakHoursAnalytics(): Promise<any> {
    const now = new Date();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const weeklyCheckIns = await db
      .select()
      .from(checkIns)
      .where(gte(checkIns.timestamp, startOfWeek));

    // Group by hour of day
    const hourlyVisits = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      visits: 0,
      label: hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`
    }));

    weeklyCheckIns.forEach(checkIn => {
      if (checkIn.timestamp) {
        const hour = new Date(checkIn.timestamp).getHours();
        hourlyVisits[hour].visits++;
      }
    });

    const peakHour = hourlyVisits.reduce((max, current) => 
      current.visits > max.visits ? current : max
    );

    return {
      hourlyData: hourlyVisits,
      peakHour: peakHour.label,
      peakVisits: peakHour.visits
    };
  }

  async getDashboardSummary(): Promise<any> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Today's check-ins
    const todayCheckIns = await db
      .select()
      .from(checkIns)
      .where(gte(checkIns.timestamp, today));

    // This month's check-ins
    const thisMonthCheckIns = await db
      .select()
      .from(checkIns)
      .where(gte(checkIns.timestamp, thisMonth));

    // Last month's check-ins for comparison
    const lastMonthCheckIns = await db
      .select()
      .from(checkIns)
      .where(and(
        gte(checkIns.timestamp, lastMonth),
        lte(checkIns.timestamp, lastMonthEnd)
      ));

    // Active memberships
    const activeMembers = await db
      .select()
      .from(memberships)
      .where(eq(memberships.status, 'active'));

    // New members this month
    const newMembersThisMonth = await db
      .select()
      .from(users)
      .where(gte(users.createdAt, thisMonth));

    return {
      todayVisits: todayCheckIns.length,
      monthlyVisits: thisMonthCheckIns.length,
      activeMembers: activeMembers.length,
      newMembers: newMembersThisMonth.length,
      growth: {
        visits: lastMonthCheckIns.length > 0 ? 
          Math.round(((thisMonthCheckIns.length - lastMonthCheckIns.length) / lastMonthCheckIns.length) * 100) : 0
      }
    };
  }

  async getUserByMembershipId(membershipId: string): Promise<User | undefined> {
    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.membershipId, membershipId))
      .limit(1);

    if (!membership) return undefined;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, membership.userId))
      .limit(1);

    return user;
  }
}

export const storage = new DatabaseStorage();
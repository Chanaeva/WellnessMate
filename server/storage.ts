import { 
  users, type User, type InsertUser,
  memberships, type Membership, type InsertMembership,
  checkIns, type CheckIn, type InsertCheckIn,
  payments, type Payment, type InsertPayment,
  membershipPlans, type MembershipPlan, type InsertMembershipPlan,
  punchCards, type PunchCard, type InsertPunchCard,
  memberPreferences, type MemberPreferences, type InsertMemberPreferences,
  therapySessions, type TherapySession, type InsertTherapySession,
  healthMetrics, type HealthMetrics, type InsertHealthMetrics,
  stravaIntegrations, type StravaIntegration, type InsertStravaIntegration,
  treatmentTypeEnum
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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

  // Membership plan methods
  getAllMembershipPlans(): Promise<MembershipPlan[]>;
  createOrUpdateMembershipPlan(plan: InsertMembershipPlan): Promise<MembershipPlan>;

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
  
  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private memberships: Map<string, Membership>;
  private checkIns: CheckIn[];
  private payments: Payment[];
  private membershipPlans: Map<string, MembershipPlan>;
  private punchCards: PunchCard[];
  private memberPreferences: Map<number, MemberPreferences>;
  private therapySessions: TherapySession[];
  private healthMetrics: HealthMetrics[];
  private stravaIntegrations: Map<number, StravaIntegration>;
  sessionStore: session.SessionStore;

  private currentUserId: number;
  private currentCheckInId: number;
  private currentPaymentId: number;
  private currentMembershipPlanId: number;
  private currentMemberPreferencesId: number;
  private currentTherapySessionId: number;
  private currentHealthMetricsId: number;
  private currentStravaIntegrationId: number;
  private currentPunchCardId: number;

  constructor() {
    this.users = new Map();
    this.memberships = new Map();
    this.checkIns = [];
    this.payments = [];
    this.membershipPlans = new Map();
    this.punchCards = [];
    this.memberPreferences = new Map();
    this.therapySessions = [];
    this.healthMetrics = [];
    this.stravaIntegrations = new Map();
    
    this.currentUserId = 1;
    this.currentCheckInId = 1;
    this.currentPaymentId = 1;
    this.currentMembershipPlanId = 1;
    this.currentMemberPreferencesId = 1;
    this.currentTherapySessionId = 1;
    this.currentHealthMetricsId = 1;
    this.currentStravaIntegrationId = 1;
    this.currentPunchCardId = 1;

    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    // Initialize with default membership plans
    this.initializeMembershipPlans();
  }

  private initializeMembershipPlans() {
    const plans: InsertMembershipPlan[] = [
      {
        planType: 'basic',
        name: 'Basic',
        monthlyPrice: 4900, // $49.00
        description: 'Basic access to thermal facilities',
        features: [
          'Thermal facilities access (6AM-10PM)',
          '5 guided sessions per month'
        ]
      },
      {
        planType: 'premium',
        name: 'Premium',
        monthlyPrice: 8900, // $89.00
        description: 'Full access to all thermal wellness facilities',
        features: [
          '24/7 thermal facilities access',
          'Unlimited guided sessions',
          'Private sauna booking',
          '2 guest passes/month'
        ]
      },
      {
        planType: 'vip',
        name: 'VIP',
        monthlyPrice: 12900, // $129.00
        description: 'VIP access with personalized thermal therapy',
        features: [
          'All Premium features',
          'Personalized thermal therapy sessions (2x/month)',
          'Wellness consultation',
          '4 guest passes/month'
        ]
      },
      {
        planType: 'daily',
        name: 'Day Pass',
        monthlyPrice: 1500, // $15.00
        description: 'Single day access to thermal facilities',
        features: [
          'Full day access to thermal facilities',
          'Access to guided sessions',
          'Valid for one day only'
        ]
      }
    ];

    plans.forEach(plan => {
      this.createOrUpdateMembershipPlan(plan);
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id, createdAt: new Date() };
    this.users.set(id, user);
    return user;
  }

  // Membership methods
  async getMembershipByUserId(userId: number): Promise<Membership | undefined> {
    return Array.from(this.memberships.values()).find(
      (membership) => membership.userId === userId,
    );
  }

  async getMembershipById(id: string): Promise<Membership | undefined> {
    return this.memberships.get(id);
  }

  async createMembership(insertMembership: InsertMembership): Promise<Membership> {
    const membership: Membership = { 
      ...insertMembership,
      id: this.memberships.size + 1, 
      createdAt: new Date() 
    };
    this.memberships.set(insertMembership.membershipId, membership);
    return membership;
  }

  async updateMembership(id: string, data: Partial<Membership>): Promise<Membership> {
    const membership = this.memberships.get(id);
    if (!membership) {
      throw new Error('Membership not found');
    }

    const updatedMembership = { ...membership, ...data };
    this.memberships.set(id, updatedMembership);
    return updatedMembership;
  }

  async getAllMembers(): Promise<(User & {membership?: Membership})[]> {
    return Array.from(this.users.values()).map(user => {
      const membership = Array.from(this.memberships.values()).find(
        membership => membership.userId === user.id
      );
      return { ...user, membership };
    });
  }

  // Check-in methods
  async getCheckInsByUserId(userId: number): Promise<CheckIn[]> {
    return this.checkIns.filter(checkIn => checkIn.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async createCheckIn(insertCheckIn: InsertCheckIn): Promise<CheckIn> {
    const id = this.currentCheckInId++;
    const checkIn: CheckIn = { 
      ...insertCheckIn, 
      id, 
      timestamp: new Date() 
    };
    this.checkIns.push(checkIn);
    return checkIn;
  }

  async getAllCheckIns(page: number, limit: number): Promise<{data: CheckIn[], total: number, page: number, limit: number}> {
    const sortedCheckIns = [...this.checkIns].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const start = (page - 1) * limit;
    const end = start + limit;
    const data = sortedCheckIns.slice(start, end);
    
    return {
      data,
      total: this.checkIns.length,
      page,
      limit
    };
  }

  async getTodayCheckIns(): Promise<CheckIn[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.checkIns.filter(checkIn => {
      const checkInDate = new Date(checkIn.timestamp);
      checkInDate.setHours(0, 0, 0, 0);
      return checkInDate.getTime() === today.getTime();
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Payment methods
  async getPaymentsByUserId(userId: number): Promise<Payment[]> {
    return this.payments.filter(payment => payment.userId === userId)
      .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = this.currentPaymentId++;
    const payment: Payment = { 
      ...insertPayment, 
      id, 
      transactionDate: new Date() 
    };
    this.payments.push(payment);
    return payment;
  }

  // Membership plan methods
  async getAllMembershipPlans(): Promise<MembershipPlan[]> {
    return Array.from(this.membershipPlans.values());
  }

  async createOrUpdateMembershipPlan(insertPlan: InsertMembershipPlan): Promise<MembershipPlan> {
    // Check if plan with this type already exists
    const existingPlan = Array.from(this.membershipPlans.values()).find(
      plan => plan.planType === insertPlan.planType
    );

    if (existingPlan) {
      // Update existing plan
      const updatedPlan = { ...existingPlan, ...insertPlan };
      this.membershipPlans.set(insertPlan.planType, updatedPlan);
      return updatedPlan;
    } else {
      // Create new plan
      const id = this.currentMembershipPlanId++;
      const plan: MembershipPlan = { ...insertPlan, id };
      this.membershipPlans.set(insertPlan.planType, plan);
      return plan;
    }
  }
  
  // Member preferences methods
  async getMemberPreferences(userId: number): Promise<MemberPreferences | undefined> {
    return this.memberPreferences.get(userId);
  }

  async createOrUpdateMemberPreferences(preferences: InsertMemberPreferences): Promise<MemberPreferences> {
    const existingPreferences = this.memberPreferences.get(preferences.userId);
    
    if (existingPreferences) {
      const updatedPreferences = {
        ...existingPreferences,
        ...preferences,
        updatedAt: new Date()
      };
      this.memberPreferences.set(preferences.userId, updatedPreferences);
      return updatedPreferences;
    } else {
      const newPreferences: MemberPreferences = {
        id: this.currentMemberPreferencesId++,
        ...preferences,
        updatedAt: new Date()
      };
      this.memberPreferences.set(preferences.userId, newPreferences);
      return newPreferences;
    }
  }

  // Therapy session methods
  async getTherapySessionsByUserId(userId: number): Promise<TherapySession[]> {
    return this.therapySessions
      .filter(session => session.userId === userId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  async createTherapySession(session: InsertTherapySession): Promise<TherapySession> {
    const newSession: TherapySession = {
      id: this.currentTherapySessionId++,
      ...session,
      createdAt: new Date()
    };
    this.therapySessions.push(newSession);
    return newSession;
  }

  async getTherapySessionStats(userId: number): Promise<any> {
    const sessions = this.therapySessions.filter(session => session.userId === userId);
    
    // No sessions yet
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalDuration: 0,
        typeBreakdown: {},
        averageStressReduction: 0,
        averageHeartRateChange: 0
      };
    }

    // Count by type
    const typeBreakdown: Record<string, number> = {};
    sessions.forEach(session => {
      const type = session.treatmentType;
      typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
    });

    // Calculate metrics
    const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
    
    // Calculate stress reduction (where available)
    const sessionsWithStressData = sessions.filter(
      session => session.stressLevelBefore !== undefined && session.stressLevelAfter !== undefined
    );
    
    const averageStressReduction = sessionsWithStressData.length > 0
      ? sessionsWithStressData.reduce(
          (sum, session) => sum + ((session.stressLevelBefore || 0) - (session.stressLevelAfter || 0)), 
          0
        ) / sessionsWithStressData.length
      : 0;
    
    // Calculate heart rate change (where available)
    const sessionsWithHeartRateData = sessions.filter(
      session => session.heartRateBefore !== undefined && session.heartRateAfter !== undefined
    );
    
    const averageHeartRateChange = sessionsWithHeartRateData.length > 0
      ? sessionsWithHeartRateData.reduce(
          (sum, session) => sum + ((session.heartRateBefore || 0) - (session.heartRateAfter || 0)), 
          0
        ) / sessionsWithHeartRateData.length
      : 0;

    return {
      totalSessions: sessions.length,
      totalDuration,
      typeBreakdown,
      averageStressReduction,
      averageHeartRateChange,
      recentSessions: sessions.slice(0, 5)
    };
  }
  
  // Health metrics methods
  async getHealthMetricsByUserId(userId: number): Promise<HealthMetrics[]> {
    return this.healthMetrics
      .filter(metrics => metrics.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async createHealthMetrics(metrics: InsertHealthMetrics): Promise<HealthMetrics> {
    const newMetrics: HealthMetrics = {
      id: this.currentHealthMetricsId++,
      ...metrics,
      createdAt: new Date()
    };
    this.healthMetrics.push(newMetrics);
    return newMetrics;
  }

  async getHealthMetricsTimeline(userId: number, days: number = 30): Promise<HealthMetrics[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.healthMetrics
      .filter(metrics => 
        metrics.userId === userId && 
        new Date(metrics.date).getTime() >= startDate.getTime()
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Strava integration methods
  async getStravaIntegration(userId: number): Promise<StravaIntegration | undefined> {
    return this.stravaIntegrations.get(userId);
  }

  async createOrUpdateStravaIntegration(integration: InsertStravaIntegration): Promise<StravaIntegration> {
    const existingIntegration = this.stravaIntegrations.get(integration.userId);
    
    if (existingIntegration) {
      const updatedIntegration = {
        ...existingIntegration,
        ...integration,
      };
      this.stravaIntegrations.set(integration.userId, updatedIntegration);
      return updatedIntegration;
    } else {
      const newIntegration: StravaIntegration = {
        id: this.currentStravaIntegrationId++,
        ...integration,
        createdAt: new Date()
      };
      this.stravaIntegrations.set(integration.userId, newIntegration);
      return newIntegration;
    }
  }

  async disconnectStravaIntegration(userId: number): Promise<void> {
    const integration = this.stravaIntegrations.get(userId);
    if (integration) {
      integration.isActive = false;
      this.stravaIntegrations.set(userId, integration);
    }
  }

  // Punch card methods
  async getPunchCardsByUserId(userId: number): Promise<PunchCard[]> {
    return this.punchCards.filter(card => card.userId === userId);
  }

  async getPunchCardById(id: number): Promise<PunchCard | undefined> {
    return this.punchCards.find(card => card.id === id);
  }

  async createPunchCard(insertPunchCard: InsertPunchCard): Promise<PunchCard> {
    const id = this.currentPunchCardId++;
    const punchCard: PunchCard = { 
      ...insertPunchCard, 
      id, 
      purchasedAt: new Date() 
    };
    this.punchCards.push(punchCard);
    return punchCard;
  }

  async usePunchCardEntry(id: number): Promise<PunchCard> {
    const punchCard = this.punchCards.find(card => card.id === id);
    if (!punchCard) {
      throw new Error('Punch card not found');
    }
    if (punchCard.remainingPunches <= 0) {
      throw new Error('No remaining punches on this card');
    }
    if (punchCard.status !== 'active') {
      throw new Error('Punch card is not active');
    }

    punchCard.remainingPunches -= 1;
    if (punchCard.remainingPunches === 0) {
      punchCard.status = 'exhausted';
    }

    return punchCard;
  }

  async getAvailablePunchCardOptions(): Promise<{name: string, totalPunches: number, totalPrice: number, pricePerPunch: number}[]> {
    return [
      {
        name: "5-Day Pass Package",
        totalPunches: 5,
        totalPrice: 12000, // $120 in cents
        pricePerPunch: 2400  // $24 in cents
      },
      {
        name: "10-Day Pass Package",
        totalPunches: 10,
        totalPrice: 22000, // $220 in cents
        pricePerPunch: 2200  // $22 in cents
      },
      {
        name: "20-Day Pass Package",
        totalPunches: 20,
        totalPrice: 40000, // $400 in cents
        pricePerPunch: 2000  // $20 in cents
      }
    ];
  }
}

export const storage = new MemStorage();

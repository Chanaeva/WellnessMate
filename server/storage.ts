import { 
  users, type User, type InsertUser,
  memberships, type Membership, type InsertMembership,
  checkIns, type CheckIn, type InsertCheckIn,
  payments, type Payment, type InsertPayment,
  membershipPlans, type MembershipPlan, type InsertMembershipPlan,
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

  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private memberships: Map<string, Membership>;
  private checkIns: CheckIn[];
  private payments: Payment[];
  private membershipPlans: Map<string, MembershipPlan>;
  sessionStore: session.SessionStore;

  private currentUserId: number;
  private currentCheckInId: number;
  private currentPaymentId: number;
  private currentMembershipPlanId: number;

  constructor() {
    this.users = new Map();
    this.memberships = new Map();
    this.checkIns = [];
    this.payments = [];
    this.membershipPlans = new Map();
    
    this.currentUserId = 1;
    this.currentCheckInId = 1;
    this.currentPaymentId = 1;
    this.currentMembershipPlanId = 1;

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
        description: 'Basic access to gym facilities',
        features: [
          'Gym access (6AM-10PM)',
          '5 classes per month'
        ]
      },
      {
        planType: 'premium',
        name: 'Premium',
        monthlyPrice: 8900, // $89.00
        description: 'Full access to all facilities and classes',
        features: [
          '24/7 gym access',
          'Unlimited classes',
          'Pool and spa access',
          '2 guest passes/month'
        ]
      },
      {
        planType: 'vip',
        name: 'VIP',
        monthlyPrice: 12900, // $129.00
        description: 'VIP access with personal training sessions',
        features: [
          'All Premium features',
          'Personal trainer (2x/month)',
          'Nutrition consultation',
          '4 guest passes/month'
        ]
      },
      {
        planType: 'daily',
        name: 'Day Pass',
        monthlyPrice: 1500, // $15.00
        description: 'Single day access',
        features: [
          'Full day access to gym',
          'Access to group classes',
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
}

export const storage = new MemStorage();

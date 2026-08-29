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
  notifications, type Notification, type InsertNotification,
  landingPageContent, type LandingPageContent, type InsertLandingPageContent,
  promotions, type Promotion, type InsertPromotion,
  galleryImages, type GalleryImage, type InsertGalleryImage,
  faqItems, type FaqItem, type InsertFaqItem,
  inventoryItems, type InventoryItem, type InsertInventoryItem,
  itemCheckouts, type ItemCheckout, type InsertItemCheckout,
  loginEvents, type LoginEvent, type InsertLoginEvent,
  sessionConfigs, type SessionConfig, type InsertSessionConfig,
  sessionBookings, type SessionBooking, type InsertSessionBooking,
  dayPassHours, type DayPassHours,
  guestWaivers, type GuestWaiver, type InsertGuestWaiver,
  waiverQuestions, type WaiverQuestion, type InsertWaiverQuestion,
  guestWaiverAnswers, type GuestWaiverAnswer,
  siteSettings, type SiteSetting, type InsertSiteSetting,
  treatmentTypeEnum,
  giftCards, type GiftCard, type InsertGiftCard,
  giftCardRedemptions, type GiftCardRedemption, type InsertGiftCardRedemption,
  giftCardDenominations, type GiftCardDenomination, type InsertGiftCardDenomination,
  waitlist, type Waitlist, type InsertWaitlist,
  events, type Event, type InsertEvent,
  eventBookings, type EventBooking, type InsertEventBooking,
  checklistItems, type ChecklistItem, type InsertChecklistItem,
  checklistRuns, type ChecklistRun, type InsertChecklistRun,
  checklistRunItems, type ChecklistRunItem,
  newsletters, type Newsletter, type InsertNewsletter,
  smsBroadcasts, type SmsBroadcast, type InsertSmsBroadcast,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, and, lt, gt, gte, lte, sql, or, inArray, ilike, isNull } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: number, data: Partial<User>): Promise<User>;
  updateUserPassword(userId: number, newPassword: string): Promise<User>;
  deleteUser(userId: number): Promise<void>;
  archiveUser(userId: number): Promise<User>;
  unarchiveUser(userId: number): Promise<User>;
  createStaffAdmin(data: { email: string; password: string; firstName: string; lastName: string; role: 'staff' | 'admin'; phoneNumber?: string; mustChangePassword?: boolean }): Promise<User>;
  updateStaffAdmin(userId: number, data: Partial<{ email: string; password: string; firstName: string; lastName: string; role: 'staff' | 'admin'; phoneNumber: string; mustChangePassword: boolean }>): Promise<User>;
  deleteStaffAdmin(userId: number): Promise<void>;
  listStaffAdmins(): Promise<User[]>;

  // Login event methods
  createLoginEvent(event: InsertLoginEvent): Promise<LoginEvent>;
  getLoginEventsByUserId(userId: number, limit?: number): Promise<LoginEvent[]>;
  getAllStaffLoginEvents(limit?: number): Promise<(LoginEvent & { user?: User })[]>;
  updateUserLastLogin(userId: number): Promise<void>;

  // Password reset methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markTokenAsUsed(tokenId: number): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  
  // Membership methods
  getMembershipByUserId(userId: number): Promise<Membership | undefined>;
  getMembershipById(id: string): Promise<Membership | undefined>;
  getMembershipByStripeSubscriptionId(subscriptionId: string): Promise<Membership | undefined>;
  createMembership(membership: InsertMembership): Promise<Membership>;
  updateMembership(id: string, data: Partial<Membership>): Promise<Membership>;
  deleteMembership(id: string): Promise<void>;
  getAllMembers(): Promise<(User & {membership?: Membership})[]>;
  getMembershipsWithoutSubscription(): Promise<(Membership & { user: User })[]>;
  getManagedMemberships(managedByUserId: number): Promise<(Membership & { user: User })[]>;

  // Analytics search methods
  searchMembersForAnalytics(q: string): Promise<any[]>;
  getMemberVisitStats(userId: number): Promise<any>;

  // Check-in methods
  getCheckInsByUserId(userId: number): Promise<CheckIn[]>;
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  getAllCheckIns(page: number, limit: number): Promise<{data: any[], total: number, page: number, limit: number}>;
  getTodayCheckIns(): Promise<any[]>;
  getUnifiedCheckIns(page: number, pageSize: number, period?: string, search?: string): Promise<{ data: any[]; total: number }>;
  getTodayUnifiedCount(): Promise<{ members: number; guests: number; total: number }>;

  // Payment methods
  getPaymentsByUserId(userId: number): Promise<Payment[]>;
  getPaymentByStripePaymentIntentId(stripePaymentIntentId: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;

  // Stripe customer and payment method management
  updateUserStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User>;
  getUserByCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  getPaymentMethodsByUserId(userId: number): Promise<PaymentMethod[]>;
  createPaymentMethod(paymentMethod: InsertPaymentMethod): Promise<PaymentMethod>;
  deletePaymentMethod(paymentMethodId: string): Promise<void>;
  setDefaultPaymentMethod(userId: number, paymentMethodId: string): Promise<void>;

  // Membership plan methods
  getAllMembershipPlans(): Promise<MembershipPlan[]>;
  createMembershipPlan(plan: InsertMembershipPlan): Promise<MembershipPlan>;
  createOrUpdateMembershipPlan(plan: InsertMembershipPlan): Promise<MembershipPlan>;
  updateMembershipPlan(id: number, plan: Partial<InsertMembershipPlan>): Promise<MembershipPlan>;
  deleteMembershipPlan(id: number): Promise<void>;

  // Punch card template methods
  getAllPunchCardTemplates(): Promise<PunchCardTemplate[]>;
  getPunchCardTemplateById(id: number): Promise<PunchCardTemplate | undefined>;
  createPunchCardTemplate(template: InsertPunchCardTemplate): Promise<PunchCardTemplate>;
  updatePunchCardTemplate(id: number, template: Partial<PunchCardTemplate>): Promise<PunchCardTemplate>;
  deletePunchCardTemplate(id: number): Promise<void>;
  countPunchCardsByTemplateId(templateId: number): Promise<number>;

  // Punch card methods
  getPunchCardsByUserId(userId: number): Promise<PunchCard[]>;
  getPunchCardById(id: number): Promise<PunchCard | undefined>;
  createPunchCard(punchCard: InsertPunchCard): Promise<PunchCard>;
  usePunchCardEntry(id: number): Promise<PunchCard>;
  usePunchCardsForCheckIn(userId: number, quantity: number, checkIn: InsertCheckIn): Promise<{ checkIns: CheckIn[]; cards: PunchCard[] }>;
  addPunchesToCard(id: number, punchesToAdd: number): Promise<PunchCard>;
  getAvailablePunchCardOptions(): Promise<PunchCardTemplate[]>;
  getActiveDayPassHolders(): Promise<(PunchCard & { user?: User })[]>;

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

  // Notification methods
  getAllNotifications(): Promise<Notification[]>;
  getActiveNotifications(): Promise<Notification[]>;
  getNotificationById(id: number): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, data: Partial<Notification>): Promise<Notification>;
  deleteNotification(id: number): Promise<void>;

  // Landing page content methods
  getAllLandingPageContent(): Promise<LandingPageContent[]>;
  getLandingPageContentBySection(section: string): Promise<LandingPageContent[]>;
  updateLandingPageContent(id: number, content: Partial<LandingPageContent>): Promise<LandingPageContent>;
  createLandingPageContent(content: InsertLandingPageContent): Promise<LandingPageContent>;
  deleteLandingPageContent(id: number): Promise<void>;

  // Promotion methods
  getAllPromotions(): Promise<Promotion[]>;
  getActivePromotions(): Promise<Promotion[]>;
  getPromotionById(id: number): Promise<Promotion | undefined>;
  getPromotionByCode(code: string): Promise<Promotion | undefined>;
  createPromotion(promotion: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: number, data: Partial<Promotion>): Promise<Promotion>;
  deletePromotion(id: number): Promise<void>;

  // Gallery image methods
  getAllGalleryImages(): Promise<GalleryImage[]>;
  getActiveGalleryImages(): Promise<GalleryImage[]>;
  getGalleryImageById(id: number): Promise<GalleryImage | undefined>;
  createGalleryImage(image: InsertGalleryImage): Promise<GalleryImage>;
  updateGalleryImage(id: number, data: Partial<GalleryImage>): Promise<GalleryImage>;
  deleteGalleryImage(id: number): Promise<void>;

  // FAQ item methods
  getAllFaqItems(): Promise<FaqItem[]>;
  getActiveFaqItems(): Promise<FaqItem[]>;
  getFaqItemById(id: number): Promise<FaqItem | undefined>;
  createFaqItem(item: InsertFaqItem): Promise<FaqItem>;
  updateFaqItem(id: number, data: Partial<FaqItem>): Promise<FaqItem>;
  deleteFaqItem(id: number): Promise<void>;

  // Inventory item methods
  getAllInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItemById(id: number): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: number, data: Partial<InventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: number): Promise<void>;
  
  // Item checkout methods
  checkoutItem(data: { itemId: number, userId: number, checkedOutByStaffId: number, notes?: string }): Promise<ItemCheckout>;
  checkinItem(checkoutId: number, checkedInByStaffId: number, notes?: string): Promise<ItemCheckout>;
  getActiveCheckouts(): Promise<(ItemCheckout & { item?: InventoryItem, user?: User })[]>;
  getUserCheckouts(userId: number): Promise<(ItemCheckout & { item?: InventoryItem })[]>;
  getItemCheckoutHistory(itemId: number): Promise<(ItemCheckout & { user?: User })[]>;
  getCheckoutById(checkoutId: number): Promise<(ItemCheckout & { item?: InventoryItem, user?: User }) | undefined>;
  updateCheckoutPayment(checkoutId: number, data: { paymentStatus: 'not_charged' | 'charged' | 'failed', stripePaymentIntentId?: string, chargedAmountCents?: number }): Promise<ItemCheckout>;
  
  // Session configuration methods
  getAllSessionConfigs(): Promise<SessionConfig[]>;
  getSessionConfigByType(sessionType: 'morning' | 'evening'): Promise<SessionConfig | undefined>;
  updateSessionConfig(sessionType: 'morning' | 'evening', data: Partial<SessionConfig>): Promise<SessionConfig>;
  
  // Session booking methods
  createSessionBooking(booking: InsertSessionBooking): Promise<SessionBooking>;
  getSessionBookingsByUserId(userId: number): Promise<SessionBooking[]>;
  getSessionBookingsForDate(date: string, sessionType?: 'morning' | 'evening'): Promise<SessionBooking[]>;
  getAllSessionBookingsWithUsers(fromDate?: string): Promise<(SessionBooking & { user?: User })[]>;
  cancelSessionBooking(bookingId: number): Promise<SessionBooking>;
  getSessionBookingById(bookingId: number): Promise<SessionBooking | undefined>;
  getSessionAvailability(date: string, sessionType: 'morning' | 'evening'): Promise<{ booked: number, capacity: number }>;
  hasUserBookedSession(userId: number, date: string, sessionType: 'morning' | 'evening'): Promise<boolean>;
  markSessionBookingCheckedIn(userId: number, date: string, sessionType: 'morning' | 'evening'): Promise<void>;
  
  // Day pass hours methods
  getDayPassHours(): Promise<DayPassHours | undefined>;
  updateDayPassHours(data: Partial<DayPassHours>): Promise<DayPassHours>;
  
  // Guest waiver methods
  createGuestWaiver(waiver: InsertGuestWaiver): Promise<GuestWaiver>;
  getAllGuestWaivers(): Promise<GuestWaiver[]>;
  getGuestWaiverById(id: number): Promise<GuestWaiver | undefined>;
  getGuestWaiversByEmail(email: string): Promise<GuestWaiver[]>;
  getGuestWaiversByUserId(userId: number): Promise<GuestWaiver[]>;
  getTodayGuestWaivers(): Promise<GuestWaiver[]>;
  getGuestWaiverAnalytics(): Promise<{ total: number; today: number; thisWeek: number; thisMonth: number }>;
  getPaginatedGuestWaivers(page: number, pageSize: number, period?: string, search?: string): Promise<{ data: GuestWaiver[]; total: number }>;
  upsertGuestUser(data: { firstName: string; lastName: string; email: string; phoneNumber?: string | null }): Promise<User>;
  updateGuestWaiverUserId(waiverId: number, userId: number): Promise<void>;
  getAllGuests(): Promise<(User & { visitCount: number })[]>;
  getGuestWaiversByUserId(userId: number): Promise<GuestWaiver[]>;
  
  // Waiver question methods
  getActiveWaiverQuestions(): Promise<WaiverQuestion[]>;
  getAllWaiverQuestions(): Promise<WaiverQuestion[]>;
  createWaiverQuestion(q: InsertWaiverQuestion): Promise<WaiverQuestion>;
  updateWaiverQuestion(id: number, data: Partial<InsertWaiverQuestion>): Promise<WaiverQuestion>;
  deleteWaiverQuestion(id: number): Promise<void>;
  createGuestWaiverAnswers(answers: { guestWaiverId: number; questionId: number; answer: boolean }[]): Promise<void>;
  getGuestWaiverAnswers(guestWaiverId: number): Promise<(GuestWaiverAnswer & { question: WaiverQuestion })[]>;

  // Site settings methods
  getSiteSetting(key: string): Promise<SiteSetting | undefined>;
  getAllSiteSettings(): Promise<SiteSetting[]>;
  upsertSiteSetting(key: string, value: string, description?: string): Promise<SiteSetting>;
  
  // Gift card methods
  createGiftCard(data: InsertGiftCard): Promise<GiftCard>;
  getGiftCardByCode(code: string): Promise<GiftCard | undefined>;
  getGiftCardById(id: number): Promise<GiftCard | undefined>;
  getAllGiftCards(page?: number, pageSize?: number, status?: string, search?: string): Promise<{ data: GiftCard[]; total: number }>;
  updateGiftCard(id: number, data: Partial<GiftCard>): Promise<GiftCard>;
  redeemGiftCard(id: number, userId: number, amount: number, description: string): Promise<GiftCard>;

  // Gift card denomination methods
  getAllDenominations(): Promise<GiftCardDenomination[]>;
  getActiveDenominations(): Promise<GiftCardDenomination[]>;
  createDenomination(data: InsertGiftCardDenomination): Promise<GiftCardDenomination>;
  updateDenomination(id: number, data: Partial<GiftCardDenomination>): Promise<GiftCardDenomination>;
  deleteDenomination(id: number): Promise<void>;

  // Gift card redemption methods
  getRedemptionsByGiftCardId(giftCardId: number): Promise<GiftCardRedemption[]>;

  // Waitlist methods
  createWaitlistEntry(data: InsertWaitlist): Promise<Waitlist>;
  getWaitlistEntries(date: string): Promise<Waitlist[]>;
  getWaitlistEntryById(id: number): Promise<Waitlist | undefined>;
  updateWaitlistEntry(id: number, data: Partial<InsertWaitlist>): Promise<Waitlist>;
  deleteWaitlistEntry(id: number): Promise<void>;

  // Special events methods
  createEvent(data: InsertEvent): Promise<Event>;
  getEvents(includeInactive?: boolean): Promise<Event[]>;
  getEventById(id: number): Promise<Event | undefined>;
  updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: number): Promise<void>;

  // Event bookings methods
  createEventBooking(data: InsertEventBooking): Promise<EventBooking>;
  getEventBookingsByUserId(userId: number): Promise<(EventBooking & { event: Event })[]>;
  getEventBookingsByEventId(eventId: number): Promise<EventBooking[]>;
  getEventBookingsByEventIdWithUsers(eventId: number): Promise<(EventBooking & { user: { id: number; firstName: string | null; lastName: string | null; email: string } })[]>;
  getEventBookingByUserAndEvent(userId: number, eventId: number): Promise<EventBooking | undefined>;
  cancelEventBooking(id: number): Promise<EventBooking>;
  getEventBookingById(id: number): Promise<EventBooking | undefined>;

  // Checklist methods
  getChecklistItems(type?: string): Promise<ChecklistItem[]>;
  createChecklistItem(item: InsertChecklistItem): Promise<ChecklistItem>;
  updateChecklistItem(id: number, item: Partial<InsertChecklistItem>): Promise<ChecklistItem>;
  deleteChecklistItem(id: number): Promise<void>;
  getChecklistRuns(type: string, date: string): Promise<ChecklistRun[]>;
  createChecklistRun(run: InsertChecklistRun): Promise<ChecklistRun>;
  updateChecklistRun(id: number, data: Partial<ChecklistRun>): Promise<ChecklistRun>;
  deleteChecklistRun(id: number): Promise<void>;
  getChecklistRunItems(runId: number): Promise<ChecklistRunItem[]>;
  checkChecklistItem(runId: number, itemId: number, userId?: number): Promise<ChecklistRunItem>;
  uncheckChecklistItem(runId: number, itemId: number): Promise<void>;
  getTodayChecklistSummary(today: string): Promise<{
    opening: { total: number; completed: number; hasRun: boolean; isComplete: boolean };
    closing: { total: number; completed: number; hasRun: boolean; isComplete: boolean };
    hourly: { total: number; completed: number; hasRun: boolean; isComplete: boolean };
  }>;

  // Newsletter methods
  getAllNewsletters(): Promise<Newsletter[]>;
  getNewsletterById(id: number): Promise<Newsletter | undefined>;
  createNewsletter(data: InsertNewsletter & { createdByUserId?: number }): Promise<Newsletter>;
  updateNewsletter(id: number, data: Partial<Newsletter>): Promise<Newsletter>;
  deleteNewsletter(id: number): Promise<void>;
  markNewsletterSent(id: number, sentCount: number): Promise<Newsletter>;
  getNewsletterRecipients(filter: 'all' | 'active_members' | 'day_pass_holders'): Promise<{ email: string; firstName: string }[]>;

  // SMS Broadcast methods
  getOptedInSmsRecipients(): Promise<{ id: number; phoneNumber: string; firstName: string; lastName: string }[]>;
  createSmsBroadcast(data: InsertSmsBroadcast): Promise<SmsBroadcast>;
  updateSmsBroadcast(id: number, data: Partial<SmsBroadcast>): Promise<SmsBroadcast>;
  getAllSmsBroadcasts(): Promise<SmsBroadcast[]>;

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
    
    // Only initialize basic templates - admin manages all packages
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
    // Check if templates already exist to prevent duplicates
    const existing = await db.select().from(punchCardTemplates).limit(1);
    if (existing.length > 0) return;

    // Initialize default punch card templates only if none exist
    const defaultTemplates = [
      { name: "5-Day Pass", totalPunches: 5, totalPrice: 13500, pricePerPunch: 2700, description: "Perfect for trying out our facilities", sortOrder: 1 },
      { name: "10-Day Pass", totalPunches: 10, totalPrice: 24000, pricePerPunch: 2400, description: "Great value for regular visitors", sortOrder: 2 },
      { name: "20-Day Pass", totalPunches: 20, totalPrice: 42000, pricePerPunch: 2100, description: "Best value for committed wellness enthusiasts", sortOrder: 3 },
    ];

    try {
      await db.insert(punchCardTemplates).values(defaultTemplates);
    } catch (error) {
      // Templates might already exist, continue silently
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Case-insensitive email lookup for better user experience
    const [user] = await db.select().from(users).where(ilike(users.email, email));
    return user || undefined;
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createStaffAdmin(data: { email: string; password: string; firstName: string; lastName: string; role: 'staff' | 'admin'; phoneNumber?: string; mustChangePassword?: boolean }): Promise<User> {
    let username = data.email.split('@')[0];
    let usernameExists = await this.getUserByUsername(username);
    let suffix = 1;
    
    while (usernameExists) {
      username = `${data.email.split('@')[0]}_${suffix}`;
      usernameExists = await this.getUserByUsername(username);
      suffix++;
    }
    
    const [user] = await db
      .insert(users)
      .values({
        username,
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        phoneNumber: data.phoneNumber,
        membershipAgreementCompleted: true,
        membershipAgreementDate: new Date(),
        mustChangePassword: data.mustChangePassword ?? true,
      })
      .returning();
    return user;
  }

  async updateStaffAdmin(userId: number, data: Partial<{ email: string; password: string; firstName: string; lastName: string; role: 'staff' | 'admin'; phoneNumber: string; mustChangePassword: boolean }>): Promise<User> {
    const updateData: any = {};
    if (data.email !== undefined) updateData.email = data.email;
    if (data.password !== undefined) {
      updateData.password = data.password;
      updateData.passwordSetAt = new Date();
    }
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (data.mustChangePassword !== undefined) updateData.mustChangePassword = data.mustChangePassword;

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deleteStaffAdmin(userId: number): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async listStaffAdmins(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(inArray(users.role, ['staff', 'admin']));
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
    // Return only the most recent unused, non-expired token matching this code.
    // Without ordering + filtering, multiple reset requests for the same user could
    // cause an old used token to be returned, producing a false "already used" error.
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .orderBy(desc(passwordResetTokens.id))
      .limit(1);
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
    // Return the most recent active membership first, then any other by newest creation
    const results = await db.select().from(memberships)
      .where(eq(memberships.userId, userId))
      .orderBy(
        sql`CASE WHEN ${memberships.status} = 'active' THEN 0 ELSE 1 END`,
        desc(memberships.createdAt)
      );
    return results[0] || undefined;
  }

  async getMembershipById(id: string): Promise<Membership | undefined> {
    const [membership] = await db.select().from(memberships).where(eq(memberships.membershipId, id));
    return membership || undefined;
  }

  async getMembershipByStripeSubscriptionId(subscriptionId: string): Promise<Membership | undefined> {
    const [membership] = await db.select().from(memberships)
      .where(eq(memberships.stripeSubscriptionId, subscriptionId));
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

  async deleteMembership(id: string): Promise<void> {
    await db.delete(memberships).where(eq(memberships.membershipId, id));
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

  async getMembershipsWithoutSubscription(): Promise<(Membership & { user: User })[]> {
    // Get all active memberships that don't have a Stripe subscription
    const membershipsWithoutSub = await db.select()
      .from(memberships)
      .where(
        and(
          eq(memberships.status, 'active'),
          or(
            isNull(memberships.stripeSubscriptionId),
            eq(memberships.stripeSubscriptionId, '')
          )
        )
      );
    
    const result: (Membership & { user: User })[] = [];
    
    for (const membership of membershipsWithoutSub) {
      const user = await this.getUser(membership.userId);
      if (user) {
        result.push({ ...membership, user });
      }
    }
    
    return result;
  }

  async getManagedMemberships(managedByUserId: number): Promise<(Membership & { user: User })[]> {
    // Get all memberships managed by a specific user (family/gift memberships)
    const managedMemberships = await db.select()
      .from(memberships)
      .where(eq(memberships.managedByUserId, managedByUserId));
    
    const result: (Membership & { user: User })[] = [];
    
    for (const membership of managedMemberships) {
      const user = await this.getUser(membership.userId);
      if (user) {
        result.push({ ...membership, user });
      }
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

  async getAllCheckIns(page: number, limit: number): Promise<{data: any[], total: number, page: number, limit: number}> {
    const allCheckIns = await db.select({
      id: checkIns.id,
      userId: checkIns.userId,
      membershipId: checkIns.membershipId,
      timestamp: checkIns.timestamp,
      location: checkIns.location,
      method: sql<string>`CASE WHEN ${checkIns.location} LIKE '%Manual%' OR ${checkIns.location} LIKE '%Front Desk%' THEN 'manual' ELSE 'qr' END`,
      user: {
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        email: users.email
      }
    })
    .from(checkIns)
    .leftJoin(users, eq(checkIns.userId, users.id))
    .orderBy(desc(checkIns.timestamp));
    
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
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        email: users.email
      }
    })
    .from(checkIns)
    .leftJoin(users, eq(checkIns.userId, users.id))
    .where(gte(checkIns.timestamp, today))
    .orderBy(desc(checkIns.timestamp));
  }

  async getUnifiedCheckIns(page: number, pageSize: number, period?: string, search?: string): Promise<{ data: any[]; total: number }> {
    let startDate: Date | null = null;
    if (period && period !== 'all') {
      const now = new Date();
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
    }
    const searchLike = search && search.trim() ? `%${search.trim().toLowerCase()}%` : null;
    const offset = (page - 1) * pageSize;

    // Build date and search filter fragments conditionally to avoid null parameter casting issues
    const dateFilter = startDate
      ? sql`AND ts >= ${startDate}::timestamptz`
      : sql``;
    const searchFilter = searchLike
      ? sql`AND (LOWER(first_name) LIKE ${searchLike} OR LOWER(last_name) LIKE ${searchLike} OR LOWER(email) LIKE ${searchLike})`
      : sql``;

    const countQuery = sql`
      WITH combined AS (
        SELECT ci.timestamp AS ts,
               COALESCE(u.first_name, '') AS first_name,
               COALESCE(u.last_name, '') AS last_name,
               COALESCE(u.email, '') AS email
        FROM check_ins ci
        LEFT JOIN users u ON ci.user_id = u.id
        UNION ALL
        SELECT gw.check_in_timestamp AS ts,
               gw.first_name,
               gw.last_name,
               gw.email
        FROM guest_waivers gw
      )
      SELECT COUNT(*)::int AS total FROM combined
      WHERE 1=1 ${dateFilter} ${searchFilter}
    `;

    const dataQuery = sql`
      WITH combined AS (
        SELECT
          ci.id,
          'member'::text AS entry_type,
          ci.timestamp AS ts,
          COALESCE(u.first_name, '') AS first_name,
          COALESCE(u.last_name, '') AS last_name,
          COALESCE(u.email, '') AS email,
          NULL::text AS phone_number,
          ci.membership_id,
          CASE WHEN ci.location ILIKE '%Manual%' OR ci.location ILIKE '%Front Desk%' THEN 'manual' ELSE 'qr' END AS method
        FROM check_ins ci
        LEFT JOIN users u ON ci.user_id = u.id
        UNION ALL
        SELECT
          gw.id,
          'guest'::text AS entry_type,
          gw.check_in_timestamp AS ts,
          gw.first_name,
          gw.last_name,
          gw.email,
          gw.phone_number,
          NULL::text AS membership_id,
          'guest'::text AS method
        FROM guest_waivers gw
      )
      SELECT * FROM combined
      WHERE 1=1 ${dateFilter} ${searchFilter}
      ORDER BY ts DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const [countResult, dataResult] = await Promise.all([
      db.execute(countQuery),
      db.execute(dataQuery),
    ]);

    const total = (countResult.rows[0] as any)?.total ?? 0;
    return { data: dataResult.rows as any[], total: Number(total) };
  }

  async getTodayUnifiedCount(): Promise<{ members: number; guests: number; total: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await db.execute(sql`
      SELECT
        SUM(CASE WHEN entry_type = 'member' THEN 1 ELSE 0 END)::int AS members,
        SUM(CASE WHEN entry_type = 'guest' THEN 1 ELSE 0 END)::int AS guests,
        COUNT(*)::int AS total
      FROM (
        SELECT 'member' AS entry_type FROM check_ins WHERE timestamp >= ${today}::timestamptz
        UNION ALL
        SELECT 'guest' AS entry_type FROM guest_waivers WHERE check_in_timestamp >= ${today}::timestamptz
      ) combined
    `);

    const row = result.rows[0] as any;
    return {
      members: Number(row?.members ?? 0),
      guests: Number(row?.guests ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  async getPaymentsByUserId(userId: number): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.transactionDate));
  }

  async getPaymentByStripePaymentIntentId(stripePaymentIntentId: string): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, stripePaymentIntentId))
      .limit(1);
    return payment || undefined;
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

  async getUserByCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, stripeCustomerId));
    return user || undefined;
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

  async createMembershipPlan(insertPlan: InsertMembershipPlan): Promise<MembershipPlan> {
    const [plan] = await db
      .insert(membershipPlans)
      .values(insertPlan)
      .returning();
    return plan;
  }

  async createOrUpdateMembershipPlan(insertPlan: InsertMembershipPlan): Promise<MembershipPlan> {
    // Since we removed the unique constraint on planType, this method now just creates new plans
    const [plan] = await db
      .insert(membershipPlans)
      .values(insertPlan)
      .returning();
    return plan;
  }

  async updateMembershipPlan(id: number, planData: Partial<InsertMembershipPlan>): Promise<MembershipPlan> {
    const [plan] = await db
      .update(membershipPlans)
      .set(planData)
      .where(eq(membershipPlans.id, id))
      .returning();
    return plan;
  }

  async deleteMembershipPlan(id: number): Promise<void> {
    await db.delete(membershipPlans).where(eq(membershipPlans.id, id));
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

  async usePunchCardsForCheckIn(
    userId: number,
    quantity: number,
    checkIn: InsertCheckIn,
  ): Promise<{ checkIns: CheckIn[]; cards: PunchCard[] }> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error("Day pass quantity must be a positive whole number");
    }

    return await db.transaction(async (tx) => {
      const now = new Date();
      const eligibleCards = await tx
        .select()
        .from(punchCards)
        .where(and(
          eq(punchCards.userId, userId),
          eq(punchCards.status, "active"),
          gt(punchCards.remainingPunches, 0),
          or(isNull(punchCards.expiresAt), gt(punchCards.expiresAt, now)),
        ))
        .orderBy(punchCards.purchasedAt, punchCards.id)
        .for("update");

      const available = eligibleCards.reduce((sum, card) => sum + card.remainingPunches, 0);
      if (available < quantity) {
        const error = new Error(`Only ${available} day pass${available === 1 ? "" : "es"} available`);
        (error as any).code = "INSUFFICIENT_DAY_PASSES";
        throw error;
      }

      let remainingToUse = quantity;
      const updatedCards: PunchCard[] = [];
      for (const card of eligibleCards) {
        if (remainingToUse === 0) break;

        const usedFromCard = Math.min(remainingToUse, card.remainingPunches);
        const newRemaining = card.remainingPunches - usedFromCard;
        const [updatedCard] = await tx
          .update(punchCards)
          .set({
            remainingPunches: newRemaining,
            status: newRemaining === 0 ? "exhausted" : card.status,
          })
          .where(and(
            eq(punchCards.id, card.id),
            eq(punchCards.status, "active"),
            gt(punchCards.remainingPunches, 0),
          ))
          .returning();

        if (!updatedCard) {
          const error = new Error("Day pass balance changed. Please try again.");
          (error as any).code = "DAY_PASS_BALANCE_CHANGED";
          throw error;
        }

        updatedCards.push(updatedCard);
        remainingToUse -= usedFromCard;
      }

      const createdCheckIns = await tx
        .insert(checkIns)
        .values(Array.from({ length: quantity }, () => ({ ...checkIn, userId })))
        .returning();

      return { checkIns: createdCheckIns, cards: updatedCards };
    });
  }

  async addPunchesToCard(id: number, punchesToAdd: number): Promise<PunchCard> {
    const card = await this.getPunchCardById(id);
    if (!card) {
      throw new Error("Punch card not found");
    }

    const newRemaining = card.remainingPunches + punchesToAdd;
    const newTotal = card.totalPunches + punchesToAdd;
    
    // Reactivate if it was exhausted
    const newStatus = card.status === 'exhausted' ? 'active' : card.status;

    const [updatedCard] = await db
      .update(punchCards)
      .set({ 
        remainingPunches: newRemaining,
        totalPunches: newTotal,
        status: newStatus
      })
      .where(eq(punchCards.id, id))
      .returning();

    return updatedCard;
  }

  async getActiveDayPassHolders(): Promise<(PunchCard & { user?: User })[]> {
    const activePunchCards = await db
      .select()
      .from(punchCards)
      .where(
        and(
          eq(punchCards.status, 'active'),
          sql`${punchCards.remainingPunches} > 0`
        )
      )
      .orderBy(desc(punchCards.purchasedAt));
    
    const enrichedCards = await Promise.all(
      activePunchCards.map(async (card) => {
        const user = await this.getUserById(card.userId);
        return { ...card, user: user || undefined };
      })
    );
    
    return enrichedCards;
  }

  async getAllPunchCardTemplates(): Promise<PunchCardTemplate[]> {
    return await db.select().from(punchCardTemplates).orderBy(punchCardTemplates.sortOrder, punchCardTemplates.totalPunches);
  }

  async getPunchCardTemplateById(id: number): Promise<PunchCardTemplate | undefined> {
    const [template] = await db.select().from(punchCardTemplates).where(eq(punchCardTemplates.id, id));
    return template || undefined;
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

  async countPunchCardsByTemplateId(templateId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(punchCards)
      .where(and(eq(punchCards.templateId, templateId), sql`${punchCards.status} != 'expired'`));
    return Number(result[0]?.count ?? 0);
  }

  async getAvailablePunchCardOptions(): Promise<PunchCardTemplate[]> {
    const templates = await db.select().from(punchCardTemplates)
      .where(eq(punchCardTemplates.isActive, true))
      .orderBy(punchCardTemplates.sortOrder, punchCardTemplates.totalPunches);
    
    return templates;
  }

  async searchMembersForAnalytics(q: string): Promise<any[]> {
    const term = q.trim();
    if (!term) return [];

    const numId = parseInt(term);
    const isNumeric = !isNaN(numId);

    const conditions = [
      ilike(users.firstName, `%${term}%`),
      ilike(users.lastName, `%${term}%`),
      ilike(users.email, `%${term}%`),
    ];
    if (isNumeric) {
      conditions.push(eq(users.id, numId) as any);
    }

    const results = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(or(...conditions))
      .orderBy(users.firstName, users.lastName)
      .limit(10);

    const withStatus = await Promise.all(
      results.map(async (u) => {
        const m = await this.getMembershipByUserId(u.id);
        return { ...u, membershipStatus: m?.status ?? null };
      })
    );

    return withStatus;
  }

  async getMemberVisitStats(userId: number): Promise<any> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const allCheckIns = await db
      .select()
      .from(checkIns)
      .where(eq(checkIns.userId, userId))
      .orderBy(desc(checkIns.timestamp));

    const totalVisits = allCheckIns.length;
    const lastVisit = allCheckIns[0]?.timestamp ?? null;

    const thisMonthVisits = allCheckIns.filter(
      (c) => c.timestamp && c.timestamp >= startOfMonth
    ).length;
    const thisYearVisits = allCheckIns.filter(
      (c) => c.timestamp && c.timestamp >= startOfYear
    ).length;

    // Average monthly visits since first check-in
    let avgMonthlyVisits = 0;
    if (allCheckIns.length > 0) {
      const firstVisit = allCheckIns[allCheckIns.length - 1].timestamp!;
      const monthsActive = Math.max(
        1,
        (now.getFullYear() - firstVisit.getFullYear()) * 12 +
          (now.getMonth() - firstVisit.getMonth()) +
          1
      );
      avgMonthlyVisits = Math.round((totalVisits / monthsActive) * 10) / 10;
    }

    // Last 6 months breakdown
    const monthlyBreakdown: { month: string; visits: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = start.toLocaleString('en-US', { month: 'short' }) +
        " '" + String(start.getFullYear()).slice(2);
      const visits = allCheckIns.filter(
        (c) => c.timestamp && c.timestamp >= start && c.timestamp < end
      ).length;
      monthlyBreakdown.push({ month: label, visits });
    }

    return {
      totalVisits,
      thisMonthVisits,
      thisYearVisits,
      lastVisit: lastVisit?.toISOString() ?? null,
      avgMonthlyVisits,
      monthlyBreakdown,
    };
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
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const checkInResults = await db
      .select()
      .from(checkIns)
      .where(gte(checkIns.timestamp, startDate));

    const dateMap: Record<string, number> = {};
    checkInResults.forEach(checkIn => {
      if (checkIn.timestamp) {
        const d = new Date(checkIn.timestamp);
        const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dateMap[isoDate] = (dateMap[isoDate] || 0) + 1;
      }
    });

    const visitsByDate = Object.entries(dateMap)
      .map(([date, visits]) => ({ date, visits }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const dayCount = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));

    return {
      totalVisits: checkInResults.length,
      averageDaily: Math.round(checkInResults.length / dayCount),
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

    // Membership counts by status
    const [activeMemberships, frozenMemberships, expiredMemberships, inactiveMemberships] = await Promise.all([
      db.select({ id: memberships.id }).from(memberships).where(eq(memberships.status, 'active')),
      db.select({ id: memberships.id }).from(memberships).where(eq(memberships.status, 'frozen')),
      db.select({ id: memberships.id }).from(memberships).where(eq(memberships.status, 'expired')),
      db.select({ id: memberships.id }).from(memberships).where(eq(memberships.status, 'inactive')),
    ]);

    // New members this month
    const newMembersThisMonth = await db
      .select()
      .from(users)
      .where(gte(users.createdAt, thisMonth));

    return {
      todayVisits: todayCheckIns.length,
      monthlyVisits: thisMonthCheckIns.length,
      activeMembers: activeMemberships.length,
      frozenMembers: frozenMemberships.length,
      expiredMembers: expiredMemberships.length,
      inactiveMembers: inactiveMemberships.length,
      totalMemberships: activeMemberships.length + frozenMemberships.length + expiredMemberships.length + inactiveMemberships.length,
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

  // Notification methods implementation
  async getAllNotifications(): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt));
  }

  async getActiveNotifications(): Promise<Notification[]> {
    const now = new Date();
    return await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.isActive, true),
          lte(notifications.startDate, now),
          sql`(${notifications.endDate} IS NULL OR ${notifications.endDate} >= ${now})`
        )
      )
      .orderBy(desc(notifications.createdAt));
  }

  async getNotificationById(id: number): Promise<Notification | undefined> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    return notification;
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(insertNotification)
      .returning();
    return notification;
  }

  async updateNotification(id: number, data: Partial<Notification>): Promise<Notification> {
    const [notification] = await db
      .update(notifications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  async deleteNotification(id: number): Promise<void> {
    await db
      .delete(notifications)
      .where(eq(notifications.id, id));
  }

  async updateUser(userId: number, data: Partial<User>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async deleteUser(userId: number): Promise<void> {
    // Delete related data first due to foreign key constraints
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await db.delete(memberships).where(eq(memberships.userId, userId));
    await db.delete(checkIns).where(eq(checkIns.userId, userId));
    await db.delete(payments).where(eq(payments.userId, userId));
    await db.delete(punchCards).where(eq(punchCards.userId, userId));
    await db.delete(memberPreferences).where(eq(memberPreferences.userId, userId));
    await db.delete(therapySessions).where(eq(therapySessions.userId, userId));
    await db.delete(healthMetrics).where(eq(healthMetrics.userId, userId));
    await db.delete(stravaIntegrations).where(eq(stravaIntegrations.userId, userId));
    
    // Delete item checkouts where the user is the member OR the staff who processed them
    await db.delete(itemCheckouts).where(or(
      eq(itemCheckouts.userId, userId),
      eq(itemCheckouts.checkedOutByStaffId, userId),
      eq(itemCheckouts.checkedInByStaffId, userId)
    ));
    
    // Finally delete the user
    await db.delete(users).where(eq(users.id, userId));
  }

  async archiveUser(userId: number): Promise<User> {
    const [archived] = await db
      .update(users)
      .set({ 
        isArchived: true, 
        archivedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return archived;
  }

  async unarchiveUser(userId: number): Promise<User> {
    const [restored] = await db
      .update(users)
      .set({ 
        isArchived: false, 
        archivedAt: null 
      })
      .where(eq(users.id, userId))
      .returning();
    return restored;
  }

  // Landing page content methods
  async getAllLandingPageContent(): Promise<LandingPageContent[]> {
    return await db.select().from(landingPageContent).orderBy(landingPageContent.section, landingPageContent.key);
  }

  async getLandingPageContentBySection(section: string): Promise<LandingPageContent[]> {
    return await db.select().from(landingPageContent).where(eq(landingPageContent.section, section));
  }

  async updateLandingPageContent(id: number, content: Partial<LandingPageContent>): Promise<LandingPageContent> {
    const [updated] = await db
      .update(landingPageContent)
      .set(content)
      .where(eq(landingPageContent.id, id))
      .returning();
    return updated;
  }

  async createLandingPageContent(content: InsertLandingPageContent): Promise<LandingPageContent> {
    const [created] = await db
      .insert(landingPageContent)
      .values(content)
      .returning();
    return created;
  }

  async deleteLandingPageContent(id: number): Promise<void> {
    await db.delete(landingPageContent).where(eq(landingPageContent.id, id));
  }

  // Promotion methods
  async getAllPromotions(): Promise<Promotion[]> {
    return await db.select().from(promotions).orderBy(promotions.sortOrder, promotions.createdAt);
  }

  async getActivePromotions(): Promise<Promotion[]> {
    return await db.select().from(promotions)
      .where(eq(promotions.isActive, true))
      .orderBy(promotions.sortOrder, promotions.createdAt);
  }

  async getPromotionById(id: number): Promise<Promotion | undefined> {
    const [promotion] = await db.select().from(promotions).where(eq(promotions.id, id));
    return promotion || undefined;
  }

  async getPromotionByCode(code: string): Promise<Promotion | undefined> {
    const [promotion] = await db.select().from(promotions).where(eq(promotions.code, code));
    return promotion || undefined;
  }

  async createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    const [created] = await db
      .insert(promotions)
      .values(promotion)
      .returning();
    return created;
  }

  async updatePromotion(id: number, data: Partial<Promotion>): Promise<Promotion> {
    const [updated] = await db
      .update(promotions)
      .set(data)
      .where(eq(promotions.id, id))
      .returning();
    return updated;
  }

  async deletePromotion(id: number): Promise<void> {
    await db.delete(promotions).where(eq(promotions.id, id));
  }

  // Gallery image methods
  async getAllGalleryImages(): Promise<GalleryImage[]> {
    return await db.select().from(galleryImages).orderBy(galleryImages.sortOrder, galleryImages.createdAt);
  }

  async getActiveGalleryImages(): Promise<GalleryImage[]> {
    return await db.select().from(galleryImages)
      .where(eq(galleryImages.isActive, true))
      .orderBy(galleryImages.sortOrder, galleryImages.createdAt);
  }

  async getGalleryImageById(id: number): Promise<GalleryImage | undefined> {
    const [image] = await db.select().from(galleryImages).where(eq(galleryImages.id, id));
    return image || undefined;
  }

  async createGalleryImage(image: InsertGalleryImage): Promise<GalleryImage> {
    const [created] = await db
      .insert(galleryImages)
      .values(image)
      .returning();
    return created;
  }

  async updateGalleryImage(id: number, data: Partial<GalleryImage>): Promise<GalleryImage> {
    const [updated] = await db
      .update(galleryImages)
      .set(data)
      .where(eq(galleryImages.id, id))
      .returning();
    return updated;
  }

  async deleteGalleryImage(id: number): Promise<void> {
    await db.delete(galleryImages).where(eq(galleryImages.id, id));
  }

  // FAQ item methods
  async getAllFaqItems(): Promise<FaqItem[]> {
    return await db
      .select()
      .from(faqItems)
      .orderBy(faqItems.sortOrder, faqItems.createdAt);
  }

  async getActiveFaqItems(): Promise<FaqItem[]> {
    return await db
      .select()
      .from(faqItems)
      .where(eq(faqItems.isActive, true))
      .orderBy(faqItems.sortOrder, faqItems.createdAt);
  }

  async getFaqItemById(id: number): Promise<FaqItem | undefined> {
    const [item] = await db.select().from(faqItems).where(eq(faqItems.id, id));
    return item || undefined;
  }

  async createFaqItem(item: InsertFaqItem): Promise<FaqItem> {
    const [created] = await db
      .insert(faqItems)
      .values(item)
      .returning();
    return created;
  }

  async updateFaqItem(id: number, data: Partial<FaqItem>): Promise<FaqItem> {
    const [updated] = await db
      .update(faqItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(faqItems.id, id))
      .returning();
    return updated;
  }

  async deleteFaqItem(id: number): Promise<void> {
    await db.delete(faqItems).where(eq(faqItems.id, id));
  }

  // Inventory item methods
  async getAllInventoryItems(): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems).orderBy(inventoryItems.type, inventoryItems.name);
  }

  async getInventoryItemById(id: number): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item || undefined;
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const [created] = await db
      .insert(inventoryItems)
      .values(item)
      .returning();
    return created;
  }

  async updateInventoryItem(id: number, data: Partial<InventoryItem>): Promise<InventoryItem> {
    const [updated] = await db
      .update(inventoryItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id))
      .returning();
    return updated;
  }

  async deleteInventoryItem(id: number): Promise<void> {
    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  }

  // Item checkout methods
  async checkoutItem(data: { itemId: number, userId: number, checkedOutByStaffId: number, notes?: string }): Promise<ItemCheckout> {
    // Use transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Get item with lock
      const [item] = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, data.itemId))
        .for('update');

      if (!item) {
        throw new Error("Item not found");
      }

      if (!item.isActive) {
        throw new Error("Item is not active");
      }

      if (item.quantityAvailable <= 0) {
        throw new Error("Item not available for checkout - no items in stock");
      }

      // Decrease available quantity
      const newQuantity = item.quantityAvailable - 1;
      if (newQuantity < 0) {
        throw new Error("Invalid quantity - cannot go below zero");
      }

      await tx
        .update(inventoryItems)
        .set({ 
          quantityAvailable: newQuantity,
          updatedAt: new Date()
        })
        .where(eq(inventoryItems.id, data.itemId));

      // Create checkout record
      const [checkout] = await tx
        .insert(itemCheckouts)
        .values({
          itemId: data.itemId,
          userId: data.userId,
          checkedOutByStaffId: data.checkedOutByStaffId,
          notes: data.notes,
          status: 'checked_out'
        })
        .returning();

      return checkout;
    });
  }

  async checkinItem(checkoutId: number, checkedInByStaffId: number, notes?: string): Promise<ItemCheckout> {
    // Use transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Get checkout with lock
      const [checkout] = await tx
        .select()
        .from(itemCheckouts)
        .where(eq(itemCheckouts.id, checkoutId))
        .for('update');

      if (!checkout) {
        throw new Error("Checkout not found");
      }

      if (checkout.status !== 'checked_out') {
        throw new Error("Item already returned or not checked out");
      }

      // Get item with lock
      const [item] = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, checkout.itemId))
        .for('update');

      if (!item) {
        throw new Error("Item not found");
      }

      // Increase available quantity (cap at total to handle data inconsistencies)
      const newQuantity = Math.min(item.quantityAvailable + 1, item.quantityTotal);
      if (item.quantityAvailable + 1 > item.quantityTotal) {
        console.warn(`[Inventory] Item ${item.id} (${item.name}): quantity inconsistency detected. Available (${item.quantityAvailable}) already at or exceeding total (${item.quantityTotal}). Capping at total.`);
      }

      await tx
        .update(inventoryItems)
        .set({ 
          quantityAvailable: newQuantity,
          updatedAt: new Date()
        })
        .where(eq(inventoryItems.id, checkout.itemId));

      // Update checkout record
      const [updated] = await tx
        .update(itemCheckouts)
        .set({
          status: 'returned',
          checkedInAt: new Date(),
          checkedInByStaffId,
          notes: notes || checkout.notes
        })
        .where(eq(itemCheckouts.id, checkoutId))
        .returning();

      return updated;
    });
  }

  async getActiveCheckouts(): Promise<(ItemCheckout & { item?: InventoryItem, user?: User })[]> {
    const checkouts = await db
      .select()
      .from(itemCheckouts)
      .where(eq(itemCheckouts.status, 'checked_out'))
      .orderBy(desc(itemCheckouts.checkedOutAt));

    // Fetch related items and users
    const enrichedCheckouts = await Promise.all(
      checkouts.map(async (checkout) => {
        const item = await this.getInventoryItemById(checkout.itemId);
        const user = await this.getUserById(checkout.userId);
        return { ...checkout, item, user };
      })
    );

    return enrichedCheckouts;
  }

  async getUserCheckouts(userId: number): Promise<(ItemCheckout & { item?: InventoryItem })[]> {
    const checkouts = await db
      .select()
      .from(itemCheckouts)
      .where(and(
        eq(itemCheckouts.userId, userId),
        eq(itemCheckouts.status, 'checked_out')
      ))
      .orderBy(desc(itemCheckouts.checkedOutAt));

    // Fetch related items
    const enrichedCheckouts = await Promise.all(
      checkouts.map(async (checkout) => {
        const item = await this.getInventoryItemById(checkout.itemId);
        return { ...checkout, item };
      })
    );

    return enrichedCheckouts;
  }

  async getItemCheckoutHistory(itemId: number): Promise<(ItemCheckout & { user?: User })[]> {
    const checkouts = await db
      .select()
      .from(itemCheckouts)
      .where(eq(itemCheckouts.itemId, itemId))
      .orderBy(desc(itemCheckouts.checkedOutAt));

    // Fetch related users
    const enrichedCheckouts = await Promise.all(
      checkouts.map(async (checkout) => {
        const user = await this.getUserById(checkout.userId);
        return { ...checkout, user };
      })
    );

    return enrichedCheckouts;
  }

  async getCheckoutById(checkoutId: number): Promise<(ItemCheckout & { item?: InventoryItem, user?: User }) | undefined> {
    const [checkout] = await db
      .select()
      .from(itemCheckouts)
      .where(eq(itemCheckouts.id, checkoutId));

    if (!checkout) return undefined;

    const item = await this.getInventoryItemById(checkout.itemId);
    const user = await this.getUserById(checkout.userId);
    return { ...checkout, item, user };
  }

  async updateCheckoutPayment(
    checkoutId: number, 
    data: { paymentStatus: 'not_charged' | 'charged' | 'failed', stripePaymentIntentId?: string, chargedAmountCents?: number }
  ): Promise<ItemCheckout> {
    const [updated] = await db
      .update(itemCheckouts)
      .set({
        paymentStatus: data.paymentStatus,
        stripePaymentIntentId: data.stripePaymentIntentId,
        chargedAmountCents: data.chargedAmountCents,
        chargedAt: data.paymentStatus === 'charged' ? new Date() : undefined,
      })
      .where(eq(itemCheckouts.id, checkoutId))
      .returning();

    if (!updated) {
      throw new Error("Checkout not found");
    }

    return updated;
  }

  async createLoginEvent(event: InsertLoginEvent): Promise<LoginEvent> {
    const [loginEvent] = await db
      .insert(loginEvents)
      .values(event)
      .returning();
    return loginEvent;
  }

  async getLoginEventsByUserId(userId: number, limit: number = 50): Promise<LoginEvent[]> {
    return await db
      .select()
      .from(loginEvents)
      .where(eq(loginEvents.userId, userId))
      .orderBy(desc(loginEvents.occurredAt))
      .limit(limit);
  }

  async getAllStaffLoginEvents(limit: number = 100): Promise<(LoginEvent & { user?: User })[]> {
    const staffAdmins = await this.listStaffAdmins();
    const staffAdminIds = staffAdmins.map(u => u.id);
    
    if (staffAdminIds.length === 0) return [];

    const events = await db
      .select()
      .from(loginEvents)
      .where(inArray(loginEvents.userId, staffAdminIds))
      .orderBy(desc(loginEvents.occurredAt))
      .limit(limit);

    const enrichedEvents = await Promise.all(
      events.map(async (event) => {
        const user = await this.getUserById(event.userId);
        return { ...event, user };
      })
    );

    return enrichedEvents;
  }

  async updateUserLastLogin(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Session configuration methods
  async getAllSessionConfigs(): Promise<SessionConfig[]> {
    return await db.select().from(sessionConfigs);
  }

  async getSessionConfigByType(sessionType: 'morning' | 'evening'): Promise<SessionConfig | undefined> {
    const [config] = await db
      .select()
      .from(sessionConfigs)
      .where(eq(sessionConfigs.sessionType, sessionType));
    return config;
  }

  async updateSessionConfig(sessionType: 'morning' | 'evening', data: Partial<SessionConfig>): Promise<SessionConfig> {
    const existing = await db
      .select()
      .from(sessionConfigs)
      .where(eq(sessionConfigs.sessionType, sessionType))
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(sessionConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(sessionConfigs.sessionType, sessionType))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(sessionConfigs)
        .values({
          sessionType,
          startTime: data.startTime || (sessionType === 'morning' ? '7:00 AM' : '4:00 PM'),
          endTime: data.endTime || (sessionType === 'morning' ? '12:00 PM' : '9:00 PM'),
          capacity: data.capacity || 20,
          isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
          bookingGraceMinutes: data.bookingGraceMinutes ?? 60,
        })
        .returning();
      return created;
    }
  }

  // Session booking methods
  async createSessionBooking(booking: InsertSessionBooking): Promise<SessionBooking> {
    const [created] = await db
      .insert(sessionBookings)
      .values(booking)
      .returning();
    return created;
  }

  async getSessionBookingsByUserId(userId: number): Promise<SessionBooking[]> {
    return await db
      .select()
      .from(sessionBookings)
      .where(and(
        eq(sessionBookings.userId, userId),
        eq(sessionBookings.status, 'confirmed')
      ))
      .orderBy(desc(sessionBookings.bookingDate));
  }

  async getSessionBookingsForDate(date: string, sessionType?: 'morning' | 'evening'): Promise<SessionBooking[]> {
    const conditions = [
      eq(sessionBookings.bookingDate, date),
      eq(sessionBookings.status, 'confirmed')
    ];
    
    if (sessionType) {
      conditions.push(eq(sessionBookings.sessionType, sessionType));
    }
    
    return await db
      .select()
      .from(sessionBookings)
      .where(and(...conditions));
  }

  async getAllSessionBookingsWithUsers(fromDate?: string): Promise<(SessionBooking & { user?: User })[]> {
    const conditions = [eq(sessionBookings.status, 'confirmed')];
    
    if (fromDate) {
      conditions.push(sql`${sessionBookings.bookingDate} >= ${fromDate}`);
    }
    
    const bookings = await db
      .select()
      .from(sessionBookings)
      .where(and(...conditions))
      .orderBy(sessionBookings.bookingDate, sessionBookings.sessionType);
    
    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const user = await this.getUserById(booking.userId);
        return { ...booking, user: user || undefined };
      })
    );
    
    return enrichedBookings;
  }

  async cancelSessionBooking(bookingId: number): Promise<SessionBooking> {
    const [updated] = await db
      .update(sessionBookings)
      .set({ 
        status: 'cancelled',
        cancelledAt: new Date()
      })
      .where(eq(sessionBookings.id, bookingId))
      .returning();
    
    if (!updated) {
      throw new Error("Booking not found");
    }
    return updated;
  }

  async getSessionBookingById(bookingId: number): Promise<SessionBooking | undefined> {
    const [booking] = await db
      .select()
      .from(sessionBookings)
      .where(eq(sessionBookings.id, bookingId));
    return booking;
  }

  async getSessionAvailability(date: string, sessionType: 'morning' | 'evening'): Promise<{ booked: number, capacity: number }> {
    const config = await this.getSessionConfigByType(sessionType);
    if (!config) {
      return { booked: 0, capacity: 0 };
    }
    
    const bookings = await db
      .select()
      .from(sessionBookings)
      .where(and(
        eq(sessionBookings.bookingDate, date),
        eq(sessionBookings.sessionType, sessionType),
        eq(sessionBookings.status, 'confirmed')
      ));
    
    return {
      booked: bookings.length,
      capacity: config.capacity
    };
  }

  async hasUserBookedSession(userId: number, date: string, sessionType: 'morning' | 'evening'): Promise<boolean> {
    const [booking] = await db
      .select()
      .from(sessionBookings)
      .where(and(
        eq(sessionBookings.userId, userId),
        eq(sessionBookings.bookingDate, date),
        eq(sessionBookings.sessionType, sessionType),
        eq(sessionBookings.status, 'confirmed')
      ));
    
    return !!booking;
  }

  async markSessionBookingCheckedIn(userId: number, date: string, sessionType: 'morning' | 'evening'): Promise<void> {
    await db
      .update(sessionBookings)
      .set({ status: 'checked_in' })
      .where(and(
        eq(sessionBookings.userId, userId),
        eq(sessionBookings.bookingDate, date),
        eq(sessionBookings.sessionType, sessionType),
        eq(sessionBookings.status, 'confirmed')
      ));
  }

  // Day pass hours methods
  async getDayPassHours(): Promise<DayPassHours | undefined> {
    const [hours] = await db.select().from(dayPassHours).limit(1);
    return hours;
  }

  async updateDayPassHours(data: Partial<DayPassHours>): Promise<DayPassHours> {
    // Get the first (and should be only) row
    const existing = await this.getDayPassHours();
    
    if (existing) {
      const [updated] = await db
        .update(dayPassHours)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(dayPassHours.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create if doesn't exist
      const [created] = await db
        .insert(dayPassHours)
        .values({
          startTime: data.startTime || '10:00 AM',
          endTime: data.endTime || '5:00 PM',
          isEnabled: data.isEnabled ?? true,
        })
        .returning();
      return created;
    }
  }

  // Guest waiver methods
  async createGuestWaiver(waiver: InsertGuestWaiver): Promise<GuestWaiver> {
    const [created] = await db
      .insert(guestWaivers)
      .values(waiver)
      .returning();
    return created;
  }

  async getAllGuestWaivers(): Promise<GuestWaiver[]> {
    return await db
      .select()
      .from(guestWaivers)
      .orderBy(desc(guestWaivers.checkInTimestamp));
  }

  async getGuestWaiverById(id: number): Promise<GuestWaiver | undefined> {
    const [waiver] = await db
      .select()
      .from(guestWaivers)
      .where(eq(guestWaivers.id, id));
    return waiver;
  }

  async getGuestWaiversByEmail(email: string): Promise<GuestWaiver[]> {
    return await db
      .select()
      .from(guestWaivers)
      .where(eq(guestWaivers.email, email.toLowerCase()))
      .orderBy(desc(guestWaivers.checkInTimestamp));
  }

  async getGuestWaiversByUserId(userId: number): Promise<GuestWaiver[]> {
    return await db
      .select()
      .from(guestWaivers)
      .where(eq(guestWaivers.userId, userId))
      .orderBy(desc(guestWaivers.checkInTimestamp));
  }

  async getTodayGuestWaivers(): Promise<GuestWaiver[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return await db
      .select()
      .from(guestWaivers)
      .where(
        and(
          gte(guestWaivers.checkInTimestamp, today),
          lt(guestWaivers.checkInTimestamp, tomorrow)
        )
      )
      .orderBy(desc(guestWaivers.checkInTimestamp));
  }

  async getGuestWaiverAnalytics(): Promise<{ total: number; today: number; thisWeek: number; thisMonth: number }> {
    const now = new Date();
    
    // Today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    // This week (start of week - Sunday)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(guestWaivers);
    const [todayResult] = await db.select({ count: sql<number>`count(*)` })
      .from(guestWaivers)
      .where(gte(guestWaivers.checkInTimestamp, todayStart));
    const [weekResult] = await db.select({ count: sql<number>`count(*)` })
      .from(guestWaivers)
      .where(gte(guestWaivers.checkInTimestamp, weekStart));
    const [monthResult] = await db.select({ count: sql<number>`count(*)` })
      .from(guestWaivers)
      .where(gte(guestWaivers.checkInTimestamp, monthStart));
    
    return {
      total: Number(totalResult?.count || 0),
      today: Number(todayResult?.count || 0),
      thisWeek: Number(weekResult?.count || 0),
      thisMonth: Number(monthResult?.count || 0),
    };
  }

  async getPaginatedGuestWaivers(page: number, pageSize: number, period?: string, search?: string): Promise<{ data: GuestWaiver[]; total: number }> {
    const conditions: any[] = [];
    
    if (period && period !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0);
      }
      conditions.push(gte(guestWaivers.checkInTimestamp, startDate));
    }

    if (search && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      conditions.push(
        or(
          sql`LOWER(${guestWaivers.firstName}) LIKE ${'%' + searchLower + '%'}`,
          sql`LOWER(${guestWaivers.lastName}) LIKE ${'%' + searchLower + '%'}`,
          sql`LOWER(${guestWaivers.email}) LIKE ${'%' + searchLower + '%'}`,
          sql`LOWER(${guestWaivers.phoneNumber}) LIKE ${'%' + searchLower + '%'}`
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(guestWaivers)
      .where(whereClause);

    const data = await db
      .select()
      .from(guestWaivers)
      .where(whereClause)
      .orderBy(desc(guestWaivers.checkInTimestamp))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { data, total: Number(countResult?.count || 0) };
  }

  async upsertGuestUser(data: { firstName: string; lastName: string; email: string; phoneNumber?: string | null }): Promise<User> {
    const email = data.email.toLowerCase();
    const existing = await this.getUserByEmail(email);

    if (existing) {
      if (existing.role !== 'guest') {
        return existing;
      }
      const [updated] = await db
        .update(users)
        .set({
          firstName: data.firstName,
          lastName: data.lastName,
          ...(data.phoneNumber != null ? { phoneNumber: data.phoneNumber } : {}),
        })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(users)
      .values({
        username: email,
        email,
        password: '__guest_no_login__',
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber ?? null,
        role: 'guest',
        membershipAgreementCompleted: false,
      })
      .returning();
    return created;
  }

  async updateGuestWaiverUserId(waiverId: number, userId: number): Promise<void> {
    await db
      .update(guestWaivers)
      .set({ userId })
      .where(eq(guestWaivers.id, waiverId));
  }

  async getAllGuests(): Promise<(User & { visitCount: number })[]> {
    const guestUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'guest'))
      .orderBy(desc(users.createdAt));

    const result: (User & { visitCount: number })[] = [];
    for (const guestUser of guestUsers) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(guestWaivers)
        .where(eq(guestWaivers.userId, guestUser.id));
      result.push({ ...guestUser, visitCount: Number(countResult?.count || 0) });
    }
    return result;
  }

  async getGuestWaiversByUserId(userId: number): Promise<GuestWaiver[]> {
    return await db
      .select()
      .from(guestWaivers)
      .where(eq(guestWaivers.userId, userId))
      .orderBy(desc(guestWaivers.checkInTimestamp));
  }

  // Waiver question methods
  async getActiveWaiverQuestions(): Promise<WaiverQuestion[]> {
    return await db
      .select()
      .from(waiverQuestions)
      .where(eq(waiverQuestions.isActive, true))
      .orderBy(waiverQuestions.sortOrder, waiverQuestions.id);
  }

  async getAllWaiverQuestions(): Promise<WaiverQuestion[]> {
    return await db
      .select()
      .from(waiverQuestions)
      .orderBy(waiverQuestions.sortOrder, waiverQuestions.id);
  }

  async createWaiverQuestion(q: InsertWaiverQuestion): Promise<WaiverQuestion> {
    const [created] = await db.insert(waiverQuestions).values(q).returning();
    return created;
  }

  async updateWaiverQuestion(id: number, data: Partial<InsertWaiverQuestion>): Promise<WaiverQuestion> {
    const [updated] = await db
      .update(waiverQuestions)
      .set(data)
      .where(eq(waiverQuestions.id, id))
      .returning();
    return updated;
  }

  async deleteWaiverQuestion(id: number): Promise<void> {
    await db.delete(waiverQuestions).where(eq(waiverQuestions.id, id));
  }

  async createGuestWaiverAnswers(answers: { guestWaiverId: number; questionId: number; answer: boolean }[]): Promise<void> {
    if (answers.length === 0) return;
    await db.insert(guestWaiverAnswers).values(answers);
  }

  async getGuestWaiverAnswers(guestWaiverId: number): Promise<(GuestWaiverAnswer & { question: WaiverQuestion })[]> {
    const rows = await db
      .select()
      .from(guestWaiverAnswers)
      .innerJoin(waiverQuestions, eq(guestWaiverAnswers.questionId, waiverQuestions.id))
      .where(eq(guestWaiverAnswers.guestWaiverId, guestWaiverId));
    return rows.map(r => ({ ...r.guest_waiver_answers, question: r.waiver_questions }));
  }

  // Site settings methods
  async getSiteSetting(key: string): Promise<SiteSetting | undefined> {
    const [setting] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    return setting;
  }

  async getAllSiteSettings(): Promise<SiteSetting[]> {
    return await db.select().from(siteSettings);
  }

  async upsertSiteSetting(key: string, value: string, description?: string): Promise<SiteSetting> {
    const existing = await this.getSiteSetting(key);
    if (existing) {
      const [updated] = await db.update(siteSettings)
        .set({ value, description, updatedAt: new Date() })
        .where(eq(siteSettings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(siteSettings)
        .values({ key, value, description })
        .returning();
      return created;
    }
  }

  async createGiftCard(data: InsertGiftCard): Promise<GiftCard> {
    const [card] = await db.insert(giftCards).values(data).returning();
    return card;
  }

  async getGiftCardByCode(code: string): Promise<GiftCard | undefined> {
    const [card] = await db.select().from(giftCards).where(eq(giftCards.code, code));
    return card || undefined;
  }

  async getGiftCardById(id: number): Promise<GiftCard | undefined> {
    const [card] = await db.select().from(giftCards).where(eq(giftCards.id, id));
    return card || undefined;
  }

  async getAllGiftCards(page: number = 1, pageSize: number = 20, status?: string, search?: string): Promise<{ data: GiftCard[]; total: number }> {
    const conditions: any[] = [];

    if (status) {
      conditions.push(eq(giftCards.status, status as any));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(giftCards.code, searchPattern),
          ilike(giftCards.purchaserEmail, searchPattern),
          ilike(giftCards.purchaserName, searchPattern),
          ilike(giftCards.recipientEmail, searchPattern),
          ilike(giftCards.recipientName, searchPattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(giftCards)
      .where(whereClause);

    const data = await db
      .select()
      .from(giftCards)
      .where(whereClause)
      .orderBy(desc(giftCards.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { data, total: Number(countResult?.count || 0) };
  }

  async updateGiftCard(id: number, data: Partial<GiftCard>): Promise<GiftCard> {
    const [card] = await db.update(giftCards).set(data).where(eq(giftCards.id, id)).returning();
    return card;
  }

  async redeemGiftCard(id: number, userId: number, amount: number, description: string): Promise<GiftCard> {
    const card = await this.getGiftCardById(id);
    if (!card) throw new Error("Gift card not found");

    const newRemaining = card.remainingAmount - amount;
    if (newRemaining < 0) throw new Error("Insufficient gift card balance");

    const updateData: Partial<GiftCard> = {
      remainingAmount: newRemaining,
      redeemedByUserId: userId,
    };

    if (newRemaining === 0) {
      updateData.status = 'redeemed';
      updateData.redeemedAt = new Date();
    }

    const [updatedCard] = await db.update(giftCards)
      .set(updateData)
      .where(eq(giftCards.id, id))
      .returning();

    await db.insert(giftCardRedemptions).values({
      giftCardId: id,
      userId,
      amount,
      description,
    });

    return updatedCard;
  }

  async getAllDenominations(): Promise<GiftCardDenomination[]> {
    return await db.select().from(giftCardDenominations).orderBy(giftCardDenominations.sortOrder);
  }

  async getActiveDenominations(): Promise<GiftCardDenomination[]> {
    return await db.select().from(giftCardDenominations)
      .where(eq(giftCardDenominations.isActive, true))
      .orderBy(giftCardDenominations.sortOrder);
  }

  async createDenomination(data: InsertGiftCardDenomination): Promise<GiftCardDenomination> {
    const [denom] = await db.insert(giftCardDenominations).values(data).returning();
    return denom;
  }

  async updateDenomination(id: number, data: Partial<GiftCardDenomination>): Promise<GiftCardDenomination> {
    const [denom] = await db.update(giftCardDenominations).set(data).where(eq(giftCardDenominations.id, id)).returning();
    return denom;
  }

  async deleteDenomination(id: number): Promise<void> {
    await db.delete(giftCardDenominations).where(eq(giftCardDenominations.id, id));
  }

  async getRedemptionsByGiftCardId(giftCardId: number): Promise<GiftCardRedemption[]> {
    return await db.select().from(giftCardRedemptions)
      .where(eq(giftCardRedemptions.giftCardId, giftCardId))
      .orderBy(desc(giftCardRedemptions.createdAt));
  }

  async createWaitlistEntry(data: InsertWaitlist): Promise<Waitlist> {
    const [entry] = await db.insert(waitlist).values(data).returning();
    return entry;
  }

  async getWaitlistEntries(date: string): Promise<Waitlist[]> {
    return await db.select().from(waitlist)
      .where(and(eq(waitlist.date, date), sql`${waitlist.status} != 'removed'`))
      .orderBy(waitlist.createdAt);
  }

  async getWaitlistEntryById(id: number): Promise<Waitlist | undefined> {
    const [entry] = await db.select().from(waitlist).where(eq(waitlist.id, id));
    return entry;
  }

  async updateWaitlistEntry(id: number, data: Partial<InsertWaitlist>): Promise<Waitlist> {
    const [entry] = await db.update(waitlist).set(data).where(eq(waitlist.id, id)).returning();
    return entry;
  }

  async deleteWaitlistEntry(id: number): Promise<void> {
    await db.delete(waitlist).where(eq(waitlist.id, id));
  }

  // Special events
  async createEvent(data: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(data).returning();
    return event;
  }

  async getEvents(includeInactive = false): Promise<Event[]> {
    const query = db.select().from(events);
    if (!includeInactive) {
      return query.where(eq(events.isActive, true)).orderBy(events.date, events.startTime);
    }
    return query.orderBy(events.date, events.startTime);
  }

  async getEventById(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event> {
    const [event] = await db.update(events).set(data).where(eq(events.id, id)).returning();
    return event;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(eventBookings).where(eq(eventBookings.eventId, id));
    await db.delete(events).where(eq(events.id, id));
  }

  // Event bookings
  async createEventBooking(data: InsertEventBooking): Promise<EventBooking> {
    const [booking] = await db.insert(eventBookings).values(data).returning();
    return booking;
  }

  async getEventBookingsByUserId(userId: number): Promise<(EventBooking & { event: Event })[]> {
    const rows = await db.select().from(eventBookings)
      .innerJoin(events, eq(eventBookings.eventId, events.id))
      .where(and(eq(eventBookings.userId, userId), eq(eventBookings.status, 'confirmed')))
      .orderBy(events.date);
    return rows.map(r => ({ ...r.event_bookings, event: r.events }));
  }

  async getEventBookingsByEventId(eventId: number): Promise<EventBooking[]> {
    return db.select().from(eventBookings)
      .where(and(eq(eventBookings.eventId, eventId), eq(eventBookings.status, 'confirmed')));
  }

  async getEventBookingsByEventIdWithUsers(eventId: number): Promise<(EventBooking & { user: { id: number; firstName: string | null; lastName: string | null; email: string } })[]> {
    const rows = await db.select({
      booking: eventBookings,
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    }).from(eventBookings)
      .innerJoin(users, eq(eventBookings.userId, users.id))
      .where(and(eq(eventBookings.eventId, eventId), eq(eventBookings.status, 'confirmed')))
      .orderBy(eventBookings.createdAt);
    return rows.map(r => ({
      ...r.booking,
      user: { id: r.userId, firstName: r.firstName, lastName: r.lastName, email: r.email },
    }));
  }

  async getEventBookingByUserAndEvent(userId: number, eventId: number): Promise<EventBooking | undefined> {
    const [booking] = await db.select().from(eventBookings)
      .where(and(eq(eventBookings.userId, userId), eq(eventBookings.eventId, eventId), eq(eventBookings.status, 'confirmed')));
    return booking;
  }

  async cancelEventBooking(id: number): Promise<EventBooking> {
    const [booking] = await db.update(eventBookings).set({ status: 'cancelled' }).where(eq(eventBookings.id, id)).returning();
    return booking;
  }

  async getEventBookingById(id: number): Promise<EventBooking | undefined> {
    const [booking] = await db.select().from(eventBookings).where(eq(eventBookings.id, id));
    return booking;
  }

  // ─── Checklist methods ────────────────────────────────────────────────────

  async getChecklistItems(type?: string): Promise<ChecklistItem[]> {
    if (type) {
      return db.select().from(checklistItems)
        .where(and(eq(checklistItems.type, type), eq(checklistItems.isActive, true)))
        .orderBy(checklistItems.sortOrder, checklistItems.id);
    }
    return db.select().from(checklistItems)
      .where(eq(checklistItems.isActive, true))
      .orderBy(checklistItems.type, checklistItems.sortOrder, checklistItems.id);
  }

  async createChecklistItem(item: InsertChecklistItem): Promise<ChecklistItem> {
    const [created] = await db.insert(checklistItems).values(item).returning();
    return created;
  }

  async updateChecklistItem(id: number, item: Partial<InsertChecklistItem>): Promise<ChecklistItem> {
    const [updated] = await db.update(checklistItems).set(item).where(eq(checklistItems.id, id)).returning();
    return updated;
  }

  async deleteChecklistItem(id: number): Promise<void> {
    await db.update(checklistItems).set({ isActive: false }).where(eq(checklistItems.id, id));
  }

  async getChecklistRuns(type: string, date: string): Promise<ChecklistRun[]> {
    return db.select().from(checklistRuns)
      .where(and(eq(checklistRuns.type, type), eq(checklistRuns.date, date)))
      .orderBy(desc(checklistRuns.startedAt));
  }

  async createChecklistRun(run: InsertChecklistRun): Promise<ChecklistRun> {
    const [created] = await db.insert(checklistRuns).values(run).returning();
    return created;
  }

  async updateChecklistRun(id: number, data: Partial<ChecklistRun>): Promise<ChecklistRun> {
    const [updated] = await db.update(checklistRuns).set(data).where(eq(checklistRuns.id, id)).returning();
    return updated;
  }

  async deleteChecklistRun(id: number): Promise<void> {
    // checklistRunItems cascade-deletes automatically via FK onDelete: "cascade"
    await db.delete(checklistRuns).where(eq(checklistRuns.id, id));
  }

  async getChecklistRunItems(runId: number): Promise<ChecklistRunItem[]> {
    return db.select().from(checklistRunItems).where(eq(checklistRunItems.runId, runId));
  }

  async checkChecklistItem(runId: number, itemId: number, userId?: number): Promise<ChecklistRunItem> {
    // Upsert: remove existing then insert
    await db.delete(checklistRunItems)
      .where(and(eq(checklistRunItems.runId, runId), eq(checklistRunItems.itemId, itemId)));
    const [created] = await db.insert(checklistRunItems)
      .values({ runId, itemId, completedByUserId: userId ?? null })
      .returning();
    return created;
  }

  async uncheckChecklistItem(runId: number, itemId: number): Promise<void> {
    await db.delete(checklistRunItems)
      .where(and(eq(checklistRunItems.runId, runId), eq(checklistRunItems.itemId, itemId)));
  }

  async getTodayChecklistSummary(today: string): Promise<{
    opening: { total: number; completed: number; hasRun: boolean; isComplete: boolean };
    closing: { total: number; completed: number; hasRun: boolean; isComplete: boolean };
    hourly: { total: number; completed: number; hasRun: boolean; isComplete: boolean };
  }> {
    const types = ['opening', 'closing', 'hourly'] as const;
    const result: any = {};
    for (const type of types) {
      const items = await this.getChecklistItems(type);
      const total = items.length;
      const runs = await this.getChecklistRuns(type, today);
      const latestRun = runs[0];
      let completed = 0;
      if (latestRun) {
        const runItems = await this.getChecklistRunItems(latestRun.id);
        completed = runItems.length;
      }
      result[type] = {
        total,
        completed,
        hasRun: !!latestRun,
        isComplete: !!latestRun?.completedAt,
      };
    }
    return result;
  }

  // ─── Newsletter methods ────────────────────────────────────────────────────

  async getAllNewsletters(): Promise<Newsletter[]> {
    return db.select().from(newsletters).orderBy(desc(newsletters.createdAt));
  }

  async getNewsletterById(id: number): Promise<Newsletter | undefined> {
    const [row] = await db.select().from(newsletters).where(eq(newsletters.id, id));
    return row;
  }

  async createNewsletter(data: InsertNewsletter & { createdByUserId?: number }): Promise<Newsletter> {
    const [row] = await db.insert(newsletters).values({
      subject: data.subject,
      htmlBody: data.htmlBody,
      plainBody: data.plainBody,
      recipientFilter: data.recipientFilter ?? 'all',
      status: 'draft',
      createdByUserId: data.createdByUserId ?? null,
    }).returning();
    return row;
  }

  async updateNewsletter(id: number, data: Partial<Newsletter>): Promise<Newsletter> {
    const [row] = await db.update(newsletters).set(data).where(eq(newsletters.id, id)).returning();
    return row;
  }

  async deleteNewsletter(id: number): Promise<void> {
    await db.delete(newsletters).where(eq(newsletters.id, id));
  }

  async markNewsletterSent(id: number, sentCount: number): Promise<Newsletter> {
    const [row] = await db.update(newsletters)
      .set({ status: 'sent', sentAt: new Date(), sentCount })
      .where(eq(newsletters.id, id))
      .returning();
    return row;
  }

  async getNewsletterRecipients(filter: 'all' | 'active_members' | 'day_pass_holders'): Promise<{ email: string; firstName: string }[]> {
    if (filter === 'day_pass_holders') {
      // Users with an active punch card (remaining punches > 0)
      const rows = await db
        .selectDistinct({ email: users.email, firstName: users.firstName })
        .from(users)
        .innerJoin(punchCards, eq(punchCards.userId, users.id))
        .where(
          and(
            eq(punchCards.status, 'active'),
            sql`${punchCards.remainingPunches} > 0`,
            eq(users.isArchived, false)
          )
        );
      return rows.map(r => ({ email: r.email, firstName: r.firstName ?? '' }));
    }

    if (filter === 'active_members') {
      // Users with an active recurring membership
      const rows = await db
        .selectDistinct({ email: users.email, firstName: users.firstName })
        .from(users)
        .innerJoin(memberships, eq(memberships.userId, users.id))
        .where(
          and(
            eq(memberships.status, 'active'),
            eq(users.isArchived, false)
          )
        );
      return rows.map(r => ({ email: r.email, firstName: r.firstName ?? '' }));
    }

    // 'all' — every non-archived member-role user
    const rows = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(and(eq(users.role, 'member'), eq(users.isArchived, false)));
    return rows.map(r => ({ email: r.email, firstName: r.firstName ?? '' }));
  }

  // SMS Broadcast methods
  async getOptedInSmsRecipients(): Promise<{ id: number; phoneNumber: string; firstName: string; lastName: string }[]> {
    const rows = await db
      .select({ id: users.id, phoneNumber: users.phoneNumber, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(and(eq(users.smsOptIn, true), eq(users.isArchived, false)));
    return rows
      .filter(r => r.phoneNumber)
      .map(r => ({
        id: r.id,
        phoneNumber: r.phoneNumber!,
        firstName: r.firstName ?? '',
        lastName: r.lastName ?? '',
      }));
  }

  async createSmsBroadcast(data: InsertSmsBroadcast): Promise<SmsBroadcast> {
    const [row] = await db.insert(smsBroadcasts).values(data).returning();
    return row;
  }

  async updateSmsBroadcast(id: number, data: Partial<SmsBroadcast>): Promise<SmsBroadcast> {
    const [row] = await db.update(smsBroadcasts).set(data).where(eq(smsBroadcasts.id, id)).returning();
    return row;
  }

  async getAllSmsBroadcasts(): Promise<SmsBroadcast[]> {
    return db.select().from(smsBroadcasts).orderBy(desc(smsBroadcasts.createdAt));
  }
}

export const storage = new DatabaseStorage();
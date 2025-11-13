import { db } from "./db";
import { users, memberships, membershipPlans, landingPageContent, promotions } from "@shared/schema";
import { hashPassword } from "./auth";
import { sql } from "drizzle-orm";

/**
 * Database Seeding Script
 * 
 * This script creates test accounts for development purposes.
 * It should NEVER be run in production.
 * 
 * Test Accounts Created:
 * - Admin: admin@wolfmother.com / Admin123!
 * - Staff: staff@wolfmother.com / Staff123!
 * - Members with various edge cases for testing
 */

const TEST_ACCOUNTS = [
  {
    username: "admin_test",
    email: "admin@wolfmother.com",
    password: "Admin123!",
    firstName: "Admin",
    lastName: "User",
    phoneNumber: "918-555-0001",
    role: "admin" as const,
    membershipAgreementCompleted: true,
  },
  {
    username: "staff_test",
    email: "staff@wolfmother.com",
    password: "Staff123!",
    firstName: "Staff",
    lastName: "User",
    phoneNumber: "918-555-0002",
    role: "staff" as const,
    membershipAgreementCompleted: true,
  },
  // Active member with basic membership
  {
    username: "member_active",
    email: "member@wolfmother.com",
    password: "Member123!",
    firstName: "Active",
    lastName: "Member",
    phoneNumber: "918-555-0003",
    role: "member" as const,
    membershipAgreementCompleted: true,
    dateOfBirth: "1990-01-01",
    ageConfirmation: true,
    emergencyContact: "Emergency Contact",
    emergencyPhone: "918-555-0099",
    address: "123 Test St, Tulsa, OK 74103",
    membershipType: "basic" as const,
    membershipStatus: "active" as const,
  },
  // Member with expired membership
  {
    username: "member_expired",
    email: "expired@wolfmother.com",
    password: "Member123!",
    firstName: "Expired",
    lastName: "Member",
    phoneNumber: "918-555-0004",
    role: "member" as const,
    membershipAgreementCompleted: true,
    dateOfBirth: "1985-05-15",
    ageConfirmation: true,
    emergencyContact: "Emergency Contact",
    emergencyPhone: "918-555-0098",
    address: "456 Expired Ln, Tulsa, OK 74103",
    membershipType: "basic" as const,
    membershipStatus: "expired" as const,
  },
  // Member with frozen membership
  {
    username: "member_frozen",
    email: "frozen@wolfmother.com",
    password: "Member123!",
    firstName: "Frozen",
    lastName: "Member",
    phoneNumber: "918-555-0005",
    role: "member" as const,
    membershipAgreementCompleted: true,
    dateOfBirth: "1988-03-20",
    ageConfirmation: true,
    emergencyContact: "Emergency Contact",
    emergencyPhone: "918-555-0097",
    address: "789 Frozen Ave, Tulsa, OK 74103",
    membershipType: "premium" as const,
    membershipStatus: "frozen" as const,
  },
  // Member with inactive membership
  {
    username: "member_inactive",
    email: "inactive@wolfmother.com",
    password: "Member123!",
    firstName: "Inactive",
    lastName: "Member",
    phoneNumber: "918-555-0006",
    role: "member" as const,
    membershipAgreementCompleted: true,
    dateOfBirth: "1992-07-10",
    ageConfirmation: true,
    emergencyContact: "Emergency Contact",
    emergencyPhone: "918-555-0096",
    address: "321 Inactive Rd, Tulsa, OK 74103",
    membershipType: "basic" as const,
    membershipStatus: "inactive" as const,
  },
  // Member with premium membership
  {
    username: "member_premium",
    email: "premium@wolfmother.com",
    password: "Member123!",
    firstName: "Premium",
    lastName: "Member",
    phoneNumber: "918-555-0007",
    role: "member" as const,
    membershipAgreementCompleted: true,
    dateOfBirth: "1987-11-25",
    ageConfirmation: true,
    emergencyContact: "Emergency Contact",
    emergencyPhone: "918-555-0095",
    address: "654 Premium Blvd, Tulsa, OK 74103",
    membershipType: "premium" as const,
    membershipStatus: "active" as const,
  },
  // Member with VIP membership
  {
    username: "member_vip",
    email: "vip@wolfmother.com",
    password: "Member123!",
    firstName: "VIP",
    lastName: "Member",
    phoneNumber: "918-555-0008",
    role: "member" as const,
    membershipAgreementCompleted: true,
    dateOfBirth: "1995-02-14",
    ageConfirmation: true,
    emergencyContact: "Emergency Contact",
    emergencyPhone: "918-555-0094",
    address: "987 VIP Parkway, Tulsa, OK 74103",
    membershipType: "vip" as const,
    membershipStatus: "active" as const,
  },
  // New member without membership agreement completed
  {
    username: "member_new",
    email: "newmember@wolfmother.com",
    password: "Member123!",
    firstName: "New",
    lastName: "Member",
    phoneNumber: "918-555-0009",
    role: "member" as const,
    membershipAgreementCompleted: false,
    dateOfBirth: "1993-09-05",
    ageConfirmation: false,
  },
  // Member with no membership (day pass user)
  {
    username: "member_daypass",
    email: "daypass@wolfmother.com",
    password: "Member123!",
    firstName: "DayPass",
    lastName: "User",
    phoneNumber: "918-555-0010",
    role: "member" as const,
    membershipAgreementCompleted: true,
    dateOfBirth: "1991-12-30",
    ageConfirmation: true,
    emergencyContact: "Emergency Contact",
    emergencyPhone: "918-555-0093",
    address: "159 DayPass St, Tulsa, OK 74103",
    membershipType: null,
    membershipStatus: null,
  },
];

async function seedTestAccounts() {
  console.log("🌱 Starting database seed...");
  
  try {
    // Create test accounts
    console.log("\n📝 Creating test accounts...");
    
    for (const account of TEST_ACCOUNTS) {
      const { password, membershipType, membershipStatus, ...accountData } = account;
      const hashedPassword = await hashPassword(password);
      
      try {
        const [user] = await db
          .insert(users)
          .values({
            ...accountData,
            password: hashedPassword,
          })
          .onConflictDoNothing()
          .returning();
        
        if (user) {
          console.log(`✅ Created ${account.role}: ${account.email}`);
          
          // Create a test membership for members (if membershipType is specified)
          if (account.role === "member" && membershipType) {
            const today = new Date();
            let startDate = new Date(today);
            let endDate = new Date(today);
            
            // Set dates based on status
            if (membershipStatus === "expired") {
              // Expired 30 days ago
              startDate.setMonth(startDate.getMonth() - 2);
              endDate.setMonth(endDate.getMonth() - 1);
            } else if (membershipStatus === "active") {
              // Started 15 days ago, ends in 15 days
              startDate.setDate(startDate.getDate() - 15);
              endDate.setMonth(endDate.getMonth() + 1);
            } else if (membershipStatus === "frozen" || membershipStatus === "inactive") {
              // Started 30 days ago, ends in future
              startDate.setMonth(startDate.getMonth() - 1);
              endDate.setMonth(endDate.getMonth() + 1);
            }
            
            try {
              await db.insert(memberships).values({
                userId: user.id,
                membershipId: `MEM-${user.id}-${Date.now()}`,
                planType: membershipType,
                status: membershipStatus || "active",
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                autoRenew: membershipStatus === "active",
              });
              console.log(`   💳 Added ${membershipType} ${membershipStatus || 'active'} membership for ${account.email}`);
            } catch (error) {
              console.log(`   ⚠️  Membership might already exist for ${account.email}`);
            }
          } else if (account.role === "member" && !membershipType) {
            console.log(`   ℹ️  No membership created for ${account.email} (day pass user)`);
          }
        } else {
          console.log(`⚠️  ${account.role} ${account.email} already exists`);
        }
      } catch (error) {
        console.log(`⚠️  ${account.role} ${account.email} already exists`);
      }
    }
    
    console.log("\n✅ Database seeding complete!");
    console.log("\n📋 Test Credentials (All passwords: Member123!):");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Admin:           admin@wolfmother.com");
    console.log("Staff:           staff@wolfmother.com");
    console.log("Member (Active): member@wolfmother.com");
    console.log("Expired Member:  expired@wolfmother.com");
    console.log("Frozen Member:   frozen@wolfmother.com");
    console.log("Inactive Member: inactive@wolfmother.com");
    console.log("Premium Member:  premium@wolfmother.com");
    console.log("VIP Member:      vip@wolfmother.com");
    console.log("New Member:      newmember@wolfmother.com (no agreement)");
    console.log("Day Pass User:   daypass@wolfmother.com (no membership)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

async function cleanDatabase() {
  console.log("🧹 Cleaning database (removing all user data)...\n");
  
  try {
    // Delete in order to respect foreign key constraints
    console.log("Removing check-ins...");
    await db.execute(sql`TRUNCATE TABLE check_ins CASCADE`);
    
    console.log("Removing notifications...");
    await db.execute(sql`TRUNCATE TABLE notifications CASCADE`);
    
    console.log("Removing punch cards...");
    await db.execute(sql`TRUNCATE TABLE punch_cards CASCADE`);
    
    console.log("Removing payment methods...");
    await db.execute(sql`TRUNCATE TABLE payment_methods CASCADE`);
    
    console.log("Removing payments...");
    await db.execute(sql`TRUNCATE TABLE payments CASCADE`);
    
    console.log("Removing memberships...");
    await db.execute(sql`TRUNCATE TABLE memberships CASCADE`);
    
    console.log("Removing password reset tokens...");
    await db.execute(sql`TRUNCATE TABLE password_reset_tokens CASCADE`);
    
    console.log("Removing users...");
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);
    
    console.log("\n✅ Database cleaned successfully!");
    console.log("ℹ️  Configuration data (membership plans, landing content, etc.) preserved\n");
    
  } catch (error) {
    console.error("❌ Error cleaning database:", error);
    throw error;
  }
}

// Main execution
const command = process.argv[2];

async function main() {
  if (command === "clean") {
    await cleanDatabase();
  } else if (command === "seed") {
    await seedTestAccounts();
  } else if (command === "reset") {
    await cleanDatabase();
    await seedTestAccounts();
  } else {
    console.log(`
Usage: npm run db:seed [command]

Commands:
  clean  - Remove all user data (keeps configuration)
  seed   - Create test accounts
  reset  - Clean database and create test accounts (recommended)

Examples:
  npm run db:seed reset   # Clean and create test accounts
  npm run db:seed seed    # Just create test accounts
  npm run db:seed clean   # Just clean user data
`);
    process.exit(1);
  }
  
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

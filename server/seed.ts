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
 * - Member: member@wolfmother.com / Member123!
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
  {
    username: "member_test",
    email: "member@wolfmother.com",
    password: "Member123!",
    firstName: "Test",
    lastName: "Member",
    phoneNumber: "918-555-0003",
    role: "member" as const,
    membershipAgreementCompleted: true,
    dateOfBirth: "1990-01-01",
    ageConfirmation: true,
    emergencyContact: "Emergency Contact",
    emergencyPhone: "918-555-0099",
    address: "123 Test St, Tulsa, OK 74103",
  },
];

async function seedTestAccounts() {
  console.log("🌱 Starting database seed...");
  
  try {
    // Create test accounts
    console.log("\n📝 Creating test accounts...");
    
    for (const account of TEST_ACCOUNTS) {
      const { password, ...accountData } = account;
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
          
          // Create a test membership for the member account
          if (account.role === "member") {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1); // 1 month membership
            
            try {
              await db.insert(memberships).values({
                userId: user.id,
                membershipId: `MEM-${user.id}-${Date.now()}`,
                planType: "basic",
                status: "active",
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                autoRenew: true,
              });
              console.log(`   💳 Added basic membership for ${account.email}`);
            } catch (error) {
              console.log(`   ⚠️  Membership might already exist for ${account.email}`);
            }
          }
        } else {
          console.log(`⚠️  ${account.role} ${account.email} already exists`);
        }
      } catch (error) {
        console.log(`⚠️  ${account.role} ${account.email} already exists`);
      }
    }
    
    console.log("\n✅ Database seeding complete!");
    console.log("\n📋 Test Credentials:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Admin:  admin@wolfmother.com / Admin123!");
    console.log("Staff:  staff@wolfmother.com / Staff123!");
    console.log("Member: member@wolfmother.com / Member123!");
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

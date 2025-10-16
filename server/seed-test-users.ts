import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function seedTestUsers() {
  console.log("🌱 Starting test users seed...");

  const testUsers = [
    // Admin users
    {
      id: "admin_test_001",
      email: "rob@fusiondataco.com",
      firstName: "Rob",
      lastName: "Administrator",
      isAdmin: true,
      hasFloridaLicense: true,
      isMultiStateLicensed: true,
      licensedStates: ["FL", "CA", "TX", "NY", "GA"],
      onboardingCompleted: true,
      hasCompletedOnboarding: true,
      onlineStatus: "online",
      phone: "555-0101",
    },
    {
      id: "admin_test_002", 
      email: "mat@fusiondataco.com",
      firstName: "Mat",
      lastName: "Administrator",
      isAdmin: true,
      hasFloridaLicense: true,
      isMultiStateLicensed: true,
      licensedStates: ["FL", "CA", "TX", "AZ", "NV"],
      onboardingCompleted: true,
      hasCompletedOnboarding: true,
      onlineStatus: "online",
      phone: "555-0102",
    },
    {
      id: "admin_test_003",
      email: "theinsuranceschool@gmail.com",
      firstName: "Insurance",
      lastName: "School",
      isAdmin: true,
      hasFloridaLicense: true,
      isMultiStateLicensed: true,
      licensedStates: ["FL", "GA", "SC", "NC", "AL"],
      onboardingCompleted: true,
      hasCompletedOnboarding: true,
      onlineStatus: "online",
      phone: "407-332-6645",
    },
    // Non-licensed candidates
    {
      id: "candidate_non_001",
      email: "test_candidate1@example.com",
      firstName: "John",
      lastName: "Candidate",
      isAdmin: false,
      hasFloridaLicense: false,
      isMultiStateLicensed: false,
      licensedStates: [],
      onboardingCompleted: true,
      hasCompletedOnboarding: true,
      onlineStatus: "offline",
      phone: "555-1001",
    },
    {
      id: "candidate_non_002",
      email: "test_candidate2@example.com",
      firstName: "Jane",
      lastName: "Applicant",
      isAdmin: false,
      hasFloridaLicense: false,
      isMultiStateLicensed: false,
      licensedStates: [],
      onboardingCompleted: true,
      hasCompletedOnboarding: true,
      onlineStatus: "offline",
      phone: "555-1002",
    },
    {
      id: "candidate_non_003",
      email: "test_candidate3@example.com",
      firstName: "Mike",
      lastName: "Prospect",
      isAdmin: false,
      hasFloridaLicense: false,
      isMultiStateLicensed: false,
      licensedStates: [],
      onboardingCompleted: true,
      hasCompletedOnboarding: true,
      onlineStatus: "online",
      phone: "555-1003",
    },
    // FL-licensed candidates
    {
      id: "candidate_fl_001",
      email: "fl_broker1@example.com",
      firstName: "Sarah",
      lastName: "Florida-Broker",
      isAdmin: false,
      hasFloridaLicense: true,
      isMultiStateLicensed: false,
      licensedStates: ["FL"],
      onboardingCompleted: true,
      hasCompletedOnboarding: true,
      onlineStatus: "online",
      phone: "555-2001",
    },
    {
      id: "candidate_fl_002",
      email: "fl_broker2@example.com",
      firstName: "Tom",
      lastName: "FL-Agent",
      isAdmin: false,
      hasFloridaLicense: true,
      isMultiStateLicensed: false,
      licensedStates: ["FL"],
      onboardingCompleted: true,
      hasCompletedOnboarding: true,
      onlineStatus: "offline",
      phone: "555-2002",
    },
    // Multi-state candidate
    {
      id: "candidate_multi_001",
      email: "multi_state_broker1@example.com",
      firstName: "Alex",
      lastName: "Multi-State",
      isAdmin: false,
      hasFloridaLicense: true,
      isMultiStateLicensed: true,
      licensedStates: ["FL", "GA", "TX", "CA", "NY", "AZ", "NV"],
      onboardingCompleted: true,
      hasCompletedOnboarding: true,
      onlineStatus: "online",
      phone: "555-3001",
    },
  ];

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email))
        .limit(1);

      if (existingUser.length > 0) {
        // Update existing user
        await db
          .update(users)
          .set({
            ...userData,
            updatedAt: new Date(),
          })
          .where(eq(users.email, userData.email));
        console.log(`✅ Updated user: ${userData.email}`);
      } else {
        // Create new user
        await db.insert(users).values({
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`✅ Created user: ${userData.email}`);
      }
    } catch (error) {
      console.error(`❌ Failed to seed user ${userData.email}:`, error);
    }
  }

  console.log("✨ Test users seeding completed!");
}

// Run the seed if this file is executed directly
seedTestUsers()
  .then(() => {
    console.log("Seed completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });

export { seedTestUsers };
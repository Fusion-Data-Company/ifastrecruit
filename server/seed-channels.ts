#!/usr/bin/env tsx
/**
 * Standalone script to seed messenger channels
 * Run with: npm run seed:channels
 */

import { seedDefaultChannels } from "./seedData";

async function main() {
  console.log("🚀 Starting channel seeding process...");
  console.log("=======================================\n");
  
  try {
    await seedDefaultChannels();
    console.log("\n=======================================");
    console.log("✅ Channel seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n=======================================");
    console.error("❌ Channel seeding failed:", error);
    process.exit(1);
  }
}

main();
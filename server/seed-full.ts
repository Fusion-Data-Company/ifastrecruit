#!/usr/bin/env tsx
import { db } from "./db";
import { seedDemoData } from "./seedData";

async function main() {
  try {
    console.log("🚀 Starting full database seeding process...");
    console.log("=======================================\n");

    await seedDemoData();

    console.log("\n=======================================");
    console.log("✅ Full database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();
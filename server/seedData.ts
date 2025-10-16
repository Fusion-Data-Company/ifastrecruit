import { db } from "./db";
import { 
  candidates, 
  interviews, 
  bookings, 
  campaigns,
  channels,
  type InsertCandidate,
  type InsertInterview,
  type InsertBooking,
  type InsertCampaign,
  type InsertChannel
} from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDefaultChannels() {
  try {
    console.log("🌱 Seeding default messenger channels...");

    const defaultChannels: InsertChannel[] = [
      {
        name: "all-ifast-recruiting",
        type: "general",
        description: "General announcements and company-wide updates for all iFast brokers"
      },
      {
        name: "non-licensed",
        type: "non_licensed",
        description: "Support and resources for candidates pursuing their insurance license"
      },
      {
        name: "already-licensed",
        type: "fl_licensed",
        description: "Community for Florida-licensed insurance brokers"
      },
      {
        name: "multi-state-license",
        type: "multi_state",
        description: "Advanced strategies and opportunities for multi-state licensed brokers"
      },
      {
        name: "onboarding-doc",
        type: "onboarding",
        description: "Onboarding documentation and getting started resources"
      },
      {
        name: "social",
        type: "social",
        description: "Off-topic conversations and team building"
      }
    ];

    let createdCount = 0;
    let existingCount = 0;

    for (const channelData of defaultChannels) {
      // Check if channel already exists by type
      const [existing] = await db
        .select()
        .from(channels)
        .where(eq(channels.type, channelData.type))
        .limit(1);

      if (!existing) {
        await db.insert(channels).values(channelData);
        createdCount++;
        console.log(`   ✓ Created channel: ${channelData.name} (${channelData.type})`);
      } else {
        existingCount++;
        console.log(`   - Channel already exists: ${existing.name} (${existing.type})`);
      }
    }

    console.log(`✅ Channel seeding completed!`);
    console.log(`   - ${createdCount} new channels created`);
    console.log(`   - ${existingCount} channels already existed`);

  } catch (error) {
    console.error("❌ Error seeding channels:", error);
    throw error;
  }
}

export async function seedDemoData() {
  try {
    console.log("🌱 Seeding demo data...");

    // Seed default channels first
    await seedDefaultChannels();

    // Create minimal campaigns - only ElevenLabs campaign
    const campaignData: InsertCampaign[] = [
      {
        name: "ElevenLabs Interview Pipeline",
        status: "ACTIVE",
        source: "MANUAL"
      }
    ];

    const insertedCampaigns = await db.insert(campaigns).values(campaignData).returning();
    const [campaign1, campaign2] = insertedCampaigns;

    // No fake candidates - only real ElevenLabs candidates should exist
    // Real candidates are added through ElevenLabs automation, not seeding
    const candidateData: InsertCandidate[] = [];

    // Skip seeding fake candidates, interviews, and bookings
    // Real data comes from ElevenLabs automation
    let insertedCandidates: any[] = [];
    
    if (candidateData.length > 0) {
      insertedCandidates = await db.insert(candidates).values(candidateData).returning();
    }

    // No fake interviews or bookings
    const interviewData: InsertInterview[] = [];
    const bookingData: InsertBooking[] = [];

    console.log("✅ Minimal seed data completed!");
    console.log(`   - ${campaignData.length} ElevenLabs campaign created`);
    console.log(`   - No fake candidates seeded - real candidates come from ElevenLabs`);
    console.log(`   - Real data flows through ElevenLabs automation only`);

  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    throw error;
  }
}
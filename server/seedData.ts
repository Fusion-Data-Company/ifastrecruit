import { db } from "./db";
import { 
  candidates, 
  interviews, 
  bookings, 
  campaigns,
  type InsertCandidate,
  type InsertInterview,
  type InsertBooking,
  type InsertCampaign
} from "@shared/schema";

export async function seedDemoData() {
  try {
    console.log("🌱 Seeding demo data...");

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
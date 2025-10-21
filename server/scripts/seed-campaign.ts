import { db } from '../db';
import { campaigns, type InsertCampaign } from '@shared/schema';

async function seedCampaign() {
  console.log("📊 Seeding default campaign...");

  const campaignData: InsertCampaign = {
    name: "ElevenLabs Interview Pipeline",
    status: "ACTIVE",
    source: "MANUAL"
  };

  const [campaign] = await db.insert(campaigns).values(campaignData).returning();
  console.log(`   ✅ Created campaign: ${campaign.name}`);

  process.exit(0);
}

seedCampaign().catch((error) => {
  console.error("❌ Error seeding campaign:", error);
  process.exit(1);
});

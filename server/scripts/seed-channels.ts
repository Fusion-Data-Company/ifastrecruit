import { db } from '../db';
import { channels, type InsertChannel } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function seedChannels() {
  console.log("🌱 Seeding default messenger channels...");

  const defaultChannels: InsertChannel[] = [
    {
      name: "non-licensed",
      tier: "NON_LICENSED",
      description: "Support and resources for candidates pursuing their insurance license",
      badgeIcon: "shield",
      badgeColor: "blue",
      isActive: true
    },
    {
      name: "fl-licensed",
      tier: "FL_LICENSED",
      description: "Community for Florida-licensed insurance brokers",
      badgeIcon: "star",
      badgeColor: "gold",
      isActive: true
    },
    {
      name: "multi-state",
      tier: "MULTI_STATE",
      description: "Advanced strategies and opportunities for multi-state licensed brokers",
      badgeIcon: "globe",
      badgeColor: "purple",
      isActive: true
    }
  ];

  let createdCount = 0;
  let existingCount = 0;

  for (const channelData of defaultChannels) {
    // Check if channel already exists by tier
    const [existing] = await db
      .select()
      .from(channels)
      .where(eq(channels.tier, channelData.tier))
      .limit(1);

    if (!existing) {
      const [newChannel] = await db.insert(channels).values(channelData).returning();
      createdCount++;
      console.log(`   ✓ Created channel: ${channelData.name} (${channelData.tier})`);
    } else {
      existingCount++;
      console.log(`   - Channel already exists: ${existing.name} (${existing.tier})`);
    }
  }

  console.log(`✅ Channel seeding completed!`);
  console.log(`   - ${createdCount} new channels created`);
  console.log(`   - ${existingCount} channels already existed`);

  process.exit(0);
}

seedChannels().catch((error) => {
  console.error("❌ Error seeding channels:", error);
  process.exit(1);
});

import { db } from '../db';
import { users, channels, messages } from '@shared/schema';
import { eq } from 'drizzle-orm';

function getWelcomeMessageForTier(tier: string): string {
  switch(tier) {
    case 'NON_LICENSED':
      return "🎯 Welcome to the Non-Licensed channel! I'm Jason Perez AI, your recruitment mentor. This is your starting point on an exciting journey into insurance sales. Here you'll find resources, support, and guidance to help you get your Florida insurance license. Don't hesitate to ask questions - we're all here to help you succeed!";
    case 'FL_LICENSED':
      return "⭐ Welcome to the FL Licensed channel! Congratulations on getting your Florida insurance license - that's a huge achievement! I'm Jason Perez AI, and I'm here to help you maximize your potential in the Florida market. This channel is where licensed professionals share strategies, discuss opportunities, and support each other's growth. Let's build your success story together!";
    case 'MULTI_STATE':
      return "🌎 Welcome to the Multi-State channel! You're among the elite now - licensed across multiple states with unlimited potential! I'm Jason Perez AI, and this exclusive channel is for advanced strategies, multi-state opportunities, and high-level networking. You've proven your commitment to excellence. Let's discuss how to scale your business across state lines and maximize your earning potential!";
    default:
      return "Welcome! I'm Jason Perez AI, your recruitment mentor. I'm here to help you succeed in your insurance career journey!";
  }
}

async function seedWelcomeMessages() {
  console.log("🤖 Seeding Jason AI welcome messages...");

  // Get Jason AI user
  const [jasonAI] = await db.select().from(users).where(eq(users.email, 'jason@ifastbroker.ai')).limit(1);

  if (!jasonAI) {
    console.error("❌ Jason AI user not found!");
    return;
  }

  console.log("   ✓ Found Jason AI user");

  // Get all channels
  const allChannels = await db.select().from(channels);

  // Add welcome messages to each channel
  for (const channel of allChannels) {
    // Check if welcome message already exists
    const [existingMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.channelId, channel.id))
      .limit(1);

    if (!existingMessage) {
      const welcomeMessage = getWelcomeMessageForTier(channel.tier);
      await db.insert(messages).values({
        channelId: channel.id,
        userId: jasonAI.id,
        content: welcomeMessage,
        formattedContent: `<p>${welcomeMessage}</p>`,
        isAiGenerated: true
      });
      console.log(`   ✓ Added welcome message to ${channel.name}`);
    } else {
      console.log(`   - Welcome message already exists in ${channel.name}`);
    }
  }

  console.log("✅ Welcome messages seeded!");
  process.exit(0);
}

seedWelcomeMessages().catch((error) => {
  console.error("❌ Error seeding welcome messages:", error);
  process.exit(1);
});

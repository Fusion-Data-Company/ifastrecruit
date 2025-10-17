import { db } from "./db";
import { 
  candidates, 
  interviews, 
  bookings, 
  campaigns,
  channels,
  users,
  userChannels,
  messages,
  type InsertCandidate,
  type InsertInterview,
  type InsertBooking,
  type InsertCampaign,
  type InsertChannel,
  type InsertUserChannel,
  type InsertMessage
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export async function seedDefaultChannels() {
  try {
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
    const createdChannels = [];

    for (const channelData of defaultChannels) {
      // Check if channel already exists by tier
      const [existing] = await db
        .select()
        .from(channels)
        .where(eq(channels.tier, channelData.tier))
        .limit(1);

      if (!existing) {
        const [newChannel] = await db.insert(channels).values(channelData).returning();
        createdChannels.push(newChannel);
        createdCount++;
        console.log(`   ✓ Created channel: ${channelData.name} (${channelData.tier})`);
      } else {
        createdChannels.push(existing);
        existingCount++;
        console.log(`   - Channel already exists: ${existing.name} (${existing.tier})`);
      }
    }

    console.log(`✅ Channel seeding completed!`);
    console.log(`   - ${createdCount} new channels created`);
    console.log(`   - ${existingCount} channels already existed`);
    
    return createdChannels;

  } catch (error) {
    console.error("❌ Error seeding channels:", error);
    throw error;
  }
}

async function seedJasonAIMessages(channelList: any[]) {
  try {
    console.log("🤖 Seeding Jason AI welcome messages...");
    
    // Create or find Jason AI user
    let [jasonAI] = await db.select().from(users).where(eq(users.email, 'jason.ai@ifastrecruit.com')).limit(1);
    
    if (!jasonAI) {
      const newJasonData = {
        email: 'jason.ai@ifastrecruit.com',
        firstName: 'Jason',
        lastName: 'Perez AI',
        isAdmin: true,
        hasCompletedOnboarding: true,
        profileImageUrl: '/jason-ai-avatar.png'
      };
      [jasonAI] = await db.insert(users).values(newJasonData).returning();
      console.log("   ✓ Created Jason AI user");
    } else {
      console.log("   - Jason AI user already exists");
    }
    
    // Add welcome messages to each channel
    for (const channel of channelList) {
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
    
    return jasonAI;
  } catch (error) {
    console.error("❌ Error seeding Jason AI messages:", error);
    throw error;
  }
}

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

async function assignAllUsersToChannels(channelList: any[]) {
  try {
    console.log("👥 Assigning users to channels...");
    
    // Get all users
    const allUsers = await db.select().from(users);
    
    for (const user of allUsers) {
      for (const channel of channelList) {
        // Check if user is already assigned
        const [existing] = await db
          .select()
          .from(userChannels)
          .where(and(
            eq(userChannels.userId, user.id),
            eq(userChannels.channelId, channel.id)
          ))
          .limit(1);
        
        if (!existing) {
          // Determine if user should have access based on their licensing
          let canAccess = false;
          
          if (channel.tier === 'NON_LICENSED') {
            canAccess = true; // Everyone can access non-licensed
          } else if (channel.tier === 'FL_LICENSED') {
            canAccess = !!user.hasFloridaLicense || !!user.isMultiStateLicensed || !!user.isAdmin;
          } else if (channel.tier === 'MULTI_STATE') {
            canAccess = !!user.isMultiStateLicensed || !!user.isAdmin;
          }
          
          if (canAccess) {
            await db.insert(userChannels).values({
              userId: user.id,
              channelId: channel.id,
              canAccess: true
            });
            console.log(`   ✓ Added ${user.email} to ${channel.name}`);
          }
        }
      }
    }
    
    console.log("✅ User channel assignments completed!");
  } catch (error) {
    console.error("❌ Error assigning users to channels:", error);
    throw error;
  }
}

export async function seedTestUsers() {
  try {
    console.log("🌱 Seeding test users...");
    
    // Check if test users already exist
    const testEmails = [
      'test-nonlicensed@ifast.recruit',
      'test-florida@ifast.recruit', 
      'test-multistate@ifast.recruit'
    ];
    
    const existingUsers = await db
      .select()
      .from(users)
      .where(sql`${users.email} IN (${sql.join(testEmails.map(e => sql`${e}`), sql`, `)})`);
    
    if (existingUsers.length >= 3) {
      console.log("   ✓ Test users already exist");
      return existingUsers;
    }
    
    // Create test users with different licensing tiers
    const testUserData = [
      {
        id: 'test-user-nonlicensed',
        email: 'test-nonlicensed@ifast.recruit',
        firstName: 'Alice',
        lastName: 'Newbie',
        phone: '555-0101',
        hasFloridaLicense: false,
        isMultiStateLicensed: false,
        licensedStates: [],
        onboardingCompleted: true,
        isAdmin: false,
        onlineStatus: 'offline' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'test-user-florida',
        email: 'test-florida@ifast.recruit',
        firstName: 'Bob',
        lastName: 'Sunshine',
        phone: '555-0102',
        hasFloridaLicense: true,
        isMultiStateLicensed: false,
        licensedStates: ['FL'],
        onboardingCompleted: true,
        isAdmin: false,
        onlineStatus: 'online' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'test-user-multistate',
        email: 'test-multistate@ifast.recruit',
        firstName: 'Carol',
        lastName: 'Elite',
        phone: '555-0103',
        hasFloridaLicense: true,
        isMultiStateLicensed: true,
        licensedStates: ['FL', 'CA', 'TX', 'NY', 'GA'],
        onboardingCompleted: true,
        isAdmin: false,
        onlineStatus: 'online' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    const insertedUsers = await db.insert(users).values(testUserData).returning();
    console.log(`   ✓ Created ${insertedUsers.length} test users`);
    
    return insertedUsers;
  } catch (error) {
    console.error("❌ Error seeding test users:", error);
    throw error;
  }
}

export async function seedDemoData() {
  try {
    console.log("🌱 Seeding demo data...");

    // Seed default channels first
    const channelList = await seedDefaultChannels();
    
    // Seed Jason AI and welcome messages
    await seedJasonAIMessages(channelList);
    
    // Seed test users with different licensing tiers
    await seedTestUsers();
    
    // Assign all existing users to appropriate channels
    await assignAllUsersToChannels(channelList);

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
    console.log(`   - Test users created with different licensing tiers`);
    console.log(`   - Users assigned to appropriate channels based on licensing`);
    console.log(`   - Real data flows through ElevenLabs automation only`);

  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    throw error;
  }
}
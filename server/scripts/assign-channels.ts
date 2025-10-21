import { db } from '../db';
import { users, channels, channelMembers, userChannels } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

async function assignChannels() {
  console.log('👥 Starting channel assignments...');

  // Get Jason AI user
  const [jasonUser] = await db.select().from(users).where(eq(users.email, 'jason@ifastbroker.ai')).limit(1);

  if (!jasonUser) {
    console.error('❌ Jason AI user not found!');
    return;
  }

  console.log(`✅ Found Jason AI: ${jasonUser.id}`);

  // Get all channels
  const allChannels = await db.select().from(channels);
  console.log(`📢 Found ${allChannels.length} channels`);

  // Add Jason to all channels as MEMBER
  for (const channel of allChannels) {
    try {
      // Check if already a member
      const [existing] = await db
        .select()
        .from(channelMembers)
        .where(and(
          eq(channelMembers.channelId, channel.id),
          eq(channelMembers.userId, jasonUser.id)
        ))
        .limit(1);

      if (!existing) {
        await db.insert(channelMembers).values({
          channelId: channel.id,
          userId: jasonUser.id,
          role: 'MEMBER',
        });
        console.log(`   ✅ Added Jason to channel: ${channel.name}`);
      } else {
        console.log(`   - Jason already in: ${channel.name}`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  Skipped channel ${channel.name}: ${error.message}`);
    }
  }

  // Update Jason's aiConfig with all channel IDs
  await db
    .update(users)
    .set({
      aiConfig: {
        model: 'anthropic/claude-3.5-sonnet',
        temperature: 0.8,
        maxTokens: 800,
        isActive: true,
        autoRespondChannels: allChannels.map(c => c.id),
        autoRespondDMs: true,
      },
    })
    .where(eq(users.id, jasonUser.id));

  console.log('✅ Updated Jason AI config with channel IDs');

  // Now assign all users to appropriate channels
  const allUsers = await db.select().from(users);
  console.log(`👥 Assigning ${allUsers.length} users to channels...`);

  for (const user of allUsers) {
    for (const channel of allChannels) {
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

  console.log('✅ Channel assignments completed!');
  process.exit(0);
}

assignChannels().catch((error) => {
  console.error('❌ Channel assignment failed:', error);
  process.exit(1);
});

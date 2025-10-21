/**
 * Migration: Add Jason AI User
 *
 * Creates the Jason AI system user and adds him to all channels
 */

import { db } from '../index';
import { users, channels, channelMembers } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function up() {
  console.log('🚀 Starting Jason AI user migration...');

  // Check if Jason already exists
  const existingJason = await db
    .select()
    .from(users)
    .where(eq(users.email, 'jason@ifastbroker.ai'))
    .limit(1);

  if (existingJason.length > 0) {
    console.log('✅ Jason AI user already exists, skipping creation');
    console.log(`   Jason User ID: ${existingJason[0].id}`);
    console.log(`   Add this to your .env: JASON_USER_ID=${existingJason[0].id}`);
    return;
  }

  // Create Jason AI user
  const [jasonUser] = await db.insert(users).values({
    email: 'jason@ifastbroker.ai',
    firstName: 'Jason',
    lastName: 'AI Assistant',
    profileImageUrl: '/avatars/jason-ai.png',
    isAdmin: true, // Jason has admin privileges
    isAIAgent: true, // Mark as AI
    aiConfig: {
      model: 'anthropic/claude-3.5-sonnet',
      temperature: 0.8,
      maxTokens: 800,
      isActive: true,
      autoRespondChannels: [], // Will populate with all channel IDs
      autoRespondDMs: true, // Respond to all DMs
    },
    hasCompletedOnboarding: true,
    onlineStatus: 'online', // Always online
  }).returning();

  console.log('✅ Jason AI user created:', jasonUser.id);

  // Get all existing channels
  const allChannels = await db.select().from(channels);

  console.log(`📢 Adding Jason to ${allChannels.length} channels...`);

  // Add Jason to all channels as MEMBER
  for (const channel of allChannels) {
    try {
      await db.insert(channelMembers).values({
        channelId: channel.id,
        userId: jasonUser.id,
        role: 'MEMBER', // Not admin of channels, just member
      });
      console.log(`   ✅ Added to channel: ${channel.name}`);
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

  console.log('✅ Jason AI migration complete!');
  console.log(`\n📝 IMPORTANT: Add this to your .env file:`);
  console.log(`   JASON_USER_ID=${jasonUser.id}\n`);
}

export async function down() {
  console.log('⏮️ Rolling back Jason AI user migration...');

  const jasonUser = await db
    .select()
    .from(users)
    .where(eq(users.email, 'jason@ifastbroker.ai'))
    .limit(1);

  if (jasonUser.length === 0) {
    console.log('✅ Jason AI user doesn\'t exist, nothing to rollback');
    return;
  }

  const jasonId = jasonUser[0].id;

  // Remove Jason from all channels
  await db
    .delete(channelMembers)
    .where(eq(channelMembers.userId, jasonId));

  // Delete Jason user
  await db
    .delete(users)
    .where(eq(users.id, jasonId));

  console.log('✅ Jason AI user removed');
}

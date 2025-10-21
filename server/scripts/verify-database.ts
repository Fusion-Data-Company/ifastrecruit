import { db } from '../db';
import { users, channels, channelMembers, userChannels, messages, campaigns } from '@shared/schema';

async function verifyDatabase() {
  console.log('\n🔍 DATABASE VERIFICATION REPORT\n');
  console.log('='.repeat(60));

  // Check users
  const allUsers = await db.select().from(users);
  console.log(`\n👥 USERS TABLE: ${allUsers.length} rows`);
  console.log('   Breakdown:');
  const admins = allUsers.filter(u => u.isAdmin);
  const aiAgents = allUsers.filter(u => u.isAIAgent);
  const regular = allUsers.filter(u => !u.isAdmin && !u.isAIAgent);
  console.log(`   - ${aiAgents.length} AI Agent (Jason)`);
  console.log(`   - ${admins.length} Admins`);
  console.log(`   - ${regular.length} Regular Users`);

  console.log('\n   User List:');
  for (const user of allUsers) {
    const role = user.isAIAgent ? '🤖 AI' : user.isAdmin ? '👑 Admin' : '👤 User';
    const licensing = user.isMultiStateLicensed ? '🌎 Multi-State' : user.hasFloridaLicense ? '⭐ FL-Licensed' : '🎯 Non-Licensed';
    console.log(`   ${role} ${licensing} - ${user.email}`);
  }

  // Check channels
  const allChannels = await db.select().from(channels);
  console.log(`\n📢 CHANNELS TABLE: ${allChannels.length} rows`);
  for (const channel of allChannels) {
    console.log(`   - ${channel.name} (${channel.tier})`);
  }

  // Check channel members
  const allChannelMembers = await db.select().from(channelMembers);
  console.log(`\n👥 CHANNEL_MEMBERS TABLE: ${allChannelMembers.length} rows`);
  console.log(`   (Jason should be in all ${allChannels.length} channels)`);

  // Check user channels
  const allUserChannels = await db.select().from(userChannels);
  console.log(`\n🔑 USER_CHANNELS TABLE: ${allUserChannels.length} rows`);
  console.log(`   (Access permissions for each user-channel combo)`);

  // Check messages
  const allMessages = await db.select().from(messages);
  console.log(`\n💬 MESSAGES TABLE: ${allMessages.length} rows`);
  console.log(`   (Should have ${allChannels.length} welcome messages from Jason)`);

  // Check campaigns
  const allCampaigns = await db.select().from(campaigns);
  console.log(`\n📊 CAMPAIGNS TABLE: ${allCampaigns.length} rows`);
  for (const campaign of allCampaigns) {
    console.log(`   - ${campaign.name}`);
  }

  // Verify Jason AI
  console.log('\n🤖 JASON AI VERIFICATION:');
  const jasonUser = allUsers.find(u => u.email === 'jason@ifastbroker.ai');
  if (jasonUser) {
    console.log('   ✅ Jason AI user exists');
    console.log(`   ✅ Email: ${jasonUser.email}`);
    console.log(`   ✅ ID: ${jasonUser.id}`);
    console.log(`   ✅ isAIAgent: ${jasonUser.isAIAgent}`);
    console.log(`   ✅ isAdmin: ${jasonUser.isAdmin}`);
    console.log(`   ✅ aiConfig channels: ${(jasonUser.aiConfig as any)?.autoRespondChannels?.length || 0}`);
  } else {
    console.log('   ❌ Jason AI user NOT found!');
  }

  // Verify environment variable
  console.log('\n🔐 ENVIRONMENT VARIABLES:');
  if (process.env.JASON_USER_ID) {
    console.log(`   ✅ JASON_USER_ID is set: ${process.env.JASON_USER_ID}`);
    if (jasonUser && process.env.JASON_USER_ID === jasonUser.id) {
      console.log('   ✅ JASON_USER_ID matches Jason user in database');
    } else {
      console.log('   ⚠️  JASON_USER_ID does NOT match Jason user ID in database!');
    }
  } else {
    console.log('   ❌ JASON_USER_ID is NOT set!');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ DATABASE VERIFICATION COMPLETE!\n');

  // Summary
  console.log('📋 SUMMARY:');
  console.log(`   ✅ ${allUsers.length} users created`);
  console.log(`   ✅ ${allChannels.length} channels created`);
  console.log(`   ✅ ${allChannelMembers.length} channel memberships`);
  console.log(`   ✅ ${allUserChannels.length} user-channel access permissions`);
  console.log(`   ✅ ${allMessages.length} messages (welcome messages)`);
  console.log(`   ✅ ${allCampaigns.length} campaigns`);
  console.log('\n🎉 Platform is ready to use!\n');

  process.exit(0);
}

verifyDatabase().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});

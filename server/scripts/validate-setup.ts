/**
 * Validate entire system setup
 * Run: npm run validate
 */

import { db } from '../db';
import { users, channels } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { openrouterIntegration } from '../integrations/openrouter';

async function validateSetup() {
  console.log('🔍 Validating iFast Broker Setup...\n');

  let allPassed = true;

  // 1. Check environment variables
  console.log('1️⃣ Checking environment variables...');
  const requiredEnvVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'OPENROUTER_API_KEY',
  ];

  const optionalEnvVars = ['JASON_USER_ID'];

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`  ✅ ${envVar} is set`);
    } else {
      console.log(`  ❌ ${envVar} is MISSING`);
      allPassed = false;
    }
  }

  for (const envVar of optionalEnvVars) {
    if (process.env[envVar]) {
      console.log(`  ✅ ${envVar} is set`);
    } else {
      console.log(`  ⚠️  ${envVar} not set (will be set after migration)`);
    }
  }
  console.log();

  // 2. Check database connection
  console.log('2️⃣ Checking database connection...');
  try {
    const userCount = await db.select().from(users);
    console.log(`  ✅ Database connected (${userCount.length} users)`);
  } catch (error: any) {
    console.log(`  ❌ Database connection failed:`, error.message);
    allPassed = false;
  }
  console.log();

  // 3. Check Jason AI user exists
  console.log('3️⃣ Checking Jason AI user...');
  try {
    const jasonUser = await db
      .select()
      .from(users)
      .where(eq(users.email, 'jason@ifastbroker.ai'))
      .limit(1);

    if (jasonUser.length > 0) {
      console.log(`  ✅ Jason AI user exists (ID: ${jasonUser[0].id})`);

      if (jasonUser[0].isAIAgent) {
        console.log(`  ✅ Jason marked as AI agent`);
      } else {
        console.log(`  ⚠️  Jason exists but not marked as AI agent`);
      }
    } else {
      console.log(`  ⚠️  Jason AI user not found`);
      console.log(`     This is normal before running Phase 1 migration`);
      console.log(`     Run: npm run db:push after Phase 1 files are created`);
    }
  } catch (error: any) {
    console.log(`  ❌ Error checking Jason user:`, error.message);
    allPassed = false;
  }
  console.log();

  // 4. Check channels exist
  console.log('4️⃣ Checking messenger channels...');
  try {
    const channelList = await db.select().from(channels);
    console.log(`  ✅ ${channelList.length} channels exist`);

    const requiredChannels = ['general', 'florida-licensed', 'multi-state'];
    for (const channelName of requiredChannels) {
      const exists = channelList.some(c => c.name === channelName);
      if (exists) {
        console.log(`  ✅ ${channelName} channel exists`);
      } else {
        console.log(`  ⚠️  ${channelName} channel missing (should be in seed data)`);
      }
    }
  } catch (error: any) {
    console.log(`  ❌ Error checking channels:`, error.message);
    allPassed = false;
  }
  console.log();

  // 5. Test OpenRouter API
  console.log('5️⃣ Testing OpenRouter API...');
  try {
    const response = await openrouterIntegration.chat(
      'Respond with exactly: "API working"',
      'fast'
    );

    if (response.content) {
      console.log(`  ✅ OpenRouter API working`);
      console.log(`  Response: "${response.content.substring(0, 50)}..."`);
    } else {
      console.log(`  ⚠️  OpenRouter responded but no content`);
    }
  } catch (error: any) {
    console.log(`  ❌ OpenRouter API failed:`, error.message);
    allPassed = false;
  }
  console.log();

  // Final summary
  console.log('═'.repeat(50));
  if (allPassed) {
    console.log('✅ ALL CRITICAL CHECKS PASSED! System is ready.\n');
    return true;
  } else {
    console.log('⚠️  SOME CHECKS FAILED. Please fix critical issues above.\n');
    return false;
  }
}

validateSetup()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

/**
 * Test script to verify OpenRouter API connectivity
 * Run: npm run test:openrouter
 */

import { openrouterIntegration } from '../integrations/openrouter';

async function testOpenRouter() {
  console.log('🧪 Testing OpenRouter API Connection...\n');

  try {
    // Test 1: Check API key exists
    console.log('✓ Checking API key...');
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('❌ OPENROUTER_API_KEY not found in environment');
    }
    console.log('  ✅ API key found\n');

    // Test 2: Simple chat completion
    console.log('✓ Testing chat completion...');
    const response = await openrouterIntegration.chat(
      'Hello! Please respond with "OpenRouter is working correctly."',
      'fast' // Use fast model for testing
    );

    console.log('  ✅ Response received:');
    console.log(`  "${response.content}"\n`);

    // Test 3: Check model access
    console.log('✓ Testing orchestrator model (Claude 3.5 Sonnet)...');
    const orchestratorResponse = await openrouterIntegration.chat(
      'Say "Orchestrator model working"',
      'orchestrator'
    );
    console.log('  ✅ Orchestrator response:');
    console.log(`  "${orchestratorResponse.content}"\n`);

    console.log('🎉 All tests passed! OpenRouter is configured correctly.\n');
    return true;

  } catch (error: any) {
    console.error('\n❌ OpenRouter test failed:');
    console.error(error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check your API key is correct in .env');
    console.error('2. Verify you have credits in your OpenRouter account');
    console.error('3. Visit https://openrouter.ai/keys to manage your keys');
    console.error('4. Check https://openrouter.ai/docs for any service issues\n');
    return false;
  }
}

testOpenRouter()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

import { db } from '../db';
import { sql } from 'drizzle-orm';

async function checkConnection() {
  console.log('\n🔌 DATABASE CONNECTION CHECK\n');
  console.log('='.repeat(60));

  try {
    // Get database info
    const result = await db.execute(sql`
      SELECT
        current_database() as database_name,
        current_user as user_name,
        version() as db_version
    `);

    console.log('\n✅ Database Connection: SUCCESSFUL\n');
    console.log('Database Details:');
    console.log(`   Name: ${result.rows[0].database_name}`);
    console.log(`   User: ${result.rows[0].user_name}`);
    console.log(`   Version: ${result.rows[0].db_version.split(',')[0]}`);

    // List all tables with row counts
    console.log('\n📊 Table Row Counts:\n');

    const tables = [
      'users',
      'channels',
      'channel_members',
      'user_channels',
      'messages',
      'direct_messages',
      'campaigns',
      'candidates',
      'interviews',
      'bookings',
      'sessions'
    ];

    for (const table of tables) {
      try {
        const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
        const count = countResult.rows[0].count;
        console.log(`   ${table.padEnd(20)} ${count} rows`);
      } catch (error: any) {
        console.log(`   ${table.padEnd(20)} ERROR: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ DATABASE IS CONNECTED AND HAS DATA!\n');

  } catch (error) {
    console.error('\n❌ Database Connection FAILED:', error);
    console.error('\nCheck your DATABASE_URL environment variable.\n');
  }

  process.exit(0);
}

checkConnection();

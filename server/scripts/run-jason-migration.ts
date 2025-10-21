import { up } from '../db/migrations/006_add_jason_ai_user';

async function runMigration() {
  try {
    await up();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

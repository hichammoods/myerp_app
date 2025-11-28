import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://myerp:myerp_password@localhost:5432/myerp_db'
});

async function runMigration() {
  const client = await pool.connect();
  try {
    const migrationPath = path.join(__dirname, 'migrations', '025_create_notifications_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration: 025_create_notifications_table.sql');
    console.log('Creating notifications table...');

    await client.query(sql);

    console.log('✅ Migration 025 completed successfully!');

    // Verify the table exists
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'notifications'
    `);

    if (result.rows.length > 0) {
      console.log('Verified: notifications table exists');
    }

  } catch (error) {
    console.error('❌ Migration 025 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);

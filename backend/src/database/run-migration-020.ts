import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://myerp:myerp_password@localhost:5432/myerp_db'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '020_add_down_payment_to_sales_orders.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running migration: 020_add_down_payment_to_sales_orders.sql');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

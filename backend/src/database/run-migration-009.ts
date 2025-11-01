import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runMigration() {
  // Use DATABASE_URL from environment
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Starting migration 009: Product customization...');
    console.log('Database:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@'));

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '009_add_product_customization.sql'),
      'utf8'
    );

    await pool.query(migrationSQL);

    console.log('✅ Migration 009 completed successfully!');
    console.log('Created:');
    console.log('  - quotation_line_components table');
    console.log('  - customization fields in quotation_lines');
    console.log('  - upcharge_percentage fields in materials and finishes');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

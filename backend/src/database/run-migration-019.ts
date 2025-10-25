import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'myerp',
  user: process.env.DB_USER || 'myerp_user',
  password: process.env.DB_PASSWORD || 'myerp_password',
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('Starting migration 019: Fix products stock_quantity to DECIMAL...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '019_fix_products_stock_quantity_decimal.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('COMMIT');

    console.log('✅ Migration 019 completed successfully!');
    console.log('Updated stock_quantity, min_stock_level, and max_stock_level columns to DECIMAL(10,2) in products table');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);

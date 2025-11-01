import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'myerp_db',
  user: process.env.DB_USER || 'myerp',
  password: process.env.DB_PASSWORD || 'myerp_password',
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('Starting migration 022: Add customization to sales_order_items...');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '022_add_customization_to_sales_order_items.sql'),
      'utf8'
    );

    await client.query(migrationSQL);

    console.log('✅ Migration 022 completed successfully!');
    console.log('✓ Added is_customized, base_product_id, custom_components to sales_order_items');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

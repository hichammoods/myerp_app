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
    const migrationPath = path.join(__dirname, 'migrations', '023_add_payments_jsonb_to_sales_orders.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration: 023_add_payments_jsonb_to_sales_orders.sql');
    console.log('Adding payments JSONB column to sales_orders...');

    await client.query(sql);

    console.log('Migration completed successfully!');

    // Verify the column exists
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'sales_orders' AND column_name = 'payments'
    `);

    if (result.rows.length > 0) {
      console.log('Verified: payments column exists with type', result.rows[0].data_type);
    }

    // Count migrated records
    const countResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN jsonb_array_length(payments) > 0 THEN 1 END) as with_payments
      FROM sales_orders
    `);
    console.log(`Total orders: ${countResult.rows[0].total}`);
    console.log(`Orders with payments migrated: ${countResult.rows[0].with_payments}`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);

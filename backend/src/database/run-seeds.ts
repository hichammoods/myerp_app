/**
 * Database Seeding Script
 * Run this after migrations to populate initial data
 *
 * Usage: npm run seed
 * Or: ts-node src/database/run-seeds.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://myerp:myerp_password@localhost:5432/myerp_db';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

interface SeedFile {
  filename: string;
  path: string;
  order: number;
}

async function runSeeds() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Get all seed files
    const seedsDir = path.join(__dirname, 'seeds');

    if (!fs.existsSync(seedsDir)) {
      console.log('❌ Seeds directory not found');
      process.exit(1);
    }

    const files = fs.readdirSync(seedsDir)
      .filter(file => file.endsWith('.sql'))
      .map(filename => {
        const match = filename.match(/^(\d+)_/);
        const order = match ? parseInt(match[1]) : 999;
        return {
          filename,
          path: path.join(seedsDir, filename),
          order
        };
      })
      .sort((a, b) => a.order - b.order);

    if (files.length === 0) {
      console.log('⚠️  No seed files found');
      return;
    }

    console.log(`Found ${files.length} seed file(s):\n`);
    files.forEach(file => {
      console.log(`  - ${file.filename}`);
    });
    console.log('');

    // Run each seed file
    for (const file of files) {
      await runSeedFile(file);
    }

    console.log('\n✅ All seeds completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  ✓ Materials and finishes loaded');
    console.log('  ✓ Admin user created');
    console.log('\n🔐 Default Admin Credentials:');
    console.log('  Email: admin@myerp.com');
    console.log('  Password: Admin@123456');
    console.log('\n⚠️  IMPORTANT: Change the admin password immediately!\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function runSeedFile(file: SeedFile) {
  console.log(`\n📄 Running: ${file.filename}`);

  try {
    const sql = fs.readFileSync(file.path, 'utf8');
    await pool.query(sql);
    console.log(`   ✓ Success`);
  } catch (error: any) {
    // Check if error is due to conflict (ON CONFLICT DO NOTHING)
    if (error.message && error.message.includes('duplicate key')) {
      console.log(`   ⚠️  Skipped (data already exists)`);
    } else {
      console.error(`   ✗ Error: ${error.message}`);
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  runSeeds().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runSeeds };

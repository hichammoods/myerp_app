import { Router, Request, Response } from 'express';

const router = Router();

// Ultra simple test - no database
router.get('/ping', (req: Request, res: Response) => {
  console.log('PING endpoint hit');
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

// Test with timeout to see if async is the issue
router.get('/test-async', async (req: Request, res: Response) => {
  console.log('TEST-ASYNC endpoint hit');
  try {
    // Just a simple timeout, no database
    await new Promise(resolve => setTimeout(resolve, 100));
    res.json({ message: 'async works', timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Error in test-async:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test database with minimal complexity
router.get('/test-db-minimal', async (req: Request, res: Response) => {
  console.log('TEST-DB-MINIMAL endpoint hit');
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://myerp:myerp_password@localhost:5432/myerp_db'
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected to database');

    const result = await client.query('SELECT 1 as num');
    console.log('Query result:', result.rows[0]);

    await client.end();
    console.log('Connection closed');

    res.json({ success: true, result: result.rows[0] });
  } catch (error: any) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
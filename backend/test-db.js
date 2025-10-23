const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    connectionString: 'postgresql://myerp:myerp123@localhost:5432/myerp_db'
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    const result = await client.query('SELECT COUNT(*) as count FROM categories');
    console.log('Categories count:', result.rows[0].count);

    await client.end();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

testConnection();
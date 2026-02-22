const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'kreativ_user',
    password: process.env.POSTGRES_PASSWORD,
    database: 'kreativ_edu'
  });
  
  await client.connect();
  const res = await client.query('SELECT "executionData" FROM execution_entity ORDER BY id DESC LIMIT 1');
  console.log(JSON.stringify(res.rows[0], null, 2));
  await client.end();
}

run();

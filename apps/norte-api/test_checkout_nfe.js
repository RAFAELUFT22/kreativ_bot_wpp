require('dotenv').config({ path: '../../.env' });
const { Pool } = require('pg');
const BlingService = require('./src/services/bling');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'kreativ_user',
  password: process.env.POSTGRES_PASSWORD,
  database: 'norte_piscinas_db'
});

async function run() {
  const bling = new BlingService(pool);
  
  const customer = {
    id: 9999,
    name: 'Escola Modelo Ltda',
    document: '12345678000199',
    document_type: 'J',
    ie: 'Isento',
    phone: '31999999999',
    email: 'compras@escolamodelo.com.br',
    address_street: 'Rua das Flores',
    address_number: '123',
    address_complement: 'Sala 4',
    address_neighborhood: 'Centro',
    address_city: 'Belo Horizonte',
    address_state: 'MG',
    address_zip: '30120000'
  };

  try {
    console.log('Sending Customer B2B payload to Bling...');
    const res = await bling.findOrCreateContact(customer);
    console.log('Contact created/found in Bling:', res);
  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    await pool.end();
  }
}
run();

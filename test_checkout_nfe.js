const { Pool } = require('pg');
const BlingService = require('./apps/norte-api/src/services/bling');

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
    id: 9999, // Fake local DB ID
    name: 'Escola Modelo Ltda',
    document: '12345678000199', // CNPJ Válido
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
    // A API real faria a inserção no banco e em seguida mandava no .createOrder
    // createOrder invoca o findOrCreateContact
    const res = await bling.findOrCreateContact(customer);
    console.log('Contact created/found in Bling:', res);
  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    await pool.end();
  }
}
run();

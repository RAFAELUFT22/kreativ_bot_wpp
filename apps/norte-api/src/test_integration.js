require('dotenv').config({ path: '/root/ideias_app/.env' });
process.env.MINIO_ENDPOINT = 's3.extensionista.site';
process.env.DB_HOST = 'localhost';

const { Pool } = require('pg');
const chatwootService = require('./services/chatwoot');
const BlingService = require('./services/bling');

async function testIntegration() {
    console.log('--- Starting Integration Test ---');

    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'norte_piscinas_db',
        user: process.env.DB_USER || 'kreativ_user',
        password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
    });

    try {
        console.log('1. Testing Chatwoot Notification...');
        const mockOrder = {
            order_number: 'TEST-' + Date.now(),
            customer_name: 'Cliente Teste Integracao',
            customer_email: 'teste@exemplo.com',
            customer_phone: '63999999999',
            total: 150.00,
            status: 'payment_confirmed'
        };

        await chatwootService.notifyNewOrder(mockOrder);
        console.log('Chatwoot notification attempt finished.');

        console.log('\n2. Testing Bling Order Creation (Dry check)...');
        // We will just fetch a real order from DB and attempt to run the createOrder logic,
        // or just rely on the API. Let's send a fake order to see if it reaches Bling.
        const bling = new BlingService(pool);

        try {
            await bling.getAccessToken();
            console.log('Bling Token is valid.');
        } catch (e) {
            console.log('Bling Token invalid/expired. Cannot test order creation. Error:', e.message);
        }

        console.log('\n--- Test Completed ---');
    } catch (err) {
        console.error('\n--- Test Failed! ---');
        console.error(err);
    } finally {
        await pool.end();
    }
}

testIntegration();

require('dotenv').config({ path: '/root/ideias_app/.env' });
process.env.MINIO_ENDPOINT = 's3.extensionista.site';
process.env.DB_HOST = 'localhost';

const BlingService = require('./services/bling');
const { Pool } = require('pg');

async function testPDV() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'norte_piscinas_db',
        user: process.env.DB_USER || 'kreativ_user',
        password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
    });

    const bling = new BlingService(pool);
    try {
        console.log('Fetching first page of products...');
        const list = await bling.listProducts(1);
        if (list.data && list.data.length > 0) {
            const firstProductId = list.data[0].id;
            console.log(`\nFetching details for product ID: ${firstProductId}`);
            const detail = await bling.getProductDetail(firstProductId);
            console.log(JSON.stringify(detail, null, 2));
        } else {
            console.log('No products found or error:', list);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

testPDV();

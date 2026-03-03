// apps/norte-api/scripts/syncImagesToBling.js
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const minioClient = require('../src/services/minioClient');
const BlingService = require('../src/services/bling');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'norte_piscinas_db',
    user: process.env.DB_USER || 'norte_db_user',
    password: process.env.DB_PASSWORD || 'norte_pass_9231',
});

const bling = new BlingService(pool);

async function syncImages() {
    console.log('Fetching MinIO objects...');
    const objects = [];
    const stream = minioClient.client.listObjects(minioClient.bucket, '', true);

    await new Promise((resolve, reject) => {
        stream.on('data', obj => objects.push(obj.name));
        stream.on('end', resolve);
        stream.on('error', reject);
    });

    console.log(`Found ${objects.length} objects in MinIO bucket ${minioClient.bucket}`);

    console.log('Fetching products from local DB...');
    const result = await pool.query('SELECT id, bling_id, sku, name FROM products WHERE bling_id IS NOT NULL');
    const products = result.rows;

    console.log(`Found ${products.length} products to map.`);

    let matchCount = 0;
    let pushCount = 0;

    for (const p of products) {
        // Simple mapping: check if any MinIO object name is included in the product SKU or Name
        // In a real scenario, this might need more robust NLP or manual mapping.
        // For now, let's look for exact SKU matches or partial name matches in the filename.

        let matchedObject = objects.find(obj => {
            const normalizedObj = obj.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedSku = p.sku.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');

            return normalizedObj.includes(normalizedSku) ||
                normalizedObj.includes(normalizedName.substring(0, 10)) || // Match first 10 chars of name
                normalizedName.includes(normalizedObj.substring(0, 10)); // Or vice versa
        });

        if (matchedObject) {
            matchCount++;
            const publicUrl = `${process.env.MINIO_PUBLIC_URL || `https://${process.env.MINIO_ENDPOINT}`}/${matchedObject}`;
            console.log(`Matched ${p.sku} / ${p.name} -> ${matchedObject}`);

            try {
                // Get current product details from Bling to preserve other fields
                const detail = await bling.getProductDetail(p.bling_id);
                if (detail && detail.data) {
                    const prod = detail.data;

                    // Update the image
                    prod.midia = prod.midia || {};
                    prod.midia.imagens = prod.midia.imagens || {};
                    prod.midia.imagens.externas = [{ link: publicUrl }];

                    // We only want to send essential fields to avoid overwriting stuff unintentionally
                    const updatePayload = {
                        nome: prod.nome,
                        codigo: prod.codigo,
                        preco: prod.preco,
                        situacao: prod.situacao,
                        formato: prod.formato,
                        tipo: prod.tipo,
                        midia: prod.midia
                    };

                    console.log(`  Updating Bling product ${p.bling_id}...`);
                    await bling.apiRequest('PUT', `/produtos/${p.bling_id}`, updatePayload);
                    pushCount++;

                    // Small delay to respect rate limits
                    await new Promise(r => setTimeout(r, 500));
                }
            } catch (err) {
                console.error(`  Failed to update Bling for ${p.sku}:`, err.message);
            }
        }
    }

    console.log('--- Sync Summary ---');
    console.log(`Total Products: ${products.length}`);
    console.log(`Matched MinIO Images: ${matchCount}`);
    console.log(`Successfully Push to Bling: ${pushCount}`);

    // Finally trigger a full sync to ensure local DB has the latest from Bling
    console.log('Triggering local DB sync from Bling...');
    await bling.syncProducts();

    console.log('Done!');
    process.exit(0);
}

syncImages().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});

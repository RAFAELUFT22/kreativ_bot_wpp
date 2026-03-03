// apps/norte-api/scripts/uploadLabelsToMinio.js
require('dotenv').config({ path: __dirname + '/../../../.env' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const minioClient = require('../src/services/minioClient');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'norte_piscinas_db',
    user: process.env.DB_USER || 'norte_db_user',
    password: process.env.DB_PASSWORD || 'norte_pass_9231',
});

const ROTULOS_DIR = '/NORTE_PISCINAS/rotulos/Verso Produtos - Agencia Sinais - Desatualizado ';

async function processLabels() {
    console.log('Scanning for labels...');

    if (!fs.existsSync(ROTULOS_DIR)) {
        console.error(`Directory not found: ${ROTULOS_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(ROTULOS_DIR);
    const labels = files.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.pdf'].includes(ext);
    });

    console.log(`Found ${labels.length} label files.`);

    // Get products to match
    const res = await pool.query('SELECT id, sku, name FROM products');
    const products = res.rows;
    console.log(`Matching against ${products.length} products.`);

    let matchCount = 0;

    for (const labelFile of labels) {
        const filePath = path.join(ROTULOS_DIR, labelFile);
        const labelLower = labelFile.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Try to find a matching product
        const match = products.find(p => {
            const cleanLabel = labelLower
                .replace('verso', '')
                .replace('verso', '') // repeat just in case
                .replace(/^[0-9]+[a-z]?_/, '') // Remove prefix like 9230A_
                .replace(/_[0-9]+[k]?[g]?/, '') // Remove volume like _10kg
                .replace(/[^a-z]/g, '');

            const cleanName = p.name.toLowerCase()
                .replace(/[0-9]+[k]?[g]?/g, '')
                .replace(/[0-9]+[l]/g, '')
                .replace(/[^a-z]/g, '');

            const cleanSku = p.sku.toLowerCase().replace(/[^a-z0-9]/g, '');

            return cleanLabel.includes(cleanName) || cleanName.includes(cleanLabel) ||
                cleanLabel.includes(cleanSku) || cleanSku.includes(cleanLabel);
        });

        if (match) {
            console.log(`MATCH: ${labelFile} -> ${match.name} (${match.sku})`);
            try {
                const buffer = fs.readFileSync(filePath);
                // Clean filename for S3
                const safeName = `rotulos/${labelFile.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
                const publicUrl = await minioClient.uploadFile(buffer, safeName);

                await pool.query('UPDATE products SET label_url = $1 WHERE id = $2', [publicUrl, match.id]);
                console.log(`  Uploaded and linked: ${publicUrl}`);
                matchCount++;
            } catch (err) {
                console.error(`  Error processing ${labelFile}:`, err.message);
            }
        } else {
            console.log(`NO MATCH for: ${labelFile}`);
        }
    }

    console.log('--- Summary ---');
    console.log(`Total labels processed: ${labels.length}`);
    console.log(`Linked to products: ${matchCount}`);

    process.exit(0);
}

processLabels().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});

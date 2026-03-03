const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

const pool = new Pool({
    host: 'localhost',
    user: 'kreativ_user',
    password: process.env.POSTGRES_PASSWORD,
    database: 'norte_piscinas_db'
});

const CSV_FILE = '/NORTE_PISCINAS/produtos_2026-02-24-23-59-11.csv';

// Manual Price Overrides from Sales PDF Analysis (last 7 days)
const PDF_PRICE_MAP = {
    "10KG Cloro Hidroazul Multiação": 188.00,
    "Cloro Faz 4x1 Multiação 2.5kg": 80.00,
    "2.5KG Cloro Hidroazul Multiação": 100.00,
    "Sulfato de Alumínio Hidroazul 2KG": 19.00,
    "Barrilha Leve Hidroazul 2KG": 32.00,
    "Bicarbonado/Elevador de Alcalinidade Hidroazul 2KG": 26.00,
    "Clarificante FlocPlus 2 em 1 Hidroazul 1L": 19.00,
    "Algicida de Manutenção Hidroazul 1L": 19.00,
    "Algicida de Choque Hidroazul 1L": 32.00,
    "Limpa Bordas Concentrado Hidroazul 1L": 22.00,
    "Peneira Metálica( J. REIS)": 35.00,
    "Algicida Multiação Hidroazul 1L": 30.00 // from CSV but checked against PDF logic
};

async function importCatalog() {
    console.log(`Starting to read ${CSV_FILE}...`);

    let updateCount = 0;
    let newCount = 0;
    let rowCount = 0;

    const stream = fs.createReadStream(CSV_FILE)
        .pipe(csv({
            separator: ';',
            mapHeaders: ({ header }) => header.replace(/^\ufeff/, '').replace(/"/g, '').trim()
        }));

    for await (const row of stream) {
        rowCount++;

        let originalCode = row['Código'] ? row['Código'].trim() : null;
        if (!originalCode || originalCode === '') {
            originalCode = row['ID']; // Fallback to ID if Code is missing
        }
        if (!originalCode) continue;

        const name = (row['Descrição'] || '').replace(/"/g, '').trim();
        let rawDescription = row['Descrição do Produto no Fornecedor'] || row['Descrição Complementar'] || '';
        const urlArray = row['URL Imagens Externas'] ? row['URL Imagens Externas'].replace(/"/g, '').split('|') : [];
        const imageUrl = urlArray.length > 0 ? urlArray[0].trim() : null;

        // Handle weight
        let weightStr = row['Peso líquido (Kg)'] || '0';
        weightStr = weightStr.replace(',', '.');
        const weightKg = parseFloat(weightStr) || 0;

        const category = row['Categoria do produto'] || '';

        // Handle Price logic
        let priceStr = row['Preço'] || '0';
        // Brazilian format: 1.200,50 -> 1200.50
        priceStr = priceStr.replace(/"/g, '').replace(/\./g, '').replace(',', '.');
        let price = parseFloat(priceStr) || 0;

        // Apply PDF Overrides if name matches
        if (PDF_PRICE_MAP[name]) {
            price = PDF_PRICE_MAP[name];
            console.log(`[PDF OVERRIDE] Price for '${name}' set to ${price}`);
        }

        // 1. Check if product exists via SKU
        const checkResult = await pool.query(`SELECT id FROM products WHERE sku = $1`, [originalCode]);

        if (checkResult.rows.length > 0) {
            const productId = checkResult.rows[0].id;

            // Enrich with PDF data
            const queryText = `
                UPDATE products 
                SET description = COALESCE(NULLIF($1, ''), description),
                    image_url = COALESCE(NULLIF($2, ''), image_url),
                    category = COALESCE(NULLIF($3, ''), category),
                    price = $4,
                    weight_kg = $5,
                    name = $6
                WHERE id = $7
            `;
            await pool.query(queryText, [rawDescription, imageUrl, category, price, weightKg, name, productId]);
            updateCount++;
        } else {
            // New Inactive product
            const insertQuery = `
                INSERT INTO products (sku, name, description, price, image_url, category, weight_kg, active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, false)
            `;
            await pool.query(insertQuery, [originalCode, name, rawDescription, price, imageUrl, category, weightKg]);
            newCount++;
        }
    }

    console.log('\n--- Import Summary ---');
    console.log(`Total Rows Processed: ${rowCount}`);
    console.log(`Enriched existing products: ${updateCount}`);
    console.log(`Created new inactive products: ${newCount}`);

    await pool.end();
}

importCatalog().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});

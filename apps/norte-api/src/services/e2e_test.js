/**
 * Comprehensive End-to-End Integration Test for Norte Piscinas
 * 
 * This script tests:
 * 1. Product Search
 * 2. Contact Management (Get/Create)
 * 3. Order Creation (Local DB + Bling)
 * 4. Payment Generation (Asaas PIX)
 * 
 * Run with: node src/services/e2e_test.js
 */

require('dotenv').config({ path: '/root/ideias_app/.env' });
const axios = require('axios');

// Using local API URL (internal docker or local host)
const API_URL = 'http://localhost:3000';

async function runTests() {
    console.log('🚀 Starting End-to-End Integration Test\n');

    try {
        // 1. Search for a product
        console.log('Step 1: Searching for products...');
        const productRes = await axios.get(`${API_URL}/products?search=cloro`);
        if (productRes.data.data.length === 0) throw new Error('No products found for test');
        const testProduct = productRes.data.data[0];
        console.log(`✅ Found product: ${testProduct.name} (ID: ${testProduct.id}, Price: ${testProduct.price})\n`);

        // 2. Manage Contact
        console.log('Step 2: Managing contact...');
        const testContact = {
            name: 'Teste E2E Antigravity',
            document: '52233830030', // Valid CPF for production validation
            phone: '63999999999',
            email: 'teste_e2e@exemplo.com',
            address_street: 'Rua de Teste',
            address_number: '123',
            address_zip: '77000000',
            address_city: 'Palmas',
            address_state: 'TO',
            address_neighborhood: 'Centro'
        };
        const contactRes = await axios.post(`${API_URL}/bling/contatos`, testContact);
        const customerId = contactRes.data.data.id;
        console.log(`✅ Contact managed. Internal ID: ${customerId}, Bling ID: ${contactRes.data.data.bling_id}\n`);

        // 3. Create Order
        console.log('Step 3: Creating order...');
        const testOrder = {
            customer_id: customerId,
            items: [
                {
                    product_id: testProduct.id,
                    quantity: 1
                }
            ],
            payment_method: 'pix_asaas',
            notes: 'Pedido de teste E2E via Antigravity'
        };
        const orderRes = await axios.post(`${API_URL}/orders`, testOrder);
        const order = orderRes.data.data;
        console.log(`✅ Order created successfully: ${order.order_number} (Internal ID: ${order.id})\n`);

        // 4. Generate PIX
        console.log('Step 4: Generating PIX payment via Asaas...');
        const pixRes = await axios.post(`${API_URL}/payments/pix`, {
            order_id: order.id
        });
        const pix = pixRes.data.data;
        console.log(`✅ PIX Generated!\n`);
        console.log(`Copia e Cola: ${pix.pix_copy_paste.substring(0, 50)}...`);
        console.log(`QR Code image size: ${pix.qr_code.length} bytes\n`);

        console.log('✨ ALL TESTS PASSED SUCCESSFULLY! ✨');

    } catch (err) {
        console.error('❌ Test failed!');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('Error:', err.message);
        }
    }
}

runTests();

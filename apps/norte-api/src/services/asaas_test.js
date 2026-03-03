/**
 * Verification Script for Asaas Service
 * Run with: node src/services/asaas_test.js
 */
require('dotenv').config({ path: '/root/ideias_app/.env' });
const asaas = require('./asaas');

async function testAsaas() {
    console.log('--- Starting Asaas Service Test ---');
    console.log('Mode:', process.env.ASAAS_MODE || 'sandbox');

    try {
        const testData = {
            customer: {
                name: 'Cliente Teste Antigravity',
                email: 'teste@exemplo.com',
                phone: '63999999999',
                document: '52233830030', // Valid CPF for production check
                address_zip: '77000000',
                address_number: '123'
            },
            amount: 10.50,
            orderNumber: 'TEST-' + Date.now(),
            billingType: 'PIX',
            description: 'Teste de Integração Antigravity'
        };

        console.log('\n1. Testing Customer Creation/Retrieval...');
        const customer = await asaas.getOrCreateCustomer(testData.customer);
        console.log('Customer ID:', customer.id);

        console.log('\n2. Testing PIX Payment Creation...');
        const payment = await asaas.createPayment(testData);
        console.log('Payment ID:', payment.id);
        console.log('Status:', payment.status);

        console.log('\n3. Testing Pix QR Code retrieval...');
        const qrCode = await asaas.getPixQrCode(payment.id);
        console.log('Pix QR Code Payload length:', qrCode.payload.length);
        console.log('Encoded Image received:', !!qrCode.encodedImage);

        console.log('\n4. Testing Boleto creation...');
        const boletoPayment = await asaas.createPayment({
            ...testData,
            billingType: 'BOLETO',
            orderNumber: testData.orderNumber + '-BOL'
        });
        console.log('Boleto Payment ID:', boletoPayment.id);

        const boletoDetails = await asaas.getBoletoDetails(boletoPayment.id);
        console.log('Identification Field:', boletoDetails.identificationField);

        console.log('\n--- Test Completed Successfully! ---');
    } catch (err) {
        console.error('\n--- Test Failed! ---');
        console.error(err.message);
        if (err.message.includes('API key')) {
            console.log('Note: Ensure ASAAS_API_KEY is correctly set in .env');
        }
    }
}

testAsaas();

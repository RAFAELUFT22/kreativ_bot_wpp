/**
 * Asaas Payment Gateway Service
 * Handles Pix, Credit Card, and Boleto transactions via Asaas API
 */

class AsaasService {
    constructor() {
        this.apiKey = process.env.ASAAS_API_KEY;
        this.isSandbox = process.env.ASAAS_MODE !== 'production';
        this.apiUrl = this.isSandbox
            ? 'https://sandbox.asaas.com/api/v3'
            : 'https://www.asaas.com/api/v3';
    }

    async request(endpoint, method = 'GET', data = null) {
        const url = `${this.apiUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'access_token': this.apiKey
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        console.log(`[ASAAS DEBUG] ${method} ${url}`);
        if (data) console.log(`[ASAAS DEBUG] Body:`, JSON.stringify(data));

        const response = await fetch(url, options);
        const text = await response.text();

        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error(`Status: ${response.status} - Non-JSON response from ${url}:`, text.substring(0, 500));
            throw new Error(`Resposta não-JSON da API do Asaas (${response.status})`);
        }

        if (!response.ok) {
            const errorMsg = result.errors
                ? result.errors.map(e => e.description).join(', ')
                : 'Erro na API do Asaas';
            throw new Error(errorMsg);
        }

        return result;
    }

    /**
     * Finds or creates a customer in Asaas
     */
    async getOrCreateCustomer(data) {
        // First try to find by document
        if (data.document) {
            const search = await this.request(`/customers?cpfCnpj=${data.document.replace(/\D/g, '')}`);
            if (search.data && search.data.length > 0) {
                return search.data[0];
            }
        }

        // Create new customer
        const payload = {
            name: data.name,
            email: data.email,
            phone: data.phone,
            mobilePhone: data.phone,
            cpfCnpj: data.document ? data.document.replace(/\D/g, '') : null,
            notificationDisabled: true
        };

        return await this.request('/customers', 'POST', payload);
    }

    /**
     * Creates a payment
     */
    async createPayment(data) {
        const customer = await this.getOrCreateCustomer(data.customer);

        const payload = {
            customer: customer.id,
            billingType: data.billingType, // PIX, CREDIT_CARD, BOLETO
            value: data.amount,
            dueDate: data.dueDate || new Date(Date.now() + 86400000).toISOString().split('T')[0], // Default tomorrow
            externalReference: data.orderNumber,
            description: data.description || `Pedido ${data.orderNumber} - Norte Piscinas`,
            postalService: false
        };

        if (data.billingType === 'CREDIT_CARD') {
            payload.creditCard = {
                holderName: data.card.holderName,
                number: data.card.number,
                expiryMonth: data.card.expiryMonth,
                expiryYear: data.card.expiryYear,
                ccv: data.card.ccv
            };
            payload.creditCardHolderInfo = {
                name: data.customer.name,
                email: data.customer.email,
                cpfCnpj: data.customer.document.replace(/\D/g, ''),
                postalCode: data.customer.address_zip.replace(/\D/g, ''),
                addressNumber: data.customer.address_number,
                addressComplement: data.customer.address_complement || '',
                phone: data.customer.phone.replace(/\D/g, ''),
                mobilePhone: data.customer.phone.replace(/\D/g, '')
            };
            if (data.installments) {
                payload.installmentCount = data.installments;
            }
        }

        return await this.request('/payments', 'POST', payload);
    }

    /**
     * Gets Pix QR Code and Copy-Paste code
     */
    async getPixQrCode(paymentId) {
        return await this.request(`/payments/${paymentId}/pixQrCode`);
    }

    /**
     * Gets Boleto barcode and PDF
     */
    async getBoletoDetails(paymentId) {
        const identification = await this.request(`/payments/${paymentId}/identificationField`);
        return identification;
    }
}

module.exports = new AsaasService();

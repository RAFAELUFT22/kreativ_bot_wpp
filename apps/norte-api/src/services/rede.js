/**
 * Rede Payment Gateway Service
 * Handles e-commerce transactions via Rede API
 */

class RedeService {
    constructor() {
        this.pv = process.env.REDE_PV;
        this.token = process.env.REDE_TOKEN;
        this.isSandbox = process.env.NODE_ENV !== 'production';
        this.apiUrl = 'https://api.userede.com.br/erede/v1';
    }

    async createTransaction(data) {
        // Implementation based on Rede REST API
        // https://developer.userede.com.br/api#e-commerce
        const payload = {
            capture: true,
            kind: 'credit',
            reference: data.order_number,
            amount: Math.round(parseFloat(data.amount) * 100), // In cents
            cardholderName: data.card.holder || data.card.name,
            cardNumber: data.card.number.replace(/\D/g, ''),
            expirationMonth: parseInt(data.card.exp_month || data.card.month),
            expirationYear: parseInt(data.card.exp_year || data.card.year),
            securityCode: data.card.cvv,
            installments: data.installments || 1,
            softDescriptor: 'NORTEPISCINAS'
        };

        const response = await fetch(`${this.apiUrl}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(`${this.pv}:${this.token}`).toString('base64')}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorMsg = 'Erro no processamento Rede';
            try {
                const error = await response.json();
                errorMsg = error.returnMessage || JSON.stringify(error);
            } catch (e) {
                errorMsg = `Rede HTTP Error ${response.status} - Endpoint may be incorrect or unauthorized`;
            }
            throw new Error(errorMsg);
        }

        return await response.json();
    }

    async captureTransaction(tid, amount) {
        const response = await fetch(`${this.apiUrl}/transactions/${tid}/captures`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(`${this.pv}:${this.token}`).toString('base64')}`
            },
            body: JSON.stringify({ amount: Math.round(amount * 100) })
        });

        return await response.json();
    }
}

module.exports = new RedeService();

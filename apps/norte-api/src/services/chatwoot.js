const CHATWOOT_URL = process.env.CHATWOOT_URL;
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN;
const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
const CHATWOOT_INBOX_ID = process.env.CHATWOOT_INBOX_ID;

class ChatwootService {
    async notifyNewOrder(order) {
        if (!CHATWOOT_URL || !CHATWOOT_API_TOKEN || !CHATWOOT_ACCOUNT_ID || !CHATWOOT_INBOX_ID) {
            console.warn('Chatwoot not fully configured. Skipping notification.');
            return;
        }

        try {
            const customerPhoneStr = order.customer_phone || order.phone || '';
            const rawPhone = customerPhoneStr.replace(/\D/g, '');
            const phone = rawPhone ? `+${rawPhone}` : '';

            const contactPayload = {
                name: order.customer_name || 'Cliente Novo',
                email: order.customer_email || (rawPhone ? `${rawPhone}@wa.me` : ''),
                phone_number: phone
            };

            let contactId;
            if (phone) {
                // Search contact
                const searchRes = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/search?q=${phone}`, {
                    headers: { api_access_token: CHATWOOT_API_TOKEN }
                });
                const searchData = await searchRes.json();

                if (searchData.payload && searchData.payload.length > 0) {
                    contactId = searchData.payload[0].id;
                }
            }

            if (!contactId) {
                const createRes = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', api_access_token: CHATWOOT_API_TOKEN },
                    body: JSON.stringify(contactPayload)
                });
                const createData = await createRes.json();
                if (createData.payload && createData.payload.contact) {
                    contactId = createData.payload.contact.id;
                }
            }

            if (!contactId) {
                return;
            }

            // Create conversation
            const convRes = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', api_access_token: CHATWOOT_API_TOKEN },
                body: JSON.stringify({
                    inbox_id: CHATWOOT_INBOX_ID,
                    contact_id: contactId,
                    status: 'open'
                })
            });
            const convData = await convRes.json();

            // Send message
            const message = `🚀 Novo Pedido E-commerce!\n\nPedido: ${order.order_number}\nCliente: ${order.customer_name}\nValor: R$ ${parseFloat(order.total).toFixed(2)}\nStatus: ${order.status}\n\nO cliente foi notificado pelo sistema e o pedido encaminhado para o Bling.`;

            await fetch(`${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${convData.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', api_access_token: CHATWOOT_API_TOKEN },
                body: JSON.stringify({
                    content: message,
                    message_type: 'outgoing',
                    private: true
                })
            });

            console.log(`[CHATWOOT] Notified new order ${order.order_number} to conversation ${convData.id}`);
        } catch (error) {
            console.error('[CHATWOOT] Error delivering notification:', error.message);
        }
    }
}

module.exports = new ChatwootService();

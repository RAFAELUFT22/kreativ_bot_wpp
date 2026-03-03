const API_URL = import.meta.env.VITE_API_URL || 'https://api.nortepiscinas.net';

async function request(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

export const api = {
    // Products
    getProducts: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/products${query ? '?' + query : ''}`);
    },
    getCategories: () => request('/products/categories'),
    getProduct: (id) => request(`/products/${id}`),

    // Cart
    getCart: (sessionId) => request(`/cart/${sessionId}`),
    addToCart: (data) => request('/cart', { method: 'POST', body: JSON.stringify(data) }),
    updateCartItem: (sessionId, itemId, quantity) =>
        request(`/cart/${sessionId}/item/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
    removeCartItem: (sessionId, itemId) =>
        request(`/cart/${sessionId}/item/${itemId}`, { method: 'DELETE' }),

    // Customers
    createCustomer: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
    getCustomerByPhone: (phone) => request(`/customers/phone/${phone}`),

    // Orders
    createOrder: (data) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
    getOrder: (id) => request(`/orders/${id}`),
    getOrderByNumber: (num) => request(`/orders/number/${num}`),

    // Payments
    generatePix: (orderId) => request('/payments/pix', { method: 'POST', body: JSON.stringify({ order_id: orderId }) }),
    processCard: (data) => request('/payments/card', { method: 'POST', body: JSON.stringify(data) }),
    generateBoleto: (orderId) => request('/payments/boleto', { method: 'POST', body: JSON.stringify({ order_id: orderId }) }),

    // Settings
    getSettings: () => request('/settings'),
};

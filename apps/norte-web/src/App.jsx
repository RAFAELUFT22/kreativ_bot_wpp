import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import MobileBottomNav from './components/MobileBottomNav';
import Home from './pages/Home';
import Categories from './pages/Categories';
import Stores from './pages/Stores';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderStatus from './pages/OrderStatus';
import Specialist from './pages/Specialist';

export default function App() {
    const [cartCount, setCartCount] = useState(0);
    const [sessionId, setSessionId] = useState(() => localStorage.getItem('np_session') || '');

    const updateCartCount = useCallback((count) => setCartCount(count), []);
    const updateSession = useCallback((sid) => {
        setSessionId(sid);
        localStorage.setItem('np_session', sid);
    }, []);

    return (
        <BrowserRouter>
            <div className="app">
                <Header cartCount={cartCount} />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/categorias" element={<Categories />} />
                        <Route path="/lojas" element={<Stores />} />
                        <Route path="/produtos" element={<Catalog sessionId={sessionId} updateSession={updateSession} updateCartCount={updateCartCount} />} />
                        <Route path="/produto/:id" element={<ProductDetail sessionId={sessionId} updateSession={updateSession} updateCartCount={updateCartCount} />} />
                        <Route path="/carrinho" element={<Cart sessionId={sessionId} updateCartCount={updateCartCount} />} />
                        <Route path="/checkout" element={<Checkout sessionId={sessionId} updateSession={updateSession} />} />
                        <Route path="/pedido/:orderNumber" element={<OrderStatus />} />
                        <Route path="/especialista" element={<Specialist />} />
                    </Routes>
                </main>
                <Footer />
                <WhatsAppButton />
                <MobileBottomNav />
            </div>
        </BrowserRouter>
    );
}

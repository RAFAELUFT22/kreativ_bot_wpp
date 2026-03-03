import { Link, useNavigate } from 'react-router-dom';

export default function Stores() {
    const navigate = useNavigate();

    return (
        <div className="mobile-page-wrapper">
            {/* Custom Mobile Header */}
            <div className="mobile-header">
                <button className="back-btn" onClick={() => navigate(-1)}>←</button>
                <h1 className="mobile-header-title">Our Locations</h1>
                <div style={{ width: '24px' }}></div> {/* Spacer for symmetry */}
            </div>

            <div className="container" style={{ padding: '1rem', paddingBottom: '90px' }}>
                {/* Shipping Banner */}
                <div className="shipping-banner">
                    <div className="shipping-icon">🚚</div>
                    <div className="shipping-text">
                        <strong>Frete Grátis apenas em Palmas - TO</strong>
                        <span>Aproveite para comprar online</span>
                    </div>
                </div>

                {/* Store 1 */}
                <div className="store-location-card">
                    <div className="store-map-bg bg-map-1">
                        <div className="store-rating">4.3 <span style={{ color: '#FBBF24' }}>★</span></div>
                        <div className="store-map-overlay">
                            <h2 className="store-name">Loja 1 – Centro</h2>
                            <p className="store-address">📍 106 Sul, Palmas – TO</p>
                        </div>
                    </div>

                    <div className="store-info-bar">
                        <div className="store-hours">
                            <span style={{ color: '#6B7280' }}>🕒 Open 8:00 AM - 6:00 PM</span>
                        </div>
                        <div className="store-status status-open">Open Now</div>
                    </div>

                    <div className="store-buttons-row">
                        <a href="tel:6332241533" className="btn-flex btn-ghost">
                            📞 Call
                        </a>
                        <a href="https://wa.me/556332241533" className="btn-flex btn-whatsapp-solid">
                            💬 WhatsApp
                        </a>
                    </div>
                    <a href="https://maps.google.com/?q=Norte+Piscinas+106+Sul+Palmas" className="btn-flex btn-primary-solid" style={{ marginTop: '0.8rem' }}>
                        🗺️ Open in Maps
                    </a>
                </div>

                {/* Store 2 */}
                <div className="store-location-card">
                    <div className="store-map-bg bg-map-2">
                        <div className="store-rating">4.8 <span style={{ color: '#FBBF24' }}>★</span></div>
                        <div className="store-map-overlay">
                            <h2 className="store-name">Loja 2 – Plano Sul</h2>
                            <p className="store-address">📍 ARSO 52, Palmas – TO</p>
                        </div>
                    </div>

                    <div className="store-info-bar">
                        <div className="store-hours">
                            <span style={{ color: '#6B7280' }}>🕒 Open 8:00 AM - 6:00 PM</span>
                        </div>
                        <div className="store-status status-closed">Closed</div>
                    </div>

                    <div className="store-buttons-row">
                        <a href="tel:6330265995" className="btn-flex btn-ghost">
                            📞 Call
                        </a>
                        <a href="https://wa.me/556330265995" className="btn-flex btn-whatsapp-solid">
                            💬 WhatsApp
                        </a>
                    </div>
                    <a href="https://maps.google.com/?q=Norte+Piscinas+ARSO+52+Palmas" className="btn-flex btn-primary-solid" style={{ marginTop: '0.8rem' }}>
                        🗺️ Open in Maps
                    </a>
                </div>
            </div>
        </div>
    );
}

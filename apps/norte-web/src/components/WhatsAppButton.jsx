import { useState } from 'react';

export default function WhatsAppButton() {
    const [isOpen, setIsOpen] = useState(false);

    const stores = [
        { name: 'Loja 1 - Centro (106 Sul)', phone: '556332241533' },
        { name: 'Loja 2 - Plano Sul (ARSO 52)', phone: '556330265995' }
    ];

    const message = encodeURIComponent('Olá! Gostaria de saber mais sobre os produtos para piscina.');

    return (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 90 }}>
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    bottom: '80px',
                    right: 0,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-md)',
                    boxShadow: 'var(--shadow-lg)',
                    width: '240px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-sm)',
                    animation: 'fadeInUp 0.3s ease'
                }}>
                    <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                        Escolha a loja mais próxima:
                    </h4>
                    {stores.map((store, i) => (
                        <a
                            key={i}
                            href={`https://wa.me/${store.phone}?text=${message}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-success btn-sm"
                            style={{ justifyContent: 'flex-start' }}
                            onClick={() => setIsOpen(false)}
                        >
                            💬 {store.name}
                        </a>
                    ))}
                </div>
            )}

            <button
                className="whatsapp-btn"
                style={{ position: 'static' }}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Fale conosco pelo WhatsApp"
            >
                {isOpen ? '✕' : '💬'}
            </button>
        </div>
    );
}

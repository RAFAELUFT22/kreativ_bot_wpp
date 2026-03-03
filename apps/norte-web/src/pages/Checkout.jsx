import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Checkout({ sessionId, updateSession }) {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [pixData, setPixData] = useState(null);
    const [boletoData, setBoletoData] = useState(null);
    const [card, setCard] = useState({
        holder: '', number: '', exp_month: '', exp_year: '', cvv: ''
    });
    const [installments, setInstallments] = useState(1);

    const [form, setForm] = useState({
        name: '', phone: '', email: '', documentType: 'F', document: '', ie: '',
        address_street: '', address_number: '', address_neighborhood: '',
        address_city: '', address_state: '', address_zip: '', address_complement: '', notes: ''
    });

    const formatCEP = (v) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
    const formatPhone = (v) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').slice(0, 15);
    const formatCPF = (v) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14);
    const formatCNPJ = (v) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').slice(0, 18);

    async function handleCepLookup(e) {
        const cep = e.target.value.replace(/\D/g, '');
        if (cep.length === 8) {
            try {
                const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await res.json();
                if (!data.erro) {
                    setForm(prev => ({
                        ...prev,
                        address_street: data.logradouro || prev.address_street,
                        address_neighborhood: data.bairro || prev.address_neighborhood,
                        address_city: data.localidade || prev.address_city,
                        address_state: data.uf || prev.address_state
                    }));
                }
            } catch (err) {
                console.error("ViaCEP error", err);
            }
        }
    }

    function handleChange(e) {
        let { name, value } = e.target;
        if (name === 'phone') value = formatPhone(value);
        if (name === 'address_zip') { value = formatCEP(value); }
        if (name === 'document') {
            value = form.documentType === 'J' ? formatCNPJ(value) : formatCPF(value);
        }

        setForm(prev => ({ ...prev, [name]: value }));
    }

    async function handleSubmitInfo(e) {
        e.preventDefault();
        if (!form.name || !form.phone) return alert('Nome e telefone são obrigatórios');
        setStep(2);
    }

    function handleSelectPayment(method) {
        setPaymentMethod(method);
    }

    async function handlePlaceOrder() {
        if (!paymentMethod) return alert('Selecione a forma de pagamento');
        setLoading(true);

        try {
            // 1. Create/update customer
            const custResult = await api.createCustomer({
                ...form,
                phone: form.phone.replace(/\D/g, ''),
                document: form.document.replace(/\D/g, ''),
                document_type: form.documentType
            });
            const customer = custResult.data;

            // 2. Create order
            const deliveryAddress = `${form.address_street}, ${form.address_number} ${form.address_complement ? '- ' + form.address_complement : ''} - ${form.address_neighborhood}, ${form.address_city}/${form.address_state} - ${form.address_zip}`;

            const orderResult = await api.createOrder({
                customer_id: customer.id,
                session_id: sessionId,
                payment_method: paymentMethod,
                delivery_address: deliveryAddress,
                notes: form.notes,
                channel: 'web'
            });
            const order = orderResult.data;

            // 3. Process Payment based on method
            if (paymentMethod === 'pix_advance' || paymentMethod === 'pix_asaas') {
                const pixResult = await api.generatePix(order.id);
                setPixData(pixResult.data);
                setStep(3);
            } else if (paymentMethod === 'credit_card_asaas') {
                await api.processCard({
                    order_id: order.id,
                    card,
                    installments
                });
                navigate(`/pedido/${order.order_number}`);
            } else if (paymentMethod === 'boleto_asaas') {
                const bolResult = await api.generateBoleto(order.id);
                setBoletoData(bolResult.data);
                setStep(3);
            } else {
                navigate(`/pedido/${order.order_number}`);
            }

            updateSession('');
            localStorage.removeItem('np_session');
        } catch (err) {
            console.error('Error placing order:', err);
            alert('Erro ao finalizar pedido. Tente novamente.');
        } finally {
            setLoading(false);
        }
    }

    const formatPrice = (v) => "Sob consulta";

    return (
        <section className="checkout-page">
            <div className="container" style={{ maxWidth: 700 }}>
                <h1 className="section__title" style={{ textAlign: 'left', marginBottom: 'var(--space-xl)' }}>
                    Finalizar Pedido
                </h1>

                {/* Step Indicator */}
                <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                    {['Seus Dados', 'Pagamento', 'Confirmação'].map((label, i) => (
                        <div key={i} style={{
                            flex: 1, textAlign: 'center', padding: 'var(--space-sm)',
                            borderBottom: `3px solid ${step > i ? 'var(--color-primary)' : 'var(--border-color)'}`,
                            color: step > i ? 'var(--color-primary)' : 'var(--text-muted)',
                            fontWeight: step === i + 1 ? 600 : 400, fontSize: 'var(--font-size-sm)'
                        }}>
                            {label}
                        </div>
                    ))}
                </div>

                {/* Step 1: Customer Info */}
                {step === 1 && (
                    <form onSubmit={handleSubmitInfo}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label>Tipo de Pessoa *</label>
                                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontWeight: 'normal' }}>
                                        <input type="radio" name="documentType" value="F" checked={form.documentType === 'F'} onChange={(e) => {
                                            setForm(prev => ({ ...prev, documentType: 'F', document: '', ie: '' }));
                                        }} /> Pessoa Física
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontWeight: 'normal' }}>
                                        <input type="radio" name="documentType" value="J" checked={form.documentType === 'J'} onChange={(e) => {
                                            setForm(prev => ({ ...prev, documentType: 'J', document: '' }));
                                        }} /> Pessoa Jurídica
                                    </label>
                                </div>
                            </div>
                            <div className="form-group" style={{ gridColumn: form.documentType === 'J' ? 'span 2' : 'span 2' }}>
                                <label>{form.documentType === 'J' ? 'Razão Social / Nome Completo *' : 'Nome completo *'}</label>
                                <input className="form-input" name="name" value={form.name} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label>Telefone / WhatsApp *</label>
                                <input className="form-input" name="phone" value={form.phone} onChange={handleChange} placeholder="(00) 00000-0000" required />
                            </div>
                            <div className="form-group">
                                <label>E-mail</label>
                                <input className="form-input" name="email" type="email" value={form.email} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>{form.documentType === 'J' ? 'CNPJ *' : 'CPF'}</label>
                                <input className="form-input" name="document" value={form.document} onChange={handleChange} placeholder={form.documentType === 'J' ? '00.000.000/0000-00' : '000.000.000-00'} required={form.documentType === 'J'} />
                            </div>
                            {form.documentType === 'J' && (
                                <div className="form-group">
                                    <label>Inscrição Estadual (IE) *</label>
                                    <input className="form-input" name="ie" value={form.ie} onChange={handleChange} placeholder="Número IE ou 'Isento'" required />
                                </div>
                            )}
                            <div className="form-group" style={{ gridColumn: 'span 2', marginTop: 'var(--space-sm)' }}>
                                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
                            </div>
                            <div className="form-group">
                                <label>CEP *</label>
                                <input className="form-input" name="address_zip" value={form.address_zip} onChange={handleChange} onBlur={handleCepLookup} placeholder="00000-000" required />
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label>Rua / Avenida *</label>
                                <input className="form-input" name="address_street" value={form.address_street} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label>Número *</label>
                                <input className="form-input" name="address_number" value={form.address_number} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label>Complemento</label>
                                <input className="form-input" name="address_complement" value={form.address_complement} onChange={handleChange} placeholder="Apto, Sala, Casa 2..." />
                            </div>
                            <div className="form-group">
                                <label>Bairro *</label>
                                <input className="form-input" name="address_neighborhood" value={form.address_neighborhood} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label>Cidade *</label>
                                <input className="form-input" name="address_city" value={form.address_city} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label>Estado (UF) *</label>
                                <input className="form-input" name="address_state" value={form.address_state} onChange={handleChange} maxLength={2} required />
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label>Observações</label>
                                <textarea className="form-input" name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Ex: portão verde, entregar pela manhã..." />
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary btn-lg btn-full">
                            Continuar para Pagamento →
                        </button>
                    </form>
                )}

                {/* Step 2: Payment */}
                {step === 2 && (
                    <div>
                        <h3 style={{ marginBottom: 'var(--space-lg)' }}>Escolha a forma de pagamento</h3>

                        <div className={`payment-option ${paymentMethod === 'pix_asaas' || paymentMethod === 'pix_advance' ? 'selected' : ''}`} onClick={() => handleSelectPayment('pix_asaas')}>
                            <div className="payment-option__icon">💠</div>
                            <div className="payment-option__info">
                                <h4>PIX Automático</h4>
                                <p>Pague via PIX e a confirmação é instantânea</p>
                            </div>
                        </div>

                        <div className={`payment-option ${paymentMethod === 'credit_card_asaas' ? 'selected' : ''}`} onClick={() => handleSelectPayment('credit_card_asaas')}>
                            <div className="payment-option__icon">💳</div>
                            <div className="payment-option__info">
                                <h4>Cartão de Crédito</h4>
                                <p>Pague em até 12x via Asaas</p>
                            </div>
                        </div>

                        {paymentMethod === 'credit_card_asaas' && (
                            <div className="card-form" style={{ padding: 'var(--space-md)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label>Nome no Cartão</label>
                                    <input className="form-input" value={card.holder} onChange={e => setCard({ ...card, holder: e.target.value })} placeholder="Como escrito no cartão" />
                                </div>
                                <div className="form-group">
                                    <label>Número do Cartão</label>
                                    <input className="form-input" value={card.number} onChange={e => setCard({ ...card, number: e.target.value })} placeholder="0000 0000 0000 0000" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)' }}>
                                    <div className="form-group">
                                        <label>Mês</label>
                                        <input className="form-input" value={card.exp_month} onChange={e => setCard({ ...card, exp_month: e.target.value })} placeholder="MM" maxLength={2} />
                                    </div>
                                    <div className="form-group">
                                        <label>Ano</label>
                                        <input className="form-input" value={card.exp_year} onChange={e => setCard({ ...card, exp_year: e.target.value })} placeholder="AAAA" maxLength={4} />
                                    </div>
                                    <div className="form-group">
                                        <label>CVV</label>
                                        <input className="form-input" value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value })} placeholder="000" maxLength={4} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Parcelas</label>
                                    <select className="form-input" value={installments} onChange={e => setInstallments(parseInt(e.target.value))}>
                                        {[1, 2, 3, 4, 5, 6, 10, 12].map(i => (
                                            <option key={i} value={i}>{i}x</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className={`payment-option ${paymentMethod === 'boleto_asaas' ? 'selected' : ''}`} onClick={() => handleSelectPayment('boleto_asaas')}>
                            <div className="payment-option__icon">📄</div>
                            <div className="payment-option__info">
                                <h4>Boleto Bancário</h4>
                                <p>Gere o boleto e pague em qualquer banco</p>
                            </div>
                        </div>

                        <div className={`payment-option ${paymentMethod === 'cash_on_delivery' ? 'selected' : ''}`} onClick={() => handleSelectPayment('cash_on_delivery')}>
                            <div className="payment-option__icon">💵</div>
                            <div className="payment-option__info">
                                <h4>Dinheiro na Entrega</h4>
                                <p>Pague em dinheiro quando o entregador chegar</p>
                            </div>
                        </div>

                        <div className={`payment-option ${paymentMethod === 'card_on_delivery' ? 'selected' : ''}`} onClick={() => handleSelectPayment('card_on_delivery')}>
                            <div className="payment-option__icon">💳</div>
                            <div className="payment-option__info">
                                <h4>Cartão na Entrega</h4>
                                <p>Pague com cartão de crédito ou débito na entrega</p>
                            </div>
                        </div>

                        <div className={`payment-option ${paymentMethod === 'pix_on_delivery' ? 'selected' : ''}`} onClick={() => handleSelectPayment('pix_on_delivery')}>
                            <div className="payment-option__icon">📱</div>
                            <div className="payment-option__info">
                                <h4>PIX na Entrega</h4>
                                <p>Faça o PIX quando o entregador chegar</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
                            <button className="btn btn-secondary" onClick={() => setStep(1)}>← Voltar</button>
                            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handlePlaceOrder} disabled={loading || !paymentMethod}>
                                {loading ? '⏳ Processando...' : 'Confirmar Pedido ✓'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Confirmation (PIX or Boleto) */}
                {step === 3 && (
                    <div style={{ textAlign: 'center' }}>
                        {pixData && (
                            <>
                                <h3 style={{ marginBottom: 'var(--space-lg)' }}>📱 Pague via PIX</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                                    Pedido <strong>{pixData.order_number}</strong> — {formatPrice(pixData.amount)}
                                </p>

                                {pixData.qr_code && (
                                    <img src={pixData.qr_code} alt="QR Code PIX" style={{
                                        width: 280, height: 280, borderRadius: 'var(--radius-lg)',
                                        margin: '0 auto var(--space-lg)', display: 'block',
                                        background: 'white', padding: 'var(--space-md)'
                                    }} />
                                )}

                                {pixData.pix_copy_paste && (
                                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                                            Ou copie o código PIX:
                                        </p>
                                        <div style={{
                                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)', padding: 'var(--space-md)',
                                            wordBreak: 'break-all', fontSize: 'var(--font-size-xs)', fontFamily: 'monospace'
                                        }}>
                                            {pixData.pix_copy_paste}
                                        </div>
                                        <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-sm)' }}
                                            onClick={() => { navigator.clipboard.writeText(pixData.pix_copy_paste); alert('Copiado!'); }}>
                                            📋 Copiar Código
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {boletoData && (
                            <>
                                <h3 style={{ marginBottom: 'var(--space-lg)' }}>📑 Pague via Boleto</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                                    Pedido <strong>{boletoData.payment.order_id}</strong>
                                </p>

                                <div style={{ marginBottom: 'var(--space-lg)' }}>
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                                        Código de Barras:
                                    </p>
                                    <div style={{
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)', padding: 'var(--space-md)',
                                        wordBreak: 'break-all', fontSize: 'var(--font-size-xs)', fontFamily: 'monospace'
                                    }}>
                                        {boletoData.identification_field}
                                    </div>
                                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-sm)', marginRight: 'var(--space-sm)' }}
                                        onClick={() => { navigator.clipboard.writeText(boletoData.identification_field); alert('Copiado!'); }}>
                                        📋 Copiar Código
                                    </button>
                                    <a href={boletoData.bank_slip_url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                                        📥 Baixar Boleto
                                    </a>
                                </div>
                            </>
                        )}

                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            Após o pagamento, você receberá a confirmação pelo WhatsApp.
                        </p>
                        <button className="btn btn-outline-primary" style={{ marginTop: 'var(--space-xl)' }} onClick={() => navigate('/')}>
                            Voltar para a Loja
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

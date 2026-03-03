import { useState } from 'react';
import { api } from '../services/api';

export default function Specialist() {
    const [tab, setTab] = useState('calculator');
    const [calcData, setCalcData] = useState({ shape: 'rectangular', length: '', width: '', depth: '', diameter: '' });
    const [result, setResult] = useState(null);
    const [diagnosis, setDiagnosis] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleCalculate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.request('/specialist/calculate', {
                method: 'POST',
                body: JSON.stringify({ shape: calcData.shape, dims: calcData })
            });
            setResult(res.data);
        } catch (err) {
            alert('Erro ao calcular: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDiagnose = async (issueCode) => {
        setLoading(true);
        try {
            const res = await api.request('/specialist/diagnose', {
                method: 'POST',
                body: JSON.stringify({ issue_code: issueCode })
            });
            setDiagnosis(res.data);
        } catch (err) {
            alert('Erro ao diagnosticar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ paddingTop: '2rem' }}>
            <h1 className="section-title">Especialista Norte Piscinas</h1>
            <p className="section-subtitle">Calculadora de dosagem e diagnóstico de problemas.</p>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <button
                    className={`btn ${tab === 'calculator' ? 'btn--primary' : 'btn--outline'}`}
                    onClick={() => setTab('calculator')}
                >
                    🧮 Calculadora
                </button>
                <button
                    className={`btn ${tab === 'diagnostics' ? 'btn--primary' : 'btn--outline'}`}
                    onClick={() => setTab('diagnostics')}
                >
                    🔍 Diagnóstico
                </button>
            </div>

            {tab === 'calculator' && (
                <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <h3>Calculadora de Volume</h3>
                    <form onSubmit={handleCalculate} className="form">
                        <div className="form__group">
                            <label>Formato da Piscina</label>
                            <select
                                className="form__input"
                                value={calcData.shape}
                                onChange={(e) => setCalcData({ ...calcData, shape: e.target.value })}
                            >
                                <option value="rectangular">Retangular</option>
                                <option value="circular">Circular / Redonda</option>
                                <option value="oval">Oval</option>
                            </select>
                        </div>

                        {calcData.shape !== 'circular' && (
                            <div className="form__group">
                                <label>Comprimento (m)</label>
                                <input
                                    type="number" step="0.1" className="form__input" required
                                    value={calcData.length} onChange={(e) => setCalcData({ ...calcData, length: e.target.value })}
                                />
                            </div>
                        )}

                        {calcData.shape !== 'circular' && (
                            <div className="form__group">
                                <label>Largura (m)</label>
                                <input
                                    type="number" step="0.1" className="form__input" required
                                    value={calcData.width} onChange={(e) => setCalcData({ ...calcData, width: e.target.value })}
                                />
                            </div>
                        )}

                        {calcData.shape === 'circular' && (
                            <div className="form__group">
                                <label>Diâmetro (m)</label>
                                <input
                                    type="number" step="0.1" className="form__input" required
                                    value={calcData.diameter} onChange={(e) => setCalcData({ ...calcData, diameter: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="form__group">
                            <label>Profundidade Média (m)</label>
                            <input
                                type="number" step="0.1" className="form__input" required
                                value={calcData.depth} onChange={(e) => setCalcData({ ...calcData, depth: e.target.value })}
                            />
                        </div>

                        <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
                            {loading ? 'Calculando...' : 'Calcular Dosagem'}
                        </button>
                    </form>

                    {result && (
                        <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <p style={{ fontSize: '1.2rem', color: 'var(--accent)', fontWeight: 'bold' }}>
                                Volume Estimado: {result.volume_liters.toLocaleString()} Litros
                            </p>
                            <hr style={{ border: '0', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '1rem 0' }} />
                            <h4>Dosagens Recomendadas:</h4>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {Object.entries(result.dosages).map(([key, d]) => (
                                    <li key={key} style={{ marginBottom: '1rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                                        <div style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{d.name}</div>
                                        <div>Dosagem: {d.amount}{d.unit}</div>
                                        {d.instructions && (
                                            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', opacity: 0.8, fontStyle: 'italic' }}>
                                                💡 {d.instructions}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '1rem' }}>
                                * Valores aproximados baseados em parâmetros padrão. Consulte sempre o rótulo do fabricante.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {tab === 'diagnostics' && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div className="product-grid">
                        {[
                            { code: 'green_water', label: 'Água Verde', icon: '🤢' },
                            { code: 'cloudy_water', label: 'Água Turva', icon: '🥛' },
                            { code: 'burning_eyes', label: 'Olhos Ardendo', icon: '😫' }
                        ].map(item => (
                            <div
                                key={item.code}
                                className="card"
                                style={{ cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s' }}
                                onClick={() => handleDiagnose(item.code)}
                            >
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{item.icon}</div>
                                <h4>{item.label}</h4>
                            </div>
                        ))}
                    </div>

                    {diagnosis && (
                        <div className="card" style={{ marginTop: '2rem' }}>
                            <h3 style={{ color: 'var(--accent)' }}>Diagnóstico: {diagnosis.name}</h3>
                            <p><strong>Causa Provável:</strong> {diagnosis.cause}</p>
                            <div style={{ marginTop: '1rem' }}>
                                <h4>Passos para Solução:</h4>
                                <ol>
                                    {diagnosis.steps.map((step, i) => (
                                        <li key={i} style={{ marginBottom: '0.5rem' }}>{step}</li>
                                    ))}
                                </ol>
                            </div>
                            <button
                                className="btn btn--outline btn--full"
                                style={{ marginTop: '1rem' }}
                                onClick={() => setDiagnosis(null)}
                            >
                                Voltar
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

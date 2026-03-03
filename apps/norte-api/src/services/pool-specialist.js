/**
 * Pool Specialist Service
 * Handles volume calculations and dosage recommendations
 * Logic inspired by Hidroazul
 */

const productKnowledge = require('../data/product_knowledge.json');

class PoolSpecialistService {
    /**
     * Calculate pool volume in liters
     * @param {string} shape - 'rectangular', 'circular', 'oval'
     * @param {object} dims - { length, width, depth, diameter }
     */
    calculateVolume(shape, dims) {
        let volumeM3 = 0;
        const depth = parseFloat(dims.depth || 0);

        switch (shape) {
            case 'rectangular':
                volumeM3 = parseFloat(dims.length || 0) * parseFloat(dims.width || 0) * depth;
                break;
            case 'circular':
                const radius = parseFloat(dims.diameter || 0) / 2;
                volumeM3 = Math.PI * Math.pow(radius, 2) * depth;
                break;
            case 'oval':
                volumeM3 = parseFloat(dims.length || 0) * parseFloat(dims.width || 0) * depth * 0.89;
                break;
            default:
                throw new Error('Formato de piscina inválido');
        }

        return Math.round(volumeM3 * 1000); // Return in Liters
    }

    /**
     * Get dosage recommendations based on volume
     * @param {number} volumeLitros 
     */
    getDosageRecommendations(volumeLitros) {
        const volM3 = volumeLitros / 1000;
        const pk = productKnowledge;

        return {
            chlorine_premium_70: {
                name: pk.chlorine.premium_70.name,
                amount: Math.round(volM3 * pk.chlorine.premium_70.maintenance),
                unit: 'g',
                instructions: pk.chlorine.premium_70.instructions
            },
            chlorine_shock: {
                name: pk.chlorine.premium_70.name + " (Choque)",
                amount: Math.round(volM3 * pk.chlorine.premium_70.shock),
                unit: 'g',
                instructions: pk.chlorine.premium_70.instructions
            },
            algaecide_maintenance: {
                name: pk.algaecide.manutencion.name,
                amount: Math.round(volM3 * pk.algaecide.manutencion.maintenance),
                unit: 'ml',
                instructions: pk.algaecide.manutencion.instructions
            },
            algaecide_shock: {
                name: pk.algaecide.shock.name,
                amount: Math.round(volM3 * pk.algaecide.shock.shock),
                unit: 'ml',
                instructions: pk.algaecide.shock.instructions
            },
            clarifier: {
                name: pk.clarifiers.floc_plus_2in1.name,
                amount: Math.round(volM3 * pk.clarifiers.floc_plus_2in1.clarify),
                unit: 'ml',
                instructions: pk.clarifiers.floc_plus_2in1.instructions
            }
        };
    }

    /**
     * Diagnose a pool problem and suggest products
     * @param {string} issueCode 
     */
    diagnose(issueCode) {
        const issues = {
            'green_water': {
                name: 'Água Verde / Algas',
                cause: 'Proliferação de algas devido a baixo nível de cloro ou pH desajustado.',
                steps: [
                    'Ajuste o pH para 7.2 - 7.6',
                    'Ajuste a Alcalinidade para 80 - 120 ppm',
                    'Aplique Cloro Choque conforme volume',
                    'Aplique Algicida de Choque após 12h'
                ],
                recommended_skus: ['ALG-001', 'CLO-003']
            },
            'cloudy_water': {
                name: 'Água Turva / Leitosa',
                cause: 'Filtração ineficiente ou excesso de micropartículas.',
                steps: [
                    'Verifique o pH e a Alcalinidade',
                    'Aplique Floculante/Clarificante',
                    'Filtre por 6 a 12 horas seguidas',
                    'Aspire o fundo drenando se necessário'
                ],
                recommended_skus: ['FLO-001', 'FLO-002']
            },
            'burning_eyes': {
                name: 'Olhos Ardendo / Cheiro de Cloro',
                cause: 'Presença de cloraminas (cloro velho) ou pH muito baixo.',
                steps: [
                    'Ajuste o pH e a Alcalinidade imediatamente',
                    'Realize uma Supercloração (Shock) para queimar as cloraminas'
                ],
                recommended_skus: ['PH-002', 'CLO-003']
            }
        };

        return issues[issueCode] || null;
    }
}

module.exports = new PoolSpecialistService();

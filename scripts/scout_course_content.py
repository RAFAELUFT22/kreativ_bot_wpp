import json
import sys
import os

def generate_course_json(topic, search_raw_results):
    """
    Gera a estrutura JSON completa baseada no tópico.
    Foco: Manejo de Pastagens (Oracle Edition - Academic Content).
    """
    
    if "pastagem" in topic.lower() or "pastagen" in topic.lower():
        course = {
            "title": "Manejo Avançado de Pastagens: Ciência e Prática (Embrapa 2024)",
            "short_intro": "O guia definitivo de alta performance ganadaria, baseado em dados científicos e ferramentas digitais da Embrapa.",
            "description": "Este curso integra as pesquisas mais recentes (2023-2024) sobre ecofisiologia forrageira, sequestro de carbono e manejo rotatínuo. Ideal para quem busca produtividade com sustentabilidade real.",
            "chapters": [
                {
                    "title": "Módulo 1: Ecofisiologia e Sequestro de Carbono",
                    "lessons": [
                        {
                            "title": "A Ciência do Crescimento Forrageiro",
                            "content": "## Entendendo a Interceptação Luminosa\n\nSegundo a Embrapa, o manejo ideal ocorre quando o pasto atinge **95% de Interceptação Luminosa (IL)**. \n\n### Dinâmica de Crescimento\n- **Fase Inicial:** Crescimento acelerado, alta qualidade nutricional.\n- **Ponto Crítico (95% IL):** Equilíbrio entre acúmulo de folhas e senescência.\n- **Pós-crítico:** Aumento de colmos e material morto, queda drástica na digestibilidade.\n\n> *Citação:* 'O manejo pela altura é a tradução prática da interceptação luminosa no campo.' (Embrapa Gado de Corte).",
                        },
                        {
                            "title": "Pastagem como Sumidouro de CO2",
                            "content": "Estudos de 2024 no bioma Pampa e Cerrado confirmam que sistemas rotacionados bem manejados funcionam como absorvedores de carbono.\n\n### Impacto Ambiental em Números\n\n| Atividade | Impacto GEE | Observação |\n| :--- | :--- | :--- |\n| Pasto Degradado | Emissor (CO2) | Solo exposto libera carbono |\n| Manejo Rotatínuo | Sequestro (C) | Estimula renovação radicular |\n| Suplementação | Redução (CH4) | Melhora eficiência entérica |\n\n🎥 **Vídeo: Pecuária de Baixo Carbono:** https://www.youtube.com/watch?v=1VqJjS1l-P4"
                        }
                    ]
                },
                {
                    "title": "Módulo 2: O Pulo do Gato - Alturas de Manejo",
                    "lessons": [
                        {
                            "title": "Guia Prático de Alturas (Mombaça, Marandu, Zuri)",
                            "content": "O sucesso do pastejo rotacionado depende da disciplina na entrada e saída.\n\n### Tabela de Referência Embrapa\n\n| Cultivar | Entrada (cm) | Saída (cm) | Intensidade |\n| :--- | :--- | :--- | :--- |\n| Capim-Mombaça | 90 | 50 | Alta Produtividade |\n| Capim-Marandu | 25 | 15 | Manejo Seguro |\n| Capim-Zuri | 75 | 40 | Elite |\n| BRS Ipyporã | 25 | 15 | Resistente a Cigarrinha |\n\n```text\nDica: Use uma fita métrica ou o 'Pasto Certo' para calibrar seu olho no início.\n```"
                        }
                    ]
                },
                {
                    "title": "Módulo 3: Avaliação e Ferramentas Digitais",
                    "lessons": [
                        {
                            "title": "Domine o App Pasto Certo",
                            "content": "A ferramenta que coloca a inteligência da Embrapa no seu bolso.\n\n- Identificação de Cultivares.\n- Guia de Pragas.\n- Simulador de Lotação.\n\n🎥 **Tutorial Completo:** https://www.youtube.com/watch?v=1VqJjS1l-P4",
                            "assignment": {
                                "title": "Missão de Campo: Diagnóstico",
                                "type": "Text",
                                "question": "Vá até um piquete da sua propriedade. Meça a altura média e identifique a cultivar predominante. No relatório abaixo, descreva se o pasto está no momento ideal de entrada ou se já passou do ponto (senescência)."
                            },
                            "quiz": {
                                "title": "Certificação Manejo Premium",
                                "passing_score": 80,
                                "questions": [
                                    {
                                        "question": "O que acontece se deixarmos o Capim-Mombaça passar dos 90cm?",
                                        "options": ["Mais comida para o gado", "Aumento excessivo de colmo e fibra", "Melhora a raiz"],
                                        "answer": "Aumento excessivo de colmo e fibra"
                                    },
                                    {
                                        "question": "Qual o benefício ambiental do manejo rotacionado bem feito?",
                                        "options": ["Aumento da erosão", "Sequestro de Carbono no solo", "Gasto excessivo de água"],
                                        "answer": "Sequestro de Carbono no solo"
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        }
        return course
    
    # Se não for pastagem, usa o fallback padrão de Crédito Rural (ou outro)
    course = {
        "title": f"Curso Básico de {topic}",
        "short_intro": f"Introdução ao tema: {topic}",
        "description": "Conteúdo gerado dinamicamente para demonstração.",
        "chapters": [
            {
                "title": "Capítulo 1: Introdução",
                "lessons": [
                    {
                        "title": "Bem-vindo",
                        "content": f"Esta é a primeira lição do curso de {topic}."
                    }
                ]
            }
        ]
    }
    return course

if __name__ == "__main__":
    topic = sys.argv[1] if len(sys.argv) > 1 else "Manejo de Pastagens"
    print(json.dumps(generate_course_json(topic, ""), indent=4))

const axios = require('axios');

class AIAnalyzer {
  constructor(aiServiceUrl = 'http://ai-service:11434') {
    this.aiServiceUrl = aiServiceUrl;
  }

  // Analizar datos de Odoo con IA
  async analyzeOdooData(stats) {
    try {
      const prompt = this.buildAnalysisPrompt(stats);
      const analysis = await this.callAI(prompt);
      return this.parseAnalysis(analysis);
    } catch (error) {
      console.error('Error en análisis de IA:', error.message);
      return null;
    }
  }

  // Construir prompt para análisis
  buildAnalysisPrompt(stats) {
    return `
Analiza los siguientes datos de Odoo y proporciona insights:

Instancia: ${stats.instance}
Usuarios activos (30d): ${stats.users.active_last_30_days}
Ventas del mes: ${stats.business?.monthly_sales || 0}
Facturas vencidas: ${stats.business?.invoices_overdue || 0}
Stock bajo: ${stats.dashboard?.low_stock_products || 0}
Tareas pendientes: ${stats.dashboard?.pending_tasks || 0}
Health Score: ${stats.health_score}

Proporciona:
1. Análisis de tendencias
2. Riesgos identificados
3. Recomendaciones específicas
4. Prioridades de acción

Respuesta en formato JSON:
{
  "trends": "análisis de tendencias",
  "risks": ["riesgo1", "riesgo2"],
  "recommendations": ["rec1", "rec2"],
  "priorities": ["alta", "media", "baja"]
}
`;
  }

  // Llamar al servicio de IA
  async callAI(prompt) {
    const response = await axios.post(`${this.aiServiceUrl}/api/generate`, {
      model: 'llama2:7b',
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9
      }
    });

    return response.data.response;
  }

  // Parsear respuesta de IA
  parseAnalysis(aiResponse) {
    try {
      // Extraer JSON de la respuesta
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error parseando respuesta de IA:', error.message);
    }

    // Fallback: análisis básico
    return {
      trends: "Análisis automático no disponible",
      risks: [],
      recommendations: [],
      priorities: []
    };
  }

  // Generar resumen ejecutivo con IA
  async generateExecutiveSummary(allStats) {
    const prompt = `
Genera un resumen ejecutivo basado en estos datos de múltiples instancias Odoo:

${allStats.map(stat => `
- ${stat.instance}: Health Score ${stat.health_score}%, ${stat.users.active_last_30_days} usuarios activos
`).join('')}

Proporciona un resumen ejecutivo de máximo 200 palabras con:
1. Estado general del ecosistema
2. Principales preocupaciones
3. Recomendaciones estratégicas
`;

    try {
      const summary = await this.callAI(prompt);
      return summary;
    } catch (error) {
      return "Resumen ejecutivo no disponible por problemas técnicos.";
    }
  }
}

module.exports = AIAnalyzer;
// Dashboard de Customer Success
const fs = require('fs');
const path = require('path');

class CustomerSuccessDashboard {
  constructor() {
    this.historicalData = this.loadHistoricalData();
  }

  // Cargar datos históricos
  loadHistoricalData() {
    try {
      const dataPath = path.join(__dirname, 'data', 'historical-stats.json');
      if (fs.existsSync(dataPath)) {
        return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error cargando datos históricos:', error.message);
    }
    return {};
  }

  // Guardar datos históricos
  saveHistoricalData(stats) {
    try {
      console.log('🔍 DEBUG: Intentando guardar datos históricos para:', stats.instance);
      const dataPath = path.join(__dirname, 'data');
      console.log('🔍 DEBUG: Data path:', dataPath);
      
      if (!fs.existsSync(dataPath)) {
        console.log('🔍 DEBUG: Creando directorio data...');
        fs.mkdirSync(dataPath, { recursive: true });
      }
      
      const filePath = path.join(dataPath, 'historical-stats.json');
      console.log('🔍 DEBUG: File path:', filePath);
      
      // Agregar timestamp a los datos
      const timestamp = new Date().toISOString();
      if (!this.historicalData[stats.instance]) {
        this.historicalData[stats.instance] = [];
      }
      
      this.historicalData[stats.instance].push({
        timestamp,
        ...stats
      });
      
      // Mantener solo los últimos 90 días
      const ninetyDaysAgo = new Date(Date.now() - 90*24*60*60*1000);
      this.historicalData[stats.instance] = this.historicalData[stats.instance]
        .filter(record => new Date(record.timestamp) > ninetyDaysAgo);
      
      console.log('🔍 DEBUG: Escribiendo archivo...');
      fs.writeFileSync(filePath, JSON.stringify(this.historicalData, null, 2));
      console.log('✅ DEBUG: Archivo guardado exitosamente');
    } catch (error) {
      console.error('❌ DEBUG: Error guardando datos históricos:', error.message);
      console.error('❌ DEBUG: Stack trace:', error.stack);
    }
  }

  // Analizar tendencias
  analyzeTrends(instanceName) {
    const data = this.historicalData[instanceName] || [];
    if (data.length < 2) return null;

    const latest = data[data.length - 1];
    const previous = data[data.length - 2];

    return {
      health_score_trend: latest.health_score - previous.health_score,
      user_activity_trend: latest.users.active_last_7_days - previous.users.active_last_7_days,
      sales_trend: latest.business.monthly_sales - previous.business.monthly_sales,
      error_trend: latest.technical.errors_count - previous.technical.errors_count
    };
  }

  // Generar reporte ejecutivo
  generateExecutiveReport(allStats) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_clients: allStats.length,
        healthy_clients: allStats.filter(s => s.health_score >= 80).length,
        at_risk_clients: allStats.filter(s => s.health_score < 60).length,
        critical_clients: allStats.filter(s => s.health_score < 40).length
      },
      top_issues: this.getTopIssues(allStats),
      recommendations: this.getTopRecommendations(allStats)
    };

    return report;
  }

  getTopIssues(allStats) {
    const issues = {};
    allStats.forEach(stat => {
      stat.alerts.forEach(alert => {
        issues[alert] = (issues[alert] || 0) + 1;
      });
    });

    return Object.entries(issues)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count }));
  }

  getTopRecommendations(allStats) {
    const recommendations = {};
    allStats.forEach(stat => {
      stat.recommendations.forEach(rec => {
        recommendations[rec] = (recommendations[rec] || 0) + 1;
      });
    });

    return Object.entries(recommendations)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([recommendation, count]) => ({ recommendation, count }));
  }
}

module.exports = CustomerSuccessDashboard;
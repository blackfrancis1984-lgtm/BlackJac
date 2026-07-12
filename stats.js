/**
 * stats.js — Computación y formato de estadísticas
 *
 * Responsabilidad: Calcular métricas derivadas, formatear
 * valores para la UI, y generar reportes visuales.
 *
 * No interactúa con LocalStorage directamente; usa datos
 * pasados como parámetros para mantener separación de capas.
 */

import { COUNT_SYSTEMS } from './deck.js';

/* ====================================================================
   COMPUTACIÓN DE MÉTRICAS
   ==================================================================== */

/**
 * Calcula la precisión general.
 *
 * @param {number} correct - Respuestas correctas.
 * @param {number} total - Total de intentos.
 * @returns {number} Porcentaje de precisión (0-100).
 */
function accuracy(correct, total) {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

/**
 * Calcula cartas por minuto.
 *
 * @param {number} cards - Número de cartas.
 * @param {number} durationMs - Duración en milisegundos.
 * @returns {number} Cartas por minuto.
 */
function cardsPerMinute(cards, durationMs) {
  if (durationMs <= 0) return 0;
  return Math.round(cards / (durationMs / 60000));
}

/**
 * Calcula el tiempo promedio por carta.
 *
 * @param {number} durationMs - Duración en ms.
 * @param {number} cards - Número de cartas.
 * @returns {number} Milisegundos por carta.
 */
function timePerCard(durationMs, cards) {
  if (cards === 0) return 0;
  return Math.round(durationMs / cards);
}

/**
 * Calcula la racha máxima posible de un array de resultados.
 *
 * @param {boolean[]} results - Array de true/false.
 * @returns {number} Racha máxima.
 */
function maxStreak(results) {
  let max = 0, current = 0;
  for (const r of results) {
    if (r) {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

/**
 * Formatea duración en milisegundos a formato legible.
 *
 * @param {number} ms - Duración en milisegundos.
 * @returns {string} Formato legible (ej: "5:32" o "1h 23m").
 */
function formatDuration(ms) {
  if (ms <= 0) return '0:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  const mStr = String(minutes).padStart(1, '0');
  const sStr = String(seconds).padStart(2, '0');
  return `${mStr}:${sStr}`;
}

/**
 * Formatea un cronómetro para modo examen (MM:SS).
 *
 * @param {number} ms - Duración en milisegundos.
 * @returns {string} Formato MM:SS.
 */
function formatTimer(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Calcula la desviación estándar de un array de números.
 *
 * @param {number[]} values - Valores.
 * @returns {number} Desviación estándar.
 */
function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calcula la tendencia de mejora (comparando primera mitad vs segunda).
 *
 * @param {Array<{ accuracy: number }>} history - Historial de sesiones.
 * @returns {number} Diferencia de precisión (porcentaje puntos).
 */
function improvementTrend(history) {
  if (history.length < 4) return 0;
  const mid = Math.floor(history.length / 2);
  const firstHalf = history.slice(0, mid);
  const secondHalf = history.slice(mid);

  const avg1 = firstHalf.reduce((s, h) => s + h.accuracy, 0) / firstHalf.length;
  const avg2 = secondHalf.reduce((s, h) => s + h.accuracy, 0) / secondHalf.length;

  return Math.round((avg2 - avg1) * 10) / 10;
}

/* ====================================================================
   REPORTES
   ==================================================================== */

/**
 * Genera un reporte resumido de estadísticas globales.
 *
 * @param {Object} stats - Objeto de estadísticas completo.
 * @returns {Object} Reporte formateado.
 */
function generateGlobalReport(stats) {
  const totalAttempts = stats.totalCorrect + stats.totalIncorrect;

  return {
    overallAccuracy: accuracy(stats.totalCorrect, totalAttempts),
    totalSessions: stats.totalSessions,
    totalTime: formatDuration(stats.totalTime * 1000),
    totalCards: stats.totalCards,
    bestStreak: stats.bestStreak,
    bestAccuracy: stats.bestAccuracy,
    avgCpm: stats.rapidCount.history.length > 0
      ? Math.round(
        stats.rapidCount.history.reduce((s, h) => s + h.cpm, 0) /
        stats.rapidCount.history.length
      )
      : 0,
    improvement: improvementTrend(stats.rapidCount.history),
    // Modo examen
    examAvgScore: stats.exam.scores.length > 0
      ? Math.round(stats.exam.scores.reduce((s, sc) => s + sc, 0) / stats.exam.scores.length)
      : 0,
    examBestScore: stats.exam.scores.length > 0
      ? Math.max(...stats.exam.scores)
      : 0,
    // Mesa
    liveWinRate: stats.live.handsPlayed > 0
      ? Math.round((stats.live.handsWon / stats.live.handsPlayed) * 100)
      : 0,
    liveBjCount: stats.live.handsBlackjack,
    liveUnits: stats.live.unitsProfit
  };
}

/**
 * Genera un reporte detallado de un examen.
 *
 * @param {Object} report - Reporte del examen.
 * @returns {Object} Reporte formateado.
 */
function generateExamReport(report) {
  return {
    score: report.score,
    grade: _examGrade(report.score),
    correct: report.correct,
    total: report.total,
    duration: formatDuration(report.duration),
    cpm: report.cpm,
    timePerCard: formatDuration(report.timePerCard),
    categoryBreakdown: report.categories,
    accuracyByType: report.accuracyByType
  };
}

/**
 * Obtiene una calificación literal para un puntaje de examen.
 *
 * @param {number} score - Puntaje (0-100).
 * @returns {string} Calificación.
 */
function _examGrade(score) {
  if (score >= 95) return 'A+ (Excelente)';
  if (score >= 90) return 'A (Muy bueno)';
  if (score >= 85) return 'B+ (Bueno)';
  if (score >= 80) return 'B (Satisfactorio)';
  if (score >= 70) return 'C (Aceptable)';
  if (score >= 60) return 'D (Necesita práctica)';
  return 'F (Repetir)';
}

/**
 * Genera recomendaciones basadas en estadísticas.
 *
 * @param {Object} stats - Estadísticas.
 * @param {Object} errorPatterns - Patrones de error.
 * @returns {string[]} Array de recomendaciones.
 */
function generateRecommendations(stats, errorPatterns) {
  const tips = [];
  const totalAttempts = stats.totalCorrect + stats.totalIncorrect;

  // Precisión general
  if (totalAttempts > 0) {
    const acc = accuracy(stats.totalCorrect, totalAttempts);
    if (acc < 80) {
      tips.push('Tu precisión está por debajo del 80%. Baja la velocidad y practica con ayuda.');
    } else if (acc >= 80 && acc < 90) {
      tips.push('Buen progreso. Intenta subir la velocidad un nivel.');
    } else if (acc >= 90) {
      tips.push('Excelente precisión. Prueba el modo extremo o el examen.');
    }
  }

  // Patrones por categoría
  if (errorPatterns) {
    for (const [cat, data] of Object.entries(errorPatterns)) {
      if (data.total > 5 && data.errors / data.total > 0.3) {
        const names = { low: 'cartas bajas (2-6)', mid: 'cartas medias (7-9)', high: 'cartas altas (10-A)' };
        tips.push(`Revisa tu conteo con ${names[cat] || cat}. Tienes más del 30% de errores en esta categoría.`);
      }
    }

    // Rango específico
    if (errorPatterns.specificRanks) {
      for (const [rank, data] of Object.entries(errorPatterns.specificRanks)) {
        if (data.total > 3 && data.errors / data.total > 0.4) {
          const sysValues = COUNT_SYSTEMS.hilo?.values || {};
          const val = sysValues[rank] || 0;
          tips.push(`La carta ${rank} te cuesta: recuerda que vale ${val > 0 ? '+' : ''}${val} en Hi-Lo.`);
        }
      }
    }
  }

  // Exámenes
  if (stats.exam.scores.length > 0) {
    const avg = stats.exam.scores.reduce((s, sc) => s + sc, 0) / stats.exam.scores.length;
    if (avg < 70) {
      tips.push('Tus puntajes de examen son bajos. Enfócate en el modo práctica antes de intentar exámenes.');
    }
  }

  // Progreso general
  if (stats.totalSessions === 0) {
    tips.push('Bienvenido. Comienza con velocidad lenta y ayuda activada.');
  } else if (stats.totalSessions < 5) {
    tips.push('Sigue practicando regularmente. La consistencia es clave.');
  }

  return tips;
}

/**
 * Calcula el progreso hacia un objetivo (ej: 95% de precisión).
 *
 * @param {Object} stats - Estadísticas.
 * @param {number} targetAccuracy - Precisión objetivo (ej: 95).
 * @returns {Object} Información de progreso.
 */
function progressToGoal(stats, targetAccuracy = 95) {
  const totalAttempts = stats.totalCorrect + stats.totalIncorrect;
  if (totalAttempts === 0) {
    return { current: 0, target: targetAccuracy, progress: 0, remaining: 'N/A' };
  }

  const current = accuracy(stats.totalCorrect, totalAttempts);
  const remaining = Math.max(0, targetAccuracy - current);

  return {
    current,
    target: targetAccuracy,
    progress: Math.round((current / targetAccuracy) * 100),
    remaining
  };
}

/**
 * Genera datos para una gráfica de progreso.
 *
 * @param {Array<{ date: string, accuracy: number }>} history - Historial.
 * @param {number} limit - Máximo de puntos.
 * @returns {Array<{ label: string, value: number }>} Datos para gráfica.
 */
function chartDataFromHistory(history, limit = 30) {
  const recent = history.slice(0, limit).reverse();
  return recent.map((h, i) => ({
    label: `#${i + 1}`,
    value: h.accuracy,
    date: h.date
  }));
}

/* ====================================================================
   EXPORTS
   ==================================================================== */

export {
  accuracy,
  cardsPerMinute,
  timePerCard,
  maxStreak,
  formatDuration,
  formatTimer,
  standardDeviation,
  improvementTrend,
  generateGlobalReport,
  generateExamReport,
  generateRecommendations,
  progressToGoal,
  chartDataFromHistory
};

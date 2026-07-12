/**
 * trainer.js — Motor de entrenamiento
 *
 * Responsabilidad: Gestionar todos los modos de entrenamiento:
 * conteo rápido, examen, práctica adaptativa, y la IA que detecta
 * patrones de error para adaptar los ejercicios.
 *
 * Coordinador principal entre deck.js, stats.js y storage.js.
 */

import {
  Shoe, Card,
  COUNT_SYSTEMS,
  LOW_RANKS, MID_RANKS, HIGH_RANKS,
  calculateInitialCount, randBetween, formatCount
} from './deck.js';

import {
  loadStats, saveStats, updateRapidStats, updateExamStats,
  updatePracticeStats, saveErrorPatterns, loadErrorPatterns
} from './storage.js';

/* ====================================================================
   CLASE RAPID_TRAINER (Conteo Rápido)
   ==================================================================== */

/**
 * Entrenador de conteo rápido: reparte cartas a velocidad configurable
 * y pregunta periódicamente por el conteo corriente o verdadero.
 *
 * @property {Shoe} shoe - Zapato actual.
 * @property {string} systemId - Sistema de conteo activo.
 * @property {number} speed - Velocidad en ms entre cartas.
 * @property {boolean} running - Si está activo.
 * @property {Object} state - Estado de la sesión.
 */
class RapidTrainer {
  /**
   * @param {string} systemId - ID del sistema de conteo.
   * @param {number} numDecks - Número de mazos.
   */
  constructor(systemId, numDecks) {
    this.systemId = systemId;
    this.numDecks = numDecks;
    this.shoe = new Shoe(numDecks, systemId);
    this.speed = 1800;
    this.running = false;
    this.timer = null;
    this._cardIndex = 0;

    this.state = {
      startTime: null,
      cardsDealt: 0,
      correct: 0,
      attempts: 0,
      streak: 0,
      bestStreak: 0,
      quizEvery: [5, 9],
      nextQuizAt: 0,
      quizActive: false,
      currentAnswer: null,
      lastCard: null
    };
  }

  /** Inicia el entrenamiento. */
  start() {
    this.running = true;
    this.state.startTime = Date.now();
    this._drawCard();
    this._startTimer();
  }

  /** Pausa el entrenamiento. */
  pause() {
    this.running = false;
    clearInterval(this.timer);
  }

  /** Reinicia completamente. */
  reset() {
    this.pause();
    this.shoe = new Shoe(this.numDecks, this.systemId);
    this.state = {
      startTime: null,
      cardsDealt: 0,
      correct: 0,
      attempts: 0,
      streak: 0,
      bestStreak: 0,
      quizEvery: [5, 9],
      nextQuizAt: 0,
      quizActive: false,
      currentAnswer: null,
      lastCard: null
    };
    this._cardIndex = 0;
  }

  /** Cambia la velocidad. */
  setSpeed(ms) {
    this.speed = ms;
    if (this.running) {
      clearInterval(this.timer);
      this._startTimer();
    }
  }

  /** Inicia el timer de reparto. */
  _startTimer() {
    this.timer = setInterval(() => {
      if (this.state.quizActive) return;
      this._drawCard();
    }, this.speed);
  }

  /** Reparte la siguiente carta. */
  _drawCard() {
    if (this.shoe.cards.length === 0) {
      this.shoe.reset();
      this._cardIndex = 0;
    }

    const card = this.shoe.deal();
    if (!card) return;

    this.state.cardsDealt++;
    this._cardIndex++;
    this.state.lastCard = card;

    // Verificar si es momento de quiz
    if (this.state.cardsDealt >= this.state.nextQuizAt) {
      this._triggerQuiz();
    }

    return card;
  }

  /** Dispara un quiz. */
  _triggerQuiz() {
    this.state.quizActive = true;
    clearInterval(this.timer);
    this.timer = null;

    const sys = COUNT_SYSTEMS[this.systemId];
    if (sys.usesTrueCount) {
      this.state.currentAnswer = this.shoe.getTrueCount();
    } else {
      this.state.currentAnswer = this.shoe.runningCount;
    }
  }

  /**
   * Envía la respuesta del usuario.
   * @param {number} userAnswer - Respuesta del usuario.
   * @returns {Object} Resultado del quiz.
   */
  submitAnswer(userAnswer) {
    this.state.attempts++;
    const correct = this.state.currentAnswer;

    // Comparación con tolerancia para conteo verdadero (0.5 de margen)
    const isCorrect = Math.abs(userAnswer - correct) < 0.55;

    if (isCorrect) {
      this.state.correct++;
      this.state.streak++;
      this.state.bestStreak = Math.max(this.state.bestStreak, this.state.streak);
    } else {
      this.state.streak = 0;
    }

    return {
      isCorrect,
      userAnswer,
      correctAnswer: correct,
      card: this.state.lastCard,
      runningCount: this.shoe.runningCount,
      trueCount: this.shoe.getTrueCount(),
      category: this.state.lastCard?.getCategory()
    };
  }

  /** Resuelve el quiz y continúa. */
  dismissQuiz() {
    this.state.quizActive = false;
    this.state.nextQuizAt = this._cardIndex + randBetween(
      this.state.quizEvery[0],
      this.state.quizEvery[1]
    );
    if (this.running) {
      this._startTimer();
    }
  }

  /**
   * Finaliza la sesión y guarda estadísticas.
   * @returns {Object} Datos de la sesión para storage.
   */
  finish() {
    this.pause();
    const duration = this.state.startTime
      ? Date.now() - this.state.startTime
      : 0;

    const sessionData = {
      duration,
      cardsDealt: this.state.cardsDealt,
      correct: this.state.correct,
      attempts: this.state.attempts,
      bestStreak: this.state.bestStreak
    };

    updateRapidStats(sessionData);
    return sessionData;
  }

  /**
   * Obtiene el estado actual para la UI.
   * @returns {Object} Estado formateado.
   */
  getState() {
    const sys = COUNT_SYSTEMS[this.systemId];
    return {
      running: this.running,
      cardsDealt: this.state.cardsDealt,
      totalCards: this.shoe.totalCards,
      penetration: this.shoe.getPenetration(),
      runningCount: this.shoe.runningCount,
      trueCount: this.shoe.getTrueCount(),
      decksRemaining: this.shoe.getDecksRemaining(),
      accuracy: this.state.attempts > 0
        ? Math.round(this.state.correct / this.state.attempts * 100)
        : 0,
      streak: this.state.streak,
      bestStreak: this.state.bestStreak,
      cpm: this.state.startTime
        ? Math.round(this.state.cardsDealt / ((Date.now() - this.state.startTime) / 60000))
        : 0,
      quizActive: this.state.quizActive,
      lastCard: this.state.lastCard,
      quizAnswer: this.state.currentAnswer,
      usesTrueCount: sys.usesTrueCount
    };
  }
}

/* ====================================================================
   CLASE EXAM_TRAINER (Modo Examen)
   ==================================================================== */

/**
 * Modo examen: 100 cartas sin ayudas, cronómetro, reporte completo.
 *
 * @property {Shoe} shoe - Zapato.
 * @property {Object} state - Estado del examen.
 */
class ExamTrainer {
  /**
   * @param {string} systemId - Sistema de conteo.
   * @param {number} numDecks - Número de mazos.
   */
  constructor(systemId, numDecks) {
    this.systemId = systemId;
    this.numDecks = numDecks;
    this.shoe = new Shoe(numDecks, systemId);
    this.totalQuestions = 100;

    this.state = {
      active: false,
      cardIndex: 0,
      correct: 0,
      answers: [],
      startTime: null,
      endTime: null,
      trueCountEnabled: true,
      decksRemainingEnabled: false
    };
  }

  /** Inicia el examen. */
  start(options = {}) {
    this.state = {
      active: true,
      cardIndex: 0,
      correct: 0,
      answers: [],
      startTime: Date.now(),
      endTime: null,
      trueCountEnabled: options.trueCount !== false,
      decksRemainingEnabled: options.decksRemaining || false
    };
    this.shoe.reset();
    return this._nextCard();
  }

  /** Reparte la siguiente carta del examen. */
  _nextCard() {
    if (this.state.cardIndex >= this.totalQuestions) return null;

    const card = this.shoe.deal();
    this.state.cardIndex++;

    return {
      card,
      runningCount: this.shoe.runningCount,
      trueCount: this.shoe.getTrueCount(),
      decksRemaining: this.shoe.getDecksRemaining(),
      progress: this.state.cardIndex,
      total: this.totalQuestions
    };
  }

  /**
   * Registra una respuesta del examen.
   * @param {string} type - Tipo de pregunta ('count'|'trueCount'|'decks').
   * @param {number} answer - Respuesta del usuario.
   * @returns {Object} Resultado.
   */
  submitAnswer(type, answer) {
    if (!this.state.active) return null;

    let correct, correctValue, label;

    switch (type) {
      case 'count':
        correctValue = this.shoe.runningCount;
        correct = Math.abs(answer - correctValue) < 0.55;
        label = 'Conteo corriente';
        break;
      case 'trueCount':
        correctValue = this.shoe.getTrueCount();
        correct = Math.abs(answer - correctValue) < 0.55;
        label = 'Conteo verdadero';
        break;
      case 'decks':
        correctValue = this.shoe.getDecksRemaining();
        correct = Math.abs(answer - correctValue) < 0.55;
        label = 'Mazos restantes';
        break;
      default:
        return null;
    }

    if (correct) this.state.correct++;

    const result = {
      type,
      label,
      userAnswer: answer,
      correctAnswer: correctValue,
      isCorrect: correct,
      card: this.shoe.cards.length > 0 ? this.shoe.cards[this.shoe.cards.length - 1] : null
    };

    this.state.answers.push(result);
    return result;
  }

  /** Avanza a la siguiente pregunta. */
  nextQuestion() {
    if (this.state.cardIndex >= this.totalQuestions) {
      return this.finish();
    }
    return this._nextCard();
  }

  /** Finaliza el examen y genera el reporte. */
  finish() {
    this.state.active = false;
    this.state.endTime = Date.now();
    const duration = this.state.endTime - this.state.startTime;

    // Generar reporte por categoría
    const categoryBreakdown = { low: {}, mid: {}, high: {} };
    for (const a of this.state.answers) {
      if (a.card) {
        const cat = a.card.getCategory();
        if (!categoryBreakdown[cat]) {
          categoryBreakdown[cat] = { correct: 0, total: 0 };
        }
        categoryBreakdown[cat].total++;
        if (a.isCorrect) categoryBreakdown[cat].correct++;
      }
    }

    const report = {
      score: Math.round((this.state.correct / this.state.answers.length) * 100),
      correct: this.state.correct,
      total: this.state.answers.length,
      duration,
      cpm: Math.round((this.state.answers.length / (duration / 60000))),
      timePerCard: Math.round(duration / this.state.answers.length),
      categories: categoryBreakdown,
      accuracyByType: {
        count: 0,
        trueCount: 0,
        decks: 0
      },
      answers: this.state.answers.slice(-20) // últimas 20 para detalles
    };

    // Calcular precisión por tipo
    for (const type of ['count', 'trueCount', 'decks']) {
      const typed = this.state.answers.filter(a => a.type === type);
      if (typed.length > 0) {
        report.accuracyByType[type] = Math.round(
          (typed.filter(a => a.isCorrect).length / typed.length) * 100
        );
      }
    }

    updateExamStats(report);
    return report;
  }
}

/* ====================================================================
   CLASE PRACTICE_TRAINER (Práctica Adaptativa)
   ==================================================================== */

/**
 * Entrenador de práctica adaptativa con IA que detecta
 * patrones de error y ajusta los ejercicios.
 *
 * @property {Shoe} shoe - Zapato.
 * @property {string} mode - Modo actual.
 * @property {Object} errorPatterns - Patrones de error detectados.
 */
class PracticeTrainer {
  /**
   * @param {string} systemId - Sistema de conteo.
   * @param {number} numDecks - Número de mazos.
   */
  constructor(systemId, numDecks) {
    this.systemId = systemId;
    this.numDecks = numDecks;
    this.shoe = new Shoe(numDecks, systemId);
    this.errorPatterns = loadErrorPatterns();
    this.runningCount = calculateInitialCount(systemId, numDecks);

    this.state = {
      active: false,
      startTime: null,
      cardsProcessed: 0,
      correct: 0,
      incorrect: 0,
      streak: 0,
      bestStreak: 0,
      currentCard: null,
      expectedValue: null,
      categoryAccuracy: {
        low: { correct: 0, total: 0 },
        mid: { correct: 0, total: 0 },
        high: { correct: 0, total: 0 }
      }
    };
  }

  /** Inicia la práctica. */
  start(mode = 'adaptive') {
    this.state = {
      active: true,
      startTime: Date.now(),
      cardsProcessed: 0,
      correct: 0,
      incorrect: 0,
      streak: 0,
      bestStreak: 0,
      currentCard: null,
      expectedValue: null,
      categoryAccuracy: {
        low: { correct: 0, total: 0 },
        mid: { correct: 0, total: 0 },
        high: { correct: 0, total: 0 }
      }
    };
    this.runningCount = calculateInitialCount(this.systemId, this.numDecks);
    this.mode = mode;
    this._generateNextCard();
  }

  /**
   * Genera la siguiente carta usando la IA adaptativa.
   */
  _generateNextCard() {
    let forcedCategory = null;
    let forcedRank = null;

    switch (this.mode) {
      case 'focused':
        // Enfocar en la categoría con más errores
        forcedCategory = this._findWorstCategory();
        break;

      case 'adaptive':
        // IA: seleccionar basado en patrones de error
        const decision = this._adaptiveDecision();
        forcedCategory = decision.category;
        forcedRank = decision.rank;
        break;

      case 'truecount':
        // No forzar categoría, pero preguntar conteo verdadero
        break;

      default: // random
        break;
    }

    this.state.currentCard = this.shoe.generateRandomCard(
      this.systemId,
      forcedCategory,
      forcedRank
    );
    this.state.expectedValue = this.state.currentCard.countValue;

    // Actualizar conteo en práctica
    this.runningCount += this.state.currentCard.countValue;
    return this.state.currentCard;
  }

  /**
   * IA: decide qué carta mostrar basándose en patrones de error.
   * @returns {{ category: string|null, rank: string|null }}
   */
  _adaptiveDecision() {
    const pats = this.errorPatterns;

    // Calcular tasas de error por categoría
    const rates = {};
    for (const cat of ['low', 'mid', 'high']) {
      const p = pats[cat];
      rates[cat] = p.total > 0 ? p.errors / p.total : 0;
    }

    // Verificar rangos específicos
    const worstRank = this._findWorstRank();

    // Decisión: si hay un rango muy malo, forzarlo
    if (worstRank && worstRank.rate > 0.4) {
      return { category: null, rank: worstRank.rank };
    }

    // Si una categoría tiene alta tasa de error, enfocarse
    const worstCat = Object.entries(rates)
      .sort((a, b) => b[1] - a[1])[0];

    if (worstCat[1] > 0.3) {
      return { category: worstCat[0], rank: null };
    }

    // Si todo está bien, mostrar aleatorio
    return { category: null, rank: null };
  }

  /**
   * Encuentra el rango específico con mayor tasa de error.
   * @returns {{ rank: string, rate: number }|null}
   */
  _findWorstRank() {
    const specific = this.errorPatterns.specificRanks || {};
    let worst = null;
    let maxRate = 0;

    for (const [rank, data] of Object.entries(specific)) {
      if (data.total > 2 && data.errors / data.total > maxRate) {
        maxRate = data.errors / data.total;
        worst = { rank, rate: maxRate };
      }
    }

    return worst;
  }

  /**
   * Encuentra la categoría con mayor tasa de error.
   * @returns {string} Categoría ('low'|'mid'|'high').
   */
  _findWorstCategory() {
    const cats = this.state.categoryAccuracy;
    const rates = {};
    for (const [cat, data] of Object.entries(cats)) {
      rates[cat] = data.total > 0 ? 1 - (data.correct / data.total) : 0;
    }
    const worst = Object.entries(rates).sort((a, b) => b[1] - a[1])[0];
    return worst[1] > 0 ? worst[0] : null;
  }

  /**
   * Procesa la respuesta del usuario.
   * @param {number} userValue - Valor que el usuario ingresó.
   * @returns {Object} Resultado.
   */
  submitAnswer(userValue) {
    if (!this.state.active) return null;

    this.state.cardsProcessed++;
    const isCorrect = Math.abs(userValue - this.state.expectedValue) < 0.55;
    const category = this.state.currentCard.getCategory();
    const rank = this.state.currentCard.rank;

    if (isCorrect) {
      this.state.correct++;
      this.state.streak++;
      this.state.bestStreak = Math.max(this.state.bestStreak, this.state.streak);
    } else {
      this.state.incorrect++;
      this.state.streak = 0;
    }

    // Actualizar precisión por categoría
    if (this.state.categoryAccuracy[category]) {
      this.state.categoryAccuracy[category].total++;
      if (isCorrect) this.state.categoryAccuracy[category].correct++;
    }

    // Actualizar patrones de error globales
    this._updateErrorPatterns(category, rank, !isCorrect);

    this._generateNextCard();

    return {
      isCorrect,
      userValue,
      expectedValue: this.state.expectedValue,
      card: this.state.currentCard,
      category,
      rank,
      runningCount: this.runningCount,
      trueCount: this.runningCount / Math.max(0.5, (this.numDecks * 52 - this.state.cardsProcessed) / 52)
    };
  }

  /**
   * Actualiza los patrones de error globales.
   * @param {string} category - Categoría de la carta.
   * @param {string} rank - Rango de la carta.
   * @param {boolean} isError - Si fue un error.
   */
  _updateErrorPatterns(category, rank, isError) {
    const pats = this.errorPatterns;

    // Actualizar categoría
    if (!pats[category]) pats[category] = { errors: 0, total: 0 };
    pats[category].total++;
    if (isError) pats[category].errors++;

    // Actualizar rango específico
    if (!pats.specificRanks[rank]) {
      pats.specificRanks[rank] = { errors: 0, total: 0 };
    }
    pats.specificRanks[rank].total++;
    if (isError) pats.specificRanks[rank].errors++;

    saveErrorPatterns(pats);
  }

  /**
   * Detiene la práctica y guarda estadísticas.
   * @returns {Object} Datos de la sesión.
   */
  stop() {
    this.state.active = false;
    const duration = this.state.startTime
      ? Date.now() - this.state.startTime
      : 0;

    const sessionData = {
      duration,
      cards: this.state.cardsProcessed,
      correct: this.state.correct,
      incorrect: this.state.incorrect,
      bestStreak: this.state.bestStreak,
      categoryAccuracy: this.state.categoryAccuracy
    };

    updatePracticeStats(sessionData);
    return sessionData;
  }

  /**
   * Obtiene el estado actual para la UI.
   * @returns {Object} Estado formateado.
   */
  getState() {
    return {
      active: this.state.active,
      cardsProcessed: this.state.cardsProcessed,
      accuracy: this.state.cardsProcessed > 0
        ? Math.round(this.state.correct / this.state.cardsProcessed * 100)
        : 0,
      streak: this.state.streak,
      bestStreak: this.state.bestStreak,
      currentCard: this.state.currentCard,
      expectedValue: this.state.expectedValue,
      categoryAccuracy: this.state.categoryAccuracy,
      mode: this.mode,
      runningCount: this.runningCount,
      duration: this.state.startTime
        ? Date.now() - this.state.startTime
        : 0
    };
  }
}

/* ====================================================================
   EXPORTS
   ==================================================================== */

export {
  RapidTrainer,
  ExamTrainer,
  PracticeTrainer
};

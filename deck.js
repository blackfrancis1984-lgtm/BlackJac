/**
 * deck.js — Gestión de baraja y sistemas de conteo
 *
 * Responsabilidad: Construcción de zapato, barajado, reparto,
 * cálculo de valores de conteo según el sistema seleccionado,
 * y gestión del estado del zapato (penetración, mazos restantes).
 *
 * Soporta múltiples sistemas de conteo con arquitectura extensible.
 */

/* ====================================================================
   CONSTANTES
   ==================================================================== */

/** Números y palos de una baraja estándar. */
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = [
  { symbol: '♠', color: 'black', name: 'spades' },
  { symbol: '♣', color: 'black', name: 'clubs' },
  { symbol: '♥', color: 'red',   name: 'hearts' },
  { symbol: '♦', color: 'red',   name: 'diamonds' }
];

/** Valor blackjack estándar para cada rango. */
const BJ_VALUES = {
  'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10
};

/** Rangos de cartas agrupados por su comportamiento de conteo. */
const LOW_RANKS  = ['2', '3', '4', '5', '6'];
const MID_RANKS  = ['7', '8', '9'];
const HIGH_RANKS = ['10', 'J', 'Q', 'K', 'A'];

/* ====================================================================
   SISTEMAS DE CONTEO
   ==================================================================== */

/**
 * Registro de sistemas de conteo disponibles.
 * Cada sistema define los valores de conteo por rango y propiedades
 * adicionales (si usa conteo verdadero, valor inicial, etc.).
 *
 * @typedef {Object} CountSystem
 * @property {string} id - Identificador único del sistema.
 * @property {string} name - Nombre legible para la UI.
 * @property {Object.<string, number>} values - Mapa rango → valor de conteo.
 * @property {boolean} usesTrueCount - Si el conteo corriente se normaliza a verdadero.
 * @property {number} initialCount - Conteo inicial (para KO es ≠ 0).
 * @property {string} description - Descripción breve del sistema.
 */

const COUNT_SYSTEMS = {
  hilo: {
    id: 'hilo',
    name: 'Hi-Lo',
    values: {
      '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
      '7': 0, '8': 0, '9': 0,
      '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1
    },
    usesTrueCount: true,
    initialCount: 0,
    description: 'El sistema más popular. Las cartas 2-6 valen +1, 7-9 valen 0, 10-A valen −1. Conteo balanceado (inicia y termina en 0 con mazo completo).'
  },

  ko: {
    id: 'ko',
    name: 'KO (Knock-Out)',
    values: {
      '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, '7': 1,
      '8': 0, '9': 0,
      '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1
    },
    usesTrueCount: false,
    initialCount: -4 * 6 + 4, // ≈ -20 para 6 mazos; se calcula dinámicamente
    description: 'No requiere convertir a conteo verdadero. El 7 vale +1, lo que simplifica el conteo. Conteo no balanceado.'
  },

  omega2: {
    id: 'omega2',
    name: 'Omega II',
    values: {
      '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
      '7': 0, '8': 0, '9': -1,
      '10': -2, 'J': -2, 'Q': -2, 'K': -2, 'A': 0
    },
    usesTrueCount: true,
    initialCount: 0,
    description: 'Sistema de nivel 2 con mayor correlación de apuesta. El 9 vale −1 y 10-K valen −2. Los Ases se cuentan por separado para eficiencia de apuestas.'
  },

  zen: {
    id: 'zen',
    name: 'Zen Count',
    values: {
      '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
      '7': 0, '8': 0, '9': 0,
      '10': -2, 'J': -2, 'Q': -2, 'K': -2, 'A': -1
    },
    usesTrueCount: true,
    initialCount: 0,
    description: 'Similar a Omega II pero con nivel 2 simplificado. Excelente para eficiencia de apuestas. El As vale −1 (no 0).'
  },

  halves: {
    id: 'halves',
    name: 'Wong Halves',
    values: {
      '2': 0.5, '3': 1, '4': 1, '5': 1.5, '6': 1,
      '7': 0.5, '8': 0, '9': -0.5,
      '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1
    },
    usesTrueCount: true,
    initialCount: 0,
    description: 'El sistema más preciso conocido. Usa medios puntos, lo que requiere más concentración pero ofrece la mayor eficiencia de conteo.'
  },

  red7: {
    id: 'red7',
    name: 'Red Seven',
    values: {
      '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
      '7': 0, '8': 0, '9': 0,
      '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1
    },
    usesTrueCount: false,
    initialCount: -2 * 6, // -12 para 6 mazos (2 cartas de 7 rojo por mazo)
    description: 'Variación del Hi-Lo donde solo los 7 rojos (corazones y diamantes) valen +1. No requiere conversión a conteo verdadero.'
  }
};

/**
 * Calcula el conteo inicial para un sistema no balanceado.
 * Para KO: cada 7 (6 por mazo) vale +1, balance debe ser negativo.
 * Para Red Seven: cada 7 rojo (2 por mazo) vale +1.
 *
 * @param {string} systemId - ID del sistema.
 * @param {number} numDecks - Número de mazos.
 * @returns {number} Conteo inicial.
 */
function calculateInitialCount(systemId, numDecks) {
  const sys = COUNT_SYSTEMS[systemId];
  if (!sys || sys.usesTrueCount) return 0;

  switch (systemId) {
    case 'ko':
      // Cada mazo tiene 4 sietes → 4 per mazo * numDecks
      return -4 * numDecks;
    case 'red7':
      // Cada mazo tiene 2 sietes rojos → 2 per mazo * numDecks
      return -2 * numDecks;
    default:
      return 0;
  }
}

/* ====================================================================
   CLASE CARD
   ==================================================================== */

/**
 * Representa una carta individual con su valor en el sistema de conteo activo.
 */
class Card {
  /**
   * @param {string} rank - Rango de la carta (A, 2-10, J, Q, K).
   * @param {string} suit - Palo visual (♠, ♣, ♥, ♦).
   * @param {string} color - Color de la carta ('red' o 'black').
   * @param {number} countValue - Valor de conteo según el sistema actual.
   * @param {number} bjValue - Valor para blackjack (A=11, figuras=10).
   */
  constructor(rank, suit, color, countValue, bjValue) {
    this.rank = rank;
    this.suit = suit;
    this.color = color;
    this.countValue = countValue;
    this.bjValue = bjValue;
  }

  /**
   * Devuelve la categoría de conteo de esta carta.
   * @returns {'low'|'mid'|'high'}
   */
  getCategory() {
    if (LOW_RANKS.includes(this.rank)) return 'low';
    if (MID_RANKS.includes(this.rank)) return 'mid';
    return 'high';
  }

  /**
   * Formatea la carta para HTML (vista frontal).
   * @param {boolean} showValue - Si debe mostrar el valor de conteo.
   * @param {number} countValue - Valor de conteo de esta carta.
   * @returns {string} HTML de la carta.
   */
  toHTML(showValue, countValue) {
    const valueClass = countValue > 0 ? 'v-plus' : (countValue < 0 ? 'v-minus' : 'v-zero');
    const valueLabel = countValue > 0 ? `+${countValue}` : String(countValue);
    const hint = showValue ? `<div class="card-hint ${valueClass}">${valueLabel}</div>` : '';

    return `
      ${hint}
      <div class="rank-top">${this.rank}<br>${this.suit}</div>
      <div class="suit-mid">${this.suit}</div>
      <div class="rank-bottom">${this.rank}<br>${this.suit}</div>
    `;
  }
}

/* ====================================================================
   CLASE SHOE (ZAPATO)
   ==================================================================== */

/**
 * Representa un zapato de cartas con uno o más mazos.
 * Gestiona construcción, barajado, reparto y estado de penetración.
 */
class Shoe {
  /**
   * @param {number} numDecks - Número de mazos (1-8).
   * @param {string} systemId - ID del sistema de conteo activo.
   */
  constructor(numDecks, systemId) {
    this.numDecks = numDecks;
    this.systemId = systemId;
    this.totalCards = numDecks * 52;
    this.cards = [];
    this.runningCount = calculateInitialCount(systemId, numDecks);
    this.cardsDealt = 0;
    this.build();
    this.shuffle();
  }

  /** Construye las cartas del zapato. */
  build() {
    const sys = COUNT_SYSTEMS[this.systemId];
    this.cards = [];

    for (let d = 0; d < this.numDecks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          // Para Red Seven: 7 rojo vale +1, 7 negro vale 0
          let countValue = sys.values[rank];
          if (this.systemId === 'red7' && rank === '7' && suit.color === 'red') {
            countValue = 1;
          }

          this.cards.push(
            new Card(rank, suit.symbol, suit.color, countValue, BJ_VALUES[rank])
          );
        }
      }
    }
  }

  /** Baraja el zapato usando Fisher-Yates (parcial, simula shuffle real). */
  shuffle() {
    const deck = this.cards;
    // Fisher-Yates moderno
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  /**
   * Reparte una carta del zapato.
   * @returns {Card|null} La carta repartida, o null si el zapato está vacío.
   */
  deal() {
    if (this.cards.length === 0) return null;
    const card = this.cards.pop();
    this.cardsDealt++;
    this.runningCount += card.countValue;
    return card;
  }

  /**
   * Devuelve el número de mazos restantes (aproximado).
   * @returns {number} Mazos restantes (mínimo 0.5).
   */
  getDecksRemaining() {
    return Math.max(0.5, (this.totalCards - this.cardsDealt) / 52);
  }

  /**
   * Calcula el conteo verdadero.
   * @returns {number} Conteo verdadero redondeado a 1 decimal.
   */
  getTrueCount() {
    const sys = COUNT_SYSTEMS[this.systemId];
    if (!sys.usesTrueCount) return this.runningCount;
    return this.runningCount / this.getDecksRemaining();
  }

  /**
   * Porcentaje de penetración del zapato.
   * @returns {number} Porcentaje (0-100).
   */
  getPenetration() {
    return (this.cardsDealt / this.totalCards) * 100;
  }

  /**
   * Estima la ventaja del jugador basada en el conteo verdadero.
   * Fórmula aproximada: ventaja ≈ (TC - 1) * 0.5% para Hi-Lo.
   * @returns {number} Ventaja en porcentaje.
   */
  getPlayerEdge() {
    const tc = this.getTrueCount();
    // Fórmula genérica simplificada (funciona bien para Hi-Lo)
    return Math.max(-2, (tc - 1) * 0.5);
  }

  /**
   * Sugiere la apuesta en unidades basándose en el conteo verdadero.
   * @returns {{ bet: string, units: number }} Sugerencia de apuesta.
   */
  getSuggestedBet() {
    const tc = this.getTrueCount();
    let units, betText;

    if (tc < 0) {
      units = 1;
      betText = '1 unidad (mínima)';
    } else if (tc < 1) {
      units = 1;
      betText = '1 unidad';
    } else if (tc < 2) {
      units = 2;
      betText = '2 unidades';
    } else if (tc < 3) {
      units = 4;
      betText = '4 unidades';
    } else if (tc < 4) {
      units = 6;
      betText = '6 unidades';
    } else if (tc < 5) {
      units = 8;
      betText = '8 unidades';
    } else {
      units = Math.min(12, Math.ceil(tc * 2));
      betText = `${units}+ unidades`;
    }

    return { bet: betText, units };
  }

  /** Reinicia el zapato con los parámetros actuales. */
  reset() {
    this.cardsDealt = 0;
    this.runningCount = calculateInitialCount(this.systemId, this.numDecks);
    this.build();
    this.shuffle();
  }

  /**
   * Genera una carta aleatoria para modo práctica (no afecta el zapato).
   * @param {string} [systemId] - Sistema de conteo alternativo.
   * @param {string} [forcedCategory] - Categoría forzada ('low'|'mid'|'high').
   * @returns {Card} Una carta generada.
   */
  generateRandomCard(systemId, forcedCategory) {
    const sys = systemId ? COUNT_SYSTEMS[systemId] : COUNT_SYSTEMS[this.systemId];
    const sid = systemId || this.systemId;

    let rank;
    if (forcedCategory === 'low') {
      rank = LOW_RANKS[Math.floor(Math.random() * LOW_RANKS.length)];
    } else if (forcedCategory === 'mid') {
      rank = MID_RANKS[Math.floor(Math.random() * MID_RANKS.length)];
    } else if (forcedCategory === 'high') {
      rank = HIGH_RANKS[Math.floor(Math.random() * HIGH_RANKS.length)];
    } else {
      rank = RANKS[Math.floor(Math.random() * RANKS.length)];
    }

    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    let countValue = sys.values[rank];
    if (sid === 'red7' && rank === '7' && suit.color === 'red') {
      countValue = 1;
    }

    return new Card(rank, suit.symbol, suit.color, countValue, BJ_VALUES[rank]);
  }
}

/* ====================================================================
   FUNCIONES AUXILIARES
   ==================================================================== */

/**
 * Calcula el valor total de una mano de blackjack.
 * Maneja automáticamente los Ases como 1 o 11.
 *
 * @param {Card[]} cards - Array de cartas en la mano.
 * @returns {number} Valor total de la mano.
 */
function calculateHandTotal(cards) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += card.bjValue;
    if (card.rank === 'A') aces++;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

/**
 * Determina si una mano es "soft" (contiene un As que cuenta como 11).
 *
 * @param {Card[]} cards - Array de cartas en la mano.
 * @returns {boolean} True si la mano es soft.
 */
function isSoftHand(cards) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += card.bjValue;
    if (card.rank === 'A') aces++;
  }

  return aces > 0 && total <= 21;
}

/**
 * Verifica si una mano es blackjack natural.
 *
 * @param {Card[]} cards - Array de cartas (debe tener exactamente 2).
 * @returns {boolean} True si es blackjack.
 */
function isBlackjack(cards) {
  if (cards.length !== 2) return false;
  const total = calculateHandTotal(cards);
  return total === 21;
}

/**
 * Número aleatorio entre dos valores (inclusive).
 *
 * @param {number} a - Límite inferior.
 * @param {number} b - Límite superior.
 * @returns {number} Entero aleatorio.
 */
function randBetween(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

/**
 * Formatea un número con signo (+N o −N o N).
 *
 * @param {number} n - Número.
 * @returns {string} Número formateado.
 */
function formatCount(n) {
  if (n > 0) return `+${n}`;
  return String(n);
}

/* ====================================================================
   EXPORTS
   ==================================================================== */

export {
  RANKS, SUITS, BJ_VALUES,
  LOW_RANKS, MID_RANKS, HIGH_RANKS,
  COUNT_SYSTEMS,
  calculateInitialCount,
  Card,
  Shoe,
  calculateHandTotal,
  isSoftHand,
  isBlackjack,
  randBetween,
  formatCount
};

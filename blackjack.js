/**
 * blackjack.js — Lógica del juego de blackjack
 *
 * Responsabilidad: Implementar las reglas completas de blackjack,
 * incluyendo decisiones del dealer, bots de jugadores,
 * y gestión de estados de mano.
 *
 * Este módulo es puramente lógica de juego; no maneja UI.
 */

import {
  Shoe, Card,
  calculateHandTotal, isSoftHand, isBlackjack,
  LOW_RANKS, MID_RANKS, HIGH_RANKS,
  RANKS, SUITS, BJ_VALUES
} from './deck.js';

/* ====================================================================
   CONSTANTES DE ESTADO
   ==================================================================== */

/** Estados posibles de una mano de blackjack. */
const HAND_STATES = Object.freeze({
  WAITING: 'waiting',
  PLAYING: 'playing',
  DOUBLED: 'doubled',
  SPLIT: 'split',
  STANDING: 'standing',
  BUSTED: 'busted',
  BLACKJACK: 'blackjack',
  INSURANCE: 'insurance',
  SURRENDERED: 'surrendered',
  PUSH: 'push'
});

/** Estados posibles del dealer. */
const DEALER_STATES = Object.freeze({
  WAITING: 'waiting',
  DEALING: 'dealing',
  HIDDEN: 'hidden',
  PLAYING: 'playing',
  BUSTED: 'busted',
  STANDING: 'standing',
  BLACKJACK: 'blackjack'
});

/* ====================================================================
   CLASE PLAYER
   ==================================================================== */

/**
 * Representa un jugador (humano o bot) en la mesa.
 *
 * @property {string} name - Nombre del jugador.
 * @property {boolean} isHuman - Si es el jugador real.
 * @property {Card[]} hand - Cartas en la mano.
 * @property {Card[]} secondHand - Cartas de mano split (si aplica).
 * @property {string} state - Estado actual de la mano.
 * @property {number} bet - Apuesta en unidades.
 * @property {number} score - Puntuación total de la mano.
 * @property {boolean} isSoft - Si la mano es soft.
 */
class Player {
  constructor(name, isHuman = false) {
    this.name = name;
    this.isHuman = isHuman;
    this.hand = [];
    this.secondHand = [];
    this.state = HAND_STATES.WAITING;
    this.bet = 1;
    this.score = 0;
    this.isSoft = false;
    this._hasSplit = false;
    this._activeHand = 0; // 0 = main, 1 = split
  }

  /** Recibe una carta en la mano activa. */
  receiveCard(card) {
    const target = this._activeHand === 0 ? this.hand : this.secondHand;
    target.push(card);
    this._updateScore();
  }

  /** Actualiza la puntuación de la mano activa. */
  _updateScore() {
    const target = this._activeHand === 0 ? this.hand : this.secondHand;
    this.score = calculateHandTotal(target);
    this.isSoft = isSoftHand(target);
  }

  /** Retorna a la mano principal después de un split. */
  switchToMainHand() {
    this._activeHand = 0;
    this._updateScore();
  }

  /** Cambia a la segunda mano después de un split. */
  switchToSplitHand() {
    this._activeHand = 1;
    this._updateScore();
  }

  /**
   * Ejecuta una decisión del jugador.
   * @param {'hit'|'stand'|'double'|'surrender'} action - Acción.
   * @param {Shoe} shoe - Zapato de cartas.
   */
  takeAction(action, shoe) {
    switch (action) {
      case 'hit':
        if (this.state !== HAND_STATES.PLAYING) return;
        const hitCard = shoe.deal();
        if (hitCard) {
          this.receiveCard(hitCard);
          if (this.score > 21) {
            this.state = HAND_STATES.BUSTED;
          }
        }
        break;

      case 'stand':
        this.state = HAND_STATES.STANDING;
        break;

      case 'double':
        this.state = HAND_STATES.DOUBLED;
        const doubleCard = shoe.deal();
        if (doubleCard) {
          this.receiveCard(doubleCard);
          if (this.score > 21) {
            this.state = HAND_STATES.BUSTED;
          }
        }
        break;

      case 'surrender':
        this.state = HAND_STATES.SURRENDERED;
        break;
    }
  }

  /**
   * Decisión automática para bots (estrategia básica simplificada).
   * @param {Card} dealerUpCard - Carta visible del dealer.
   * @param {Shoe} shoe - Zapato de cartas.
   */
  botDecision(dealerUpCard, shoe) {
    if (this.state !== HAND_STATES.PLAYING) return;

    const dealerValue = dealerUpCard ? dealerUpCard.bjValue : 10;
    const total = this.score;

    // Estrategia básica simplificada
    if (this.isSoft) {
      // Manos soft
      if (total <= 17) {
        this.takeAction('hit', shoe);
      } else if (total === 18) {
        // Stand contra 2-8, hit contra 9-A
        if (dealerValue >= 9 && dealerValue <= 11) {
          this.takeAction('hit', shoe);
        } else {
          this.takeAction('stand', shoe);
        }
      } else {
        this.takeAction('stand', shoe);
      }
    } else {
      // Manos hard
      if (total <= 8) {
        this.takeAction('hit', shoe);
      } else if (total === 9) {
        // Double vs 3-6, hit otherwise
        if (dealerValue >= 3 && dealerValue <= 6) {
          this.takeAction('double', shoe);
        } else {
          this.takeAction('hit', shoe);
        }
      } else if (total === 10) {
        // Double vs 2-9
        if (dealerValue >= 2 && dealerValue <= 9) {
          this.takeAction('double', shoe);
        } else {
          this.takeAction('hit', shoe);
        }
      } else if (total === 11) {
        this.takeAction('double', shoe);
      } else if (total <= 16) {
        // Stand vs 2-6, hit vs 7-A
        if (dealerValue >= 2 && dealerValue <= 6) {
          this.takeAction('stand', shoe);
        } else {
          this.takeAction('hit', shoe);
        }
      } else {
        this.takeAction('stand', shoe);
      }
    }
  }

  /** Reinicia el jugador para una nueva mano. */
  reset() {
    this.hand = [];
    this.secondHand = [];
    this.state = HAND_STATES.WAITING;
    this.bet = 1;
    this.score = 0;
    this.isSoft = false;
    this._hasSplit = false;
    this._activeHand = 0;
  }

  /**
   * Formatea el estado para display.
   * @returns {string} Texto del estado.
   */
  getStateText() {
    const map = {
      [HAND_STATES.WAITING]: 'Esperando',
      [HAND_STATES.PLAYING]: 'Jugando',
      [HAND_STATES.DOUBLED]: 'Doblando',
      [HAND_STATES.SPLIT]: 'Dividido',
      [HAND_STATES.STANDING]: 'Plantado',
      [HAND_STATES.BUSTED]: 'Pasado',
      [HAND_STATES.BLACKJACK]: 'Blackjack',
      [HAND_STATES.INSURANCE]: 'Seguro',
      [HAND_STATES.SURRENDERED]: 'Rendido',
      [HAND_STATES.PUSH]: 'Empate'
    };
    return map[this.state] || this.state;
  }
}

/* ====================================================================
   CLASE DEALER
   ==================================================================== */

/**
 * Representa la casa (dealer) en la mesa.
 *
 * @property {Card[]} hand - Cartas del dealer.
 * @property {string} state - Estado del dealer.
 * @property {number} score - Puntuación.
 * @property {boolean} soft17 - Si el dealer se planta en soft 17.
 */
class Dealer {
  constructor(soft17 = true) {
    this.hand = [];
    this.state = DEALER_STATES.WAITING;
    this.score = 0;
    this.isSoft = false;
    this.soft17 = soft17;
  }

  /** Recibe una carta. */
  receiveCard(card) {
    this.hand.push(card);
    this.score = calculateHandTotal(this.hand);
    this.isSoft = isSoftHand(this.hand);
  }

  /**
   * Reparte las dos cartas iniciales del dealer.
   * La segunda carta permanece oculta.
   * @param {Shoe} shoe - Zapato de cartas.
   * @returns {Card} Segunda carta (oculta).
   */
  dealInitial(shoe) {
    const card1 = shoe.deal();
    const card2 = shoe.deal();

    this.hand = [];
    this.state = DEALER_STATES.DEALING;

    if (card1) this.receiveCard(card1);

    // Solo registrar la segunda carta, no actualizar score aún
    const hiddenCard = card2;
    this._hiddenCard = hiddenCard;

    return hiddenCard;
  }

  /**
   * Revela la segunda carta del dealer.
   * @param {Card} hiddenCard - La carta oculta.
   */
  reveal(hiddenCard) {
    if (hiddenCard) {
      this.receiveCard(hiddenCard);
    }

    // Verificar si tiene blackjack
    if (this.score === 21 && this.hand.length === 2) {
      this.state = DEALER_STATES.BLACKJACK;
    } else {
      this.state = DEALER_STATES.PLAYING;
    }
  }

  /**
   * Juega la mano del dealer según las reglas.
   * @param {Shoe} shoe - Zapato de cartas.
   */
  play(shoe) {
    if (this.state === DEALER_STATES.BLACKJACK) return;

    this.state = DEALER_STATES.PLAYING;

    while (this.score < 17 || (this.isSoft && this.score === 17 && !this.soft17)) {
      const card = shoe.deal();
      if (!card) break;
      this.receiveCard(card);
    }

    if (this.score > 21) {
      this.state = DEALER_STATES.BUSTED;
    } else {
      this.state = DEALER_STATES.STANDING;
    }
  }

  /** Reinicia el dealer. */
  reset() {
    this.hand = [];
    this.state = DEALER_STATES.WAITING;
    this.score = 0;
    this.isSoft = false;
    this._hiddenCard = null;
  }

  /**
   * Determina el resultado de una mano del jugador contra el dealer.
   * @param {Player} player - Jugador a evaluar.
   * @returns {{ result: string, payout: number }} Resultado y pago.
   */
  evaluate(player) {
    const pScore = player.score;
    const dScore = this.score;
    const dBJ = this.state === DEALER_STATES.BLACKJACK;
    const pBJ = player.state === HAND_STATES.BLACKJACK;

    // Hand estado especial
    if (player.state === HAND_STATES.BUSTED) {
      return { result: 'Busted', payout: -1 };
    }
    if (player.state === HAND_STATES.SURRENDERED) {
      return { result: 'Surrender', payout: -0.5 };
    }

    // Blackjack natural del jugador
    if (pBJ) {
      if (dBJ) {
        return { result: 'Push', payout: 0 };
      }
      return { result: 'Blackjack!', payout: 1.5 };
    }

    // Dealer se pasó
    if (dScore > 21) {
      if (player.state === HAND_STATES.DOUBLED) {
        return { result: 'Ganaste (double)', payout: 2 };
      }
      return { result: 'Ganaste', payout: 1 };
    }

    // Comparación directa
    if (pScore > dScore) {
      if (player.state === HAND_STATES.DOUBLED) {
        return { result: 'Ganaste (double)', payout: 2 };
      }
      return { result: 'Ganaste', payout: 1 };
    } else if (pScore === dScore) {
      return { result: 'Empate', payout: 0 };
    } else {
      if (player.state === HAND_STATES.DOUBLED) {
        return { result: 'Perdiste (double)', payout: -2 };
      }
      return { result: 'Perdiste', payout: -1 };
    }
  }

  /**
   * Obtiene el estado visual del dealer.
   * @returns {string} Texto del estado.
   */
  getStateText() {
    const map = {
      [DEALER_STATES.WAITING]: 'Esperando',
      [DEALER_STATES.DEALING]: 'Repartiendo',
      [DEALER_STATES.HIDDEN]: 'Carta oculta',
      [DEALER_STATES.PLAYING]: 'Jugando',
      [DEALER_STATES.BUSTED]: 'Bust',
      [DEALER_STATES.STANDING]: 'Plantado',
      [DEALER_STATES.BLACKJACK]: 'Blackjack'
    };
    return map[this.state] || this.state;
  }
}

/* ====================================================================
   CLASE ROUND (MANO)
   ==================================================================== */

/**
 * Representa una mano completa de blackjack.
 * Orquesta el reparto, decisiones de bots, y evaluación.
 */
class Round {
  /**
   * @param {Shoe} shoe - Zapato de cartas.
   * @param {Dealer} dealer - Instancia del dealer.
   * @param {Player[]} players - Array de jugadores.
   * @param {Object} [options] - Opciones de la mano.
   * @param {boolean} [options.dealerSoft17] - Dealer planta en S17.
   * @param {boolean} [options.surrender] - Permitir surrender.
   * @param {boolean} [options.insurance] - Permitir seguro.
   */
  constructor(shoe, dealer, players, options = {}) {
    this.shoe = shoe;
    this.dealer = dealer;
    this.players = players;
    this.dealerSoft17 = options.dealerSoft17 !== undefined ? options.dealerSoft17 : true;
    this.surrenderAllowed = options.surrender || false;
    this.insuranceAllowed = options.insurance || false;
    this.log = [];
  }

  /**
   * Inicia una nueva mano: reparte cartas iniciales.
   * @returns {Promise<Object>} Segunda carta oculta del dealer.
   */
  async start() {
    // Reset todos
    this.dealer.reset();
    for (const p of this.players) p.reset();

    // Marcar como jugando
    for (const p of this.players) {
      if (p.isHuman) {
        p.state = HAND_STATES.PLAYING;
      } else {
        p.state = HAND_STATES.PLAYING;
      }
    }

    this.dealer.state = DEALER_STATES.DEALING;

    // Repartir 2 rondas alternando
    for (let round = 0; round < 2; round++) {
      for (const player of this.players) {
        const card = this.shoe.deal();
        if (!card) return null;
        player.receiveCard(card);
        this.log.push(`Repartido ${card.rank}${card.suit} a ${player.name}`);
      }

      const card = this.shoe.deal();
      if (!card) return null;

      if (round === 0) {
        this.dealer.receiveCard(card);
        this.log.push(`Dealer recibe ${card.rank}${card.suit} (visible)`);
      } else {
        // Segunda carta del dealer (oculta)
        this.dealer._hiddenCard = card;
        this.log.push(`Dealer recibe carta oculta`);
      }
    }

    // Verificar blackjacks naturales
    for (const p of this.players) {
      if (isBlackjack(p.hand)) {
        p.state = HAND_STATES.BLACKJACK;
        this.log.push(`${p.name} tiene blackjack natural`);
      }
    }

    return this.dealer._hiddenCard;
  }

  /**
   * Ejecuta las decisiones de los bots automáticamente.
   * @returns {Promise<void>}
   */
  async playBots() {
    for (const player of this.players) {
      if (player.isHuman || player.state === HAND_STATES.BLACKJACK) continue;

      const dealerUpCard = this.dealer.hand[0];

      // Bot toma decisiones hasta que planta o se pasa
      while (player.state === HAND_STATES.PLAYING) {
        player.botDecision(dealerUpCard, this.shoe);
        this.log.push(`${player.name} → ${player.getStateText()} (${player.score})`);
      }
    }
  }

  /**
   * Revela la carta del dealer y completa su mano.
   */
  finishDealer() {
    const hiddenCard = this.dealer._hiddenCard;
    this.dealer.reveal(hiddenCard);
    this.log.push(`Dealer revela: ${hiddenCard?.rank || '?'}${hiddenCard?.suit || '?'}`);

    // Solo juega si ningún jugador tiene blackjack o todos plantados
    const anyPlaying = this.players.some(p => p.state === HAND_STATES.PLAYING);
    if (anyPlaying) {
      this.dealer.play(this.shoe);
      this.log.push(`Dealer termina: ${this.dealer.score} (${this.dealer.getStateText()})`);
    } else {
      this.log.push(`Dealer: ${this.dealer.score} (${this.dealer.getStateText()})`);
    }
  }

  /**
   * Evalúa los resultados de todos los jugadores.
   * @returns {Array<{ name: string, result: string, payout: number }>}
   */
  evaluate() {
    const results = [];
    for (const player of this.players) {
      const eval_result = this.dealer.evaluate(player);
      results.push({
        name: player.name,
        result: eval_result.result,
        payout: eval_result.payout
      });
      this.log.push(`${player.name}: ${eval_result.result} (${eval_result.payout > 0 ? '+' : ''}${eval_result.payout})`);
    }
    return results;
  }
}

/* ====================================================================
   EXPORTS
   ==================================================================== */

export {
  HAND_STATES, DEALER_STATES,
  Player, Dealer, Round
};

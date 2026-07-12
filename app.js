/**
 * app.js — Punto de entrada principal
 *
 * Responsabilidad: Orquestar toda la aplicación.
 * Inicializa módulos, configura eventos, y coordina
 * los modos de entrenamiento.
 *
 * Este es el único archivo que importa todos los módulos
 * y los conecta entre sí.
 */

import { COUNT_SYSTEMS, Shoe, calculateInitialCount, randBetween } from './modules/deck.js';
import { Player, Dealer, Round, HAND_STATES, DEALER_STATES } from './modules/blackjack.js';
import { RapidTrainer, ExamTrainer, PracticeTrainer } from './modules/trainer.js';
import {
  cacheDOM, switchTab, initTabs,
  openDrawer, closeDrawer, renderDrawerSystem,
  openSettings, closeSettings,
  showToast,
  showRapidCard, updateShoeVisual,
  dealCardTo, revealCard,
  updateRapidHUD, updateExamHUD, updateLiveHUD, updatePenBar,
  showQuiz, hideQuiz, showQuizFeedback,
  showExamResults, hideExamResults,
  renderSeats, updateDealerState, clearDealerCards, clearSeatHands,
  addRoundLog, updateLiveStats,
  showPracticeCard, showPracticeFeedback, updatePracticeHUD,
  getSeatName
} from './modules/ui.js';
import {
  setAnimationsEnabled, areAnimationsEnabled,
  animateDeal, animateReveal, animatePenBar
} from './modules/animations.js';
import {
  initAudio, setSoundsEnabled,
  playCardDeal, playCardReveal, playCorrect, playIncorrect,
  playChip, playButton, playShuffle, playBlackjack, playBust, playNewHand, playTick, playExamComplete
} from './modules/audio.js';
import {
  loadSettings, saveSettings, loadStats, saveStats,
  saveLastSystem, saveLastDecks, saveLastMode,
  saveErrorPatterns, loadErrorPatterns,
  exportAllData, importAllData, clearAllData
} from './modules/storage.js';
import {
  formatDuration, formatTimer, examGrade
} from './modules/stats.js';

/* ====================================================================
   ESTADO GLOBAL DE LA APP
   ==================================================================== */

/** Configuración cargada del almacenamiento. */
let appSettings = {};

/** Sistema de conteo activo. */
let currentSystemId = 'hilo';

/** Número de mazos activo. */
let currentNumDecks = 2;

/** Referencia al trainer activo del modo rápido. */
let rapidTrainer = null;

/** Referencia al trainer activo del modo examen. */
let examTrainer = null;

/** Referencia al trainer activo del modo práctica. */
let practiceTrainer = null;

/** Referencia al zapato de la mesa en vivo. */
let liveShoe = null;

/** Instancia del dealer en la mesa en vivo. */
let liveDealer = null;

/** Array de jugadores en la mesa en vivo. */
let livePlayers = [];

/** Estadísticas de la mesa en vivo. */
let liveStats = {
  handsPlayed: 0,
  handsWon: 0,
  handsLost: 0,
  handsPush: 0,
  handsBlackjack: 0,
  unitsProfit: 0
};

/** Timer para el examen. */
let examTimerInterval = null;

/** Timer para actualizar el tiempo en modo rápido. */
let rapidTimerInterval = null;

/** Timer para actualizar el tiempo en práctica. */
let practiceTimerInterval = null;

/** Si el modo examen está activo. */
let examActive = false;

/** Tiempo total del examen (15 minutos por defecto). */
const EXAM_DURATION_MS = 15 * 60 * 1000;

/** Exponer funciones auxiliares para uso desde ui.js. */
window._formatDuration = formatDuration;
window._formatTimer = formatTimer;
window._examGrade = examGrade;
window._countSystems = COUNT_SYSTEMS;

/* ====================================================================
   INICIALIZACIÓN
   ==================================================================== */

/**
 * Inicializa la aplicación completa.
 */
async function initApp() {
  // Cache del DOM
  cacheDOM();

  // Cargar configuración
  appSettings = loadSettings();

  // Aplicar configuración
  applySettings(appSettings);

  // Cargar preferencias de última sesión
  const lastSystem = loadSettings().lastSystem || 'hilo';
  const lastDecks = loadSettings().lastDecks || 2;

  // Configurar selects
  DOM.systemSelect.value = lastSystem;
  DOM.deckSelect.value = String(lastDecks);
  currentSystemId = lastSystem;
  currentNumDecks = lastDecks;

  // Renderizar drawer con sistema actual
  renderDrawerSystem(currentSystemId);

  // Inicializar trainers
  initRapidTrainer();
  initExamTrainer();
  initPracticeTrainer();
  initLiveTable();

  // Configurar tabs
  initTabs((tabId) => {
    playButton();
    saveLastMode(tabId);
  });

  // Configurar eventos
  setupEvents();

  // Renderizar estado inicial
  updateRapidHUD(rapidTrainer.getState());
  updateLiveHUD(liveShoe);

  // Exponer para service worker verificación
  window._appInitialized = true;
  console.log('[BJT] App inicializada correctamente');
}

/* ====================================================================
   CONFIGURACIÓN
   ==================================================================== */

/**
 * Aplica la configuración global.
 *
 * @param {Object} settings - Objeto de configuración.
 */
function applySettings(settings) {
  setAnimationsEnabled(settings.animations !== false);
  setSoundsEnabled(settings.sounds !== false);
}

/* ====================================================================
   EVENTOS
   ==================================================================== */

/** Configura todos los event listeners de la aplicación. */
function setupEvents() {
  // Drawer
  DOM.drawerToggle.addEventListener('click', () => {
    playButton();
    if (DOM.drawer.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  DOM.drawerClose.addEventListener('click', () => {
    closeDrawer();
  });

  // Settings
  DOM.settingsBtn.addEventListener('click', () => {
    playButton();
    openSettings();
  });

  DOM.settingsClose.addEventListener('click', closeSettings);
  DOM.settingsOverlay.addEventListener('click', closeSettings);

  // System select
  DOM.systemSelect.addEventListener('change', (e) => {
    currentSystemId = e.target.value;
    saveLastSystem(currentSystemId);
    renderDrawerSystem(currentSystemId);

    // Recrear trainers con nuevo sistema
    rapidTrainer = new RapidTrainer(currentSystemId, currentNumDecks);
    examTrainer = new ExamTrainer(currentSystemId, currentNumDecks);
    practiceTrainer = new PracticeTrainer(currentSystemId, currentNumDecks);
    liveShoe = new Shoe(currentNumDecks, currentSystemId);
    liveDealer = new Dealer(appSettings.dealerSoft17 !== 'h17');

    updateRapidHUD(rapidTrainer.getState());
    updateLiveHUD(liveShoe);
    showToast(`Sistema cambiado a ${COUNT_SYSTEMS[currentSystemId].name}`, 'info');
  });

  // Deck select
  DOM.deckSelect.addEventListener('change', (e) => {
    currentNumDecks = parseInt(e.target.value, 10);
    saveLastDecks(currentNumDecks);
    playShuffle();

    // Recrear
    rapidTrainer = new RapidTrainer(currentSystemId, currentNumDecks);
    examTrainer = new ExamTrainer(currentSystemId, currentNumDecks);
    practiceTrainer = new PracticeTrainer(currentSystemId, currentNumDecks);
    liveShoe = new Shoe(currentNumDecks, currentSystemId);

    updateRapidHUD(rapidTrainer.getState());
    updateLiveHUD(liveShoe);
    showToast(`${currentNumDecks} mazos seleccionados`, 'info');
  });

  // ===== RAPID MODE EVENTS =====
  DOM.startBtn.addEventListener('click', () => {
    initAudio();
    playCardDeal();
    rapidTrainer.start();
    DOM.startBtn.disabled = true;
    DOM.pauseBtn.disabled = false;
    rapidTimerInterval = setInterval(() => {
      const state = rapidTrainer.getState();
      updateRapidHUD(state);
    }, 500);
  });

  DOM.pauseBtn.addEventListener('click', () => {
    rapidTrainer.pause();
    DOM.startBtn.disabled = false;
    DOM.pauseBtn.disabled = true;
    clearInterval(rapidTimerInterval);
  });

  DOM.resetBtn.addEventListener('click', () => {
    playShuffle();
    rapidTrainer.reset();
    DOM.startBtn.disabled = false;
    DOM.pauseBtn.disabled = true;
    clearInterval(rapidTimerInterval);
    updateRapidHUD(rapidTrainer.getState());
  });

  DOM.speedSelect.addEventListener('change', (e) => {
    rapidTrainer.setSpeed(parseInt(e.target.value, 10));
  });

  DOM.hintToggle.addEventListener('change', () => {
    appSettings.showValues = DOM.hintToggle.checked;
    saveSettings(appSettings);
  });

  DOM.trueToggle.addEventListener('change', () => {
    appSettings.autoTrueCount = DOM.trueToggle.checked;
    saveSettings(appSettings);
  });

  // Quiz submit
  DOM.quizSubmit.addEventListener('click', () => {
    const val = parseFloat(DOM.quizInput.value);
    if (isNaN(val)) {
      DOM.quizFeedback.textContent = 'Escribe un número';
      DOM.quizFeedback.className = 'feedback-msg no';
      return;
    }

    const result = rapidTrainer.submitAnswer(val);
    const isCorrect = result.isCorrect;

    // Explicación
    let explanation = '';
    const card = result.card;
    if (card) {
      const sys = COUNT_SYSTEMS[currentSystemId];
      const valStr = card.countValue > 0 ? `+${card.countValue}` : String(card.countValue);
      if (isCorrect) {
        explanation = `Correcto. La carta ${card.rank}${card.suit} vale ${valStr} en ${sys.name}.`;
      } else {
        explanation = `La carta ${card.rank}${card.suit} vale ${valStr} en ${sys.name}. El conteo corriente es ${result.runningCount}.`;
      }
    }

    showQuizFeedback(isCorrect, result.correctAnswer, result.userAnswer, explanation);

    if (isCorrect) {
      playCorrect();
    } else {
      playIncorrect();
    }

    // Auto-dismiss
    setTimeout(() => {
      hideQuiz();
      rapidTrainer.dismissQuiz();
      updateRapidHUD(rapidTrainer.getState());
    }, isCorrect ? 1000 : 1800);
  });

  DOM.quizInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') DOM.quizSubmit.click();
  });

  // ===== EXAM MODE EVENTS =====
  DOM.examStartBtn.addEventListener('click', () => {
    initAudio();
    playShuffle();
    startExam({
      trueCount: DOM.examTrueCount.checked,
      decksRemaining: DOM.examDecksRemaining.checked
    });
  });

  DOM.examSubmit.addEventListener('click', () => {
    const val = parseFloat(DOM.examInput.value);
    if (isNaN(val)) return;
    submitExamAnswer(val);
  });

  DOM.examInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') DOM.examSubmit.click();
  });

  DOM.examRetry.addEventListener('click', () => {
    hideExamResults();
    DOM.examStartOverlay.style.display = 'flex';
  });

  // ===== LIVE MODE EVENTS =====
  DOM.dealBtn.addEventListener('click', () => {
    initAudio();
    playNewHand();
    dealHand();
  });

  DOM.newShoeBtn.addEventListener('click', () => {
    playShuffle();
    liveShoe = new Shoe(currentNumDecks, currentSystemId);
    liveDealer = new Dealer(appSettings.dealerSoft17 !== 'h17');
    liveStats = { handsPlayed: 0, handsWon: 0, handsLost: 0, handsPush: 0, handsBlackjack: 0, unitsProfit: 0 };
    updateLiveStats(0, 0, 0, 0, 0);
    updateLiveHUD(liveShoe);
    DOM.roundLog.innerHTML = '';
    clearDealerCards();
    clearSeatHands();
    showToast('Nuevo zapato repartido', 'info');
  });

  DOM.seatsCount.addEventListener('change', () => {
    renderSeatsForLive();
  });

  // ===== PRACTICE MODE EVENTS =====
  DOM.practiceStartBtn.addEventListener('click', () => {
    initAudio();
    const mode = DOM.practiceMode.value;
    practiceTrainer.start(mode);
    DOM.practiceStartBtn.disabled = true;
    DOM.practiceStopBtn.disabled = false;
    DOM.practiceSubtitle.textContent = `Modo: ${DOM.practiceMode.options[DOM.practiceMode.selectedIndex].text}`;
    playCardDeal();

    practiceTimerInterval = setInterval(() => {
      const state = practiceTrainer.getState();
      updatePracticeHUD(state);
    }, 500);
  });

  DOM.practiceStopBtn.addEventListener('click', () => {
    const session = practiceTrainer.stop();
    DOM.practiceStartBtn.disabled = false;
    DOM.practiceStopBtn.disabled = true;
    clearInterval(practiceTimerInterval);
    showToast(`Sesión completada: ${session.correct + session.incorrect} cartas`, 'ok');
  });

  // Practice buttons
  DOM.practiceBtns.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-practice');
    if (!btn) return;
    const val = parseInt(btn.dataset.val, 10);
    submitPracticeAnswer(val);
  });

  // ===== SETTINGS EVENTS =====
  // Export/Import/Clear
  DOM.exportStatsBtn.addEventListener('click', () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bjt_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Estadísticas exportadas', 'ok');
  });

  DOM.importStatsBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (importAllData(ev.target.result)) {
          showToast('Estadísticas importadas correctamente', 'ok');
        } else {
          showToast('Error al importar', 'no');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  DOM.resetStatsBtn.addEventListener('click', () => {
    if (confirm('¿Estás seguro de borrar todas las estadísticas? Esta acción no se puede deshacer.')) {
      clearAllData();
      showToast('Todas las estadísticas han sido borradas', 'info');
    }
  });

  // First interaction audio init
  document.addEventListener('click', () => initAudio(), { once: true });
  document.addEventListener('touchstart', () => initAudio(), { once: true });
}

/* ====================================================================
   MODO RÁPIDO — RENDERIZADO
   ==================================================================== */

/**
 * Inicializa el trainer de conteo rápido.
 */
function initRapidTrainer() {
  rapidTrainer = new RapidTrainer(currentSystemId, currentNumDecks);
}

/**
 * Hook: se llama cada vez que se reparte una carta en modo rápido.
 * Se conecta al estado del trainer para mostrar la carta.
 */
function onRapidCardDrawn(card) {
  if (!card) return;

  const showValue = appSettings.showValues !== false;
  showRapidCard(card, showValue);
  updateShoeVisual(
    rapidTrainer.shoe.cards.length,
    rapidTrainer.shoe.totalCards
  );

  // Mostrar hint bubble si está activado
  if (appSettings.showValues !== false && DOM.hintBubble) {
    const val = card.countValue;
    const label = val > 0 ? `+${val}` : String(val);
    const cls = val > 0 ? 'v-plus' : (val < 0 ? 'v-minus' : 'v-zero');
    // No usar animate directamente, usar CSS
  }

  playCardDeal();
}

/* ====================================================================
   MODO EXAMEN
   ==================================================================== */

/**
 * Inicializa el trainer de examen.
 */
function initExamTrainer() {
  examTrainer = new ExamTrainer(currentSystemId, currentNumDecks);
}

/**
 * Inicia el examen.
 * @param {Object} options - Opciones del examen.
 */
function startExam(options) {
  examActive = true;
  DOM.examStartOverlay.style.display = 'none';

  const first = examTrainer.start(options);
  if (first) {
    showExamCard(first);
  }

  // Timer del examen
  let timeLeft = EXAM_DURATION_MS;
  updateExamHUD(1, examTrainer.totalQuestions, timeLeft);

  examTimerInterval = setInterval(() => {
    timeLeft -= 1000;
    if (timeLeft <= 0) {
      finishExam();
      return;
    }
    updateExamHUD(examTrainer.state.cardIndex + 1, examTrainer.totalQuestions, timeLeft, timeLeft < 60000);
    if (timeLeft < 60000 && timeLeft % 10000 < 1000) {
      playTick();
    }
  }, 1000);
}

/**
 * Muestra la siguiente carta del examen.
 * @param {Object} data - Datos de la carta.
 */
function showExamCard(data) {
  DOM.examFront.className = `card-face card-front ${data.card.color}`;
  DOM.examFront.innerHTML = data.card.toHTML(false, data.card.countValue);
  DOM.examCard.classList.remove('flip');
  void DOM.examCard.offsetWidth;
  DOM.examCard.classList.add('flip');
  DOM.examInput.value = '';
  DOM.examInput.focus();
  playCardDeal();
}

/**
 * Envía una respuesta del examen.
 * @param {number} val - Respuesta del usuario.
 */
function submitExamAnswer(val) {
  if (!examActive) return;

  const state = examTrainer.state;

  // Determinar qué tipo de pregunta es
  const sys = COUNT_SYSTEMS[currentSystemId];
  let type = 'count';

  if (sys.usesTrueCount && state.cardIndex % 2 === 0 && examTrainer.state.trueCountEnabled) {
    type = 'trueCount';
  }

  const result = examTrainer.submitAnswer(type, val);

  if (result) {
    if (result.isCorrect) {
      playCorrect();
    } else {
      playIncorrect();
    }
  }

  // Avanzar
  const next = examTrainer.nextQuestion();

  if (!next) {
    finishExam();
  } else {
    showExamCard(next);
  }
}

/**
 * Finaliza el examen y muestra resultados.
 */
function finishExam() {
  examActive = false;
  clearInterval(examTimerInterval);

  DOM.examInputZone.style.display = 'none';
  DOM.examCard.style.display = 'none';

  const report = examTrainer.finish();
  showExamResults(report);
  playExamComplete();
}

/* ====================================================================
   MODO MESA EN VIVO
   ==================================================================== */

/**
 * Inicializa la mesa en vivo.
 */
function initLiveTable() {
  liveShoe = new Shoe(currentNumDecks, currentSystemId);
  liveDealer = new Dealer(appSettings.dealerSoft17 !== 'h17');
  renderSeatsForLive();
}

/**
 * Renderiza los asientos según la configuración actual.
 */
function renderSeatsForLive() {
  const count = parseInt(DOM.seatsCount.value, 10);
  const names = [];

  for (let i = 0; i < count; i++) {
    if (i === 2) {
      names.push('TÚ');
    } else {
      names.push(getSeatName(i));
    }
  }

  renderSeats(names, names.indexOf('TÚ'));

  // Crear jugadores
  livePlayers = names.map((name, i) => new Player(name, name === 'TÚ'));
}

/**
 * Reparte una mano completa en la mesa en vivo.
 */
async function dealHand() {
  DOM.dealBtn.disabled = true;

  // Limpiar
  clearDealerCards();
  clearSeatHands();
  updateDealerState('Repartiendo', null);

  // Crear round
  const round = new Round(
    liveShoe,
    liveDealer,
    livePlayers,
    { dealerSoft17: appSettings.dealerSoft17 !== 'h17' }
  );

  // Repartir inicial
  await round.start();

  // Mostrar cartas en UI
  // Dealer primera carta
  if (liveDealer.hand.length > 0) {
    dealCardTo(DOM.dealerCards, liveDealer.hand[0], true, false);
    await delay(200);
  }

  // Dealer segunda carta (oculta)
  const hiddenCard = liveDealer._hiddenCard;
  if (hiddenCard) {
    const hiddenEl = dealCardTo(DOM.dealerCards, hiddenCard, false, false);
    await delay(200);
  }

  // Cartas de jugadores
  for (const player of livePlayers) {
    const seatEl = document.getElementById(`seat-${player.name}`);
    if (!seatEl) continue;
    const handEl = seatEl.querySelector('.seat-hand');
    const totalEl = seatEl.querySelector('.seat-total');

    for (let i = 0; i < player.hand.length; i++) {
      dealCardTo(handEl, player.hand[i], true, false);
      totalEl.textContent = player.score;
      await delay(250);
    }
  }

  // Verificar blackjacks
  for (const player of livePlayers) {
    if (player.state === HAND_STATES.BLACKJACK) {
      const seatEl = document.getElementById(`seat-${player.name}`);
      if (seatEl) {
        seatEl.querySelector('.seat-total').textContent = 'BJ';
        seatEl.querySelector('.seat-total').style.color = 'var(--gold-bright)';
      }
      playBlackjack();
    }
  }

  // Bots juegan
  await round.playBots();

  // Actualizar UI de bots
  for (const player of livePlayers) {
    if (player.isHuman || player.state === HAND_STATES.BLACKJACK) continue;
    const seatEl = document.getElementById(`seat-${player.name}`);
    if (!seatEl) continue;
    const totalEl = seatEl.querySelector('.seat-total');
    totalEl.textContent = player.score > 21 ? 'BUST' : player.score;
  }

  // Dealer revela
  const dealerBack = DOM.dealerCards.children[1];
  if (dealerBack) {
    await animateReveal(dealerBack, 300);
  }
  updateDealerState(liveDealer.getStateText(), liveDealer.score);

  // Dealer juega
  round.finishDealer();
  updateDealerState(liveDealer.getStateText(), liveDealer.score);

  // Si dealer se pasó, sonido
  if (liveDealer.score > 21) {
    playBust();
  }

  // Evaluar
  const results = round.evaluate();

  // Actualizar stats
  for (const r of results) {
    liveStats.handsPlayed++;

    if (r.payout > 0) {
      if (r.result.includes('Blackjack')) {
        liveStats.handsBlackjack++;
        playBlackjack();
      }
      liveStats.handsWon++;
    } else if (r.payout < 0) {
      liveStats.handsLost++;
    } else {
      liveStats.handsPush++;
    }

    liveStats.unitsProfit += r.payout;

    if (r.name === 'TÚ') {
      addRoundLog(`Mano ${liveStats.handsPlayed}: ${r.result} (${r.payout > 0 ? '+' : ''}${r.payout}) · RC: ${liveShoe.runningCount} · TC: ${liveShoe.getTrueCount().toFixed(1)}`);
    }

    // Actualizar UI del asiento
    const seatEl = document.getElementById(`seat-${r.name}`);
    if (seatEl) {
      const totalEl = seatEl.querySelector('.seat-total');
      totalEl.textContent = `${r.result} (${r.payout > 0 ? '+' : ''}${r.payout})`;
      totalEl.style.color = r.payout > 0
        ? 'var(--good-bright)'
        : r.payout < 0
          ? 'var(--bad-bright)'
          : 'var(--gold-bright)';
    }
  }

  // Guardar stats
  import('./modules/storage.js').then(m => {
    for (const r of results) {
      m.updateLiveStats({
        result: r.result,
        payout: r.payout,
        runningCount: liveShoe.runningCount,
        trueCount: liveShoe.getTrueCount()
      });
    }
  });

  updateLiveStats(liveStats.handsPlayed, liveStats.handsWon, liveStats.handsLost, liveStats.handsBlackjack, liveStats.unitsProfit);
  updateLiveHUD(liveShoe);

  DOM.dealBtn.disabled = false;
}

/**
 * Función auxiliar de delay.
 * @param {number} ms - Milisegundos.
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ====================================================================
   MODO PRÁCTICA
   ==================================================================== */

/**
 * Inicializa el trainer de práctica.
 */
function initPracticeTrainer() {
  practiceTrainer = new PracticeTrainer(currentSystemId, currentNumDecks);
}

/**
 * Procesa una respuesta del modo práctica.
 * @param {number} val - Valor ingresado por el usuario.
 */
function submitPracticeAnswer(val) {
  if (!practiceTrainer || !practiceTrainer.state.active) return;

  const result = practiceTrainer.submitAnswer(val);
  if (!result) return;

  // Mostrar carta
  showPracticeCard(result.card);

  // Feedback
  if (result.isCorrect) {
    playCorrect();
    showPracticeFeedback(true, `✔ Correcto: ${result.card.rank}${result.card.suit} = ${result.expectedValue > 0 ? '+' : ''}${result.expectedValue}`);
  } else {
    playIncorrect();
    showPracticeFeedback(false, `✘ Era ${result.expectedValue > 0 ? '+' : ''}${result.expectedValue}`);
  }

  // Auto-clear feedback
  setTimeout(() => {
    DOM.practiceFeedback.textContent = '';
  }, 1500);

  // Actualizar HUD
  updatePracticeHUD(practiceTrainer.getState());
}

/* ====================================================================
   PWA — Service Worker Registration
   ==================================================================== */

/**
 * Registra el service worker para soporte offline.
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./service-worker.js')
      .then(registration => {
        console.log('[BJT] Service Worker registrado:', registration.scope);

        // Verificar actualizaciones
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nueva versión disponible
              showToast('Nueva versión disponible. Recarga para actualizar.', 'info', 8000);
            }
          });
        });
      })
      .catch(err => {
        console.warn('[BJT] Error registrando Service Worker:', err);
      });
  }
}

/* ====================================================================
   PWA — Install Prompt
   ==================================================================== */

/** Evento deferred de instalación PWA. */
let _deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredPrompt = e;

  // Opcional: mostrar botón de instalación
  const installBtn = document.createElement('button');
  installBtn.className = 'btn btn-gold btn-lg';
  installBtn.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:999;';
  installBtn.textContent = '📱 Instalar App';
  installBtn.addEventListener('click', async () => {
    if (_deferredPrompt) {
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('App instalada correctamente', 'ok');
      }
      installBtn.remove();
      _deferredPrompt = null;
    }
  });
  document.body.appendChild(installBtn);
});

window.addEventListener('appinstalled', () => {
  console.log('[BJT] App instalada exitosamente');
  _deferredPrompt = null;
});

/* ====================================================================
   INICIO
   ==================================================================== */

// Registrar service worker
registerServiceWorker();

// Iniciar app cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

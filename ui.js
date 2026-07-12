/**
 * ui.js — Gestión de interfaz de usuario
 *
 * Responsabilidad: Renderizar cartas, actualizar HUD, manejar tabs,
 * drawer, modal, toasts, y todos los elementos de la interfaz.
 *
 * No contiene lógica de juego ni almacenamiento.
 * Solo manipulación del DOM y renderizado visual.
 */

/* ====================================================================
   REFERENCIAS DEL DOM (cacheadas para rendimiento)
   ==================================================================== */

let DOM = {};

/**
 * Cachea todas las referencias del DOM.
 * Se llama una vez al inicio de la app.
 */
function cacheDOM() {
  DOM = {
    // Tabs
    tabs: document.getElementById('mainTabs'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    panels: document.querySelectorAll('.tab-panel'),

    // Header controls
    deckSelect: document.getElementById('deckSelect'),
    systemSelect: document.getElementById('systemSelect'),
    drawerToggle: document.getElementById('drawerToggle'),
    settingsBtn: document.getElementById('settingsBtn'),

    // Drawer
    drawer: document.getElementById('drawer'),
    drawerClose: document.getElementById('drawerClose'),
    hiloTable: document.getElementById('hiloTable'),
    systemDesc: document.getElementById('systemDesc'),
    drawerTitle: document.getElementById('drawerTitle'),

    // Settings modal
    settingsModal: document.getElementById('settingsModal'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsClose: document.getElementById('settingsClose'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),

    // Rapid tab
    rapidCard: document.getElementById('flashCard'),
    rapidFront: document.getElementById('flashFront'),
    rapidShoe: document.getElementById('shoeRapid'),
    rapidShoeStack: document.getElementById('shoeStackRapid'),
    quizOverlay: document.getElementById('quizOverlay'),
    quizTitle: document.getElementById('quizTitle'),
    quizInstruction: document.getElementById('quizInstruction'),
    quizInput: document.getElementById('quizInput'),
    quizSubmit: document.getElementById('quizSubmit'),
    quizFeedback: document.getElementById('quizFeedback'),
    quizExplanation: document.getElementById('quizExplanation'),
    hintBubble: document.getElementById('hintBubble'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    speedSelect: document.getElementById('speedSelect'),
    hintToggle: document.getElementById('hintToggle'),
    trueToggle: document.getElementById('trueToggle'),

    // Stats
    statAcc: document.getElementById('statAcc'),
    statStreak: document.getElementById('statStreak'),
    statBest: document.getElementById('statBest'),
    statCards: document.getElementById('statCards'),
    statCpm: document.getElementById('statCpm'),
    statTime: document.getElementById('statTime'),
    penBarRapid: document.getElementById('penBarRapid'),
    penPercentRapid: document.getElementById('penPercentRapid'),

    // Exam tab
    examCard: document.getElementById('examCard'),
    examFront: document.getElementById('examFront'),
    examTimer: document.getElementById('examTimer'),
    examProgress: document.getElementById('examProgress'),
    examInputZone: document.getElementById('examInputZone'),
    examInput: document.getElementById('examInput'),
    examSubmit: document.getElementById('examSubmit'),
    examResults: document.getElementById('examResults'),
    examSummary: document.getElementById('examSummary'),
    examDetails: document.getElementById('examDetails'),
    examRetry: document.getElementById('examRetry'),
    examStartOverlay: document.getElementById('examStartOverlay'),
    examStartBtn: document.getElementById('examStartBtn'),
    examTrueCount: document.getElementById('examTrueCount'),
    examDecksRemaining: document.getElementById('examDecksRemaining'),

    // Live tab
    liveHud: {
      running: document.getElementById('liveRunning'),
      true: document.getElementById('liveTrue'),
      decksLeft: document.getElementById('liveDecksLeft'),
      cardsSeen: document.getElementById('liveCardsSeen'),
      penetration: document.getElementById('livePenetration'),
      edge: document.getElementById('liveEdge')
    },
    betSuggestion: document.getElementById('betSuggestion'),
    dealBtn: document.getElementById('dealBtn'),
    newShoeBtn: document.getElementById('newShoeBtn'),
    seatsCount: document.getElementById('seatsCount'),
    dealerSoft17: document.getElementById('dealerSoft17'),
    dealerArea: document.getElementById('dealerArea'),
    dealerCards: document.getElementById('dealerCards'),
    dealerTotal: document.getElementById('dealerTotal'),
    dealerState: document.getElementById('dealerState'),
    seatsRow: document.getElementById('seatsRow'),
    handsPlayed: document.getElementById('handsPlayed'),
    handsWon: document.getElementById('handsWon'),
    handsLost: document.getElementById('handsLost'),
    handsBj: document.getElementById('handsBj'),
    unitsProfit: document.getElementById('unitsProfit'),
    penBarLive: document.getElementById('penBarLive'),
    penPercentLive: document.getElementById('penPercentLive'),
    roundLog: document.getElementById('roundLog'),

    // Practice tab
    practiceStartBtn: document.getElementById('practiceStartBtn'),
    practiceStopBtn: document.getElementById('practiceStopBtn'),
    practiceMode: document.getElementById('practiceMode'),
    practiceCard: document.getElementById('practiceCard'),
    practiceFront: document.getElementById('practiceFront'),
    practiceBtns: document.getElementById('practiceBtns'),
    practiceFeedback: document.getElementById('practiceFeedback'),
    practiceSubtitle: document.getElementById('practiceSubtitle'),
    accLow: document.getElementById('accLow'),
    accMid: document.getElementById('accMid'),
    accHigh: document.getElementById('accHigh'),
    practiceAcc: document.getElementById('practiceAcc'),
    practiceStreak: document.getElementById('practiceStreak'),
    practiceCount: document.getElementById('practiceCount'),
    practiceTime: document.getElementById('practiceTime')
  };
}

/* ====================================================================
   TABS
   ==================================================================== */

/**
 * Cambia la pestaña activa.
 * @param {string} tabId - ID de la pestaña ('rapid'|'exam'|'live'|'practice').
 */
function switchTab(tabId) {
  // Actualizar botones
  DOM.tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Actualizar paneles
  DOM.panels.forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabId}`);
  });
}

/**
 * Configura los event listeners de las pestañas.
 * @param {Function} callback - Callback(tabId).
 */
function initTabs(callback) {
  DOM.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      callback(btn.dataset.tab);
    });
  });
}

/* ====================================================================
   DRAWER
   ==================================================================== */

/** Abre el drawer de la guía. */
function openDrawer() {
  DOM.drawer.classList.add('open');
}

/** Cierra el drawer. */
function closeDrawer() {
  DOM.drawer.classList.remove('open');
}

/**
 * Renderiza la tabla Hi-Lo según el sistema seleccionado.
 * @param {string} systemId - ID del sistema de conteo.
 */
function renderDrawerSystem(systemId) {
  // Los datos del sistema se pasan desde deck.js en app.js
  // Esta función solo renderiza el HTML
  const systems = window._countSystems;
  if (!systems || !systems[systemId]) return;

  const sys = systems[systemId];
  DOM.drawerTitle.textContent = `Valores ${sys.name}`;
  DOM.systemDesc.textContent = sys.description;

  // Agrupar rangos por valor
  const valueGroups = {};
  for (const [rank, val] of Object.entries(sys.values)) {
    const key = String(val);
    if (!valueGroups[key]) valueGroups[key] = [];
    valueGroups[key].push(rank);
  }

  // Renderizar tabla
  const valOrder = Object.keys(valueGroups).sort((a, b) => parseFloat(b) - parseFloat(a));
  let html = '';
  for (const val of valOrder) {
    const ranks = valueGroups[val].join(', ');
    const valClass = parseFloat(val) > 0 ? 'v-plus' : (parseFloat(val) < 0 ? 'v-minus' : 'v-zero');
    const valLabel = parseFloat(val) > 0 ? `+${val}` : val;
    html += `<tr><td>${ranks}</td><td><span class="hilo-val ${valClass}">${valLabel}</span></td></tr>`;
  }
  DOM.hiloTable.innerHTML = html;
}

/* ====================================================================
   SETTINGS MODAL
   ==================================================================== */

/** Abre el modal de configuración. */
function openSettings() {
  DOM.settingsModal.classList.add('show');
}

/** Cierra el modal de configuración. */
function closeSettings() {
  DOM.settingsModal.classList.remove('show');
}

/* ====================================================================
   TOASTS
   ==================================================================== */

/**
 * Muestra una notificación toast.
 *
 * @param {string} message - Mensaje.
 * @param {'ok'|'no'|'info'} type - Tipo de toast.
 * @param {number} [duration=3000] - Duración en ms.
 */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, duration);
}

/* ====================================================================
   RENDERIZADO DE CARTAS
   ==================================================================== */

/**
 * Crea el HTML de una carta para la vista frontal.
 *
 * @param {Object} card - Objeto Card.
 * @param {boolean} showValue - Si mostrar el valor de conteo.
 * @param {number} countValue - Valor de conteo de la carta.
 * @returns {string} HTML de la carta.
 */
function renderCardFront(card, showValue, countValue) {
  return card.toHTML(showValue, countValue);
}

/**
 * Muestra una carta con animación flip en el modo rápido.
 *
 * @param {Object} card - Objeto Card.
 * @param {boolean} showValue - Si mostrar el valor de conteo.
 */
function showRapidCard(card, showValue) {
  DOM.rapidCard.classList.remove('flip');
  DOM.rapidFront.className = `card-face card-front ${card.color}`;
  DOM.rapidFront.innerHTML = renderCardFront(card, showValue, card.countValue);

  // Forzar reflow para reiniciar animación
  void DOM.rapidCard.offsetWidth;
  DOM.rapidCard.classList.add('flip');
}

/**
 * Actualiza el estado visual del zapato (pila de cartas).
 *
 * @param {number} remaining - Cartas restantes.
 * @param {number} total - Total de cartas.
 */
function updateShoeVisual(remaining, total) {
  const pct = remaining / total;
  const stack = DOM.rapidShoeStack;
  if (stack) {
    const maxH = 80;
    stack.style.height = `${Math.max(2, pct * maxH)}px`;
  }
}

/**
 * Muestra una carta con animación de reparto.
 *
 * @param {HTMLElement} container - Contenedor donde insertar.
 * @param {Object} card - Objeto Card.
 * @param {boolean} faceUp - Si la carta está boca arriba.
 * @param {boolean} [showValue] - Si mostrar valor de conteo.
 * @returns {HTMLElement} Elemento de carta.
 */
function dealCardTo(container, card, faceUp = true, showValue = false) {
  const el = document.createElement('div');
  el.className = 'card dealing';

  if (faceUp) {
    el.innerHTML = `
      <div class="card-face card-back">
        <div class="card-back-pattern"></div>
        <div class="card-back-center">
          <div class="card-back-diamond"></div>
        </div>
      </div>
      <div class="card-face card-front ${card.color}">
        ${renderCardFront(card, showValue, card.countValue)}
      </div>`;
    // Ya está flip (visible)
  } else {
    el.innerHTML = `
      <div class="card-face card-back">
        <div class="card-back-pattern"></div>
        <div class="card-back-center">
          <div class="card-back-diamond"></div>
        </div>
      </div>
      <div class="card-face card-front ${card.color}">
        ${renderCardFront(card, showValue, card.countValue)}
      </div>`;
  }

  container.appendChild(el);

  // Remover clase de animación después de que termine
  setTimeout(() => {
    el.classList.remove('dealing');
    el.classList.add('bounce');
    setTimeout(() => el.classList.remove('bounce'), 400);
  }, 500);

  return el;
}

/**
 * Revela una carta oculta (flip animation).
 *
 * @param {HTMLElement} cardEl - Elemento de carta.
 */
function revealCard(cardEl) {
  cardEl.classList.add('flip');
}

/* ====================================================================
   HUD - MODO RAPIDO
   ==================================================================== */

/**
 * Actualiza todas las estadísticas del modo rápido.
 *
 * @param {Object} state - Estado del trainer.
 */
function updateRapidHUD(state) {
  DOM.statAcc.textContent = state.attempts > 0
    ? `${state.accuracy}%`
    : '—';
  DOM.statStreak.textContent = state.streak;
  DOM.statBest.textContent = state.bestStreak;
  DOM.statCards.textContent = state.cardsDealt;
  DOM.statCpm.textContent = state.cpm > 0 ? state.cpm : '—';
  DOM.statTime.textContent = window._formatDuration
    ? window._formatDuration(state.startTime ? Date.now() - state.startTime : 0)
    : '0:00';

  updatePenBar(DOM.penBarRapid, state.penetration, DOM.penPercentRapid);
  updateShoeVisual(
    state.totalCards - state.cardsDealt,
    state.totalCards
  );
}

/**
 * Actualiza el HUD del modo examen.
 *
 * @param {number} progress - Progreso actual.
 * @param {number} total - Total de preguntas.
 * @param {number} timeLeft - Tiempo restante en ms.
 * @param {boolean} urgent - Si el tiempo es urgente.
 */
function updateExamHUD(progress, total, timeLeft, urgent = false) {
  DOM.examProgress.textContent = `Carta ${progress} / ${total}`;
  DOM.examTimer.textContent = window._formatTimer
    ? window._formatTimer(timeLeft)
    : '15:00';
  DOM.examTimer.classList.toggle('urgent', urgent);
}

/**
 * Actualiza el HUD del modo mesa en vivo.
 *
 * @param {Object} state - Estado del shoe.
 */
function updateLiveHUD(state) {
  DOM.liveHud.running.textContent = state.runningCount;
  DOM.liveHud.true.textContent = state.trueCount.toFixed(1);
  DOM.liveHud.decksLeft.textContent = state.decksRemaining.toFixed(1);
  DOM.liveHud.cardsSeen.textContent = state.cardsDealt;
  DOM.liveHud.penetration.textContent = `${state.penetration.toFixed(0)}%`;
  DOM.liveHud.edge.textContent = `${state.playerEdge.toFixed(1)}%`;

  const bet = state.suggestedBet;
  const betEl = DOM.betSuggestion;
  betEl.querySelector('.bet-value').textContent = bet.bet;

  updatePenBar(DOM.penBarLive, state.penetration, DOM.penPercentLive);
}

/**
 * Actualiza una barra de penetración.
 *
 * @param {HTMLElement} bar - Elemento de la barra.
 * @param {number} percent - Porcentaje.
 * @param {HTMLElement} label - Elemento de etiqueta.
 */
function updatePenBar(bar, percent, label) {
  bar.style.width = `${Math.min(100, percent).toFixed(0)}%`;
  if (label) label.textContent = `${percent.toFixed(0)}%`;
}

/* ====================================================================
   QUIZ OVERLAY
   ==================================================================== */

/**
 * Muestra el overlay de quiz.
 *
 * @param {string} question - Pregunta a mostrar.
 * @param {string} instruction - Instrucción adicional.
 */
function showQuiz(question, instruction = '') {
  DOM.quizTitle.textContent = question;
  DOM.quizInstruction.textContent = instruction;
  DOM.quizInput.value = '';
  DOM.quizFeedback.textContent = '';
  DOM.quizExplanation.textContent = '';
  DOM.quizOverlay.classList.add('show');
  DOM.quizInput.focus();
}

/** Oculta el overlay de quiz. */
function hideQuiz() {
  DOM.quizOverlay.classList.remove('show');
}

/**
 * Muestra feedback después de una respuesta.
 *
 * @param {boolean} isCorrect - Si la respuesta fue correcta.
 * @param {number} correctVal - Valor correcto.
 * @param {number} userVal - Valor del usuario.
 * @param {string} explanation - Explicación del resultado.
 */
function showQuizFeedback(isCorrect, correctVal, userVal, explanation) {
  if (isCorrect) {
    DOM.quizFeedback.textContent = `✔ Correcto: ${correctVal > 0 ? '+' : ''}${correctVal}`;
    DOM.quizFeedback.className = 'feedback-msg ok';
  } else {
    DOM.quizFeedback.textContent = `✘ Era ${correctVal > 0 ? '+' : ''}${correctVal}, pusiste ${userVal > 0 ? '+' : ''}${userVal}`;
    DOM.quizFeedback.className = 'feedback-msg no';
  }
  DOM.quizExplanation.textContent = explanation || '';
}

/* ====================================================================
   EXAM RESULTS
   ==================================================================== */

/**
 * Muestra los resultados del examen.
 *
 * @param {Object} report - Reporte del examen.
 */
function showExamResults(report) {
  DOM.examInputZone.style.display = 'none';
  DOM.examResults.classList.add('show');

  const grade = window._examGrade ? window._examGrade(report.score) : report.score + '%';

  DOM.examSummary.innerHTML = `
    <div class="stat-card"><div class="stat-label">Puntaje</div><div class="stat-value">${report.score}%</div></div>
    <div class="stat-card"><div class="stat-label">Calificación</div><div class="stat-value">${grade}</div></div>
    <div class="stat-card"><div class="stat-label">Correctas</div><div class="stat-value">${report.correct}/${report.total}</div></div>
    <div class="stat-card"><div class="stat-label">Tiempo</div><div class="stat-value">${window._formatDuration ? window._formatDuration(report.duration) : '—'}</div></div>
    <div class="stat-card"><div class="stat-label">Cartas/min</div><div class="stat-value">${report.cpm}</div></div>
    <div class="stat-card"><div class="stat-label">Tiempo/carta</div><div class="stat-value">${(report.timePerCard / 1000).toFixed(1)}s</div></div>
  `;

  // Detalles por categoría
  let detailsHTML = '<table><tr><td>Categoría</td><td>Correctas</td><td>Total</td><td>Precisión</td></tr>';
  for (const [cat, data] of Object.entries(report.categories)) {
    const catName = cat === 'low' ? 'Bajas (2-6)' : cat === 'mid' ? 'Medias (7-9)' : 'Altas (10-A)';
    const acc = data.total > 0 ? Math.round(data.correct / data.total * 100) : 0;
    detailsHTML += `<tr><td>${catName}</td><td>${data.correct}</td><td>${data.total}</td><td>${acc}%</td></tr>`;
  }
  detailsHTML += '</table>';
  DOM.examDetails.innerHTML = detailsHTML;
}

/** Oculta los resultados del examen y muestra el overlay de inicio. */
function hideExamResults() {
  DOM.examResults.classList.remove('show');
  DOM.examInputZone.style.display = 'flex';
  DOM.examStartOverlay.style.display = 'flex';
}

/* ====================================================================
   LIVE TABLE
   ==================================================================== */

/**
 * Renderiza los asientos de jugadores.
 *
 * @param {Array<string>} seatNames - Nombres de los asientos.
 * @param {number} humanIndex - Índice del jugador humano (-1 si no hay).
 */
function renderSeats(seatNames, humanIndex = -1) {
  DOM.seatsRow.innerHTML = '';
  seatNames.forEach((name, i) => {
    const seat = document.createElement('div');
    seat.className = `seat${i === humanIndex ? ' you' : ''}`;
    seat.id = `seat-${name}`;
    seat.innerHTML = `
      <div class="seat-name">${name}</div>
      <div class="seat-hand"></div>
      <div class="seat-total">—</div>
    `;
    DOM.seatsRow.appendChild(seat);
  });
}

/**
 * Actualiza el estado del dealer.
 *
 * @param {string} state - Estado del dealer.
 * @param {number} score - Puntuación.
 */
function updateDealerState(state, score) {
  DOM.dealerState.textContent = state;
  DOM.dealerTotal.textContent = score !== null ? score : '—';
}

/**
 * Limpia el área de cartas del dealer.
 */
function clearDealerCards() {
  DOM.dealerCards.innerHTML = '';
}

/**
 * Limpia todas las manos de los jugadores.
 */
function clearSeatHands() {
  const seats = DOM.seatsRow.querySelectorAll('.seat');
  seats.forEach(seat => {
    seat.querySelector('.seat-hand').innerHTML = '';
    seat.querySelector('.seat-total').textContent = '—';
  });
}

/**
 * Añade una entrada al log de rondas.
 *
 * @param {string} text - Texto de la entrada.
 */
function addRoundLog(text) {
  const entry = document.createElement('div');
  entry.textContent = text;
  DOM.roundLog.prepend(entry);

  // Limitar a 50 entradas
  while (DOM.roundLog.children.length > 50) {
    DOM.roundLog.removeChild(DOM.roundLog.lastChild);
  }
}

/**
 * Actualiza las estadísticas de la mesa en vivo.
 *
 * @param {number} played - Manos jugadas.
 * @param {number} won - Ganadas.
 * @param {number} lost - Perdidas.
 * @param {number} bj - Blackjacks.
 * @param {number} profit - Unidades de ganancia.
 */
function updateLiveStats(playeds, won, lost, bj, profit) {
  DOM.handsPlayed.textContent = playeds;
  DOM.handsWon.textContent = won;
  DOM.handsLost.textContent = lost;
  DOM.handsBj.textContent = bj;
  DOM.unitsProfit.textContent = (profit >= 0 ? '+' : '') + profit;
}

/* ====================================================================
   PRACTICE MODE
   ==================================================================== */

/**
 * Muestra una carta en el modo práctica.
 *
 * @param {Object} card - Objeto Card.
 */
function showPracticeCard(card) {
  DOM.practiceCard.classList.remove('flip');
  DOM.practiceFront.className = `card-face card-front ${card.color}`;
  DOM.practiceFront.innerHTML = renderCardFront(card, false, card.countValue);
  void DOM.practiceCard.offsetWidth;
  DOM.practiceCard.classList.add('flip');
}

/**
 * Muestra feedback en el modo práctica.
 *
 * @param {boolean} isCorrect - Si fue correcta.
 * @param {string} message - Mensaje de feedback.
 */
function showPracticeFeedback(isCorrect, message) {
  DOM.practiceFeedback.textContent = message;
  DOM.practiceFeedback.style.color = isCorrect
    ? 'var(--good-bright)'
    : 'var(--bad-bright)';
}

/**
 * Actualiza las estadísticas del modo práctica.
 *
 * @param {Object} state - Estado del practice trainer.
 */
function updatePracticeHUD(state) {
  DOM.practiceAcc.textContent = state.accuracy > 0 ? `${state.accuracy}%` : '—';
  DOM.practiceStreak.textContent = state.streak;
  DOM.practiceCount.textContent = state.cardsProcessed;
  DOM.practiceTime.textContent = window._formatDuration
    ? window._formatDuration(state.duration)
    : '0h 0m';

  // Actualizar precisión por categoría
  for (const [cat, data] of Object.entries(state.categoryAccuracy)) {
    const el = cat === 'low' ? DOM.accLow : cat === 'mid' ? DOM.accMid : DOM.accHigh;
    if (el && data.total > 0) {
      el.textContent = `${Math.round(data.correct / data.total * 100)}%`;
      el.style.color = data.correct / data.total > 0.8
        ? 'var(--good-bright)'
        : data.correct / data.total > 0.5
          ? 'var(--gold-bright)'
          : 'var(--bad-bright)';
    }
  }
}

/* ====================================================================
   FUNCIONES AUXILIARES DE UI
   ==================================================================== */

/**
 * Asigna un nombre de asiento basado en su índice.
 *
 * @param {number} index - Índice del asiento.
 * @returns {string} Nombre del asiento.
 */
function getSeatName(index) {
  const names = ['Carlos', 'Ana', 'TÚ', 'Lucía', 'Pedro', 'María'];
  return names[index] || `Jugador ${index + 1}`;
}

/* ====================================================================
   EXPORTS
   ==================================================================== */

export {
  cacheDOM,
  switchTab, initTabs,
  openDrawer, closeDrawer, renderDrawerSystem,
  openSettings, closeSettings,
  showToast,
  renderCardFront, showRapidCard, updateShoeVisual,
  dealCardTo, revealCard,
  updateRapidHUD, updateExamHUD, updateLiveHUD, updatePenBar,
  showQuiz, hideQuiz, showQuizFeedback,
  showExamResults, hideExamResults,
  renderSeats, updateDealerState, clearDealerCards, clearSeatHands,
  addRoundLog, updateLiveStats,
  showPracticeCard, showPracticeFeedback, updatePracticeHUD,
  getSeatName
};

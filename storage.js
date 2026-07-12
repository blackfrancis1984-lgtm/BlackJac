/**
 * storage.js — Persistencia de datos mediante LocalStorage
 *
 * Responsabilidad: Guardar, cargar y eliminar datos de progreso,
 * estadísticas, configuración y preferencias del usuario.
 *
 * Todos los datos se serializan en JSON y se almacenan en LocalStorage.
 * Las claves usan el prefijo "bjt_" para evitar colisiones.
 */

/* ====================================================================
   CONSTANTES
   ==================================================================== */

/** Prefijo para todas las claves de almacenamiento. */
const PREFIX = 'bjt_';

/** Claves reconocidas en el almacenamiento. */
const KEYS = Object.freeze({
  // Progreso y estadísticas
  STATS: 'stats',
  PROGRESS: 'progress',
  ERRORS: 'errorPatterns',

  // Configuración
  SETTINGS: 'settings',
  PREFERENCES: 'preferences',

  // Sesión
  LAST_SYSTEM: 'lastSystem',
  LAST_DECKS: 'lastDecks',
  LAST_MODE: 'lastMode',

  // Backup / Export
  EXPORT: 'export'
});

/** Valores por defecto para configuración. */
const DEFAULT_SETTINGS = Object.freeze({
  darkMode: true,
  animations: true,
  sounds: true,
  showValues: true,
  showExplanations: true,
  autoTrueCount: false,
  language: 'es'
});

/* ====================================================================
   FUNCIONES CORE DE ALMACENAMIENTO
   ==================================================================== */

/**
 * Obtiene una clave completa con prefijo.
 *
 * @param {string} key - Clave base.
 * @returns {string} Clave con prefijo.
 */
function _key(key) {
  return `${PREFIX}${key}`;
}

/**
 * Lee un valor del LocalStorage y lo deserializa.
 *
 * @param {string} key - Clave base (sin prefijo).
 * @param {*} defaultValue - Valor por defecto si no existe.
 * @returns {*} Valor deserializado o defaultValue.
 */
function get(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(_key(key));
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[Storage] Error leyendo "${key}":`, e);
    return defaultValue;
  }
}

/**
 * Guarda un valor en LocalStorage serializado como JSON.
 *
 * @param {string} key - Clave base (sin prefijo).
 * @param {*} value - Valor a guardar.
 * @returns {boolean} True si se guardó correctamente.
 */
function set(key, value) {
  try {
    localStorage.setItem(_key(key), JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`[Storage] Error guardando "${key}":`, e);
    return false;
  }
}

/**
 * Elimina un valor del LocalStorage.
 *
 * @param {string} key - Clave base (sin prefijo).
 * @returns {boolean} True si se eliminó.
 */
function remove(key) {
  try {
    localStorage.removeItem(_key(key));
    return true;
  } catch (e) {
    console.warn(`[Storage] Error eliminando "${key}":`, e);
    return false;
  }
}

/* ====================================================================
   FUNCIONES DE ESTADÍSTICAS
   ==================================================================== */

/**
 * Estructura vacía de estadísticas.
 *
 * @returns {Object} Objeto de estadísticas inicializado.
 */
function emptyStats() {
  return {
    // Globales
    totalSessions: 0,
    totalTime: 0,           // segundos
    totalCards: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    bestStreak: 0,
    bestAccuracy: 0,

    // Por modo
    rapidCount: {
      sessions: 0,
      totalTime: 0,
      totalCards: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      bestStreak: 0,
      bestCpm: 0,
      history: []           // últimas 50 sesiones
    },
    exam: {
      sessions: 0,
      totalTime: 0,
      scores: [],           // puntajes de exámenes
      details: []           // detalles de últimos 20 exámenes
    },
    practice: {
      sessions: 0,
      totalTime: 0,
      totalCards: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      bestStreak: 0,
      categoryAccuracy: {   // precisión por categoría
        low: { correct: 0, total: 0 },
        mid: { correct: 0, total: 0 },
        high: { correct: 0, total: 0 }
      }
    },
    live: {
      handsPlayed: 0,
      handsWon: 0,
      handsLost: 0,
      handsPush: 0,
      handsBlackjack: 0,
      unitsProfit: 0,
      history: []           // últimas 50 manos
    }
  };
}

/**
 * Carga las estadísticas del usuario.
 * Si no existen, retorna una estructura vacía.
 *
 * @returns {Object} Estadísticas completas.
 */
function loadStats() {
  const stats = get(KEYS.STATS);
  if (!stats) {
    const empty = emptyStats();
    saveStats(empty);
    return empty;
  }
  // Asegurar que todos los campos existan (para migraciones)
  return _mergeStats(emptyStats(), stats);
}

/**
 * Guarda las estadísticas en LocalStorage.
 *
 * @param {Object} stats - Objeto de estadísticas completo.
 */
function saveStats(stats) {
  set(KEYS.STATS, stats);
}

/**
 * Fusiona una estructura vacía con datos existentes para
 * manejar migraciones de esquema.
 *
 * @param {Object} defaults - Estructura vacía.
 * @param {Object} existing - Datos existentes.
 * @returns {Object} Estructura fusionada.
 */
function _mergeStats(defaults, existing) {
  const result = { ...defaults };
  for (const key of Object.keys(existing)) {
    if (key === 'rapidCount' || key === 'practice' || key === 'live' || key === 'exam') {
      result[key] = { ...defaults[key], ...existing[key] };
    } else {
      result[key] = existing[key];
    }
  }
  return result;
}

/**
 * Actualiza estadísticas después de una sesión de conteo rápido.
 *
 * @param {Object} sessionData - Datos de la sesión.
 * @param {number} sessionData.duration - Duración en ms.
 * @param {number} sessionData.cardsDealt - Cartas repartidas.
 * @param {number} sessionData.correct - Respuestas correctas.
 * @param {number} sessionData.attempts - Total de intentos.
 * @param {number} sessionData.bestStreak - Mejor racha.
 */
function updateRapidStats(sessionData) {
  const stats = loadStats();
  stats.totalSessions++;
  stats.totalTime += Math.floor(sessionData.duration / 1000);
  stats.totalCards += sessionData.cardsDealt;
  stats.totalCorrect += sessionData.correct;
  stats.totalIncorrect += sessionData.attempts - sessionData.correct;
  stats.bestStreak = Math.max(stats.bestStreak, sessionData.bestStreak);

  const acc = sessionData.attempts > 0
    ? Math.round(sessionData.correct / sessionData.attempts * 100)
    : 0;
  stats.bestAccuracy = Math.max(stats.bestAccuracy, acc);

  // Modo específico
  const mode = stats.rapidCount;
  mode.sessions++;
  mode.totalTime += Math.floor(sessionData.duration / 1000);
  mode.totalCards += sessionData.cardsDealt;
  mode.totalCorrect += sessionData.correct;
  mode.totalIncorrect += sessionData.attempts - sessionData.correct;
  mode.bestStreak = Math.max(mode.bestStreak, sessionData.bestStreak);

  const cpm = sessionData.duration > 0
    ? Math.round((sessionData.cardsDealt / (sessionData.duration / 60000)))
    : 0;
  mode.bestCpm = Math.max(mode.bestCpm, cpm);

  // Historial (últimas 50)
  mode.history.unshift({
    date: new Date().toISOString(),
    duration: sessionData.duration,
    cards: sessionData.cardsDealt,
    accuracy: acc,
    streak: sessionData.bestStreak,
    cpm
  });
  if (mode.history.length > 50) mode.history = mode.history.slice(0, 50);

  saveStats(stats);
}

/**
 * Actualiza estadísticas después de un examen.
 *
 * @param {Object} examData - Datos del examen.
 * @param {number} examData.score - Puntuación (0-100).
 * @param {number} examData.duration - Duración en ms.
 * @param {Object} examData.details - Detalle por categoría.
 */
function updateExamStats(examData) {
  const stats = loadStats();
  const mode = stats.exam;

  mode.sessions++;
  mode.totalTime += Math.floor(examData.duration / 1000);
  mode.scores.push(examData.score);
  if (mode.scores.length > 100) mode.scores = mode.scores.slice(-100);

  mode.details.unshift({
    date: new Date().toISOString(),
    score: examData.score,
    duration: examData.duration,
    correct: examData.correct,
    total: examData.total,
    timePerCard: examData.duration / examData.total,
    categories: examData.details
  });
  if (mode.details.length > 20) mode.details = mode.details.slice(0, 20);

  saveStats(stats);
}

/**
 * Actualiza estadísticas de práctica.
 *
 * @param {Object} practiceData - Datos de práctica.
 * @param {number} practiceData.duration - Duración en ms.
 * @param {number} practiceData.cards - Cartas procesadas.
 * @param {number} practiceData.correct - Correctas.
 * @param {number} practiceData.incorrect - Incorrectas.
 * @param {number} practiceData.bestStreak - Mejor racha.
 * @param {Object} practiceData.categoryAccuracy - Precisión por categoría.
 */
function updatePracticeStats(practiceData) {
  const stats = loadStats();
  stats.totalSessions++;
  stats.totalTime += Math.floor(practiceData.duration / 1000);
  stats.totalCards += practiceData.cards;
  stats.totalCorrect += practiceData.correct;
  stats.totalIncorrect += practiceData.incorrect;
  stats.bestStreak = Math.max(stats.bestStreak, practiceData.bestStreak);

  const mode = stats.practice;
  mode.sessions++;
  mode.totalTime += Math.floor(practiceData.duration / 1000);
  mode.totalCards += practiceData.cards;
  mode.totalCorrect += practiceData.correct;
  mode.totalIncorrect += practiceData.incorrect;
  mode.bestStreak = Math.max(mode.bestStreak, practiceData.bestStreak);

  // Actualizar precisión por categoría
  for (const [cat, data] of Object.entries(practiceData.categoryAccuracy || {})) {
    if (mode.categoryAccuracy[cat]) {
      mode.categoryAccuracy[cat].correct += data.correct;
      mode.categoryAccuracy[cat].total += data.total;
    }
  }

  saveStats(stats);
}

/**
 * Actualiza estadísticas de mesa en vivo.
 *
 * @param {Object} handData - Datos de la mano.
 * @param {string} handData.result - Resultado ('win'|'loss'|'push'|'blackjack').
 * @param {number} handData.payout - Pago en unidades.
 */
function updateLiveStats(handData) {
  const stats = loadStats();
  const mode = stats.live;

  mode.handsPlayed++;
  mode.unitsProfit += handData.payout;

  switch (handData.result) {
    case 'win':
    case 'Ganaste':
      mode.handsWon++;
      break;
    case 'loss':
    case 'Perdiste':
      mode.handsLost++;
      break;
    case 'push':
    case 'Empate':
      mode.handsPush++;
      break;
    case 'blackjack':
    case 'Blackjack!':
      mode.handsBlackjack++;
      mode.handsWon++;
      break;
  }

  mode.history.unshift({
    date: new Date().toISOString(),
    result: handData.result,
    payout: handData.payout,
    runningCount: handData.runningCount,
    trueCount: handData.trueCount
  });
  if (mode.history.length > 50) mode.history = mode.history.slice(0, 50);

  saveStats(stats);
}

/* ====================================================================
   FUNCIONES DE CONFIGURACIÓN
   ==================================================================== */

/**
 * Carga la configuración del usuario.
 *
 * @returns {Object} Configuración (fusionada con defaults).
 */
function loadSettings() {
  const saved = get(KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

/**
 * Guarda la configuración del usuario.
 *
 * @param {Object} settings - Objeto de configuración.
 */
function saveSettings(settings) {
  set(KEYS.SETTINGS, settings);
}

/**
 * Guarda la preferencia del último sistema de conteo usado.
 *
 * @param {string} systemId - ID del sistema.
 */
function saveLastSystem(systemId) {
  set(KEYS.LAST_SYSTEM, systemId);
}

/**
 * Guarda la preferencia del último número de mazos.
 *
 * @param {number} numDecks - Número de mazos.
 */
function saveLastDecks(numDecks) {
  set(KEYS.LAST_DECKS, numDecks);
}

/**
 * Guarda el último modo activo.
 *
 * @param {string} modeId - ID del modo.
 */
function saveLastMode(modeId) {
  set(KEYS.LAST_MODE, modeId);
}

/**
 * Guarda los patrones de error detectados (para IA adaptativa).
 *
 * @param {Object} patterns - Mapa de patrones de error.
 */
function saveErrorPatterns(patterns) {
  set(KEYS.ERRORS, patterns);
}

/**
 * Carga los patrones de error.
 *
 * @returns {Object} Patrones de error.
 */
function loadErrorPatterns() {
  return get(KEYS.ERRORS, {
    low: { errors: 0, total: 0 },
    mid: { errors: 0, total: 0 },
    high: { errors: 0, total: 0 },
    specificRanks: {},  // { 'A': {errors: n, total: m}, ... }
    trueCount: { errors: 0, total: 0 }
  });
}

/* ====================================================================
   EXPORTACIÓN / IMPORTACIÓN
   ==================================================================== */

/**
 * Exporta todos los datos del usuario como JSON.
 *
 * @returns {string} JSON con todos los datos.
 */
function exportAllData() {
  const data = {};
  for (const key of Object.values(KEYS)) {
    data[key] = localStorage.getItem(_key(key));
  }
  return JSON.stringify(data, null, 2);
}

/**
 * Importa datos desde JSON.
 *
 * @param {string} jsonStr - JSON con datos.
 * @returns {boolean} True si se importó correctamente.
 */
function importAllData(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    for (const [key, value] of Object.entries(data)) {
      if (value !== null) {
        localStorage.setItem(_key(key), value);
      }
    }
    return true;
  } catch (e) {
    console.error('[Storage] Error importando datos:', e);
    return false;
  }
}

/**
 * Elimina todos los datos del usuario.
 *
 * @returns {boolean} True si se borró correctamente.
 */
function clearAllData() {
  try {
    const allKeys = Object.values(KEYS);
    for (const key of allKeys) {
      localStorage.removeItem(_key(key));
    }
    return true;
  } catch (e) {
    console.error('[Storage] Error borrando datos:', e);
    return false;
  }
}

/**
 * Calcula el tamaño total de los datos almacenados.
 *
 * @returns {number} Bytes usados.
 */
function getStorageSize() {
  let total = 0;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PREFIX)) {
      total += (localStorage[key].length + key.length) * 2; // UTF-16
    }
  }
  return total;
}

/* ====================================================================
   EXPORTS
   ==================================================================== */

export {
  KEYS, DEFAULT_SETTINGS,
  get, set, remove,
  emptyStats, loadStats, saveStats,
  updateRapidStats, updateExamStats, updatePracticeStats, updateLiveStats,
  loadSettings, saveSettings,
  saveLastSystem, saveLastDecks, saveLastMode,
  saveErrorPatterns, loadErrorPatterns,
  exportAllData, importAllData, clearAllData,
  getStorageSize
};

/**
 * audio.js — Motor de audio procedural
 *
 * Responsabilidad: Generar efectos de sonido mediante Web Audio API
 * sin depender de archivos externos. Esto permite que la app funcione
 * 100% offline sin necesidad de descargar archivos de audio.
 *
 * Los sonidos son suaves y no molestos, diseñados para un entorno
 * de casino tranquilo.
 */

/* ====================================================================
   ESTADO DEL MOTOR DE AUDIO
   ==================================================================== */

/** Contexto de audio (se crea lazy). */
let _audioCtx = null;

/** Si los sonidos están habilitados. */
let _soundsEnabled = true;

/** Volumen global (0-1). */
let _globalVolume = 0.4;

/**
 * Obtiene o crea el AudioContext.
 * Los navegadores requieren interacción del usuario antes de crear el contexto.
 * @returns {AudioContext|null}
 */
function getAudioContext() {
  if (!_audioCtx) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        _audioCtx = new Ctx();
      }
    } catch (e) {
      console.warn('[Audio] No se pudo crear AudioContext:', e);
      return null;
    }
  }
  return _audioCtx;
}

/**
 * Inicializa el contexto de audio (requiere gesto del usuario).
 * Se llama automáticamente en el primer evento de clic/tap.
 * @returns {boolean} True si se inicializó correctamente.
 */
function initAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
    return true;
  }
  return ctx !== null;
}

/**
 * Activa/desactiva los sonidos.
 * @param {boolean} enabled
 */
function setSoundsEnabled(enabled) {
  _soundsEnabled = enabled;
}

/**
 * Establece el volumen global.
 * @param {number} vol - Valor entre 0 y 1.
 */
function setVolume(vol) {
  _globalVolume = Math.max(0, Math.min(1, vol));
}

/* ====================================================================
   UTILIDADES DE SONIDO
   ==================================================================== */

/**
 * Crea un oscilador con envolvente ADSR.
 *
 * @param {AudioContext} ctx - Contexto de audio.
 * @param {number} freq - Frecuencia en Hz.
 * @param {string} type - Tipo de oscilador ('sine'|'triangle'|'square'|'sawtooth').
 * @param {Object} envelope - Envolvente {attack, decay, sustain, release} en segundos.
 * @param {number} gain - Ganancia máxima.
 * @returns {Object} { oscillator, gainNode }
 */
function createOscillatorEnvelope(ctx, freq, type, envelope, gain) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  const now = ctx.currentTime;
  const env = {
    attack: envelope.attack || 0.01,
    decay: envelope.decay || 0.1,
    sustain: envelope.sustain || 0.5,
    release: envelope.release || 0.1
  };

  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(gain, now + env.attack);
  gainNode.gain.linearRampToValueAtTime(gain * env.sustain, now + env.attack + env.decay);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  return { oscillator: osc, gainNode };
}

/**
 * Reproduce un sonido de click corto.
 *
 * @param {number} freq - Frecuencia en Hz.
 * @param {number} [vol] - Volumen específico (0-1).
 * @param {string} [type='triangle'] - Tipo de oscilador.
 */
function playTone(freq, vol, type = 'triangle') {
  if (!_soundsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const v = (vol !== undefined ? vol : _globalVolume) * 0.6;
  const { oscillator, gainNode } = createOscillatorEnvelope(
    ctx, freq, type,
    { attack: 0.005, decay: 0.06, sustain: 0.1, release: 0.03 },
    v
  );
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.1);

  // Cleanup
  setTimeout(() => {
    oscillator.disconnect();
    gainNode.disconnect();
  }, 150);
}

/**
 * Reproduce ruido blanco filtrado.
 *
 * @param {number} duration - Duración en segundos.
 * @param {number} [vol] - Volumen.
 * @param {number} [cutoff=800] - Frecuencia de corte del filtro (Hz).
 */
function playNoise(duration, vol, cutoff = 800) {
  if (!_soundsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;

  const gainNode = ctx.createGain();
  const v = (vol !== undefined ? vol : _globalVolume) * 0.5;
  gainNode.gain.setValueAtTime(v, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  source.start();
  source.stop(ctx.currentTime + duration);
}

/* ====================================================================
   EFECTOS DE SONIDO ESPECÍFICOS
   ==================================================================== */

/**
 * Sonido al repartir una carta (snap suave).
 */
function playCardDeal() {
  playTone(800, undefined, 'triangle');
}

/**
 * Sonido al revelar una carta oculta (whoosh).
 */
function playCardReveal() {
  if (!_soundsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);

  const v = _globalVolume * 0.3;
  gainNode.gain.setValueAtTime(v, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

/**
 * Sonido de respuesta correcta (ding suave).
 */
function playCorrect() {
  playTone(660, undefined, 'sine');
  setTimeout(() => playTone(880, undefined, 'sine'), 80);
}

/**
 * Sonido de respuesta incorrecta (buzzer suave).
 */
function playIncorrect() {
  playTone(220, undefined, 'triangle');
  setTimeout(() => playTone(180, undefined, 'triangle'), 100);
}

/**
 * Sonido de ficha al apostar.
 */
function playChip() {
  if (!_soundsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  playTone(1200, undefined, 'sine');
  playTone(1500, undefined, 'sine');
}

/**
 * Sonido de botón (click corto).
 */
function playButton() {
  playTone(600, _globalVolume * 0.3, 'triangle');
}

/**
 * Sonido de barajado (ruido corto).
 */
function playShuffle() {
  playNoise(0.15, undefined, 600);
}

/**
 * Sonido de blackjack (fanfarria corta).
 */
function playBlackjack() {
  if (!_soundsEnabled) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, undefined, 'sine'), i * 100);
  });
}

/**
 * Sonido de bust (tono descendente).
 */
function playBust() {
  if (!_soundsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

  const v = _globalVolume * 0.3;
  gainNode.gain.setValueAtTime(v, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.35);
}

/**
 * Sonido de nueva mano (whoosh suave).
 */
function playNewHand() {
  playNoise(0.1, undefined, 1000);
}

/**
 * Sonido de timer urgente (tick).
 */
function playTick() {
  playTone(440, _globalVolume * 0.15, 'sine');
}

/**
 * Sonido de examen completado.
 */
function playExamComplete() {
  if (!_soundsEnabled) return;
  const notes = [440, 554, 659, 880];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, undefined, 'sine'), i * 120);
  });
}

/* ====================================================================
   EXPORTS
   ==================================================================== */

export {
  initAudio,
  setSoundsEnabled,
  setVolume,
  playCardDeal,
  playCardReveal,
  playCorrect,
  playIncorrect,
  playChip,
  playButton,
  playShuffle,
  playBlackjack,
  playBust,
  playNewHand,
  playTick,
  playExamComplete
};

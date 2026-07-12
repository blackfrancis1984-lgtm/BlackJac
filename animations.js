/**
 * animations.js — Motor de animaciones
 *
 * Responsabilidad: Proporcionar funciones de animación
 * para cartas, elementos de UI, y efectos visuales.
 *
 * Todas las animaciones están optimizadas para 60 FPS
 * usando CSS transforms y requestAnimationFrame.
 *
 * Se respeta prefers-reduced-motion del sistema.
 */

/* ====================================================================
   DETECCIÓN DE PREFERENCIAS
   ==================================================================== */

/**
 * Detecta si el usuario prefiere reducir animaciones.
 * @returns {boolean} True si debe reducir animaciones.
 */
function prefersReducedMotion() {
  return window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Detecta si las animaciones están habilitadas globalmente.
 * @returns {boolean} True si están habilitadas.
 */
let _animationsEnabled = true;
function setAnimationsEnabled(enabled) {
  _animationsEnabled = enabled;
}
function areAnimationsEnabled() {
  return _animationsEnabled && !prefersReducedMotion();
}

/* ====================================================================
   ANIMACIÓN DE REPARTO DE CARTA
   ==================================================================== */

/**
 * Anima una carta saliendo del zapato hacia un contenedor.
 * Usa CSS transitions ya aplicadas en el elemento.
 *
 * @param {HTMLElement} cardEl - Elemento de carta.
 * @param {HTMLElement} fromEl - Elemento origen (zapato).
 * @param {HTMLElement} toEl - Elemento destino (contenedor).
 * @param {number} delay - Retardo antes de la animación (ms).
 * @returns {Promise<void>}
 */
function animateDeal(cardEl, fromEl, toEl, delay = 0) {
  return new Promise(resolve => {
    if (!areAnimationsEnabled()) {
      toEl.appendChild(cardEl);
      resolve();
      return;
    }

    setTimeout(() => {
      toEl.appendChild(cardEl);
      cardEl.classList.add('dealing');

      cardEl.addEventListener('animationend', function handler() {
        cardEl.classList.remove('dealing');
        cardEl.classList.add('bounce');

        cardEl.addEventListener('animationend', function bounceEnd() {
          cardEl.classList.remove('bounce');
          cardEl.removeEventListener('animationend', bounceEnd);
        });

        cardEl.removeEventListener('animationend', handler);
        resolve();
      });
    }, delay);
  });
}

/**
 * Animación de carta cayendo desde arriba con rebote.
 *
 * @param {HTMLElement} cardEl - Elemento de carta.
 * @param {HTMLElement} container - Contenedor destino.
 * @param {number} delay - Retardo (ms).
 * @returns {Promise<void>}
 */
function animateCardDrop(cardEl, container, delay = 0) {
  return new Promise(resolve => {
    if (!areAnimationsEnabled()) {
      container.appendChild(cardEl);
      resolve();
      return;
    }

    setTimeout(() => {
      container.appendChild(cardEl);
      cardEl.classList.add('dealing');
      cardEl.classList.add('bounce');

      // Timeout fallback por si animationend no se dispara
      setTimeout(() => {
        cardEl.classList.remove('dealing');
        cardEl.classList.remove('bounce');
        resolve();
      }, 900);
    }, delay);
  });
}

/* ====================================================================
   ANIMACIÓN DE REVELACIÓN DE CARTA
   ==================================================================== */

/**
 * Anima la revelación de una carta oculta.
 *
 * @param {HTMLElement} cardEl - Elemento de carta.
 * @param {number} delay - Retardo (ms).
 * @returns {Promise<void>}
 */
function animateReveal(cardEl, delay = 0) {
  return new Promise(resolve => {
    if (!areAnimationsEnabled()) {
      cardEl.classList.add('flip');
      resolve();
      return;
    }

    setTimeout(() => {
      cardEl.classList.add('flip');

      // La CSS transition dura 350ms
      setTimeout(resolve, 400);
    }, delay);
  });
}

/* ====================================================================
   ANIMACIÓN DE HINT BUBBLE
   ==================================================================== */

/**
 * Muestra una burbuja de hint junto a una carta.
 *
 * @param {HTMLElement} hintEl - Elemento del hint.
 * @param {string} text - Texto del hint.
 * @param {'v-plus'|'v-zero'|'v-minus'} valueClass - Clase de valor.
 * @param {number} [duration=2000] - Duración antes de ocultar (ms).
 */
function showHintBubble(hintEl, text, valueClass, duration = 2000) {
  hintEl.textContent = text;
  hintEl.className = `hint-bubble show ${valueClass}`;

  setTimeout(() => {
    hintEl.classList.remove('show');
  }, duration);
}

/* ====================================================================
   ANIMACIÓN DE PULSO (FEEDBACK)
   ==================================================================== */

/**
 * Aplica un efecto de pulso a un elemento (feedback visual).
 *
 * @param {HTMLElement} el - Elemento.
 * @param {'ok'|'no'} type - Tipo de feedback.
 * @param {number} [duration=400] - Duración (ms).
 */
function pulseFeedback(el, type, duration = 400) {
  if (!areAnimationsEnabled()) return;

  const color = type === 'ok'
    ? 'rgba(63,174,92,.3)'
    : 'rgba(192,57,43,.3)';

  el.style.boxShadow = `0 0 20px ${color}`;
  el.style.transition = 'box-shadow 0.15s ease';

  setTimeout(() => {
    el.style.boxShadow = '';
  }, duration);
}

/**
 * Aplica un flash de color a un elemento.
 *
 * @param {HTMLElement} el - Elemento.
 * @param {string} color - Color del flash (ej: 'rgba(63,174,92,.15)').
 * @param {number} [duration=300] - Duración (ms).
 */
function flashElement(el, color, duration = 300) {
  if (!areAnimationsEnabled()) return;

  const originalBg = el.style.background;
  el.style.background = color;
  el.style.transition = 'background 0.15s ease';

  setTimeout(() => {
    el.style.background = originalBg;
  }, duration);
}

/* ====================================================================
   ANIMACIÓN DE SHOE (ZAPATO)
   ==================================================================== */

/**
 * Anima la reducción visual del zapato.
 *
 * @param {HTMLElement} stackEl - Elemento de la pila del zapato.
 * @param {number} remainingPct - Porcentaje restante (0-1).
 * @param {number} [duration=350] - Duración (ms).
 */
function animateShoeShrink(stackEl, remainingPct, duration = 350) {
  if (!stackEl) return;

  const maxH = 80;
  const targetH = Math.max(2, remainingPct * maxH);

  stackEl.style.transition = `height ${duration}ms ease`;
  stackEl.style.height = `${targetH}px`;
}

/* ====================================================================
   ANIMACIÓN DE ENTRADA DE ELEMENTOS
   ==================================================================== */

/**
 * Anima la entrada de un elemento (fade in + slide up).
 *
 * @param {HTMLElement} el - Elemento.
 * @param {number} [delay=0] - Retardo (ms).
 * @param {number} [duration=300] - Duración (ms).
 * @returns {Promise<void>}
 */
function fadeInUp(el, delay = 0, duration = 300) {
  return new Promise(resolve => {
    if (!areAnimationsEnabled()) {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
      resolve();
      return;
    }

    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;

    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
      setTimeout(resolve, duration);
    }, delay);
  });
}

/**
 * Secuencia de fade in para múltiples elementos.
 *
 * @param {HTMLElement[]} elements - Elementos a animar.
 * @param {number} [stagger=100] - Retardo entre cada uno (ms).
 */
async function fadeInSequence(elements, stagger = 100) {
  for (let i = 0; i < elements.length; i++) {
    await fadeInUp(elements[i], i * stagger);
  }
}

/* ====================================================================
   ANIMACIÓN DE PENETRACIÓN BAR
   ==================================================================== */

/**
 * Anima la barra de penetración con color que cambia según el nivel.
 *
 * @param {HTMLElement} barEl - Elemento de la barra.
 * @param {number} percent - Porcentaje (0-100).
 */
function animatePenBar(barEl, percent) {
  const clamped = Math.min(100, percent);

  // Cambiar color según el nivel de penetración
  let color;
  if (clamped < 50) {
    color = 'linear-gradient(90deg, var(--good), var(--gold))';
  } else if (clamped < 75) {
    color = 'linear-gradient(90deg, var(--gold), #e8a020)';
  } else {
    color = 'linear-gradient(90deg, #e8a020, var(--bad-bright))';
  }

  barEl.style.background = color;
  barEl.style.width = `${clamped.toFixed(0)}%`;
}

/* ====================================================================
   EXPORTS
   ==================================================================== */

export {
  prefersReducedMotion,
  setAnimationsEnabled,
  areAnimationsEnabled,
  animateDeal,
  animateCardDrop,
  animateReveal,
  showHintBubble,
  pulseFeedback,
  flashElement,
  animateShoeShrink,
  fadeInUp,
  fadeInSequence,
  animatePenBar
};

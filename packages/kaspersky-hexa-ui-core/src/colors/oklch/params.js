/**
 * Параметры OKLCH-палитры Hexa UI.
 *
 * Числа подобраны МНК по текущим hex-примитивам tokens-pixso/tokens.css
 * (ΔE_OK в среднем ≈1.2 для светлой темы). Это стартовая точка, не догма:
 * менять их — значит менять палитру целиком, а не править отдельные цвета.
 */

// Базовый цвет — единственный цвет во всей системе (marina_500).
const BASE = '#4269E7'
const BASE_HUE = 266.9

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

// Общая шкала светлоты для всех хроматических семейств (медиана по семействам Hexa).
// Контраст шага не зависит от тона: red_600 и marina_600 одинаково тёмные.
const LIGHTNESS = { 50: 0.96, 100: 0.93, 200: 0.851, 300: 0.774, 400: 0.695, 500: 0.566, 600: 0.529, 700: 0.435, 800: 0.34, 900: 0.274 }

// Нейтральная шкала: своя светлота, хрома и тон — от базы (лёгкая подкраска).
const NEUTRAL_LIGHTNESS = {
  0: 1, 50: 0.976, 100: 0.967, 150: 0.951, 200: 0.927, 250: 0.903, 300: 0.872,
  350: 0.806, 400: 0.691, 450: 0.622, 500: 0.571, 550: 0.52, 600: 0.463, 650: 0.411,
  700: 0.374, 750: 0.336, 800: 0.317, 850: 0.297, 900: 0.235, 950: 0.191, 1000: 0
}
const NEUTRAL = { k: 0.096, peak: 0.61, dh: -5 }

/**
 * Семейства:
 *   dh    — сдвиг тона от базы, °
 *   k     — множитель хромы относительно базы
 *   warm  — «температура»: сдвиг тона на единицу L (тёплые цвета теплеют к светлому краю)
 *   peak  — L, на которой хрома максимальна
 *   lift  — подъём L в середине шкалы (только жёлтый: иначе он грязнеет)
 */
const FAMILIES = {
  marina: { dh: 0, k: 1.0, warm: 0, peak: 0.565, lift: 0 },
  red: { dh: 116, k: 1.06, warm: 0, peak: 0.56, lift: 0 },
  orange: { dh: 137, k: 0.98, warm: 50, peak: 0.61, lift: 0 },
  yellow: { dh: 161, k: 0.9, warm: 70, peak: 0.72, lift: 0.2 },
  grass: { dh: -125, k: 0.91, warm: 0, peak: 0.59, lift: 0 },
  emerald: { dh: -90, k: 0.58, warm: 10, peak: 0.64, lift: 0 },
  marengo: { dh: -38, k: 0.66, warm: -20, peak: 0.63, lift: 0 },
  coldgrey: { dh: -15, k: 0.49, warm: -5, peak: 0.6, lift: 0 },
  purple: { dh: 25, k: 1.03, warm: 0, peak: 0.53, lift: 0 },
  violet: { dh: 69, k: 1.05, warm: 0, peak: 0.56, lift: 0 }
}

// Семантические заливки (common--*) → семейство.
const FILLS = {
  accent: 'marina', danger: 'red', success: 'emerald', warning: 'yellow', info: 'coldgrey',
  grass: 'grass', marengo: 'marengo', marina: 'marina', orange: 'orange', purple: 'purple', violet: 'violet'
}

// Транспонирование в тёмную тему: L' = floor + gain · (1 − L)^gamma
const DARK = { floor: 0.235, gain: 0.86, gamma: 0.8, chroma: 0.9, alpha: 0.9, stateDir: 1.3 }

module.exports = {
  BASE, BASE_HUE, STEPS, LIGHTNESS, NEUTRAL_LIGHTNESS, NEUTRAL, FAMILIES, FILLS, DARK
}

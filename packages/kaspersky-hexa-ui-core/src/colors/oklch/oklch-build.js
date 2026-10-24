/**
 * Генератор OKLCH-токенов Hexa UI из одного базового цвета.
 *
 * Вход:  src/colors/tokens-pixso/tokens.css (как есть, сгенерированный из Pixso)
 * Выход: src/colors/oklch/tokens.css  — та же семантика и те же имена переменных,
 *        но все цвета — `oklch(from var(--hx-base) …)`, а тёмная тема —
 *        переключатель параметров, а не вторая таблица соответствий.
 *
 * Запуск: npm run build:oklch           — перегенерировать tokens.css
 *         npm run build:oklch -- --demo — ещё и собрать стенд «было / стало» в oklch-demo/
 */
const fs = require('fs')
const path = require('path')
const P = require('./params')

const D = 'var(--hx-dark)'
const STATE = { enabled: 0, hover: 'var(--hx-state-hover)', active: 'var(--hx-state-active)' }

// ---------- разбор исходного tokens.css ----------

function parseBlocks (src) {
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '')
  const blocks = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(clean))) {
    const selector = m[1].trim().replace(/\s+/g, ' ')
    const decls = []
    for (const line of m[2].split('\n')) {
      const d = line.match(/^\s*--([\w-]+):\s*(.+?);\s*$/)
      if (d) decls.push([d[1], d[2]])
    }
    blocks.push({ selector, decls, body: m[2] })
  }
  return blocks
}

function readSource (src) {
  const blocks = parseBlocks(src)
  const light = blocks.filter(b => b.selector.includes('.theme-light')).flatMap(b => b.decls)
  const dark = new Map(blocks.filter(b => b.selector.includes('.theme-dark')).flatMap(b => b.decls))
  const roots = blocks.filter(b => b.selector === ':root')
  const primitives = roots.find(b => b.decls.some(([k]) => k.startsWith('color--')))
  const misc = roots.filter(b => b !== primitives)
  const ink = {}
  const brandPrimitives = []
  for (const [name, value] of primitives.decls) {
    const t = name.match(/^color--(neutral_\d+_(?:inverted_)?transparent)$/)
    if (t) ink[t[1]] = Math.round(parseInt(value.slice(7, 9), 16) / 255 * 1000) / 1000
    if (name.startsWith('color--kaspersky')) brandPrimitives.push([name, value])
  }
  return { light, dark, misc, ink, brandPrimitives, blocks }
}

// ---------- выражения ----------

const transposed = x => `clamp(0.18, calc(var(--hx-dk-floor) + var(--hx-dk-gain) * pow(1 - ${x}, var(--hx-dk-gamma))), 0.97)`
const roleL = x => `calc((1 - ${D}) * ${x} + ${D} * ${transposed(x)})`
// заливка в тёмной теме никогда не темнеет: иначе жёлтый warning становится коричневым
const fillL = x => `calc((1 - ${D}) * ${x} + ${D} * max(${x}, ${transposed(x)}))`

function hue (f, L) {
  if (f === 'marina') return 'h'
  if (f === 'neutral') return 'calc(h + var(--hx-neutral-dh))'
  const warm = P.FAMILIES[f].warm ? ` + var(--hx-${f}-warm) * (${L} - 0.55)` : ''
  return `calc(var(--hx-follow) * (h + var(--hx-${f}-dh)) + (1 - var(--hx-follow)) * var(--hx-${f}-h0)${warm})`
}

const chroma = (f, L, damp = true) =>
  `calc(c * var(--hx-${f}-k)${damp ? ' * var(--_cd)' : ''} * exp(-1 * pow((${L} - var(--hx-${f}-peak)) / var(--hx-c-width), 2)))`

const color = (f, L, damp = true) => `oklch(from var(--hx-base) ${L} ${chroma(f, L, damp)} ${hue(f, L)})`

const stepL = (f, s) => (f === 'neutral' ? `var(--hx-n-${s})` : `var(--hx-l-${s})`)

// жёлтый поднят по L — после транспонирования, чтобы и в тёмной теме оставаться светлым
const lift = (f, L) => (P.FAMILIES[f] && P.FAMILIES[f].lift
  ? `calc(${L} + var(--hx-${f}-lift) * exp(-1 * pow((${L} - 0.62) / 0.2, 2)))`
  : L)

function inkExpr (name, alpha, transpose = true) {
  const src = name.includes('inverted') ? '0.95' : 'var(--hx-ink-l)'
  const L = transpose ? roleL(src) : src
  const a = transpose ? `calc((1 - ${D}) * ${alpha} + ${D} * pow(${alpha}, var(--hx-dk-alpha)))` : String(alpha)
  return `oklch(from var(--hx-base) ${L} calc(c * var(--hx-ink-c) * (1.2 - ${L})) calc(h + var(--hx-neutral-dh)) / ${a})`
}

// ---------- сборка ----------

function paramsBlock () {
  const nl = Object.entries(P.NEUTRAL_LIGHTNESS)
  const rows = []
  for (let i = 0; i < nl.length; i += 7) rows.push('  ' + nl.slice(i, i + 7).map(([s, v]) => `--hx-n-${s}: ${v};`).join(' '))
  const fam = Object.entries(P.FAMILIES).map(([f, p]) => {
    if (f === 'marina') return `  --hx-marina-k: ${p.k}; --hx-marina-peak: ${p.peak};`
    let s = `  --hx-${f}-dh: ${p.dh}; --hx-${f}-h0: ${Math.round(((P.BASE_HUE + p.dh) % 360 + 360) % 360)}; --hx-${f}-k: ${p.k}; --hx-${f}-peak: ${p.peak};`
    if (p.warm) s += ` --hx-${f}-warm: ${p.warm};`
    if (p.lift) s += ` --hx-${f}-lift: ${p.lift};`
    return s
  })
  return [
    '  /* ЕДИНСТВЕННЫЙ ЦВЕТ. Всё остальное ниже — числа. */',
    `  --hx-base: ${P.BASE};`,
    '',
    '  /* шкала светлоты: одна на все хроматические семейства */',
    '  ' + P.STEPS.slice(0, 5).map(s => `--hx-l-${s}: ${P.LIGHTNESS[s]};`).join(' '),
    '  ' + P.STEPS.slice(5).map(s => `--hx-l-${s}: ${P.LIGHTNESS[s]};`).join(' '),
    '  /* нейтральная шкала + подкраска тоном базы */',
    ...rows,
    `  --hx-neutral-k: ${P.NEUTRAL.k}; --hx-neutral-peak: ${P.NEUTRAL.peak}; --hx-neutral-dh: ${P.NEUTRAL.dh};`,
    '  --hx-c-width: 0.30; /* ширина «колокола» хромы по L */',
    '  --hx-ink-l: 0.25; --hx-ink-c: 0.3; /* «чернила» полупрозрачных оверлеев */',
    '',
    '  /* семейства: сдвиг тона, множитель хромы, пик хромы, температура (°h на единицу L) */',
    '  --hx-follow: 1; /* 1 — семейства вращаются вместе с базой, 0 — держат свой тон (h0) */',
    ...fam,
    '',
    '  /* состояния: сдвиг L, знак задаёт тема */',
    '  --hx-state-hover: 0.04; --hx-state-active: 0.12; --hx-state-dir: -1;',
    '',
    "  /* тёмная тема: L' = floor + gain · (1 − L)^γ */",
    '  --hx-dark: 0;',
    `  --hx-dk-floor: ${P.DARK.floor}; --hx-dk-gain: ${P.DARK.gain}; --hx-dk-gamma: ${P.DARK.gamma};`,
    `  --hx-dk-chroma: ${P.DARK.chroma}; /* тёмная тема чуть спокойнее по хроме */`,
    `  --hx-dk-alpha: ${P.DARK.alpha}; /* α' = α^0.9: оверлеям на тёмном нужна чуть большая плотность */`
  ].join('\n')
}

function build (src) {
  const S = readSource(src)
  const roles = new Set()
  const inks = new Set()
  const brand = new Set()

  function resolve (tok, val) {
    const m = val.match(/^var\(--color--([a-z_]+?)_(\d+)(_inverted)?(_transparent|_0)?\)$/)
    if (!m) return val // ссылка на семантический токен
    const [, f, step, inv = '', tr] = m
    const s = Number(step)
    if (f.startsWith('kaspersky')) { brand.add(tok); return val }
    if (tok.includes('static')) return val // «static» по смыслу не зависят от темы
    if (tok.includes('shadow_drop') && tr === '_transparent') {
      const a = S.ink[`${f}_${s}${inv}_transparent`]
      return `oklch(from var(--hx-base) var(--hx-ink-l) calc(c * var(--hx-ink-c)) calc(h + var(--hx-neutral-dh)) / calc((1 - ${D}) * ${a} + ${D} * pow(${a}, 0.1)))`
    }
    if (tok.includes('overlay--muted')) return color(f, `calc((1 - ${D}) * ${stepL(f, s)} + ${D} * 0.19)`)
    if (tr === '_transparent') {
      const n = `${f}_${s}${inv}_transparent`
      inks.add(n)
      return `var(--ink--${n})`
    }
    const cm = tok.match(/^common--([a-z]+)--(enabled|hover|active)$/)
    if (cm && P.FILLS[cm[1]]) return `var(--fill--${cm[1]}--${cm[2]})`
    roles.add(`${f}|${s}`)
    return `var(--role--${f}_${s})`
  }

  const semantic = S.light.map(([t, v]) => [t, resolve(t, v)])
  for (const f of Object.keys(P.FAMILIES)) for (const s of P.STEPS) roles.add(`${f}|${s}`)
  for (const s of Object.keys(P.NEUTRAL_LIGHTNESS)) roles.add(`neutral|${s}`)

  const o = ['  --_cd: calc(1 - var(--hx-dark) * (1 - var(--hx-dk-chroma)));', '',
    '  /* примитивы: светлая шкала, прежние имена для обратной совместимости */']
  for (const f of Object.keys(P.FAMILIES)) for (const s of P.STEPS) o.push(`  --color--${f}_${s}: ${color(f, lift(f, stepL(f, s)), false)};`)
  for (const s of Object.keys(P.NEUTRAL_LIGHTNESS)) o.push(`  --color--neutral_${s}: ${color('neutral', stepL('neutral', s), false)};`)
  for (const [n, a] of Object.entries(S.ink)) o.push(`  --color--${n}: ${inkExpr(n, a, false)};`)
  o.push('  /* бренд Kaspersky — фиксированные цвета, из базы не выводятся */')
  for (const [n, v] of S.brandPrimitives) o.push(`  --${n}: ${v};`)

  o.push('', '  /* роли: тот же шаг шкалы, светлота транспонируется темой */')
  const sorted = [...roles].map(r => r.split('|')).sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1])
  for (const [f, s] of sorted) {
    o.push(`  --_r-${f}-${s}: ${lift(f, roleL(stepL(f, s)))};`)
    o.push(`  --role--${f}_${s}: ${color(f, `var(--_r-${f}-${s})`)};`)
  }
  for (const n of [...inks].sort()) o.push(`  --ink--${n}: ${inkExpr(n, S.ink[n])};`)

  o.push('', '  /* заливки: enabled + сдвиг состояния, направление задаёт тема */')
  for (const [key, f] of Object.entries(P.FILLS)) {
    const base = key === 'accent' ? 'clamp(0.45, l, 0.62)' : stepL(f, 500)
    o.push(`  --_fe-${key}: ${lift(f, fillL(base))};`)
    for (const [st, dl] of Object.entries(STATE)) {
      const L = dl ? `clamp(0.2, calc(var(--_fe-${key}) + var(--hx-state-dir) * ${dl}), 0.97)` : `var(--_fe-${key})`
      o.push(key === 'accent'
        ? `  --fill--accent--${st}: oklch(from var(--hx-base) ${L} calc(c * var(--_cd) * exp(-1 * pow((${L} - clamp(0.45, l, 0.62)) / var(--hx-c-width), 2))) h);`
        : `  --fill--${key}--${st}: ${color(f, L)};`)
    }
  }

  o.push('', '  /* НОВОЕ: текст на заливке выбирается по её L (порог ≈ точка равного контраста WCAG) */')
  for (const key of ['accent', 'danger', 'success', 'warning']) {
    o.push(`  --fg--on_${key}: oklch(from var(--fill--${key}--enabled) clamp(0.2, calc((l - 0.64) * -100), 1) calc(c * 0.12) h);`)
  }
  o.push('', '  /* семантика Hexa: одна таблица на обе темы */')
  for (const [t, v] of semantic) o.push(`  --${t}: ${v};`)
  const derived = o.join('\n')

  const lightMap = new Map(S.light)
  const darkSwitch = [
    '  --hx-dark: 1;',
    `  --hx-state-dir: ${P.DARK.stateDir};`,
    '  color-scheme: dark;',
    '  /* бренд — по-прежнему ручная пара: это фиксированные цвета */',
    ...[...brand].sort().filter(t => S.dark.has(t) && S.dark.get(t) !== lightMap.get(t)).map(t => `  --${t}: ${S.dark.get(t)};`)
  ].join('\n')

  const header = [
    '/*! This file was created automatically by src/colors/oklch/oklch-build.js. */',
    '/*! Do not edit: change src/colors/oklch/params.js and run `npm run build:oklch`. */',
    '/*',
    ' * Hexa UI — цветовые токены на OKLCH из одного базового цвета (--hx-base).',
    " * Тёмная тема — транспонирование светлоты: L' = floor + gain · (1 − L)^γ,",
    ' * хрома пересчитывается по новой L, тон сохраняется.',
    ' * Требует relative color syntax и pow()/exp(): Chrome 122+, Safari 18+, Firefox 128+.',
    ' */',
    ''
  ].join('\n')

  const emit = (paramsSel, scopeSel, darkSel) =>
    `${header}\n${paramsSel} {\n${paramsBlock()}\n}\n\n${scopeSel} {\n${derived}\n}\n\n` +
    `/* тёмная тема — только переключатель параметров */\n${darkSel} {\n${darkSwitch}\n}\n`

  const misc = S.misc.map(b => `:root {${b.body}}`).join('\n')
  const css = emit(':root', ':root,\n.theme-light,\n.theme-dark,\n.hexa-ui-light-theme,\n.hexa-ui-dark-theme',
    '.theme-dark,\n.hexa-ui-dark-theme') + '\n' + misc + '\n'

  // для стенда: «стало» и «было» в своих скоупах
  const demoNow = emit('.now', '.now', '.now[data-t="dark"]')
  const demoWas = S.blocks.map(b => {
    const sel = b.selector.includes('.theme-dark') ? '.was[data-t="dark"]' : '.was'
    return `${sel} {${b.body}}`
  }).join('\n')

  return {
    css,
    demoNow,
    demoWas,
    tokens: S.light.map(([t]) => t),
    stats: {
      hexPrimitives: S.blocks.flatMap(b => b.decls).filter(([k, v]) => k.startsWith('color--') && v.startsWith('#')).length,
      darkPairs: S.dark.size,
      brandPairs: darkSwitch.split('\n').filter(l => l.includes('--brand')).length,
      params: (paramsBlock().match(/--hx-[\w-]+:/g) || []).length
    }
  }
}

function buildDemo (result, outDir) {
  const dir = path.join(__dirname, 'demo')
  let html = fs.readFileSync(path.join(dir, 'template.html'), 'utf8')
  const st = result.stats
  const fill = {
    '/*WAS*/': result.demoWas,
    '/*NOW*/': result.demoNow,
    '/*TOKENS*/': JSON.stringify(result.tokens),
    '{{TOKENS_COUNT}}': String(result.tokens.length),
    '{{PARAMS}}': String(st.params),
    '{{DARK_PAIRS}}': String(st.darkPairs),
    '{{BRAND_PAIRS}}': String(st.brandPairs),
    '{{HEX}}': String(st.hexPrimitives)
  }
  for (const [k, v] of Object.entries(fill)) html = html.split(k).join(v)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'index.html'), html)
  fs.writeFileSync(path.join(outDir, 'tokens.css'), result.css)
}

if (require.main === module) {
  const root = path.join(__dirname, '..', '..', '..')
  const src = fs.readFileSync(path.join(root, 'src/colors/tokens-pixso/tokens.css'), 'utf8')
  const result = build(src)
  fs.writeFileSync(path.join(__dirname, 'tokens.css'), result.css)
  console.log(`oklch: ${result.tokens.length} tokens, ${result.stats.params} params → src/colors/oklch/tokens.css`)
  if (process.argv.includes('--demo')) {
    const out = path.join(root, 'oklch-demo')
    buildDemo(result, out)
    console.log(`oklch: demo → ${path.relative(root, out)}/index.html`)
  }
}

module.exports = { build, buildDemo, parseBlocks }

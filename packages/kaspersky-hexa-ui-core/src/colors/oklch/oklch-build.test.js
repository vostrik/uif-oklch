const fs = require('fs')
const path = require('path')
const { build, parseBlocks } = require('./oklch-build')

const root = path.join(__dirname, '..', '..', '..')
const source = fs.readFileSync(path.join(root, 'src/colors/tokens-pixso/tokens.css'), 'utf8')
const committed = fs.readFileSync(path.join(__dirname, 'tokens.css'), 'utf8')
const result = build(source)

const names = css => new Set(parseBlocks(css).flatMap(b => b.decls.map(([k]) => k)))

describe('oklch tokens', () => {
  test('committed tokens.css is up to date (run `npm run build:oklch`)', () => {
    expect(committed).toBe(result.css)
  })

  test('every Hexa token keeps its name', () => {
    const before = names(source)
    const after = names(result.css)
    const missing = [...before].filter(n => !after.has(n))
    expect(missing).toEqual([])
  })

  test('the only colour literals are the base and fixed brand colours', () => {
    const hex = result.css.match(/--[\w-]+:\s*#[0-9A-Fa-f]{6,8};/g) || []
    const notBrand = hex.filter(d => !d.includes('kaspersky_green') && !d.startsWith('--hx-base:'))
    expect(notBrand).toEqual([])
  })

  test('dark theme only switches parameters (plus fixed brand colours)', () => {
    const dark = parseBlocks(result.css).find(b => b.selector.startsWith('.theme-dark'))
    const own = dark.decls.map(([k]) => k).filter(k => !k.startsWith('hx-') && !k.startsWith('brand--'))
    expect(own).toEqual([])
  })
})

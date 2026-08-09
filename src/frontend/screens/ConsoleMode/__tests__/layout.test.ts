import fs from 'node:fs'
import path from 'node:path'

const styles = fs.readFileSync(path.join(__dirname, '..', 'index.scss'), 'utf8')

describe('Console Mode layout invariants', () => {
  it('keeps selected-card glow outside the media clipping layer', () => {
    expect(styles).toMatch(/\.consoleCard\s*\{[\s\S]*?overflow:\s*visible/)
    expect(styles).toMatch(/\.consoleCardMedia\s*\{[\s\S]*?overflow:\s*hidden/)
  })

  it('contains hero logos instead of cropping their artwork', () => {
    expect(styles).toMatch(
      /\.consoleHeroLogo\s*\{[\s\S]*?object-fit:\s*contain/
    )
  })
})

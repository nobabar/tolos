import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const engineRoot = join(process.cwd(), 'src/engine')

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(path))
      continue
    }
    if (/\.(ts|js|vue)$/.test(entry.name)) files.push(path)
  }
  return files
}

describe('engine/render boundary', () => {
  it('does not import vue under src/engine', () => {
    for (const path of collectSourceFiles(engineRoot)) {
      const contents = readFileSync(path, 'utf8')
      expect(/from\s+['"]vue(?:\/[^'"]*)?['"]/.test(contents)).toBe(false)
    }
  })

  it('exports createRenderer and deriveLookFromDocument', async () => {
    const mod = await import('@/engine/render')
    expect(typeof mod.createRenderer).toBe('function')
    expect(typeof mod.deriveLookFromDocument).toBe('function')
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'

const html = readFileSync(resolve(cwd(), 'index.html'), 'utf8')
const authService = readFileSync(resolve(cwd(), 'src/services/authService.js'), 'utf8')

describe('configuração de segurança do frontend', () => {
  it('declara CSP restritiva e política de referência', () => {
    expect(html).toContain('http-equiv="Content-Security-Policy"')
    expect(html).toContain("default-src 'self'")
    expect(html).toContain("object-src 'none'")
    expect(html).toContain("base-uri 'self'")
    expect(html).toContain('name="referrer" content="no-referrer"')
  })

  it('não persiste o token de acesso no localStorage', () => {
    expect(authService).not.toMatch(/localStorage\.setItem\(['"]token['"]/)
  })
})

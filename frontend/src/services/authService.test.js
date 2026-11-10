import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  setAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
}))

vi.mock('./api', () => ({
  default: {
    post: mocks.post,
    get: vi.fn(),
    patch: vi.fn(),
  },
  AVISO_SESSAO_EXPIRADA: 'Sessão expirada.',
  AVISO_SESSAO_KEY: 'auth-session-notice',
  setAccessToken: mocks.setAccessToken,
  clearAccessToken: mocks.clearAccessToken,
}))

import { refreshSession } from './authService'

describe('restauração da sessão', () => {
  beforeEach(() => {
    mocks.post.mockReset()
  })

  it('compartilha uma única renovação quando o React inicializa duas vezes', async () => {
    let responder
    mocks.post.mockReturnValue(new Promise((resolve) => { responder = resolve }))

    const primeira = refreshSession()
    const segunda = refreshSession()

    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.post).toHaveBeenCalledWith('/auth/refresh')

    responder({ data: { token: 'novo-token', user: { role: 'cliente' } } })
    const resultados = await Promise.all([primeira, segunda])

    expect(resultados[0]).toEqual(resultados[1])
    expect(resultados[0].token).toBe('novo-token')
  })
})

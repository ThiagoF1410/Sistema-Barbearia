import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consultarCheckout } from '../services/pagamentosService'
import useCheckoutPolling from './useCheckoutPolling'

vi.mock('../services/pagamentosService', () => ({
  consultarCheckout: vi.fn(),
}))

describe('useCheckoutPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('informa quando o checkout foi confirmado', async () => {
    consultarCheckout.mockResolvedValue({ statuspagamento: 'CONFIRMADO' })
    const aoConfirmar = vi.fn()

    renderHook(() => useCheckoutPolling({
      sessionId: 'cs_test_confirmado',
      status: 'PENDENTE',
      aoConfirmar,
    }))

    await waitFor(() => expect(aoConfirmar).toHaveBeenCalledTimes(1))
    expect(consultarCheckout).toHaveBeenCalledWith('cs_test_confirmado')
  })

  it('informa quando o checkout foi cancelado', async () => {
    consultarCheckout.mockResolvedValue({ statuspagamento: 'cancelado' })
    const aoEncerrar = vi.fn()

    renderHook(() => useCheckoutPolling({
      sessionId: 'cs_test_cancelado',
      status: 'PENDENTE',
      aoEncerrar,
    }))

    await waitFor(() => expect(aoEncerrar).toHaveBeenCalledWith(
      'CANCELADO',
      expect.objectContaining({ statuspagamento: 'cancelado' }),
    ))
  })

  it('nao consulta sem sessao pendente', () => {
    renderHook(() => useCheckoutPolling({ sessionId: null, status: '' }))
    expect(consultarCheckout).not.toHaveBeenCalled()
  })
})

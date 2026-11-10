import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useFeedbackFocus from './useFeedbackFocus'

function Exemplo({ mensagem }) {
  const ref = useFeedbackFocus(mensagem)
  return mensagem ? <div ref={ref} role="alert">{mensagem}</div> : null
}

describe('useFeedbackFocus', () => {
  beforeEach(() => {
    window.requestAnimationFrame = (callback) => {
      callback()
      return 1
    }
    window.cancelAnimationFrame = vi.fn()
    window.matchMedia = vi.fn(() => ({ matches: false }))
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('leva o foco e a visualização até a nova mensagem', async () => {
    const { getByRole } = render(<Exemplo mensagem="Não foi possível concluir." />)
    const alerta = getByRole('alert')

    await waitFor(() => expect(alerta).toHaveFocus())
    expect(alerta).toHaveAttribute('tabindex', '-1')
    expect(alerta.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })
})

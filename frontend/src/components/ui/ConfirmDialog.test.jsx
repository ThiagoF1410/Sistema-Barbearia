import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

function renderizarDialogo(propriedades = {}) {
  const aoFechar = vi.fn()
  const aoConfirmar = vi.fn()
  render(
    <ConfirmDialog
      aberto
      titulo="Excluir registro?"
      descricao="Esta ação precisa de confirmação."
      aoFechar={aoFechar}
      aoConfirmar={aoConfirmar}
      {...propriedades}
    />
  )
  return { aoFechar, aoConfirmar }
}

describe('ConfirmDialog', () => {
  it('abre com foco no botão de retorno e mantém o foco dentro do card', () => {
    renderizarDialogo()
    const voltar = screen.getByRole('button', { name: 'Voltar' })
    const confirmar = screen.getByRole('button', { name: 'Confirmar' })

    expect(voltar).toHaveFocus()

    confirmar.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(voltar).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(confirmar).toHaveFocus()
  })

  it('permite cancelar com Escape quando não está processando', () => {
    const { aoFechar } = renderizarDialogo()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(aoFechar).toHaveBeenCalledOnce()
  })

  it('bloqueia ações enquanto o processamento está em andamento', () => {
    const { aoFechar } = renderizarDialogo({ processando: true })
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(aoFechar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Processando...' })).toBeDisabled()
  })
})

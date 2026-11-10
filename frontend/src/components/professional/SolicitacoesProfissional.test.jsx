import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  SecaoAusenciasProfissional,
  SecaoSolicitacoesProfissional,
} from './SolicitacoesProfissional'

const solicitacaoBase = {
  idsolicitacao: 1,
  tipo: 'FOLGA',
  status: 'APROVADA',
  datainicio: '2026-09-10',
  datafim: '2026-09-15',
  motivo: 'Compromisso pessoal',
}

describe('Solicitações do profissional', () => {
  it('apresenta uma solicitação aprovada sem ação de cancelamento', () => {
    render(<SecaoSolicitacoesProfissional solicitacoes={[solicitacaoBase]} aoCancelar={vi.fn()} desabilitado={false} />)

    expect(screen.getByText('APROVADA')).toBeVisible()
    expect(screen.getByText('6 dias')).toBeVisible()
    expect(screen.getByText('Compromisso pessoal')).toBeVisible()
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument()
  })

  it('permite selecionar uma solicitação pendente para cancelamento', async () => {
    const user = userEvent.setup()
    const aoCancelar = vi.fn()
    const solicitacao = { ...solicitacaoBase, status: 'PENDENTE' }
    render(<SecaoSolicitacoesProfissional solicitacoes={[solicitacao]} aoCancelar={aoCancelar} desabilitado={false} />)

    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(aoCancelar).toHaveBeenCalledWith(solicitacao)
  })

  it('apresenta uma indisponibilidade confirmada', () => {
    render(<SecaoAusenciasProfissional ausencias={[{
      iddisponibilidade: 10,
      tipo: 'FOLGA',
      datainicio: '2026-09-10',
      datafim: '2026-09-15',
      descricao: 'Período aprovado',
    }]} />)

    expect(screen.getByText(/período confirmado e bloqueado/i)).toBeVisible()
    expect(screen.getByText('6 dias')).toBeVisible()
    expect(screen.getByText('Período aprovado')).toBeVisible()
  })
})

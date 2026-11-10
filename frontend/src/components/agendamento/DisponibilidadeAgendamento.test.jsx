import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarioAgendamento, HorariosAgendamento } from './DisponibilidadeAgendamento'

describe('disponibilidade do agendamento', () => {
  it('permite selecionar somente uma data disponivel', () => {
    const aoEscolherData = vi.fn()
    const dias = [
      { data: '2026-09-09', disponivel: true, motivo: 'Disponivel' },
      { data: '2026-09-10', disponivel: false, motivo: 'Profissional nao atende' },
    ]

    render(<CalendarioAgendamento
      visivel
      carregando={false}
      carregandoHorarios={false}
      dias={dias}
      espacosIniciais={0}
      selecionado={null}
      tituloMes="setembro de 2026"
      aoMudarMes={vi.fn()}
      aoEscolherData={aoEscolherData}
    />)

    fireEvent.click(screen.getByRole('button', { name: /quarta-feira.*disponível/i }))
    expect(aoEscolherData).toHaveBeenCalledWith(dias[0])
    expect(screen.getByRole('button', { name: /quinta-feira.*indisponível/i })).toBeDisabled()
  })

  it('seleciona um horario retornado pela API', () => {
    const aoEscolherHorario = vi.fn()
    const horario = { inicio: '09:00', fim: '09:30' }

    render(<HorariosAgendamento
      visivel
      selecionado={{ data: '2026-09-09' }}
      carregando={false}
      resultado={{ horarios: [horario] }}
      horarioSelecionado={null}
      aoEscolherHorario={aoEscolherHorario}
    />)

    fireEvent.click(screen.getByRole('button', { name: /09:00/i }))
    expect(aoEscolherHorario).toHaveBeenCalledWith(horario)
  })
})

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { obterCalendario, obterHorariosDisponiveis } from '../services/agendaService'
import { listarServicos } from '../services/servicosService'
import { listarProfissionais } from '../services/profissionaisService'
import { criarAgendamento } from '../services/agendamentosService'
import { criarCheckout } from '../services/pagamentosService'
import BrandIcon from '../components/ui/BrandIcon'
import { EtapaProfissional, EtapaServico, NavegacaoEtapas, ResumoEscolhas } from '../components/agendamento/EtapasAgendamento'
import { ETAPAS } from '../components/agendamento/etapas'

const semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function AgendamentoPage() {
  const { user, logout } = useAuth()
  const [referencia, setReferencia] = useState(() => {
    const hoje = new Date()
    return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }
  })
  const [dias, setDias] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [servicos, setServicos] = useState([])
  const [servicoSelecionado, setServicoSelecionado] = useState(null)
  const [profissionais, setProfissionais] = useState([])
  const [profissionalSelecionado, setProfissionalSelecionado] = useState(null)
  const [resultadoHorarios, setResultadoHorarios] = useState(null)
  const [horarioSelecionado, setHorarioSelecionado] = useState(null)
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [confirmado, setConfirmado] = useState(null)
  const [erroPagamento, setErroPagamento] = useState('')
  const [abrindoPagamento, setAbrindoPagamento] = useState(false)
  const [etapa, setEtapa] = useState(0)
  const tituloEtapaRef = useRef(null)
  const consultaHorariosRef = useRef(0)
  const consultaCalendarioRef = useRef(0)

  useEffect(() => {
    tituloEtapaRef.current?.focus()
  }, [etapa])

  useEffect(() => {
    listarServicos()
      .then((dados) => setServicos(dados.filter((item) => item.tipo === 'servico')))
      .catch(() => setErro('Erro ao carregar serviços.'))
  }, [])

  useEffect(() => {
    listarProfissionais()
      .then(setProfissionais)
      .catch(() => setErro('Erro ao carregar profissionais.'))
  }, [])

  useEffect(() => {
    const consultaId = ++consultaCalendarioRef.current
    obterCalendario(
      referencia.ano,
      referencia.mes,
      servicoSelecionado?.idservico,
      profissionalSelecionado?.idprofissional
    )
      .then((resultado) => {
        if (consultaId === consultaCalendarioRef.current) setDias(resultado)
      })
      .catch((err) => {
        if (consultaId === consultaCalendarioRef.current) {
          setDias([])
          setErro(err.response?.data?.message || 'Erro ao carregar calendário.')
        }
      })
      .finally(() => {
        if (consultaId === consultaCalendarioRef.current) setCarregando(false)
      })
    return () => {
      if (consultaCalendarioRef.current === consultaId) consultaCalendarioRef.current += 1
    }
  }, [referencia, servicoSelecionado?.idservico, profissionalSelecionado?.idprofissional])

  const tituloMes = useMemo(() => new Date(referencia.ano, referencia.mes - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), [referencia])

  const espacosIniciais = dias.length
    ? new Date(`${dias[0].data}T12:00:00`).getDay()
    : 0

  function mudarMes(direcao) {
    consultaHorariosRef.current += 1
    consultaCalendarioRef.current += 1
    setCarregando(true)
    setCarregandoHorarios(false)
    setErro('')
    setDias([])
    setSelecionado(null)
    setResultadoHorarios(null)
    setHorarioSelecionado(null)
    setReferencia((atual) => {
      const data = new Date(atual.ano, atual.mes - 1 + direcao, 1)
      return { ano: data.getFullYear(), mes: data.getMonth() + 1 }
    })
  }

  function escolherServico(servico) {
    consultaHorariosRef.current += 1
    consultaCalendarioRef.current += 1
    setCarregandoHorarios(false)
    setServicoSelecionado(servico)
    setProfissionalSelecionado(null)
    setSelecionado(null)
    setResultadoHorarios(null)
    setHorarioSelecionado(null)
    setErro('')
    setDias([])
    setCarregando(true)
    setEtapa(1)
  }

  function escolherProfissional(profissional) {
    consultaHorariosRef.current += 1
    consultaCalendarioRef.current += 1
    setCarregandoHorarios(false)
    setProfissionalSelecionado(profissional)
    setSelecionado(null)
    setResultadoHorarios(null)
    setHorarioSelecionado(null)
    setErro('')
    setDias([])
    setCarregando(true)
    setEtapa(2)
  }

  async function escolherData(dia, opcoes = {}) {
    if (!servicoSelecionado || !profissionalSelecionado) {
      setErro('Escolha um serviço e um profissional antes de selecionar a data.')
      return
    }
    const consultaId = ++consultaHorariosRef.current
    if (!opcoes.preservarErro) setErro('')
    setSelecionado(dia)
    setResultadoHorarios(null)
    setHorarioSelecionado(null)
    setCarregandoHorarios(true)
    try {
      const resultado = await obterHorariosDisponiveis(dia.data, servicoSelecionado.idservico, profissionalSelecionado.idprofissional)
      if (consultaId !== consultaHorariosRef.current) return
      setResultadoHorarios(resultado)
      setEtapa(3)
    } catch (err) {
      if (consultaId !== consultaHorariosRef.current) return
      setSelecionado(null)
      setResultadoHorarios(null)
      setErro(err.response?.data?.message || 'Erro ao calcular horários disponíveis.')
    } finally {
      if (consultaId === consultaHorariosRef.current) setCarregandoHorarios(false)
    }
  }

  function escolherHorario(horario) {
    setHorarioSelecionado(horario)
    setErro('')
    setEtapa(4)
  }

  function etapaLiberada(indice) {
    if (indice === 0) return true
    if (indice === 1) return Boolean(servicoSelecionado)
    if (indice === 2) return Boolean(servicoSelecionado && profissionalSelecionado)
    if (indice === 3) return Boolean(servicoSelecionado && profissionalSelecionado && selecionado && resultadoHorarios)
    return Boolean(servicoSelecionado && profissionalSelecionado && selecionado && horarioSelecionado)
  }

  function abrirEtapa(indice) {
    if (etapaLiberada(indice)) {
      setErro('')
      setEtapa(indice)
    }
  }

  async function confirmarAgendamento() {
    if (!servicoSelecionado || !profissionalSelecionado || !selecionado || !horarioSelecionado) return
    setErro('')
    setConfirmando(true)
    try {
      const resultado = await criarAgendamento({
        servicoId: servicoSelecionado.idservico,
        profissionalId: profissionalSelecionado.idprofissional,
        data: selecionado.data,
        horario: horarioSelecionado.inicio,
      })
      setConfirmado(resultado)
      await abrirCheckout(resultado.idagendamento)
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao confirmar agendamento.')
      if (err.response?.status === 409) {
        await escolherData(selecionado, { preservarErro: true })
      }
    } finally {
      setConfirmando(false)
    }
  }

  async function abrirCheckout(agendamentoId) {
    setErroPagamento('')
    setAbrindoPagamento(true)
    try {
      const checkout = await criarCheckout(agendamentoId)
      window.location.assign(checkout.checkoutUrl)
    } catch (err) {
      setErroPagamento(err.response?.data?.message || 'O agendamento foi confirmado, mas não foi possível abrir o pagamento agora.')
      setAbrindoPagamento(false)
    }
  }

  if (confirmado) return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-4">
      <section className="w-full max-w-xl glass-panel rounded-3xl border border-primary/25 p-7 sm:p-10 text-center">
        <BrandIcon name="calendar" size={48} className="text-primary mx-auto" />
        <h1 className="font-headline text-3xl mt-4">Agendamento confirmado</h1>
        <p className="text-on-surface-variant mt-2">Seu atendimento foi reservado com sucesso.</p>
        <div className="mt-6 rounded-2xl bg-surface/70 border border-white/10 p-5 text-left space-y-2 text-sm">
          <p><strong>Serviço:</strong> {servicoSelecionado.nome}</p>
          <p><strong>Profissional:</strong> {profissionalSelecionado.nome}</p>
          <p><strong>Data:</strong> {new Date(`${confirmado.data}T12:00:00`).toLocaleDateString('pt-BR')}</p>
          <p><strong>Horário:</strong> {confirmado.horario}</p>
        </div>
        {erroPagamento && <div role="alert" className="mt-5 rounded-2xl border border-error/40 bg-error/10 p-4 text-sm text-error">{erroPagamento}</div>}
        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
          <button type="button" onClick={() => abrirCheckout(confirmado.idagendamento)} disabled={abrindoPagamento}
            className="px-6 py-3 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50">
            {abrindoPagamento ? 'Abrindo pagamento...' : 'Pagar agora'}
          </button>
          <Link to="/dashboard" className="px-6 py-3 border border-primary/35 text-primary rounded-full text-xs font-bold uppercase tracking-widest hover:bg-primary/10">Voltar ao painel</Link>
        </div>
      </section>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-surface border-b border-outline-variant/40">
        <Link to="/dashboard" className="font-headline text-lg sm:text-xl hover:text-primary transition-colors">O Rei da Navalha</Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden sm:block text-sm text-on-surface-variant">{user?.nome || user?.name}</span>
          <button onClick={() => { logout(); window.location.href = '/login' }} className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-error">
            <BrandIcon name="logout" size={18} />Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-start gap-3 mb-8">
          <Link to="/dashboard" className="mt-1 text-on-surface-variant hover:text-primary" aria-label="Voltar ao painel"><BrandIcon name="back" /></Link>
          <div>
            <h1 className="font-headline text-3xl sm:text-4xl">Agende seu atendimento</h1>
            <p className="text-sm text-on-surface-variant mt-2">Escolha o serviço, o profissional e depois a data e o horário.</p>
          </div>
        </div>

        <NavegacaoEtapas etapa={etapa} etapaLiberada={etapaLiberada} abrirEtapa={abrirEtapa} />

        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 ref={tituloEtapaRef} tabIndex="-1" className="font-headline text-2xl outline-none">{ETAPAS[etapa].titulo}</h2>
          {etapa > 0 && <button type="button" onClick={() => abrirEtapa(etapa - 1)} className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary"><BrandIcon name="back" size={18} />Voltar</button>}
        </div>

        {etapa === 0 && <EtapaServico servicos={servicos} selecionado={servicoSelecionado} aoSelecionar={escolherServico} />}

        {etapa === 1 && <EtapaProfissional profissionais={profissionais} selecionado={profissionalSelecionado} servicoSelecionado={servicoSelecionado} aoSelecionar={escolherProfissional} />}

        <div hidden={etapa !== 2} className="brand-divider mb-4"><BrandIcon name="calendar" size={20} /><span className="text-xs font-bold uppercase tracking-[0.18em]">3. Escolha a data</span></div>

        {erro && <div role="alert" className="mb-5 rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">{erro}</div>}

        <div className="grid gap-6">
          <section hidden={etapa !== 2} aria-busy={carregando} className="glass-panel rounded-3xl border border-white/10 p-4 sm:p-7">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => mudarMes(-1)} className="p-2 rounded-full border border-white/10 hover:border-primary/50 hover:text-primary" aria-label="Mês anterior">
                <BrandIcon name="back" />
              </button>
              <h2 className="font-headline text-xl sm:text-2xl capitalize">{tituloMes}</h2>
              <button onClick={() => mudarMes(1)} className="p-2 rounded-full border border-white/10 hover:border-primary/50 hover:text-primary" aria-label="Próximo mês">
                <BrandIcon name="next" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
              {semana.map((dia) => <div key={dia} className="text-center text-[10px] sm:text-xs uppercase tracking-wider text-white/40 py-2">{dia}</div>)}
            </div>

            {carregando ? (
              <div role="status" className="h-72 flex items-center justify-center text-on-surface-variant"><span className="w-4 h-4 rounded-full border-2 border-primary/25 border-t-primary animate-spin mr-2" aria-hidden="true" />Carregando</div>
            ) : (
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {Array.from({ length: espacosIniciais }).map((_, index) => <div key={`vazio-${index}`} />)}
                {dias.map((dia) => {
                  const ativo = selecionado?.data === dia.data
                  const dataPorExtenso = new Date(`${dia.data}T12:00:00`).toLocaleDateString('pt-BR', {
                    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                  })
                  const rotuloData = `${dataPorExtenso}. ${dia.disponivel ? 'Disponível' : 'Indisponível'}${dia.feriado ? `. Feriado: ${dia.feriado.nome}` : ''}${dia.motivo ? `. ${dia.motivo}` : ''}`
                  return (
                    <button
                      key={dia.data}
                      type="button"
                      disabled={!dia.disponivel || carregandoHorarios}
                      onClick={() => escolherData(dia)}
                      title={dia.feriado ? `${dia.feriado.nome} — ${dia.motivo}` : dia.motivo}
                      aria-label={rotuloData}
                      className={`relative min-h-16 sm:min-h-20 rounded-xl border p-1.5 sm:p-2 text-left transition-all ${
                        dia.disponivel
                          ? `bg-emerald-500/15 border-emerald-400/35 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-300 ${ativo ? 'ring-2 ring-primary border-primary' : ''}`
                          : 'bg-red-500/12 border-red-400/25 text-red-300/70 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-sm sm:text-base font-bold">{Number(dia.data.slice(-2))}</span>
                      {dia.feriado && <BrandIcon name="holiday" size={16} className="absolute top-1.5 right-1.5" label={dia.feriado.nome} />}
                      <span className="hidden sm:block text-[9px] leading-tight mt-2 line-clamp-2 opacity-75">{dia.feriado?.nome || dia.motivo}</span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-4 mt-6 pt-5 border-t border-white/5 text-xs text-on-surface-variant">
              <span className="flex items-center gap-2"><i className="w-3 h-3 rounded-full bg-emerald-500" />Disponível</span>
              <span className="flex items-center gap-2"><i className="w-3 h-3 rounded-full bg-red-500" />Indisponível</span>
              <span className="flex items-center gap-2"><BrandIcon name="holiday" size={18} className="text-primary" />Feriado</span>
            </div>
          </section>

          <aside hidden={etapa !== 3} className="glass-panel rounded-3xl border border-white/10 p-6 h-fit max-w-2xl w-full mx-auto">
            <BrandIcon name="calendar" size={34} className="text-primary" />
            <h2 className="font-headline text-2xl mt-3">4. Escolha o horário</h2>
            {selecionado ? (
              <div className="mt-5 space-y-4">
                <p className="text-lg capitalize">{new Date(`${selecionado.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
                {selecionado.feriado && <div className="rounded-xl bg-primary/10 border border-primary/20 p-3"><p className="text-xs uppercase tracking-wider text-primary">Feriado</p><p className="text-sm mt-1">{selecionado.feriado.nome}</p></div>}
                {carregandoHorarios ? (
                  <div className="flex items-center text-sm text-on-surface-variant"><span className="w-4 h-4 rounded-full border-2 border-primary/25 border-t-primary animate-spin mr-2" aria-hidden="true" />Calculando horários</div>
                ) : resultadoHorarios?.horarios?.length ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {resultadoHorarios.horarios.map((horario) => {
                        const ativo = horarioSelecionado?.inicio === horario.inicio
                        return (
                          <button
                            key={horario.inicio}
                            type="button"
                            onClick={() => escolherHorario(horario)}
                            aria-pressed={ativo}
                            className={`rounded-xl border px-3 py-2 text-sm transition-colors ${ativo ? 'border-primary bg-primary text-on-primary' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-300'}`}
                          >
                            {horario.inicio}
                            <span className="block text-[9px] opacity-70">até {horario.fim}</span>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-on-surface-variant">Os horários são consecutivos conforme a duração do serviço.</p>
                    {horarioSelecionado && <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm"><strong>Selecionado:</strong> {horarioSelecionado.inicio}–{horarioSelecionado.fim}</div>}
                  </>
                ) : (
                  <p className="text-xs text-on-surface-variant">{resultadoHorarios?.motivo || 'Calculando disponibilidade...'}</p>
                )}
              </div>
            ) : <p className="text-sm text-on-surface-variant mt-4">Primeiro escolha um serviço, um profissional e um dia verde.</p>}
          </aside>
        </div>

        {etapa === 4 && (
          <section className="max-w-2xl mx-auto glass-panel rounded-3xl border border-primary/20 p-5 sm:p-7">
            <div className="flex items-center gap-3 mb-6"><BrandIcon name="check" size={34} className="text-primary" /><div><p className="text-[10px] uppercase tracking-widest text-primary font-bold">Última etapa</p><h3 className="font-headline text-2xl">Revise e confirme</h3></div></div>
            <dl className="grid sm:grid-cols-2 gap-4 rounded-2xl bg-surface/70 border border-white/10 p-5 text-sm">
              <div><dt className="text-xs text-on-surface-variant">Serviço</dt><dd className="mt-1">{servicoSelecionado.nome}</dd></div>
              <div><dt className="text-xs text-on-surface-variant">Profissional</dt><dd className="mt-1">{profissionalSelecionado.nome}</dd></div>
              <div><dt className="text-xs text-on-surface-variant">Data</dt><dd className="mt-1 capitalize">{new Date(`${selecionado.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</dd></div>
              <div><dt className="text-xs text-on-surface-variant">Horário</dt><dd className="mt-1">{horarioSelecionado.inicio}–{horarioSelecionado.fim}</dd></div>
              <div><dt className="text-xs text-on-surface-variant">Duração</dt><dd className="mt-1">{servicoSelecionado.duracao} minutos</dd></div>
              <div><dt className="text-xs text-on-surface-variant">Valor</dt><dd className="mt-1 font-bold text-primary">R$ {Number(servicoSelecionado.preco).toFixed(2)}</dd></div>
            </dl>
            <button type="button" onClick={confirmarAgendamento} disabled={confirmando}
              className="w-full mt-5 px-5 py-3.5 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50">
              {confirmando ? 'Confirmando...' : 'Confirmar agendamento'}
            </button>
          </section>
        )}

        <ResumoEscolhas servico={servicoSelecionado} profissional={profissionalSelecionado} data={selecionado} horario={horarioSelecionado} />
      </main>
    </div>
  )
}

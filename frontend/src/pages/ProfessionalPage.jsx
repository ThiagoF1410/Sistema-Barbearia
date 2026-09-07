import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { carregarDashboardProfissional } from '../services/agendamentosService'
import { obterMeuPerfilProfissional } from '../services/profissionaisService'
import {
  cancelarMinhaSolicitacaoAusencia,
  criarMinhaSolicitacaoAusencia,
  obterCalendario,
  listarMeusHorariosProfissional,
  listarMinhasAusenciasProfissional,
  listarMinhasSolicitacoesAusencia,
} from '../services/agendaService'
import BrandIcon from '../components/ui/BrandIcon'
import BrandedDatePicker from '../components/ui/BrandedDatePicker'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ProfessionalLayout from '../components/professional/ProfessionalLayout'
import NotificationBell from '../components/NotificationBell'

const ABAS_VALIDAS = ['visao', 'agenda', 'escala', 'solicitacoes']
const ABAS = []

const DIAS = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
}

const STATUS = {
  AGENDADO: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  CONCLUIDO: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  CANCELADO: 'border-red-400/30 bg-red-500/10 text-red-200',
}

const PAGAMENTO = {
  CONFIRMADO: { texto: 'Pagamento confirmado', classe: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' },
  PENDENTE: { texto: 'Pagamento pendente', classe: 'border-amber-400/30 bg-amber-500/10 text-amber-200' },
  CANCELADO: { texto: 'Pagamento cancelado', classe: 'border-red-400/30 bg-red-500/10 text-red-200' },
  FALHOU: { texto: 'Pagamento não confirmado', classe: 'border-red-400/30 bg-red-500/10 text-red-200' },
  NAO_INICIADO: { texto: 'Pagamento não iniciado', classe: 'border-white/10 bg-white/5 text-on-surface-variant' },
}

const STATUS_SOLICITACAO = {
  PENDENTE: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  APROVADA: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  RECUSADA: 'border-red-400/30 bg-red-500/10 text-red-200',
  CANCELADA: 'border-white/15 bg-white/5 text-on-surface-variant',
}

const SOLICITACAO_INICIAL = { tipo: 'FOLGA', datainicio: '', datafim: '', motivo: '' }

function dataLocalAtual() {
  const agora = new Date()
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset())
  return agora.toISOString().slice(0, 10)
}

function deslocarData(data, dias) {
  const valor = new Date(`${data}T12:00:00`)
  valor.setDate(valor.getDate() + dias)
  return valor.toISOString().slice(0, 10)
}

function formatarData(data, completa = true) {
  if (!data) return 'Data não informada'
  const texto = new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', completa
    ? { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: 'short' })
  return texto.replace('.', '')
}

function horarioFinal(horario, duracao) {
  const [hora, minuto] = String(horario || '00:00').split(':').map(Number)
  const total = (hora * 60) + minuto + Number(duracao || 0)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function formatarTelefone(telefone) {
  const numero = String(telefone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (numero.length === 11) return `(${numero.slice(0, 2)}) ${numero.slice(2, 7)}-${numero.slice(7)}`
  if (numero.length === 10) return `(${numero.slice(0, 2)}) ${numero.slice(2, 6)}-${numero.slice(6)}`
  return telefone || 'Não informado'
}

function linkWhatsApp(telefone) {
  const numero = String(telefone || '').replace(/\D/g, '')
  if (!numero) return null
  return `https://wa.me/${numero.startsWith('55') ? numero : `55${numero}`}`
}

function Badge({ children, className = '' }) {
  return <span className={`inline-flex rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${className}`}>{children}</span>
}

function Skeleton() {
  return <div className="space-y-5" role="status" aria-label="Carregando painel profissional">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />)}</div>
    <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
  </div>
}

function EstadoVazio({ titulo, descricao, acao, rotuloAcao }) {
  return <div className="glass-panel rounded-3xl border border-white/10 px-5 py-10 text-center sm:py-12">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="calendar" size={28} /></div>
    <h3 className="mt-5 font-headline text-xl">{titulo}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-on-surface-variant">{descricao}</p>
    {acao && <button type="button" onClick={acao} className="mt-5 min-h-11 rounded-full bg-primary px-6 text-[10px] font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container">{rotuloAcao}</button>}
  </div>
}

function CardAtendimento({ item, compacto = false }) {
  const status = String(item.statusagendamento || 'AGENDADO').toUpperCase()
  const codigoPagamento = String(item.statuspagamento || 'NAO_INICIADO').toUpperCase()
  const pagamento = item.metodo === 'DINHEIRO' && codigoPagamento === 'PENDENTE'
    ? { texto: 'Dinheiro na barbearia', classe: 'border-amber-400/30 bg-amber-500/10 text-amber-200' }
    : PAGAMENTO[codigoPagamento] || PAGAMENTO.NAO_INICIADO
  const whatsapp = linkWhatsApp(item.cliente_telefone)

  return <article className={`glass-panel rounded-2xl border border-white/10 transition-all hover:-translate-y-0.5 hover:border-primary/25 ${compacto ? 'p-4' : 'p-5 sm:p-6'}`}>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{item.horario} – {horarioFinal(item.horario, item.duracao)}</p>
          <Badge className={STATUS[status] || 'border-white/10 text-on-surface-variant'}>{status}</Badge>
        </div>
        <h3 className={`mt-3 font-headline ${compacto ? 'text-lg' : 'text-xl sm:text-2xl'}`}>{item.servico}</h3>
        <p className="mt-1.5 text-sm font-semibold">{item.cliente}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
          <span>{item.duracao} minutos</span>
          {!compacto && <span>{formatarTelefone(item.cliente_telefone)}</span>}
          {!compacto && item.cliente_email && <span className="break-all">{item.cliente_email}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:max-w-56 sm:justify-end">
        {!compacto && <Badge className={pagamento.classe}>{pagamento.texto}</Badge>}
        {whatsapp && status !== 'CANCELADO' && <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-full border border-emerald-400/25 px-3 text-[9px] font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/10" aria-label={`Conversar com ${item.cliente} pelo WhatsApp`}><BrandIcon name="phone" size={15} />WhatsApp</a>}
      </div>
    </div>
  </article>
}

function LinhaTempo({ itens }) {
  return <ol className="relative space-y-3 before:absolute before:bottom-5 before:left-[2.15rem] before:top-5 before:w-px before:bg-primary/20 sm:before:left-[3.15rem]">
    {itens.map((item) => <li key={item.idagendamento} className="relative grid grid-cols-[68px_minmax(0,1fr)] gap-3 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-4">
      <div className="relative z-10 pt-4 text-center"><span className="inline-flex rounded-full border border-primary/25 bg-background px-2.5 py-1 font-headline text-sm text-primary sm:text-base">{item.horario}</span></div>
      <CardAtendimento item={item} compacto />
    </li>)}
  </ol>
}

export default function ProfessionalPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [parametros] = useSearchParams()
  const hoje = dataLocalAtual()
  const abaInicial = ABAS_VALIDAS.includes(parametros.get('aba')) ? parametros.get('aba') : 'visao'
  const [aba, setAba] = useState(abaInicial)
  const [data, setData] = useState(hoje)
  const [perfil, setPerfil] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [horarios, setHorarios] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])
  const [datasCalendario, setDatasCalendario] = useState([])
  const [feriadosCalendario, setFeriadosCalendario] = useState([])
  const [novaSolicitacao, setNovaSolicitacao] = useState(SOLICITACAO_INICIAL)
  const [solicitacaoParaCancelar, setSolicitacaoParaCancelar] = useState(null)
  const [carregandoBase, setCarregandoBase] = useState(true)
  const [carregandoAgenda, setCarregandoAgenda] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [removendoId, setRemovendoId] = useState(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    const abaDaUrl = parametros.get('aba')
    if (!ABAS_VALIDAS.includes(abaDaUrl)) return undefined
    const temporizador = window.setTimeout(() => setAba(abaDaUrl), 0)
    return () => window.clearTimeout(temporizador)
  }, [parametros])

  useEffect(() => {
    let consultaAtiva = true
    Promise.all([
      obterMeuPerfilProfissional(),
      listarMeusHorariosProfissional(),
      listarMinhasAusenciasProfissional(),
      listarMinhasSolicitacoesAusencia(),
    ])
      .then(([dadosPerfil, dadosHorarios, dadosAusencias, dadosSolicitacoes]) => {
        if (!consultaAtiva) return
        setPerfil(dadosPerfil)
        setHorarios(dadosHorarios)
        setAusencias(dadosAusencias)
        setSolicitacoes(dadosSolicitacoes)
      })
      .catch((err) => {
        if (consultaAtiva) setErro(err.response?.data?.message || 'Não foi possível carregar as informações profissionais. Tente novamente.')
      })
      .finally(() => { if (consultaAtiva) setCarregandoBase(false) })
    return () => { consultaAtiva = false }
  }, [])

  useEffect(() => {
    let consultaAtiva = true
    carregarDashboardProfissional(data)
      .then((dados) => { if (consultaAtiva) setDashboard(dados) })
      .catch((err) => {
        if (consultaAtiva) setErro(err.response?.data?.message || 'Não foi possível carregar sua agenda. Tente novamente.')
      })
      .finally(() => { if (consultaAtiva) setCarregandoAgenda(false) })
    return () => { consultaAtiva = false }
  }, [data])

  const carregarIndicadoresCalendario = useCallback(async (ano, mes) => {
    try {
      const dias = await obterCalendario(ano, mes)
      setFeriadosCalendario(dias
        .filter((dia) => dia.feriado)
        .map((dia) => ({ data: dia.data, ...dia.feriado })))
      setDatasCalendario(dias.map((dia) => {
        const emAusencia = ausencias.some((ausenciaProfissional) => (
          dia.data >= ausenciaProfissional.datainicio && dia.data <= ausenciaProfissional.datafim
        ))
        return { data: dia.data, disponivel: emAusencia ? false : dia.disponivel }
      }))
    } catch {
      // Os indicadores são complementares: a agenda segue utilizável mesmo se falharem.
      setDatasCalendario([])
      setFeriadosCalendario([])
    }
  }, [ausencias])

  const resumo = dashboard?.resumo || {}
  const resumoMes = resumo.mes || {}
  const agendamentos = dashboard?.agendamentos || []
  const proximos = dashboard?.proximos || []
  const nomeProfissional = perfil?.nome || user?.nome || 'Profissional'
  const primeiroNome = nomeProfissional.split(' ')[0]
  const iniciais = nomeProfissional.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()

  const proximaAusencia = useMemo(() => ausencias
    .filter((item) => item.datafim >= hoje)
    .sort((a, b) => a.datainicio.localeCompare(b.datainicio))[0], [ausencias, hoje])

  const proximoAtendimento = proximos[0]

  const cards = [
    { icon: 'calendar', valor: resumo.total ?? 0, rotulo: 'Atendimentos hoje', detalhe: formatarData(data, false) },
    { icon: 'clock', valor: resumo.agendados ?? 0, rotulo: 'Aguardando', detalhe: 'Na data selecionada' },
    { icon: 'check', valor: resumoMes.concluidos ?? 0, rotulo: 'Concluídos no mês', detalhe: `${resumoMes.atendimentos ?? 0} atendimentos válidos` },
    { icon: 'users', valor: resumoMes.clientes ?? 0, rotulo: 'Clientes no mês', detalhe: 'Clientes distintos atendidos' },
  ]

  function selecionarData(novaData) {
    setCarregandoAgenda(true)
    setData(novaData)
  }

  function trocarAba(novaAba) {
    setAba(novaAba)
    if (novaAba === 'visao' && data !== hoje) selecionarData(hoje)
  }

  async function enviarSolicitacao(event) {
    event.preventDefault()
    setErro('')
    setSucesso('')
    setSalvando(true)
    try {
      const criada = await criarMinhaSolicitacaoAusencia(novaSolicitacao)
      setSolicitacoes((atuais) => [criada, ...atuais])
      setNovaSolicitacao(SOLICITACAO_INICIAL)
      setSucesso('Solicitação enviada. Sua agenda continuará disponível até a aprovação da administração.')
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível enviar a solicitação. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarCancelamentoSolicitacao() {
    if (!solicitacaoParaCancelar) return
    const id = solicitacaoParaCancelar.idsolicitacao
    setErro('')
    setSucesso('')
    setRemovendoId(id)
    try {
      await cancelarMinhaSolicitacaoAusencia(id)
      setSolicitacoes((atuais) => atuais.map((item) => item.idsolicitacao === id ? { ...item, status: 'CANCELADA' } : item))
      setSucesso('Solicitação cancelada com sucesso.')
      setSolicitacaoParaCancelar(null)
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível cancelar a solicitação. Tente novamente.')
    } finally {
      setRemovendoId(null)
    }
  }

  function sair() {
    logout()
    navigate('/login')
  }

  return <ProfessionalLayout aba={aba} aoSelecionar={trocarAba} perfil={perfil} titulo={aba === 'agenda' ? 'Minha agenda' : aba === 'escala' ? 'Minha escala' : aba === 'solicitacoes' ? 'Solicitações' : 'Visão geral'} subtitulo={aba === 'agenda' ? 'Agenda individual' : aba === 'escala' ? 'Expediente e indisponibilidades' : aba === 'solicitacoes' ? 'Folgas e férias para aprovação' : 'Central de atendimentos'}>
    <div className="min-h-screen bg-background text-on-surface">
    <header className="hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="razor" size={22} /></div>
          <div className="min-w-0"><p className="truncate font-headline text-lg">O Rei da Navalha</p><p className="text-[8px] font-bold uppercase tracking-[0.18em] text-primary">Área do profissional</p></div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationBell />
          <div className="hidden text-right md:block"><p className="text-xs font-semibold">{nomeProfissional}</p><p className="text-[9px] text-on-surface-variant">{perfil?.especialidade || 'Profissional'}</p></div>
          <button type="button" onClick={sair} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-3 text-xs text-on-surface-variant hover:border-error/30 hover:text-error" aria-label="Sair da área profissional"><BrandIcon name="logout" size={17} /><span className="hidden sm:inline">Sair</span></button>
        </div>
      </div>
      <nav aria-label="Navegação da área profissional" className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
        <div className="flex min-w-max gap-1 pb-2">{ABAS.map((item) => <button key={item.id} type="button" onClick={() => trocarAba(item.id)} aria-current={aba === item.id ? 'page' : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-bold transition-colors ${aba === item.id ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'}`}><BrandIcon name={item.icon} size={17} />{item.label}</button>)}</div>
      </nav>
    </header>

    <main className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6 sm:py-9">
      <section className="glass-panel overflow-hidden rounded-3xl border border-primary/15 p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 font-headline text-xl text-primary sm:h-16 sm:w-16 sm:text-2xl">{iniciais}</div>
            <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">Central de atendimentos</p><h1 className="mt-1 font-headline text-3xl sm:text-4xl">Olá, {primeiroNome}</h1><p className="mt-2 max-w-2xl text-sm text-on-surface-variant">Acompanhe seus atendimentos, consulte sua escala e solicite períodos de ausência.</p></div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => { selecionarData(hoje); setAba('agenda') }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[10px] font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container"><BrandIcon name="calendar" size={17} />Agenda de hoje</button>
            <button type="button" onClick={() => setAba('solicitacoes')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 px-5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:border-primary/35 hover:text-primary"><BrandIcon name="clock" size={17} />Solicitar folga</button>
          </div>
        </div>
      </section>

      {erro && <div role="alert" className="flex flex-col justify-between gap-3 rounded-2xl border border-error/25 bg-error/10 px-4 py-4 text-sm text-error sm:flex-row sm:items-center"><span>{erro}</span><button type="button" onClick={() => window.location.reload()} className="self-start rounded-full border border-error/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wider">Tentar novamente</button></div>}
      {sucesso && <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200"><BrandIcon name="check" size={19} /><span>{sucesso}</span></div>}

      {(carregandoBase || carregandoAgenda) && !dashboard ? <Skeleton /> : <>
        {aba === 'visao' && <div className="space-y-8">
          <section aria-label="Resumo profissional" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map((card) => <button key={card.rotulo} type="button" onClick={() => setAba('agenda')} className="glass-panel group rounded-2xl border border-white/10 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/35"><div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name={card.icon} size={19} /></div><p className="font-headline text-2xl text-primary sm:text-3xl">{card.valor}</p></div><p className="mt-3 text-xs font-bold">{card.rotulo}</p><p className="mt-1 text-[10px] text-on-surface-variant">{card.detalhe}</p></button>)}</section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]">
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Hoje</p><h2 className="mt-2 font-headline text-2xl sm:text-3xl">Agenda do dia</h2></div><button type="button" onClick={() => { selecionarData(hoje); setAba('agenda') }} className="text-xs font-bold text-primary hover:text-primary-container">Ver agenda completa</button></div>
              {dashboard?.data === hoje && agendamentos.length
                ? <LinhaTempo itens={agendamentos.slice(0, 4)} />
                : <EstadoVazio titulo="Nenhum atendimento hoje" descricao={proximoAtendimento ? `Seu próximo atendimento será em ${formatarData(proximoAtendimento.data, false)}, às ${proximoAtendimento.horario}.` : 'Sua agenda está livre e não existem atendimentos futuros cadastrados.'} acao={() => { selecionarData(hoje); setAba('agenda') }} rotuloAcao="Consultar agenda" />}
            </div>

            <aside className="space-y-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Próximos dias</p><h2 className="mt-2 font-headline text-2xl">Próximos atendimentos</h2></div>
              <div className="glass-panel space-y-2 rounded-3xl border border-white/10 p-3 sm:p-4">{proximos.length ? proximos.slice(0, 5).map((item) => <button type="button" key={item.idagendamento} onClick={() => { selecionarData(item.data); setAba('agenda') }} className="w-full rounded-2xl border border-white/[0.07] bg-black/10 p-3.5 text-left transition-colors hover:border-primary/25"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-wider text-primary">{formatarData(item.data, false)} · {item.horario}</span><BrandIcon name="next" size={15} className="text-white/30" /></div><p className="mt-2 text-sm font-semibold">{item.cliente}</p><p className="mt-1 text-[10px] text-on-surface-variant">{item.servico}</p></button>) : <div className="px-3 py-9 text-center"><BrandIcon name="calendar" size={28} className="mx-auto text-primary/70" /><p className="mt-3 text-sm font-semibold">Agenda futura livre</p><p className="mt-1 text-xs text-on-surface-variant">Novos atendimentos aparecerão aqui.</p></div>}</div>
              {proximaAusencia && <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-amber-200">Próxima indisponibilidade</p><p className="mt-2 text-sm font-semibold">{formatarData(proximaAusencia.datainicio, false)} até {formatarData(proximaAusencia.datafim, false)}</p><p className="mt-1 text-xs text-on-surface-variant">{proximaAusencia.descricao || proximaAusencia.tipo}</p></div>}
            </aside>
          </section>
        </div>}

        {aba === 'agenda' && <section className="space-y-6" aria-labelledby="titulo-minha-agenda">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Agenda individual</p><h2 id="titulo-minha-agenda" className="mt-2 font-headline text-2xl capitalize sm:text-3xl">{formatarData(data)}</h2><p className="mt-2 text-xs text-on-surface-variant">Somente os atendimentos associados ao seu perfil são exibidos.</p></div><div className="glass-panel flex items-center gap-2 rounded-2xl border border-white/10 p-2"><button type="button" onClick={() => selecionarData(deslocarData(data, -1))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 hover:border-primary/40 hover:text-primary" aria-label="Dia anterior"><BrandIcon name="back" size={18} /></button><BrandedDatePicker id="data-profissional" value={data} onChange={(valor) => selecionarData(valor || hoje)} allowClear={false} datas={datasCalendario} feriados={feriadosCalendario} onMonthChange={carregarIndicadoresCalendario} permitirDiasLiberados className="min-w-0 flex-1 sm:w-64" /><button type="button" onClick={() => selecionarData(deslocarData(data, 1))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 hover:border-primary/40 hover:text-primary" aria-label="Próximo dia"><BrandIcon name="next" size={18} /></button>{data !== hoje && <button type="button" onClick={() => selecionarData(hoje)} className="px-2 text-xs font-bold text-primary">Hoje</button>}</div></div>
          <div className="flex flex-wrap gap-2"><Badge className="border-amber-400/30 bg-amber-500/10 text-amber-200">{resumo.agendados ?? 0} agendados</Badge><Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200">{resumo.concluidos ?? 0} concluídos</Badge><Badge className="border-red-400/30 bg-red-500/10 text-red-200">{resumo.cancelados ?? 0} cancelados</Badge></div>
          {carregandoAgenda ? <Skeleton /> : agendamentos.length ? <LinhaTempo itens={agendamentos} /> : <EstadoVazio titulo="Nenhum atendimento nesta data" descricao="Selecione outro dia para consultar sua agenda individual." />}
        </section>}

        {aba === 'solicitacoes' && <section className="space-y-7" aria-labelledby="titulo-solicitacoes">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Disponibilidade</p><h2 id="titulo-solicitacoes" className="mt-2 font-headline text-2xl sm:text-3xl">Solicitações</h2><p className="mt-2 text-sm text-on-surface-variant">Solicite uma folga ou período de férias. A agenda só será bloqueada após a aprovação da administração.</p></div>
          <section className="glass-panel rounded-3xl border border-white/10 p-4 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="calendar" size={23} /></div><div><h3 className="font-headline text-xl">Nova solicitação</h3><p className="mt-1 text-xs text-on-surface-variant">Informe o período e o motivo para análise administrativa.</p></div></div><form onSubmit={enviarSolicitacao} className="mt-5"><fieldset disabled={salvando || removendoId !== null} className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-on-surface-variant"><span className="mb-2 block">Tipo</span><select value={novaSolicitacao.tipo} onChange={(event) => setNovaSolicitacao((atual) => ({ ...atual, tipo: event.target.value }))} className="input-heritage py-3"><option value="FOLGA">Folga</option><option value="FERIAS">Férias</option></select></label><div className="text-xs text-on-surface-variant"><span className="mb-2 block">Data inicial</span><BrandedDatePicker id="solicitacao-profissional-inicio" value={novaSolicitacao.datainicio} min={hoje} onChange={(valor) => setNovaSolicitacao((atual) => ({ ...atual, datainicio: valor, datafim: !atual.datafim || atual.datafim < valor ? valor : atual.datafim }))} /></div><div className="text-xs text-on-surface-variant"><span className="mb-2 block">Data final</span><BrandedDatePicker id="solicitacao-profissional-fim" value={novaSolicitacao.datafim} min={novaSolicitacao.datainicio || hoje} onChange={(valor) => setNovaSolicitacao((atual) => ({ ...atual, datafim: valor }))} /></div><label className="text-xs text-on-surface-variant"><span className="mb-2 block">Motivo ou observação</span><input value={novaSolicitacao.motivo} maxLength="255" onChange={(event) => setNovaSolicitacao((atual) => ({ ...atual, motivo: event.target.value }))} placeholder="Ex.: compromisso pessoal" className="input-heritage py-3" /></label><button type="submit" disabled={!novaSolicitacao.datainicio || !novaSolicitacao.datafim || salvando} className="min-h-11 rounded-full bg-primary px-6 text-xs font-bold uppercase tracking-wider text-on-primary disabled:opacity-50 sm:col-span-2 sm:justify-self-start">{salvando ? 'Enviando...' : 'Enviar solicitação'}</button></fieldset></form></section>
          <section className="space-y-4"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Acompanhamento</p><h3 className="mt-2 font-headline text-2xl">Minhas solicitações</h3></div><span className="text-xs text-on-surface-variant">{solicitacoes.length} registro(s)</span></div>{solicitacoes.length ? <div className="grid gap-4 md:grid-cols-2">{solicitacoes.map((item) => <article key={item.idsolicitacao} className="glass-panel rounded-2xl border border-white/10 p-5"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row"><div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge className="border-primary/25 bg-primary/10 text-primary">{item.tipo}</Badge><Badge className={STATUS_SOLICITACAO[item.status]}>{item.status}</Badge></div><p className="mt-4 font-headline text-xl capitalize">{formatarData(item.datainicio, false)} até {formatarData(item.datafim, false)}</p>{item.motivo && <p className="mt-2 text-sm text-on-surface-variant">{item.motivo}</p>}{item.resposta_administrador && <p className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3 text-xs"><strong className="text-primary">Resposta da administração:</strong> {item.resposta_administrador}</p>}</div>{item.status === 'PENDENTE' && <button type="button" onClick={() => setSolicitacaoParaCancelar(item)} disabled={removendoId !== null || salvando} className="shrink-0 rounded-full border border-error/25 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-error hover:bg-error/10 disabled:opacity-40">Cancelar</button>}</div></article>)}</div> : <EstadoVazio titulo="Nenhuma solicitação enviada" descricao="Use o formulário acima quando precisar solicitar uma folga ou um período de férias." />}</section>
        </section>}

        {aba === 'escala' && <section className="space-y-7" aria-labelledby="titulo-ausencias">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Disponibilidade</p><h2 id="titulo-ausencias" className="mt-2 font-headline text-2xl sm:text-3xl">Minha escala</h2><p className="mt-2 text-sm text-on-surface-variant">Consulte o expediente definido pela administração e solicite folgas ou férias para aprovação.</p></div>
          <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
            <section className="glass-panel rounded-3xl border border-white/10 p-4 sm:p-6"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="clock" size={23} /></div><div><h3 className="font-headline text-xl">Expediente semanal</h3><p className="mt-1 text-xs text-on-surface-variant">Alterações são realizadas pela administração.</p></div></div><ul className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{horarios.map((item) => <li key={item.dia_semana} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-3"><div><p className="text-sm font-semibold">{DIAS[item.dia_semana]}</p>{item.ativo ? <p className="mt-1 text-xs text-on-surface-variant">{item.hora_abertura} – {item.hora_fechamento}{item.intervalo_ativo && ` · intervalo ${item.hora_inicio_intervalo}–${item.hora_fim_intervalo}`}</p> : <p className="mt-1 text-xs text-error">Não trabalha</p>}</div><span className={`h-2.5 w-2.5 rounded-full ${item.ativo ? 'bg-emerald-400' : 'bg-white/20'}`} aria-label={item.ativo ? 'Dia trabalhado' : 'Dia fechado'} /></li>)}</ul></section>

            <section className="glass-panel rounded-3xl border border-white/10 p-4 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="calendar" size={23} /></div><div><h3 className="font-headline text-xl">Solicitar folga ou férias</h3><p className="mt-1 text-xs text-on-surface-variant">O período será bloqueado somente após a aprovação da administração.</p></div></div><form onSubmit={enviarSolicitacao} className="mt-5"><fieldset disabled={salvando || removendoId !== null} className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-on-surface-variant"><span className="mb-2 block">Tipo</span><select value={novaSolicitacao.tipo} onChange={(event) => setNovaSolicitacao((atual) => ({ ...atual, tipo: event.target.value }))} className="input-heritage py-3"><option value="FOLGA">Folga</option><option value="FERIAS">Férias</option></select></label><div className="text-xs text-on-surface-variant"><span className="mb-2 block">Data inicial</span><BrandedDatePicker id="solicitacao-profissional-inicio" value={novaSolicitacao.datainicio} min={hoje} onChange={(valor) => setNovaSolicitacao((atual) => ({ ...atual, datainicio: valor, datafim: !atual.datafim || atual.datafim < valor ? valor : atual.datafim }))} /></div><div className="text-xs text-on-surface-variant"><span className="mb-2 block">Data final</span><BrandedDatePicker id="solicitacao-profissional-fim" value={novaSolicitacao.datafim} min={novaSolicitacao.datainicio || hoje} onChange={(valor) => setNovaSolicitacao((atual) => ({ ...atual, datafim: valor }))} /></div><label className="text-xs text-on-surface-variant"><span className="mb-2 block">Motivo ou observação</span><input value={novaSolicitacao.motivo} maxLength="255" onChange={(event) => setNovaSolicitacao((atual) => ({ ...atual, motivo: event.target.value }))} placeholder="Ex.: compromisso pessoal" className="input-heritage py-3" /></label><button type="submit" disabled={!novaSolicitacao.datainicio || !novaSolicitacao.datafim || salvando} className="min-h-11 rounded-full bg-primary px-6 text-xs font-bold uppercase tracking-wider text-on-primary disabled:opacity-50 sm:col-span-2 sm:justify-self-start">{salvando ? 'Enviando...' : 'Enviar solicitação'}</button></fieldset></form></section>
          </div>

          <section className="space-y-4"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Acompanhamento</p><h3 className="mt-2 font-headline text-2xl">Minhas solicitações</h3></div><span className="text-xs text-on-surface-variant">{solicitacoes.length} registro(s)</span></div>{solicitacoes.length ? <div className="grid gap-4 md:grid-cols-2">{solicitacoes.map((item) => <article key={item.idsolicitacao} className="glass-panel rounded-2xl border border-white/10 p-5"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row"><div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge className="border-primary/25 bg-primary/10 text-primary">{item.tipo}</Badge><Badge className={STATUS_SOLICITACAO[item.status]}>{item.status}</Badge></div><p className="mt-4 font-headline text-xl capitalize">{formatarData(item.datainicio, false)} até {formatarData(item.datafim, false)}</p>{item.motivo && <p className="mt-2 text-sm text-on-surface-variant">{item.motivo}</p>}{item.resposta_administrador && <p className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3 text-xs"><strong className="text-primary">Resposta da administração:</strong> {item.resposta_administrador}</p>}</div>{item.status === 'PENDENTE' && <button type="button" onClick={() => setSolicitacaoParaCancelar(item)} disabled={removendoId !== null || salvando} className="shrink-0 rounded-full border border-error/25 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-error hover:bg-error/10 disabled:opacity-40">Cancelar</button>}</div></article>)}</div> : <EstadoVazio titulo="Nenhuma solicitação enviada" descricao="Use o formulário acima quando precisar solicitar uma folga ou um período de férias." />}</section>

          <section className="space-y-4"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Aprovadas pela administração</p><h3 className="mt-2 font-headline text-2xl">Indisponibilidades confirmadas</h3></div><span className="text-xs text-on-surface-variant">{ausencias.length} registro(s)</span></div>{ausencias.length ? <div className="grid gap-4 md:grid-cols-2">{ausencias.map((item) => <article key={item.iddisponibilidade} className="glass-panel rounded-2xl border border-white/10 p-5"><Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200">{item.tipo}</Badge><p className="mt-4 font-headline text-xl capitalize">{formatarData(item.datainicio, false)} até {formatarData(item.datafim, false)}</p>{item.descricao && <p className="mt-2 text-sm text-on-surface-variant">{item.descricao}</p>}</article>)}</div> : <div className="glass-panel rounded-3xl border border-white/10 p-8 text-center"><BrandIcon name="check" size={30} className="mx-auto text-emerald-300" /><p className="mt-4 font-headline text-lg">Nenhuma indisponibilidade confirmada</p><p className="mt-2 text-sm text-on-surface-variant">Sua agenda segue o expediente definido pela administração.</p></div>}</section>
        </section>}
      </>}
    </main>

    <ConfirmDialog
      aberto={Boolean(solicitacaoParaCancelar)}
      titulo="Cancelar solicitação?"
      descricao="A solicitação pendente será cancelada e deixará de ser analisada pela administração. Sua agenda continuará disponível."
      rotuloConfirmar="Cancelar solicitação"
      rotuloProcessando="Cancelando..."
      processando={removendoId !== null}
      aoConfirmar={confirmarCancelamentoSolicitacao}
      aoFechar={() => { if (removendoId === null) setSolicitacaoParaCancelar(null) }}
    />
  </div>
  </ProfessionalLayout>
}

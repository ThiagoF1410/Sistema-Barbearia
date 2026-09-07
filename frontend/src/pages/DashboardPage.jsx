import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cancelarAgendamento, listarMeusAgendamentos } from '../services/agendamentosService'
import { criarCheckout } from '../services/pagamentosService'
import BrandIcon from '../components/ui/BrandIcon'
import PagamentoCountdown from '../components/PagamentoCountdown'
import logoImg from '../assets/Logo1.avif'
import { abrirCheckoutEmNovaAba, fecharAbaPagamento, prepararAbaPagamento } from '../utils/checkoutWindow'

const quickActions = [
  { icon: 'calendar', label: 'Agendar horário', to: '/agendar', desc: 'Escolha serviço, profissional, data e horário.', tag: 'Atendimento' },
  { icon: 'bag', label: 'Loja', to: '/loja', desc: 'Compre produtos e retire diretamente na barbearia.', tag: 'Produtos' },
  { icon: 'history', label: 'Histórico', to: '/historico', desc: 'Acompanhe seus agendamentos e pagamentos.', tag: 'Sua atividade' },
  { icon: 'profile', label: 'Meu perfil', to: '/perfil', desc: 'Consulte e mantenha seus dados atualizados.', tag: 'Sua conta' },
]

const STATUS_AGENDAMENTO = {
  AGENDADO: { texto: 'Agendamento confirmado', classe: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200' },
  CONCLUIDO: { texto: 'Atendimento concluído', classe: 'border-primary/25 bg-primary/10 text-primary' },
  CANCELADO: { texto: 'Agendamento cancelado', classe: 'border-error/25 bg-error/10 text-error' },
}

const STATUS_PAGAMENTO = {
  CONFIRMADO: { texto: 'Pagamento confirmado', classe: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200' },
  PAGO: { texto: 'Pagamento confirmado', classe: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200' },
  PENDENTE: { texto: 'Pagamento pendente', classe: 'border-amber-400/30 bg-amber-500/10 text-amber-200' },
  FALHOU: { texto: 'Pagamento falhou', classe: 'border-error/25 bg-error/10 text-error' },
  CANCELADO: { texto: 'Pagamento cancelado', classe: 'border-error/25 bg-error/10 text-error' },
  NAO_INICIADO: { texto: 'Pagamento não iniciado', classe: 'border-white/15 bg-white/5 text-on-surface-variant' },
}

function formatarData(data) {
  const valor = new Date(`${data}T12:00:00`)
  const hoje = new Date()
  const amanha = new Date()
  amanha.setDate(hoje.getDate() + 1)
  const chave = valor.toLocaleDateString('sv-SE')
  const prefixo = chave === hoje.toLocaleDateString('sv-SE')
    ? 'Hoje · '
    : chave === amanha.toLocaleDateString('sv-SE') ? 'Amanhã · ' : ''
  const texto = valor.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'long' })
    .replace('.', '')
  return `${prefixo}${texto}`.toLocaleUpperCase('pt-BR')
}

function formatarHorarioFinal(horario, duracao) {
  const [hora, minuto] = String(horario).split(':').map(Number)
  const total = (hora * 60) + minuto + Number(duracao || 0)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function somenteProximos(dados) {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  return dados.filter((item) => item.statusagendamento === 'AGENDADO' && item.data >= hoje).reverse()
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [agendamentos, setAgendamentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [pagandoId, setPagandoId] = useState(null)
  const [cancelando, setCancelando] = useState(null)
  const [agendamentoParaCancelar, setAgendamentoParaCancelar] = useState(null)
  const [erroCancelamento, setErroCancelamento] = useState('')
  const [sucesso, setSucesso] = useState('')
  const botaoFecharDialogoRef = useRef(null)
  const dialogoRef = useRef(null)
  const elementoAnteriorRef = useRef(null)
  const cancelandoRef = useRef(null)
  const primeiroNome = user?.nome?.split(' ')[0] || user?.name?.split(' ')[0] || 'Cliente'
  const inicialCliente = primeiroNome.charAt(0).toLocaleUpperCase('pt-BR')

  async function carregarAgendamentos() {
    setErro('')
    try {
      const dados = await listarMeusAgendamentos()
      setAgendamentos(somenteProximos(dados))
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível carregar os agendamentos. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    let ativo = true
    listarMeusAgendamentos()
      .then((dados) => {
        if (ativo) setAgendamentos(somenteProximos(dados))
      })
      .catch((err) => {
        if (ativo) setErro(err.response?.data?.message || 'Não foi possível carregar os agendamentos. Tente novamente.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    cancelandoRef.current = cancelando
  }, [cancelando])

  useEffect(() => {
    if (!agendamentoParaCancelar) return undefined
    botaoFecharDialogoRef.current?.focus()
    function controlarTeclado(event) {
      if (event.key === 'Escape' && !cancelandoRef.current) {
        setAgendamentoParaCancelar(null)
        return
      }
      if (event.key !== 'Tab') return

      const focaveis = Array.from(dialogoRef.current?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || [])
      if (!focaveis.length) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener('keydown', controlarTeclado)
    return () => {
      document.removeEventListener('keydown', controlarTeclado)
      if (elementoAnteriorRef.current?.isConnected) elementoAnteriorRef.current.focus()
    }
  }, [agendamentoParaCancelar])

  function abrirCancelamento(agendamento) {
    elementoAnteriorRef.current = document.activeElement
    setErroCancelamento('')
    setSucesso('')
    setAgendamentoParaCancelar(agendamento)
  }

  async function confirmarCancelamento() {
    const agendamento = agendamentoParaCancelar
    if (!agendamento) return
    setErro('')
    setErroCancelamento('')
    setCancelando(agendamento.idagendamento)
    try {
      await cancelarAgendamento(agendamento.idagendamento)
      await carregarAgendamentos()
      setAgendamentoParaCancelar(null)
      setSucesso(`Agendamento de ${agendamento.servico} cancelado. O horário ${agendamento.horario} voltou a ficar disponível.`)
    } catch (err) {
      setErroCancelamento(err.response?.data?.message || 'Não foi possível cancelar o agendamento. Tente novamente.')
    } finally {
      setCancelando(null)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  async function pagarAgendamento(id) {
    const abaPagamento = prepararAbaPagamento()
    setPagandoId(id)
    setErro('')
    try {
      const checkout = await criarCheckout(id)
      abrirCheckoutEmNovaAba(checkout.checkoutUrl, abaPagamento)
    } catch (err) {
      fecharAbaPagamento(abaPagamento)
      setErro(err.response?.data?.message || 'Não foi possível abrir o pagamento agora.')
      setPagandoId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-primary/15 bg-black/90 shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          <Link to="/inicio" className="flex items-center gap-3 min-w-0 group" aria-label="O Rei da Navalha — página inicial">
            <img src={logoImg} alt="" width="44" height="44" decoding="async" className="h-11 w-11 object-contain shrink-0" />
            <div className="hidden sm:block min-w-0">
              <p className="font-headline text-lg leading-none group-hover:text-primary transition-colors">O Rei da Navalha</p>
              <p className="text-[8px] uppercase tracking-[0.24em] text-primary/75 mt-1">Área do cliente</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Navegação da conta">
            <Link to="/inicio" className="hidden sm:inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-white/75 hover:bg-white/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-colors">Início</Link>
            <Link to="/perfil" className="flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] py-1.5 pl-1.5 pr-2.5 hover:border-primary/35 hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-colors" aria-label={`Abrir perfil de ${primeiroNome}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-[11px] font-bold text-primary">{inicialCliente}</span>
              <span className="hidden md:inline max-w-36 truncate text-sm text-white/75">{primeiroNome}</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-10 items-center gap-1.5 rounded-full px-2.5 sm:px-3 text-sm text-white/75 hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60 transition-colors"
            >
              <BrandIcon name="logout" size={18} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-10 space-y-8 sm:space-y-10">
        <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-[linear-gradient(120deg,rgba(245,197,24,0.09),rgba(255,255,255,0.025)_45%,rgba(0,0,0,0)_75%)] p-5 sm:p-7 lg:p-8">
          <div aria-hidden="true" className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/[0.055] blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Central do cliente</p>
              <h1 className="font-headline text-3xl sm:text-4xl lg:text-[2.65rem]">
                Olá, {primeiroNome}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-on-surface-variant sm:text-base">Gerencie seus horários, acompanhe pagamentos e encontre tudo o que precisa em um só lugar.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-on-surface-variant">Próximos horários</p>
                <p className="mt-1 font-headline text-2xl text-primary">{carregando ? '—' : agendamentos.length}</p>
              </div>
              <Link to="/agendar" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.13em] text-on-primary shadow-lg shadow-primary/10 hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-colors">
                <BrandIcon name="calendar" size={18} />
                Agendar horário
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="titulo-acoes-rapidas" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Acesso rápido</p>
              <h2 id="titulo-acoes-rapidas" className="mt-1 font-headline text-2xl">O que você deseja fazer?</h2>
            </div>
            <p className="hidden text-xs text-on-surface-variant sm:block">Selecione uma opção para continuar</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {quickActions.map((a, indice) => (
              <Link
                key={a.label}
                to={a.to}
                className={`brand-card glass-panel min-h-44 p-5 sm:p-6 flex flex-col border transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 ${indice === 0 ? 'border-primary/30 bg-primary/[0.06] hover:border-primary/60' : 'border-outline-variant/10 hover:border-primary/35'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary group-hover:border-primary/40 group-hover:bg-primary/15 transition-colors">
                    <BrandIcon name={a.icon} size={25} className="group-hover:scale-110 transition-transform" />
                  </span>
                  <BrandIcon name="next" size={18} className="mt-1 text-white/25 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <div className="mt-auto pt-5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary/70">{a.tag}</p>
                  <h3 className="mt-1 font-label font-bold text-sm uppercase tracking-widest">{a.label}</h3>
                  <p className="text-on-surface-variant text-xs leading-relaxed mt-1.5">{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="titulo-proximos-agendamentos">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Sua agenda</p>
              <h2 id="titulo-proximos-agendamentos" className="font-headline text-2xl sm:text-3xl mt-1">Próximos agendamentos</h2>
            </div>
            {!carregando && agendamentos.length > 0 && <span className="text-xs text-on-surface-variant">{agendamentos.length} {agendamentos.length === 1 ? 'horário' : 'horários'}</span>}
          </div>
          {sucesso && <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-emerald-200">
            <div className="flex items-start gap-3"><BrandIcon name="check" size={25} className="shrink-0" /><div><p className="text-sm font-bold">Cancelamento confirmado</p><p className="text-xs mt-1 opacity-85">{sucesso}</p></div></div>
            <div className="flex items-center gap-3 pl-9 sm:pl-0"><Link to="/historico" className="text-xs font-bold underline underline-offset-4">Ver histórico</Link><button type="button" onClick={() => setSucesso('')} className="text-xs opacity-70 hover:opacity-100" aria-label="Fechar mensagem">Fechar</button></div>
          </div>}
          {erro && <p role="alert" className="rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">{erro}</p>}
          {carregando ? (
            <div className="grid gap-4" role="status" aria-label="Carregando próximos agendamentos">
              {[1, 2].map((item) => <div key={item} className="glass-panel rounded-2xl border border-white/10 p-5 sm:p-6 animate-pulse">
                <div className="flex justify-between gap-5"><div className="space-y-3 flex-1"><div className="h-6 w-48 rounded bg-white/10" /><div className="h-4 w-64 max-w-full rounded bg-white/[0.06]" /></div><div className="h-7 w-32 rounded-full bg-white/[0.06]" /></div>
                <div className="mt-6 h-12 rounded-xl bg-white/[0.04]" />
              </div>)}
              <span className="sr-only">Carregando...</span>
            </div>
          ) : agendamentos.length ? <div className="grid gap-4">
            {agendamentos.map((item) => {
              const statusAgendamento = STATUS_AGENDAMENTO[item.statusagendamento] || { texto: item.statusagendamento, classe: 'border-white/15 bg-white/5 text-on-surface-variant' }
              const codigoPagamento = String(item.statuspagamento || 'NAO_INICIADO').toUpperCase()
              const statusPagamento = item.metodo === 'DINHEIRO' && codigoPagamento === 'PENDENTE'
                ? { texto: 'Dinheiro na barbearia', classe: 'border-amber-400/30 bg-amber-500/10 text-amber-200' }
                : STATUS_PAGAMENTO[codigoPagamento] || { texto: `Pagamento: ${codigoPagamento}`, classe: 'border-white/15 bg-white/5 text-on-surface-variant' }
              return (
                <article key={item.idagendamento} className="glass-panel rounded-2xl border border-outline-variant/15 p-5 sm:p-6 hover:border-primary/25 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">Serviço</p>
                      <h3 className="font-headline text-xl sm:text-2xl mt-1 truncate">{item.servico}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <span className={`px-3 py-1.5 rounded-full border text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${statusAgendamento.classe}`}>{statusAgendamento.texto}</span>
                      <span className={`px-3 py-1.5 rounded-full border text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${statusPagamento.classe}`}>{statusPagamento.texto}</span>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mt-6 rounded-2xl border border-white/[0.06] bg-black/15 p-4">
                    <div className="flex items-start gap-3">
                      <BrandIcon name="calendar" size={20} className="text-primary shrink-0 mt-0.5" />
                      <div><p className="text-[9px] uppercase tracking-widest text-on-surface-variant">Data</p><p className="text-xs sm:text-sm font-semibold mt-1">{formatarData(item.data)}</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <BrandIcon name="clock" size={20} className="text-primary shrink-0 mt-0.5" />
                      <div><p className="text-[9px] uppercase tracking-widest text-on-surface-variant">Horário</p><p className="text-sm font-semibold mt-1">{item.horario} – {formatarHorarioFinal(item.horario, item.duracao)}</p><p className="text-[10px] text-on-surface-variant mt-0.5">{item.duracao} minutos</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <BrandIcon name="professional" size={20} className="text-primary shrink-0 mt-0.5" />
                      <div><p className="text-[9px] uppercase tracking-widest text-on-surface-variant">Profissional</p><p className="text-sm font-semibold mt-1">{item.profissional}</p></div>
                    </div>
                  </div>

                  {item.metodo === 'STRIPE' && codigoPagamento === 'PENDENTE' && item.checkout_expira_em && <div className="mt-4"><PagamentoCountdown expiraEm={item.checkout_expira_em} compacto onExpire={() => window.setTimeout(carregarAgendamentos, 16000)} /></div>}

                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mt-5 pt-5 border-t border-white/[0.07]">
                    <div><p className="text-[9px] uppercase tracking-widest text-on-surface-variant">Preço</p><p className="font-headline text-2xl text-primary mt-1">{formatarPreco(item.preco)}</p></div>
                    <div className="flex flex-col items-stretch sm:items-end gap-2">
                      <div className="flex flex-col-reverse sm:flex-row gap-2">
                        <button type="button" onClick={() => abrirCancelamento(item)} disabled={!item.pode_cancelar || cancelando === item.idagendamento}
                          title={item.pode_cancelar ? 'Cancelar agendamento' : 'Prazo mínimo de 2 horas encerrado'}
                          className="min-h-10 px-4 py-2 rounded-full border border-error/35 text-error text-xs font-bold uppercase tracking-wider hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60 disabled:opacity-40 disabled:cursor-not-allowed">
                          {cancelando === item.idagendamento ? 'Cancelando...' : 'Cancelar'}
                        </button>
                        {item.pode_pagar && <button type="button" onClick={() => pagarAgendamento(item.idagendamento)} disabled={pagandoId !== null}
                          className="min-h-10 px-5 py-2 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-50">
                          {pagandoId === item.idagendamento ? 'Abrindo...' : 'Pagar agora'}
                        </button>}
                      </div>
                      {!item.pode_cancelar && <p className="text-[10px] text-on-surface-variant">Cancelamento indisponível com menos de 2 horas</p>}
                    </div>
                  </div>
                </article>
              )
            })}
          </div> : <div className="glass-panel rounded-2xl border border-outline-variant/10 p-6 sm:p-8">
            <div className="flex flex-col items-center gap-5 text-center md:flex-row md:text-left">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="calendar" size={34} /></div>
              <div className="flex-1">
                <h3 className="font-headline text-xl">Sua agenda está livre</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-on-surface-variant">Você ainda não possui horários futuros. Escolha um serviço e encontre o melhor momento para seu próximo atendimento.</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row md:flex-col lg:flex-row">
                <Link to="/loja" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-wider hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-colors">Visitar loja</Link>
                <Link to="/agendar" className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2.5 text-xs font-label font-bold uppercase tracking-widest text-on-primary hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-colors">Agendar agora</Link>
              </div>
            </div>
          </div>}
        </section>
      </main>

      {agendamentoParaCancelar && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !cancelando) setAgendamentoParaCancelar(null) }}>
          <section ref={dialogoRef} role="dialog" aria-modal="true" aria-labelledby="titulo-cancelamento" aria-describedby="descricao-cancelamento"
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-error/20 bg-surface p-6 sm:p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="w-12 h-12 rounded-2xl bg-error/10 border border-error/20 text-error flex items-center justify-center"><BrandIcon name="alert" size={27} /></div>
              <button ref={botaoFecharDialogoRef} type="button" disabled={Boolean(cancelando)} onClick={() => setAgendamentoParaCancelar(null)}
                className="p-2 rounded-full text-on-surface-variant hover:bg-white/5 disabled:opacity-40" aria-label="Fechar confirmação">×</button>
            </div>
            <h2 id="titulo-cancelamento" className="font-headline text-2xl mt-5">Cancelar agendamento?</h2>
            <p id="descricao-cancelamento" className="text-sm text-on-surface-variant mt-2">Essa ação libera o horário para outro cliente e mantém o registro no seu histórico.</p>
            <div className="rounded-2xl border border-white/10 bg-background/60 p-4 mt-5 text-sm space-y-2">
              <p><strong>{agendamentoParaCancelar.servico}</strong> com {agendamentoParaCancelar.profissional}</p>
              <p className="text-on-surface-variant">{new Date(`${agendamentoParaCancelar.data}T12:00:00`).toLocaleDateString('pt-BR')} às {agendamentoParaCancelar.horario}</p>
            </div>
            {erroCancelamento && <p role="alert" className="mt-4 rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">{erroCancelamento}</p>}
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              <button type="button" disabled={Boolean(cancelando)} onClick={() => setAgendamentoParaCancelar(null)} className="px-5 py-3 rounded-full border border-white/15 text-sm hover:border-primary/30 disabled:opacity-40">Manter agendamento</button>
              <button type="button" disabled={Boolean(cancelando)} onClick={confirmarCancelamento} className="px-5 py-3 rounded-full bg-error text-white text-sm font-bold disabled:opacity-50">{cancelando ? 'Cancelando...' : 'Sim, cancelar'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

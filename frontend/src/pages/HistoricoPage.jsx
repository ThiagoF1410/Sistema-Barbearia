import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarMeusAgendamentos } from '../services/agendamentosService'
import { criarCheckout } from '../services/pagamentosService'
import BrandIcon from '../components/ui/BrandIcon'
import Pagination from '../components/ui/Pagination'
import logoImg from '../assets/Logo1.avif'
import { abrirCheckoutEmNovaAba, fecharAbaPagamento, prepararAbaPagamento } from '../utils/checkoutWindow'

const STATUS = {
  AGENDADO: { texto: 'Agendado', classe: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25' },
  CANCELADO: { texto: 'Cancelado', classe: 'bg-red-500/10 text-red-300 border-red-400/25' },
  CONCLUIDO: { texto: 'Concluído', classe: 'bg-primary/10 text-primary border-primary/25' },
}

const STATUS_PAGAMENTO = {
  PENDENTE: { texto: 'Pagamento pendente', classe: 'bg-amber-500/10 text-amber-200 border-amber-400/30' },
  CONFIRMADO: { texto: 'Pagamento confirmado', classe: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30' },
  PAGO: { texto: 'Pagamento confirmado', classe: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30' },
  CANCELADO: { texto: 'Pagamento cancelado', classe: 'bg-red-500/10 text-red-200 border-red-400/30' },
  FALHOU: { texto: 'Pagamento falhou', classe: 'bg-red-500/10 text-red-200 border-red-400/30' },
  NAO_INICIADO: { texto: 'Pagamento não iniciado', classe: 'bg-white/5 text-on-surface-variant border-white/15' },
}

const FILTROS = ['TODOS', 'AGENDADO', 'CONCLUIDO', 'CANCELADO']

function dataHora(item) {
  return new Date(`${item.data}T${item.horario || '00:00'}:00`)
}

function formatarData(data) {
  const texto = new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  }).replace('.', '')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function formatarHorarioFinal(horario, duracao) {
  const [hora, minuto] = String(horario).split(':').map(Number)
  const total = (hora * 60) + minuto + Number(duracao || 0)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function CartaoAgendamento({ item, pagandoId, onPagar }) {
  const status = STATUS[item.statusagendamento] || { texto: item.statusagendamento, classe: 'border-white/15 text-on-surface-variant' }
  const codigoPagamento = String(item.statuspagamento || 'NAO_INICIADO').toUpperCase()
  const pagamento = item.metodo === 'DINHEIRO' && codigoPagamento === 'PENDENTE' ? {
    texto: 'Dinheiro na barbearia',
    classe: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  } : STATUS_PAGAMENTO[codigoPagamento] || {
    texto: `Pagamento: ${codigoPagamento}`,
    classe: 'bg-white/5 text-on-surface-variant border-white/15',
  }
  const cancelado = item.statusagendamento === 'CANCELADO'
  const concluido = item.statusagendamento === 'CONCLUIDO'
  const faixaStatus = cancelado ? 'bg-error' : concluido ? 'bg-primary' : 'bg-emerald-400'

  return (
    <article className={`render-efficient glass-panel relative overflow-hidden rounded-3xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 sm:p-5 ${cancelado ? 'border-error/15' : 'border-white/10'}`}>
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${faixaStatus}`} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="calendar" size={21} /></span>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary/80">Serviço</p>
            <h3 className="mt-1 font-headline text-xl sm:text-2xl">{item.servico}</h3>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <span className={`px-3 py-1.5 rounded-full border text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${status.classe}`}>{status.texto}</span>
          <span className={`px-3 py-1.5 rounded-full border text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${pagamento.classe}`}>{pagamento.texto}</span>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 rounded-2xl border border-white/[0.06] bg-black/15 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        <div className="flex items-start gap-3">
          <BrandIcon name="calendar" size={20} className="text-primary shrink-0 mt-0.5" />
          <div><dt className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Data</dt><dd className="mt-1 text-xs font-semibold sm:text-sm">{formatarData(item.data)}</dd></div>
        </div>
        <div className="flex items-start gap-3">
          <BrandIcon name="clock" size={20} className="text-primary shrink-0 mt-0.5" />
          <div><dt className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Horário</dt><dd className="mt-1 text-sm font-semibold">{item.horario} – {formatarHorarioFinal(item.horario, item.duracao)}</dd><dd className="mt-0.5 text-[10px] text-on-surface-variant">{item.duracao} minutos</dd></div>
        </div>
        <div className="flex items-start gap-3">
          <BrandIcon name="professional" size={20} className="text-primary shrink-0 mt-0.5" />
          <div><dt className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Profissional</dt><dd className="mt-1 text-sm font-semibold">{item.profissional}</dd></div>
        </div>
        <div className="flex items-start gap-3">
          <BrandIcon name="chart" size={20} className="mt-0.5 shrink-0 text-primary" />
          <div><dt className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Valor</dt><dd className="mt-1 font-headline text-xl text-primary">{formatarPreco(item.preco)}</dd></div>
        </div>
      </dl>

      {item.pode_pagar && <div className="mt-4 flex justify-end border-t border-white/[0.07] pt-4">
        {item.pode_pagar && <button type="button" onClick={() => onPagar(item.idagendamento)} disabled={pagandoId !== null}
          className="w-full sm:w-auto min-h-10 rounded-full bg-primary px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-50">
          {pagandoId === item.idagendamento ? 'Abrindo pagamento...' : codigoPagamento === 'FALHOU' ? 'Tentar novamente' : 'Pagar agora'}
        </button>}
      </div>}
    </article>
  )
}

function SkeletonHistorico() {
  return <div className="grid gap-4" role="status" aria-label="Carregando histórico">
    {[1, 2, 3].map((item) => <div key={item} className="glass-panel rounded-2xl border border-white/10 p-5 sm:p-6 animate-pulse">
      <div className="flex justify-between gap-5"><div className="space-y-3 flex-1"><div className="h-6 w-48 rounded bg-white/10" /><div className="h-4 w-64 max-w-full rounded bg-white/[0.06]" /></div><div className="h-7 w-32 rounded-full bg-white/[0.06]" /></div>
      <div className="mt-6 h-20 rounded-2xl bg-white/[0.04]" />
    </div>)}
    <span className="sr-only">Carregando...</span>
  </div>
}

export default function HistoricoPage() {
  const [agendamentos, setAgendamentos] = useState([])
  const [filtro, setFiltro] = useState('TODOS')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [pagandoId, setPagandoId] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  const [paginacao, setPaginacao] = useState(null)
  const [resumo, setResumo] = useState(null)

  useEffect(() => {
    let ativo = true
    listarMeusAgendamentos({ status: filtro === 'TODOS' ? undefined : filtro, pagina: 1, limite: 10 })
      .then((dados) => { if (ativo) { setAgendamentos(dados.agendamentos || dados); setPaginacao(dados.paginacao || null); setResumo(dados.resumo || null) } })
      .catch((err) => { if (ativo) setErro(err.response?.data?.message || 'Não foi possível carregar o histórico. Tente novamente.') })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [tentativa, filtro])

  async function mudarPagina(pagina) {
    setCarregando(true)
    setErro('')
    try {
      const dados = await listarMeusAgendamentos({ status: filtro === 'TODOS' ? undefined : filtro, pagina, limite: 10 })
      setAgendamentos(dados.agendamentos || dados)
      setPaginacao(dados.paginacao || null)
      setResumo(dados.resumo || null)
    } catch (err) {
      setErro(err.response?.data?.message || 'Nao foi possivel carregar o historico. Tente novamente.')
    } finally { setCarregando(false) }
  }

  const contadoresLocais = useMemo(() => agendamentos.reduce((total, item) => {
    total.TODOS += 1
    if (Object.hasOwn(total, item.statusagendamento)) total[item.statusagendamento] += 1
    return total
  }, { TODOS: 0, AGENDADO: 0, CONCLUIDO: 0, CANCELADO: 0 }), [agendamentos])
  const contadores = resumo ? { TODOS: Number(resumo.total), AGENDADO: Number(resumo.agendados), CONCLUIDO: Number(resumo.concluidos), CANCELADO: Number(resumo.cancelados) } : contadoresLocais

  const exibidosLocais = useMemo(() => filtro === 'TODOS'
    ? agendamentos
    : agendamentos.filter((item) => item.statusagendamento === filtro), [agendamentos, filtro])
  const exibidos = paginacao ? agendamentos : exibidosLocais

  const grupos = useMemo(() => {
    const agora = new Date()
    return {
      proximos: exibidos.filter((item) => item.statusagendamento === 'AGENDADO' && dataHora(item) >= agora)
        .sort((a, b) => dataHora(a) - dataHora(b)),
      anteriores: exibidos.filter((item) => item.statusagendamento !== 'AGENDADO' || dataHora(item) < agora)
        .sort((a, b) => dataHora(b) - dataHora(a)),
    }
  }, [exibidos])

  function tentarNovamente() {
    setErro('')
    setCarregando(true)
    setTentativa((valor) => valor + 1)
  }

  function alterarFiltro(novoFiltro) {
    if (novoFiltro === filtro) return
    setCarregando(true)
    setErro('')
    setFiltro(novoFiltro)
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
    <div className="min-h-screen bg-background text-on-surface">
      <header className="sticky top-0 z-40 border-b border-primary/15 bg-black/90 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/inicio" className="flex items-center gap-3 min-w-0 group" aria-label="O Rei da Navalha — página inicial">
            <img src={logoImg} alt="" width="44" height="44" decoding="async" className="h-11 w-11 object-contain shrink-0" />
            <div className="hidden sm:block"><p className="font-headline text-lg leading-none group-hover:text-primary transition-colors">O Rei da Navalha</p><p className="text-[8px] uppercase tracking-[0.24em] text-primary/75 mt-1">Área do cliente</p></div>
          </Link>
          <Link to="/dashboard" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-white/80 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-colors"><BrandIcon name="back" size={18} />Painel</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-7 px-4 py-7 sm:px-6 sm:py-10">
        <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-[linear-gradient(120deg,rgba(245,197,24,0.09),rgba(255,255,255,0.02)_50%,transparent)] p-5 sm:p-7">
          <div aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/[0.05] blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="flex items-start gap-3 sm:gap-4">
              <Link to="/dashboard" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-on-surface-variant hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" aria-label="Voltar ao painel"><BrandIcon name="back" size={19} /></Link>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Área do cliente</p><h1 className="mt-1 font-headline text-3xl sm:text-4xl">Histórico de agendamentos</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">Acompanhe seus próximos horários, pagamentos e atendimentos anteriores.</p></div>
            </div>
            <Link to="/agendar" className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:w-auto">Novo agendamento</Link>
          </div>
        </section>

        <div className="rounded-2xl border border-white/[0.08] bg-surface-container-low p-1.5 shadow-xl shadow-black/10"><div className="flex gap-1.5 overflow-x-auto scrollbar-none" role="group" aria-label="Filtrar histórico">
          {FILTROS.map((item) => <button key={item} type="button" onClick={() => alterarFiltro(item)} aria-pressed={filtro === item}
            className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${filtro === item ? 'bg-primary text-on-primary shadow-lg shadow-primary/10' : 'text-on-surface-variant hover:bg-white/[0.04] hover:text-primary'}`}>
            <span>{item === 'TODOS' ? 'Todos' : STATUS[item]?.texto || item}</span><span aria-hidden="true" className={`rounded-full px-2 py-0.5 text-[9px] ${filtro === item ? 'bg-black/15' : 'bg-white/[0.06]'}`}>{contadores[item]}</span>
          </button>)}
        </div></div>

        <p className="sr-only" role="status" aria-live="polite">Filtro {filtro === 'TODOS' ? 'Todos' : STATUS[filtro]?.texto}: {exibidos.length} resultados.</p>

        {erro && <div role="alert" className="rounded-2xl border border-error/25 bg-error/10 px-4 py-4 text-sm text-error mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span>{erro}</span><button type="button" onClick={tentarNovamente} className="self-start sm:self-auto rounded-full border border-error/35 px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-error/10">Tentar novamente</button></div>}

        {carregando ? <SkeletonHistorico /> : exibidos.length ? <div className="space-y-10">
          {grupos.proximos.length > 0 && <section aria-labelledby="titulo-proximos"><div className="mb-4 flex items-center gap-4"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300">Sua agenda</p><h2 id="titulo-proximos" className="mt-1 font-headline text-2xl">Próximos agendamentos</h2></div><span aria-hidden="true" className="h-px flex-1 bg-white/[0.08]" /><span className="flex h-8 min-w-8 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 text-xs font-bold text-emerald-300">{grupos.proximos.length}</span></div><div className="grid gap-4">{grupos.proximos.map((item) => <CartaoAgendamento key={item.idagendamento} item={item} pagandoId={pagandoId} onPagar={pagarAgendamento} />)}</div></section>}
          {grupos.anteriores.length > 0 && <section aria-labelledby="titulo-anteriores"><div className="mb-4 flex items-center gap-4"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Histórico</p><h2 id="titulo-anteriores" className="mt-1 font-headline text-2xl">Atendimentos anteriores</h2></div><span aria-hidden="true" className="h-px flex-1 bg-white/[0.08]" /><span className="flex h-8 min-w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-2 text-xs font-bold text-primary">{grupos.anteriores.length}</span></div><div className="grid gap-4">{grupos.anteriores.map((item) => <CartaoAgendamento key={item.idagendamento} item={item} pagandoId={pagandoId} onPagar={pagarAgendamento} />)}</div></section>}
        </div> : <div className="glass-panel rounded-2xl border border-white/10 p-8 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto"><BrandIcon name="empty" size={34} /></div>
          <h2 className="font-headline text-xl mt-5">Nenhum resultado neste filtro</h2>
          <p className="text-sm text-on-surface-variant mt-2">Selecione outro status ou faça um novo agendamento.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-5">{filtro !== 'TODOS' && <button type="button" onClick={() => alterarFiltro('TODOS')} className="px-5 py-2.5 rounded-full border border-white/15 text-xs font-bold uppercase tracking-wider hover:border-primary/40">Limpar filtro</button>}<Link to="/agendar" className="px-5 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:bg-primary-container">Novo agendamento</Link></div>
        </div>}
        {!carregando && <Pagination dados={paginacao} onChange={mudarPagina} />}
      </main>
    </div>
  )
}

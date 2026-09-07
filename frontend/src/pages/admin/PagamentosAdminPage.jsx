import { useEffect, useRef, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import BrandIcon from '../../components/ui/BrandIcon'
import BrandedDatePicker from '../../components/ui/BrandedDatePicker'
import Pagination from '../../components/ui/Pagination'
import { confirmarPagamentoDinheiro, listarPagamentosAdmin } from '../../services/pagamentosService'

const STATUS = {
  PENDENTE: { texto: 'Pendente', classe: 'border-amber-400/30 bg-amber-500/10 text-amber-200' },
  CONFIRMADO: { texto: 'Confirmado', classe: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' },
  CANCELADO: { texto: 'Cancelado', classe: 'border-red-400/30 bg-red-500/10 text-red-200' },
  FALHOU: { texto: 'Falhou', classe: 'border-red-400/30 bg-red-500/10 text-red-200' },
}

const resumoInicial = { quantidade: 0, confirmados: 0, pendentes: 0, falhos: 0, cancelados: 0, valorConfirmado: 0 }
const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (data) => data ? new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR') : '—'

function dataLocal(data = new Date()) {
  const local = new Date(data)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

function deslocarData(data, dias) {
  const valor = new Date(`${data}T12:00:00`)
  valor.setDate(valor.getDate() + dias)
  return dataLocal(valor)
}

function periodoMesAtual() {
  const hoje = new Date()
  return {
    inicio: dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    fim: dataLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
  }
}

function SkeletonPagamentos() {
  return <div className="space-y-3" aria-hidden="true">{[1, 2, 3].map((item) => <div key={item} className="glass-panel rounded-2xl border border-white/10 p-5 sm:p-6 animate-pulse"><div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,1fr)_auto]"><div><div className="h-5 w-44 rounded bg-white/10" /><div className="h-3 w-32 rounded bg-white/[0.07] mt-4" /><div className="h-3 w-52 rounded bg-white/[0.07] mt-2" /></div><div className="grid grid-cols-2 gap-4"><div className="h-10 rounded bg-white/[0.06]" /><div className="h-10 rounded bg-white/[0.06]" /></div><div className="h-7 w-24 rounded bg-white/10" /></div></div>)}</div>
}

export default function PagamentosAdminPage() {
  const [pagamentos, setPagamentos] = useState([])
  const [resumo, setResumo] = useState(resumoInicial)
  const [status, setStatus] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [busca, setBusca] = useState('')
  const [paginacao, setPaginacao] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const consultaRef = useRef(0)

  async function carregar(filtros = {}, pagina = 1) {
    const consulta = ++consultaRef.current
    setCarregando(true)
    setErro('')
    try {
      const dados = await listarPagamentosAdmin({ ...filtros, pagina, limite: 12 })
      if (consulta !== consultaRef.current) return
      setPagamentos(dados.pagamentos || [])
      setResumo(dados.resumo || resumoInicial)
      setPaginacao(dados.paginacao || null)
    } catch (err) {
      if (consulta === consultaRef.current) {
        setErro(err.response?.data?.message || 'Não foi possível carregar os pagamentos.')
      }
    } finally {
      if (consulta === consultaRef.current) setCarregando(false)
    }
  }

  useEffect(() => {
    const consulta = ++consultaRef.current
    listarPagamentosAdmin({ pagina: 1, limite: 12 })
      .then((dados) => {
        if (consulta !== consultaRef.current) return
        setPagamentos(dados.pagamentos || [])
        setResumo(dados.resumo || resumoInicial)
        setPaginacao(dados.paginacao || null)
      })
      .catch((err) => {
        if (consulta === consultaRef.current) {
          setErro(err.response?.data?.message || 'Não foi possível carregar os pagamentos.')
        }
      })
      .finally(() => {
        if (consulta === consultaRef.current) setCarregando(false)
      })
    return () => { consultaRef.current += 1 }
  }, [])

  function filtrar(event) {
    event.preventDefault()
    carregar({ busca: busca || undefined, status: status || undefined, inicio: inicio || undefined, fim: fim || undefined })
  }

  function limpar() {
    setStatus('')
    setInicio('')
    setFim('')
    setBusca('')
    carregar()
  }

  function aplicarPeriodo(periodo) {
    setInicio(periodo.inicio)
    setFim(periodo.fim)
    carregar({ busca: busca || undefined, status: status || undefined, inicio: periodo.inicio, fim: periodo.fim })
  }

  async function confirmarDinheiro(item) {
    if (!window.confirm(`Confirmar o recebimento de ${moeda(item.valor)} em dinheiro?`)) return
    setErro('')
    setSucesso('')
    setConfirmandoId(item.idpagamento)
    try {
      await confirmarPagamentoDinheiro(item.idpagamento)
      setSucesso('Recebimento em dinheiro confirmado e incluído no faturamento.')
      await carregar({ busca: busca || undefined, status: status || undefined, inicio: inicio || undefined, fim: fim || undefined }, paginacao?.pagina || 1)
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível confirmar o recebimento em dinheiro.')
    } finally {
      setConfirmandoId(null)
    }
  }

  const cards = [
    { icone: 'chart', valor: moeda(resumo.valorConfirmado), rotulo: 'Valor confirmado', cor: 'text-primary', fundo: 'bg-primary/10', borda: 'border-primary/20' },
    { icone: 'check', valor: resumo.confirmados, rotulo: 'Confirmados', cor: 'text-emerald-300', fundo: 'bg-emerald-500/10', borda: 'border-emerald-400/20' },
    { icone: 'clock', valor: resumo.pendentes, rotulo: 'Pendentes', cor: 'text-amber-200', fundo: 'bg-amber-500/10', borda: 'border-amber-400/20' },
    { icone: 'alert', valor: resumo.falhos + resumo.cancelados, rotulo: 'Falhos ou cancelados', cor: 'text-red-300', fundo: 'bg-red-500/10', borda: 'border-red-400/20' },
  ]

  const hoje = dataLocal()
  const filtrosAtivos = Number(Boolean(busca)) + Number(Boolean(status)) + Number(Boolean(inicio)) + Number(Boolean(fim))

  return (
    <AdminLayout titulo="Pagamentos" subtitulo="Financeiro e transações">
      <main className="max-w-[1480px] mx-auto px-4 sm:px-6 py-7 sm:py-9 space-y-7">
        <section>
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Financeiro</p>
          <h1 className="font-headline text-3xl sm:text-4xl mt-2">Pagamentos</h1>
          <p className="text-sm text-on-surface-variant mt-2">Acompanhe o faturamento e consulte transações de atendimentos e produtos.</p>
        </section>

        <section aria-labelledby="filtros-pagamentos" className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5"><div><div className="flex items-center gap-2"><h2 id="filtros-pagamentos" className="font-headline text-xl">Filtros</h2>{filtrosAtivos > 0 && <span className="rounded-full bg-primary/15 border border-primary/20 px-2 py-0.5 text-[9px] font-bold text-primary">{filtrosAtivos} {filtrosAtivos === 1 ? 'ativo' : 'ativos'}</span>}</div><p className="text-xs text-on-surface-variant mt-1">Selecione uma situação ou período para refinar os resultados.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => aplicarPeriodo({ inicio: hoje, fim: hoje })} disabled={carregando} className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:border-primary/40 hover:text-primary disabled:opacity-50">Hoje</button><button type="button" onClick={() => aplicarPeriodo({ inicio: hoje, fim: deslocarData(hoje, 6) })} disabled={carregando} className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:border-primary/40 hover:text-primary disabled:opacity-50">Próximos 7 dias</button><button type="button" onClick={() => aplicarPeriodo(periodoMesAtual())} disabled={carregando} className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:border-primary/40 hover:text-primary disabled:opacity-50">Este mês</button></div></div>
          <form onSubmit={filtrar} className="grid sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-4 items-end">
            <label className="text-xs text-on-surface-variant"><span className="block mb-2 uppercase tracking-wider font-bold">Pesquisar</span><input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente, e-mail ou servico" className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-white/30 focus:border-primary focus:outline-none" /></label>
            <label className="text-xs text-on-surface-variant"><span className="block mb-2 uppercase tracking-wider font-bold">Status</span><select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface"><option value="">Todos os status</option>{Object.entries(STATUS).map(([codigo, item]) => <option key={codigo} value={codigo}>{item.texto}</option>)}</select></label>
            <div className="text-xs text-on-surface-variant"><span className="block mb-2 uppercase tracking-wider font-bold">Data inicial</span><BrandedDatePicker id="filtro-pagamento-inicio" value={inicio} onChange={(valor) => { setInicio(valor); if (fim && fim < valor) setFim(valor) }} /></div>
            <div className="text-xs text-on-surface-variant"><span className="block mb-2 uppercase tracking-wider font-bold">Data final</span><BrandedDatePicker id="filtro-pagamento-fim" value={fim} min={inicio || undefined} onChange={setFim} /></div>
            <div className="flex flex-col sm:flex-row gap-2"><button type="button" onClick={limpar} disabled={carregando || filtrosAtivos === 0} className="order-2 sm:order-1 px-5 py-3 border border-white/10 rounded-full text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:border-primary/30 disabled:opacity-40">Limpar</button><button type="submit" disabled={carregando} className="order-1 sm:order-2 px-6 py-3 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-wider hover:bg-primary-container disabled:opacity-50">Aplicar filtros</button></div>
          </form>
        </section>

        <section aria-label="Resumo dos pagamentos" className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {cards.map((card) => <article key={card.rotulo} className="brand-card glass-panel border border-white/10 p-4 sm:p-5 min-w-0"><div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${card.fundo} ${card.borda} ${card.cor}`}><BrandIcon name={card.icone} size={22} /></div><p className={`font-headline text-xl sm:text-2xl mt-3 break-words ${card.cor}`}>{carregando ? '—' : card.valor}</p><p className="text-[9px] sm:text-xs uppercase sm:normal-case tracking-wider sm:tracking-normal text-on-surface-variant mt-1">{card.rotulo}</p></article>)}
        </section>

        {erro && <div role="alert" className="rounded-2xl border border-error/25 bg-error/10 px-4 py-4 text-sm text-error flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span>{erro}</span><button type="button" onClick={() => carregar({ busca: busca || undefined, status: status || undefined, inicio: inicio || undefined, fim: fim || undefined }, paginacao?.pagina || 1)} className="self-start sm:self-auto rounded-full border border-error/35 px-4 py-2 text-xs font-bold uppercase tracking-wider">Tentar novamente</button></div>}
        {sucesso && <div role="status" className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">{sucesso}</div>}
        <section aria-labelledby="pagamentos-titulo">
          <div className="flex items-end justify-between gap-4 mb-5"><div><p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Transações</p><h2 id="pagamentos-titulo" className="font-headline text-2xl mt-2">Resultados</h2></div><span className="text-xs text-on-surface-variant">{pagamentos.length} {pagamentos.length === 1 ? 'registro' : 'registros'}</span></div>
          {carregando ? <><p className="sr-only" role="status">Carregando pagamentos...</p><SkeletonPagamentos /></> : pagamentos.length === 0 ? <div className="glass-panel rounded-2xl border border-white/10 p-10 text-center"><div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto"><BrandIcon name="empty" size={34} /></div><h3 className="font-headline text-xl mt-5">Nenhum pagamento encontrado</h3><p className="text-sm text-on-surface-variant mt-2">Revise o período e a situação selecionados ou consulte todos os registros.</p>{filtrosAtivos > 0 && <button type="button" onClick={limpar} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary">Limpar filtros</button>}</div> : <div className="grid gap-3">{pagamentos.map((item) => {
            const situacao = STATUS[item.statuspagamento] || { texto: item.statuspagamento, classe: 'border-white/15 text-on-surface-variant' }
            const compraAvulsa = !item.idagendamento
            const cancelado = ['CANCELADO', 'FALHOU'].includes(String(item.statuspagamento).toUpperCase())
            return <article key={item.idpagamento} className={`glass-panel rounded-2xl border p-4 sm:p-5 transition-colors ${cancelado ? 'border-red-400/15' : 'border-white/10 hover:border-primary/20'}`}><div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,1fr)_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${compraAvulsa ? 'border-primary/20 bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-white/70'}`}><BrandIcon name={compraAvulsa ? 'bag' : 'calendar'} size={19} /></span><div className="min-w-0"><p className="text-[9px] uppercase tracking-[0.16em] text-on-surface-variant">{compraAvulsa ? 'Compra na loja' : 'Atendimento'}</p><h3 className="font-headline text-lg sm:text-xl truncate">{item.servico}</h3></div></div><div className="mt-4 pl-0 sm:pl-11"><p className="text-sm font-semibold">{item.cliente}</p><p className="text-xs text-on-surface-variant mt-1 break-all">{item.cliente_email}</p></div></div><dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm"><div><dt className="text-[9px] uppercase tracking-wider text-on-surface-variant">{compraAvulsa ? 'Data da compra' : 'Atendimento'}</dt><dd className="mt-1">{dataBr(item.data)}{item.horario ? ` às ${item.horario}` : ''}</dd></div><div><dt className="text-[9px] uppercase tracking-wider text-on-surface-variant">{compraAvulsa ? 'Entrega' : 'Profissional'}</dt><dd className="mt-1">{compraAvulsa ? 'Retirada na barbearia' : item.profissional}</dd></div><div><dt className="text-[9px] uppercase tracking-wider text-on-surface-variant">Método</dt><dd className="mt-1 uppercase">{item.metodo || 'Não informado'}</dd></div><div><dt className="text-[9px] uppercase tracking-wider text-on-surface-variant">Referência</dt><dd className="mt-1">{compraAvulsa ? `Pedido #${item.idpedido}` : item.statusagendamento}</dd></div></dl><div className="flex lg:flex-col items-center lg:items-end justify-between gap-3 border-t border-white/[0.07] pt-4 lg:border-0 lg:pt-0"><div className="lg:text-right"><p className="font-headline text-2xl text-primary">{moeda(item.valor)}</p><p className="text-[10px] text-on-surface-variant mt-1">Pagamento #{item.idpagamento}</p></div><div className="flex flex-col items-end gap-2"><span className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${situacao.classe}`}>{situacao.texto}</span>{item.metodo === 'DINHEIRO' && item.statuspagamento === 'PENDENTE' && <button type="button" onClick={() => confirmarDinheiro(item)} disabled={confirmandoId !== null || carregando} className="rounded-full bg-primary px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-on-primary disabled:opacity-50">{confirmandoId === item.idpagamento ? 'Confirmando...' : 'Confirmar recebimento'}</button>}</div></div></div></article>
          })}</div>}
          {!carregando && <Pagination dados={paginacao} onChange={(pagina) => carregar({ busca: busca || undefined, status: status || undefined, inicio: inicio || undefined, fim: fim || undefined }, pagina)} />}
        </section>
      </main>
    </AdminLayout>
  )
}

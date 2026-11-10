import { useEffect, useRef, useState } from 'react'
import { concluirAgendamentoAdmin, listarAgendamentosAdmin } from '../../services/agendamentosService'
import { listarProfissionais } from '../../services/profissionaisService'
import AdminLayout from '../../components/admin/AdminLayout'
import BrandIcon from '../../components/ui/BrandIcon'
import BrandedDatePicker from '../../components/ui/BrandedDatePicker'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import useFeedbackFocus from '../../hooks/useFeedbackFocus'

const FILTROS_INICIAIS = {
  busca: '', dataInicio: '', dataFim: '', profissionalId: '', status: '', statusPagamento: '',
}

const STATUS = {
  AGENDADO: { texto: 'Agendado', classe: 'border-amber-400/30 bg-amber-500/10 text-amber-200' },
  CONCLUIDO: { texto: 'Concluído', classe: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' },
  CANCELADO: { texto: 'Cancelado', classe: 'border-red-400/30 bg-red-500/10 text-red-200' },
}

const PAGAMENTO = {
  PENDENTE: { texto: 'Pagamento pendente', classe: 'border-amber-400/30 bg-amber-500/10 text-amber-200' },
  CONFIRMADO: { texto: 'Pagamento confirmado', classe: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' },
  CANCELADO: { texto: 'Pagamento cancelado', classe: 'border-red-400/30 bg-red-500/10 text-red-200' },
  FALHOU: { texto: 'Pagamento falhou', classe: 'border-red-400/30 bg-red-500/10 text-red-200' },
  NAO_INICIADO: { texto: 'Pagamento não iniciado', classe: 'border-white/10 bg-white/5 text-on-surface-variant' },
}

function dataLocal() {
  const agora = new Date()
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset())
  return agora.toISOString().slice(0, 10)
}

function deslocarData(data, dias) {
  const valor = new Date(`${data}T12:00:00`)
  valor.setDate(valor.getDate() + dias)
  return valor.toISOString().slice(0, 10)
}

function periodoMesAtual() {
  const hoje = dataLocal()
  const [ano, mes] = hoje.split('-').map(Number)
  const ultimoDia = new Date(ano, mes, 0).getDate()
  return { dataInicio: `${ano}-${String(mes).padStart(2, '0')}-01`, dataFim: `${ano}-${String(mes).padStart(2, '0')}-${ultimoDia}` }
}

function formatarData(data) {
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function formatarDataCurta(data) {
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR')
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarHorarioFinal(horario, duracao) {
  const [hora, minuto] = String(horario).split(':').map(Number)
  const total = (hora * 60) + minuto + Number(duracao || 0)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function dadosWhatsapp(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '')
  if (!digitos) return null
  const nacional = digitos.startsWith('55') && digitos.length >= 12 ? digitos.slice(2) : digitos
  const exibicao = nacional.length === 11
    ? `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`
    : `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`
  return { exibicao, link: `https://wa.me/55${nacional}` }
}

function SkeletonResultados() {
  return <div className="space-y-4" role="status" aria-label="Carregando agendamentos">{[1, 2, 3].map((item) => <div key={item} className="glass-panel rounded-2xl border border-white/10 p-5 sm:p-6 animate-pulse"><div className="grid gap-4 sm:grid-cols-[95px_1fr_180px]"><div className="h-14 rounded-xl bg-white/10" /><div className="space-y-3"><div className="h-5 w-52 max-w-full rounded bg-white/10" /><div className="h-4 w-72 max-w-full rounded bg-white/[0.06]" /></div><div className="h-8 rounded-full bg-white/[0.06]" /></div></div>)}</div>
}

function Badge({ configuracao, fallback }) {
  return <span className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${configuracao?.classe || 'border-white/10 text-on-surface-variant'}`}>{configuracao?.texto || fallback}</span>
}

export default function AgendamentosAdminPage() {
  const [agendamentos, setAgendamentos] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS)
  const [filtrosAplicados, setFiltrosAplicados] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [atualizandoId, setAtualizandoId] = useState(null)
  const [confirmacaoConclusao, setConfirmacaoConclusao] = useState(null)
  const [detalheId, setDetalheId] = useState(null)
  const [paginacao, setPaginacao] = useState(null)
  const [resumoServidor, setResumoServidor] = useState(null)
  const consultaRef = useRef(0)
  const erroRef = useFeedbackFocus(erro)

  useEffect(() => {
    listarProfissionais().then(setProfissionais).catch((err) => setErro(err.response?.data?.message || 'Não foi possível carregar os profissionais. Tente novamente.'))
  }, [])

  useEffect(() => {
    const consultaId = ++consultaRef.current
    listarAgendamentosAdmin({ pagina: 1, limite: 12 })
      .then((resultado) => { if (consultaId === consultaRef.current) { setAgendamentos(resultado.agendamentos || resultado); setPaginacao(resultado.paginacao || null); setResumoServidor(resultado.resumo || null) } })
      .catch((err) => { if (consultaId === consultaRef.current) setErro(err.response?.data?.message || 'Não foi possível carregar os agendamentos. Tente novamente.') })
      .finally(() => { if (consultaId === consultaRef.current) setCarregando(false) })
    return () => { consultaRef.current += 1 }
  }, [])

  function parametros(valores) {
    return Object.fromEntries(Object.entries(valores).filter(([, valor]) => String(valor || '').trim()))
  }

  async function carregar(novosFiltros = filtrosAplicados, pagina = 1) {
    const consultaId = ++consultaRef.current
    setCarregando(true)
    setErro('')
    try {
      const aplicados = parametros(novosFiltros)
      const resultado = await listarAgendamentosAdmin({ ...aplicados, pagina, limite: 12 })
      if (consultaId === consultaRef.current) {
        setAgendamentos(resultado.agendamentos || resultado)
        setPaginacao(resultado.paginacao || null)
        setResumoServidor(resultado.resumo || null)
        setFiltrosAplicados(aplicados)
      }
    } catch (err) {
      if (consultaId === consultaRef.current) setErro(err.response?.data?.message || 'Não foi possível carregar os agendamentos. Tente novamente.')
    } finally {
      if (consultaId === consultaRef.current) setCarregando(false)
    }
  }

  function alterarFiltro(event) {
    const { name, value } = event.target
    setFiltros((atuais) => ({ ...atuais, [name]: value }))
  }

  function aplicarFiltros(event) {
    event.preventDefault()
    if (atualizandoId === null) carregar(filtros)
  }

  function aplicarPeriodo(periodo) {
    const novosFiltros = { ...filtros, ...periodo }
    setFiltros(novosFiltros)
    carregar(novosFiltros)
  }

  function limparFiltros() {
    if (atualizandoId !== null) return
    setFiltros(FILTROS_INICIAIS)
    carregar({})
  }

  async function concluirAtendimento(id) {
    setErro('')
    setAtualizandoId(id)
    try {
      await concluirAgendamentoAdmin(id)
      await carregar(filtrosAplicados, paginacao?.pagina || 1)
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível concluir o atendimento. Tente novamente.')
    } finally {
      setAtualizandoId(null)
      setConfirmacaoConclusao(null)
    }
  }

  const resumoLocal = agendamentos.reduce((total, item) => {
    total.total += 1
    const status = String(item.statusagendamento || '').toUpperCase()
    if (status === 'AGENDADO') total.agendados += 1
    if (status === 'CONCLUIDO') total.concluidos += 1
    if (status === 'CANCELADO') total.cancelados += 1
    if (String(item.statuspagamento || '').toUpperCase() === 'CONFIRMADO' && status !== 'CANCELADO') total.faturamento += Number(item.preco || 0)
    return total
  }, { total: 0, agendados: 0, concluidos: 0, cancelados: 0, faturamento: 0 })

  const resumo = resumoServidor ? {
    total: Number(resumoServidor.total || 0), agendados: Number(resumoServidor.agendados || 0),
    concluidos: Number(resumoServidor.concluidos || 0), cancelados: Number(resumoServidor.cancelados || 0),
    faturamento: Number(resumoServidor.faturamento || 0),
  } : resumoLocal
  const grupos = agendamentos.reduce((resultado, item) => {
    if (!resultado[item.data]) resultado[item.data] = []
    resultado[item.data].push(item)
    return resultado
  }, {})

  const cardsResumo = [
    { label: 'Resultados', valor: resumo.total, cor: 'text-primary' },
    { label: 'Agendados', valor: resumo.agendados, cor: 'text-amber-200' },
    { label: 'Concluídos', valor: resumo.concluidos, cor: 'text-emerald-200' },
    { label: 'Cancelados', valor: resumo.cancelados, cor: 'text-red-200' },
    { label: 'Faturamento', valor: formatarMoeda(resumo.faturamento), cor: 'text-primary' },
  ]
  const hoje = dataLocal()

  return (
    <AdminLayout titulo="Agendamentos" subtitulo="Atendimentos e clientes">
      <main className="max-w-[1480px] mx-auto px-4 sm:px-6 py-7 sm:py-9 space-y-7">
        <section><p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Operação</p><h1 className="font-headline text-3xl sm:text-4xl mt-2">Agendamentos</h1><p className="text-sm text-on-surface-variant mt-2">Consulte, filtre e acompanhe os atendimentos da barbearia.</p></section>

        <section aria-labelledby="filtros-titulo" className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5"><div><h2 id="filtros-titulo" className="font-headline text-xl">Filtros</h2><p className="text-xs text-on-surface-variant mt-1">Refine a listagem por período, cliente ou situação.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => aplicarPeriodo({ dataInicio: hoje, dataFim: hoje })} className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:border-primary/40 hover:text-primary">Hoje</button><button type="button" onClick={() => aplicarPeriodo({ dataInicio: hoje, dataFim: deslocarData(hoje, 6) })} className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:border-primary/40 hover:text-primary">Próximos 7 dias</button><button type="button" onClick={() => aplicarPeriodo(periodoMesAtual())} className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:border-primary/40 hover:text-primary">Este mês</button></div></div>

          <form onSubmit={aplicarFiltros} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6 items-end">
            <label className="text-xs text-on-surface-variant sm:col-span-2"><span className="block mb-2 uppercase tracking-wider font-bold">Cliente ou WhatsApp</span><input name="busca" type="search" value={filtros.busca} onChange={alterarFiltro} placeholder="Nome ou telefone" className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-white/25" /></label>
            <div className="text-xs text-on-surface-variant"><span className="block mb-2 uppercase tracking-wider font-bold">Data inicial</span><BrandedDatePicker id="filtro-agendamento-inicio" value={filtros.dataInicio} onChange={(valor) => setFiltros((atuais) => ({ ...atuais, dataInicio: valor, dataFim: atuais.dataFim && atuais.dataFim < valor ? valor : atuais.dataFim }))} /></div>
            <div className="text-xs text-on-surface-variant"><span className="block mb-2 uppercase tracking-wider font-bold">Data final</span><BrandedDatePicker id="filtro-agendamento-fim" value={filtros.dataFim} min={filtros.dataInicio || undefined} onChange={(valor) => setFiltros((atuais) => ({ ...atuais, dataFim: valor }))} /></div>
            <label className="text-xs text-on-surface-variant sm:col-span-2"><span className="block mb-2 uppercase tracking-wider font-bold">Profissional</span><select name="profissionalId" value={filtros.profissionalId} onChange={alterarFiltro} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface"><option value="">Todos os profissionais</option>{profissionais.map((item) => <option key={item.idprofissional} value={item.idprofissional}>{item.nome}</option>)}</select></label>
            <label className="text-xs text-on-surface-variant"><span className="block mb-2 uppercase tracking-wider font-bold">Atendimento</span><select name="status" value={filtros.status} onChange={alterarFiltro} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface"><option value="">Todos</option><option value="AGENDADO">Agendado</option><option value="CONCLUIDO">Concluído</option><option value="CANCELADO">Cancelado</option></select></label>
            <label className="text-xs text-on-surface-variant"><span className="block mb-2 uppercase tracking-wider font-bold">Pagamento</span><select name="statusPagamento" value={filtros.statusPagamento} onChange={alterarFiltro} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface"><option value="">Todos</option><option value="PENDENTE">Pendente</option><option value="CONFIRMADO">Confirmado</option><option value="CANCELADO">Cancelado</option><option value="FALHOU">Falhou</option></select></label>
            <div className="sm:col-span-2 xl:col-span-4 flex flex-col sm:flex-row sm:justify-end gap-2"><button type="button" onClick={limparFiltros} disabled={atualizandoId !== null} className="rounded-full border border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:border-primary/30 disabled:opacity-50">Limpar filtros</button><button type="submit" disabled={atualizandoId !== null} className="rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container disabled:opacity-50">Aplicar filtros</button></div>
          </form>
        </section>

        <section aria-label="Resumo dos resultados" className="grid grid-cols-2 lg:grid-cols-5 gap-3">{cardsResumo.map((card) => <div key={card.label} className="glass-panel rounded-2xl border border-white/10 p-4 min-w-0"><p className={`font-headline text-xl sm:text-2xl break-words ${card.cor}`}>{carregando ? '—' : card.valor}</p><p className="text-[9px] uppercase tracking-wider text-on-surface-variant mt-1">{card.label}</p></div>)}</section>

        {erro && <div ref={erroRef} role="alert" tabIndex={-1} className="scroll-mt-24 rounded-2xl border border-error/25 bg-error/10 px-4 py-4 text-sm text-error flex flex-col sm:flex-row sm:items-center justify-between gap-3 outline-none focus-visible:ring-2 focus-visible:ring-error/60"><span>{erro}</span><button type="button" onClick={() => carregar()} className="self-start sm:self-auto rounded-full border border-error/35 px-4 py-2 text-xs font-bold uppercase tracking-wider">Tentar novamente</button></div>}

        <section aria-labelledby="resultados-titulo">
          <div className="flex items-end justify-between gap-4 mb-5"><div><p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Listagem</p><h2 id="resultados-titulo" className="font-headline text-2xl mt-2">Resultados</h2></div><span className="text-xs text-on-surface-variant">{agendamentos.length} {agendamentos.length === 1 ? 'registro' : 'registros'}</span></div>

          {carregando ? <SkeletonResultados /> : agendamentos.length === 0 ? <div className="glass-panel rounded-2xl border border-white/10 p-10 text-center"><div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto"><BrandIcon name="empty" size={34} /></div><h3 className="font-headline text-xl mt-5">Nenhum agendamento encontrado</h3><p className="text-sm text-on-surface-variant mt-2">Revise os filtros selecionados ou consulte todos os registros.</p><button type="button" onClick={limparFiltros} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary">Limpar filtros</button></div> : <div className="space-y-8">{Object.entries(grupos).map(([dataGrupo, itens]) => <section key={dataGrupo} aria-labelledby={`data-${dataGrupo}`}><div className="flex items-center justify-between gap-4 mb-3"><h3 id={`data-${dataGrupo}`} className="font-headline text-xl sm:text-2xl capitalize">{formatarData(dataGrupo)}</h3><span className="text-[10px] uppercase tracking-wider text-on-surface-variant">{itens.length} {itens.length === 1 ? 'atendimento' : 'atendimentos'}</span></div><div className="space-y-3">{itens.map((item) => {
            const statusCodigo = String(item.statusagendamento || '').toUpperCase()
            const pagamentoCodigo = String(item.statuspagamento || 'NAO_INICIADO').toUpperCase()
            const pagamentoConfiguracao = item.metodo === 'DINHEIRO' && pagamentoCodigo === 'PENDENTE'
              ? { texto: 'Dinheiro na barbearia', classe: 'border-amber-400/30 bg-amber-500/10 text-amber-200' }
              : PAGAMENTO[pagamentoCodigo]
            const whatsapp = dadosWhatsapp(item.cliente_telefone)
            const aberto = detalheId === item.idagendamento
            const podeConcluir = item.pode_concluir === true
            const horarioLiberacao = formatarHorarioFinal(item.horario, item.duracao)
            return <article key={item.idagendamento} className={`glass-panel rounded-2xl border p-4 sm:p-5 transition-colors ${aberto ? 'border-primary/35' : 'border-white/10 hover:border-primary/20'} ${statusCodigo === 'CANCELADO' ? 'opacity-70' : ''}`}>
              <div className="grid gap-5 lg:grid-cols-[110px_minmax(0,1.2fr)_minmax(220px,.8fr)_auto] lg:items-center">
                <div><p className="font-headline text-2xl text-primary">{item.horario}</p><p className="text-xs text-on-surface-variant mt-1">até {formatarHorarioFinal(item.horario, item.duracao)}</p><p className="text-[10px] text-on-surface-variant mt-1">{item.duracao} minutos</p></div>
                <div className="min-w-0"><h4 className="font-headline text-xl">{item.servico}</h4><p className="text-sm font-semibold mt-2">{item.cliente}</p>{whatsapp ? <a href={whatsapp.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200" aria-label={`Conversar com ${item.cliente} pelo WhatsApp`}><BrandIcon name="phone" size={16} />WhatsApp {whatsapp.exibicao}</a> : <p className="text-xs text-on-surface-variant mt-2">WhatsApp não informado</p>}</div>
                <div><p className="text-[9px] uppercase tracking-wider text-on-surface-variant">Profissional</p><p className="text-sm font-semibold mt-1">{item.profissional}</p><p className="text-[9px] uppercase tracking-wider text-on-surface-variant mt-3">Valor</p><p className="font-headline text-lg text-primary mt-1">{formatarMoeda(item.preco)}</p></div>
                <div className="flex flex-wrap lg:flex-col lg:items-end gap-2"><Badge configuracao={STATUS[statusCodigo]} fallback={statusCodigo} /><Badge configuracao={pagamentoConfiguracao} fallback={pagamentoCodigo} /></div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3"><button type="button" onClick={() => setDetalheId(aberto ? null : item.idagendamento)} aria-expanded={aberto} className="self-start inline-flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:text-primary">{aberto ? 'Ocultar detalhes' : 'Ver detalhes'}<BrandIcon name={aberto ? 'back' : 'next'} size={15} className={aberto ? 'rotate-90' : ''} /></button>{statusCodigo === 'AGENDADO' && <div className="flex flex-col items-start gap-1 sm:items-end"><button type="button" onClick={() => setConfirmacaoConclusao(item)} disabled={atualizandoId !== null || !podeConcluir} title={podeConcluir ? 'Marcar atendimento como concluído' : `Disponível após ${formatarDataCurta(item.data)} às ${horarioLiberacao}`} className="rounded-full border border-primary/35 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-on-surface-variant disabled:opacity-60">{atualizandoId === item.idagendamento ? 'Salvando...' : podeConcluir ? 'Concluir atendimento' : `Disponível após ${horarioLiberacao}`}</button>{!podeConcluir && <span className="text-[10px] text-on-surface-variant">A conclusão será liberada após o término.</span>}</div>}</div>

              {aberto && <dl className="mt-4 grid gap-4 rounded-xl border border-white/[0.07] bg-black/15 p-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-[9px] uppercase tracking-wider text-on-surface-variant">Código</dt><dd className="text-sm mt-1">#{item.idagendamento}</dd></div><div><dt className="text-[9px] uppercase tracking-wider text-on-surface-variant">Data</dt><dd className="text-sm mt-1">{formatarDataCurta(item.data)}</dd></div><div><dt className="text-[9px] uppercase tracking-wider text-on-surface-variant">Especialidade</dt><dd className="text-sm mt-1">{item.especialidade || 'Não informada'}</dd></div><div><dt className="text-[9px] uppercase tracking-wider text-on-surface-variant">E-mail secundário</dt><dd className="text-sm mt-1 break-all">{item.cliente_email || 'Não informado'}</dd></div></dl>}
            </article>
          })}</div></section>)}</div>}

          {!carregando && <Pagination dados={paginacao} disabled={atualizandoId !== null} onChange={(pagina) => carregar(filtrosAplicados, pagina)} />}
        </section>
      </main>

      <ConfirmDialog
        aberto={Boolean(confirmacaoConclusao)}
        titulo={confirmacaoConclusao ? `Concluir atendimento de ${confirmacaoConclusao.cliente}?` : 'Concluir atendimento?'}
        descricao="Esta ação registra que o serviço foi realizado e atualiza os relatórios da barbearia. Confira os dados antes de continuar."
        rotuloConfirmar="Confirmar atendimento"
        rotuloProcessando="Confirmando..."
        processando={atualizandoId !== null}
        variante="principal"
        aoFechar={() => { if (atualizandoId === null) setConfirmacaoConclusao(null) }}
        aoConfirmar={() => concluirAtendimento(confirmacaoConclusao.idagendamento)}
      >
        {confirmacaoConclusao && (
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Serviço</p>
                <p className="mt-1 text-sm font-semibold text-on-surface">{confirmacaoConclusao.servico}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Profissional</p>
                <p className="mt-1 text-sm font-semibold text-on-surface">{confirmacaoConclusao.profissional}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Data</p>
                <p className="mt-1 text-sm font-semibold text-on-surface">{formatarDataCurta(confirmacaoConclusao.data)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Horário</p>
                <p className="mt-1 text-sm font-semibold text-primary">{confirmacaoConclusao.horario} às {formatarHorarioFinal(confirmacaoConclusao.horario, confirmacaoConclusao.duracao)}</p>
              </div>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </AdminLayout>
  )
}

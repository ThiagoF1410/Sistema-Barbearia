import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import BrandIcon from '../../components/ui/BrandIcon'
import Pagination from '../../components/ui/Pagination'
import useFeedbackFocus from '../../hooks/useFeedbackFocus'
import {
  atualizarClienteAdmin,
  listarAgendamentosClienteAdmin,
  listarClientesAdmin,
} from '../../services/clientesService'

function iniciais(nome = '') {
  return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() || 'CL'
}

function telefoneExibicao(valor = '') {
  const numero = String(valor).replace(/\D/g, '')
  if (numero.length === 11) return `(${numero.slice(0, 2)}) ${numero.slice(2, 7)}-${numero.slice(7)}`
  if (numero.length === 10) return `(${numero.slice(0, 2)}) ${numero.slice(2, 6)}-${numero.slice(6)}`
  return valor || 'Não informado'
}

function linkWhatsApp(valor = '') {
  const numero = String(valor).replace(/\D/g, '')
  const internacional = numero.startsWith('55') && numero.length >= 12 ? numero : `55${numero}`
  return `https://wa.me/${internacional}`
}

function dataHora(valor, apenasData = false) {
  if (!valor) return 'Nenhum registro'
  const [data, hora] = String(valor).split(' ')
  const [ano, mes, dia] = data.split('-')
  return apenasData ? `${dia}/${mes}/${ano}` : `${dia}/${mes}/${ano}${hora ? ` às ${hora}` : ''}`
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function Skeleton() {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando clientes">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />)}</div>
}

function ModalEdicao({ cliente, salvando, erro, aoFechar, aoSalvar }) {
  const [form, setForm] = useState({ nome: cliente.nome, email: cliente.email, telefone: cliente.telefone })
  const nomeRef = useRef(null)

  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    nomeRef.current?.focus()
    function escapar(event) { if (event.key === 'Escape' && !salvando) aoFechar() }
    document.addEventListener('keydown', escapar)
    return () => { document.body.style.overflow = anterior; document.removeEventListener('keydown', escapar) }
  }, [aoFechar, salvando])

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !salvando) aoFechar() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="editar-cliente-titulo" className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#151515] shadow-2xl sm:max-w-xl sm:rounded-3xl">
      <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5 sm:px-7"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><BrandIcon name="profile" size={23} /></div><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">Cadastro</p><h2 id="editar-cliente-titulo" className="mt-1 font-headline text-2xl">Editar cliente</h2></div></div><button type="button" onClick={aoFechar} disabled={salvando} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/60 hover:border-primary/35 hover:text-primary" aria-label="Fechar"><BrandIcon name="close" size={20} /></button></header>
      <form onSubmit={(event) => { event.preventDefault(); aoSalvar(form) }} className="space-y-5 p-5 sm:p-7">
        {erro && <div role="alert" className="flex items-start gap-3 rounded-xl border border-error/25 bg-error/10 p-4 text-sm text-error"><BrandIcon name="alert" size={19} className="mt-0.5 shrink-0" />{erro}</div>}
        <label className="block text-xs text-on-surface-variant"><span className="mb-2 block font-bold uppercase tracking-wider">Nome completo</span><input ref={nomeRef} value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} minLength="2" maxLength="100" required autoComplete="name" className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none" /></label>
        <label className="block text-xs text-on-surface-variant"><span className="mb-2 block font-bold uppercase tracking-wider">E-mail</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength="150" required autoComplete="email" className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none" /></label>
        <label className="block text-xs text-on-surface-variant"><span className="mb-2 block font-bold uppercase tracking-wider">Telefone com DDD</span><input type="tel" value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} minLength="10" maxLength="20" required autoComplete="tel" placeholder="(18) 99999-9999" className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none" /></label>
        <p className="rounded-xl border border-primary/15 bg-primary/[0.055] p-4 text-xs leading-relaxed text-on-surface-variant">As alterações serão refletidas no perfil e nos contatos administrativos. O histórico do cliente permanecerá preservado.</p>
        <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={aoFechar} disabled={salvando} className="rounded-full border border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Cancelar</button><button type="submit" disabled={salvando} className="rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar alterações'}</button></div>
      </form>
    </section>
  </div>
}

function ModalHistorico({ cliente, itens, carregando, erro, aoFechar }) {
  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function escapar(event) { if (event.key === 'Escape') aoFechar() }
    document.addEventListener('keydown', escapar)
    return () => { document.body.style.overflow = anterior; document.removeEventListener('keydown', escapar) }
  }, [aoFechar])

  const classesStatus = {
    AGENDADO: 'border-primary/25 bg-primary/10 text-primary',
    CONCLUIDO: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300',
    CANCELADO: 'border-error/25 bg-error/10 text-error',
  }

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/90 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) aoFechar() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="historico-cliente-titulo" className="history-dialog flex max-h-[94vh] w-full flex-col rounded-t-3xl border border-white/10 bg-[#151515] shadow-2xl sm:max-w-3xl sm:rounded-3xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] p-5 sm:px-7"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">Histórico individual</p><h2 id="historico-cliente-titulo" className="mt-1 font-headline text-2xl">{cliente.nome}</h2><p className="mt-1 text-xs text-on-surface-variant">{itens.length} {itens.length === 1 ? 'agendamento registrado' : 'agendamentos registrados'}</p></div><button type="button" onClick={aoFechar} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/60 hover:border-primary/35 hover:text-primary" aria-label="Fechar"><BrandIcon name="close" size={20} /></button></header>
      <div className="touch-pan-y overflow-y-auto overscroll-contain p-5 [scrollbar-gutter:stable] sm:p-7">
        {carregando ? <div className="space-y-3" role="status"><div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" /><div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" /></div> : erro ? <div role="alert" className="rounded-xl border border-error/25 bg-error/10 p-4 text-sm text-error">{erro}</div> : itens.length === 0 ? <div className="py-12 text-center"><BrandIcon name="history" size={36} className="mx-auto text-primary" /><h3 className="mt-4 font-headline text-xl">Nenhum agendamento</h3><p className="mt-2 text-sm text-on-surface-variant">Este cliente ainda não possui histórico de atendimentos.</p></div> : <ol className="space-y-3">{itens.map((item) => <li key={item.idagendamento} className="rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-headline text-lg">{item.servico}</h3><p className="mt-1 text-xs text-on-surface-variant">{dataHora(`${item.data} ${item.horario}`)} • {item.duracao} min</p><p className="mt-1 text-xs text-on-surface-variant">Profissional: {item.profissional}</p></div><span className={`self-start rounded-full border px-3 py-1 text-[8px] font-bold uppercase tracking-wider ${classesStatus[item.statusagendamento] || 'border-white/10 text-white/60'}`}>{item.statusagendamento}</span></div><div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3"><span className="text-[10px] text-on-surface-variant">Pagamento: {item.statuspagamento || 'Não iniciado'}</span><strong className="font-headline text-lg text-primary">{moeda(item.preco)}</strong></div></li>)}</ol>}
      </div>
    </section>
  </div>
}

export default function ClientesAdminPage() {
  const [clientes, setClientes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [editando, setEditando] = useState(null)
  const [historicoCliente, setHistoricoCliente] = useState(null)
  const [historico, setHistorico] = useState([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [erroHistorico, setErroHistorico] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const erroRef = useFeedbackFocus(erro)
  const [sucesso, setSucesso] = useState('')
  const [paginacao, setPaginacao] = useState(null)
  const [resumoServidor, setResumoServidor] = useState(null)

  const carregar = useCallback(async (pagina = 1) => {
    try {
      setCarregando(true)
      setErro('')
      const dados = await listarClientesAdmin({ busca: busca || undefined, filtro, pagina, limite: 12 })
      setClientes(dados.clientes || dados)
      setPaginacao(dados.paginacao || null)
      setResumoServidor(dados.resumo || null)
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível carregar os clientes. Tente novamente.')
    } finally { setCarregando(false) }
  }, [busca, filtro])

  useEffect(() => {
    const temporizador = window.setTimeout(() => carregar(1), busca ? 300 : 0)
    return () => window.clearTimeout(temporizador)
  }, [busca, carregar])

  async function salvar(dados) {
    setSalvando(true)
    setErro('')
    try {
      await atualizarClienteAdmin(editando.idcliente, dados)
      setEditando(null)
      setSucesso('Dados do cliente atualizados com sucesso.')
      await carregar(paginacao?.pagina || 1)
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível atualizar o cliente. Revise os dados e tente novamente.')
    } finally { setSalvando(false) }
  }

  async function abrirHistorico(cliente) {
    setHistoricoCliente(cliente)
    setHistorico([])
    setErroHistorico('')
    setCarregandoHistorico(true)
    try { setHistorico(await listarAgendamentosClienteAdmin(cliente.idcliente)) }
    catch (err) { setErroHistorico(err.response?.data?.message || 'Não foi possível carregar o histórico agora.') }
    finally { setCarregandoHistorico(false) }
  }

  const agora = new Date()
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
  const novosNoMes = clientes.filter((item) => item.data_cadastro?.startsWith(mesAtual)).length
  const comFuturo = clientes.filter((item) => Number(item.agendamentos_futuros) > 0).length
  const recorrentes = clientes.filter((item) => Number(item.atendimentos_concluidos) >= 2).length
  const indicadores = [
    { icon: 'users', valor: Number(resumoServidor?.total ?? clientes.length), rotulo: 'Clientes cadastrados', detalhe: 'Base total de clientes' },
    { icon: 'profile', valor: Number(resumoServidor?.novos_mes ?? novosNoMes), rotulo: 'Novos no mês', detalhe: 'Cadastros no período atual' },
    { icon: 'calendar', valor: Number(resumoServidor?.com_futuro ?? comFuturo), rotulo: 'Com horário marcado', detalhe: 'Possuem agenda futura' },
    { icon: 'history', valor: Number(resumoServidor?.recorrentes ?? recorrentes), rotulo: 'Clientes recorrentes', detalhe: 'Dois ou mais atendimentos' },
  ]

  const filtradosLocais = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return clientes.filter((item) => {
      const atendeFiltro = filtro === 'todos'
        || (filtro === 'futuros' && Number(item.agendamentos_futuros) > 0)
        || (filtro === 'sem-agenda' && Number(item.agendamentos_futuros) === 0)
        || (filtro === 'recorrentes' && Number(item.atendimentos_concluidos) >= 2)
      const texto = `${item.nome} ${item.email} ${item.telefone}`.toLocaleLowerCase('pt-BR')
      return atendeFiltro && (!termo || texto.includes(termo))
    })
  }, [busca, clientes, filtro])
  const filtrados = paginacao ? clientes : filtradosLocais

  return <AdminLayout titulo="Clientes" subtitulo="Relacionamento e histórico">
    <main className="mx-auto max-w-[1480px] space-y-8 px-4 py-7 sm:px-6 sm:py-9">
      <section><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Base de clientes</p><h1 className="mt-2 font-headline text-3xl sm:text-4xl">Clientes</h1><p className="mt-2 max-w-2xl text-sm text-on-surface-variant">Consulte contatos, próximos horários e o relacionamento de cada cliente com a barbearia.</p></section>

      <section aria-label="Resumo dos clientes" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{indicadores.map((item) => <article key={item.rotulo} className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name={item.icon} size={21} /></div><span className="font-headline text-2xl text-primary">{carregando ? '—' : item.valor}</span></div><p className="mt-4 text-xs font-bold">{item.rotulo}</p><p className="mt-1 text-[10px] text-on-surface-variant">{item.detalhe}</p></article>)}</section>

      {erro && <div ref={erroRef} role="alert" className="flex items-start gap-3 rounded-2xl border border-error/25 bg-error/10 px-4 py-4 text-sm text-error"><BrandIcon name="alert" size={20} className="mt-0.5 shrink-0" />{erro}</div>}
      {sucesso && <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200"><BrandIcon name="check" size={20} />{sucesso}</div>}

      <section className="space-y-5" aria-labelledby="lista-clientes-titulo">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Cadastros</p><h2 id="lista-clientes-titulo" className="mt-2 font-headline text-2xl sm:text-3xl">Base de relacionamento</h2><p className="mt-1 text-xs text-on-surface-variant">{filtrados.length} {filtrados.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}</p></div><div className="flex w-full flex-col gap-3 xl:w-auto"><label className="relative w-full xl:w-80"><span className="sr-only">Pesquisar cliente</span><BrandIcon name="search" size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" /><input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome, telefone ou e-mail" className="w-full rounded-full border border-white/10 bg-surface py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-white/30 focus:border-primary focus:outline-none" /></label><div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-surface p-1 sm:grid-cols-4" aria-label="Filtrar clientes">{[['todos', 'Todos'], ['futuros', 'Com agenda'], ['sem-agenda', 'Sem agenda'], ['recorrentes', 'Recorrentes']].map(([valor, texto]) => <button key={valor} type="button" onClick={() => setFiltro(valor)} aria-pressed={filtro === valor} className={`rounded-xl px-3 py-2 text-[8px] font-bold uppercase tracking-wider ${filtro === valor ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{texto}</button>)}</div></div></div>

        {carregando ? <Skeleton /> : filtrados.length === 0 ? <div className="glass-panel rounded-2xl border border-white/10 p-10 text-center"><BrandIcon name="users" size={36} className="mx-auto text-primary" /><h3 className="mt-5 font-headline text-xl">Nenhum cliente encontrado</h3><p className="mt-2 text-sm text-on-surface-variant">Altere a pesquisa ou o filtro selecionado.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtrados.map((cliente) => <article key={cliente.idcliente} className="glass-panel flex min-h-72 flex-col rounded-2xl border border-white/10 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-black/20">
          <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 font-headline text-lg text-primary">{iniciais(cliente.nome)}</div><div className="min-w-0"><h3 className="truncate font-headline text-xl">{cliente.nome}</h3><p className="mt-1 text-[9px] uppercase tracking-wider text-on-surface-variant">Cliente desde {dataHora(cliente.data_cadastro, true)}</p></div></div>{Number(cliente.agendamentos_futuros) > 0 && <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-300">Agendado</span>}</div>
          <div className="mt-5 space-y-3 rounded-xl border border-white/[0.07] bg-black/15 p-4"><p className="flex items-center gap-2 text-xs text-on-surface-variant"><BrandIcon name="phone" size={16} className="shrink-0 text-primary" />{telefoneExibicao(cliente.telefone)}</p><p className="flex items-center gap-2 text-xs text-on-surface-variant"><BrandIcon name="mail" size={16} className="shrink-0 text-primary" /><span className="truncate">{cliente.email}</span></p></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><div><span className="block text-[9px] uppercase tracking-wider text-on-surface-variant">Próximo horário</span><strong className="mt-1 block text-xs font-medium text-primary">{dataHora(cliente.proximo_agendamento)}</strong></div><div><span className="block text-[9px] uppercase tracking-wider text-on-surface-variant">Último atendimento</span><strong className="mt-1 block text-xs font-medium">{dataHora(cliente.ultimo_atendimento)}</strong></div></div>
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[10px] text-on-surface-variant"><span>{cliente.atendimentos_concluidos} concluído(s)</span><span>{cliente.cancelamentos} cancelado(s)</span></div>
          <div className="mt-auto grid grid-cols-3 gap-2 pt-5"><a href={linkWhatsApp(cliente.telefone)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/20 text-[9px] font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/10" aria-label={`Conversar com ${cliente.nome} pelo WhatsApp`}><BrandIcon name="phone" size={15} />WhatsApp</a><button type="button" onClick={() => abrirHistorico(cliente)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-primary/20 text-[9px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10"><BrandIcon name="history" size={15} />Histórico</button><button type="button" onClick={() => { setErro(''); setSucesso(''); setEditando(cliente) }} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant hover:border-primary/30 hover:text-primary"><BrandIcon name="edit" size={15} />Editar</button></div>
        </article>)}</div>}
        {!carregando && <Pagination dados={paginacao} onChange={carregar} />}
      </section>
    </main>
    {editando && <ModalEdicao cliente={editando} salvando={salvando} erro={erro} aoFechar={() => { if (!salvando) { setEditando(null); setErro('') } }} aoSalvar={salvar} />}
    {historicoCliente && <ModalHistorico cliente={historicoCliente} itens={historico} carregando={carregandoHistorico} erro={erroHistorico} aoFechar={() => setHistoricoCliente(null)} />}
  </AdminLayout>
}

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { carregarDashboardAdmin } from '../services/agendamentosService'
import BrandIcon from '../components/ui/BrandIcon'
import BrandedDatePicker from '../components/ui/BrandedDatePicker'
import logoImg from '../assets/Logo1.avif'
import NotificationBell from '../components/NotificationBell'

const navegacao = [
  { grupo: 'Visão geral', itens: [{ icon: 'home', label: 'Painel', to: '/admin' }] },
  { grupo: 'Operação', itens: [
    { icon: 'calendar', label: 'Agendamentos', to: '/admin/agendamentos' },
    { icon: 'clock', label: 'Agenda', to: '/admin/agenda' },
    { icon: 'professional', label: 'Profissionais', to: '/admin/profissionais' },
  ] },
  { grupo: 'Catálogo', itens: [{ icon: 'razor', label: 'Serviços', to: '/admin/servicos' }] },
  { grupo: 'Financeiro', itens: [
    { icon: 'chart', label: 'Pagamentos', to: '/admin/pagamentos' },
    { icon: 'chart', label: 'Relatórios', to: '/admin/relatorios' },
  ] },
  { grupo: 'Cadastros', itens: [{ icon: 'users', label: 'Clientes', to: '/admin/clientes' }] },
]

const gruposAcoes = [
  { titulo: 'Operação', descricao: 'Organize a rotina e os atendimentos da barbearia.', acoes: [
    { icon: 'calendar', label: 'Agendamentos', to: '/admin/agendamentos', desc: 'Consultar e acompanhar atendimentos' },
    { icon: 'clock', label: 'Agenda', to: '/admin/agenda', desc: 'Horários, datas e bloqueios' },
    { icon: 'professional', label: 'Profissionais', to: '/admin/profissionais', desc: 'Cadastro, expedientes e ausências' },
  ] },
  { titulo: 'Financeiro', descricao: 'Acompanhe pagamentos e resultados do negócio.', acoes: [
    { icon: 'chart', label: 'Pagamentos', to: '/admin/pagamentos', desc: 'Valores e situação dos pagamentos' },
    { icon: 'chart', label: 'Relatórios', to: '/admin/relatorios', desc: 'Faturamento e indicadores mensais' },
  ] },
  { titulo: 'Cadastros e catálogo', descricao: 'Mantenha clientes e serviços organizados.', acoes: [
    { icon: 'razor', label: 'Serviços', to: '/admin/servicos', desc: 'Cadastrar e editar serviços' },
    { icon: 'users', label: 'Clientes', to: '/admin/clientes', desc: 'Base de clientes cadastrados' },
  ] },
]

const STATUS = {
  AGENDADO: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  CONCLUIDO: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  CANCELADO: 'border-red-400/30 bg-red-500/10 text-red-200',
}

const STATUS_PAGAMENTO = {
  CONFIRMADO: { texto: 'Pagamento confirmado', classe: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200' },
  PENDENTE: { texto: 'Pagamento pendente', classe: 'border-amber-400/25 bg-amber-500/10 text-amber-200' },
  FALHOU: { texto: 'Pagamento falhou', classe: 'border-red-400/25 bg-red-500/10 text-red-200' },
  CANCELADO: { texto: 'Pagamento cancelado', classe: 'border-red-400/25 bg-red-500/10 text-red-200' },
  NAO_INICIADO: { texto: 'Pagamento não iniciado', classe: 'border-white/10 bg-white/5 text-on-surface-variant' },
}

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

function formatarData(data) {
  if (!data) return ''
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarHorarioFinal(horario, duracao) {
  const [hora, minuto] = String(horario).split(':').map(Number)
  const total = (hora * 60) + minuto + Number(duracao || 0)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function SidebarAdmin({ aberta, recolhida, aoFechar, aoAlternar, user, aoSair }) {
  return <>
    {aberta && <button type="button" onClick={aoFechar} className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden" aria-label="Fechar menu administrativo" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-primary/15 bg-[#0b0b0b]/98 shadow-2xl transition-all duration-300 ${aberta ? 'translate-x-0' : '-translate-x-full'} w-72 lg:translate-x-0 ${recolhida ? 'lg:w-20' : 'lg:w-64'}`} aria-label="Navegação administrativa">
      <div className="h-20 px-4 flex items-center justify-between gap-3 border-b border-white/[0.07]">
        <Link to="/admin" onClick={aoFechar} className="flex items-center gap-3 min-w-0">
          <img src={logoImg} alt="" width="44" height="44" decoding="async" className="w-11 h-11 object-contain shrink-0" />
          <div className={`${recolhida ? 'lg:hidden' : ''} min-w-0`}><p className="font-headline text-lg truncate">O Rei da Navalha</p><p className="text-[8px] uppercase tracking-[0.22em] text-primary mt-1">Administração</p></div>
        </Link>
        <button type="button" onClick={aoFechar} className="lg:hidden p-2 rounded-xl text-white/70 hover:bg-white/5 hover:text-primary" aria-label="Fechar menu"><BrandIcon name="close" size={21} /></button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-5">
        {navegacao.map((secao) => <div key={secao.grupo}>
          <p className={`px-3 mb-2 text-[8px] font-bold uppercase tracking-[0.2em] text-white/35 ${recolhida ? 'lg:sr-only' : ''}`}>{secao.grupo}</p>
          <div className="space-y-1">{secao.itens.map((item) => <Link key={item.to} to={item.to} onClick={aoFechar} title={recolhida ? item.label : undefined}
            aria-current={item.to === '/admin' ? 'page' : undefined}
            className={`flex items-center gap-3 min-h-11 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${item.to === '/admin' ? 'bg-primary/12 text-primary border border-primary/20' : 'text-white/65 hover:bg-white/[0.05] hover:text-white'} ${recolhida ? 'lg:justify-center' : ''}`}>
            <BrandIcon name={item.icon} size={21} className="shrink-0" /><span className={recolhida ? 'lg:sr-only' : ''}>{item.label}</span>
          </Link>)}</div>
        </div>)}
      </nav>

      <div className="border-t border-white/[0.07] p-3">
        <div className={`rounded-2xl bg-white/[0.035] p-3 ${recolhida ? 'lg:flex lg:justify-center' : ''}`}>
          <div className={`flex items-center gap-3 min-w-0 ${recolhida ? 'lg:justify-center' : ''}`}><div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0"><BrandIcon name="profile" size={19} /></div><div className={`${recolhida ? 'lg:sr-only' : ''} min-w-0`}><p className="text-xs font-semibold truncate">{user?.nome || user?.name || user?.email}</p><p className="text-[9px] uppercase tracking-wider text-on-surface-variant mt-0.5">Administrador</p></div></div>
          <button type="button" onClick={aoSair} title={recolhida ? 'Sair' : undefined} className={`mt-3 w-full min-h-9 flex items-center gap-2 rounded-xl px-2 text-xs text-white/55 hover:bg-error/10 hover:text-error ${recolhida ? 'lg:mt-0 lg:w-auto lg:justify-center' : ''}`}><BrandIcon name="logout" size={17} /><span className={recolhida ? 'lg:sr-only' : ''}>Sair</span></button>
        </div>
      </div>

      <button type="button" onClick={aoAlternar} className="hidden lg:flex absolute -right-3 top-24 w-7 h-7 items-center justify-center rounded-full border border-primary/25 bg-surface text-primary shadow-lg hover:bg-primary hover:text-on-primary" aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}>
        <BrandIcon name={recolhida ? 'next' : 'back'} size={15} />
      </button>
    </aside>
  </>
}

function SkeletonAgenda() {
  return <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-5" role="status" aria-label="Carregando agenda do dia">
    {[1, 2, 3].map((item) => <div key={item} className="grid sm:grid-cols-[105px_1fr_150px] gap-4 animate-pulse"><div className="h-8 w-20 rounded bg-white/10" /><div className="space-y-2"><div className="h-5 w-48 rounded bg-white/10" /><div className="h-4 w-64 max-w-full rounded bg-white/[0.06]" /></div><div className="h-7 w-32 rounded-full bg-white/[0.06]" /></div>)}
    <span className="sr-only">Carregando...</span>
  </div>
}

export default function AdminPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(dataLocalAtual)
  const [dashboard, setDashboard] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [menuAberto, setMenuAberto] = useState(false)
  const [sidebarRecolhida, setSidebarRecolhida] = useState(() => localStorage.getItem('admin-sidebar') === 'recolhida')

  useEffect(() => {
    let consultaAtiva = true
    carregarDashboardAdmin(data)
      .then((resultado) => { if (consultaAtiva) setDashboard(resultado) })
      .catch((err) => { if (consultaAtiva) setErro(err.response?.data?.message || 'Não foi possível carregar o painel administrativo.') })
      .finally(() => { if (consultaAtiva) setCarregando(false) })
    return () => { consultaAtiva = false }
  }, [data])

  useEffect(() => {
    if (!menuAberto) return undefined
    function fecharComEscape(event) { if (event.key === 'Escape') setMenuAberto(false) }
    document.addEventListener('keydown', fecharComEscape)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', fecharComEscape); document.body.style.overflow = '' }
  }, [menuAberto])

  function selecionarData(novaData) {
    setErro('')
    setCarregando(true)
    setData(novaData)
  }

  function alternarSidebar() {
    setSidebarRecolhida((valor) => {
      localStorage.setItem('admin-sidebar', valor ? 'expandida' : 'recolhida')
      return !valor
    })
  }

  async function recarregar() {
    setErro('')
    setCarregando(true)
    try { setDashboard(await carregarDashboardAdmin(data)) }
    catch (err) { setErro(err.response?.data?.message || 'Não foi possível carregar o painel administrativo.') }
    finally { setCarregando(false) }
  }

  function handleLogout() { logout(); navigate('/login') }

  const resumo = dashboard?.resumo || {}
  const agendamentos = dashboard?.agendamentos || []
  const hoje = dataLocalAtual()
  const tituloData = data === hoje ? `Hoje, ${formatarData(data)}` : formatarData(data)
  const cards = [
    { icon: 'calendar', value: resumo.total ?? 0, label: 'Agendamentos', detalhe: 'Na data selecionada', to: '/admin/agendamentos' },
    { icon: 'users', value: resumo.clientes ?? 0, label: 'Clientes', detalhe: 'Cadastros ativos', to: '/admin/clientes' },
    { icon: 'professional', value: resumo.profissionais ?? 0, label: 'Profissionais', detalhe: 'Equipe ativa', to: '/admin/profissionais' },
    { icon: 'chart', value: formatarMoeda(resumo.faturamentoMes), label: 'Faturamento mensal', detalhe: 'Pagamentos confirmados', to: '/admin/pagamentos' },
  ]

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <SidebarAdmin aberta={menuAberto} recolhida={sidebarRecolhida} aoFechar={() => setMenuAberto(false)} aoAlternar={alternarSidebar} user={user} aoSair={handleLogout} />

      <div className={`min-h-screen transition-[padding] duration-300 ${sidebarRecolhida ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-30 h-16 border-b border-primary/15 bg-black/85 backdrop-blur-xl">
          <div className="h-full max-w-[1480px] mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3"><button type="button" onClick={() => setMenuAberto(true)} className="lg:hidden w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-white/80 hover:border-primary/40 hover:text-primary" aria-label="Abrir menu administrativo" aria-expanded={menuAberto}><BrandIcon name="menu" size={22} /></button><div><p className="font-headline text-lg">Painel administrativo</p><p className="hidden sm:block text-[9px] uppercase tracking-wider text-on-surface-variant">Visão geral do negócio</p></div></div>
            <div className="flex items-center gap-2 text-sm"><NotificationBell /><span className="hidden md:inline text-white/60">{user?.nome || user?.name || user?.email}</span><span className="hidden rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-primary sm:inline">Administrador</span></div>
          </div>
        </header>

        <main className="max-w-[1480px] mx-auto px-4 sm:px-6 py-7 sm:py-9 space-y-9">
          <section>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Visão geral</p>
            <h1 className="font-headline text-3xl sm:text-4xl mt-2">Olá, {user?.nome?.split(' ')[0] || user?.name?.split(' ')[0] || 'Administrador'}</h1>
            <p className="text-on-surface-variant text-sm mt-2">Acompanhe a operação da barbearia e acesse rapidamente cada área.</p>
          </section>

          {erro && <div role="alert" className="rounded-2xl border border-error/25 bg-error/10 px-4 py-4 text-sm text-error flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span>{erro}</span><button type="button" onClick={recarregar} className="self-start sm:self-auto rounded-full border border-error/35 px-4 py-2 text-xs font-bold uppercase tracking-wider">Tentar novamente</button></div>}

          <section aria-label="Resumo administrativo" className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {cards.map((card) => <Link key={card.label} to={card.to} className="brand-card glass-panel p-4 sm:p-5 border border-outline-variant/10 min-h-36 group hover:border-primary/35 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-all">
              <div className="flex items-start justify-between gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center"><BrandIcon name={card.icon} size={22} /></div><BrandIcon name="next" size={17} className="text-white/20 group-hover:text-primary group-hover:translate-x-1 transition-all" /></div>
              <p className="font-headline text-xl sm:text-2xl mt-4 break-words">{carregando ? '—' : card.value}</p><p className="text-xs font-bold mt-1">{card.label}</p><p className="text-[10px] text-on-surface-variant mt-1">{card.detalhe}</p>
            </Link>)}
          </section>

          <section aria-labelledby="agenda-dia-titulo" className="space-y-5">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
              <div><p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Agenda do dia</p><h2 id="agenda-dia-titulo" className="font-headline text-2xl sm:text-3xl mt-2 capitalize">{tituloData}</h2></div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex flex-wrap gap-2 text-[9px] uppercase tracking-wider font-bold" aria-label="Resumo dos estados"><span className="rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-200 px-3 py-1.5">{resumo.agendados ?? 0} agendados</span><span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 text-emerald-200 px-3 py-1.5">{resumo.concluidos ?? 0} concluídos</span><span className="rounded-full border border-red-400/25 bg-red-500/10 text-red-200 px-3 py-1.5">{resumo.cancelados ?? 0} cancelados</span></div>
                <div className="glass-panel rounded-2xl border border-white/10 p-2 flex items-center gap-2" aria-label="Selecionar data da agenda"><button type="button" onClick={() => selecionarData(deslocarData(data, -1))} className="w-10 h-10 shrink-0 rounded-xl border border-white/10 flex items-center justify-center hover:border-primary/40 hover:text-primary" aria-label="Dia anterior"><BrandIcon name="back" size={19} /></button><label className="sr-only" htmlFor="data-dashboard">Data da agenda</label><BrandedDatePicker id="data-dashboard" value={data} onChange={(valor) => selecionarData(valor || hoje)} allowClear={false} className="min-w-0 flex-1 sm:w-64" /><button type="button" onClick={() => selecionarData(deslocarData(data, 1))} className="w-10 h-10 shrink-0 rounded-xl border border-white/10 flex items-center justify-center hover:border-primary/40 hover:text-primary" aria-label="Próximo dia"><BrandIcon name="next" size={19} /></button>{data !== hoje && <button type="button" onClick={() => selecionarData(hoje)} className="px-2 py-2 text-xs font-bold text-primary">Hoje</button>}</div>
              </div>
            </div>

            {carregando ? <SkeletonAgenda /> : agendamentos.length === 0 ? <div className="glass-panel rounded-2xl border border-white/10 px-5 py-12 text-center"><div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto"><BrandIcon name="calendar" size={34} /></div><h3 className="font-headline text-xl mt-5">Nenhum atendimento nesta data</h3><p className="text-sm text-on-surface-variant mt-2">Selecione outro dia ou consulte todos os agendamentos cadastrados.</p><div className="flex flex-col sm:flex-row justify-center gap-3 mt-5">{data !== hoje && <button type="button" onClick={() => selecionarData(hoje)} className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-wider hover:border-primary/40">Ver agenda de hoje</button>}<Link to="/admin/agendamentos" className="rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container">Todos os agendamentos</Link></div></div> : <div className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5"><ol className="relative space-y-1 before:absolute before:left-[1.19rem] sm:before:left-[6.65rem] before:top-7 before:bottom-7 before:w-px before:bg-primary/20">{agendamentos.map((item) => {
              const status = String(item.statusagendamento || '').toUpperCase()
              const codigoPagamento = String(item.statuspagamento || 'NAO_INICIADO').toUpperCase()
              const pagamento = STATUS_PAGAMENTO[codigoPagamento] || STATUS_PAGAMENTO.NAO_INICIADO
              return <li key={item.idagendamento} className={`relative grid sm:grid-cols-[90px_1fr_auto] gap-3 sm:gap-5 rounded-2xl p-3 sm:p-4 hover:bg-white/[0.025] ${status === 'CANCELADO' ? 'opacity-65' : ''}`}>
                <div className="flex sm:block items-center gap-3"><span className="relative z-10 inline-block w-3 h-3 rounded-full border-2 border-primary bg-background sm:absolute sm:left-[6.13rem] sm:top-6" /><time dateTime={`${item.data}T${item.horario}`} className="font-headline text-xl sm:text-2xl text-primary">{item.horario}</time><span className="text-[10px] text-on-surface-variant sm:block sm:mt-1">até {formatarHorarioFinal(item.horario, item.duracao)}</span></div>
                <div className="min-w-0 pl-6 sm:pl-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h3 className="font-headline text-lg sm:text-xl">{item.servico}</h3><span className="text-[10px] text-on-surface-variant">{item.duracao} min · {formatarMoeda(item.preco)}</span></div><p className="text-sm font-semibold mt-1">{item.cliente}</p><p className="text-xs text-on-surface-variant mt-1">Profissional: {item.profissional}</p><p className="text-xs text-on-surface-variant mt-0.5 break-all">{item.cliente_email}</p></div>
                <div className="pl-6 sm:pl-0 flex flex-wrap sm:flex-col items-start sm:items-end gap-2"><span className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${STATUS[status] || 'border-white/15 text-on-surface-variant'}`}>{status}</span><span className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${pagamento.classe}`}>{pagamento.texto}</span></div>
              </li>
            })}</ol></div>}
            <div className="flex justify-end"><Link to="/admin/agendamentos" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-on-surface">Ver todos os agendamentos <BrandIcon name="next" size={17} /></Link></div>
          </section>

          <section aria-labelledby="gerenciar-titulo" className="space-y-7"><div><p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Acesso rápido</p><h2 id="gerenciar-titulo" className="font-headline text-2xl sm:text-3xl mt-2">Gerenciar a barbearia</h2></div>{gruposAcoes.map((grupo) => <section key={grupo.titulo} aria-labelledby={`grupo-${grupo.titulo.replace(/\s/g, '-').toLowerCase()}`}><div className="mb-3"><h3 id={`grupo-${grupo.titulo.replace(/\s/g, '-').toLowerCase()}`} className="font-headline text-xl">{grupo.titulo}</h3><p className="text-xs text-on-surface-variant mt-1">{grupo.descricao}</p></div><div className={`grid sm:grid-cols-2 ${grupo.acoes.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2'} gap-4`}>{grupo.acoes.map((acao) => <Link key={acao.label} to={acao.to} className="brand-card glass-panel p-5 border border-outline-variant/10 hover:border-primary/35 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-all group"><div className="flex items-start justify-between gap-3"><div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center"><BrandIcon name={acao.icon} size={24} /></div><BrandIcon name="next" size={18} className="text-white/20 group-hover:text-primary group-hover:translate-x-1 transition-all" /></div><h4 className="font-label font-bold text-xs uppercase tracking-widest mt-4">{acao.label}</h4><p className="text-on-surface-variant text-xs leading-relaxed mt-1">{acao.desc}</p></Link>)}</div></section>)}</section>
        </main>
      </div>
    </div>
  )
}

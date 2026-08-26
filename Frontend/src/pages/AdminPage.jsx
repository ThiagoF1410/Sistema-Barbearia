import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { carregarDashboardAdmin } from '../services/agendamentosService'
import BrandIcon from '../components/ui/BrandIcon'

const adminActions = [
  { icon: 'calendar', label: 'Agendamentos', to: '/admin/agendamentos', desc: 'Consultar e acompanhar atendimentos' },
  { icon: 'razor', label: 'Serviços', to: '/admin/servicos', desc: 'Cadastrar e editar serviços' },
  { icon: 'clock', label: 'Agenda', to: '/admin/agenda', desc: 'Horários, datas e bloqueios' },
  { icon: 'professional', label: 'Profissionais', to: '/admin/profissionais', desc: 'Cadastro e escalas' },
  { icon: 'users', label: 'Clientes', to: '/admin/clientes', desc: 'Base de clientes cadastrados' },
  { icon: 'chart', label: 'Relatórios', to: '/admin/relatorios', desc: 'Faturamento e indicadores' },
]

const STATUS = {
  AGENDADO: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  CONCLUIDO: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  CANCELADO: 'border-red-400/30 bg-red-500/10 text-red-200',
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

export default function AdminPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(dataLocalAtual)
  const [dashboard, setDashboard] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let consultaAtiva = true
    carregarDashboardAdmin(data)
      .then((resultado) => {
        if (consultaAtiva) setDashboard(resultado)
      })
      .catch((err) => {
        if (consultaAtiva) {
          setErro(err.response?.data?.message || 'Não foi possível carregar o painel administrativo.')
        }
      })
      .finally(() => {
        if (consultaAtiva) setCarregando(false)
      })
    return () => { consultaAtiva = false }
  }, [data])

  function selecionarData(novaData) {
    setErro('')
    setCarregando(true)
    setData(novaData)
  }

  async function recarregar() {
    setErro('')
    setCarregando(true)
    try {
      setDashboard(await carregarDashboardAdmin(data))
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível carregar o painel administrativo.')
    } finally {
      setCarregando(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const resumo = dashboard?.resumo || {}
  const agendamentos = dashboard?.agendamentos || []
  const hoje = dataLocalAtual()
  const tituloData = data === hoje ? `Hoje, ${formatarData(data)}` : formatarData(data)
  const cards = [
    { icon: 'calendar', value: resumo.total ?? 0, label: 'Agendamentos no dia' },
    { icon: 'users', value: resumo.clientes ?? 0, label: 'Clientes cadastrados' },
    { icon: 'professional', value: resumo.profissionais ?? 0, label: 'Profissionais ativos' },
    { icon: 'chart', value: formatarMoeda(resumo.faturamentoMes), label: 'Faturamento confirmado no mês' },
  ]

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="bg-surface border-b border-outline-variant/40">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4">
          <Link to="/admin" className="font-headline text-lg sm:text-xl hover:text-primary transition-colors">O Rei da Navalha — Admin</Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden sm:flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {user?.nome || user?.name || user?.email}
            </span>
            <button type="button" onClick={handleLogout} className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-error">
              <BrandIcon name="logout" size={18} /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold">Visão geral</p>
            <h1 className="font-headline text-3xl sm:text-4xl mt-2">Painel Administrativo</h1>
            <p className="text-on-surface-variant text-sm mt-2">Bem-vindo, {user?.nome?.split(' ')[0] || user?.name?.split(' ')[0] || 'Administrador'}.</p>
          </div>
          <div className="glass-panel rounded-2xl border border-white/10 p-3 flex items-center gap-2" aria-label="Selecionar data da agenda">
            <button type="button" onClick={() => selecionarData(deslocarData(data, -1))} className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center hover:border-primary/40 hover:text-primary" aria-label="Dia anterior">
              <BrandIcon name="back" size={19} />
            </button>
            <label className="sr-only" htmlFor="data-dashboard">Data da agenda</label>
            <input id="data-dashboard" type="date" value={data} onChange={(event) => selecionarData(event.target.value || hoje)} className="min-w-0 bg-surface border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface" />
            <button type="button" onClick={() => selecionarData(deslocarData(data, 1))} className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center hover:border-primary/40 hover:text-primary" aria-label="Próximo dia">
              <BrandIcon name="next" size={19} />
            </button>
            {data !== hoje && <button type="button" onClick={() => selecionarData(hoje)} className="px-3 py-2 text-xs font-bold text-primary hover:text-on-surface">Hoje</button>}
          </div>
        </section>

        {erro && (
          <div role="alert" className="rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error flex items-center justify-between gap-4">
            <span>{erro}</span><button type="button" onClick={recarregar} className="font-bold underline">Tentar novamente</button>
          </div>
        )}

        <section aria-label="Resumo administrativo" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <article key={card.label} className="brand-card glass-panel p-5 border border-outline-variant/10 min-h-32">
              <BrandIcon name={card.icon} size={27} className="text-primary" />
              <p className="font-headline text-2xl mt-3 break-words">{carregando ? '—' : card.value}</p>
              <p className="text-on-surface-variant text-xs mt-1">{card.label}</p>
            </article>
          ))}
        </section>

        <section aria-labelledby="agenda-dia-titulo" className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold">Agenda do dia</p>
              <h2 id="agenda-dia-titulo" className="font-headline text-2xl sm:text-3xl mt-2 capitalize">{tituloData}</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wider font-bold" aria-label="Resumo dos estados">
              <span className="rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-200 px-3 py-1.5">{resumo.agendados ?? 0} agendados</span>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 text-emerald-200 px-3 py-1.5">{resumo.concluidos ?? 0} concluídos</span>
              <span className="rounded-full border border-red-400/25 bg-red-500/10 text-red-200 px-3 py-1.5">{resumo.cancelados ?? 0} cancelados</span>
            </div>
          </div>

          {carregando ? (
            <div role="status" className="glass-panel rounded-2xl border border-white/10 py-16 text-center text-sm text-on-surface-variant">Carregando agenda...</div>
          ) : agendamentos.length === 0 ? (
            <div className="glass-panel rounded-2xl border border-white/10 px-5 py-14 text-center">
              <BrandIcon name="calendar" size={38} className="text-primary mx-auto" />
              <h3 className="font-headline text-xl mt-4">Nenhum atendimento nesta data</h3>
              <p className="text-sm text-on-surface-variant mt-2">Escolha outro dia ou consulte a listagem completa.</p>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
              <ol className="divide-y divide-white/10">
                {agendamentos.map((item) => {
                  const status = String(item.statusagendamento || '').toUpperCase()
                  return (
                    <li key={item.idagendamento} className="p-4 sm:p-5 grid sm:grid-cols-[88px_1fr_auto] gap-4 sm:items-center">
                      <time dateTime={`${item.data}T${item.horario}`} className="font-headline text-2xl text-primary">{item.horario}</time>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h3 className="font-headline text-lg">{item.servico}</h3><span className="text-xs text-on-surface-variant">{item.duracao} min</span></div>
                        <p className="text-sm mt-1">{item.cliente}</p>
                        <p className="text-xs text-on-surface-variant mt-1">Com {item.profissional} · {item.cliente_email}</p>
                      </div>
                      <div className="flex sm:flex-col items-start sm:items-end gap-2">
                        <span className={`rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wider ${STATUS[status] || 'border-white/15 text-on-surface-variant'}`}>{status}</span>
                        {item.statuspagamento && <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">Pagamento: {item.statuspagamento}</span>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
          <div className="flex justify-end">
            <Link to="/admin/agendamentos" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-on-surface">Ver todos os agendamentos <BrandIcon name="next" size={17} /></Link>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-headline text-xl">Gerenciar</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminActions.map((acao) => (
              <Link key={acao.label} to={acao.to} className="brand-card glass-panel p-6 space-y-3 border border-outline-variant/10 hover:border-primary/30 transition-colors group">
                <BrandIcon name={acao.icon} size={34} className="text-primary group-hover:scale-110 transition-transform" />
                <div><h3 className="font-label font-bold text-sm uppercase tracking-widest">{acao.label}</h3><p className="text-on-surface-variant text-xs mt-1">{acao.desc}</p></div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

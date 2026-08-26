import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cancelarAgendamento, listarMeusAgendamentos } from '../services/agendamentosService'
import BrandIcon from '../components/ui/BrandIcon'

const quickActions = [
  { icon: 'calendar', label: 'Agendar horário', to: '/agendar', desc: 'Marque seu próximo corte' },
  { icon: 'history', label: 'Histórico', to: '/historico', desc: 'Veja seus agendamentos anteriores' },
  { icon: 'profile', label: 'Meu perfil', to: '/perfil', desc: 'Consulte seus dados pessoais' },
]

function somenteProximos(dados) {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  return dados.filter((item) => item.statusagendamento === 'AGENDADO' && item.data >= hoje).reverse()
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [agendamentos, setAgendamentos] = useState([])
  const [erro, setErro] = useState('')
  const [cancelando, setCancelando] = useState(null)
  const [agendamentoParaCancelar, setAgendamentoParaCancelar] = useState(null)
  const [erroCancelamento, setErroCancelamento] = useState('')
  const [sucesso, setSucesso] = useState('')
  const botaoFecharDialogoRef = useRef(null)
  const dialogoRef = useRef(null)
  const elementoAnteriorRef = useRef(null)
  const cancelandoRef = useRef(null)

  async function carregarAgendamentos() {
    try {
      const dados = await listarMeusAgendamentos()
      setAgendamentos(somenteProximos(dados))
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao carregar agendamentos.')
    }
  }

  useEffect(() => {
    listarMeusAgendamentos()
      .then((dados) => {
        setAgendamentos(somenteProximos(dados))
      })
      .catch((err) => setErro(err.response?.data?.message || 'Erro ao carregar agendamentos.'))
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
      setErroCancelamento(err.response?.data?.message || 'Erro ao cancelar agendamento.')
    } finally {
      setCancelando(null)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-surface border-b border-outline-variant">
        <Link to="/inicio" className="font-headline text-xl text-on-surface hover:text-primary transition-colors">
          O Rei da Navalha
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-on-surface-variant">{user?.nome || user?.name || user?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-error transition-colors"
          >
            <BrandIcon name="logout" size={18} />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10 sm:space-y-12">
        {/* Saudação */}
        <section className="space-y-2">
          <h1 className="font-headline text-3xl">
            Olá, {user?.nome?.split(' ')[0] || user?.name?.split(' ')[0] || 'Cliente'}
          </h1>
          <p className="text-on-surface-variant text-sm">Bem-vindo à sua central de agendamentos.</p>
        </section>

        {/* Ações rápidas */}
        <section className="grid sm:grid-cols-3 gap-4">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="brand-card glass-panel p-6 space-y-3 border border-outline-variant/10 hover:border-primary/30 transition-colors group"
            >
              <BrandIcon name={a.icon} size={34} className="text-primary group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="font-label font-bold text-sm uppercase tracking-widest">{a.label}</h3>
                <p className="text-on-surface-variant text-xs mt-1">{a.desc}</p>
              </div>
            </Link>
          ))}
        </section>

        {/* Próximos agendamentos */}
        <section className="space-y-4">
          <h2 className="font-headline text-xl">Próximos agendamentos</h2>
          {sucesso && <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-emerald-200">
            <div className="flex items-start gap-3"><BrandIcon name="check" size={25} className="shrink-0" /><div><p className="text-sm font-bold">Cancelamento confirmado</p><p className="text-xs mt-1 opacity-85">{sucesso}</p></div></div>
            <div className="flex items-center gap-3 pl-9 sm:pl-0"><Link to="/historico" className="text-xs font-bold underline underline-offset-4">Ver histórico</Link><button type="button" onClick={() => setSucesso('')} className="text-xs opacity-70 hover:opacity-100" aria-label="Fechar mensagem">Fechar</button></div>
          </div>}
          {erro && <p role="alert" className="rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">{erro}</p>}
          {agendamentos.length ? <div className="grid gap-3">
            {agendamentos.map((item) => (
              <article key={item.idagendamento} className="glass-panel rounded-2xl p-5 border border-outline-variant/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-headline text-lg">{item.servico}</p>
                  <p className="text-sm text-on-surface-variant mt-1">
                    {new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')} às {item.horario} · {item.profissional}
                  </p>
                </div>
                <div className="sm:text-right">
                  <button type="button" onClick={() => abrirCancelamento(item)} disabled={!item.pode_cancelar || cancelando === item.idagendamento}
                    title={item.pode_cancelar ? 'Cancelar agendamento' : 'Prazo mínimo de 2 horas encerrado'}
                    className="px-4 py-2 rounded-full border border-error/35 text-error text-xs font-bold uppercase tracking-wider hover:bg-error/10 disabled:opacity-40 disabled:cursor-not-allowed">
                    {cancelando === item.idagendamento ? 'Cancelando...' : 'Cancelar'}
                  </button>
                  {!item.pode_cancelar && <p className="text-[10px] text-on-surface-variant mt-2">Prazo de 2 horas encerrado</p>}
                </div>
              </article>
            ))}
          </div> : <div className="glass-panel rounded-2xl p-8 text-center border border-outline-variant/10">
            <BrandIcon name="empty" size={42} className="text-on-surface-variant mx-auto mb-3" />
            <p className="text-on-surface-variant text-sm">Nenhum agendamento encontrado.</p>
            <Link
              to="/agendar"
              className="inline-block mt-4 px-6 py-2 bg-primary text-on-primary rounded-full text-xs font-label font-bold uppercase tracking-widest hover:bg-primary-container transition-colors"
            >
              Agendar agora
            </Link>
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

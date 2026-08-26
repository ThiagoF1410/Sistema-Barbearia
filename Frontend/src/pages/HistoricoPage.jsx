import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarMeusAgendamentos } from '../services/agendamentosService'
import { criarCheckout } from '../services/pagamentosService'
import BrandIcon from '../components/ui/BrandIcon'

const STATUS = {
  AGENDADO: { texto: 'Agendado', classe: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25' },
  CANCELADO: { texto: 'Cancelado', classe: 'bg-red-500/10 text-red-300 border-red-400/25' },
  CONCLUIDO: { texto: 'Concluído', classe: 'bg-primary/10 text-primary border-primary/25' },
}

const STATUS_PAGAMENTO = {
  PENDENTE: { texto: 'Pagamento pendente', classe: 'bg-amber-500/10 text-amber-200 border-amber-400/30' },
  CONFIRMADO: { texto: 'Pagamento confirmado', classe: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30' },
  CANCELADO: { texto: 'Pagamento cancelado', classe: 'bg-red-500/10 text-red-200 border-red-400/30' },
  FALHOU: { texto: 'Pagamento falhou', classe: 'bg-red-500/10 text-red-200 border-red-400/30' },
  NAO_INICIADO: { texto: 'Pagamento não iniciado', classe: 'bg-white/5 text-on-surface-variant border-white/15' },
}

export default function HistoricoPage() {
  const [agendamentos, setAgendamentos] = useState([])
  const [filtro, setFiltro] = useState('TODOS')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [pagandoId, setPagandoId] = useState(null)

  useEffect(() => {
    listarMeusAgendamentos()
      .then(setAgendamentos)
      .catch((err) => setErro(err.response?.data?.message || 'Erro ao carregar histórico.'))
      .finally(() => setCarregando(false))
  }, [])

  const exibidos = useMemo(() => filtro === 'TODOS'
    ? agendamentos
    : agendamentos.filter((item) => item.statusagendamento === filtro), [agendamentos, filtro])

  async function pagarAgendamento(id) {
    setPagandoId(id)
    setErro('')
    try {
      const checkout = await criarCheckout(id)
      window.location.assign(checkout.checkoutUrl)
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível abrir o pagamento agora.')
      setPagandoId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="px-4 sm:px-6 py-4 bg-surface border-b border-outline-variant/40">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link to="/dashboard" className="font-headline text-lg sm:text-xl hover:text-primary">O Rei da Navalha</Link>
          <Link to="/dashboard" className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"><BrandIcon name="back" size={18} />Painel</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold">Área do cliente</p>
            <h1 className="font-headline text-3xl sm:text-4xl mt-2">Histórico de agendamentos</h1>
            <p className="text-sm text-on-surface-variant mt-2">Consulte seus atendimentos agendados, concluídos e cancelados.</p>
          </div>
          <Link to="/agendar" className="inline-flex justify-center px-5 py-2.5 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-wider">Novo agendamento</Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-6" aria-label="Filtrar histórico">
          {['TODOS', 'AGENDADO', 'CONCLUIDO', 'CANCELADO'].map((item) => (
            <button key={item} type="button" onClick={() => setFiltro(item)} aria-pressed={filtro === item}
              className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider ${filtro === item ? 'bg-primary text-on-primary border-primary' : 'border-white/10 text-on-surface-variant hover:border-primary/40'}`}>
              {item === 'TODOS' ? 'Todos' : STATUS[item]?.texto || item}
            </button>
          ))}
        </div>

        {erro && <p role="alert" className="rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error mb-5">{erro}</p>}
        {carregando ? <p className="text-sm text-on-surface-variant">Carregando histórico...</p> : exibidos.length ? (
          <div className="grid gap-4">
            {exibidos.map((item) => {
              const status = STATUS[item.statusagendamento] || { texto: item.statusagendamento, classe: 'border-white/15 text-on-surface-variant' }
              const codigoPagamento = String(item.statuspagamento || 'NAO_INICIADO').toUpperCase()
              const pagamento = STATUS_PAGAMENTO[codigoPagamento] || {
                texto: `Pagamento: ${codigoPagamento}`,
                classe: 'bg-white/5 text-on-surface-variant border-white/15',
              }
              return (
                <article key={item.idagendamento} className="glass-panel rounded-2xl border border-white/10 p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <BrandIcon name="history" size={30} className="text-primary shrink-0" />
                      <div>
                        <h2 className="font-headline text-xl">{item.servico}</h2>
                        <p className="text-sm text-on-surface-variant mt-1">com {item.profissional}</p>
                        <p className="text-sm mt-3">{new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} às {item.horario}</p>
                        <p className="text-xs text-on-surface-variant mt-1">{item.duracao} minutos · R$ {Number(item.preco).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="self-start flex flex-col sm:items-end gap-2">
                      <span className={`px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${status.classe}`}>{status.texto}</span>
                      <span className={`px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${pagamento.classe}`}>{pagamento.texto}</span>
                      {item.pode_pagar && (
                        <button type="button" onClick={() => pagarAgendamento(item.idagendamento)}
                          disabled={pagandoId !== null}
                          className="rounded-full border border-primary/35 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 disabled:opacity-50">
                          {pagandoId === item.idagendamento ? 'Abrindo...' : 'Pagar agora'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-white/10 p-10 text-center">
            <BrandIcon name="empty" size={42} className="mx-auto text-on-surface-variant" />
            <p className="text-sm text-on-surface-variant mt-3">Nenhum agendamento encontrado neste filtro.</p>
          </div>
        )}
      </main>
    </div>
  )
}

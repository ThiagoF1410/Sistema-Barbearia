import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { concluirAgendamentoAdmin, listarAgendamentosAdmin } from '../../services/agendamentosService'
import { listarProfissionais } from '../../services/profissionaisService'
import BrandIcon from '../../components/ui/BrandIcon'

const STATUS = {
  AGENDADO: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25',
  CANCELADO: 'bg-error/10 text-error border-error/25',
  CONCLUIDO: 'bg-primary/10 text-primary border-primary/25',
}

const STATUS_PAGAMENTO = {
  PENDENTE: 'bg-amber-500/10 text-amber-200 border-amber-400/30',
  CONFIRMADO: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30',
  CANCELADO: 'bg-red-500/10 text-red-200 border-red-400/30',
  FALHOU: 'bg-red-500/10 text-red-200 border-red-400/30',
}

function BadgePagamento({ status }) {
  if (!status) return null
  const codigo = String(status).toUpperCase()
  const classe = STATUS_PAGAMENTO[codigo] || 'border-white/15 text-on-surface-variant'
  return <span className={`px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${classe}`}>Pagamento: {codigo}</span>
}

export default function AgendamentosAdminPage() {
  const [agendamentos, setAgendamentos] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [data, setData] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [atualizandoId, setAtualizandoId] = useState(null)
  const consultaRef = useRef(0)

  useEffect(() => {
    listarProfissionais().then(setProfissionais).catch(() => setErro('Erro ao carregar profissionais.'))
  }, [])

  async function carregar(filtros = {}) {
    const consultaId = ++consultaRef.current
    setCarregando(true)
    setErro('')
    try {
      const resultado = await listarAgendamentosAdmin(filtros)
      if (consultaId === consultaRef.current) setAgendamentos(resultado)
    } catch (err) {
      if (consultaId === consultaRef.current) {
        setErro(err.response?.data?.message || 'Erro ao carregar agendamentos.')
      }
    } finally {
      if (consultaId === consultaRef.current) setCarregando(false)
    }
  }

  useEffect(() => {
    const consultaId = ++consultaRef.current
    listarAgendamentosAdmin()
      .then((resultado) => {
        if (consultaId === consultaRef.current) setAgendamentos(resultado)
      })
      .catch((err) => {
        if (consultaId === consultaRef.current) {
          setErro(err.response?.data?.message || 'Erro ao carregar agendamentos.')
        }
      })
      .finally(() => {
        if (consultaId === consultaRef.current) setCarregando(false)
      })
    return () => { consultaRef.current += 1 }
  }, [])

  function aplicarFiltros(event) {
    event.preventDefault()
    if (atualizandoId !== null) return
    carregar({ data: data || undefined, profissionalId: profissionalId || undefined })
  }

  function limparFiltros() {
    if (atualizandoId !== null) return
    setData('')
    setProfissionalId('')
    carregar()
  }

  async function concluirAtendimento(id) {
    if (!window.confirm('Confirmar que este atendimento foi concluído?')) return
    setErro('')
    setAtualizandoId(id)
    try {
      const resultado = await concluirAgendamentoAdmin(id)
      setAgendamentos((atuais) => atuais.map((item) => item.idagendamento === id
        ? { ...item, statusagendamento: resultado.statusagendamento, pode_concluir: false }
        : item))
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao concluir atendimento.')
    } finally {
      setAtualizandoId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="px-4 sm:px-6 py-4 bg-surface border-b border-outline-variant/40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link to="/admin" className="font-headline text-lg sm:text-xl hover:text-primary">O Rei da Navalha — Admin</Link>
          <Link to="/admin" className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"><BrandIcon name="back" size={18} />Painel</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-7"><p className="text-xs uppercase tracking-[0.2em] text-primary font-bold">Administração</p><h1 className="font-headline text-3xl sm:text-4xl mt-2">Agendamentos</h1><p className="text-sm text-on-surface-variant mt-2">Consulte os atendimentos por data e profissional.</p></div>

        <form onSubmit={aplicarFiltros} className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5 mb-7 grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <label className="text-xs text-on-surface-variant"><span className="block mb-2 uppercase tracking-wider font-bold">Data</span><input type="date" value={data} disabled={atualizandoId !== null} onChange={(event) => setData(event.target.value)} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface" /></label>
          <label className="text-xs text-on-surface-variant"><span className="block mb-2 uppercase tracking-wider font-bold">Profissional</span><select value={profissionalId} disabled={atualizandoId !== null} onChange={(event) => setProfissionalId(event.target.value)} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface"><option value="">Todos os profissionais</option>{profissionais.map((item) => <option key={item.idprofissional} value={item.idprofissional}>{item.nome}</option>)}</select></label>
          <div className="flex gap-2"><button type="submit" disabled={atualizandoId !== null} className="flex-1 lg:flex-none px-5 py-3 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-wider disabled:opacity-50">Filtrar</button><button type="button" onClick={limparFiltros} disabled={atualizandoId !== null} className="px-4 py-3 border border-white/10 rounded-full text-xs text-on-surface-variant hover:border-primary/30 disabled:opacity-50">Limpar</button></div>
        </form>

        <div className="flex items-center justify-between mb-4"><h2 className="font-headline text-xl">Resultados</h2><span className="text-xs text-on-surface-variant">{agendamentos.length} {agendamentos.length === 1 ? 'registro' : 'registros'}</span></div>
        {erro && <p role="alert" className="mb-5 rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">{erro}</p>}
        {carregando ? <p role="status" className="text-sm text-on-surface-variant py-10 text-center">Carregando agendamentos...</p> : agendamentos.length ? (
          <div className="grid gap-4">
            {agendamentos.map((item) => <article key={item.idagendamento} className="glass-panel rounded-2xl border border-white/10 p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="flex gap-4 min-w-0"><div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0"><BrandIcon name="calendar" /></div><div><h3 className="font-headline text-xl">{item.servico}</h3><p className="text-sm text-on-surface-variant mt-1">{new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')} às {item.horario} · {item.duracao} min</p></div></div>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm lg:min-w-[390px]"><p><span className="text-xs text-on-surface-variant block">Cliente</span>{item.cliente}</p><p><span className="text-xs text-on-surface-variant block">Profissional</span>{item.profissional}</p><p><span className="text-xs text-on-surface-variant block">Contato</span>{item.cliente_email}</p><p><span className="text-xs text-on-surface-variant block">Valor</span><strong className="text-primary">R$ {Number(item.preco).toFixed(2)}</strong></p></div>
                <div className="self-start lg:self-center flex flex-col items-start lg:items-end gap-2">
                  <span className={`px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${STATUS[item.statusagendamento] || 'border-white/10 text-on-surface-variant'}`}>{item.statusagendamento}</span>
                  <BadgePagamento status={item.statuspagamento} />
                  {item.statusagendamento === 'AGENDADO' && (
                    <button type="button" onClick={() => concluirAtendimento(item.idagendamento)}
                      disabled={atualizandoId !== null}
                      title={item.pode_concluir ? 'Marcar atendimento como concluído' : 'O sistema validará se o atendimento já terminou'}
                      className="mt-1 rounded-full border border-primary/35 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 disabled:opacity-50">
                      {atualizandoId === item.idagendamento ? 'Salvando...' : 'Concluir atendimento'}
                    </button>
                  )}
                </div>
              </div>
            </article>)}
          </div>
        ) : <div className="glass-panel rounded-2xl border border-white/10 p-10 text-center"><BrandIcon name="empty" size={42} className="mx-auto text-on-surface-variant" /><p className="text-sm text-on-surface-variant mt-3">Nenhum agendamento encontrado para os filtros informados.</p></div>}
      </main>
    </div>
  )
}

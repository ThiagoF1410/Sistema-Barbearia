import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BrandIcon from './ui/BrandIcon'
import {
  listarNotificacoes,
  marcarNotificacaoComoLida,
  marcarTodasNotificacoesComoLidas,
} from '../services/notificacoesService'

const INTERVALO_ATUALIZACAO = 15_000

const ICONES = {
  AGENDAMENTO_NOVO: 'calendar',
  AGENDAMENTO_CANCELADO: 'close',
  PAGAMENTO_CONFIRMADO: 'check',
  PEDIDO_DINHEIRO: 'money',
  PEDIDO_CANCELADO: 'close',
  SOLICITACAO_AUSENCIA: 'clock',
  SOLICITACAO_APROVADA: 'check',
  SOLICITACAO_RECUSADA: 'alert',
  SOLICITACAO_CANCELADA: 'close',
  ATENDIMENTO_WHATSAPP: 'phone',
}

function tempoRelativo(data) {
  const segundos = Math.round((new Date(data).getTime() - Date.now()) / 1000)
  const absoluto = Math.abs(segundos)
  const formato = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  if (absoluto < 60) return formato.format(segundos, 'second')
  if (absoluto < 3600) return formato.format(Math.round(segundos / 60), 'minute')
  if (absoluto < 86400) return formato.format(Math.round(segundos / 3600), 'hour')
  return formato.format(Math.round(segundos / 86400), 'day')
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const painelRef = useRef(null)
  const [aberto, setAberto] = useState(false)
  const [notificacoes, setNotificacoes] = useState([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  async function carregar({ silencioso = false } = {}) {
    if (!silencioso) setCarregando(true)
    try {
      const dados = await listarNotificacoes()
      setNotificacoes(dados.notificacoes || [])
      setNaoLidas(Number(dados.naoLidas || 0))
      setErro('')
    } catch {
      if (!silencioso) setErro('Não foi possível carregar as notificações.')
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }

  useEffect(() => {
    const inicial = window.setTimeout(() => carregar(), 0)
    const atualizarSeVisivel = () => {
      if (document.visibilityState === 'visible') carregar({ silencioso: true })
    }
    const intervalo = window.setInterval(atualizarSeVisivel, INTERVALO_ATUALIZACAO)
    document.addEventListener('visibilitychange', atualizarSeVisivel)
    return () => {
      window.clearTimeout(inicial)
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', atualizarSeVisivel)
    }
  }, [])

  useEffect(() => {
    if (!aberto) return undefined
    function fechar(evento) {
      if (evento.key === 'Escape') setAberto(false)
      if (evento.type === 'pointerdown' && !painelRef.current?.contains(evento.target)) setAberto(false)
    }
    document.addEventListener('keydown', fechar)
    document.addEventListener('pointerdown', fechar)
    return () => {
      document.removeEventListener('keydown', fechar)
      document.removeEventListener('pointerdown', fechar)
    }
  }, [aberto])

  async function abrirNotificacao(item) {
    if (!item.lida_em) {
      setNotificacoes((atuais) => atuais.map((atual) => atual.idnotificacao === item.idnotificacao
        ? { ...atual, lida_em: new Date().toISOString() }
        : atual))
      setNaoLidas((total) => Math.max(0, total - 1))
      marcarNotificacaoComoLida(item.idnotificacao).catch(() => carregar({ silencioso: true }))
    }
    setAberto(false)
    navigate(item.link)
  }

  async function marcarTodas() {
    if (!naoLidas) return
    setNotificacoes((atuais) => atuais.map((item) => ({ ...item, lida_em: item.lida_em || new Date().toISOString() })))
    setNaoLidas(0)
    try {
      await marcarTodasNotificacoesComoLidas()
    } catch {
      carregar({ silencioso: true })
    }
  }

  return (
    <div ref={painelRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        aria-label={naoLidas ? `Notificações, ${naoLidas} não lidas` : 'Notificações'}
        aria-expanded={aberto}
      >
        <BrandIcon name="bell" size={20} />
        {naoLidas > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-primary px-1 text-[9px] font-extrabold leading-none text-on-primary">{naoLidas > 99 ? '99+' : naoLidas}</span>}
      </button>

      {aberto && (
        <section className="fixed inset-x-3 top-18 z-[90] max-h-[calc(100vh-5.5rem)] overflow-hidden rounded-2xl border border-primary/20 bg-[#151515] shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[390px]" aria-label="Central de notificações">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
            <div><h2 className="font-headline text-xl">Notificações</h2><p className="mt-0.5 text-[10px] text-on-surface-variant">Atualização automática a cada 15 segundos</p></div>
            <button type="button" onClick={marcarTodas} disabled={!naoLidas} className="text-[10px] font-bold uppercase tracking-wider text-primary disabled:cursor-default disabled:opacity-35">Marcar todas como lidas</button>
          </header>

          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-2 sm:max-h-[460px]">
            {carregando && <div className="space-y-2 p-2" role="status"><div className="h-20 animate-pulse rounded-xl bg-white/5" /><div className="h-20 animate-pulse rounded-xl bg-white/5" /></div>}
            {!carregando && erro && <div role="alert" className="m-2 rounded-xl border border-error/25 bg-error/10 p-4 text-sm text-error">{erro}<button type="button" onClick={() => carregar()} className="mt-3 block text-xs font-bold underline">Tentar novamente</button></div>}
            {!carregando && !erro && !notificacoes.length && <div className="px-5 py-10 text-center"><BrandIcon name="bell" size={34} className="mx-auto text-primary/70" /><p className="mt-3 font-headline text-lg">Tudo tranquilo por aqui</p><p className="mt-1 text-xs text-on-surface-variant">Novos eventos aparecerão neste painel.</p></div>}
            {!carregando && !erro && notificacoes.map((item) => (
              <button key={item.idnotificacao} type="button" onClick={() => abrirNotificacao(item)} className={`group flex w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-white/[0.06] ${item.lida_em ? 'opacity-65' : 'bg-primary/[0.055]'}`}>
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${item.lida_em ? 'border-white/10 text-white/45' : 'border-primary/25 bg-primary/10 text-primary'}`}><BrandIcon name={ICONES[item.tipo] || 'bell'} size={18} /></span>
                <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><strong className="text-sm leading-snug">{item.titulo}</strong>{!item.lida_em && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}</span><span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{item.mensagem}</span><span className="mt-2 block text-[10px] text-white/35">{tempoRelativo(item.criada_em)}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

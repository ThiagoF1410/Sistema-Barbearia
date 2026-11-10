import { useEffect, useMemo, useRef, useState } from 'react'
import BrandIcon from './ui/BrandIcon'
import { markSessionExpired } from '../services/authService'

const AVISO_MS = 5 * 60 * 1000
const HEARTBEAT_MS = 15 * 60 * 1000
const ATIVIDADE_THROTTLE_MS = 30 * 1000

function formatarContagem(milisegundos) {
  const total = Math.max(0, Math.ceil(milisegundos / 1000))
  const minutos = Math.floor(total / 60)
  const segundos = total % 60
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
}

export default function SessionExpiryMonitor({ user, session, onRefresh, onLogout }) {
  const [agora, setAgora] = useState(0)
  const [ultimaAtividadeLocal, setUltimaAtividadeLocal] = useState(null)
  const [renovando, setRenovando] = useState(false)
  const [limiteAbsolutoDispensado, setLimiteAbsolutoDispensado] = useState(null)
  const ultimaAtividadeRef = useRef(0)
  const expiracaoProcessadaRef = useRef(false)
  const refreshRef = useRef(onRefresh)
  const logoutRef = useRef(onLogout)
  const dialogoRef = useRef(null)
  const acaoPrincipalRef = useRef(null)

  useEffect(() => { refreshRef.current = onRefresh }, [onRefresh])
  useEffect(() => { logoutRef.current = onLogout }, [onLogout])

  const perfilControlado = user?.role === 'admin' || user?.role === 'profissional'
  const limiteAbsoluto = session?.expiraEm ? new Date(session.expiraEm).getTime() : null
  const inatividadeMs = session?.inatividadeSegundos
    ? Number(session.inatividadeSegundos) * 1000
    : null
  const limiteInatividadeServidor = session?.inatividadeExpiraEm
    ? new Date(session.inatividadeExpiraEm).getTime()
    : null
  const limiteInatividadeLocal = ultimaAtividadeLocal && inatividadeMs
    ? Math.min(ultimaAtividadeLocal + inatividadeMs, limiteAbsoluto || Number.POSITIVE_INFINITY)
    : null
  const limiteInatividade = Math.max(
    limiteInatividadeServidor || 0,
    limiteInatividadeLocal || 0
  ) || null

  useEffect(() => {
    if (!perfilControlado || !session) return
    ultimaAtividadeRef.current = Date.now()
    expiracaoProcessadaRef.current = false
  }, [perfilControlado, session])

  useEffect(() => {
    if (!perfilControlado) return undefined
    const inicial = window.setTimeout(() => setAgora(Date.now()), 0)
    const timer = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => {
      window.clearTimeout(inicial)
      window.clearInterval(timer)
    }
  }, [perfilControlado])

  const estado = useMemo(() => {
    if (!perfilControlado || !limiteAbsoluto) return null
    const restanteAbsoluto = limiteAbsoluto - agora
    const restanteInatividade = limiteInatividade ? limiteInatividade - agora : Number.POSITIVE_INFINITY
    if (restanteAbsoluto <= 0) return { tipo: 'expirada', restante: 0 }
    if (restanteInatividade <= 0) return { tipo: 'expirada', restante: 0 }
    if (restanteAbsoluto <= AVISO_MS && limiteAbsolutoDispensado !== limiteAbsoluto) {
      return { tipo: 'maximo', restante: restanteAbsoluto }
    }
    if (restanteInatividade <= AVISO_MS) {
      return { tipo: 'inatividade', restante: restanteInatividade }
    }
    return null
  }, [agora, limiteAbsoluto, limiteAbsolutoDispensado, limiteInatividade, perfilControlado])
  const tipoEstado = estado?.tipo

  useEffect(() => {
    if (!tipoEstado || tipoEstado === 'expirada') return undefined
    const elementoAnterior = document.activeElement
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focoInicial = requestAnimationFrame(() => acaoPrincipalRef.current?.focus())

    const controlarTeclado = (event) => {
      if (event.key !== 'Tab') return
      const elementos = [...(dialogoRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || [])]
      if (!elementos.length) return
      const primeiro = elementos[0]
      const ultimo = elementos[elementos.length - 1]
      if (event.shiftKey && (document.activeElement === primeiro || !dialogoRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener('keydown', controlarTeclado)
    return () => {
      cancelAnimationFrame(focoInicial)
      document.removeEventListener('keydown', controlarTeclado)
      document.body.style.overflow = overflowAnterior
      elementoAnterior?.focus?.()
    }
  }, [tipoEstado])

  useEffect(() => {
    if (!perfilControlado || !inatividadeMs) return undefined
    function registrarAtividade() {
      if (estado) return
      const momento = Date.now()
      if (momento - ultimaAtividadeRef.current < ATIVIDADE_THROTTLE_MS) return
      ultimaAtividadeRef.current = momento
      setUltimaAtividadeLocal(momento)
    }
    const eventos = ['pointerdown', 'keydown', 'touchstart']
    eventos.forEach((evento) => window.addEventListener(evento, registrarAtividade, { passive: true }))
    return () => eventos.forEach((evento) => window.removeEventListener(evento, registrarAtividade))
  }, [estado, inatividadeMs, limiteAbsoluto, perfilControlado])

  useEffect(() => {
    if (!perfilControlado) return undefined
    const heartbeat = window.setInterval(() => {
      const atividadeRecente = Date.now() - ultimaAtividadeRef.current < HEARTBEAT_MS
      if (atividadeRecente && limiteAbsoluto - Date.now() > AVISO_MS) {
        refreshRef.current().catch(() => {})
      }
    }, HEARTBEAT_MS)
    return () => window.clearInterval(heartbeat)
  }, [limiteAbsoluto, perfilControlado])

  useEffect(() => {
    if (estado?.tipo !== 'expirada' || expiracaoProcessadaRef.current) return
    expiracaoProcessadaRef.current = true
    markSessionExpired()
    logoutRef.current()
    window.location.replace('/login?motivo=sessao-expirada')
  }, [estado])

  if (!estado || estado.tipo === 'expirada') return null

  const inatividade = estado.tipo === 'inatividade'

  async function continuarConectado() {
    setRenovando(true)
    try {
      const data = await refreshRef.current()
      const novoLimite = data.session?.inatividadeExpiraEm
        ? new Date(data.session.inatividadeExpiraEm).getTime()
        : null
      const momento = Date.now()
      if (novoLimite) setUltimaAtividadeLocal(momento)
      ultimaAtividadeRef.current = momento
    } catch {
      markSessionExpired()
      logoutRef.current()
      window.location.replace('/login?motivo=sessao-expirada')
    } finally {
      setRenovando(false)
    }
  }

  function sairAgora() {
    logoutRef.current()
    window.location.replace('/login')
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section ref={dialogoRef} role="alertdialog" aria-modal="true" aria-labelledby="sessao-titulo" aria-describedby="sessao-descricao" className="glass-panel w-full max-w-md rounded-3xl border border-primary/30 bg-surface-container-high p-6 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <BrandIcon name="clock" size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Segurança da sessão</p>
            <h2 id="sessao-titulo" className="mt-2 font-headline text-2xl text-on-surface">
              {inatividade ? 'Sua sessão está prestes a expirar' : 'Será necessário entrar novamente'}
            </h2>
            <p id="sessao-descricao" className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              {inatividade
                ? 'Por segurança, você será desconectado devido à inatividade. Deseja continuar conectado?'
                : 'Sua sessão está chegando ao limite máximo. Salve as alterações em andamento antes de entrar novamente.'}
            </p>
          </div>
        </div>

        <div className="my-6 rounded-2xl border border-primary/20 bg-black/20 py-4 text-center">
          <span className="font-mono text-3xl font-bold tabular-nums text-primary">
            {formatarContagem(estado.restante)}
          </span>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={sairAgora} className="min-h-11 rounded-full border border-white/15 px-5 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:border-error/40 hover:text-error">
            Sair agora
          </button>
          {inatividade ? (
            <button ref={acaoPrincipalRef} type="button" onClick={continuarConectado} disabled={renovando} className="min-h-11 rounded-full border border-primary bg-primary px-5 text-xs font-bold uppercase tracking-wider text-on-primary disabled:opacity-60">
              {renovando ? 'Renovando...' : 'Continuar conectado'}
            </button>
          ) : (
            <button ref={acaoPrincipalRef} type="button" onClick={() => setLimiteAbsolutoDispensado(limiteAbsoluto)} className="min-h-11 rounded-full border border-primary bg-primary px-5 text-xs font-bold uppercase tracking-wider text-on-primary">
              Continuar até o limite
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import BrandIcon from './ui/BrandIcon'

function calcularRestante(expiraEm) {
  const destino = new Date(expiraEm).getTime()
  if (!Number.isFinite(destino)) return 0
  return Math.max(0, destino - Date.now())
}

function formatarContador(restante) {
  const segundos = Math.ceil(restante / 1000)
  const minutos = Math.floor(segundos / 60)
  return `${String(minutos).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`
}

export default function PagamentoCountdown({ expiraEm, compacto = false, onExpire }) {
  const [restante, setRestante] = useState(() => calcularRestante(expiraEm))
  const notificouExpiracao = useRef(false)

  useEffect(() => {
    notificouExpiracao.current = false
    const atualizar = () => setRestante(calcularRestante(expiraEm))
    atualizar()
    const intervalo = window.setInterval(atualizar, 1000)
    return () => window.clearInterval(intervalo)
  }, [expiraEm])

  useEffect(() => {
    if (restante > 0 || notificouExpiracao.current) return
    notificouExpiracao.current = true
    onExpire?.()
  }, [restante, onExpire])

  const limite = useMemo(() => {
    const data = new Date(expiraEm)
    return Number.isNaN(data.getTime()) ? '' : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }, [expiraEm])

  const expirado = restante <= 0
  return <div className={`rounded-2xl border ${expirado ? 'border-error/30 bg-error/10 text-error' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'} ${compacto ? 'px-3 py-2' : 'p-4'}`}>
    <div className="flex items-center gap-3">
      <BrandIcon name={expirado ? 'alert' : 'clock'} size={compacto ? 18 : 22} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em]">{expirado ? 'Prazo encerrado' : 'Tempo para pagamento'}</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <strong role="timer" aria-live="off" className={`${compacto ? 'text-lg' : 'text-2xl'} font-mono tabular-nums`}>{expirado ? '00:00' : formatarContador(restante)}</strong>
          {limite && <span className="text-[10px] opacity-80">até {limite}</span>}
        </div>
      </div>
    </div>
  </div>
}

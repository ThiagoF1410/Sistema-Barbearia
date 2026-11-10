import { useEffect, useRef } from 'react'
import { consultarCheckout } from '../services/pagamentosService'

const STATUS_ENCERRADOS = ['CANCELADO', 'FALHOU']

export default function useCheckoutPolling({
  sessionId,
  status,
  aoConfirmar,
  aoEncerrar,
  intervaloMs = 3000,
}) {
  const callbacksRef = useRef({ aoConfirmar, aoEncerrar })

  useEffect(() => {
    callbacksRef.current = { aoConfirmar, aoEncerrar }
  }, [aoConfirmar, aoEncerrar])

  useEffect(() => {
    if (!sessionId || status !== 'PENDENTE') return undefined

    let ativo = true
    let temporizador

    const consultar = async () => {
      if (document.visibilityState !== 'visible') {
        temporizador = window.setTimeout(consultar, intervaloMs)
        return
      }

      try {
        const resultado = await consultarCheckout(sessionId)
        if (!ativo) return

        const statusAtual = String(resultado.statuspagamento || '').toUpperCase()
        if (statusAtual === 'CONFIRMADO') {
          callbacksRef.current.aoConfirmar?.(resultado)
          return
        }
        if (STATUS_ENCERRADOS.includes(statusAtual)) {
          callbacksRef.current.aoEncerrar?.(statusAtual, resultado)
          return
        }
      } catch {
        // Uma falha temporaria nao interrompe o acompanhamento do checkout.
      }

      temporizador = window.setTimeout(consultar, intervaloMs)
    }

    consultar()
    return () => {
      ativo = false
      window.clearTimeout(temporizador)
    }
  }, [intervaloMs, sessionId, status])
}

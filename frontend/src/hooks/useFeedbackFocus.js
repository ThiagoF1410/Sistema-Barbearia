import { useEffect, useRef } from 'react'

export default function useFeedbackFocus(mensagem, { bloco = 'center' } = {}) {
  const feedbackRef = useRef(null)

  useEffect(() => {
    if (!mensagem) return undefined

    const frame = window.requestAnimationFrame(() => {
      const elemento = feedbackRef.current
      if (!elemento) return

      const reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (!elemento.hasAttribute('tabindex')) elemento.setAttribute('tabindex', '-1')
      elemento.scrollIntoView({
        behavior: reduzirMovimento ? 'auto' : 'smooth',
        block: bloco,
      })
      elemento.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [bloco, mensagem])

  return feedbackRef
}

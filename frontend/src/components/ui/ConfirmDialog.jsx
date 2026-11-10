import { useEffect, useRef } from 'react'
import BrandIcon from './BrandIcon'

export default function ConfirmDialog({ aberto, titulo, descricao, rotuloConfirmar = 'Confirmar', rotuloProcessando = 'Processando...', processando = false, variante = 'perigo', children, aoConfirmar, aoFechar }) {
  const cancelarRef = useRef(null)
  const dialogoRef = useRef(null)
  const estilos = {
    perigo: { borda: 'border-error/25', icone: 'border-error/25 bg-error/10 text-error', etiqueta: 'text-error', botao: 'border-error/35 bg-error/10 text-error hover:bg-error/20 focus-visible:ring-error/70' },
    principal: { borda: 'border-primary/30', icone: 'border-primary/25 bg-primary/10 text-primary', etiqueta: 'text-primary', botao: 'border-primary bg-primary text-on-primary hover:bg-primary-container focus-visible:ring-primary/70' },
  }
  const estilo = estilos[variante] || estilos.perigo

  useEffect(() => {
    if (!aberto) return undefined
    const elementoAnterior = document.activeElement
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelarRef.current?.focus()
    const controlarTeclado = (event) => {
      if (event.key === 'Escape' && !processando) {
        aoFechar()
        return
      }
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
      document.removeEventListener('keydown', controlarTeclado)
      document.body.style.overflow = overflowAnterior
      elementoAnterior?.focus?.()
    }
  }, [aberto, processando, aoFechar])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !processando) aoFechar() }}>
      <section ref={dialogoRef} role="alertdialog" aria-modal="true" aria-labelledby="confirmacao-titulo" aria-describedby="confirmacao-descricao" className={`glass-panel max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain break-words w-full max-w-md rounded-3xl border ${estilo.borda} bg-surface-container-high p-5 shadow-2xl shadow-black/60 sm:p-6`}>
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${estilo.icone}`}><BrandIcon name={variante === 'principal' ? 'check' : 'alert'} size={23} /></div>
          <div className="min-w-0"><p className={`text-xs font-bold uppercase tracking-[0.2em] ${estilo.etiqueta}`}>Confirmação necessária</p><h2 id="confirmacao-titulo" className="mt-2 font-headline text-2xl text-on-surface">{titulo}</h2><p id="confirmacao-descricao" className="mt-2 text-sm leading-relaxed text-on-surface-variant">{descricao}</p></div>
        </div>
        {children && <div className="mt-5">{children}</div>}
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:justify-end">
          <button ref={cancelarRef} type="button" onClick={aoFechar} disabled={processando} className="min-h-11 rounded-full border border-white/15 px-5 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:border-primary/35 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-50">Voltar</button>
          <button type="button" onClick={aoConfirmar} disabled={processando} className={`min-h-11 rounded-full border px-5 text-xs font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-60 ${estilo.botao}`}>{processando ? rotuloProcessando : rotuloConfirmar}</button>
        </div>
      </section>
    </div>
  )
}

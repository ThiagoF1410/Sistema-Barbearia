import BrandIcon from '../../ui/BrandIcon'
import { SECOES_AGENDA } from './agendaConfig'

export default function NavegacaoAgenda({ secao, aoMudar }) {
  function navegarComTeclado(event, indice) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    let proximo = indice
    if (event.key === 'ArrowRight') proximo = (indice + 1) % SECOES_AGENDA.length
    if (event.key === 'ArrowLeft') proximo = (indice - 1 + SECOES_AGENDA.length) % SECOES_AGENDA.length
    if (event.key === 'Home') proximo = 0
    if (event.key === 'End') proximo = SECOES_AGENDA.length - 1
    aoMudar(SECOES_AGENDA[proximo].id)
    requestAnimationFrame(() => document.getElementById(`aba-${SECOES_AGENDA[proximo].id}`)?.focus())
  }

  return (
    <nav className="sticky top-16 z-20 -mx-4 px-4 py-3 bg-background/90 backdrop-blur-xl sm:mx-0 sm:px-0" aria-label="Seções da agenda">
      <div role="tablist" aria-label="Configurações da agenda" className="flex gap-3 overflow-x-auto pb-2 xl:grid xl:grid-cols-4 xl:overflow-visible">
        {SECOES_AGENDA.map((item, indice) => {
          const ativa = secao === item.id
          return (
            <button key={item.id} id={`aba-${item.id}`} type="button" role="tab"
              aria-selected={ativa} aria-controls={ativa ? `painel-${item.id}` : undefined} tabIndex={ativa ? 0 : -1}
              onClick={() => aoMudar(item.id)} onKeyDown={(event) => navegarComTeclado(event, indice)}
              className={`group min-w-[235px] rounded-2xl border p-4 text-left transition-all xl:min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${ativa ? 'bg-gradient-to-br from-primary/15 to-primary/5 border-primary/45 text-on-surface shadow-[inset_0_-2px_0_var(--color-primary),0_12px_30px_rgba(0,0,0,.16)]' : 'bg-surface/65 border-white/10 text-on-surface-variant hover:-translate-y-0.5 hover:border-primary/30 hover:text-on-surface'}`}>
              <span className="flex items-center gap-3.5">
                <span className={`w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center ${ativa ? 'border-primary/30 bg-primary/15 text-primary' : 'border-white/10 bg-white/[0.025] group-hover:text-primary'}`}><BrandIcon name={item.icon} size={22} /></span>
                <span className="min-w-0">
                  <strong className="block text-xs sm:text-sm font-label uppercase tracking-wider leading-snug">{item.titulo}</strong>
                  <small className="block text-[10px] mt-1 opacity-70 truncate">{item.resumo}</small>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

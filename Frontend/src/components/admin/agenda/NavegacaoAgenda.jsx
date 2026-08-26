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
    <nav className="sticky top-0 z-20 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 bg-background/95 backdrop-blur-md" aria-label="Seções da agenda">
      <div role="tablist" aria-label="Configurações da agenda" className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {SECOES_AGENDA.map((item, indice) => {
          const ativa = secao === item.id
          return (
            <button key={item.id} id={`aba-${item.id}`} type="button" role="tab"
              aria-selected={ativa} aria-controls={ativa ? `painel-${item.id}` : undefined} tabIndex={ativa ? 0 : -1}
              onClick={() => aoMudar(item.id)} onKeyDown={(event) => navegarComTeclado(event, indice)}
              className={`min-w-[210px] sm:min-w-0 rounded-2xl border px-4 py-3 text-left transition-all ${ativa ? 'bg-primary/10 border-primary/45 text-on-surface shadow-[inset_0_-2px_0_var(--color-primary)]' : 'bg-surface/70 border-white/10 text-on-surface-variant hover:border-primary/25 hover:text-on-surface'}`}>
              <span className="flex items-center gap-3">
                <BrandIcon name={item.icon} size={23} className={ativa ? 'text-primary' : ''} />
                <span>
                  <strong className="block text-xs sm:text-sm font-label uppercase tracking-wider">{item.titulo}</strong>
                  <small className="block text-[10px] mt-1 opacity-70">{item.resumo}</small>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

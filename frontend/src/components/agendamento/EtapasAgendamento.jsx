import BrandIcon from '../ui/BrandIcon'
import { ETAPAS } from './etapas'

export function NavegacaoEtapas({ etapa, etapaLiberada, abrirEtapa }) {
  return (
    <div className="mb-7 sm:mb-8" aria-live="polite">
      <div className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 sm:hidden">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs">
          <span className="font-bold uppercase tracking-[0.14em] text-primary">Etapa {etapa + 1} de {ETAPAS.length}</span>
          <span className="font-semibold text-on-surface">{ETAPAS[etapa].titulo}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progresso do agendamento"
          aria-valuemin={1} aria-valuemax={ETAPAS.length} aria-valuenow={etapa + 1}>
          <div className="h-full rounded-full bg-primary shadow-[0_0_14px_rgba(245,197,24,0.35)] transition-all duration-300" style={{ width: `${((etapa + 1) / ETAPAS.length) * 100}%` }} />
        </div>
      </div>

      <nav aria-label="Etapas do agendamento" className="relative hidden grid-cols-5 gap-2 sm:grid">
        <div aria-hidden="true" className="absolute left-[7%] right-[7%] top-5 h-px bg-white/[0.07]" />
        {ETAPAS.map((item, indice) => {
          const liberada = etapaLiberada(indice)
          const concluida = indice < etapa && liberada
          return (
            <button
              key={item.titulo}
              type="button"
              aria-current={etapa === indice ? 'step' : undefined}
              disabled={!liberada}
              onClick={() => abrirEtapa(indice)}
              className={`relative z-[1] min-h-20 rounded-2xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${etapa === indice ? 'border-primary/60 bg-primary/10 shadow-[0_10px_28px_rgba(0,0,0,0.2)]' : concluida ? 'border-emerald-400/25 bg-emerald-500/[0.06] hover:border-emerald-400/45' : 'border-white/10 bg-background/90'} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span className="flex items-center gap-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${etapa === indice ? 'border-primary/35 bg-primary/15 text-primary' : concluida ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/[0.025] text-on-surface-variant'}`}>
                  <BrandIcon name={concluida ? 'check' : item.icon} size={17} />
                </span>
                <span>
                  <span className="block text-[8px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">{concluida ? 'Concluído' : `Etapa ${indice + 1}`}</span>
                  <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider lg:text-xs">{item.titulo}</span>
                </span>
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export function EtapaServico({ servicos, selecionado, aoSelecionar }) {
  return (
    <section className="mb-7">
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="razor" size={21} /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Escolha o serviço</p><p className="mt-1 text-xs text-on-surface-variant">Toque em uma opção para avançar.</p></div></div>
        <span className="hidden text-xs text-on-surface-variant sm:block">{servicos.length} opções</span>
      </div>
      {servicos.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {servicos.map((servico) => {
            const ativo = selecionado?.idservico === servico.idservico
            return (
              <button key={servico.idservico} type="button" onClick={() => aoSelecionar(servico)} aria-pressed={ativo}
                className={`render-efficient brand-card group min-h-40 p-4 sm:p-5 text-left border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 hover:-translate-y-0.5 ${ativo ? 'border-primary bg-primary/10 shadow-[0_12px_30px_rgba(0,0,0,0.22)]' : 'border-white/10 bg-surface-container-low hover:border-primary/40'}`}>
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name={ativo ? 'check' : 'razor'} size={20} /></span>
                    <span className="text-base font-bold text-primary">R$ {Number(servico.preco).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="mt-auto pt-5">
                    <p className="font-headline text-lg leading-tight sm:text-xl">{servico.nome}</p>
                    {servico.descricao && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">{servico.descricao}</p>}
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/15 px-2.5 py-1 text-[10px] text-on-surface-variant"><BrandIcon name="clock" size={13} />{servico.duracao} minutos</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : <p className="text-sm text-on-surface-variant">Nenhum serviço cadastrado.</p>}
    </section>
  )
}

export function EtapaProfissional({ profissionais, selecionado, servicoSelecionado, aoSelecionar }) {
  return (
    <section className="mb-7">
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="professional" size={21} /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Escolha o profissional</p><p className="mt-1 text-xs text-on-surface-variant">A disponibilidade será consultada individualmente.</p></div></div>
        <span className="hidden text-xs text-on-surface-variant sm:block">{profissionais.length} disponíveis</span>
      </div>
      {profissionais.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {profissionais.map((profissional) => {
            const ativo = selecionado?.idprofissional === profissional.idprofissional
            const inicial = profissional.nome?.charAt(0)?.toLocaleUpperCase('pt-BR') || 'P'
            return (
              <button key={profissional.idprofissional} type="button" disabled={!servicoSelecionado}
                onClick={() => aoSelecionar(profissional)} aria-pressed={ativo}
                className={`render-efficient brand-card group min-h-36 p-4 sm:p-5 text-left border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 hover:-translate-y-0.5 disabled:opacity-40 ${ativo ? 'border-primary bg-primary/10 shadow-[0_12px_30px_rgba(0,0,0,0.22)]' : 'border-white/10 bg-surface-container-low hover:border-primary/40'}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 font-headline text-xl text-primary">{inicial}</span>
                  {ativo && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary"><BrandIcon name="check" size={15} /></span>}
                </div>
                <p className="mt-5 font-headline text-lg sm:text-xl">{profissional.nome}</p>
                <p className="mt-1 text-xs text-on-surface-variant">{profissional.especialidade || 'Barbeiro'}</p>
              </button>
            )
          })}
        </div>
      ) : <p className="text-sm text-on-surface-variant">Nenhum profissional cadastrado.</p>}
    </section>
  )
}

export function ResumoEscolhas({ servico, profissional, data, horario }) {
  if (!servico && !profissional && !data && !horario) return null

  return (
    <div className="mt-7 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4" aria-label="Resumo das escolhas">
      <div className="mb-3 flex items-center gap-2 text-primary"><BrandIcon name="check" size={17} /><p className="text-[10px] font-bold uppercase tracking-[0.17em]">Resumo da seleção</p></div>
      <div className="grid gap-3 text-xs text-on-surface-variant sm:grid-cols-2 lg:grid-cols-4">
        {servico && <span><strong className="block text-[9px] uppercase tracking-wider text-on-surface-variant">Serviço</strong><span className="mt-1 block font-semibold text-on-surface">{servico.nome}</span></span>}
        {profissional && <span><strong className="block text-[9px] uppercase tracking-wider text-on-surface-variant">Profissional</strong><span className="mt-1 block font-semibold text-on-surface">{profissional.nome}</span></span>}
        {data && <span><strong className="block text-[9px] uppercase tracking-wider text-on-surface-variant">Data</strong><span className="mt-1 block font-semibold text-on-surface">{new Date(`${data.data}T12:00:00`).toLocaleDateString('pt-BR')}</span></span>}
        {horario && <span><strong className="block text-[9px] uppercase tracking-wider text-on-surface-variant">Horário</strong><span className="mt-1 block font-semibold text-on-surface">{horario.inicio}</span></span>}
      </div>
    </div>
  )
}

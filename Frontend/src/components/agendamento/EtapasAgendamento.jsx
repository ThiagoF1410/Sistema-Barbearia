import BrandIcon from '../ui/BrandIcon'
import { ETAPAS } from './etapas'

export function NavegacaoEtapas({ etapa, etapaLiberada, abrirEtapa }) {
  return (
    <div className="mb-7" aria-live="polite">
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-bold text-primary">Etapa {etapa + 1} de {ETAPAS.length}</span>
          <span>{ETAPAS[etapa].titulo}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10" role="progressbar" aria-label="Progresso do agendamento"
          aria-valuemin={1} aria-valuemax={ETAPAS.length} aria-valuenow={etapa + 1}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((etapa + 1) / ETAPAS.length) * 100}%` }} />
        </div>
      </div>

      <nav aria-label="Etapas do agendamento" className="hidden sm:grid grid-cols-5 gap-2">
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
              className={`rounded-2xl border p-3 text-left transition-colors ${etapa === indice ? 'border-primary bg-primary/10' : concluida ? 'border-emerald-400/25 bg-emerald-500/5' : 'border-white/10'} disabled:opacity-35 disabled:cursor-not-allowed`}
            >
              <span className="flex items-center gap-2">
                <BrandIcon name={concluida ? 'check' : item.icon} size={19} className={etapa === indice ? 'text-primary' : concluida ? 'text-emerald-300' : 'text-on-surface-variant'} />
                <span className="text-[10px] lg:text-xs uppercase font-bold tracking-wider">{item.titulo}</span>
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
      <div className="brand-divider mb-4"><BrandIcon name="razor" size={20} /><span className="text-xs font-bold uppercase tracking-[0.18em]">1. Escolha o serviço</span></div>
      {servicos.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {servicos.map((servico) => {
            const ativo = selecionado?.idservico === servico.idservico
            return (
              <button key={servico.idservico} type="button" onClick={() => aoSelecionar(servico)} aria-pressed={ativo}
                className={`brand-card p-4 text-left border transition-colors ${ativo ? 'border-primary bg-primary/10' : 'border-white/10 bg-surface-container-low hover:border-primary/35'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-headline text-lg">{servico.nome}</p><p className="text-xs text-on-surface-variant mt-1">{servico.duracao} min</p></div>
                  <span className="text-sm font-bold text-primary">R$ {Number(servico.preco).toFixed(2)}</span>
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
      <div className="brand-divider mb-4"><BrandIcon name="professional" size={20} /><span className="text-xs font-bold uppercase tracking-[0.18em]">2. Escolha o profissional</span></div>
      {profissionais.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {profissionais.map((profissional) => {
            const ativo = selecionado?.idprofissional === profissional.idprofissional
            return (
              <button key={profissional.idprofissional} type="button" disabled={!servicoSelecionado}
                onClick={() => aoSelecionar(profissional)} aria-pressed={ativo}
                className={`brand-card p-4 text-left border transition-colors disabled:opacity-40 ${ativo ? 'border-primary bg-primary/10' : 'border-white/10 bg-surface-container-low hover:border-primary/35'}`}>
                <BrandIcon name="professional" size={28} className="text-primary mb-2" />
                <p className="font-headline text-lg">{profissional.nome}</p>
                <p className="text-xs text-on-surface-variant mt-1">{profissional.especialidade || 'Barbeiro'}</p>
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
    <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 rounded-2xl border border-white/5 bg-surface/40 px-4 py-3 text-xs text-on-surface-variant" aria-label="Resumo das escolhas">
      {servico && <span><strong className="text-on-surface">Serviço:</strong> {servico.nome}</span>}
      {profissional && <span><strong className="text-on-surface">Profissional:</strong> {profissional.nome}</span>}
      {data && <span><strong className="text-on-surface">Data:</strong> {new Date(`${data.data}T12:00:00`).toLocaleDateString('pt-BR')}</span>}
      {horario && <span><strong className="text-on-surface">Horário:</strong> {horario.inicio}</span>}
    </div>
  )
}

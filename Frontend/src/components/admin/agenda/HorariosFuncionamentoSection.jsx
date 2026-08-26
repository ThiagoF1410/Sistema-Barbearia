import { NOMES_DIAS } from './agendaConfig'

const classeHorario = 'bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary disabled:opacity-35'

export default function HorariosFuncionamentoSection({
  horarios,
  salvando,
  aoAlterar,
  aoSalvar,
  titulo = 'Horários de funcionamento',
  descricao = 'Defina quando a barbearia abre, fecha e pausa os atendimentos em cada dia.',
  rotuloSalvar = 'Salvar horários',
  comoPainel = true,
}) {
  const atributosPainel = comoPainel
    ? { id: 'painel-horarios', role: 'tabpanel', 'aria-labelledby': 'aba-horarios' }
    : {}
  return (
    <section {...atributosPainel} className="glass-panel rounded-2xl p-4 sm:p-6 border border-outline-variant/10 space-y-6">
      <div>
        <h2 className="font-headline text-xl">{titulo}</h2>
        <p className="text-xs text-on-surface-variant mt-1">{descricao}</p>
      </div>

      {horarios.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhum horário configurado.</p>
      ) : (
        <form onSubmit={aoSalvar} className="space-y-3">
          <fieldset disabled={salvando} className="space-y-3">
          {horarios.map((horario) => (
            <div key={horario.dia_semana} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl bg-surface/70 border border-outline-variant/20 px-4 py-3">
              <span className="font-label text-sm font-semibold text-on-surface">{NOMES_DIAS[horario.dia_semana]}</span>

              <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer sm:mr-3">
                <input type="checkbox" checked={horario.ativo} onChange={(event) => aoAlterar(horario.dia_semana, 'ativo', event.target.checked)}
                  className="w-4 h-4 rounded border-outline-variant bg-surface text-primary focus:ring-primary/30" />
                {horario.ativo ? 'Aberto' : 'Fechado'}
              </label>

              <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span>Abre</span>
                <input type="time" value={horario.hora_abertura || ''} onChange={(event) => aoAlterar(horario.dia_semana, 'hora_abertura', event.target.value)}
                  disabled={!horario.ativo} required={horario.ativo} className={classeHorario} />
              </label>

              <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span>Fecha</span>
                <input type="time" value={horario.hora_fechamento || ''} onChange={(event) => aoAlterar(horario.dia_semana, 'hora_fechamento', event.target.value)}
                  disabled={!horario.ativo} required={horario.ativo} className={classeHorario} />
              </label>

              <div className="md:col-start-2 md:col-span-3 flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer sm:mr-3">
                  <input type="checkbox" checked={Boolean(horario.intervalo_ativo)} onChange={(event) => aoAlterar(horario.dia_semana, 'intervalo_ativo', event.target.checked)}
                    disabled={!horario.ativo} className="w-4 h-4 rounded border-outline-variant bg-surface text-primary focus:ring-primary/30" />
                  Intervalo
                </label>
                <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span>Início</span>
                  <input type="time" value={horario.hora_inicio_intervalo || ''} onChange={(event) => aoAlterar(horario.dia_semana, 'hora_inicio_intervalo', event.target.value)}
                    disabled={!horario.ativo || !horario.intervalo_ativo} required={horario.ativo && horario.intervalo_ativo} className={classeHorario} />
                </label>
                <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span>Fim</span>
                  <input type="time" value={horario.hora_fim_intervalo || ''} onChange={(event) => aoAlterar(horario.dia_semana, 'hora_fim_intervalo', event.target.value)}
                    disabled={!horario.ativo || !horario.intervalo_ativo} required={horario.ativo && horario.intervalo_ativo} className={classeHorario} />
                </label>
              </div>
            </div>
          ))}

          <div className="pt-3 flex justify-end">
            <button type="submit" disabled={salvando}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-full text-xs font-label font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50">
              {salvando ? 'Salvando...' : rotuloSalvar}
            </button>
          </div>
          </fieldset>
        </form>
      )}
    </section>
  )
}

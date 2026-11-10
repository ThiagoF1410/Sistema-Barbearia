import { NOMES_DIAS } from './agendaConfig'

const classeHorario = 'w-full min-w-0 bg-black/20 border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-35'

export default function HorariosFuncionamentoSection({
  horarios,
  salvando,
  aoAlterar,
  aoSalvar,
  titulo = 'Horários de funcionamento',
  descricao = 'Defina quando a barbearia abre, fecha e pausa os atendimentos em cada dia.',
  rotuloSalvar = 'Salvar horários',
  comoPainel = true,
  rotuloAtivo = 'Aberto',
  rotuloInativo = 'Fechado',
  rotuloResumo = 'dias abertos',
}) {
  const atributosPainel = comoPainel
    ? { id: 'painel-horarios', role: 'tabpanel', 'aria-labelledby': 'aba-horarios' }
    : {}
  return (
    <section {...atributosPainel} className="glass-panel rounded-3xl p-4 sm:p-6 border border-outline-variant/10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-primary font-bold">Configuração semanal</p>
          <h2 className="font-headline text-2xl mt-2">{titulo}</h2>
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl">{descricao}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-xs text-on-surface-variant"><strong className="text-on-surface">{horarios.filter((item) => item.ativo).length}</strong> de 7 {rotuloResumo}</div>
      </div>

      {horarios.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhum horário configurado.</p>
      ) : (
        <form onSubmit={aoSalvar}>
          <fieldset disabled={salvando} className="grid gap-4 md:grid-cols-2">
          {horarios.map((horario) => (
            <div key={horario.dia_semana} className={`rounded-2xl border p-4 sm:p-5 transition-colors ${horario.ativo ? 'border-primary/20 bg-surface/75' : 'border-white/[0.07] bg-black/15 opacity-65'}`}>
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.07]"><div><span className="font-label text-sm font-semibold text-on-surface">{NOMES_DIAS[horario.dia_semana]}</span><p className="text-[10px] text-on-surface-variant mt-1">{horario.ativo ? `${horario.hora_abertura || '--:--'} às ${horario.hora_fechamento || '--:--'}` : 'Sem atendimento'}</p></div><label className="inline-flex items-center gap-2 cursor-pointer"><span className={`text-[10px] font-bold uppercase tracking-wider ${horario.ativo ? 'text-emerald-300' : 'text-error'}`} aria-live="polite">{horario.ativo ? rotuloAtivo : rotuloInativo}</span><span className="relative"><input type="checkbox" checked={horario.ativo} onChange={(event) => aoAlterar(horario.dia_semana, 'ativo', event.target.checked)} className="peer sr-only" /><span className="block w-10 h-6 rounded-full bg-white/10 border border-white/10 peer-checked:bg-primary/30 peer-checked:border-primary/50 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/60" /><span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white/55 transition-transform peer-checked:translate-x-4 peer-checked:bg-primary" /></span></label></div>

              <div className="grid grid-cols-2 gap-3 mt-4"><label className="text-[10px] uppercase tracking-wider text-on-surface-variant"><span className="block mb-2">Abertura</span><input type="time" value={horario.hora_abertura || ''} onChange={(event) => aoAlterar(horario.dia_semana, 'hora_abertura', event.target.value)} disabled={!horario.ativo} required={horario.ativo} className={classeHorario} /></label><label className="text-[10px] uppercase tracking-wider text-on-surface-variant"><span className="block mb-2">Fechamento</span><input type="time" value={horario.hora_fechamento || ''} onChange={(event) => aoAlterar(horario.dia_semana, 'hora_fechamento', event.target.value)} disabled={!horario.ativo} required={horario.ativo} className={classeHorario} /></label></div>

              <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/15 p-3"><label className="flex items-center justify-between gap-3 cursor-pointer"><span><strong className="block text-xs">Intervalo</strong><small className="text-[10px] text-on-surface-variant">Pausa sem agendamentos</small></span><span className="relative"><input type="checkbox" checked={Boolean(horario.intervalo_ativo)} onChange={(event) => aoAlterar(horario.dia_semana, 'intervalo_ativo', event.target.checked)} disabled={!horario.ativo} className="peer sr-only" /><span className="block w-10 h-6 rounded-full bg-white/10 border border-white/10 peer-checked:bg-primary/30 peer-checked:border-primary/50 peer-disabled:opacity-30 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/60" /><span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white/55 transition-transform peer-checked:translate-x-4 peer-checked:bg-primary" /></span></label><div className="grid grid-cols-2 gap-3 mt-3"><label className="text-[10px] uppercase tracking-wider text-on-surface-variant"><span className="block mb-2">Início</span><input type="time" value={horario.hora_inicio_intervalo || ''} onChange={(event) => aoAlterar(horario.dia_semana, 'hora_inicio_intervalo', event.target.value)} disabled={!horario.ativo || !horario.intervalo_ativo} required={horario.ativo && horario.intervalo_ativo} className={classeHorario} /></label><label className="text-[10px] uppercase tracking-wider text-on-surface-variant"><span className="block mb-2">Fim</span><input type="time" value={horario.hora_fim_intervalo || ''} onChange={(event) => aoAlterar(horario.dia_semana, 'hora_fim_intervalo', event.target.value)} disabled={!horario.ativo || !horario.intervalo_ativo} required={horario.ativo && horario.intervalo_ativo} className={classeHorario} /></label></div></div>
            </div>
          ))}

          <div className="md:col-span-2 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-white/[0.07]">
            <p className="text-[10px] text-on-surface-variant">As alterações passam a valer para os próximos horários consultados.</p>
            <button type="submit" disabled={salvando}
              className="w-full sm:w-auto px-6 py-3 bg-primary text-on-primary rounded-full text-xs font-label font-bold uppercase tracking-widest hover:bg-primary-container disabled:opacity-50">
              {salvando ? 'Salvando...' : rotuloSalvar}
            </button>
          </div>
          </fieldset>
        </form>
      )}
    </section>
  )
}

import BrandIcon from '../../ui/BrandIcon'
import BrandedDatePicker from '../../ui/BrandedDatePicker'
import { dataLocal } from './agendaConfig'

export default function DatasEspeciaisSection({ datas, feriados, novaData, dataMinima, aoAlterarNovaData, aoAdicionar, aoAlternar, aoExcluir, aoAnoDoCalendario, aoVerFeriados }) {
  return (
    <>
      <section id="painel-datas" role="tabpanel" aria-labelledby="aba-datas" className="glass-panel rounded-2xl p-4 sm:p-6 border border-outline-variant/10 space-y-4">
        <h2 className="font-headline text-xl">Adicionar data</h2>
        <form onSubmit={aoAdicionar} className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <label htmlFor="nova-data-agenda" className="sr-only">Data especial</label>
          <BrandedDatePicker id="nova-data-agenda" value={novaData} onChange={aoAlterarNovaData} min={dataMinima} datas={datas} feriados={feriados} onMonthChange={aoAnoDoCalendario} />
          <button type="submit" disabled={!novaData} className="px-6 py-3 bg-primary text-on-primary rounded-full text-xs font-label font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-35">
            Adicionar
          </button>
        </form>
      </section>

      {feriados.length === 0 && <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-4 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><BrandIcon name="holiday" size={20} className="mt-0.5 shrink-0 text-primary" /><p>Não há feriados importados para o ano exibido no calendário. Importe-os para destacar e bloquear os dias configurados como fechados.</p></div><button type="button" onClick={aoVerFeriados} className="shrink-0 rounded-full border border-primary/35 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10">Gerenciar feriados</button></div>}

      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-headline text-2xl">Datas na agenda</h2>
            <p className="text-xs text-on-surface-variant mt-1">Libere ou bloqueie datas específicas sem alterar o horário semanal.</p>
          </div>
          <span className="text-xs text-on-surface-variant">{datas.length} {datas.length === 1 ? 'data cadastrada' : 'datas cadastradas'}</span>
        </div>
        {datas.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center border border-outline-variant/10">
            <BrandIcon name="calendar" size={42} className="text-on-surface-variant mx-auto mb-2" />
            <p className="text-on-surface-variant text-sm">Nenhuma data cadastrada.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {datas.map((dataAgenda) => (
              <div key={dataAgenda.idagenda}
                className={`glass-panel rounded-2xl px-5 sm:px-6 py-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${dataAgenda.disponivel ? 'border-primary/15 hover:border-primary/35' : 'border-error/15 hover:border-error/35'}`}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${dataAgenda.disponivel ? 'bg-primary/10 border-primary/25 text-primary' : 'bg-error/10 border-error/25 text-error'}`}>
                    <BrandIcon name="calendar" size={25} />
                  </div>
                  <span className="text-sm sm:text-base text-on-surface font-label capitalize">
                    {dataLocal(dataAgenda.data)?.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) || 'Data inválida'}
                    {dataAgenda.total_agendamentos > 0 && (
                      <small className="block text-xs font-normal normal-case text-on-surface-variant mt-1">
                        {dataAgenda.total_ativos > 0
                          ? `${dataAgenda.total_ativos} ${dataAgenda.total_ativos === 1 ? 'agendamento ativo' : 'agendamentos ativos'}`
                          : 'Somente histórico cancelado — a data pode ser removida'}
                      </small>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto sm:shrink-0 pl-16 sm:pl-0">
                  <button onClick={() => aoAlternar(dataAgenda.idagenda, dataAgenda.disponivel)}
                    className={`text-xs px-4 py-2 rounded-full border font-label font-bold uppercase tracking-widest transition-colors ${dataAgenda.disponivel ? 'bg-primary/10 text-primary hover:bg-error/10 hover:text-error' : 'bg-error/10 text-error hover:bg-primary/10 hover:text-primary'}`}>
                    {dataAgenda.disponivel ? 'Disponível' : 'Bloqueada'}
                  </button>
                  <button onClick={() => aoExcluir(dataAgenda.idagenda)} disabled={dataAgenda.total_ativos > 0}
                    className="p-2.5 rounded-xl border border-white/10 text-on-surface-variant hover:border-error/30 hover:bg-error/10 hover:text-error transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-white/10 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                    title={dataAgenda.total_ativos > 0 ? 'Não é possível remover uma data com agendamentos ativos' : 'Remover data preservando o histórico cancelado'} aria-label="Remover data da agenda">
                    <BrandIcon name="trash" size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

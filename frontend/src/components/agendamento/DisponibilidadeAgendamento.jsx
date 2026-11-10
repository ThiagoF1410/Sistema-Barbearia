import BrandIcon from '../ui/BrandIcon'

const semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function CalendarioAgendamento({
  visivel,
  carregando,
  carregandoHorarios,
  dias,
  espacosIniciais,
  selecionado,
  tituloMes,
  aoMudarMes,
  aoEscolherData,
}) {
  return (
    <section hidden={!visivel} aria-busy={carregando} className="glass-panel rounded-3xl border border-primary/15 p-4 sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-white/[0.07] pb-5">
        <button type="button" onClick={() => aoMudarMes(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" aria-label="Mês anterior">
          <BrandIcon name="back" />
        </button>
        <div className="text-center"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Escolha uma data</p><h3 className="mt-1 font-headline text-xl capitalize sm:text-2xl">{tituloMes}</h3></div>
        <button type="button" onClick={() => aoMudarMes(1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" aria-label="Próximo mês">
          <BrandIcon name="next" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
        {semana.map((dia) => <div key={dia} className="text-center text-[10px] sm:text-xs uppercase tracking-wider text-white/40 py-2">{dia}</div>)}
      </div>

      {carregando ? (
        <div role="status" className="h-72 flex items-center justify-center text-on-surface-variant"><span className="w-4 h-4 rounded-full border-2 border-primary/25 border-t-primary animate-spin mr-2" aria-hidden="true" />Carregando</div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: espacosIniciais }).map((_, index) => <div key={`vazio-${index}`} />)}
          {dias.map((dia) => {
            const ativo = selecionado?.data === dia.data
            const dataPorExtenso = new Date(`${dia.data}T12:00:00`).toLocaleDateString('pt-BR', {
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
            })
            const rotuloData = `${dataPorExtenso}. ${dia.disponivel ? 'Disponível' : 'Indisponível'}${dia.feriado ? `. Feriado: ${dia.feriado.nome}` : ''}${dia.motivo ? `. ${dia.motivo}` : ''}`
            return (
              <button
                key={dia.data}
                type="button"
                disabled={!dia.disponivel || carregandoHorarios}
                onClick={() => aoEscolherData(dia)}
                title={dia.feriado ? `${dia.feriado.nome} — ${dia.motivo}` : dia.motivo}
                aria-label={rotuloData}
                className={`relative min-h-16 sm:min-h-20 rounded-xl border p-1.5 sm:p-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                  dia.disponivel
                    ? `bg-emerald-500/15 border-emerald-400/35 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-300 ${ativo ? 'ring-2 ring-primary border-primary' : ''}`
                    : 'bg-red-500/12 border-red-400/25 text-red-300/70 cursor-not-allowed'
                }`}
              >
                <span className="text-sm sm:text-base font-bold">{Number(dia.data.slice(-2))}</span>
                {dia.feriado && <BrandIcon name="holiday" size={16} className="absolute top-1.5 right-1.5" label={dia.feriado.nome} />}
                <span className="hidden sm:block text-[9px] leading-tight mt-2 line-clamp-2 opacity-75">{dia.feriado?.nome || dia.motivo}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-4 mt-6 pt-5 border-t border-white/5 text-xs text-on-surface-variant">
        <span className="flex items-center gap-2"><i className="w-3 h-3 rounded-full bg-emerald-500" />Disponível</span>
        <span className="flex items-center gap-2"><i className="w-3 h-3 rounded-full bg-red-500" />Indisponível</span>
        <span className="flex items-center gap-2"><BrandIcon name="holiday" size={18} className="text-primary" />Feriado</span>
      </div>
    </section>
  )
}

export function HorariosAgendamento({
  visivel,
  selecionado,
  carregando,
  resultado,
  horarioSelecionado,
  aoEscolherHorario,
}) {
  return (
    <aside hidden={!visivel} className="glass-panel h-fit w-full rounded-3xl border border-primary/15 p-5 sm:p-7">
      <div className="flex items-center gap-3 border-b border-white/[0.07] pb-5"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="clock" size={23} /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Horários disponíveis</p><h3 className="mt-1 font-headline text-xl sm:text-2xl">Escolha o melhor momento</h3></div></div>
      {selecionado ? (
        <div className="mt-5 space-y-4">
          <p className="text-lg capitalize text-on-surface">{new Date(`${selecionado.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
          {selecionado.feriado && <div className="rounded-xl bg-primary/10 border border-primary/20 p-3"><p className="text-xs uppercase tracking-wider text-primary">Feriado</p><p className="text-sm mt-1">{selecionado.feriado.nome}</p></div>}
          {carregando ? (
            <div className="flex items-center text-sm text-on-surface-variant"><span className="w-4 h-4 rounded-full border-2 border-primary/25 border-t-primary animate-spin mr-2" aria-hidden="true" />Calculando horários</div>
          ) : resultado?.horarios?.length ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {resultado.horarios.map((horario) => {
                  const ativo = horarioSelecionado?.inicio === horario.inicio
                  return (
                    <button key={horario.inicio} type="button" onClick={() => aoEscolherHorario(horario)} aria-pressed={ativo}
                      className={`min-h-13 rounded-xl border px-3 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${ativo ? 'border-primary bg-primary text-on-primary shadow-lg shadow-primary/10' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-300 hover:bg-emerald-500/15'}`}>
                      {horario.inicio}<span className="block text-[9px] opacity-70">até {horario.fim}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-on-surface-variant">Os horários são consecutivos conforme a duração do serviço.</p>
              {horarioSelecionado && <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm"><strong>Selecionado:</strong> {horarioSelecionado.inicio}—{horarioSelecionado.fim}</div>}
            </>
          ) : (
            <p className="text-xs text-on-surface-variant">{resultado?.motivo || 'Calculando disponibilidade...'}</p>
          )}
        </div>
      ) : <p className="text-sm text-on-surface-variant mt-4">Primeiro escolha um serviço, um profissional e um dia verde.</p>}
    </aside>
  )
}

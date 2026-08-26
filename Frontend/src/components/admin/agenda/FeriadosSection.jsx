import BrandIcon from '../../ui/BrandIcon'

export default function FeriadosSection({ feriados, ano, importando, aoAlterarAno, aoImportar, aoAlterar, aoSalvar }) {
  return (
    <section id="painel-feriados" role="tabpanel" aria-labelledby="aba-feriados" className="glass-panel rounded-2xl p-4 sm:p-6 border border-outline-variant/10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline text-xl">Feriados</h2>
          <p className="text-xs text-on-surface-variant mt-1">Importe feriados nacionais e decida se a barbearia abrirá.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="number" min="2000" max="2100" value={ano} onChange={(event) => aoAlterarAno(Number(event.target.value))}
            className="w-24 bg-surface border border-outline-variant rounded-xl px-3 py-2 text-sm" aria-label="Ano dos feriados" />
          <button type="button" onClick={aoImportar} disabled={importando}
            className="px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-wider disabled:opacity-50">
            {importando ? 'Importando...' : 'Importar BrasilAPI'}
          </button>
        </div>
      </div>

      {feriados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant/30 p-7 text-center">
          <BrandIcon name="holiday" size={34} className="text-on-surface-variant mx-auto" />
          <p className="text-sm text-on-surface-variant mt-2">Nenhum feriado importado para {ano}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feriados.map((feriado) => {
            const especial = feriado.modo_funcionamento === 'horario_especial'
            return (
              <div key={feriado.idferiado} className="rounded-xl bg-surface/70 border border-outline-variant/20 p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-label text-sm font-semibold">{feriado.nome}</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {new Date(`${feriado.data}T12:00:00`).toLocaleDateString('pt-BR')} · {feriado.origem === 'api' ? 'BrasilAPI' : 'Manual'}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <select value={feriado.modo_funcionamento} onChange={(event) => aoAlterar(feriado.idferiado, 'modo_funcionamento', event.target.value)}
                      className="bg-surface border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface">
                      <option value="fechado">Fechado</option>
                      <option value="horario_normal">Aberto — horário normal</option>
                      <option value="horario_especial">Aberto — horário especial</option>
                      <option value="ignorar">Ignorar feriado</option>
                    </select>

                    {especial && (
                      <div className="flex items-center gap-2">
                        <input type="time" value={feriado.hora_abertura || ''} onChange={(event) => aoAlterar(feriado.idferiado, 'hora_abertura', event.target.value)} className="w-28 bg-surface border border-outline-variant rounded-lg px-2 py-2 text-xs" aria-label="Abertura especial" />
                        <span className="text-xs text-on-surface-variant">até</span>
                        <input type="time" value={feriado.hora_fechamento || ''} onChange={(event) => aoAlterar(feriado.idferiado, 'hora_fechamento', event.target.value)} className="w-28 bg-surface border border-outline-variant rounded-lg px-2 py-2 text-xs" aria-label="Fechamento especial" />
                      </div>
                    )}

                    <button type="button" onClick={() => aoSalvar(feriado)} className="px-4 py-2 border border-primary/40 text-primary rounded-full text-xs font-bold uppercase tracking-wider hover:bg-primary/10">
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

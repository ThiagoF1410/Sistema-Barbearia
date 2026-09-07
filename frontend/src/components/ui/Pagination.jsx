export default function Pagination({ dados, onChange, disabled = false }) {
  if (!dados || dados.totalPaginas <= 1) return null
  return (
    <nav className="mt-7 flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-surface-container-low px-4 py-3 sm:flex-row" aria-label="Paginação dos resultados">
      <p className="text-xs text-on-surface-variant">Página {dados.pagina} de {dados.totalPaginas} · {dados.total} registros</p>
      <div className="flex gap-2">
        <button type="button" disabled={disabled || !dados.temAnterior} onClick={() => onChange(dados.pagina - 1)} className="min-h-10 rounded-full border border-white/10 px-4 text-xs font-bold text-on-surface-variant hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35">Anterior</button>
        <button type="button" disabled={disabled || !dados.temProxima} onClick={() => onChange(dados.pagina + 1)} className="min-h-10 rounded-full border border-primary/35 px-4 text-xs font-bold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35">Próxima</button>
      </div>
    </nav>
  )
}

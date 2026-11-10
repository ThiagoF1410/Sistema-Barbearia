import BrandIcon from '../ui/BrandIcon'
import BrandedDatePicker from '../ui/BrandedDatePicker'

const STATUS_SOLICITACAO = {
  PENDENTE: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  APROVADA: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  RECUSADA: 'border-red-400/30 bg-red-500/10 text-red-200',
  CANCELADA: 'border-white/15 bg-white/5 text-on-surface-variant',
}

const DETALHES_SOLICITACAO = {
  PENDENTE: { faixa: 'bg-amber-400', icone: 'clock', texto: 'Aguardando análise da administração.' },
  APROVADA: { faixa: 'bg-emerald-400', icone: 'check', texto: 'Aprovada e incluída na sua agenda.' },
  RECUSADA: { faixa: 'bg-red-400', icone: 'alert', texto: 'Solicitação não aprovada pela administração.' },
  CANCELADA: { faixa: 'bg-white/25', icone: 'close', texto: 'Solicitação cancelada.' },
}

function Badge({ children, className = '' }) {
  return <span className={`inline-flex rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${className}`}>{children}</span>
}

function formatarDataCurta(data) {
  if (!data) return 'Data não informada'
  return new Date(`${data}T12:00:00`)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '')
}

function quantidadeDias(inicio, fim) {
  if (!inicio || !fim) return null
  const dataInicio = new Date(`${inicio}T12:00:00`)
  const dataFim = new Date(`${fim}T12:00:00`)
  const diferenca = Math.round((dataFim - dataInicio) / 86400000) + 1
  return diferenca > 0 ? diferenca : null
}

function EstadoVazio({ titulo, descricao }) {
  return <div className="glass-panel rounded-3xl border border-white/10 px-5 py-10 text-center sm:py-12">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="calendar" size={28} /></div>
    <h3 className="mt-5 font-headline text-xl">{titulo}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-on-surface-variant">{descricao}</p>
  </div>
}

function CardSolicitacao({ item, aoCancelar, desabilitado }) {
  const status = String(item.status || 'PENDENTE').toUpperCase()
  const detalhe = DETALHES_SOLICITACAO[status] || DETALHES_SOLICITACAO.PENDENTE
  const dias = quantidadeDias(item.datainicio, item.datafim)

  return <article className="glass-panel relative overflow-hidden rounded-2xl border border-white/10 p-5 transition-colors hover:border-primary/25 sm:p-6">
    <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${detalhe.faixa}`} />
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name={detalhe.icone} size={21} /></div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-primary/25 bg-primary/10 text-primary">{item.tipo}</Badge>
            <Badge className={STATUS_SOLICITACAO[status] || STATUS_SOLICITACAO.CANCELADA}>{status}</Badge>
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">{detalhe.texto}</p>
        </div>
      </div>
      {status === 'PENDENTE' && <button type="button" onClick={() => aoCancelar(item)} disabled={desabilitado} className="min-h-10 shrink-0 rounded-full border border-error/25 px-4 text-[10px] font-bold uppercase tracking-wider text-error transition-colors hover:bg-error/10 disabled:opacity-40">Cancelar</button>}
    </div>
    <div className="mt-5 grid gap-3 rounded-2xl border border-white/[0.08] bg-black/15 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Período solicitado</p><p className="mt-1.5 font-headline text-xl capitalize">{formatarDataCurta(item.datainicio)} até {formatarDataCurta(item.datafim)}</p></div>
      {dias && <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-on-surface-variant">{dias} {dias === 1 ? 'dia' : 'dias'}</span>}
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5"><p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Motivo</p><p className="mt-1.5 text-sm leading-relaxed">{item.motivo || 'Nenhuma observação informada.'}</p></div>
      {item.resposta_administrador && <div className="rounded-xl border border-primary/15 bg-primary/[0.06] p-3.5"><p className="text-[9px] font-bold uppercase tracking-wider text-primary">Resposta da administração</p><p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">{item.resposta_administrador}</p></div>}
    </div>
  </article>
}

function CardAusencia({ item }) {
  const dias = quantidadeDias(item.datainicio, item.datafim)
  return <article className="glass-panel relative overflow-hidden rounded-2xl border border-emerald-400/15 p-5 sm:p-6">
    <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-emerald-400" />
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3.5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"><BrandIcon name="check" size={21} /></div><div><Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200">{item.tipo}</Badge><p className="mt-2 text-xs text-emerald-200/80">Período confirmado e bloqueado na agenda.</p></div></div>
      {dias && <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-on-surface-variant">{dias} {dias === 1 ? 'dia' : 'dias'}</span>}
    </div>
    <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/15 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300">Período indisponível</p><p className="mt-1.5 font-headline text-xl capitalize">{formatarDataCurta(item.datainicio)} até {formatarDataCurta(item.datafim)}</p>{item.descricao && <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{item.descricao}</p>}</div>
  </article>
}

export function FormularioSolicitacaoProfissional({
  solicitacao,
  aoAlterar,
  aoEnviar,
  hoje,
  salvando,
  bloqueado,
  titulo = 'Nova solicitação',
  descricao = 'Informe o período e o motivo para análise administrativa.',
}) {
  const alterar = (campo, valor) => aoAlterar((atual) => ({ ...atual, [campo]: valor }))

  return <section className="glass-panel rounded-3xl border border-white/10 p-4 sm:p-6">
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="calendar" size={23} /></div>
      <div><h3 className="font-headline text-xl">{titulo}</h3><p className="mt-1 text-xs text-on-surface-variant">{descricao}</p></div>
    </div>
    <form onSubmit={aoEnviar} className="mt-5">
      <fieldset disabled={salvando || bloqueado} className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-on-surface-variant"><span className="mb-2 block">Tipo</span><select value={solicitacao.tipo} onChange={(event) => alterar('tipo', event.target.value)} className="input-heritage py-3"><option value="FOLGA">Folga</option><option value="FERIAS">Férias</option></select></label>
        <div className="text-xs text-on-surface-variant"><span className="mb-2 block">Data inicial</span><BrandedDatePicker id="solicitacao-profissional-inicio" value={solicitacao.datainicio} min={hoje} onChange={(valor) => aoAlterar((atual) => ({ ...atual, datainicio: valor, datafim: !atual.datafim || atual.datafim < valor ? valor : atual.datafim }))} /></div>
        <div className="text-xs text-on-surface-variant"><span className="mb-2 block">Data final</span><BrandedDatePicker id="solicitacao-profissional-fim" value={solicitacao.datafim} min={solicitacao.datainicio || hoje} onChange={(valor) => alterar('datafim', valor)} /></div>
        <label className="text-xs text-on-surface-variant"><span className="mb-2 block">Motivo ou observação</span><input value={solicitacao.motivo} maxLength="255" onChange={(event) => alterar('motivo', event.target.value)} placeholder="Ex.: compromisso pessoal" className="input-heritage py-3" /></label>
        <button type="submit" disabled={!solicitacao.datainicio || !solicitacao.datafim || salvando} className="min-h-11 rounded-full bg-primary px-6 text-xs font-bold uppercase tracking-wider text-on-primary disabled:opacity-50 sm:col-span-2 sm:justify-self-start">{salvando ? 'Enviando...' : 'Enviar solicitação'}</button>
      </fieldset>
    </form>
  </section>
}

export function SecaoSolicitacoesProfissional({ solicitacoes, aoCancelar, desabilitado }) {
  return <section className="space-y-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Acompanhamento</p><h3 className="mt-2 font-headline text-2xl">Minhas solicitações</h3><p className="mt-1.5 text-xs text-on-surface-variant">Acompanhe a análise e as respostas da administração.</p></div>
      <span className="w-fit rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">{solicitacoes.length} {solicitacoes.length === 1 ? 'registro' : 'registros'}</span>
    </div>
    {solicitacoes.length
      ? <div className="grid gap-4 xl:grid-cols-2">{solicitacoes.map((item) => <CardSolicitacao key={item.idsolicitacao} item={item} aoCancelar={aoCancelar} desabilitado={desabilitado} />)}</div>
      : <EstadoVazio titulo="Nenhuma solicitação enviada" descricao="Use o formulário acima quando precisar solicitar uma folga ou um período de férias." />}
  </section>
}

export function SecaoAusenciasProfissional({ ausencias }) {
  return <section className="space-y-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Aprovadas pela administração</p><h3 className="mt-2 font-headline text-2xl">Indisponibilidades confirmadas</h3><p className="mt-1.5 text-xs text-on-surface-variant">Períodos já aprovados e bloqueados na sua agenda.</p></div>
      <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">{ausencias.length} {ausencias.length === 1 ? 'registro' : 'registros'}</span>
    </div>
    {ausencias.length
      ? <div className="grid gap-4 xl:grid-cols-2">{ausencias.map((item) => <CardAusencia key={item.iddisponibilidade} item={item} />)}</div>
      : <div className="glass-panel rounded-3xl border border-white/10 p-8 text-center"><BrandIcon name="check" size={30} className="mx-auto text-emerald-300" /><p className="mt-4 font-headline text-lg">Nenhuma indisponibilidade confirmada</p><p className="mt-2 text-sm text-on-surface-variant">Sua agenda segue o expediente definido pela administração.</p></div>}
  </section>
}

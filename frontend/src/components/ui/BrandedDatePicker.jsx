import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import BrandIcon from './BrandIcon'

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const formatadorMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const formatadorData = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

function paraIso(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function paraData(valor) {
  if (!valor) return null
  const data = new Date(`${String(valor).slice(0, 10)}T12:00:00`)
  return Number.isNaN(data.getTime()) ? null : data
}

function inicioDoMes(data) {
  return new Date(data.getFullYear(), data.getMonth(), 1, 12)
}

function montarDias(mesVisivel) {
  const inicio = inicioDoMes(mesVisivel)
  const primeiro = new Date(inicio)
  primeiro.setDate(1 - inicio.getDay())
  return Array.from({ length: 42 }, (_, indice) => {
    const data = new Date(primeiro)
    data.setDate(primeiro.getDate() + indice)
    return data
  })
}

export default function BrandedDatePicker({ value, onChange, min, datas = [], feriados = [], onMonthChange, id = 'data-agenda', className = '', allowClear = true, permitirDiasLiberados = false }) {
  const hoje = useMemo(() => {
    const agora = new Date()
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12)
  }, [])
  const referenciaInicial = paraData(value) || paraData(min) || hoje
  const [aberto, setAberto] = useState(false)
  const [rascunho, setRascunho] = useState(value || '')
  const [mesVisivel, setMesVisivel] = useState(() => inicioDoMes(referenciaInicial))
  const tituloRef = useRef(null)

  const datasCadastradas = useMemo(() => new Map(datas.map((item) => [String(item.data).slice(0, 10), item])), [datas])
  const feriadosMap = useMemo(() => new Map(feriados.map((item) => [String(item.data).slice(0, 10), item])), [feriados])
  const dias = useMemo(() => montarDias(mesVisivel), [mesVisivel])
  const dataMinima = useMemo(() => paraData(min), [min])

  useEffect(() => {
    if (!aberto) return undefined
    const overflowAnterior = document.body.style.overflow
    function fechar(event) {
      if (event.key === 'Escape') setAberto(false)
    }
    document.addEventListener('keydown', fechar)
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => tituloRef.current?.focus())
    return () => {
      document.removeEventListener('keydown', fechar)
      document.body.style.overflow = overflowAnterior
    }
  }, [aberto])

  useEffect(() => {
    if (aberto) onMonthChange?.(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1)
  }, [aberto, mesVisivel, onMonthChange])

  function abrir() {
    const referencia = paraData(value) || paraData(min) || hoje
    setRascunho(value || '')
    setMesVisivel(inicioDoMes(referencia))
    setAberto(true)
  }

  function alterarMes(deslocamento) {
    setMesVisivel((atual) => new Date(atual.getFullYear(), atual.getMonth() + deslocamento, 1, 12))
  }

  function confirmar() {
    if (!rascunho) return
    onChange(rascunho)
    setAberto(false)
  }

  const anteriorBloqueado = dataMinima && new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() - 1, 1, 12) < inicioDoMes(dataMinima)
  const valorFormatado = paraData(value)?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className={`relative w-full ${className}`}>
      <button id={id} type="button" onClick={abrir} aria-haspopup="dialog" aria-expanded={aberto} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface px-4 py-3 text-left text-sm text-on-surface transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
        <span className={valorFormatado ? 'capitalize' : 'text-on-surface-variant'}>{valorFormatado || 'Selecionar uma data'}</span>
        <BrandIcon name="calendar" size={19} className="shrink-0 text-primary" />
      </button>

      {aberto && createPortal(<>
        <button type="button" aria-label="Fechar calendário" onClick={() => setAberto(false)} className="fixed inset-0 z-[80] bg-black/80" />
        <section role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`} className="fixed inset-x-3 bottom-3 z-[90] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border border-primary/35 bg-[#111] p-4 shadow-2xl shadow-black sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[390px] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-5">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Escolher data</p><h3 id={`${id}-titulo`} ref={tituloRef} tabIndex="-1" className="mt-1 font-headline text-xl capitalize outline-none">{formatadorMes.format(mesVisivel)}</h3></div>
            <div className="flex gap-2"><button type="button" onClick={() => alterarMes(-1)} disabled={anteriorBloqueado} aria-label="Mês anterior" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-on-surface-variant hover:border-primary/35 hover:text-primary disabled:opacity-25"><BrandIcon name="back" size={18} /></button><button type="button" onClick={() => alterarMes(1)} aria-label="Próximo mês" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-on-surface-variant hover:border-primary/35 hover:text-primary"><BrandIcon name="next" size={18} /></button><button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant hover:bg-white/5 hover:text-primary"><BrandIcon name="close" size={18} /></button></div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1" aria-hidden="true">{DIAS_SEMANA.map((dia, indice) => <span key={`${dia}-${indice}`} className="py-2 text-center text-xs font-bold uppercase text-on-surface-variant">{dia}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">{dias.map((data) => {
            const iso = paraIso(data)
            const outroMes = data.getMonth() !== mesVisivel.getMonth()
            const passado = dataMinima && data < dataMinima
            const cadastrada = datasCadastradas.get(iso)
            const feriado = feriadosMap.get(iso)
            const selecionada = rascunho === iso
            const atual = paraIso(data) === paraIso(hoje)
            const liberada = Boolean(cadastrada?.disponivel)
            const bloqueada = Boolean(cadastrada && !cadastrada.disponivel)
            const feriadoFechado = feriado?.modo_funcionamento === 'fechado'
            const indisponivel = passado || bloqueada || feriadoFechado || (liberada && !permitirDiasLiberados)
            let estado = 'text-on-surface hover:bg-white/[0.07] hover:text-primary'
            if (outroMes) estado = 'text-white/25'
            if (feriado) estado = 'border border-primary/35 bg-primary/10 text-primary'
            if (liberada) estado = 'border border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
            if (bloqueada || feriadoFechado) estado = 'border border-red-400/35 bg-red-500/10 text-red-200'
            if (selecionada) estado = 'border border-primary bg-primary text-on-primary shadow-lg shadow-primary/15'
            const descricaoStatus = [feriado && `feriado: ${feriado.nome}`, bloqueada && 'data bloqueada', feriadoFechado && 'barbearia fechada', liberada && 'data liberada'].filter(Boolean).join(', ')
            return <button key={iso} type="button" disabled={indisponivel} onClick={() => setRascunho(iso)} aria-label={`${formatadorData.format(data)}${descricaoStatus ? `, ${descricaoStatus}` : ''}`} aria-pressed={selecionada} title={descricaoStatus || undefined} className={`relative aspect-square rounded-xl text-xs font-semibold transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed ${estado} ${passado ? 'opacity-20' : ''} ${atual && !selecionada ? 'ring-1 ring-primary/60' : ''}`}><span>{data.getDate()}</span>{feriado && <BrandIcon name="holiday" size={12} className={`absolute bottom-1 left-1/2 -translate-x-1/2 ${selecionada ? 'text-on-primary' : 'text-primary'}`} />}{(bloqueada || feriadoFechado) && <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-300 ring-1 ring-background" />}</button>
          })}</div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/[0.08] pt-4 text-xs text-on-surface-variant"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-400" />Liberada</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-400" />Bloqueada</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" />Feriado</span></div>
          <div className="mt-4 flex items-center justify-between gap-3"><button type="button" onClick={() => { setRascunho(paraIso(hoje)); setMesVisivel(inicioDoMes(hoje)) }} disabled={Boolean(dataMinima && hoje < dataMinima) || datasCadastradas.has(paraIso(hoje))} className="px-2 py-2 text-xs font-bold text-primary disabled:opacity-30">Hoje</button><div className="flex gap-2">{allowClear && <button type="button" onClick={() => { onChange(''); setRascunho(''); setAberto(false) }} className="rounded-full border border-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Limpar</button>}<button type="button" onClick={confirmar} disabled={!rascunho} className="rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary disabled:opacity-35">Confirmar</button></div></div>
        </section>
      </>, document.body)}
    </div>
  )
}

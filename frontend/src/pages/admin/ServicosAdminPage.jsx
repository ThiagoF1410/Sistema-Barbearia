import { useEffect, useRef, useState } from 'react'
import { atualizarServico, criarServico, deletarServico, listarServicos } from '../../services/servicosService'
import AdminLayout from '../../components/admin/AdminLayout'
import BrandIcon from '../../components/ui/BrandIcon'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import useFeedbackFocus from '../../hooks/useFeedbackFocus'

function formularioVazio(tipo = 'servico') {
  return { nome: '', tipo, duracao: tipo === 'produto' ? 1 : 30, preco: '', descricao: '' }
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function SkeletonCatalogo() {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando catálogo">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />)}</div>
}

export default function ServicosAdminPage() {
  const [servicos, setServicos] = useState([])
  const [form, setForm] = useState(() => formularioVazio())
  const [editandoId, setEditandoId] = useState(null)
  const [erro, setErro] = useState('')
  const erroRef = useFeedbackFocus(erro)
  const [sucesso, setSucesso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [itemParaRemover, setItemParaRemover] = useState(null)
  const [removendo, setRemovendo] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('servico')
  const formularioRef = useRef(null)
  const nomeInputRef = useRef(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      setErro('')
      const dados = await listarServicos()
      setServicos(dados)
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível carregar o catálogo. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  function alterarCampo(event) {
    const { name, value } = event.target
    setForm((atual) => ({ ...atual, [name]: value }))
  }

  function selecionarAba(tipo) {
    if (salvando) return
    setFiltroTipo(tipo)
    setEditandoId(null)
    setForm(formularioVazio(tipo))
    setBusca('')
    setErro('')
    setSucesso('')
  }

  function focarFormulario() {
    setEditandoId(null)
    setForm(formularioVazio(filtroTipo))
    setErro('')
    setSucesso('')
    requestAnimationFrame(() => {
      formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      nomeInputRef.current?.focus({ preventScroll: true })
    })
  }

  function iniciarEdicao(item) {
    setFiltroTipo(item.tipo)
    setEditandoId(item.idservico)
    setForm({ nome: item.nome, tipo: item.tipo, duracao: item.duracao, preco: item.preco, descricao: item.descricao || '' })
    setErro('')
    setSucesso('')
    requestAnimationFrame(() => {
      formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      nomeInputRef.current?.focus({ preventScroll: true })
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm(formularioVazio(filtroTipo))
    setErro('')
  }

  async function salvar(event) {
    event.preventDefault()
    setErro('')
    setSucesso('')
    setSalvando(true)
    const payload = {
      ...form,
      duracao: form.tipo === 'produto' ? 1 : Number(form.duracao),
      preco: Number(form.preco),
    }
    try {
      if (editandoId) {
        await atualizarServico(editandoId, payload)
        setSucesso(`${form.tipo === 'produto' ? 'Produto' : 'Serviço'} atualizado com sucesso.`)
      } else {
        await criarServico(payload)
        setSucesso(`${form.tipo === 'produto' ? 'Produto' : 'Serviço'} cadastrado com sucesso.`)
      }
      setEditandoId(null)
      setForm(formularioVazio(filtroTipo))
      await carregar()
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível salvar o item. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  function solicitarRemocao(item) {
    setItemParaRemover(item)
  }

  async function confirmarRemocao() {
    if (!itemParaRemover) return
    const item = itemParaRemover
    const categoria = item.tipo === 'produto' ? 'produto' : 'serviço'
    setErro('')
    setSucesso('')
    setRemovendo(true)
    try {
      await deletarServico(item.idservico)
      setSucesso(`${categoria === 'produto' ? 'Produto' : 'Serviço'} removido com sucesso.`)
      if (editandoId === item.idservico) cancelarEdicao()
      setItemParaRemover(null)
      await carregar()
    } catch (err) {
      setErro(err.response?.data?.message || `Não foi possível remover o ${categoria}. Tente novamente.`)
    } finally {
      setRemovendo(false)
    }
  }

  const totalServicos = servicos.filter((item) => item.tipo === 'servico').length
  const totalProdutos = servicos.filter((item) => item.tipo === 'produto').length
  const servicosAgendaveis = servicos.filter((item) => item.tipo === 'servico')
  const duracaoMedia = servicosAgendaveis.length
    ? Math.round(servicosAgendaveis.reduce((total, item) => total + Number(item.duracao || 0), 0) / servicosAgendaveis.length)
    : 0
  const precoMedio = servicos.length
    ? servicos.reduce((total, item) => total + Number(item.preco || 0), 0) / servicos.length
    : 0
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const catalogoFiltrado = servicos.filter((item) => {
    const tipoCorreto = item.tipo === filtroTipo
    const texto = `${item.nome} ${item.descricao || ''}`.toLocaleLowerCase('pt-BR')
    return tipoCorreto && (!termo || texto.includes(termo))
  })
  const abaProduto = filtroTipo === 'produto'
  const nomeCategoria = abaProduto ? 'Produtos' : 'Serviços'
  const nomeCategoriaSingular = abaProduto ? 'produto' : 'serviço'
  const resumo = [
    { icon: 'razor', valor: totalServicos, rotulo: 'Serviços', detalhe: 'Disponíveis para agendamento' },
    { icon: 'bottle', valor: totalProdutos, rotulo: 'Produtos', detalhe: 'Itens do catálogo' },
    { icon: 'clock', valor: `${duracaoMedia} min`, rotulo: 'Duração média', detalhe: 'Dos serviços cadastrados' },
    { icon: 'chart', valor: moeda(precoMedio), rotulo: 'Preço médio', detalhe: 'De todo o catálogo' },
  ]

  return (
    <AdminLayout titulo="Serviços" subtitulo="Catálogo e preços">
      <main className="mx-auto max-w-[1480px] space-y-8 px-4 py-7 sm:px-6 sm:py-9">
        <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Catálogo</p><h1 className="mt-2 font-headline text-3xl sm:text-4xl">Serviços e produtos</h1><p className="mt-2 max-w-2xl text-sm text-on-surface-variant">Mantenha preços, duração dos atendimentos e produtos oferecidos pela barbearia.</p></div>
          <button type="button" onClick={focarFormulario} className="inline-flex self-start items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container xl:self-auto"><span className="text-lg leading-none">+</span>Novo {nomeCategoriaSingular}</button>
        </section>

        <section aria-label="Resumo do catálogo" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{resumo.map((item) => <div key={item.rotulo} className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name={item.icon} size={21} /></div><span className="break-words text-right font-headline text-xl text-primary sm:text-2xl">{carregando ? '—' : item.valor}</span></div><p className="mt-4 text-xs font-bold">{item.rotulo}</p><p className="mt-1 text-[10px] text-on-surface-variant">{item.detalhe}</p></div>)}</section>

        <nav aria-label="Categorias do catálogo" className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-surface-container-low p-1.5 sm:max-w-xl">
          {[
            { id: 'servico', titulo: 'Serviços', detalhe: 'Agenda e duração', icon: 'razor', total: totalServicos },
            { id: 'produto', titulo: 'Produtos', detalhe: 'Loja e preços', icon: 'bottle', total: totalProdutos },
          ].map((item) => {
            const ativo = filtroTipo === item.id
            return <button key={item.id} type="button" onClick={() => selecionarAba(item.id)} aria-pressed={ativo} className={`flex min-h-16 min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:px-4 ${ativo ? 'border-primary/45 bg-primary/10 text-primary' : 'border-transparent text-on-surface-variant hover:border-white/10 hover:bg-white/[0.03] hover:text-on-surface'}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${ativo ? 'border-primary/25 bg-primary/10' : 'border-white/10 bg-black/10'}`}><BrandIcon name={item.icon} size={20} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs uppercase tracking-wider">{item.titulo}</strong><small className="mt-1 hidden text-[10px] font-normal opacity-70 sm:block">{item.detalhe}</small></span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${ativo ? 'bg-primary text-on-primary' : 'bg-white/[0.06]'}`}>{item.total}</span></button>
          })}
        </nav>

        {erro && <div ref={erroRef} role="alert" className="flex items-center gap-3 rounded-2xl border border-error/25 bg-error/10 px-4 py-4 text-sm text-error"><BrandIcon name="alert" size={20} className="shrink-0" />{erro}</div>}
        {sucesso && <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200"><BrandIcon name="check" size={20} className="shrink-0" />{sucesso}</div>}

        <section ref={formularioRef} className={`glass-panel scroll-mt-24 rounded-3xl border p-4 sm:p-6 ${editandoId ? 'border-primary/35' : 'border-white/10'}`}>
          <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name={form.tipo === 'produto' ? 'bottle' : 'razor'} size={25} /></div><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">{editandoId ? `Editando ${nomeCategoriaSingular} #${editandoId}` : `Novo ${nomeCategoriaSingular}`}</p><h2 className="mt-1 font-headline text-2xl">{editandoId ? `Editar ${nomeCategoriaSingular}` : `Adicionar ${nomeCategoriaSingular}`}</h2></div></div>{editandoId && <button type="button" onClick={cancelarEdicao} className="self-start rounded-full border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:border-primary/30">Cancelar edição</button>}</div>

          <form onSubmit={salvar} className="mt-6 grid gap-5 lg:grid-cols-2">
            <label className="text-xs text-on-surface-variant"><span className="mb-2 block font-bold uppercase tracking-wider">Nome</span><input ref={nomeInputRef} name="nome" value={form.nome} onChange={alterarCampo} required maxLength="120" placeholder={form.tipo === 'produto' ? 'Ex.: Pomada modeladora' : 'Ex.: Corte degradê'} className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-white/25 focus:border-primary focus:outline-none" /></label>
            <label className="text-xs text-on-surface-variant"><span className="mb-2 block font-bold uppercase tracking-wider">Preço</span><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-primary">R$</span><input name="preco" type="number" min="0" step="0.01" value={form.preco} onChange={alterarCampo} required placeholder="0,00" className="w-full rounded-xl border border-outline-variant bg-surface py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-white/25 focus:border-primary focus:outline-none" /></div></label>
            {form.tipo === 'servico' ? <label className="text-xs text-on-surface-variant"><span className="mb-2 block font-bold uppercase tracking-wider">Duração do atendimento</span><div className="relative"><input name="duracao" type="number" min="1" max="480" value={form.duracao} onChange={alterarCampo} required className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 pr-20 text-sm text-on-surface focus:border-primary focus:outline-none" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">minutos</span></div></label> : <div className="rounded-xl border border-primary/15 bg-primary/[0.055] p-4 text-xs leading-relaxed text-on-surface-variant"><strong className="block text-primary">Produto sem duração</strong><span className="mt-1 block">Produtos aparecem no catálogo, mas não ocupam horários da agenda.</span></div>}
            <label className="text-xs text-on-surface-variant"><span className="mb-2 block font-bold uppercase tracking-wider">Descrição <span className="font-normal normal-case">(opcional)</span></span><input name="descricao" value={form.descricao} onChange={alterarCampo} maxLength="255" placeholder="Descreva os principais detalhes" className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-white/25 focus:border-primary focus:outline-none" /></label>
            <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between lg:col-span-2"><p className="text-[10px] text-on-surface-variant">Revise os dados antes de disponibilizar o item no catálogo.</p><button type="submit" disabled={salvando} className="w-full rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container disabled:opacity-50 sm:w-auto">{salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : `Cadastrar ${form.tipo === 'produto' ? 'produto' : 'serviço'}`}</button></div>
          </form>
        </section>

        <section aria-labelledby="catalogo-titulo" className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{nomeCategoria} cadastrados</p><h2 id="catalogo-titulo" className="mt-2 font-headline text-2xl sm:text-3xl">{nomeCategoria} do catálogo</h2><p className="mt-1 text-xs text-on-surface-variant">{catalogoFiltrado.length} {catalogoFiltrado.length === 1 ? `${nomeCategoriaSingular} encontrado` : `${nomeCategoria.toLocaleLowerCase('pt-BR')} encontrados`}</p></div><label className="relative w-full sm:w-80"><span className="sr-only">Pesquisar em {nomeCategoria.toLocaleLowerCase('pt-BR')}</span><BrandIcon name="search" size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" /><input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder={`Pesquisar ${nomeCategoria.toLocaleLowerCase('pt-BR')}`} className="w-full rounded-full border border-white/10 bg-surface py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-white/30 focus:border-primary focus:outline-none" /></label></div>

          {carregando ? <SkeletonCatalogo /> : catalogoFiltrado.length === 0 ? <div className="glass-panel rounded-2xl border border-white/10 p-10 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name={abaProduto ? 'bottle' : 'razor'} size={34} /></div><h3 className="mt-5 font-headline text-xl">Nenhum {nomeCategoriaSingular} encontrado</h3><p className="mt-2 text-sm text-on-surface-variant">Altere a pesquisa ou cadastre um novo {nomeCategoriaSingular}.</p><button type="button" onClick={focarFormulario} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary">Cadastrar {nomeCategoriaSingular}</button></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{catalogoFiltrado.map((item) => {
            const produto = item.tipo === 'produto'
            return <article key={item.idservico} className="group glass-panel flex min-h-56 flex-col rounded-2xl border border-white/10 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-black/20"><div className="flex items-start justify-between gap-4"><div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${produto ? 'border-amber-400/20 bg-amber-500/10 text-amber-200' : 'border-primary/20 bg-primary/10 text-primary'}`}><BrandIcon name={produto ? 'bottle' : 'razor'} size={24} /></div><span className={`rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-wider ${produto ? 'border-amber-400/20 bg-amber-500/10 text-amber-200' : 'border-primary/20 bg-primary/10 text-primary'}`}>{produto ? 'Produto' : 'Serviço'}</span></div><h3 className="mt-4 font-headline text-xl">{item.nome}</h3><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed text-on-surface-variant">{item.descricao || 'Nenhuma descrição informada.'}</p><div className="mt-4 flex items-end justify-between gap-3"><div>{!produto && <p className="text-[10px] text-on-surface-variant">{item.duracao} minutos</p>}<p className="mt-1 font-headline text-xl text-primary">{moeda(item.preco)}</p></div><div className="flex gap-2"><button type="button" onClick={() => iniciarEdicao(item)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-on-surface-variant hover:border-primary/35 hover:bg-primary/10 hover:text-primary" title="Editar" aria-label={`Editar ${item.nome}`}><BrandIcon name="edit" size={18} /></button><button type="button" onClick={() => solicitarRemocao(item)} disabled={removendo} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-on-surface-variant hover:border-error/35 hover:bg-error/10 hover:text-error disabled:opacity-50" title="Remover" aria-label={`Remover ${item.nome}`}><BrandIcon name="trash" size={18} /></button></div></div></article>
          })}</div>}
        </section>
      </main>
      <ConfirmDialog
        aberto={Boolean(itemParaRemover)}
        titulo={`Remover ${itemParaRemover?.tipo === 'produto' ? 'produto' : 'serviço'}?`}
        descricao={itemParaRemover
          ? `O item “${itemParaRemover.nome}” será removido do catálogo. Esta ação não poderá ser desfeita.`
          : ''}
        rotuloConfirmar="Remover item"
        rotuloProcessando="Removendo..."
        processando={removendo}
        aoConfirmar={confirmarRemocao}
        aoFechar={() => { if (!removendo) setItemParaRemover(null) }}
      />
    </AdminLayout>
  )
}

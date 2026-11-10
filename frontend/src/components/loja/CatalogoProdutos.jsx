import BrandIcon from '../ui/BrandIcon'
import { categoriaDoProduto, categoriasProdutos, dinheiro } from '../../utils/lojaUtils'

function CardProduto({ item, quantidade, aoAlterarQuantidade, aoAdicionar }) {
  const categoria = categoriasProdutos.find((opcao) => opcao.id === categoriaDoProduto(item))?.nome

  return <article className={`render-efficient brand-card glass-panel flex min-h-72 flex-col border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 ${quantidade ? 'border-primary/50 bg-primary/[0.05]' : 'border-white/10'}`}>
    <div className="flex items-start justify-between gap-3">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="bottle" size={24} /></span>
      <span className="rounded-full border border-white/[0.08] bg-black/15 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">{categoria}</span>
    </div>
    <h3 className="mt-5 font-headline text-xl">{item.nome}</h3>
    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-on-surface-variant">{item.descricao}</p>
    <div className="mt-auto pt-5">
      <p className="font-headline text-2xl text-primary">{dinheiro(item.preco)}</p>
      {quantidade ? <div className="mt-4 flex items-center justify-between rounded-full border border-primary/25 bg-primary/[0.035] p-1">
        <button type="button" onClick={() => aoAlterarQuantidade(item.idservico, -1)} className="h-10 w-10 rounded-full hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" aria-label={`Remover uma unidade de ${item.nome}`}>−</button>
        <span className="text-sm font-bold" aria-live="polite">{quantidade} na sacola</span>
        <button type="button" onClick={() => aoAdicionar(item)} className="h-10 w-10 rounded-full text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" aria-label={`Adicionar uma unidade de ${item.nome}`}>+</button>
      </div> : <button type="button" onClick={() => aoAdicionar(item)} className="mt-4 min-h-12 w-full rounded-full border border-primary/40 px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">Adicionar à sacola</button>}
    </div>
  </article>
}

export default function CatalogoProdutos({ carregando, produtos, carrinho, busca, aoMudarBusca, categoria, aoMudarCategoria, aoAlterarQuantidade, aoAdicionar, aoLimparFiltros }) {
  return <section id="painel-produtos" role="tabpanel" aria-labelledby="titulo-produtos" className="space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Catálogo</p><h2 id="titulo-produtos" className="mt-1 font-headline text-2xl sm:text-3xl">Produtos disponíveis</h2><p className="mt-2 text-xs text-on-surface-variant">Compra online com retirada diretamente na barbearia.</p></div>
      <label className="relative block w-full lg:max-w-sm"><span className="sr-only">Buscar produtos</span><BrandIcon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" /><input type="search" value={busca} onChange={(event) => aoMudarBusca(event.target.value)} placeholder="Buscar por nome ou descrição" className="min-h-12 w-full rounded-full border border-white/10 bg-surface-container-low py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20" /></label>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Categorias de produtos">{categoriasProdutos.map((item) => <button key={item.id} type="button" aria-pressed={categoria === item.id} onClick={() => aoMudarCategoria(item.id)} className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${categoria === item.id ? 'border-primary bg-primary text-on-primary' : 'border-white/10 text-on-surface-variant hover:border-primary/35 hover:text-primary'}`}>{item.nome}</button>)}</div>
    {carregando ? <div role="status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.025]" />)}<span className="sr-only">Carregando catálogo...</span></div>
      : produtos.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{produtos.map((item) => <CardProduto key={item.idservico} item={item} quantidade={carrinho[item.idservico] || 0} aoAlterarQuantidade={aoAlterarQuantidade} aoAdicionar={aoAdicionar} />)}</div>
        : <div className="rounded-3xl border border-dashed border-white/15 px-5 py-10 text-center"><BrandIcon name="search" size={30} className="mx-auto text-primary" /><h3 className="mt-4 font-headline text-xl">Nenhum produto encontrado</h3><p className="mt-2 text-sm text-on-surface-variant">Tente buscar outro termo ou escolher uma categoria diferente.</p><button type="button" onClick={aoLimparFiltros} className="mt-5 rounded-full border border-primary/35 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary">Limpar filtros</button></div>}
  </section>
}

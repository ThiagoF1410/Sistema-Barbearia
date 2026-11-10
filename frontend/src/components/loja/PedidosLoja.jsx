import BrandIcon from '../ui/BrandIcon'
import PagamentoCountdown from '../PagamentoCountdown'
import Pagination from '../ui/Pagination'
import { descricaoStatusPedido, dinheiro, filtrosPedidos, formatarDataPedido } from '../../utils/lojaUtils'

function quantidadeDoFiltro(filtro, resumo, pedidos) {
  if (resumo) {
    return filtro.status
      ? filtro.status.reduce((total, status) => total + Number(resumo.porStatus?.[status] || 0), 0)
      : Number(resumo.total || 0)
  }
  return filtro.status
    ? pedidos.filter((pedido) => filtro.status.includes(pedido.status)).length
    : pedidos.length
}

function classeDoStatus(status) {
  if (status === 'CONFIRMADO') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
  if (status === 'FALHOU' || status === 'CANCELADO') return 'border-error/30 bg-error/10 text-error'
  return 'border-amber-400/30 bg-amber-500/10 text-amber-200'
}

function CardPedido({ pedido, expandido, pagando, operacaoEmAndamento, aoExpandir, aoCancelar, aoPagar, aoExpirar }) {
  const confirmado = pedido.status === 'CONFIRMADO'
  const permiteAlteracao = ['PENDENTE', 'FALHOU'].includes(pedido.status)
  const permitePagamentoOnline = permiteAlteracao && pedido.metodo !== 'DINHEIRO'
  const quantidadeItens = pedido.itens.reduce((total, item) => total + Number(item.quantidade), 0)

  return <article className="render-efficient overflow-hidden rounded-3xl border border-white/10 bg-surface-container-low transition-colors hover:border-primary/20">
    <div className="p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="bag" size={21} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-headline text-xl">Pedido nº {pedido.idpedido}</h3><span className={`inline-flex rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-wider ${classeDoStatus(pedido.status)}`}>{pedido.status}</span></div><p className="mt-1 text-xs text-on-surface-variant">{descricaoStatusPedido[pedido.status] || pedido.status}</p></div></div>
        <div className="text-left sm:text-right"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Total do pedido</p><p className="mt-1 font-headline text-2xl text-primary">{dinheiro(pedido.total)}</p></div>
      </div>

      <dl className="mt-5 grid gap-3 rounded-2xl border border-white/[0.06] bg-black/15 p-4 text-xs sm:grid-cols-3">
        <div className="flex items-start gap-2.5"><BrandIcon name="calendar" size={17} className="mt-0.5 shrink-0 text-primary" /><div><dt className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Realizado em</dt><dd className="mt-1 text-on-surface">{formatarDataPedido(pedido.criado_em)}</dd></div></div>
        <div className="flex items-start gap-2.5"><BrandIcon name="bag" size={17} className="mt-0.5 shrink-0 text-primary" /><div><dt className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Conteúdo</dt><dd className="mt-1 text-on-surface">{quantidadeItens} {quantidadeItens === 1 ? 'item' : 'itens'} · {pedido.itens.length} {pedido.itens.length === 1 ? 'produto' : 'produtos'}</dd></div></div>
        <div className="flex items-start gap-2.5"><BrandIcon name="location" size={17} className="mt-0.5 shrink-0 text-primary" /><div><dt className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Recebimento</dt><dd className="mt-1 text-on-surface">Retirada na barbearia</dd></div></div>
      </dl>

      {pedido.metodo === 'STRIPE' && pedido.status === 'PENDENTE' && pedido.checkout_expira_em && <div className="mt-4"><PagamentoCountdown expiraEm={pedido.checkout_expira_em} compacto onExpire={aoExpirar} /></div>}

      <div className="mt-4 flex flex-col justify-between gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center">
        <button type="button" aria-expanded={expandido} onClick={aoExpandir} className="flex min-h-10 items-center gap-2 rounded-full px-2 text-xs font-semibold text-on-surface-variant hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><BrandIcon name={expandido ? 'back' : 'next'} size={15} />{expandido ? 'Ocultar produtos' : 'Ver produtos do pedido'}</button>
        {permiteAlteracao && <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
          <button type="button" onClick={aoCancelar} disabled={operacaoEmAndamento} className="min-h-11 rounded-full border border-error/35 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-error hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60 disabled:opacity-40">Cancelar pedido</button>
          {permitePagamentoOnline
            ? <button type="button" onClick={aoPagar} disabled={operacaoEmAndamento} className="min-h-11 rounded-full bg-primary px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-wait disabled:opacity-50 sm:min-w-36">{pagando ? 'Abrindo pagamento...' : pedido.status === 'FALHOU' ? 'Tentar novamente' : 'Pagar agora'}</button>
            : <span className="flex min-h-11 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10 px-5 text-[10px] font-bold uppercase tracking-wider text-amber-200">Pagar em dinheiro na retirada</span>}
        </div>}
      </div>
    </div>

    {expandido && <div className="border-t border-primary/10 bg-black/15 p-4 sm:p-5"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary">Produtos deste pedido</p><ul className="mt-3 grid gap-2">{pedido.itens.map((item) => <li key={`${pedido.idpedido}-${item.nome}`} className="grid gap-2 rounded-xl border border-white/[0.06] bg-background/35 px-3 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"><span className="font-semibold text-on-surface">{item.nome}</span><span className="text-on-surface-variant">{item.quantidade}× {dinheiro(item.preco)}</span><strong className="text-primary sm:min-w-20 sm:text-right">{dinheiro(item.subtotal)}</strong></li>)}</ul>{!confirmado && !permiteAlteracao && <p className="mt-3 rounded-xl border border-error/15 bg-error/[0.06] px-3 py-2 text-[10px] leading-relaxed text-error">Pedido encerrado. Faça uma nova compra para continuar.</p>}</div>}
  </article>
}

export default function PedidosLoja({ pedidos, pedidosFiltrados, pedidosVisiveis, paginacao, resumo, filtroAtual, pagamentoEmAndamento, cancelando, pedidoExpandido, aoFiltrar, aoExpandir, aoCancelar, aoPagar, aoMudarPagina, aoVerProdutos }) {
  const total = paginacao?.total ?? pedidosFiltrados.length

  return <section id="painel-pedidos" role="tabpanel" aria-labelledby="titulo-pedidos">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Sua atividade</p><h2 id="titulo-pedidos" className="mt-1 font-headline text-2xl sm:text-3xl">Meus pedidos</h2><p className="mt-2 text-xs text-on-surface-variant">Consulte suas compras avulsas e retome pagamentos pendentes sem duplicar o pedido.</p></div><span className="text-xs text-on-surface-variant">{total} {total === 1 ? 'pedido' : 'pedidos'}</span></div>

    <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar pedidos por situação">{filtrosPedidos.map((filtro) => <button key={filtro.id} type="button" aria-pressed={filtroAtual === filtro.id} onClick={() => aoFiltrar(filtro.id)} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${filtroAtual === filtro.id ? 'border-primary bg-primary text-on-primary' : 'border-white/10 text-on-surface-variant hover:border-primary/35 hover:text-primary'}`}><span>{filtro.nome}</span><span className={`rounded-full px-2 py-0.5 text-[9px] ${filtroAtual === filtro.id ? 'bg-black/15' : 'bg-white/[0.06]'}`}>{quantidadeDoFiltro(filtro, resumo, pedidos)}</span></button>)}</div>

    {pedidosFiltrados.length
      ? <div className="mt-5 grid gap-4">{pedidosVisiveis.map((pedido) => <CardPedido key={pedido.idpedido} pedido={pedido} expandido={pedidoExpandido === pedido.idpedido} pagando={pagamentoEmAndamento === pedido.idpedido} operacaoEmAndamento={pagamentoEmAndamento !== null || cancelando} aoExpandir={() => aoExpandir(pedidoExpandido === pedido.idpedido ? null : pedido.idpedido)} aoCancelar={() => aoCancelar(pedido)} aoPagar={() => aoPagar(pedido)} aoExpirar={() => window.setTimeout(() => aoMudarPagina(paginacao?.pagina || 1).catch(() => {}), 16000)} />)}</div>
      : <div className="mt-5 rounded-3xl border border-dashed border-white/15 px-5 py-12 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="bag" size={28} /></span><h3 className="mt-4 font-headline text-xl">{pedidos.length ? 'Nenhum pedido nesta situação' : 'Você ainda não possui pedidos'}</h3><p className="mt-2 text-sm text-on-surface-variant">{pedidos.length ? 'Escolha outro filtro para consultar suas compras.' : 'Escolha um produto no catálogo para realizar sua primeira compra.'}</p>{pedidos.length ? <button type="button" onClick={() => aoFiltrar('todos')} className="mt-5 rounded-full border border-primary/35 px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary">Ver todos os pedidos</button> : <button type="button" onClick={aoVerProdutos} className="mt-5 rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary">Ver produtos</button>}</div>}
    <Pagination dados={paginacao} onChange={aoMudarPagina} />
  </section>
}

import BrandIcon from '../ui/BrandIcon'
import { dinheiro } from '../../utils/lojaUtils'

export default function CancelarPedidoDialog({ pedido, cancelando, manterRef, aoFechar, aoConfirmar }) {
  if (!pedido) return null

  const quantidadeItens = pedido.itens.reduce((total, item) => total + Number(item.quantidade), 0)

  return <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !cancelando) aoFechar() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="titulo-cancelar-pedido" aria-describedby="descricao-cancelar-pedido" className="w-full max-w-lg rounded-3xl border border-error/25 bg-surface-container-low p-5 shadow-2xl shadow-black/70 sm:p-7">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-error/25 bg-error/10 text-error"><BrandIcon name="alert" size={25} /></span>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-error">Ação de cancelamento</p>
      <h2 id="titulo-cancelar-pedido" className="mt-1 font-headline text-2xl sm:text-3xl">Cancelar pedido nº {pedido.idpedido}?</h2>
      <p id="descricao-cancelar-pedido" className="mt-3 text-sm leading-relaxed text-on-surface-variant">A sessão de pagamento será encerrada e este pedido permanecerá no seu histórico com o status cancelado. Depois disso, não será possível retomar o pagamento.</p>

      <dl className="mt-5 grid gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Conteúdo</dt><dd className="mt-1 font-semibold">{quantidadeItens} {quantidadeItens === 1 ? 'item' : 'itens'}</dd></div>
        <div className="sm:text-right"><dt className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Total</dt><dd className="mt-1 font-headline text-xl text-primary">{dinheiro(pedido.total)}</dd></div>
      </dl>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button ref={manterRef} type="button" onClick={aoFechar} disabled={cancelando} className="min-h-12 rounded-full border border-white/15 px-5 text-xs font-bold uppercase tracking-wider text-on-surface hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-40">Manter pedido</button>
        <button type="button" onClick={aoConfirmar} disabled={cancelando} className="min-h-12 rounded-full bg-error px-5 text-xs font-bold uppercase tracking-wider text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/70 disabled:cursor-wait disabled:opacity-60">{cancelando ? 'Cancelando...' : 'Sim, cancelar pedido'}</button>
      </div>
    </section>
  </div>
}

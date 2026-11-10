import { Link } from 'react-router-dom'
import BrandIcon from '../ui/BrandIcon'
import { dinheiro } from '../../utils/lojaUtils'

export function ListaItensSacola({ itens, aoEsvaziar, aoRemover, aoAlterarQuantidade }) {
  return (
    <section aria-labelledby="titulo-itens" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="titulo-itens" className="font-headline text-2xl">Produtos selecionados</h2>
        <button type="button" onClick={aoEsvaziar} className="text-xs font-bold text-error hover:underline underline-offset-4">
          Esvaziar sacola
        </button>
      </div>
      {itens.map((item) => (
        <article key={item.idservico} className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="hidden sm:flex w-12 h-12 shrink-0 rounded-xl border border-primary/20 bg-primary/10 items-center justify-center text-primary">
                <BrandIcon name="bottle" />
              </div>
              <div className="min-w-0">
                <h3 className="font-headline text-lg sm:text-xl">{item.nome}</h3>
                <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{item.descricao}</p>
                <p className="text-sm font-bold text-primary mt-2">
                  {dinheiro(item.preco)} <span className="font-normal text-on-surface-variant">cada</span>
                </p>
              </div>
            </div>
            <button type="button" onClick={() => aoRemover(item.idservico)} className="w-10 h-10 shrink-0 rounded-full border border-error/20 text-error hover:bg-error/10 flex items-center justify-center" aria-label={`Remover ${item.nome} da sacola`} title="Remover produto">
              <BrandIcon name="close" size={18} />
            </button>
          </div>
          <div className="mt-5 pt-4 border-t border-white/[0.07] flex items-center justify-between gap-4">
            <div className="flex items-center rounded-full border border-primary/25 p-1">
              <button type="button" onClick={() => aoAlterarQuantidade(item.idservico, -1)} className="w-9 h-9 rounded-full hover:bg-white/5" aria-label={`Diminuir quantidade de ${item.nome}`}>−</button>
              <span className="w-9 text-center text-sm font-bold" aria-live="polite">{item.quantidade}</span>
              <button type="button" onClick={() => aoAlterarQuantidade(item.idservico, 1)} className="w-9 h-9 rounded-full text-primary hover:bg-primary/10" aria-label={`Aumentar quantidade de ${item.nome}`}>+</button>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-on-surface-variant">Subtotal</p>
              <p className="font-headline text-xl text-primary mt-1">{dinheiro(Number(item.preco) * item.quantidade)}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}

export function ResumoSacola({
  quantidadeTotal,
  total,
  formaPagamento,
  pagando,
  aoAlterarFormaPagamento,
  aoFinalizar,
}) {
  return (
    <aside className="lg:sticky lg:top-24 glass-panel rounded-3xl border border-primary/25 p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Resumo do pedido</p>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Produtos</dt><dd>{quantidadeTotal}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Retirada</dt><dd className="text-right">Na barbearia</dd></div>
        <div className="flex items-end justify-between gap-4 pt-4 border-t border-white/10">
          <dt><span className="block text-xs text-on-surface-variant">Total</span><span className="text-[10px] text-on-surface-variant">{formaPagamento === 'ONLINE' ? 'Pagamento seguro' : 'Pagamento na retirada'}</span></dt>
          <dd className="font-headline text-3xl text-primary">{dinheiro(total)}</dd>
        </div>
      </dl>
      <fieldset className="mt-6">
        <legend className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Forma de pagamento</legend>
        <div className="mt-3 grid gap-2">
          <OpcaoPagamento
            ativa={formaPagamento === 'ONLINE'}
            valor="ONLINE"
            icone="card"
            titulo="Pagamento on-line"
            descricao="Checkout seguro pelo Stripe"
            aoAlterar={aoAlterarFormaPagamento}
          />
          <OpcaoPagamento
            ativa={formaPagamento === 'DINHEIRO'}
            valor="DINHEIRO"
            icone="money"
            titulo="Dinheiro"
            descricao="Pague ao retirar na barbearia"
            aoAlterar={aoAlterarFormaPagamento}
          />
        </div>
      </fieldset>
      <button type="button" onClick={aoFinalizar} disabled={pagando} className="w-full mt-6 rounded-full bg-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-on-primary disabled:opacity-50">
        {pagando
          ? formaPagamento === 'ONLINE' ? 'Abrindo pagamento...' : 'Registrando pedido...'
          : formaPagamento === 'ONLINE' ? 'Pagar on-line' : 'Confirmar pedido'}
      </button>
      <Link to="/loja" className="block mt-3 rounded-full border border-white/15 px-6 py-3 text-center text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:border-primary/35 hover:text-primary">Continuar comprando</Link>
      <p className="text-[10px] text-center text-on-surface-variant mt-4">Os produtos serão separados após a confirmação do pagamento.</p>
    </aside>
  )
}

function OpcaoPagamento({ ativa, valor, icone, titulo, descricao, aoAlterar }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors ${ativa ? 'border-primary/55 bg-primary/[0.08]' : 'border-white/10 hover:border-primary/25'}`}>
      <input type="radio" name="forma-pagamento" value={valor} checked={ativa} onChange={(event) => aoAlterar(event.target.value)} className="sr-only" />
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BrandIcon name={icone} size={21} /></span>
      <span><strong className="block text-sm">{titulo}</strong><span className="text-[10px] text-on-surface-variant">{descricao}</span></span>
    </label>
  )
}

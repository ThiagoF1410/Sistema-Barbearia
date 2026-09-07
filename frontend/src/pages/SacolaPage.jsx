import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listarServicos } from "../services/servicosService";
import {
  criarCheckoutProdutos,
  criarPedidoDinheiro,
} from "../services/pedidosService";
import useCarrinho from "../hooks/useCarrinho";
import BrandIcon from "../components/ui/BrandIcon";
import PagamentoCountdown from "../components/PagamentoCountdown";
import { consultarCheckout } from "../services/pagamentosService";
import {
  abrirCheckoutEmNovaAba,
  fecharAbaPagamento,
  prepararAbaPagamento,
} from "../utils/checkoutWindow";

const dinheiro = (valor) =>
  Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function SacolaPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { alterarQuantidade, carrinho, esvaziar, quantidadeTotal, remover } =
    useCarrinho();
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [pagando, setPagando] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("ONLINE");
  const [checkoutPendente, setCheckoutPendente] = useState(null);
  const [statusPagamento, setStatusPagamento] = useState("");
  const cancelarLimpezaRef = useRef(null);

  useEffect(() => {
    const sessionId = checkoutPendente?.sessionId;
    if (!sessionId || statusPagamento !== "PENDENTE") return undefined;
    let ativo = true;
    let temporizador;
    const consultar = async () => {
      if (document.visibilityState !== "visible") {
        temporizador = window.setTimeout(consultar, 3000);
        return;
      }
      try {
        const resultado = await consultarCheckout(sessionId);
        if (!ativo) return;
        const status = String(resultado.statuspagamento || "").toUpperCase();
        if (status === "CONFIRMADO") {
          setStatusPagamento("CONFIRMADO");
          esvaziar();
          return;
        }
        if (["CANCELADO", "FALHOU"].includes(status)) {
          setStatusPagamento(status);
          return;
        }
      } catch {
        // Mantém o acompanhamento após uma indisponibilidade temporária.
      }
      temporizador = window.setTimeout(consultar, 3000);
    };
    consultar();
    return () => {
      ativo = false;
      window.clearTimeout(temporizador);
    };
  }, [checkoutPendente?.sessionId, esvaziar, statusPagamento]);

  useEffect(() => {
    listarServicos()
      .then((dados) =>
        setProdutos(dados.filter((item) => item.tipo === "produto")),
      )
      .catch((err) =>
        setErro(
          err.response?.data?.message ||
            "Não foi possível carregar os produtos da sacola.",
        ),
      )
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (!confirmarLimpeza) return undefined;
    cancelarLimpezaRef.current?.focus();
    const fechar = (event) => {
      if (event.key === "Escape") setConfirmarLimpeza(false);
    };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [confirmarLimpeza]);

  const itens = useMemo(
    () =>
      produtos
        .filter((produto) => carrinho[produto.idservico])
        .map((produto) => ({
          ...produto,
          quantidade: carrinho[produto.idservico],
        })),
    [carrinho, produtos],
  );
  const total = itens.reduce(
    (soma, item) => soma + Number(item.preco) * item.quantidade,
    0,
  );

  async function finalizarCompra() {
    if (!itens.length) return;
    const abaPagamento = formaPagamento === "ONLINE" ? prepararAbaPagamento() : null;
    setPagando(true);
    setErro("");
    try {
      const itensPedido = itens.map((item) => ({
        produtoId: item.idservico,
        quantidade: item.quantidade,
      }));
      if (formaPagamento === "DINHEIRO") {
        await criarPedidoDinheiro(itensPedido);
        esvaziar();
        navigate("/loja?aba=pedidos", { replace: true });
        return;
      }
      const checkout = await criarCheckoutProdutos(itensPedido);
      setCheckoutPendente(checkout);
      setStatusPagamento("PENDENTE");
      setPagando(false);
      abrirCheckoutEmNovaAba(checkout.checkoutUrl, abaPagamento);
    } catch (err) {
      fecharAbaPagamento(abaPagamento);
      setErro(
        err.response?.data?.message ||
          "Não foi possível abrir o pagamento da sua compra.",
      );
      setPagando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="sticky top-0 z-30 border-b border-primary/15 bg-black/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          <Link
            to="/dashboard"
            className="font-headline text-xl hover:text-primary"
          >
            O Rei da Navalha
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="flex items-center gap-2 text-sm text-primary">
              <BrandIcon name="cart" size={19} />
              <span className="hidden sm:inline">
                {quantidadeTotal} {quantidadeTotal === 1 ? "item" : "itens"}
              </span>
            </span>
            <span className="hidden md:block text-sm text-on-surface-variant">
              {user?.nome || user?.name}
            </span>
            <button
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
              className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-error"
            >
              <BrandIcon name="logout" size={18} />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-start gap-3">
          <Link
            to="/loja"
            className="mt-1 text-on-surface-variant hover:text-primary"
            aria-label="Voltar à loja"
          >
            <BrandIcon name="back" />
          </Link>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              Sua compra
            </p>
            <h1 className="font-headline text-3xl sm:text-4xl mt-1">Sacola</h1>
            <p className="text-sm text-on-surface-variant mt-2">
              Revise os produtos e as quantidades antes de continuar para o
              pagamento.
            </p>
          </div>
        </div>
        {erro && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error"
          >
            {erro}
          </div>
        )}

        {carregando ? (
          <div role="status" className="mt-8 text-sm text-on-surface-variant">
            Carregando sua sacola...
          </div>
        ) : itens.length ? (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:gap-8 mt-8 items-start">
            <section aria-labelledby="titulo-itens" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 id="titulo-itens" className="font-headline text-2xl">
                  Produtos selecionados
                </h2>
                <button
                  type="button"
                  onClick={() => setConfirmarLimpeza(true)}
                  className="text-xs font-bold text-error hover:underline underline-offset-4"
                >
                  Esvaziar sacola
                </button>
              </div>
              {itens.map((item) => (
                <article
                  key={item.idservico}
                  className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="hidden sm:flex w-12 h-12 shrink-0 rounded-xl border border-primary/20 bg-primary/10 items-center justify-center text-primary">
                        <BrandIcon name="bottle" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-headline text-lg sm:text-xl">
                          {item.nome}
                        </h3>
                        <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                          {item.descricao}
                        </p>
                        <p className="text-sm font-bold text-primary mt-2">
                          {dinheiro(item.preco)}{" "}
                          <span className="font-normal text-on-surface-variant">
                            cada
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remover(item.idservico)}
                      className="w-10 h-10 shrink-0 rounded-full border border-error/20 text-error hover:bg-error/10 flex items-center justify-center"
                      aria-label={`Remover ${item.nome} da sacola`}
                      title="Remover produto"
                    >
                      <BrandIcon name="close" size={18} />
                    </button>
                  </div>
                  <div className="mt-5 pt-4 border-t border-white/[0.07] flex items-center justify-between gap-4">
                    <div className="flex items-center rounded-full border border-primary/25 p-1">
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(item.idservico, -1)}
                        className="w-9 h-9 rounded-full hover:bg-white/5"
                        aria-label={`Diminuir quantidade de ${item.nome}`}
                      >
                        −
                      </button>
                      <span
                        className="w-9 text-center text-sm font-bold"
                        aria-live="polite"
                      >
                        {item.quantidade}
                      </span>
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(item.idservico, 1)}
                        className="w-9 h-9 rounded-full text-primary hover:bg-primary/10"
                        aria-label={`Aumentar quantidade de ${item.nome}`}
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-widest text-on-surface-variant">
                        Subtotal
                      </p>
                      <p className="font-headline text-xl text-primary mt-1">
                        {dinheiro(Number(item.preco) * item.quantidade)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="lg:sticky lg:top-24 glass-panel rounded-3xl border border-primary/25 p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Resumo do pedido
              </p>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-on-surface-variant">Produtos</dt>
                  <dd>{quantidadeTotal}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-on-surface-variant">Retirada</dt>
                  <dd className="text-right">Na barbearia</dd>
                </div>
                <div className="flex items-end justify-between gap-4 pt-4 border-t border-white/10">
                  <dt>
                    <span className="block text-xs text-on-surface-variant">
                      Total
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      {formaPagamento === "ONLINE"
                        ? "Pagamento seguro"
                        : "Pagamento na retirada"}
                    </span>
                  </dt>
                  <dd className="font-headline text-3xl text-primary">
                    {dinheiro(total)}
                  </dd>
                </div>
              </dl>
              <fieldset className="mt-6">
                <legend className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                  Forma de pagamento
                </legend>
                <div className="mt-3 grid gap-2">
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors ${formaPagamento === "ONLINE" ? "border-primary/55 bg-primary/[0.08]" : "border-white/10 hover:border-primary/25"}`}
                  >
                    <input
                      type="radio"
                      name="forma-pagamento"
                      value="ONLINE"
                      checked={formaPagamento === "ONLINE"}
                      onChange={(event) =>
                        setFormaPagamento(event.target.value)
                      }
                      className="sr-only"
                    />
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <BrandIcon name="card" size={21} />
                    </span>
                    <span>
                      <strong className="block text-sm">
                        Pagamento on-line
                      </strong>
                      <span className="text-[10px] text-on-surface-variant">
                        Checkout seguro pelo Stripe
                      </span>
                    </span>
                  </label>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors ${formaPagamento === "DINHEIRO" ? "border-primary/55 bg-primary/[0.08]" : "border-white/10 hover:border-primary/25"}`}
                  >
                    <input
                      type="radio"
                      name="forma-pagamento"
                      value="DINHEIRO"
                      checked={formaPagamento === "DINHEIRO"}
                      onChange={(event) =>
                        setFormaPagamento(event.target.value)
                      }
                      className="sr-only"
                    />
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <BrandIcon name="money" size={21} />
                    </span>
                    <span>
                      <strong className="block text-sm">Dinheiro</strong>
                      <span className="text-[10px] text-on-surface-variant">
                        Pague ao retirar na barbearia
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>
              <button
                type="button"
                onClick={finalizarCompra}
                disabled={pagando}
                className="w-full mt-6 rounded-full bg-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-on-primary disabled:opacity-50"
              >
                {pagando
                  ? formaPagamento === "ONLINE"
                    ? "Abrindo pagamento..."
                    : "Registrando pedido..."
                  : formaPagamento === "ONLINE"
                    ? "Pagar on-line"
                    : "Confirmar pedido"}
              </button>
              <Link
                to="/loja"
                className="block mt-3 rounded-full border border-white/15 px-6 py-3 text-center text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:border-primary/35 hover:text-primary"
              >
                Continuar comprando
              </Link>
              <p className="text-[10px] text-center text-on-surface-variant mt-4">
                Os produtos serão separados após a confirmação do pagamento.
              </p>
            </aside>
          </div>
        ) : (
          <section className="mt-8 glass-panel rounded-3xl border border-dashed border-white/15 px-5 py-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl border border-primary/20 bg-primary/10 text-primary flex items-center justify-center">
              <BrandIcon name="bag" size={34} />
            </div>
            <h2 className="font-headline text-2xl mt-5">
              Sua sacola está vazia
            </h2>
            <p className="text-sm text-on-surface-variant mt-2">
              Escolha os produtos que deseja comprar na loja.
            </p>
            <Link
              to="/loja"
              className="inline-block mt-6 rounded-full bg-primary px-7 py-3 text-xs font-bold uppercase tracking-widest text-on-primary"
            >
              Ir para a loja
            </Link>
          </section>
        )}
      </main>

      {confirmarLimpeza && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setConfirmarLimpeza(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-esvaziar"
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-error/20 bg-surface p-6 sm:p-7"
          >
            <div className="w-12 h-12 rounded-2xl bg-error/10 border border-error/20 text-error flex items-center justify-center">
              <BrandIcon name="trash" size={26} />
            </div>
            <h2 id="titulo-esvaziar" className="font-headline text-2xl mt-5">
              Esvaziar a sacola?
            </h2>
            <p className="text-sm text-on-surface-variant mt-2">
              Todos os produtos selecionados serão removidos. Essa ação não
              afeta compras já realizadas.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              <button
                ref={cancelarLimpezaRef}
                type="button"
                onClick={() => setConfirmarLimpeza(false)}
                className="rounded-full border border-white/15 px-5 py-3 text-sm"
              >
                Manter produtos
              </button>
              <button
                type="button"
                onClick={() => {
                  esvaziar();
                  setConfirmarLimpeza(false);
                }}
                className="rounded-full bg-error px-5 py-3 text-sm font-bold text-white"
              >
                Esvaziar sacola
              </button>
            </div>
          </section>
        </div>
      )}
      {checkoutPendente && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="titulo-redirecionamento" className="w-full max-w-md rounded-3xl border border-primary/25 bg-surface p-6 text-center shadow-2xl">
            <BrandIcon name={statusPagamento === "CONFIRMADO" ? "check" : "card"} size={36} className={statusPagamento === "CONFIRMADO" ? "mx-auto text-emerald-300" : "mx-auto text-primary"} />
            <h2 id="titulo-redirecionamento" className="mt-4 font-headline text-2xl">{statusPagamento === "CONFIRMADO" ? "Pagamento aprovado ✅" : "Aguardando pagamento"}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">{statusPagamento === "CONFIRMADO" ? "Sua compra foi confirmada e será preparada para retirada." : "O Stripe foi aberto em outra aba. Esta tela será atualizada automaticamente."}</p>
            {statusPagamento === "PENDENTE" && <div className="mt-5 text-left"><PagamentoCountdown expiraEm={checkoutPendente.expiraEm} onExpire={() => setStatusPagamento("CANCELADO")} /></div>}
            {statusPagamento === "PENDENTE" && <button type="button" onClick={() => abrirCheckoutEmNovaAba(checkoutPendente.checkoutUrl)} className="mt-5 w-full rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-widest text-on-primary">Abrir pagamento novamente</button>}
            {statusPagamento === "CONFIRMADO" && <button type="button" onClick={() => navigate("/loja?aba=pedidos", { replace: true })} className="mt-5 w-full rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-widest text-on-primary">Ver meus pedidos</button>}
          </section>
        </div>
      )}
    </div>
  );
}

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
import useCheckoutPolling from "../hooks/useCheckoutPolling";
import useFeedbackFocus from "../hooks/useFeedbackFocus";
import { ListaItensSacola, ResumoSacola } from "../components/loja/ConteudoSacola";
import {
  abrirCheckoutEmNovaAba,
  fecharAbaPagamento,
  prepararAbaPagamento,
} from "../utils/checkoutWindow";

export default function SacolaPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { alterarQuantidade, carrinho, esvaziar, quantidadeTotal, remover } =
    useCarrinho();
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [pagando, setPagando] = useState(false);
  const [erro, setErro] = useState("");
  const erroRef = useFeedbackFocus(erro);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("ONLINE");
  const [checkoutPendente, setCheckoutPendente] = useState(null);
  const [statusPagamento, setStatusPagamento] = useState("");
  const cancelarLimpezaRef = useRef(null);

  useCheckoutPolling({
    sessionId: checkoutPendente?.sessionId,
    status: statusPagamento,
    aoConfirmar: () => {
      setStatusPagamento("CONFIRMADO");
      esvaziar();
    },
    aoEncerrar: setStatusPagamento,
  });

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
              type="button"
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
          <div ref={erroRef}
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
            <ListaItensSacola
              itens={itens}
              aoEsvaziar={() => setConfirmarLimpeza(true)}
              aoRemover={remover}
              aoAlterarQuantidade={alterarQuantidade}
            />

            <ResumoSacola
              quantidadeTotal={quantidadeTotal}
              total={total}
              formaPagamento={formaPagamento}
              pagando={pagando}
              aoAlterarFormaPagamento={setFormaPagamento}
              aoFinalizar={finalizarCompra}
            />
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

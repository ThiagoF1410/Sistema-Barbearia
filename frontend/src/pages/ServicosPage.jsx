import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listarServicos } from "../services/servicosService";
import {
  cancelarPedido as solicitarCancelamentoPedido,
  listarMeusPedidos,
  reabrirCheckoutPedido,
} from "../services/pedidosService";
import BrandIcon from "../components/ui/BrandIcon";
import CatalogoProdutos from "../components/loja/CatalogoProdutos";
import CancelarPedidoDialog from "../components/loja/CancelarPedidoDialog";
import useFeedbackFocus from "../hooks/useFeedbackFocus";
import PedidosLoja from "../components/loja/PedidosLoja";
import useCarrinho from "../hooks/useCarrinho";
import logoImg from "../assets/Logo1.avif";
import {
  categoriaDoProduto,
  filtrosPedidos,
  normalizarBusca as normalizar,
} from "../utils/lojaUtils";
import {
  abrirCheckoutEmNovaAba,
  fecharAbaPagamento,
  prepararAbaPagamento,
} from "../utils/checkoutWindow";

export default function LojaPage() {
  const { user, logout } = useAuth();
  const [catalogo, setCatalogo] = useState([]);
  const { alterarQuantidade, carrinho, quantidadeTotal } = useCarrinho();
  const [pedidos, setPedidos] = useState([]);
  const [erro, setErro] = useState("");
  const erroRef = useFeedbackFocus(erro);
  const [carregando, setCarregando] = useState(true);
  const [pedidoEmPagamento, setPedidoEmPagamento] = useState(null);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todos");
  const [produtoAdicionado, setProdutoAdicionado] = useState("");
  const [paginacaoPedidos, setPaginacaoPedidos] = useState(null);
  const [resumoPedidos, setResumoPedidos] = useState(null);
  const [pedidoExpandido, setPedidoExpandido] = useState(null);
  const [aba, setAba] = useState(() =>
    new URLSearchParams(window.location.search).get("aba") === "pedidos"
      ? "pedidos"
      : "produtos",
  );
  const [filtroPedidos, setFiltroPedidos] = useState("todos");
  const [pedidoParaCancelar, setPedidoParaCancelar] = useState(null);
  const [cancelandoPedido, setCancelandoPedido] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const manterPedidoRef = useRef(null);

  useEffect(() => {
    Promise.all([listarServicos(), listarMeusPedidos({ pagina: 1, limite: 6 })])
      .then(([itens, compras]) => {
        setCatalogo(itens);
        setPedidos(compras.pedidos || compras);
        setPaginacaoPedidos(compras.paginacao || null);
        setResumoPedidos(compras.resumo || null);
      })
      .catch((err) =>
        setErro(
          err.response?.data?.message ||
            "Não foi possível carregar o catálogo. Tente novamente.",
        ),
      )
      .finally(() => setCarregando(false));
  }, []);

  const produtos = catalogo.filter((item) => item.tipo === "produto");
  const termoBusca = normalizar(busca.trim());
  const produtosFiltrados = produtos.filter(
    (produto) =>
      (categoria === "todos" || categoriaDoProduto(produto) === categoria) &&
      (!termoBusca ||
        normalizar(`${produto.nome} ${produto.descricao || ""}`).includes(
          termoBusca,
        )),
  );
  const regraFiltroPedidos = filtrosPedidos.find(
    (filtro) => filtro.id === filtroPedidos,
  );
  const pedidosFiltrados = paginacaoPedidos ? pedidos : regraFiltroPedidos?.status
    ? pedidos.filter((pedido) =>
        regraFiltroPedidos.status.includes(pedido.status),
      )
    : pedidos;
  const pedidosVisiveis = paginacaoPedidos ? pedidosFiltrados : pedidosFiltrados.slice(0, 3);

  async function carregarPedidos(pagina = 1, filtroAtual = filtroPedidos) {
    const status = filtroAtual === "aguardando" ? "AGUARDANDO"
      : filtroAtual === "confirmados" ? "CONFIRMADO"
        : filtroAtual === "encerrados" ? "CANCELADO" : undefined;
    const dados = await listarMeusPedidos({ status, pagina, limite: 6 });
    setPedidos(dados.pedidos || dados);
    setPaginacaoPedidos(dados.paginacao || null);
    setResumoPedidos(dados.resumo || null);
  }

  useEffect(() => {
    if (!produtoAdicionado) return undefined;
    const temporizador = window.setTimeout(
      () => setProdutoAdicionado(""),
      2400,
    );
    return () => window.clearTimeout(temporizador);
  }, [produtoAdicionado]);

  useEffect(() => {
    if (!pedidoParaCancelar) return undefined;

    const elementoAnterior = document.activeElement;
    const rolagemAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    manterPedidoRef.current?.focus();

    const fecharComEscape = (event) => {
      if (event.key === "Escape" && !cancelandoPedido)
        setPedidoParaCancelar(null);
    };
    document.addEventListener("keydown", fecharComEscape);

    return () => {
      document.removeEventListener("keydown", fecharComEscape);
      document.body.style.overflow = rolagemAnterior;
      elementoAnterior?.focus?.();
    };
  }, [pedidoParaCancelar, cancelandoPedido]);

  function adicionarProduto(produto) {
    alterarQuantidade(produto.idservico, 1);
    setProdutoAdicionado(`${produto.nome} foi adicionado à sacola.`);
  }

  async function pagarPedido(pedido) {
    const abaPagamento = prepararAbaPagamento();
    setPedidoEmPagamento(pedido.idpedido);
    setErro("");
    try {
      const checkout = await reabrirCheckoutPedido(pedido.idpedido);
      abrirCheckoutEmNovaAba(checkout.checkoutUrl, abaPagamento);
    } catch (err) {
      fecharAbaPagamento(abaPagamento);
      if (err.response?.status === 409) {
        try {
          await carregarPedidos(paginacaoPedidos?.pagina || 1);
        } catch {
          /* mantém a lista atual */
        }
      }
      setErro(
        err.response?.data?.message ||
          "Não foi possível abrir o pagamento deste pedido. Tente novamente.",
      );
      setPedidoEmPagamento(null);
    }
  }

  async function confirmarCancelamentoPedido() {
    if (!pedidoParaCancelar) return;
    setCancelandoPedido(true);
    setErro("");
    setMensagem("");
    try {
      const resultado = await solicitarCancelamentoPedido(
        pedidoParaCancelar.idpedido,
      );
      await carregarPedidos(paginacaoPedidos?.pagina || 1);
      setPedidoParaCancelar(null);
      setMensagem(resultado.message || "Pedido cancelado com sucesso.");
    } catch (err) {
      if (err.response?.status === 409) {
        try {
          await carregarPedidos(paginacaoPedidos?.pagina || 1);
        } catch {
          /* mantém a lista atual */
        }
      }
      setErro(
        err.response?.data?.message ||
          "Não foi possível cancelar o pedido. Tente novamente.",
      );
      setPedidoParaCancelar(null);
    } finally {
      setCancelandoPedido(false);
    }
  }
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="sticky top-0 z-40 border-b border-primary/15 bg-black/90 shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/dashboard"
            className="group flex min-w-0 items-center gap-3"
            aria-label="Voltar ao painel do cliente"
          >
            <img
              src={logoImg}
              alt=""
              width="44"
              height="44"
              decoding="async"
              className="h-11 w-11 shrink-0 object-contain"
            />
            <div className="hidden min-w-0 sm:block">
              <p className="font-headline text-lg leading-none transition-colors group-hover:text-primary">
                O Rei da Navalha
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.24em] text-primary/75">
                Loja
              </p>
            </div>
          </Link>
          <nav
            className="flex items-center gap-2 sm:gap-3"
            aria-label="Navegação da loja"
          >
            <Link
              to="/dashboard"
              className="hidden min-h-10 items-center rounded-full px-3 text-sm text-white/75 hover:bg-white/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:inline-flex"
            >
              Painel
            </Link>
            <Link
              to="/sacola"
              className="relative flex min-h-10 items-center gap-2 rounded-full border border-primary/30 px-3 py-2 text-sm text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <BrandIcon name="cart" size={19} />
              <span className="hidden sm:inline">Sacola</span>
              {quantidadeTotal > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-on-primary">
                  {quantidadeTotal}
                </span>
              )}
            </Link>
            <span className="hidden max-w-36 truncate text-sm text-white/65 md:block">
              {user?.nome || user?.name}
            </span>
            <button
              type="button"
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
              className="flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-white/75 hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60"
            >
              <BrandIcon name="logout" size={18} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-7 sm:px-6 sm:py-10">
        <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-[linear-gradient(120deg,rgba(245,197,24,0.09),rgba(255,255,255,0.02)_50%,transparent)] p-5 sm:p-7">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/[0.05] blur-3xl"
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3 sm:gap-4">
              <Link
                to="/dashboard"
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-on-surface-variant hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                aria-label="Voltar ao painel"
              >
                <BrandIcon name="back" size={19} />
              </Link>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  Loja O Rei da Navalha
                </p>
                <h1 className="mt-1 font-headline text-3xl sm:text-4xl">
                  Cuidado profissional em casa
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                  Escolha seus produtos, pague online com segurança e retire
                  diretamente na barbearia.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAba("produtos")}
                className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                Ver produtos
              </button>
              <button
                type="button"
                onClick={() => setAba("pedidos")}
                className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-wider hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                Meus pedidos
              </button>
            </div>
          </div>
        </section>

        <div
          className="sticky top-[4.6rem] z-20 rounded-2xl border border-primary/15 bg-background/90 p-1.5 shadow-xl shadow-black/20 backdrop-blur-xl"
          role="tablist"
          aria-label="Seções da loja"
        >
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={aba === "produtos"}
              aria-controls="painel-produtos"
              onClick={() => setAba("produtos")}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${aba === "produtos" ? "bg-primary text-on-primary shadow-lg shadow-primary/10" : "text-on-surface-variant hover:bg-white/[0.04] hover:text-primary"}`}
            >
              <BrandIcon name="bag" size={18} />
              Produtos{" "}
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] ${aba === "produtos" ? "bg-black/15" : "bg-white/[0.06]"}`}
              >
                {produtos.length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === "pedidos"}
              aria-controls="painel-pedidos"
              onClick={() => setAba("pedidos")}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${aba === "pedidos" ? "bg-primary text-on-primary shadow-lg shadow-primary/10" : "text-on-surface-variant hover:bg-white/[0.04] hover:text-primary"}`}
            >
              <BrandIcon name="history" size={18} />
              Meus pedidos{" "}
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] ${aba === "pedidos" ? "bg-black/15" : "bg-white/[0.06]"}`}
              >
                {pedidos.length}
              </span>
            </button>
          </div>
        </div>

        {produtoAdicionado && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            <span className="flex items-center gap-2">
              <BrandIcon name="check" size={20} />
              {produtoAdicionado}
            </span>
            <Link
              to="/sacola"
              className="shrink-0 text-xs font-bold uppercase tracking-wider underline underline-offset-4"
            >
              Ver sacola
            </Link>
          </div>
        )}
        {mensagem && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            <span className="flex items-center gap-2">
              <BrandIcon name="check" size={20} />
              {mensagem}
            </span>
            <button
              type="button"
              onClick={() => setMensagem("")}
              className="text-xs font-bold uppercase tracking-wider"
            >
              Fechar
            </button>
          </div>
        )}
        {erro && (
          <div ref={erroRef}
            role="alert"
            className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error"
          >
            {erro}
          </div>
        )}

        {aba === "produtos" && (
          <CatalogoProdutos
            carregando={carregando}
            produtos={produtosFiltrados}
            carrinho={carrinho}
            busca={busca}
            aoMudarBusca={setBusca}
            categoria={categoria}
            aoMudarCategoria={setCategoria}
            aoAlterarQuantidade={alterarQuantidade}
            aoAdicionar={adicionarProduto}
            aoLimparFiltros={() => { setBusca(""); setCategoria("todos"); }}
          />
        )}

        {aba === "pedidos" && (
          <PedidosLoja
            pedidos={pedidos}
            pedidosFiltrados={pedidosFiltrados}
            pedidosVisiveis={pedidosVisiveis}
            paginacao={paginacaoPedidos}
            resumo={resumoPedidos}
            filtroAtual={filtroPedidos}
            pagamentoEmAndamento={pedidoEmPagamento}
            cancelando={cancelandoPedido}
            pedidoExpandido={pedidoExpandido}
            aoFiltrar={(filtro) => {
              setFiltroPedidos(filtro);
              carregarPedidos(1, filtro).catch(() => setErro("N\u00e3o foi poss\u00edvel atualizar seus pedidos."));
            }}
            aoExpandir={setPedidoExpandido}
            aoCancelar={setPedidoParaCancelar}
            aoPagar={pagarPedido}
            aoMudarPagina={carregarPedidos}
            aoVerProdutos={() => setAba("produtos")}
          />
        )}

      </main>

      {aba === "produtos" && quantidadeTotal > 0 && (
        <Link
          to="/sacola"
          className="fixed bottom-4 left-4 right-4 z-30 flex min-h-13 items-center justify-between rounded-full bg-primary px-5 py-3 text-on-primary shadow-2xl shadow-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:hidden"
        >
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <BrandIcon name="cart" size={19} />
            Ver sacola
          </span>
          <span className="rounded-full bg-black/15 px-2.5 py-1 text-xs font-bold">
            {quantidadeTotal}
          </span>
        </Link>
      )}

      <CancelarPedidoDialog
        pedido={pedidoParaCancelar}
        cancelando={cancelandoPedido}
        manterRef={manterPedidoRef}
        aoFechar={() => setPedidoParaCancelar(null)}
        aoConfirmar={confirmarCancelamentoPedido}
      />

    </div>
  );
}

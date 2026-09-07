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
import PagamentoCountdown from "../components/PagamentoCountdown";
import Pagination from "../components/ui/Pagination";
import useCarrinho from "../hooks/useCarrinho";
import logoImg from "../assets/Logo1.avif";
import {
  abrirCheckoutEmNovaAba,
  fecharAbaPagamento,
  prepararAbaPagamento,
} from "../utils/checkoutWindow";

const dinheiro = (valor) =>
  Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const descricaoStatus = {
  PENDENTE: "Aguardando pagamento",
  CONFIRMADO: "Pagamento confirmado · pronto para retirada",
  FALHOU: "O pagamento não foi concluído",
  CANCELADO: "Pedido encerrado",
};
const categorias = [
  { id: "todos", nome: "Todos" },
  { id: "barba", nome: "Barba" },
  { id: "cabelo", nome: "Cabelo" },
  { id: "acessorios", nome: "Acessórios" },
];
const filtrosPedidos = [
  { id: "todos", nome: "Todos" },
  {
    id: "aguardando",
    nome: "Aguardando pagamento",
    status: ["PENDENTE", "FALHOU"],
  },
  { id: "confirmados", nome: "Confirmados", status: ["CONFIRMADO"] },
  { id: "encerrados", nome: "Encerrados", status: ["CANCELADO"] },
];

function normalizar(texto = "") {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function categoriaDoProduto(produto) {
  const texto = normalizar(`${produto.nome} ${produto.descricao || ""}`);
  if (/pente|escova|navalha|acessorio/.test(texto)) return "acessorios";
  if (/barba|balm|oleo/.test(texto)) return "barba";
  return "cabelo";
}

function formatarDataPedido(valor) {
  const correspondencia = String(valor || "").match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})$/,
  );
  if (!correspondencia) return valor;
  const [, dia, mes, ano, horario] = correspondencia;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
  const dataFormatada = data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return `${dataFormatada} às ${horario}`;
}

export default function LojaPage() {
  const { user, logout } = useAuth();
  const [catalogo, setCatalogo] = useState([]);
  const { alterarQuantidade, carrinho, quantidadeTotal } = useCarrinho();
  const [pedidos, setPedidos] = useState([]);
  const [erro, setErro] = useState("");
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
          <div
            role="alert"
            className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error"
          >
            {erro}
          </div>
        )}

        {aba === "produtos" && (
          <section
            id="painel-produtos"
            role="tabpanel"
            aria-labelledby="titulo-produtos"
            className="space-y-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  Catálogo
                </p>
                <h2
                  id="titulo-produtos"
                  className="mt-1 font-headline text-2xl sm:text-3xl"
                >
                  Produtos disponíveis
                </h2>
                <p className="mt-2 text-xs text-on-surface-variant">
                  Compra online com retirada diretamente na barbearia.
                </p>
              </div>
              <label className="relative block w-full lg:max-w-sm">
                <span className="sr-only">Buscar produtos</span>
                <BrandIcon
                  name="search"
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                />
                <input
                  type="search"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar por nome ou descrição"
                  className="min-h-12 w-full rounded-full border border-white/10 bg-surface-container-low py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>

            <div
              className="flex gap-2 overflow-x-auto pb-1"
              aria-label="Categorias de produtos"
            >
              {categorias.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={categoria === item.id}
                  onClick={() => setCategoria(item.id)}
                  className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${categoria === item.id ? "border-primary bg-primary text-on-primary" : "border-white/10 text-on-surface-variant hover:border-primary/35 hover:text-primary"}`}
                >
                  {item.nome}
                </button>
              ))}
            </div>

            {carregando ? (
              <div
                role="status"
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.025]"
                  />
                ))}
                <span className="sr-only">Carregando catálogo...</span>
              </div>
            ) : produtosFiltrados.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {produtosFiltrados.map((item) => {
                  const quantidade = carrinho[item.idservico] || 0;
                  return (
                    <article
                      key={item.idservico}
                      className={`render-efficient brand-card glass-panel flex min-h-72 flex-col border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 ${quantidade ? "border-primary/50 bg-primary/[0.05]" : "border-white/10"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                          <BrandIcon name="bottle" size={24} />
                        </span>
                        <span className="rounded-full border border-white/[0.08] bg-black/15 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {
                            categorias.find(
                              (cat) => cat.id === categoriaDoProduto(item),
                            )?.nome
                          }
                        </span>
                      </div>
                      <h3 className="mt-5 font-headline text-xl">
                        {item.nome}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-on-surface-variant">
                        {item.descricao}
                      </p>
                      <div className="mt-auto pt-5">
                        <p className="font-headline text-2xl text-primary">
                          {dinheiro(item.preco)}
                        </p>
                        {quantidade ? (
                          <div className="mt-4 flex items-center justify-between rounded-full border border-primary/25 bg-primary/[0.035] p-1">
                            <button
                              type="button"
                              onClick={() =>
                                alterarQuantidade(item.idservico, -1)
                              }
                              className="h-10 w-10 rounded-full hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                              aria-label={`Remover uma unidade de ${item.nome}`}
                            >
                              −
                            </button>
                            <span
                              className="text-sm font-bold"
                              aria-live="polite"
                            >
                              {quantidade} na sacola
                            </span>
                            <button
                              type="button"
                              onClick={() => adicionarProduto(item)}
                              className="h-10 w-10 rounded-full text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                              aria-label={`Adicionar uma unidade de ${item.nome}`}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => adicionarProduto(item)}
                            className="mt-4 min-h-12 w-full rounded-full border border-primary/40 px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                          >
                            Adicionar à sacola
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/15 px-5 py-10 text-center">
                <BrandIcon
                  name="search"
                  size={30}
                  className="mx-auto text-primary"
                />
                <h3 className="mt-4 font-headline text-xl">
                  Nenhum produto encontrado
                </h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Tente buscar outro termo ou escolher uma categoria diferente.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setBusca("");
                    setCategoria("todos");
                  }}
                  className="mt-5 rounded-full border border-primary/35 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </section>
        )}

        {aba === "pedidos" && (
          <section
            id="painel-pedidos"
            role="tabpanel"
            aria-labelledby="titulo-pedidos"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  Sua atividade
                </p>
                <h2
                  id="titulo-pedidos"
                  className="mt-1 font-headline text-2xl sm:text-3xl"
                >
                  Meus pedidos
                </h2>
                <p className="mt-2 text-xs text-on-surface-variant">
                  Consulte suas compras avulsas e retome pagamentos pendentes
                  sem duplicar o pedido.
                </p>
              </div>
              <span className="text-xs text-on-surface-variant">
                {paginacaoPedidos?.total ?? pedidosFiltrados.length}{" "}
                {(paginacaoPedidos?.total ?? pedidosFiltrados.length) === 1 ? "pedido" : "pedidos"}
              </span>
            </div>

            <div
              className="mt-5 flex gap-2 overflow-x-auto pb-1"
              aria-label="Filtrar pedidos por situação"
            >
              {filtrosPedidos.map((filtro) => {
                const quantidade = resumoPedidos
                  ? (filtro.status
                    ? filtro.status.reduce((total, status) => total + Number(resumoPedidos.porStatus?.[status] || 0), 0)
                    : Number(resumoPedidos.total || 0))
                  : (filtro.status
                    ? pedidos.filter((pedido) => filtro.status.includes(pedido.status)).length
                    : pedidos.length);
                return (
                  <button
                    key={filtro.id}
                    type="button"
                    aria-pressed={filtroPedidos === filtro.id}
                    onClick={() => {
                      setFiltroPedidos(filtro.id);
                      carregarPedidos(1, filtro.id).catch(() =>
                        setErro("Não foi possível atualizar seus pedidos."),
                      );
                    }}
                    className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${filtroPedidos === filtro.id ? "border-primary bg-primary text-on-primary" : "border-white/10 text-on-surface-variant hover:border-primary/35 hover:text-primary"}`}
                  >
                    <span>{filtro.nome}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] ${filtroPedidos === filtro.id ? "bg-black/15" : "bg-white/[0.06]"}`}
                    >
                      {quantidade}
                    </span>
                  </button>
                );
              })}
            </div>

            {pedidosFiltrados.length ? (
              <div className="mt-5 grid gap-4">
                {pedidosVisiveis.map((pedido) => {
                  const confirmado = pedido.status === "CONFIRMADO";
                  const permiteAlteracao = ["PENDENTE", "FALHOU"].includes(
                    pedido.status,
                  );
                  const permitePagamentoOnline =
                    permiteAlteracao && pedido.metodo !== "DINHEIRO";
                  const pagando = pedidoEmPagamento === pedido.idpedido;
                  const expandido = pedidoExpandido === pedido.idpedido;
                  const quantidadeItens = pedido.itens.reduce(
                    (total, item) => total + Number(item.quantidade),
                    0,
                  );
                  const classeStatus = confirmado
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                    : pedido.status === "FALHOU" ||
                        pedido.status === "CANCELADO"
                      ? "border-error/30 bg-error/10 text-error"
                      : "border-amber-400/30 bg-amber-500/10 text-amber-200";
                  return (
                    <article
                      key={pedido.idpedido}
                      className="render-efficient overflow-hidden rounded-3xl border border-white/10 bg-surface-container-low transition-colors hover:border-primary/20"
                    >
                      <div className="p-4 sm:p-5 lg:p-6">
                        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                              <BrandIcon name="bag" size={21} />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-headline text-xl">
                                  Pedido nº {pedido.idpedido}
                                </h3>
                                <span
                                  className={`inline-flex rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-wider ${classeStatus}`}
                                >
                                  {pedido.status}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-on-surface-variant">
                                {descricaoStatus[pedido.status] ||
                                  pedido.status}
                              </p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                              Total do pedido
                            </p>
                            <p className="mt-1 font-headline text-2xl text-primary">
                              {dinheiro(pedido.total)}
                            </p>
                          </div>
                        </div>

                        <dl className="mt-5 grid gap-3 rounded-2xl border border-white/[0.06] bg-black/15 p-4 text-xs sm:grid-cols-3">
                          <div className="flex items-start gap-2.5">
                            <BrandIcon
                              name="calendar"
                              size={17}
                              className="mt-0.5 shrink-0 text-primary"
                            />
                            <div>
                              <dt className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                                Realizado em
                              </dt>
                              <dd className="mt-1 text-on-surface">
                                {formatarDataPedido(pedido.criado_em)}
                              </dd>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <BrandIcon
                              name="bag"
                              size={17}
                              className="mt-0.5 shrink-0 text-primary"
                            />
                            <div>
                              <dt className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                                Conteúdo
                              </dt>
                              <dd className="mt-1 text-on-surface">
                                {quantidadeItens}{" "}
                                {quantidadeItens === 1 ? "item" : "itens"} ·{" "}
                                {pedido.itens.length}{" "}
                                {pedido.itens.length === 1
                                  ? "produto"
                                  : "produtos"}
                              </dd>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <BrandIcon
                              name="location"
                              size={17}
                              className="mt-0.5 shrink-0 text-primary"
                            />
                            <div>
                              <dt className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                                Recebimento
                              </dt>
                              <dd className="mt-1 text-on-surface">
                                Retirada na barbearia
                              </dd>
                            </div>
                          </div>
                        </dl>

                        {pedido.metodo === "STRIPE" && pedido.status === "PENDENTE" && pedido.checkout_expira_em && (
                          <div className="mt-4">
                            <PagamentoCountdown
                              expiraEm={pedido.checkout_expira_em}
                              compacto
                              onExpire={() => window.setTimeout(() => carregarPedidos(paginacaoPedidos?.pagina || 1).catch(() => {}), 16000)}
                            />
                          </div>
                        )}

                        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            aria-expanded={expandido}
                            onClick={() =>
                              setPedidoExpandido(
                                expandido ? null : pedido.idpedido,
                              )
                            }
                            className="flex min-h-10 items-center gap-2 rounded-full px-2 text-xs font-semibold text-on-surface-variant hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                          >
                            <BrandIcon
                              name={expandido ? "back" : "next"}
                              size={15}
                            />
                            {expandido
                              ? "Ocultar produtos"
                              : "Ver produtos do pedido"}
                          </button>
                          {permiteAlteracao && (
                            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
                              <button
                                type="button"
                                onClick={() => setPedidoParaCancelar(pedido)}
                                disabled={
                                  pedidoEmPagamento !== null || cancelandoPedido
                                }
                                className="min-h-11 rounded-full border border-error/35 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-error hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60 disabled:opacity-40"
                              >
                                Cancelar pedido
                              </button>
                              {permitePagamentoOnline ? (
                                <button
                                  type="button"
                                  onClick={() => pagarPedido(pedido)}
                                  disabled={
                                    pedidoEmPagamento !== null ||
                                    cancelandoPedido
                                  }
                                  className="min-h-11 rounded-full bg-primary px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-wait disabled:opacity-50 sm:min-w-36"
                                >
                                  {pagando
                                    ? "Abrindo pagamento..."
                                    : pedido.status === "FALHOU"
                                      ? "Tentar novamente"
                                      : "Pagar agora"}
                                </button>
                              ) : (
                                <span className="flex min-h-11 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10 px-5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                                  Pagar em dinheiro na retirada
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {expandido && (
                        <div className="border-t border-primary/10 bg-black/15 p-4 sm:p-5">
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
                            Produtos deste pedido
                          </p>
                          <ul className="mt-3 grid gap-2">
                            {pedido.itens.map((item) => (
                              <li
                                key={`${pedido.idpedido}-${item.nome}`}
                                className="grid gap-2 rounded-xl border border-white/[0.06] bg-background/35 px-3 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
                              >
                                <span className="font-semibold text-on-surface">
                                  {item.nome}
                                </span>
                                <span className="text-on-surface-variant">
                                  {item.quantidade}× {dinheiro(item.preco)}
                                </span>
                                <strong className="text-primary sm:min-w-20 sm:text-right">
                                  {dinheiro(item.subtotal)}
                                </strong>
                              </li>
                            ))}
                          </ul>
                          {!confirmado && !permiteAlteracao && (
                            <p className="mt-3 rounded-xl border border-error/15 bg-error/[0.06] px-3 py-2 text-[10px] leading-relaxed text-error">
                              Pedido encerrado. Faça uma nova compra para
                              continuar.
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-white/15 px-5 py-12 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <BrandIcon name="bag" size={28} />
                </span>
                <h3 className="mt-4 font-headline text-xl">
                  {pedidos.length
                    ? "Nenhum pedido nesta situação"
                    : "Você ainda não possui pedidos"}
                </h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {pedidos.length
                    ? "Escolha outro filtro para consultar suas compras."
                    : "Escolha um produto no catálogo para realizar sua primeira compra."}
                </p>
                {pedidos.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroPedidos("todos");
                      carregarPedidos(1, "todos").catch(() =>
                        setErro("Não foi possível atualizar seus pedidos."),
                      );
                    }}
                    className="mt-5 rounded-full border border-primary/35 px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary"
                  >
                    Ver todos os pedidos
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAba("produtos")}
                    className="mt-5 rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary"
                  >
                    Ver produtos
                  </button>
                )}
              </div>
            )}
            <Pagination dados={paginacaoPedidos} onChange={carregarPedidos} />
          </section>
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

      {pedidoParaCancelar && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !cancelandoPedido)
              setPedidoParaCancelar(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-cancelar-pedido"
            aria-describedby="descricao-cancelar-pedido"
            className="w-full max-w-lg rounded-3xl border border-error/25 bg-surface-container-low p-5 shadow-2xl shadow-black/70 sm:p-7"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-error/25 bg-error/10 text-error">
              <BrandIcon name="alert" size={25} />
            </span>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-error">
              Ação de cancelamento
            </p>
            <h2
              id="titulo-cancelar-pedido"
              className="mt-1 font-headline text-2xl sm:text-3xl"
            >
              Cancelar pedido nº {pedidoParaCancelar.idpedido}?
            </h2>
            <p
              id="descricao-cancelar-pedido"
              className="mt-3 text-sm leading-relaxed text-on-surface-variant"
            >
              A sessão de pagamento será encerrada e este pedido permanecerá no
              seu histórico com o status cancelado. Depois disso, não será
              possível retomar o pagamento.
            </p>

            <dl className="mt-5 grid gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Conteúdo
                </dt>
                <dd className="mt-1 font-semibold">
                  {pedidoParaCancelar.itens.reduce(
                    (total, item) => total + Number(item.quantidade),
                    0,
                  )}{" "}
                  {pedidoParaCancelar.itens.reduce(
                    (total, item) => total + Number(item.quantidade),
                    0,
                  ) === 1
                    ? "item"
                    : "itens"}
                </dd>
              </div>
              <div className="sm:text-right">
                <dt className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Total
                </dt>
                <dd className="mt-1 font-headline text-xl text-primary">
                  {dinheiro(pedidoParaCancelar.total)}
                </dd>
              </div>
            </dl>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                ref={manterPedidoRef}
                type="button"
                onClick={() => setPedidoParaCancelar(null)}
                disabled={cancelandoPedido}
                className="min-h-12 rounded-full border border-white/15 px-5 text-xs font-bold uppercase tracking-wider text-on-surface hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-40"
              >
                Manter pedido
              </button>
              <button
                type="button"
                onClick={confirmarCancelamentoPedido}
                disabled={cancelandoPedido}
                className="min-h-12 rounded-full bg-error px-5 text-xs font-bold uppercase tracking-wider text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/70 disabled:cursor-wait disabled:opacity-60"
              >
                {cancelandoPedido ? "Cancelando..." : "Sim, cancelar pedido"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

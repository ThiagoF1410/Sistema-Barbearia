import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BrandIcon from '../components/ui/BrandIcon'
import { consultarCheckout, criarCheckout } from '../services/pagamentosService'
import { reabrirCheckoutPedido } from '../services/pedidosService'
import { CHAVE_CARRINHO } from '../hooks/useCarrinho'
import { abrirCheckoutEmNovaAba, fecharAbaPagamento, prepararAbaPagamento } from '../utils/checkoutWindow'
import useFeedbackFocus from '../hooks/useFeedbackFocus'

const MAX_CONSULTAS = 6
const INTERVALO_CONSULTA_MS = 2500
const STATUS_VALIDOS = new Set(['PENDENTE', 'CONFIRMADO', 'CANCELADO', 'FALHOU'])

const APRESENTACAO = {
  CONSULTANDO: {
    icone: 'clock',
    titulo: 'Verificando pagamento',
    descricao: 'Estamos consultando a Stripe. Não feche esta página enquanto a verificação estiver em andamento.',
    destaque: 'text-primary',
    fundo: 'border-primary/25 bg-primary/5',
  },
  CONFIRMADO: {
    icone: 'check',
    titulo: 'Pagamento aprovado ✅',
    descricao: 'A Stripe confirmou o pagamento. Seu horário está reservado e a confirmação será enviada pelo WhatsApp.',
    destaque: 'text-emerald-300',
    fundo: 'border-emerald-400/25 bg-emerald-500/5',
  },
  PENDENTE: {
    icone: 'clock',
    titulo: 'Pagamento em processamento',
    descricao: 'A Stripe ainda está processando o pagamento. Verifique novamente antes de iniciar uma nova cobrança.',
    destaque: 'text-amber-200',
    fundo: 'border-amber-400/25 bg-amber-500/5',
  },
  CANCELADO: {
    icone: 'alert',
    titulo: 'Pagamento não concluído',
    descricao: 'Nenhuma confirmação de pagamento foi recebida. Seu agendamento continua disponível no histórico.',
    destaque: 'text-amber-200',
    fundo: 'border-amber-400/25 bg-amber-500/5',
  },
  FALHOU: {
    icone: 'alert',
    titulo: 'Pagamento recusado ou interrompido',
    descricao: 'A cobrança não foi confirmada. Você pode iniciar uma nova tentativa de pagamento com segurança.',
    destaque: 'text-error',
    fundo: 'border-error/30 bg-error/5',
  },
  DESCONHECIDO: {
    icone: 'alert',
    titulo: 'Não foi possível verificar o pagamento',
    descricao: 'O status ainda é desconhecido. Consulte novamente antes de tentar outro pagamento.',
    destaque: 'text-error',
    fundo: 'border-error/30 bg-error/5',
  },
}

function idPositivo(valor) {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero > 0 ? numero : null
}

export default function CheckoutRetornoPage({ tipo }) {
  const [params] = useSearchParams()
  const retornoCancelado = tipo === 'cancelado'
  const sessionId = params.get('session_id')
  const idDaUrl = idPositivo(params.get('agendamento'))
  const pedidoDaUrl = idPositivo(params.get('pedido'))
  const tituloRef = useRef(null)
  const [agendamentoId, setAgendamentoId] = useState(idDaUrl)
  const [pedidoId, setPedidoId] = useState(pedidoDaUrl)
  const [statusPagamento, setStatusPagamento] = useState(
    retornoCancelado ? 'CANCELADO' : sessionId ? 'CONSULTANDO' : 'DESCONHECIDO'
  )
  const [consultando, setConsultando] = useState(!retornoCancelado && Boolean(sessionId))
  const [tentativaAtual, setTentativaAtual] = useState(0)
  const [cicloConsulta, setCicloConsulta] = useState(0)
  const [abrindoCheckout, setAbrindoCheckout] = useState(false)
  const [erro, setErro] = useState(
    !retornoCancelado && !sessionId ? 'A URL não contém uma sessão de pagamento válida.' : ''
  )
  const erroRef = useFeedbackFocus(erro)

  useEffect(() => {
    if (retornoCancelado || !sessionId) return undefined

    let ativa = true
    let tentativas = 0
    let temporizador

    async function atualizarStatus() {
      if (document.visibilityState !== 'visible') {
        temporizador = window.setTimeout(atualizarStatus, INTERVALO_CONSULTA_MS)
        return
      }
      tentativas += 1
      if (ativa) setTentativaAtual(tentativas)
      try {
        const resultado = await consultarCheckout(sessionId)
        if (!ativa) return

        const novoStatus = String(resultado.statuspagamento || '').toUpperCase()
        setAgendamentoId(idPositivo(resultado.agendamentoId))
        setPedidoId(idPositivo(resultado.pedidoId))
        setErro('')

        if (!STATUS_VALIDOS.has(novoStatus)) {
          setStatusPagamento('DESCONHECIDO')
          setConsultando(false)
          setErro('O servidor retornou um status de pagamento desconhecido.')
          return
        }

        setStatusPagamento(novoStatus)
        if (novoStatus === 'PENDENTE' && tentativas < MAX_CONSULTAS) {
          temporizador = window.setTimeout(atualizarStatus, INTERVALO_CONSULTA_MS)
          return
        }
        setConsultando(false)
      } catch (err) {
        if (!ativa) return
        if (tentativas < MAX_CONSULTAS) {
          temporizador = window.setTimeout(atualizarStatus, INTERVALO_CONSULTA_MS)
          return
        }
        setConsultando(false)
        setStatusPagamento('DESCONHECIDO')
        setErro(err.response?.data?.message || 'Não foi possível consultar o pagamento agora.')
      }
    }

    atualizarStatus()
    return () => {
      ativa = false
      window.clearTimeout(temporizador)
    }
  }, [cicloConsulta, retornoCancelado, sessionId])

  useEffect(() => {
    if (!consultando) tituloRef.current?.focus()
  }, [consultando, statusPagamento])

  useEffect(() => {
    if (statusPagamento === 'CONFIRMADO' && pedidoId && !agendamentoId) {
      localStorage.removeItem(CHAVE_CARRINHO)
    }
  }, [agendamentoId, pedidoId, statusPagamento])

  function consultarNovamente() {
    if (!sessionId || consultando) return
    setErro('')
    setStatusPagamento('CONSULTANDO')
    setConsultando(true)
    setTentativaAtual(0)
    setCicloConsulta((valor) => valor + 1)
  }

  async function tentarPagamentoNovamente() {
    if (!agendamentoId && !pedidoId) {
      setErro('Não foi possível identificar a compra. Abra seu painel para continuar.')
      return
    }

    const abaPagamento = prepararAbaPagamento()
    setAbrindoCheckout(true)
    setErro('')
    try {
      const checkout = agendamentoId
        ? await criarCheckout(agendamentoId)
        : await reabrirCheckoutPedido(pedidoId)
      abrirCheckoutEmNovaAba(checkout.checkoutUrl, abaPagamento)
    } catch (err) {
      fecharAbaPagamento(abaPagamento)
      setErro(err.response?.data?.message || 'Não foi possível abrir uma nova tentativa de pagamento.')
      setAbrindoCheckout(false)
    }
  }

  const estadoVisual = consultando ? 'CONSULTANDO' : statusPagamento
  const apresentacao = APRESENTACAO[estadoVisual] || APRESENTACAO.DESCONHECIDO
  const podeConsultar = !retornoCancelado
    && Boolean(sessionId)
    && ['PENDENTE', 'DESCONHECIDO'].includes(statusPagamento)
    && !consultando
  const podeTentarPagamento = Boolean(agendamentoId || pedidoId)
    && (retornoCancelado || ['CANCELADO', 'FALHOU'].includes(statusPagamento))
    && !consultando

  return (
    <main className="min-h-screen bg-background text-on-surface flex items-center justify-center px-4 py-8 sm:py-12">
      <section className={`w-full max-w-2xl glass-panel rounded-3xl border p-6 sm:p-10 ${apresentacao.fundo}`}>
        <div
          role="status"
          aria-live="polite"
          aria-busy={consultando}
          className="text-center"
        >
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-current/25 ${apresentacao.destaque}`}>
            <BrandIcon
              name={apresentacao.icone}
              size={46}
              className={consultando ? 'animate-pulse' : ''}
            />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-primary">
            Retorno do pagamento
          </p>
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="font-headline text-3xl sm:text-4xl mt-2 focus:outline-none"
          >
            {apresentacao.titulo}
          </h1>
          <p className="mx-auto max-w-lg text-sm sm:text-base text-on-surface-variant mt-3 leading-relaxed">
            {pedidoId && !agendamentoId && statusPagamento === 'CONFIRMADO'
              ? 'A Stripe confirmou o pagamento. Seu pedido será preparado para retirada na barbearia.'
              : apresentacao.descricao}
          </p>
        </div>

        {consultando && (
          <div
            className="mt-7"
            role="progressbar"
            aria-label="Verificação do pagamento"
            aria-valuemin={0}
            aria-valuemax={MAX_CONSULTAS}
            aria-valuenow={tentativaAtual}
          >
            <div className="mb-2 flex justify-between text-xs text-on-surface-variant">
              <span>Verificando com segurança</span>
              <span>{tentativaAtual}/{MAX_CONSULTAS}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.max(8, (tentativaAtual / MAX_CONSULTAS) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {!consultando && (
          <div className="mt-7 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-center text-xs text-on-surface-variant">
            {agendamentoId ? `Agendamento nº ${agendamentoId}` : pedidoId ? `Pedido nº ${pedidoId}` : 'Compra não identificada'}
            <span aria-hidden="true"> · </span>
            <span>Status: {statusPagamento.toLowerCase()}</span>
          </div>
        )}

        {erro && (
          <div ref={erroRef} role="alert" className="mt-5 rounded-2xl border border-error/40 bg-error/10 p-4 text-sm text-error">
            {erro}
          </div>
        )}

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {podeConsultar && (
            <button
              type="button"
              onClick={consultarNovamente}
              className="min-h-12 rounded-full bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary-hover"
            >
              Verificar novamente
            </button>
          )}
          {podeTentarPagamento && (
            <button
              type="button"
              onClick={tentarPagamentoNovamente}
              disabled={abrindoCheckout}
              className="min-h-12 rounded-full bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary-hover disabled:cursor-wait disabled:opacity-50"
            >
              {abrindoCheckout ? 'Abrindo checkout...' : 'Tentar pagamento novamente'}
            </button>
          )}
          <Link
            to={agendamentoId ? '/historico' : '/loja'}
            className="min-h-12 rounded-full border border-primary/35 px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10"
          >
            {agendamentoId ? 'Ver histórico' : 'Ver meus pedidos'}
          </Link>
          <Link
            to="/dashboard"
            className="min-h-12 rounded-full border border-white/15 px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:border-primary/35 hover:text-primary"
          >
            Voltar ao painel
          </Link>
        </div>

        {['PENDENTE', 'DESCONHECIDO'].includes(statusPagamento) && !consultando && (
          <p className="mt-5 text-center text-xs leading-relaxed text-on-surface-variant">
            Por segurança, não faça um novo pagamento enquanto o status estiver pendente ou desconhecido.
          </p>
        )}
      </section>
    </main>
  )
}

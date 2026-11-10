import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { obterCalendario, obterHorariosDisponiveis } from '../services/agendaService'
import { listarServicos } from '../services/servicosService'
import { listarProfissionais } from '../services/profissionaisService'
import { criarAgendamento } from '../services/agendamentosService'
import { criarCheckout, registrarPagamentoDinheiro } from '../services/pagamentosService'
import BrandIcon from '../components/ui/BrandIcon'
import PagamentoCountdown from '../components/PagamentoCountdown'
import { EtapaProfissional, EtapaServico, NavegacaoEtapas, ResumoEscolhas } from '../components/agendamento/EtapasAgendamento'
import { CalendarioAgendamento, HorariosAgendamento } from '../components/agendamento/DisponibilidadeAgendamento'
import useFeedbackFocus from '../hooks/useFeedbackFocus'
import { ETAPAS } from '../components/agendamento/etapas'
import logoImg from '../assets/Logo1.avif'
import { abrirCheckoutEmNovaAba, fecharAbaPagamento, prepararAbaPagamento } from '../utils/checkoutWindow'
import useCheckoutPolling from '../hooks/useCheckoutPolling'

const DESCRICAO_ETAPA = [
  'Selecione o atendimento que deseja realizar.',
  'Escolha quem cuidará do seu atendimento.',
  'Consulte os dias disponíveis para o profissional escolhido.',
  'Selecione um dos horários livres para continuar.',
  'Revise todas as informações antes de confirmar.',
]

export default function AgendamentoPage() {
  const { user, logout } = useAuth()
  const [referencia, setReferencia] = useState(() => {
    const hoje = new Date()
    return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }
  })
  const [dias, setDias] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [erro, setErro] = useState('')
  const erroRef = useFeedbackFocus(erro)
  const [carregando, setCarregando] = useState(true)
  const [servicos, setServicos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [produtosSelecionados, setProdutosSelecionados] = useState({})
  const [formaPagamento, setFormaPagamento] = useState('ONLINE')
  const [servicoSelecionado, setServicoSelecionado] = useState(null)
  const [profissionais, setProfissionais] = useState([])
  const [profissionalSelecionado, setProfissionalSelecionado] = useState(null)
  const [resultadoHorarios, setResultadoHorarios] = useState(null)
  const [horarioSelecionado, setHorarioSelecionado] = useState(null)
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [confirmado, setConfirmado] = useState(null)
  const [erroPagamento, setErroPagamento] = useState('')
  const [abrindoPagamento, setAbrindoPagamento] = useState(false)
  const [checkoutPendente, setCheckoutPendente] = useState(null)
  const [statusPagamento, setStatusPagamento] = useState('')
  const [etapa, setEtapa] = useState(0)
  const tituloEtapaRef = useRef(null)
  const consultaHorariosRef = useRef(0)
  const consultaCalendarioRef = useRef(0)
  useCheckoutPolling({
    sessionId: checkoutPendente?.sessionId,
    status: statusPagamento,
    aoConfirmar: () => setStatusPagamento('CONFIRMADO'),
    aoEncerrar: (status) => {
      setStatusPagamento(status)
      setErroPagamento(status === 'CANCELADO'
        ? 'O prazo do pagamento foi encerrado.'
        : 'O pagamento não foi aprovado. Tente novamente.')
    },
  })

  useEffect(() => {
    tituloEtapaRef.current?.focus()
  }, [etapa])

  useEffect(() => {
    listarServicos()
      .then((dados) => {
        setServicos(dados.filter((item) => item.tipo === 'servico'))
        setProdutos(dados.filter((item) => item.tipo === 'produto'))
      })
      .catch((err) => setErro(err.response?.data?.message || 'Não foi possível carregar os serviços. Tente novamente.'))
  }, [])

  useEffect(() => {
    listarProfissionais()
      .then(setProfissionais)
      .catch((err) => setErro(err.response?.data?.message || 'Não foi possível carregar os profissionais. Tente novamente.'))
  }, [])

  useEffect(() => {
    const consultaId = ++consultaCalendarioRef.current
    obterCalendario(
      referencia.ano,
      referencia.mes,
      servicoSelecionado?.idservico,
      profissionalSelecionado?.idprofissional
    )
      .then((resultado) => {
        if (consultaId === consultaCalendarioRef.current) setDias(resultado)
      })
      .catch((err) => {
        if (consultaId === consultaCalendarioRef.current) {
          setDias([])
          setErro(err.response?.data?.message || 'Não foi possível carregar o calendário. Tente novamente.')
        }
      })
      .finally(() => {
        if (consultaId === consultaCalendarioRef.current) setCarregando(false)
      })
    return () => {
      if (consultaCalendarioRef.current === consultaId) consultaCalendarioRef.current += 1
    }
  }, [referencia, servicoSelecionado?.idservico, profissionalSelecionado?.idprofissional])

  const tituloMes = useMemo(() => new Date(referencia.ano, referencia.mes - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), [referencia])

  const espacosIniciais = dias.length
    ? new Date(`${dias[0].data}T12:00:00`).getDay()
    : 0

  function mudarMes(direcao) {
    consultaHorariosRef.current += 1
    consultaCalendarioRef.current += 1
    setCarregando(true)
    setCarregandoHorarios(false)
    setErro('')
    setDias([])
    setSelecionado(null)
    setResultadoHorarios(null)
    setHorarioSelecionado(null)
    setReferencia((atual) => {
      const data = new Date(atual.ano, atual.mes - 1 + direcao, 1)
      return { ano: data.getFullYear(), mes: data.getMonth() + 1 }
    })
  }

  function escolherServico(servico) {
    consultaHorariosRef.current += 1
    consultaCalendarioRef.current += 1
    setCarregandoHorarios(false)
    setServicoSelecionado(servico)
    setProfissionalSelecionado(null)
    setSelecionado(null)
    setResultadoHorarios(null)
    setHorarioSelecionado(null)
    setErro('')
    setDias([])
    setCarregando(true)
    setEtapa(1)
  }

  function escolherProfissional(profissional) {
    consultaHorariosRef.current += 1
    consultaCalendarioRef.current += 1
    setCarregandoHorarios(false)
    setProfissionalSelecionado(profissional)
    setSelecionado(null)
    setResultadoHorarios(null)
    setHorarioSelecionado(null)
    setErro('')
    setDias([])
    setCarregando(true)
    setEtapa(2)
  }

  async function escolherData(dia, opcoes = {}) {
    if (!servicoSelecionado || !profissionalSelecionado) {
      setErro('Escolha um serviço e um profissional antes de selecionar a data.')
      return
    }
    const consultaId = ++consultaHorariosRef.current
    if (!opcoes.preservarErro) setErro('')
    setSelecionado(dia)
    setResultadoHorarios(null)
    setHorarioSelecionado(null)
    setCarregandoHorarios(true)
    try {
      const resultado = await obterHorariosDisponiveis(dia.data, servicoSelecionado.idservico, profissionalSelecionado.idprofissional)
      if (consultaId !== consultaHorariosRef.current) return
      setResultadoHorarios(resultado)
      setEtapa(3)
    } catch (err) {
      if (consultaId !== consultaHorariosRef.current) return
      setSelecionado(null)
      setResultadoHorarios(null)
      setErro(err.response?.data?.message || 'Não foi possível consultar os horários disponíveis. Tente novamente.')
    } finally {
      if (consultaId === consultaHorariosRef.current) setCarregandoHorarios(false)
    }
  }

  function escolherHorario(horario) {
    setHorarioSelecionado(horario)
    setErro('')
    setEtapa(4)
  }

  function etapaLiberada(indice) {
    if (indice === 0) return true
    if (indice === 1) return Boolean(servicoSelecionado)
    if (indice === 2) return Boolean(servicoSelecionado && profissionalSelecionado)
    if (indice === 3) return Boolean(servicoSelecionado && profissionalSelecionado && selecionado && resultadoHorarios)
    return Boolean(servicoSelecionado && profissionalSelecionado && selecionado && horarioSelecionado)
  }

  function abrirEtapa(indice) {
    if (etapaLiberada(indice)) {
      setErro('')
      setEtapa(indice)
    }
  }

  async function confirmarAgendamento() {
    if (!servicoSelecionado || !profissionalSelecionado || !selecionado || !horarioSelecionado) return
    const abaPagamento = formaPagamento === 'ONLINE' ? prepararAbaPagamento() : null
    setErro('')
    setConfirmando(true)
    try {
      const resultado = await criarAgendamento({
        servicoId: servicoSelecionado.idservico,
        profissionalId: profissionalSelecionado.idprofissional,
        data: selecionado.data,
        horario: horarioSelecionado.inicio,
      })
      setConfirmado({ ...resultado, formaPagamento })
      if (formaPagamento === 'ONLINE') await abrirCheckout(resultado.idagendamento, abaPagamento)
      else await registrarDinheiro(resultado.idagendamento)
    } catch (err) {
      fecharAbaPagamento(abaPagamento)
      setErro(err.response?.data?.message || 'Não foi possível confirmar o agendamento. Tente novamente.')
      if (err.response?.status === 409) {
        await escolherData(selecionado, { preservarErro: true })
      }
    } finally {
      setConfirmando(false)
    }
  }

  async function abrirCheckout(agendamentoId, abaPreparada = null) {
    setErroPagamento('')
    setAbrindoPagamento(true)
    try {
      const checkout = await criarCheckout(agendamentoId, itensSelecionados())
      setCheckoutPendente(checkout)
      setStatusPagamento('PENDENTE')
      setConfirmado((atual) => atual ? { ...atual, expiraEm: checkout.expiraEm } : atual)
      setAbrindoPagamento(false)
      abrirCheckoutEmNovaAba(checkout.checkoutUrl, abaPreparada)
    } catch (err) {
      fecharAbaPagamento(abaPreparada)
      setErroPagamento(err.response?.data?.message || 'O agendamento foi confirmado, mas não foi possível abrir o pagamento agora.')
      setAbrindoPagamento(false)
    }
  }

  function itensSelecionados() {
    return Object.entries(produtosSelecionados)
      .filter(([, quantidade]) => quantidade > 0)
      .map(([produtoId, quantidade]) => ({ produtoId: Number(produtoId), quantidade }))
  }

  async function registrarDinheiro(agendamentoId) {
    setErroPagamento('')
    setAbrindoPagamento(true)
    try {
      await registrarPagamentoDinheiro(agendamentoId, itensSelecionados())
    } catch (err) {
      setErroPagamento(err.response?.data?.message || 'O agendamento foi confirmado, mas não foi possível registrar o pagamento em dinheiro.')
    } finally {
      setAbrindoPagamento(false)
    }
  }

  function alterarProduto(produtoId, diferenca) {
    setProdutosSelecionados((atual) => {
      const quantidade = Math.min(20, Math.max(0, (atual[produtoId] || 0) + diferenca))
      const novo = { ...atual }
      if (quantidade) novo[produtoId] = quantidade
      else delete novo[produtoId]
      return novo
    })
  }

  const totalProdutos = produtos.reduce((total, produto) => (
    total + Number(produto.preco) * (produtosSelecionados[produto.idservico] || 0)
  ), 0)

  if (confirmado) return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-4">
      <section className="w-full max-w-xl glass-panel rounded-3xl border border-primary/25 p-7 sm:p-10 text-center">
        <BrandIcon name={statusPagamento === 'CONFIRMADO' ? 'check' : 'calendar'} size={48} className={statusPagamento === 'CONFIRMADO' ? 'mx-auto text-emerald-300' : 'text-primary mx-auto'} />
        <h1 className="font-headline text-3xl mt-4">{statusPagamento === 'CONFIRMADO' ? 'Pagamento aprovado ✅' : confirmado.formaPagamento === 'DINHEIRO' ? 'Agendamento confirmado' : 'Agendamento reservado'}</h1>
        <p className="text-on-surface-variant mt-2">{statusPagamento === 'CONFIRMADO' ? 'Pagamento confirmado. Seu atendimento está garantido.' : confirmado.formaPagamento === 'DINHEIRO' ? 'Seu atendimento foi reservado com sucesso.' : 'Aguardando a confirmação do pagamento.'}</p>
        <div className="mt-6 rounded-2xl bg-surface/70 border border-white/10 p-5 text-left space-y-2 text-sm">
          <p><strong>Serviço:</strong> {servicoSelecionado.nome}</p>
          <p><strong>Profissional:</strong> {profissionalSelecionado.nome}</p>
          <p><strong>Data:</strong> {new Date(`${confirmado.data}T12:00:00`).toLocaleDateString('pt-BR')}</p>
          <p><strong>Horário:</strong> {confirmado.horario}</p>
          <p><strong>Pagamento:</strong> {confirmado.formaPagamento === 'DINHEIRO' ? 'Dinheiro na barbearia' : 'On-line pelo Stripe'}</p>
        </div>
        {confirmado.formaPagamento === 'ONLINE' && statusPagamento === 'PENDENTE' && confirmado.expiraEm && <div className="mt-5 text-left"><div className="mb-3 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-amber-200">Aguardando pagamento</div><PagamentoCountdown expiraEm={confirmado.expiraEm} onExpire={() => { setCheckoutPendente(null); setStatusPagamento('CANCELADO'); setErroPagamento('O prazo para pagamento expirou. Faça um novo agendamento.') }} /><p className="mt-2 text-center text-[10px] text-on-surface-variant">A página será atualizada automaticamente quando o Stripe confirmar o pagamento.</p></div>}
        {confirmado.formaPagamento === 'DINHEIRO' && !erroPagamento && <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100"><strong>Pagamento na barbearia.</strong> O valor ficará pendente até o recebimento em dinheiro.</div>}
        {erroPagamento && <div role="alert" className="mt-5 rounded-2xl border border-error/40 bg-error/10 p-4 text-sm text-error">{erroPagamento}</div>}
        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
          {confirmado.formaPagamento === 'ONLINE' && statusPagamento !== 'CONFIRMADO' && <button type="button" onClick={() => checkoutPendente?.checkoutUrl ? abrirCheckoutEmNovaAba(checkoutPendente.checkoutUrl) : abrirCheckout(confirmado.idagendamento, prepararAbaPagamento())} disabled={abrindoPagamento}
            className="px-6 py-3 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50">
            {abrindoPagamento ? 'Preparando pagamento...' : checkoutPendente ? 'Ir para o pagamento agora' : 'Pagar agora'}
          </button>}
          {confirmado.formaPagamento === 'DINHEIRO' && erroPagamento && <button type="button" onClick={() => registrarDinheiro(confirmado.idagendamento)} disabled={abrindoPagamento} className="px-6 py-3 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50">{abrindoPagamento ? 'Registrando...' : 'Tentar novamente'}</button>}
          <Link to="/dashboard" className="px-6 py-3 border border-primary/35 text-primary rounded-full text-xs font-bold uppercase tracking-widest hover:bg-primary/10">Voltar ao painel</Link>
        </div>
      </section>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="sticky top-0 z-40 border-b border-primary/15 bg-black/90 shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/dashboard" className="group flex min-w-0 items-center gap-3" aria-label="Voltar ao painel do cliente">
            <img src={logoImg} alt="" width="44" height="44" decoding="async" className="h-11 w-11 shrink-0 object-contain" />
            <div className="hidden min-w-0 sm:block">
              <p className="font-headline text-lg leading-none transition-colors group-hover:text-primary">O Rei da Navalha</p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.24em] text-primary/75">Agendamento</p>
            </div>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/dashboard" className="hidden min-h-10 items-center rounded-full px-3 text-sm text-white/75 hover:bg-white/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:inline-flex">Painel</Link>
            <span className="hidden max-w-40 truncate text-sm text-white/65 md:block">{user?.nome || user?.name}</span>
            <button type="button" onClick={() => { logout(); window.location.href = '/login' }} className="flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-white/75 hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60 transition-colors">
              <BrandIcon name="logout" size={18} /><span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-10">
        <div className="relative mb-7 overflow-hidden rounded-3xl border border-primary/15 bg-[linear-gradient(120deg,rgba(245,197,24,0.085),rgba(255,255,255,0.02)_48%,transparent)] p-5 sm:p-7">
          <div aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/[0.05] blur-3xl" />
          <div className="relative flex items-start gap-3 sm:gap-4">
            <Link to="/dashboard" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-on-surface-variant hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" aria-label="Voltar ao painel"><BrandIcon name="back" size={19} /></Link>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Reserva online</p>
              <h1 className="mt-1 font-headline text-3xl sm:text-4xl">Agende seu atendimento</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">Siga as etapas para encontrar o melhor profissional, dia e horário. Sua reserva só será criada depois da confirmação.</p>
            </div>
          </div>
        </div>

        <NavegacaoEtapas etapa={etapa} etapaLiberada={etapaLiberada} abrirEtapa={abrirEtapa} />

        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Etapa {etapa + 1} de {ETAPAS.length}</p>
            <h2 ref={tituloEtapaRef} tabIndex="-1" className="mt-1 font-headline text-2xl outline-none sm:text-3xl">{ETAPAS[etapa].titulo}</h2>
            <p className="mt-1 text-xs text-on-surface-variant sm:text-sm">{DESCRICAO_ETAPA[etapa]}</p>
          </div>
          {etapa > 0 && <button type="button" onClick={() => abrirEtapa(etapa - 1)} className="flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-white/10 px-3 text-xs text-on-surface-variant hover:border-primary/35 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><BrandIcon name="back" size={18} />Voltar</button>}
        </div>

        {etapa === 0 && <EtapaServico servicos={servicos} selecionado={servicoSelecionado} aoSelecionar={escolherServico} />}

        {etapa === 1 && <EtapaProfissional profissionais={profissionais} selecionado={profissionalSelecionado} servicoSelecionado={servicoSelecionado} aoSelecionar={escolherProfissional} />}

        {erro && <div ref={erroRef} role="alert" className="mb-5 rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">{erro}</div>}

        <div className="grid gap-6">
          <CalendarioAgendamento
            visivel={etapa === 2}
            carregando={carregando}
            carregandoHorarios={carregandoHorarios}
            dias={dias}
            espacosIniciais={espacosIniciais}
            selecionado={selecionado}
            tituloMes={tituloMes}
            aoMudarMes={mudarMes}
            aoEscolherData={escolherData}
          />

          <HorariosAgendamento
            visivel={etapa === 3}
            selecionado={selecionado}
            carregando={carregandoHorarios}
            resultado={resultadoHorarios}
            horarioSelecionado={horarioSelecionado}
            aoEscolherHorario={escolherHorario}
          />
        </div>

        {etapa === 4 && (
          <section className="max-w-3xl mx-auto glass-panel rounded-3xl border border-primary/20 p-5 sm:p-7">
            <div className="flex items-center gap-3 mb-6"><BrandIcon name="check" size={34} className="text-primary" /><div><p className="text-[10px] uppercase tracking-widest text-primary font-bold">Última etapa</p><h3 className="font-headline text-2xl">Revise e confirme</h3></div></div>
            <dl className="grid sm:grid-cols-2 gap-4 rounded-2xl bg-surface/70 border border-white/10 p-5 text-sm">
              <div><dt className="text-xs text-on-surface-variant">Serviço</dt><dd className="mt-1">{servicoSelecionado.nome}</dd></div>
              <div><dt className="text-xs text-on-surface-variant">Profissional</dt><dd className="mt-1">{profissionalSelecionado.nome}</dd></div>
              <div><dt className="text-xs text-on-surface-variant">Data</dt><dd className="mt-1 capitalize">{new Date(`${selecionado.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</dd></div>
              <div><dt className="text-xs text-on-surface-variant">Horário</dt><dd className="mt-1">{horarioSelecionado.inicio}–{horarioSelecionado.fim}</dd></div>
              <div><dt className="text-xs text-on-surface-variant">Duração</dt><dd className="mt-1">{servicoSelecionado.duracao} minutos</dd></div>
              <div><dt className="text-xs text-on-surface-variant">Valor</dt><dd className="mt-1 font-bold text-primary">R$ {Number(servicoSelecionado.preco).toFixed(2)}</dd></div>
            </dl>
            {produtos.length > 0 && <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
              <div className="flex items-start gap-3"><BrandIcon name="bag" size={24} className="text-primary shrink-0"/><div><h4 className="font-semibold">Deseja adicionar algum produto?</h4><p className="text-xs text-on-surface-variant mt-1">Opcional. Os itens serão pagos junto com o serviço e retirados na barbearia.</p></div></div>
              <div className="grid gap-2 mt-4">{produtos.map((produto) => {
                const quantidade = produtosSelecionados[produto.idservico] || 0
                return <div key={produto.idservico} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/[0.07] p-3"><div><p className="text-sm font-semibold">{produto.nome}</p><p className="text-xs text-primary mt-1">R$ {Number(produto.preco).toFixed(2)}</p></div><div className="flex items-center justify-between sm:justify-end gap-3"><button type="button" onClick={() => alterarProduto(produto.idservico, -1)} disabled={!quantidade} className="w-9 h-9 rounded-full border border-white/10 disabled:opacity-30" aria-label={`Remover ${produto.nome}`}>−</button><span className="w-5 text-center text-sm font-bold">{quantidade}</span><button type="button" onClick={() => alterarProduto(produto.idservico, 1)} className="w-9 h-9 rounded-full border border-primary/30 text-primary" aria-label={`Adicionar ${produto.nome}`}>+</button></div></div>
              })}</div>
            </div>}
            <fieldset className="mt-5"><legend className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Forma de pagamento</legend><div className="mt-3 grid sm:grid-cols-2 gap-3"><button type="button" aria-pressed={formaPagamento === 'ONLINE'} onClick={() => setFormaPagamento('ONLINE')} className={`rounded-2xl border p-4 text-left transition-colors ${formaPagamento === 'ONLINE' ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-surface/60 hover:border-primary/25'}`}><div className="flex items-center gap-3"><span className={`w-10 h-10 rounded-xl flex items-center justify-center ${formaPagamento === 'ONLINE' ? 'bg-primary text-on-primary' : 'bg-white/5 text-on-surface-variant'}`}><BrandIcon name="card" size={21} /></span><div><strong className="text-sm">Pagamento on-line</strong><p className="text-xs text-on-surface-variant mt-1">Checkout seguro pelo Stripe</p></div></div></button><button type="button" aria-pressed={formaPagamento === 'DINHEIRO'} onClick={() => setFormaPagamento('DINHEIRO')} className={`rounded-2xl border p-4 text-left transition-colors ${formaPagamento === 'DINHEIRO' ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-surface/60 hover:border-primary/25'}`}><div className="flex items-center gap-3"><span className={`w-10 h-10 rounded-xl flex items-center justify-center ${formaPagamento === 'DINHEIRO' ? 'bg-primary text-on-primary' : 'bg-white/5 text-on-surface-variant'}`}><BrandIcon name="money" size={21} /></span><div><strong className="text-sm">Dinheiro</strong><p className="text-xs text-on-surface-variant mt-1">Pague presencialmente na barbearia</p></div></div></button></div></fieldset>
            <div className="mt-5 flex items-end justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4"><div><p className="text-xs text-on-surface-variant">Total no pagamento</p><p className="text-[10px] text-on-surface-variant mt-1">Serviço {totalProdutos > 0 ? '+ produtos' : ''}</p></div><strong className="font-headline text-2xl text-primary">R$ {(Number(servicoSelecionado.preco) + totalProdutos).toFixed(2)}</strong></div>
            <button type="button" onClick={confirmarAgendamento} disabled={confirmando}
              className="w-full mt-5 min-h-12 px-5 py-3.5 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary/10 hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-50">
              {confirmando ? 'Confirmando...' : formaPagamento === 'ONLINE' ? 'Confirmar e pagar on-line' : 'Confirmar e pagar em dinheiro'}
            </button>
          </section>
        )}

        <ResumoEscolhas servico={servicoSelecionado} profissional={profissionalSelecionado} data={selecionado} horario={horarioSelecionado} />
      </main>
    </div>
  )
}

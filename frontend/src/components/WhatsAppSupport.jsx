import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { consultarContatoWhatsApp } from '../services/whatsappService'
import { criarMensagemAtendimento, criarUrlAtendimento } from '../utils/whatsappSupportMessage'
import BrandIcon from './ui/BrandIcon'

const ASSUNTOS = [
  {
    codigo: 'REEMBOLSO',
    marcador: 'Reembolso',
    titulo: 'Solicitar reembolso',
    descricao: 'Atendimento para pagamentos já realizados.',
    orientacao: 'Gostaria de solicitar a análise de um reembolso referente a um pagamento realizado.',
    campos: ['Número do pedido ou agendamento', 'Valor pago', 'Motivo da solicitação'],
    icone: 'money',
  },
  {
    codigo: 'ALTERAR_AGENDAMENTO',
    marcador: 'Reagendamento',
    titulo: 'Alterar data ou horário',
    descricao: 'Consulte a possibilidade de remarcar seu atendimento.',
    orientacao: 'Gostaria de verificar a possibilidade de remarcar meu atendimento.',
    campos: ['Data e horário atuais', 'Profissional agendado', 'Nova data ou horário desejado'],
    icone: 'calendar',
  },
  {
    codigo: 'CANCELAR_AGENDAMENTO',
    marcador: 'Cancelamento',
    titulo: 'Cancelar agendamento',
    descricao: 'Solicite ajuda para cancelar uma reserva.',
    orientacao: 'Gostaria de solicitar o cancelamento do meu agendamento.',
    campos: ['Data e horário do agendamento', 'Profissional agendado', 'Motivo do cancelamento'],
    icone: 'close',
  },
  {
    codigo: 'DUVIDA_PAGAMENTO',
    marcador: 'Pagamento',
    titulo: 'Dúvidas sobre pagamento',
    descricao: 'Receba ajuda com cobranças e confirmações.',
    orientacao: 'Preciso de ajuda com um pagamento.',
    campos: ['Número do pedido ou agendamento', 'Forma de pagamento', 'Dúvida ou dificuldade encontrada'],
    icone: 'card',
  },
  {
    codigo: 'DUVIDA_PEDIDO',
    marcador: 'Pedido',
    titulo: 'Dúvidas sobre pedido',
    descricao: 'Fale sobre produtos, retirada ou situação do pedido.',
    orientacao: 'Gostaria de receber informações sobre meu pedido.',
    campos: ['Número do pedido', 'Produto relacionado', 'Dúvida sobre o pedido ou retirada'],
    icone: 'bag',
  },
  {
    codigo: 'OUTRO',
    marcador: 'Outro assunto',
    titulo: 'Outro assunto',
    descricao: 'Converse diretamente com nossa equipe.',
    orientacao: 'Gostaria de falar com a equipe sobre outro assunto.',
    campos: ['Como a equipe pode ajudar'],
    icone: 'message',
  },
]

const ROTAS_CLIENTE = /^\/(dashboard|agendar|historico|perfil|loja|sacola|servicos|checkout)(\/|$)/

export default function WhatsAppSupport() {
  const { user, isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const painelRef = useRef(null)
  const tituloRef = useRef(null)
  const [aberto, setAberto] = useState(false)
  const [contato, setContato] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const visivel = isAuthenticated && user?.role === 'cliente' && ROTAS_CLIENTE.test(pathname)
  const acimaDaSacola = pathname === '/loja'

  useEffect(() => {
    if (!aberto) return undefined
    tituloRef.current?.focus()

    function fechar(evento) {
      if (evento.key === 'Escape') setAberto(false)
      if (evento.type === 'pointerdown' && !painelRef.current?.contains(evento.target)) setAberto(false)
    }
    document.addEventListener('keydown', fechar)
    document.addEventListener('pointerdown', fechar)
    return () => {
      document.removeEventListener('keydown', fechar)
      document.removeEventListener('pointerdown', fechar)
    }
  }, [aberto])

  if (!visivel) return null

  async function abrirPainel() {
    setAberto(true)
    if (contato || carregando) return
    setCarregando(true)
    setErro('')
    try {
      setContato(await consultarContatoWhatsApp())
    } catch (falha) {
      setErro(falha.response?.data?.message || falha.message)
    } finally {
      setCarregando(false)
    }
  }

  function abrirWhatsApp(assunto) {
    if (!contato?.url) return
    const mensagem = criarMensagemAtendimento(assunto, user?.nome || user?.name)
    window.open(criarUrlAtendimento(contato.telefone, mensagem), '_blank', 'noopener,noreferrer')
    setAberto(false)
  }

  return (
    <div ref={painelRef} className={`fixed right-4 z-[65] sm:right-6 ${acimaDaSacola ? 'bottom-20 sm:bottom-6' : 'bottom-5 sm:bottom-6'}`}>
      {aberto && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="whatsapp-suporte-titulo"
          className="absolute bottom-16 right-0 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-3xl border border-emerald-400/25 bg-[#171a18] shadow-2xl shadow-black/60"
        >
          <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-emerald-500/[0.07] p-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white">
                <BrandIcon name="whatsapp" size={24} />
              </span>
              <div>
                <h2 ref={tituloRef} tabIndex="-1" id="whatsapp-suporte-titulo" className="font-headline text-xl outline-none">Como podemos ajudar?</h2>
                <p className="mt-1 text-[11px] text-on-surface-variant">Escolha o assunto para iniciar a conversa.</p>
              </div>
            </div>
            <button type="button" onClick={() => setAberto(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55 hover:bg-white/5 hover:text-white" aria-label="Fechar atendimento"><BrandIcon name="close" size={19} /></button>
          </header>

          <div className="max-h-[min(62vh,480px)] overflow-y-auto p-2">
            {carregando && <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-on-surface-variant" role="status"><span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400/25 border-t-emerald-400" />Conectando ao atendimento...</div>}
            {!carregando && erro && <div role="alert" className="m-2 rounded-2xl border border-error/25 bg-error/10 p-4 text-sm text-error"><p>{erro}</p><button type="button" onClick={() => { setContato(null); setErro(''); setAberto(false); window.setTimeout(() => abrirPainel(), 0) }} className="mt-3 text-xs font-bold underline">Tentar novamente</button></div>}
            {!carregando && !erro && contato && ASSUNTOS.map((assunto) => (
              <button key={assunto.codigo} type="button" onClick={() => abrirWhatsApp(assunto)} className="group flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"><BrandIcon name={assunto.icone} size={20} /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm">{assunto.titulo}</strong><span className="mt-0.5 block text-[10px] leading-relaxed text-on-surface-variant">{assunto.descricao}</span></span>
                <BrandIcon name="next" size={17} className="shrink-0 text-white/25 group-hover:text-emerald-300" />
              </button>
            ))}
          </div>

          {!carregando && !erro && contato && <p className="border-t border-white/[0.07] px-5 py-3 text-[9px] leading-relaxed text-white/40">A solicitação será registrada depois que você enviar a mensagem no WhatsApp.</p>}
        </section>
      )}

      <button
        type="button"
        onClick={aberto ? () => setAberto(false) : abrirPainel}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label={aberto ? 'Fechar atendimento pelo WhatsApp' : 'Abrir atendimento pelo WhatsApp'}
        className="group flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-emerald-500 text-white shadow-xl shadow-black/45 transition-transform hover:scale-105 hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:h-15 sm:w-15"
      >
        <BrandIcon name={aberto ? 'close' : 'whatsapp'} size={aberto ? 23 : 28} />
        {!aberto && <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-full border border-white/10 bg-[#181818] px-3 py-2 text-[10px] font-bold text-on-surface opacity-0 shadow-lg transition-opacity group-hover:opacity-100 sm:block">Precisa de ajuda?</span>}
      </button>
    </div>
  )
}

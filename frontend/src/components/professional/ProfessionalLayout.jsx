import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import BrandIcon from '../ui/BrandIcon'
import NotificationBell from '../NotificationBell'
import logoImg from '../../assets/Logo1.avif'

const NAVEGACAO = [
  { grupo: 'Visão geral', itens: [{ id: 'visao', label: 'Painel', icon: 'home' }] },
  { grupo: 'Rotina', itens: [
    { id: 'agenda', label: 'Minha agenda', icon: 'calendar' },
    { id: 'escala', label: 'Minha escala', icon: 'clock' },
  ] },
  { grupo: 'Disponibilidade', itens: [{ id: 'solicitacoes', label: 'Solicitações', icon: 'message' }] },
]

export default function ProfessionalLayout({ children, aba, aoSelecionar, perfil, titulo, subtitulo }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuAberto, setMenuAberto] = useState(false)
  const [recolhida, setRecolhida] = useState(() => localStorage.getItem('professional-sidebar') === 'recolhida')
  const nome = perfil?.nome || user?.nome || user?.name || user?.email || 'Profissional'
  const especialidade = perfil?.especialidade || 'Profissional'

  useEffect(() => {
    if (!menuAberto) return undefined
    const overflowAnterior = document.body.style.overflow
    const fecharComEscape = (event) => { if (event.key === 'Escape') setMenuAberto(false) }
    document.addEventListener('keydown', fecharComEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', fecharComEscape)
      document.body.style.overflow = overflowAnterior
    }
  }, [menuAberto])

  function selecionar(id) {
    aoSelecionar(id)
    setMenuAberto(false)
  }

  function alternarSidebar() {
    setRecolhida((valor) => {
      localStorage.setItem('professional-sidebar', valor ? 'expandida' : 'recolhida')
      return !valor
    })
  }

  function sair() {
    logout()
    navigate('/login')
  }

  return <div className="min-h-screen bg-background text-on-surface">
    {menuAberto && <button type="button" onClick={() => setMenuAberto(false)} className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden" aria-label="Fechar menu profissional" />}

    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-primary/15 bg-[#0b0b0b]/98 shadow-2xl transition-all duration-300 ${menuAberto ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${recolhida ? 'lg:w-20' : 'lg:w-64'}`} aria-label="Navegação da área profissional">
      <div className="flex h-20 items-center justify-between gap-3 border-b border-white/[0.07] px-4">
        <button type="button" onClick={() => selecionar('visao')} className="flex min-w-0 items-center gap-3 text-left">
          <img src={logoImg} alt="" width="44" height="44" decoding="async" className="h-11 w-11 shrink-0 object-contain" />
          <div className={`${recolhida ? 'lg:hidden' : ''} min-w-0`}><p className="truncate font-headline text-lg">O Rei da Navalha</p><p className="mt-1 text-[8px] font-bold uppercase tracking-[0.22em] text-primary">Área do profissional</p></div>
        </button>
        <button type="button" onClick={() => setMenuAberto(false)} className="rounded-xl p-2 text-white/70 hover:bg-white/5 hover:text-primary lg:hidden" aria-label="Fechar menu"><BrandIcon name="close" size={21} /></button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {NAVEGACAO.map((secao) => <div key={secao.grupo}>
          <p className={`mb-2 px-3 text-[8px] font-bold uppercase tracking-[0.2em] text-white/35 ${recolhida ? 'lg:sr-only' : ''}`}>{secao.grupo}</p>
          <div className="space-y-1">{secao.itens.map((item) => {
            const ativo = aba === item.id
            return <button key={item.id} type="button" onClick={() => selecionar(item.id)} title={recolhida ? item.label : undefined} aria-current={ativo ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${ativo ? 'border border-primary/20 bg-primary/10 text-primary' : 'text-white/65 hover:bg-white/[0.05] hover:text-white'} ${recolhida ? 'lg:justify-center' : ''}`}><BrandIcon name={item.icon} size={21} className="shrink-0" /><span className={recolhida ? 'lg:sr-only' : ''}>{item.label}</span></button>
          })}</div>
        </div>)}
      </nav>

      <div className="border-t border-white/[0.07] p-3">
        <div className={`rounded-2xl bg-white/[0.035] p-3 ${recolhida ? 'lg:flex lg:justify-center' : ''}`}>
          <div className={`flex min-w-0 items-center gap-3 ${recolhida ? 'lg:justify-center' : ''}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="professional" size={19} /></div><div className={`${recolhida ? 'lg:sr-only' : ''} min-w-0`}><p className="truncate text-xs font-semibold">{nome}</p><p className="mt-0.5 truncate text-[9px] text-on-surface-variant">{especialidade}</p></div></div>
          <button type="button" onClick={sair} title={recolhida ? 'Sair' : undefined} className={`mt-3 flex min-h-9 w-full items-center gap-2 rounded-xl px-2 text-xs text-white/55 hover:bg-error/10 hover:text-error ${recolhida ? 'lg:mt-0 lg:w-auto lg:justify-center' : ''}`}><BrandIcon name="logout" size={17} /><span className={recolhida ? 'lg:sr-only' : ''}>Sair</span></button>
        </div>
      </div>

      <button type="button" onClick={alternarSidebar} className="absolute -right-3 top-24 hidden h-7 w-7 items-center justify-center rounded-full border border-primary/25 bg-surface text-primary shadow-lg hover:bg-primary hover:text-on-primary lg:flex" aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}><BrandIcon name={recolhida ? 'next' : 'back'} size={15} /></button>
    </aside>

    <div className={`min-h-screen transition-[padding] duration-300 ${recolhida ? 'lg:pl-20' : 'lg:pl-64'}`}>
      <header className="sticky top-0 z-30 h-16 border-b border-primary/15 bg-black/85 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setMenuAberto(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/80 hover:border-primary/40 hover:text-primary lg:hidden" aria-label="Abrir menu profissional" aria-expanded={menuAberto}><BrandIcon name="menu" size={22} /></button><div className="min-w-0"><p className="truncate font-headline text-lg">{titulo}</p><p className="hidden truncate text-[9px] uppercase tracking-wider text-on-surface-variant sm:block">{subtitulo}</p></div></div>
          <div className="flex items-center gap-2"><NotificationBell /><span className="hidden text-xs text-white/60 md:inline">{nome}</span><span className="hidden rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-primary sm:inline">Profissional</span></div>
        </div>
      </header>
      {children}
    </div>
  </div>
}

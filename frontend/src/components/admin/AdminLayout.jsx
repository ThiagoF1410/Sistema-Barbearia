import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import BrandIcon from '../ui/BrandIcon'
import logoImg from '../../assets/Logo1.avif'
import NotificationBell from '../NotificationBell'

const navegacao = [
  { grupo: 'Visão geral', itens: [{ icon: 'home', label: 'Painel', to: '/admin' }] },
  { grupo: 'Operação', itens: [
    { icon: 'calendar', label: 'Agendamentos', to: '/admin/agendamentos' },
    { icon: 'clock', label: 'Agenda', to: '/admin/agenda' },
    { icon: 'professional', label: 'Profissionais', to: '/admin/profissionais' },
  ] },
  { grupo: 'Catálogo', itens: [{ icon: 'razor', label: 'Serviços', to: '/admin/servicos' }] },
  { grupo: 'Financeiro', itens: [
    { icon: 'chart', label: 'Pagamentos', to: '/admin/pagamentos' },
    { icon: 'chart', label: 'Relatórios', to: '/admin/relatorios' },
  ] },
  { grupo: 'Cadastros', itens: [{ icon: 'users', label: 'Clientes', to: '/admin/clientes' }] },
]

export default function AdminLayout({ children, titulo = 'Painel administrativo', subtitulo = 'Gestão da barbearia' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)
  const [recolhida, setRecolhida] = useState(() => localStorage.getItem('admin-sidebar') === 'recolhida')

  useEffect(() => {
    if (!menuAberto) return undefined
    const desktop = window.matchMedia('(min-width: 1024px)')
    const fecharNoDesktop = () => { if (desktop.matches) setMenuAberto(false) }
    desktop.addEventListener('change', fecharNoDesktop)
    function fecharComEscape(event) { if (event.key === 'Escape') setMenuAberto(false) }
    document.addEventListener('keydown', fecharComEscape)
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      desktop.removeEventListener('change', fecharNoDesktop)
      document.removeEventListener('keydown', fecharComEscape)
      document.body.style.overflow = overflowAnterior
    }
  }, [menuAberto])

  function itemAtivo(to) {
    if (to === '/admin') return location.pathname === '/admin'
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  function alternarSidebar() {
    setRecolhida((valor) => {
      localStorage.setItem('admin-sidebar', valor ? 'expandida' : 'recolhida')
      return !valor
    })
  }

  function sair() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {menuAberto && <button type="button" onClick={() => setMenuAberto(false)} className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden" aria-label="Fechar menu administrativo" />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-primary/15 bg-[#0b0b0b]/98 shadow-2xl transition-all duration-300 ${menuAberto ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${recolhida ? 'lg:w-20' : 'lg:w-64'}`} aria-label="Navegação administrativa">
        <div className="h-20 px-4 flex items-center justify-between gap-3 border-b border-white/[0.07]">
          <Link to="/admin" onClick={() => setMenuAberto(false)} className="flex items-center gap-3 min-w-0">
            <img src={logoImg} alt="" width="44" height="44" decoding="async" className="w-11 h-11 object-contain shrink-0" />
            <div className={`${recolhida ? 'lg:hidden' : ''} min-w-0`}><p className="font-headline text-lg truncate">O Rei da Navalha</p><p className="text-xs uppercase tracking-[0.22em] text-primary mt-1">Administração</p></div>
          </Link>
          <button type="button" onClick={() => setMenuAberto(false)} className="lg:hidden p-2 rounded-xl text-white/70 hover:bg-white/5 hover:text-primary" aria-label="Fechar menu"><BrandIcon name="close" size={21} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-5">
          {navegacao.map((secao) => <div key={secao.grupo}>
            <p className={`px-3 mb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/35 ${recolhida ? 'lg:sr-only' : ''}`}>{secao.grupo}</p>
            <div className="space-y-1">{secao.itens.map((item) => {
              const ativo = itemAtivo(item.to)
              return <Link key={item.to} to={item.to} onClick={() => setMenuAberto(false)} title={recolhida ? item.label : undefined} aria-current={ativo ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${ativo ? 'border border-primary/20 bg-primary/10 text-primary' : 'text-white/65 hover:bg-white/[0.05] hover:text-white'} ${recolhida ? 'lg:justify-center' : ''}`}><BrandIcon name={item.icon} size={21} className="shrink-0" /><span className={recolhida ? 'lg:sr-only' : ''}>{item.label}</span></Link>
            })}</div>
          </div>)}
        </nav>

        <div className="border-t border-white/[0.07] p-3">
          <div className={`rounded-2xl bg-white/[0.035] p-3 ${recolhida ? 'lg:flex lg:justify-center' : ''}`}>
            <div className={`flex items-center gap-3 min-w-0 ${recolhida ? 'lg:justify-center' : ''}`}><div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0"><BrandIcon name="profile" size={19} /></div><div className={`${recolhida ? 'lg:sr-only' : ''} min-w-0`}><p className="text-xs font-semibold truncate">{user?.nome || user?.name || user?.email}</p><p className="text-xs uppercase tracking-wider text-on-surface-variant mt-0.5">Administrador</p></div></div>
            <button type="button" onClick={sair} title={recolhida ? 'Sair' : undefined} className={`mt-3 w-full min-h-9 flex items-center gap-2 rounded-xl px-2 text-xs text-white/55 hover:bg-error/10 hover:text-error ${recolhida ? 'lg:mt-0 lg:w-auto lg:justify-center' : ''}`}><BrandIcon name="logout" size={17} /><span className={recolhida ? 'lg:sr-only' : ''}>Sair</span></button>
          </div>
        </div>

        <button type="button" onClick={alternarSidebar} className="hidden lg:flex absolute -right-3 top-24 w-7 h-7 items-center justify-center rounded-full border border-primary/25 bg-surface text-primary shadow-lg hover:bg-primary hover:text-on-primary" aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}><BrandIcon name={recolhida ? 'next' : 'back'} size={15} /></button>
      </aside>

      <div className={`min-h-screen transition-[padding] duration-300 ${recolhida ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-30 h-16 border-b border-primary/15 bg-black/85 backdrop-blur-xl">
          <div className="h-full max-w-[1480px] mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3"><button type="button" onClick={() => setMenuAberto(true)} className="lg:hidden w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-white/80 hover:border-primary/40 hover:text-primary" aria-label="Abrir menu administrativo" aria-expanded={menuAberto}><BrandIcon name="menu" size={22} /></button><div><p className="font-headline text-lg">{titulo}</p><p className="hidden sm:block text-xs uppercase tracking-wider text-on-surface-variant">{subtitulo}</p></div></div>
            <div className="flex items-center gap-2 text-sm"><NotificationBell /><span className="hidden md:inline text-white/60">{user?.nome || user?.name || user?.email}</span><span className="hidden rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary sm:inline">Administrador</span></div>
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}

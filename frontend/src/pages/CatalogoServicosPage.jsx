import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listarServicos } from '../services/servicosService'
import BrandIcon from '../components/ui/BrandIcon'
import useFeedbackFocus from '../hooks/useFeedbackFocus'

const dinheiro = (valor) => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function CatalogoServicosPage() {
  const { user, logout } = useAuth()
  const [servicos, setServicos] = useState([])
  const [erro, setErro] = useState('')
  const erroRef = useFeedbackFocus(erro)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    listarServicos()
      .then((dados) => setServicos(dados.filter((item) => item.tipo === 'servico')))
      .catch((err) => setErro(err.response?.data?.message || 'Não foi possível carregar os serviços.'))
      .finally(() => setCarregando(false))
  }, [])

  return <div className="min-h-screen bg-background text-on-surface">
    <header className="sticky top-0 z-30 border-b border-primary/15 bg-black/90 backdrop-blur-xl"><div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4"><Link to="/dashboard" className="font-headline text-xl hover:text-primary">O Rei da Navalha</Link><div className="flex items-center gap-3 sm:gap-5"><Link to="/loja" className="flex items-center gap-2 rounded-full border border-primary/30 px-3 py-2 text-sm text-primary hover:bg-primary/10"><BrandIcon name="bag" size={18}/>Loja</Link><span className="hidden md:block text-sm text-on-surface-variant">{user?.nome || user?.name}</span><button type="button" onClick={() => { logout(); window.location.href = '/login' }} className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-error"><BrandIcon name="logout" size={18}/>Sair</button></div></div></header>
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Atendimentos</p><div className="mt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><h1 className="font-headline text-3xl sm:text-4xl">Serviços disponíveis</h1><p className="text-sm text-on-surface-variant mt-2">Conheça os serviços e escolha o melhor horário para seu atendimento.</p></div><Link to="/agendar" className="w-fit rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-widest text-on-primary">Agendar horário</Link></div>
      {erro && <div ref={erroRef} role="alert" className="mt-6 rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">{erro}</div>}
      {carregando ? <p className="mt-8 text-sm text-on-surface-variant">Carregando serviços...</p> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">{servicos.map((item) => <article key={item.idservico} className="brand-card glass-panel p-5 border border-white/10 flex flex-col"><div className="flex justify-between gap-3"><h2 className="font-headline text-xl">{item.nome}</h2><span className="font-bold text-primary shrink-0">{dinheiro(item.preco)}</span></div><p className="text-xs text-on-surface-variant mt-2 flex-1">{item.descricao}</p><div className="mt-5 flex items-center justify-between"><span className="text-xs text-on-surface-variant">{item.duracao} min</span><Link to="/agendar" className="text-xs font-bold uppercase tracking-wider text-primary hover:underline">Agendar</Link></div></article>)}</div>}
    </main>
  </div>
}

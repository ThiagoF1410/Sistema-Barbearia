import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listarServicos } from '../services/servicosService'
import BrandIcon from '../components/ui/BrandIcon'

export default function ServicosPage() {
  const { user, logout } = useAuth()
  const [servicos, setServicos] = useState([])
  const [erro, setErro]         = useState('')

  useEffect(() => {
    listarServicos()
      .then(setServicos)
      .catch(() => setErro('Erro ao carregar serviços.'))
  }, [])

  const servicesOnly  = servicos.filter(s => s.tipo === 'servico')
  const produtosOnly  = servicos.filter(s => s.tipo === 'produto')

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 bg-surface border-b border-outline-variant">
        <Link to="/dashboard" className="font-headline text-xl text-on-surface hover:text-primary transition-colors">
          O Rei da Navalha
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-on-surface-variant">{user?.nome || user?.name}</span>
          <button
            onClick={() => { logout(); window.location.href = '/login' }}
            className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-error transition-colors"
          >
            <BrandIcon name="logout" size={18} />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-on-surface-variant hover:text-primary transition-colors">
            <BrandIcon name="back" />
          </Link>
          <h1 className="font-headline text-3xl">Serviços & Produtos</h1>
        </div>

        {erro && <p className="text-error text-sm">{erro}</p>}

        {servicesOnly.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-headline text-xl">Serviços</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {servicesOnly.map((s) => (
                <div key={s.idservico} className="brand-card glass-panel p-6 border border-outline-variant/10 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-label font-bold text-sm uppercase tracking-widest">{s.nome}</h3>
                    <span className="font-headline text-lg text-primary shrink-0">R$ {Number(s.preco).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">{s.duracao} minutos</p>
                  {s.descricao && <p className="text-xs text-on-surface-variant">{s.descricao}</p>}
                  <Link
                    to="/agendar"
                    className="inline-block mt-2 px-4 py-1.5 bg-primary text-on-primary rounded-full text-xs font-label font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                  >
                    Agendar
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {produtosOnly.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-headline text-xl">Produtos</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {produtosOnly.map((s) => (
                <div key={s.idservico} className="brand-card glass-panel p-6 border border-outline-variant/10 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-label font-bold text-sm uppercase tracking-widest">{s.nome}</h3>
                    <span className="font-headline text-lg text-primary shrink-0">R$ {Number(s.preco).toFixed(2)}</span>
                  </div>
                  {s.descricao && <p className="text-xs text-on-surface-variant">{s.descricao}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {servicos.length === 0 && !erro && (
          <div className="glass-panel rounded-2xl p-8 text-center border border-outline-variant/10">
            <BrandIcon name="razor" size={42} className="text-on-surface-variant mx-auto mb-2" />
            <p className="text-on-surface-variant text-sm">Nenhum serviço disponível no momento.</p>
          </div>
        )}
      </main>
    </div>
  )
}

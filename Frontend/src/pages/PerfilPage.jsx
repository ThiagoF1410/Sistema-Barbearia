import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandIcon from '../components/ui/BrandIcon'

export default function PerfilPage() {
  const { user } = useAuth()
  const nome = user?.nome || user?.name || 'Cliente'
  const email = user?.email || 'Não informado'

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="px-4 sm:px-6 py-4 bg-surface border-b border-outline-variant/40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Link to="/dashboard" className="font-headline text-lg sm:text-xl hover:text-primary transition-colors">
            O Rei da Navalha
          </Link>
          <Link to="/dashboard" className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary transition-colors">
            <BrandIcon name="back" size={18} />Painel
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold">Área do cliente</p>
          <h1 className="font-headline text-3xl sm:text-4xl mt-2">Meu perfil</h1>
          <p className="text-sm text-on-surface-variant mt-2">Confira os dados vinculados à sua conta.</p>
        </div>

        <section aria-labelledby="dados-perfil" className="glass-panel rounded-3xl border border-white/10 p-5 sm:p-7">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
              <BrandIcon name="profile" size={27} />
            </div>
            <div>
              <h2 id="dados-perfil" className="font-headline text-2xl">Dados pessoais</h2>
              <p className="text-xs text-on-surface-variant mt-1">Cadastro utilizado nos agendamentos.</p>
            </div>
          </div>

          <dl className="grid sm:grid-cols-2 gap-4 rounded-2xl bg-surface/70 border border-white/10 p-5 text-sm">
            <div><dt className="text-xs text-on-surface-variant">Nome</dt><dd className="mt-1 break-words">{nome}</dd></div>
            <div><dt className="text-xs text-on-surface-variant">E-mail</dt><dd className="mt-1 break-all">{email}</dd></div>
            <div><dt className="text-xs text-on-surface-variant">Perfil</dt><dd className="mt-1">Cliente</dd></div>
          </dl>

          <p className="mt-5 text-xs leading-relaxed text-on-surface-variant">
            A edição dos dados será disponibilizada em uma próxima etapa. Para alterar informações agora, entre em contato com a barbearia.
          </p>
        </section>
      </main>
    </div>
  )
}

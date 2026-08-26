<<<<<<< HEAD:Frontend/src/routes/AppRoutes.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Páginas (importação lazy para melhor performance)
import LoginPage    from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'

// Placeholder para as demais telas (implementadas nas próximas etapas)
const Placeholder = ({ title }) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <span className="material-symbols-outlined text-primary text-6xl block">construction</span>
      <h1 className="font-headline text-3xl text-on-surface">{title}</h1>
      <p className="text-on-surface-variant text-sm">Tela em desenvolvimento</p>
    </div>
  </div>
)

// Guarda de rota privada
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// Guarda de rota pública (redireciona usuário logado para o dashboard)
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota raiz → redireciona para landing ou dashboard */}
        <Route path="/" element={<Navigate to="/inicio" replace />} />

        {/* Rotas públicas */}
        <Route path="/inicio"   element={<Placeholder title="Landing Page" />} />
        <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/cadastro" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        {/* Rotas privadas — Cliente */}
        <Route path="/dashboard"   element={<PrivateRoute><Placeholder title="Dashboard do Cliente" /></PrivateRoute>} />
        <Route path="/agendar"     element={<PrivateRoute><Placeholder title="Agendamento" /></PrivateRoute>} />
        <Route path="/checkout"    element={<PrivateRoute><Placeholder title="Checkout" /></PrivateRoute>} />

        {/* Rotas privadas — Admin */}
        <Route path="/admin" element={<PrivateRoute><Placeholder title="Painel Administrativo" /></PrivateRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
=======
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandIcon          from '../components/ui/BrandIcon'

const LoginPage = lazy(() => import('../pages/LoginPage'))
const RegisterPage = lazy(() => import('../pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'))
const TermsPage = lazy(() => import('../pages/TermsPage'))
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'))
const LandingPage = lazy(() => import('../pages/LandingPage'))
const DashboardPage = lazy(() => import('../pages/DashboardPage'))
const AdminPage = lazy(() => import('../pages/AdminPage'))
const ServicosPage = lazy(() => import('../pages/ServicosPage'))
const ServicosAdminPage = lazy(() => import('../pages/admin/ServicosAdminPage'))
const AgendaAdminPage = lazy(() => import('../pages/admin/AgendaAdminPage'))
const AgendamentosAdminPage = lazy(() => import('../pages/admin/AgendamentosAdminPage'))
const AgendamentoPage = lazy(() => import('../pages/AgendamentoPage'))
const HistoricoPage = lazy(() => import('../pages/HistoricoPage'))
const CheckoutRetornoPage = lazy(() => import('../pages/CheckoutRetornoPage'))
const PerfilPage = lazy(() => import('../pages/PerfilPage'))

function CarregandoPagina() {
  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center" role="status" aria-live="polite">
      <div className="text-center space-y-3">
        <BrandIcon name="crown" size={34} className="text-primary mx-auto animate-pulse" />
        <p className="text-sm text-on-surface-variant">Carregando...</p>
      </div>
    </div>
  )
}

const Placeholder = ({ title }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 bg-surface border-b border-outline-variant">
        <h1 className="font-headline text-xl text-on-surface">O Rei da Navalha</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-on-surface-variant">{user?.nome || user?.name || user?.email}</span>
          <button onClick={() => { logout(); navigate('/login') }}
            className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-error transition-colors">
            <BrandIcon name="logout" size={18} />Sair
          </button>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <BrandIcon name="razor" size={56} className="text-primary mx-auto" />
          <h1 className="font-headline text-3xl text-on-surface">{title}</h1>
          <p className="text-on-surface-variant text-sm">Tela em desenvolvimento</p>
        </div>
      </div>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function ClientRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'profissional') return <Navigate to="/profissional" replace />
  if (user?.role !== 'cliente') return <Navigate to="/inicio" replace />
  return children
}

function AdminRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function ProfessionalRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'cliente') return <Navigate to="/dashboard" replace />
  if (user?.role !== 'profissional') return <Navigate to="/inicio" replace />
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return children
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'profissional') return <Navigate to="/profissional" replace />
  return <Navigate to="/dashboard" replace />
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<CarregandoPagina />}>
        <Routes>
        <Route path="/" element={<Navigate to="/inicio" replace />} />

        {/* Públicas */}
        <Route path="/inicio"        element={<LandingPage />} />
        <Route path="/login"         element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/cadastro"      element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="/resetar-senha" element={<ResetPasswordPage />} />
        <Route path="/termos"        element={<TermsPage />} />
        <Route path="/privacidade"   element={<PrivacyPage />} />

        {/* Cliente */}
        <Route path="/dashboard" element={<ClientRoute><DashboardPage /></ClientRoute>} />
        <Route path="/servicos"  element={<PrivateRoute><ServicosPage /></PrivateRoute>} />
        <Route path="/agendar"   element={<ClientRoute><AgendamentoPage /></ClientRoute>} />
        <Route path="/historico" element={<ClientRoute><HistoricoPage /></ClientRoute>} />
        <Route path="/perfil"    element={<ClientRoute><PerfilPage /></ClientRoute>} />
        <Route path="/checkout/sucesso" element={<ClientRoute><CheckoutRetornoPage tipo="sucesso" /></ClientRoute>} />
        <Route path="/checkout/cancelado" element={<ClientRoute><CheckoutRetornoPage tipo="cancelado" /></ClientRoute>} />

        {/* Profissional */}
        <Route path="/profissional" element={<ProfessionalRoute><Placeholder title="Área do profissional" /></ProfessionalRoute>} />

        {/* Admin */}
        <Route path="/admin"                element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="/admin/servicos"       element={<AdminRoute><ServicosAdminPage /></AdminRoute>} />
        <Route path="/admin/agenda"         element={<AdminRoute><AgendaAdminPage /></AdminRoute>} />
        <Route path="/admin/agendamentos"   element={<AdminRoute><AgendamentosAdminPage /></AdminRoute>} />
        <Route path="/admin/profissionais"  element={<AdminRoute><Placeholder title="Profissionais" /></AdminRoute>} />
        <Route path="/admin/clientes"       element={<AdminRoute><Placeholder title="Clientes" /></AdminRoute>} />
        <Route path="/admin/relatorios"     element={<AdminRoute><Placeholder title="Relatórios" /></AdminRoute>} />
        <Route path="/admin/config"         element={<AdminRoute><Placeholder title="Configurações" /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
>>>>>>> fd3eb50 (Commit Projeto):frontend/src/routes/AppRoutes.jsx

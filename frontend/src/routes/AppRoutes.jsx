import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandIcon from '../components/ui/BrandIcon'
import WhatsAppSupport from '../components/WhatsAppSupport'

const LoginPage = lazy(() => import('../pages/LoginPage'))
const RegisterPage = lazy(() => import('../pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'))
const TermsPage = lazy(() => import('../pages/TermsPage'))
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'))
const LandingPage = lazy(() => import('../pages/LandingPage'))
const DashboardPage = lazy(() => import('../pages/DashboardPage'))
const AdminPage = lazy(() => import('../pages/AdminPage'))
const LojaPage = lazy(() => import('../pages/ServicosPage'))
const CatalogoServicosPage = lazy(() => import('../pages/CatalogoServicosPage'))
const SacolaPage = lazy(() => import('../pages/SacolaPage'))
const ServicosAdminPage = lazy(() => import('../pages/admin/ServicosAdminPage'))
const AgendaAdminPage = lazy(() => import('../pages/admin/AgendaAdminPage'))
const AgendamentosAdminPage = lazy(() => import('../pages/admin/AgendamentosAdminPage'))
const PagamentosAdminPage = lazy(() => import('../pages/admin/PagamentosAdminPage'))
const RelatoriosAdminPage = lazy(() => import('../pages/admin/RelatoriosAdminPage'))
const ProfissionaisAdminPage = lazy(() => import('../pages/admin/ProfissionaisAdminPage'))
const ClientesAdminPage = lazy(() => import('../pages/admin/ClientesAdminPage'))
const AgendamentoPage = lazy(() => import('../pages/AgendamentoPage'))
const HistoricoPage = lazy(() => import('../pages/HistoricoPage'))
const CheckoutRetornoPage = lazy(() => import('../pages/CheckoutRetornoPage'))
const PerfilPage = lazy(() => import('../pages/PerfilPage'))
const ProfessionalPage = lazy(() => import('../pages/ProfessionalPage'))

function CarregandoPagina() {
  return <div className="min-h-screen bg-background text-on-surface flex items-center justify-center" role="status" aria-live="polite"><div className="text-center space-y-3"><BrandIcon name="crown" size={34} className="text-primary mx-auto animate-pulse" /><p className="text-sm text-on-surface-variant">Carregando...</p></div></div>
}

function ClientRoute({ children }) { const { isAuthenticated, user, loading } = useAuth(); if (loading) return null; if (!isAuthenticated) return <Navigate to="/login" replace />; if (user?.role === 'admin') return <Navigate to="/admin" replace />; if (user?.role === 'profissional') return <Navigate to="/profissional" replace />; return user?.role === 'cliente' ? children : <Navigate to="/inicio" replace /> }
function AdminRoute({ children }) { const { isAuthenticated, user, loading } = useAuth(); if (loading) return null; if (!isAuthenticated) return <Navigate to="/login" replace />; return user?.role === 'admin' ? children : <Navigate to="/dashboard" replace /> }
function ProfessionalRoute({ children }) { const { isAuthenticated, user, loading } = useAuth(); if (loading) return null; if (!isAuthenticated) return <Navigate to="/login" replace />; if (user?.role === 'admin') return <Navigate to="/admin" replace />; if (user?.role === 'cliente') return <Navigate to="/dashboard" replace />; return user?.role === 'profissional' ? children : <Navigate to="/inicio" replace /> }
function PublicRoute({ children }) { const { isAuthenticated, user, loading } = useAuth(); if (loading) return null; if (!isAuthenticated) return children; if (user?.role === 'admin') return <Navigate to="/admin" replace />; if (user?.role === 'profissional') return <Navigate to="/profissional" replace />; return <Navigate to="/dashboard" replace /> }

export default function AppRoutes() {
  return <BrowserRouter><Suspense fallback={<CarregandoPagina />}><Routes>
    <Route path="/" element={<Navigate to="/inicio" replace />} />
    <Route path="/inicio" element={<LandingPage />} />
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/cadastro" element={<PublicRoute><RegisterPage /></PublicRoute>} />
    <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
    <Route path="/resetar-senha" element={<ResetPasswordPage />} />
    <Route path="/termos" element={<TermsPage />} /><Route path="/privacidade" element={<PrivacyPage />} />
    <Route path="/dashboard" element={<ClientRoute><DashboardPage /></ClientRoute>} />
    <Route path="/servicos" element={<ClientRoute><CatalogoServicosPage /></ClientRoute>} />
    <Route path="/loja" element={<ClientRoute><LojaPage /></ClientRoute>} /><Route path="/sacola" element={<ClientRoute><SacolaPage /></ClientRoute>} /><Route path="/produtos" element={<Navigate to="/loja" replace />} />
    <Route path="/agendar" element={<ClientRoute><AgendamentoPage /></ClientRoute>} /><Route path="/historico" element={<ClientRoute><HistoricoPage /></ClientRoute>} /><Route path="/perfil" element={<ClientRoute><PerfilPage /></ClientRoute>} />
    <Route path="/checkout/sucesso" element={<ClientRoute><CheckoutRetornoPage tipo="sucesso" /></ClientRoute>} /><Route path="/checkout/cancelado" element={<ClientRoute><CheckoutRetornoPage tipo="cancelado" /></ClientRoute>} />
    <Route path="/profissional" element={<ProfessionalRoute><ProfessionalPage /></ProfessionalRoute>} />
    <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} /><Route path="/admin/servicos" element={<AdminRoute><ServicosAdminPage /></AdminRoute>} /><Route path="/admin/agenda" element={<AdminRoute><AgendaAdminPage /></AdminRoute>} /><Route path="/admin/agendamentos" element={<AdminRoute><AgendamentosAdminPage /></AdminRoute>} /><Route path="/admin/pagamentos" element={<AdminRoute><PagamentosAdminPage /></AdminRoute>} /><Route path="/admin/profissionais" element={<AdminRoute><ProfissionaisAdminPage /></AdminRoute>} /><Route path="/admin/clientes" element={<AdminRoute><ClientesAdminPage /></AdminRoute>} /><Route path="/admin/relatorios" element={<AdminRoute><RelatoriosAdminPage /></AdminRoute>} /><Route path="/admin/config" element={<AdminRoute><Navigate to="/admin" replace /></AdminRoute>} />
    <Route path="*" element={<Navigate to="/inicio" replace />} />
  </Routes><WhatsAppSupport /></Suspense></BrowserRouter>
}

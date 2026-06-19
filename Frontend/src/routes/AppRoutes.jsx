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
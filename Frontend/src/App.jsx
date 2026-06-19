import { AuthProvider } from './context/AuthContext'
import AppRoutes from './routes/AppRoutes'
import './styles/globals.css'

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
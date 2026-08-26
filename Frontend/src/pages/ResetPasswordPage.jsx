import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import BrandIcon from '../components/ui/BrandIcon'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState(false)
  const [loading, setLoading]           = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Link inválido. Solicite um novo link de recuperação.')
      return
    }

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao redefinir a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-8">
          <h1 className="font-headline text-3xl tracking-tight">Definir nova senha</h1>
          <p className="text-on-surface-variant text-sm mt-2">
            Escolha uma nova senha para sua conta
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <BrandIcon name="check" size={48} className="text-primary mx-auto" />
            <p className="text-on-surface-variant">Senha redefinida com sucesso!</p>
            <button
              onClick={() => navigate('/login')}
              className="inline-block mt-4 px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-label font-bold uppercase tracking-widest hover:bg-primary-hover transition-colors"
            >
              Ir para o login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-error/10 border border-error/30 text-error text-sm rounded-lg px-4 py-3 text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="password" className="label-heritage block px-1">
                Nova senha
              </label>
              <div className="relative group">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-heritage peer"
                  placeholder="Mínimo 8 caracteres"
                />
                <div className="input-heritage-line" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm" className="label-heritage block px-1">
                Confirmar nova senha
              </label>
              <div className="relative group">
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-heritage peer"
                  placeholder="Repita a nova senha"
                />
                <div className="input-heritage-line" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-on-primary rounded-full text-sm font-label font-bold uppercase tracking-widest hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {loading ? 'Redefinindo...' : 'Redefinir senha'}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors"
              >
                <BrandIcon name="back" size={18} />
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

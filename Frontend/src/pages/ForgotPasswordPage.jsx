import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import BrandIcon from '../components/ui/BrandIcon'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email) {
      setError('Informe seu e-mail.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao enviar solicitação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors mb-6">
            <BrandIcon name="back" size={18} />
            Voltar
          </Link>
          <h1 className="font-headline text-3xl tracking-tight">Recuperar senha</h1>
          <p className="text-on-surface-variant text-sm mt-2">
            Digite seu e-mail para receber o link de redefinição
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <BrandIcon name="mail" size={48} className="text-primary mx-auto" />
            <p className="text-on-surface-variant">
              Se o e-mail existir, enviaremos um link de recuperação.
            </p>
            <Link
              to="/login"
              className="inline-block mt-4 px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-label font-bold uppercase tracking-widest hover:bg-primary-hover transition-colors"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-error/10 border border-error/30 text-error text-sm rounded-lg px-4 py-3 text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="label-heritage block px-1">
                E-mail
              </label>
              <div className="relative group">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-heritage peer"
                  placeholder="seu@email.com"
                />
                <div className="input-heritage-line" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-on-primary rounded-full text-sm font-label font-bold uppercase tracking-widest hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

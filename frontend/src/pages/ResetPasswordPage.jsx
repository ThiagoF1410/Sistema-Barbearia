import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import BrandIcon from '../components/ui/BrandIcon'
import PasswordStrengthMeter from '../components/ui/PasswordStrengthMeter'
import { analisarSenha } from '../utils/passwordStrength'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState(false)
  const [loading, setLoading]           = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Link inválido. Solicite um novo link de recuperação.')
      return
    }

    if (!analisarSenha(password).valida) {
      setError('Use de 12 a 72 caracteres, sem espaços ou acentos, e atenda pelo menos 3 dos 4 grupos.')
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
      setError(err.response?.data?.message || 'Não foi possível redefinir a senha. Tente novamente.')
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
              type="button"
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
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength="12"
                  maxLength="72"
                  aria-describedby="reset-password-strength"
                  className="input-heritage peer pr-12"
                  placeholder="Crie uma senha forte"
                  required
                />
                <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? 'Ocultar nova senha' : 'Mostrar nova senha'} aria-pressed={passwordVisible} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-outline hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"><BrandIcon name={passwordVisible ? 'eyeOff' : 'eye'} size={18} /></button>
                <div className="input-heritage-line" />
              </div>
            </div>

            <PasswordStrengthMeter password={password} id="reset-password-strength" />

            <div className="space-y-2">
              <label htmlFor="confirm" className="label-heritage block px-1">
                Confirmar nova senha
              </label>
              <div className="relative group">
                <input
                  id="confirm"
                  name="confirm"
                  type={confirmVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength="12"
                  maxLength="72"
                  className="input-heritage peer pr-12"
                  placeholder="Repita a nova senha"
                  required
                />
                <button type="button" onClick={() => setConfirmVisible((visible) => !visible)} aria-label={confirmVisible ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'} aria-pressed={confirmVisible} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-outline hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"><BrandIcon name={confirmVisible ? 'eyeOff' : 'eye'} size={18} /></button>
                <div className="input-heritage-line" />
              </div>
              {confirm && <p role="status" className={`mt-2 flex items-center gap-2 text-xs ${password === confirm ? 'text-emerald-300' : 'text-amber-300'}`}><BrandIcon name={password === confirm ? 'check' : 'alert'} size={15} />{password === confirm ? 'As senhas coincidem.' : 'As senhas ainda não coincidem.'}</p>}
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

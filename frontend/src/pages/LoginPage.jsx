import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logoImg from '../assets/Logo1.avif'
import loginImg from '../assets/TelaLogin.avif'
import BrandIcon from '../components/ui/BrandIcon'
import { AVISO_SESSAO_EXPIRADA, AVISO_SESSAO_KEY } from '../services/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [avisoSessao] = useState(() => {
    const motivo = new URLSearchParams(window.location.search).get('motivo')
    const aviso = motivo === 'sessao-expirada'
      ? AVISO_SESSAO_EXPIRADA
      : sessionStorage.getItem(AVISO_SESSAO_KEY) || ''
    sessionStorage.removeItem(AVISO_SESSAO_KEY)
    if (motivo === 'sessao-expirada') {
      window.history.replaceState(window.history.state, '', '/login')
    }
    return aviso
  })

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    // Limpa o erro do campo ao digitar
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  function validate() {
    const newErrors = {}
    if (!form.email) newErrors.email = 'Informe seu e-mail.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'E-mail inválido.'
    if (!form.password) newErrors.password = 'Informe sua senha.'
    return newErrors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      requestAnimationFrame(() => document.getElementById(Object.keys(validationErrors)[0])?.focus())
      return
    }

    setLoading(true)
    try {
      const user = await authLogin(form)
      if (user.role === 'admin') navigate('/admin')
      else if (user.role === 'profissional') navigate('/profissional')
      else navigate('/dashboard')
    } catch (err) {
      const message = err.response?.data?.message || 'Não foi possível realizar o acesso. Tente novamente.'
      setErrors({ general: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen overflow-x-hidden">

      {/* Fundo atmosférico */}
      <div className="fixed inset-0 z-0">
        <img
          src={loginImg}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
      </div>

      {/* Container principal */}
      <main className="relative z-10 min-h-screen w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-8 flex items-center">
        <div className="w-full max-w-md bg-black/45 border border-white/10 p-7 sm:p-9 lg:p-10 rounded-3xl shadow-2xl shadow-black/70 backdrop-blur-xl">

          <Link to="/inicio" className="inline-flex items-center gap-2 text-xs text-white/55 hover:text-primary transition-colors mb-7">
            <BrandIcon name="back" size={18} />
            Voltar ao início
          </Link>

          {/* Identidade da marca */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-7">
              <img src={logoImg} alt="" width="64" height="64" decoding="async" className="w-16 h-16 object-contain drop-shadow-[0_8px_15px_rgba(0,0,0,0.75)]" />
              <div>
                <p className="font-headline text-2xl text-primary leading-none">O Rei da Navalha</p>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/45 mt-1">Barbearia & Estilo</p>
              </div>
            </div>
            <h1 className="font-headline text-4xl text-white font-semibold tracking-tight mb-2">
              Bem-vindo de volta
            </h1>
            <p className="text-sm text-white/55">Entre para acessar seus agendamentos.</p>
          </div>

          {avisoSessao && (
            <div role="alert" className="w-full mb-6 px-4 py-3 bg-primary/10 border border-primary/30 rounded-lg flex items-center gap-2">
              <BrandIcon name="alert" size={17} className="text-primary shrink-0" />
              <p className="text-sm text-on-surface">{avisoSessao}</p>
            </div>
          )}

          {/* Erro geral (credenciais inválidas) */}
          {errors.general && (
            <div role="alert" className="w-full mb-6 px-4 py-3 bg-error-container/30 border border-error/30 rounded-lg flex items-center gap-2">
              <BrandIcon name="alert" size={17} className="text-error shrink-0" />
              <p className="text-sm text-on-error-container">{errors.general}</p>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} noValidate className="w-full space-y-7">
            <div className="space-y-6">

              {/* E-mail */}
              <div className="space-y-2">
                <label htmlFor="email" className="label-heritage px-1">
                  E-mail
                </label>
                <div className="relative group">
                  <BrandIcon name="mail" size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/60 pointer-events-none" />
                  <input
                    id="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                    className={`
                      w-full bg-surface-container-lowest border-none
                      focus:ring-1 text-on-surface pl-12 pr-4 py-4 rounded-xl
                      transition-all placeholder:text-outline/40
                      ${errors.email ? 'ring-1 ring-error/50' : 'focus:ring-primary/40'}
                    `}
                  />
                  <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary transition-all duration-500 group-focus-within:w-full" />
                </div>
                {errors.email && (
                  <p id="email-error" role="alert" className="text-xs text-error flex items-center gap-1">
                    <BrandIcon name="alert" size={15} />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <div className="px-1">
                  <label htmlFor="password" className="label-heritage">
                    Senha
                  </label>
                </div>
                <div className="relative group">
                  <BrandIcon name="lock" size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/60 pointer-events-none" />
                  <input
                    id="password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    required
                    className={`
                      w-full bg-surface-container-lowest border-none
                      focus:ring-1 text-on-surface pl-12 pr-4 py-4 rounded-xl
                      transition-all placeholder:text-outline/40
                      ${errors.password ? 'ring-1 ring-error/50' : 'focus:ring-primary/40'}
                    `}
                  />
                  <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary transition-all duration-500 group-focus-within:w-full" />
                </div>
                {errors.password && (
                  <p id="password-error" role="alert" className="text-xs text-error flex items-center gap-1">
                    <BrandIcon name="alert" size={15} />
                    {errors.password}
                  </p>
                )}
                <div className="flex justify-end pt-1">
                  <Link
                    to="/esqueci-senha"
                    className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/70 hover:text-primary transition-colors"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
              </div>
            </div>

            {/* Botão entrar */}
            <button
              type="submit"
              disabled={loading}
              className="gold-gradient w-full py-4 text-on-primary font-label font-extrabold uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-primary/15 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-on-primary/25 border-t-on-primary animate-spin" aria-hidden="true" />
                    Entrando...
                  </span>
                : 'Entrar'
              }
            </button>
          </form>

          {/* Link para cadastro */}
          <div className="mt-8 pt-7 border-t border-white/10 text-center">
            <p className="text-white/55 text-sm font-body mb-2">Ainda não tem conta?</p>
            <Link
              to="/cadastro"
              className="text-primary font-label font-bold uppercase tracking-widest text-xs border-b border-transparent hover:border-primary transition-all pb-1"
            >
              Criar conta
            </Link>
          </div>
        </div>

      </main>
    </div>
  )
}

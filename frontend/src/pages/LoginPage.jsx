import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../components/ui/Input'

export default function LoginPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

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
      return
    }

    setLoading(true)
    try {
      // TODO: integrar com authService.login(form.email, form.password)
      // const { token, user } = await authService.login(form.email, form.password)
      // setAuth({ token, user })
      await new Promise(r => setTimeout(r, 1000)) // simulação
      navigate('/dashboard')
    } catch (err) {
      setErrors({ general: err.message || 'E-mail ou senha incorretos.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center overflow-hidden">

      {/* Fundo atmosférico */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1c1b1b_0%,_#131313_60%,_#0e0e0e_100%)] opacity-90" />
        {/*
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2WQ2TxHIX9DQXjhg86LKaeNcltJg7QHqCwIQlfru6xC94ssS2JGCmSDt46FCDG1z1Pb01L44wRLj5A-sZiJaMuXgScrzLyUmAy1E4qXi7ECfkavT0-a2BdWZAxJBSNuzX-rrdDd3b3cC7VBovnZhXGAtJbcD38ztHtTKv0q90zoWtMhuCRXbO2AftRvjLQLp86pa06BUa5g2s0PBCJbvhlAYLaOHsCvubftrmOq3GZ3SAxN7DKGAWF1XXD4wBnX4-Q9c8wJjyH8tR"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-25 grayscale"
        />
        */}
      </div>

      {/* Container principal */}
      <main className="relative z-10 w-full max-w-lg px-6">
        <div className="glass-panel p-10 md:p-14 rounded-xl shadow-2xl shadow-black/60 flex flex-col items-center">

          {/* Identidade da marca */}
          <div className="mb-10 text-center">
            <span
              className="material-symbols-outlined text-primary text-5xl mb-4 block"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              content_cut
            </span>
            <h1 className="font-headline text-4xl md:text-5xl text-primary font-semibold tracking-tight leading-none mb-2">
              A Herança
            </h1>
            <p className="font-headline italic text-on-surface-variant text-lg tracking-wide opacity-80">
              Ateliê Heritage
            </p>
          </div>

          {/* Erro geral (credenciais inválidas) */}
          {errors.general && (
            <div className="w-full mb-6 px-4 py-3 bg-error-container/30 border border-error/30 rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-sm">error</span>
              <p className="text-sm text-on-error-container">{errors.general}</p>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} noValidate className="w-full space-y-8">
            <div className="space-y-6">

              {/* E-mail */}
              <div className="space-y-2">
                <label htmlFor="email" className="label-heritage px-1">
                  E-mail
                </label>
                <div className="relative group">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                    className={`
                      w-full bg-surface-container-lowest border-none
                      focus:ring-1 text-on-surface px-4 py-4 rounded-lg
                      transition-all placeholder:text-outline/40
                      ${errors.email ? 'ring-1 ring-error/50' : 'focus:ring-primary/40'}
                    `}
                  />
                  <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary transition-all duration-500 group-focus-within:w-full" />
                </div>
                {errors.email && (
                  <p className="text-xs text-error flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <div className="flex justify-between items-end px-1">
                  <label htmlFor="password" className="label-heritage">
                    Senha
                  </label>
                  <Link
                    to="/esqueci-senha"
                    className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/70 hover:text-primary transition-colors"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="relative group">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    required
                    className={`
                      w-full bg-surface-container-lowest border-none
                      focus:ring-1 text-on-surface px-4 py-4 rounded-lg
                      transition-all placeholder:text-outline/40
                      ${errors.password ? 'ring-1 ring-error/50' : 'focus:ring-primary/40'}
                    `}
                  />
                  <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary transition-all duration-500 group-focus-within:w-full" />
                </div>
                {errors.password && (
                  <p className="text-xs text-error flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {errors.password}
                  </p>
                )}
              </div>
            </div>

            {/* Botão entrar */}
            <button
              type="submit"
              disabled={loading}
              className="gold-gradient w-full py-4 text-on-primary font-label font-extrabold uppercase tracking-[0.2em] rounded-md shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
            >
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    Entrando...
                  </span>
                : 'Entrar'
              }
            </button>
          </form>

          {/* Link para cadastro */}
          <div className="mt-12 text-center">
            <p className="text-on-surface-variant text-sm font-body tracking-wide mb-2 opacity-60">
              Novo por aqui?
            </p>
            <Link
              to="/cadastro"
              className="text-primary font-label font-bold uppercase tracking-widest text-xs border-b border-transparent hover:border-primary transition-all pb-1"
            >
              Criar conta
            </Link>
          </div>
        </div>

        {/* Ícones decorativos inferiores */}
        <div className="mt-12 flex justify-center items-center space-x-8 opacity-20 grayscale" aria-hidden="true">
          <span className="material-symbols-outlined text-4xl">dry_cleaning</span>
          <span className="material-symbols-outlined text-4xl">face</span>
          <span className="material-symbols-outlined text-4xl">calendar_month</span>
        </div>
      </main>

      {/* Detalhes decorativos nos cantos (desktop) */}
      <div aria-hidden="true">
        <div className="fixed top-12 left-12 w-24 h-[1px] bg-primary/20 hidden lg:block" />
        <div className="fixed top-12 left-12 h-24 w-[1px] bg-primary/20 hidden lg:block" />
        <div className="fixed bottom-12 right-12 w-24 h-[1px] bg-primary/20 hidden lg:block" />
        <div className="fixed bottom-12 right-12 h-24 w-[1px] bg-primary/20 hidden lg:block" />
      </div>
    </div>
  )
}
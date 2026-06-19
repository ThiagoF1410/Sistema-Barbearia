import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../components/ui/Input'
import authService from '../services/authService'
import { useAuth } from '../context/AuthContext'

// Máscara de telefone brasileiro: (00) 00000-0000
function maskPhone(value) {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
    .slice(0, 15)
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    terms: false,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    const { name, value, type, checked } = e.target

    const newValue = name === 'phone'
      ? maskPhone(value)
      : type === 'checkbox'
        ? checked
        : value

    setForm(prev => ({ ...prev, [name]: newValue }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Informe seu nome completo.'
    else if (form.full_name.trim().split(' ').length < 2) e.full_name = 'Informe nome e sobrenome.'

    if (!form.email) e.email = 'Informe seu e-mail.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'E-mail inválido.'

    const rawPhone = form.phone.replace(/\D/g, '')
    if (!rawPhone) e.phone = 'Informe seu telefone.'
    else if (rawPhone.length < 10) e.phone = 'Telefone inválido.'

    if (!form.password) e.password = 'Crie uma senha.'
    else if (form.password.length < 8) e.password = 'Mínimo 8 caracteres.'

    if (!form.confirm_password) e.confirm_password = 'Confirme sua senha.'
    else if (form.password !== form.confirm_password) e.confirm_password = 'As senhas não coincidem.'

    if (!form.terms) e.terms = 'Aceite os termos para continuar.'

    return e
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
      const { token, user } = await authService.register(form)
      authLogin({ token, user })
      navigate('/dashboard')
    } catch (err) {
      setErrors({ general: err.message || 'Erro ao criar conta. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background text-on-background font-body antialiased min-h-screen flex flex-col">
      <main className="flex-grow grid lg:grid-cols-2 min-h-screen">

        {/* Coluna visual — oculta no mobile */}
        <section
          className="hidden lg:flex relative items-center justify-center overflow-hidden bg-surface-container-lowest"
          aria-hidden="true"
        >
          {/* Imagem de fundo com overlay */}
          <div className="absolute inset-0 opacity-40">
            <img
              alt=""
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBd4P4jZqtnrT_c66tNVBG5r7gkORIuHB_5dqLs6XKYeHdHIXxfRAhZe4ZYze7IeoN_0PFd7Z38fPFDhvMiK_W3oilDTf5xJdiXCPtRj8PfDQclkPuITgOOxaLttqs0S8ZL3l9hT84LReegV-zoq0mvp5Ohbnky_-BCz5X5a0UdCqIUDXdxAft3l5r32Dnc6wly3RxI61CfuMEW7KoH6uCu5yee-cMMYYMbg739NdOuol0L50jwt1LJQspe4rHXRrJ7Y-mei0E9yt85"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-surface-container-lowest/20 to-surface-container-lowest/60" />

          {/* Conteúdo editorial */}
          <div className="relative z-10 p-12 max-w-xl">
            <h1 className="font-headline text-6xl italic text-primary mb-6 leading-tight">
              A Herança
            </h1>
            <p className="font-headline text-2xl text-on-surface-variant leading-relaxed mb-8">
              Mais do que um corte, um rito de passagem. Junte-se à nossa irmandade e preserve a tradição do cuidado masculino.
            </p>
            <div className="flex gap-4 items-center">
              <div className="h-px w-12 bg-primary" />
              <span className="text-sm tracking-widest uppercase font-label text-primary">
                Est. 1948
              </span>
            </div>
          </div>
        </section>

        {/* Coluna do formulário */}
        <section className="flex flex-col justify-center items-center p-6 md:p-12 lg:p-24 bg-surface">
          <div className="w-full max-w-md">

            {/* Cabeçalho mobile */}
            <div className="lg:hidden mb-12 text-center">
              <h1 className="font-headline text-4xl italic text-primary">A Herança</h1>
            </div>

            {/* Título */}
            <div className="mb-10">
              <h2 className="font-headline text-3xl text-on-surface mb-2">Criar sua conta</h2>
              <p className="text-on-surface-variant text-sm font-body">
                Insira seus dados abaixo para iniciar sua jornada conosco.
              </p>
            </div>

            {/* Erro geral */}
            {errors.general && (
              <div className="mb-6 px-4 py-3 bg-error-container/30 border border-error/30 rounded-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-sm">error</span>
                <p className="text-sm text-on-error-container">{errors.general}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-6">

              {/* Nome completo */}
              <Input
                id="full_name"
                label="Nome Completo"
                type="text"
                placeholder="Ex: Arthur Morgan"
                icon="person"
                value={form.full_name}
                onChange={handleChange}
                error={errors.full_name}
                autoComplete="name"
                required
              />

              {/* E-mail */}
              <Input
                id="email"
                label="E-mail"
                type="email"
                placeholder="nome@exemplo.com"
                icon="mail"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
                required
              />

              {/* Telefone */}
              <Input
                id="phone"
                label="Telefone"
                type="tel"
                placeholder="(00) 90000-0000"
                icon="call"
                value={form.phone}
                onChange={handleChange}
                error={errors.phone}
                autoComplete="tel"
                required
              />

              {/* Senha e Confirmação lado a lado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  id="password"
                  label="Senha"
                  type="password"
                  placeholder="••••••••"
                  icon="lock"
                  value={form.password}
                  onChange={handleChange}
                  error={errors.password}
                  autoComplete="new-password"
                  required
                />
                <Input
                  id="confirm_password"
                  label="Confirmar"
                  type="password"
                  placeholder="••••••••"
                  icon="lock_reset"
                  value={form.confirm_password}
                  onChange={handleChange}
                  error={errors.confirm_password}
                  autoComplete="new-password"
                  required
                />
              </div>

              {/* Aceite de termos */}
              <div className="space-y-1 pt-2">
                <div className="flex items-start gap-3">
                  <div className="flex items-center h-5 mt-0.5">
                    <input
                      id="terms"
                      name="terms"
                      type="checkbox"
                      checked={form.terms}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-outline-variant/30 bg-surface-container-low text-primary focus:ring-primary/20 cursor-pointer"
                    />
                  </div>
                  <label htmlFor="terms" className="text-sm text-on-surface-variant leading-tight cursor-pointer">
                    Eu li e aceito os{' '}
                    <Link to="/termos" className="text-primary hover:underline decoration-primary/30 underline-offset-4">
                      Termos de Uso
                    </Link>{' '}
                    e a{' '}
                    <Link to="/privacidade" className="text-primary hover:underline decoration-primary/30 underline-offset-4">
                      Política de Privacidade
                    </Link>.
                  </label>
                </div>
                {errors.terms && (
                  <p className="text-xs text-error flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {errors.terms}
                  </p>
                )}
              </div>

              {/* Botão de submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full gold-gradient text-on-primary font-label font-bold text-sm uppercase tracking-widest py-5 rounded-lg shadow-xl shadow-primary/10 active:scale-[0.98] transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      Criando conta...
                    </span>
                  : 'Criar Minha Conta'
                }
              </button>

              {/* Link para login */}
              <div className="pt-2 text-center">
                <p className="text-sm text-on-surface-variant font-body">
                  Já possui uma conta?{' '}
                  <Link to="/login" className="text-primary font-bold hover:underline underline-offset-4 ml-1">
                    Entrar no Login
                  </Link>
                </p>
              </div>
            </form>

            {/* Rodapé discreto */}
            <div className="mt-16 flex justify-between items-center opacity-40">
              <span className="text-[10px] uppercase font-label tracking-tighter text-outline">
                Suporte Heritage &amp; Steel
              </span>
              <span className="text-[10px] uppercase font-label tracking-tighter text-outline">
                © {new Date().getFullYear()}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
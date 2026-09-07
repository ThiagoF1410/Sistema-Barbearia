import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../components/ui/input'
import { useAuth } from '../context/AuthContext'
import barbeariaImg from '../assets/TelaCadastro.avif'
import BrandIcon from '../components/ui/BrandIcon'
import PasswordStrengthMeter from '../components/ui/PasswordStrengthMeter'
import { analisarSenha } from '../utils/passwordStrength'

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
  const { register: authRegister } = useAuth()

  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    password: '',
    confirm_password: '',
    terms: false,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    const { name, value, type, checked } = e.target

    const newValue = name === 'telefone'
      ? maskPhone(value)
      : type === 'checkbox'
        ? checked
        : value

    setForm(prev => ({ ...prev, [name]: newValue }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.nome.trim()) e.nome = 'Informe seu nome completo.'
    else if (form.nome.trim().split(' ').length < 2) e.nome = 'Informe nome e sobrenome.'

    if (!form.email) e.email = 'Informe seu e-mail.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'E-mail inválido.'

    const rawTelefone = form.telefone.replace(/\D/g, '')
    if (!rawTelefone) e.telefone = 'Informe seu telefone.'
    else if (rawTelefone.length < 10) e.telefone = 'Telefone inválido.'

    if (!form.password) e.password = 'Crie uma senha.'
    else if (!analisarSenha(form.password).valida) e.password = 'Atenda a todos os requisitos de segurança.'

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
      requestAnimationFrame(() => document.getElementById(Object.keys(validationErrors)[0])?.focus())
      return
    }

    setLoading(true)
    try {
      const user = await authRegister(form)
      navigate(user.role === 'admin' ? '/admin' : '/dashboard')
    } catch (err) {
      const message = err.response?.data?.message || 'Não foi possível criar sua conta. Tente novamente.'
      setErrors({ general: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative text-on-background font-body antialiased min-h-screen overflow-hidden">
      <img
        src={barbeariaImg}
        alt="Interior da barbearia O Rei da Navalha"
        fetchPriority="high"
        decoding="async"
        className="fixed inset-0 w-full h-full object-cover object-center"
      />
      <div className="fixed inset-0 bg-black/45" />
      <div className="fixed inset-0 bg-gradient-to-r from-black/75 via-black/30 to-black/55" />

      <main className="relative z-10 grid lg:grid-cols-[1.05fr_0.95fr] min-h-screen">

        {/* Coluna visual — oculta no mobile */}
        <section
          className="hidden lg:flex relative items-center justify-center overflow-hidden"
          aria-hidden="true"
        >
          {/* Conteúdo editorial */}
          <div className="relative z-10 p-12 xl:p-20 max-w-2xl drop-shadow-2xl">
            <h1 className="font-headline text-5xl text-primary mb-6 leading-tight">
              O Rei da Navalha
            </h1>
            <p className="font-headline text-2xl text-white/90 leading-relaxed mb-8 max-w-xl">
              Corte bom não é gasto, é investimento na confiança do dia a dia e no visual que fala antes de você.
            </p>
            <div className="flex gap-4 items-center">
              <div className="h-px w-5 bg-primary" />
              <span className="text-sm tracking-widest uppercase font-label text-primary">
                Sua melhor versão começa aqui
              </span>
            </div>
          </div>
        </section>

        {/* Coluna do formulário */}
        <section className="flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 xl:p-16">
          <div className="w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto glass-panel bg-surface-container-low/80 border border-white/10 rounded-3xl p-6 sm:p-9 lg:p-10 shadow-2xl shadow-black/70 backdrop-blur-xl">

            {/* Cabeçalho mobile */}
            <div className="lg:hidden mb-8 text-center">
              <h1 className="font-headline text-3xl text-primary">O Rei da Navalha</h1>
            </div>

            {/* Título */}
            <div className="mb-8">
              <h2 className="font-headline text-3xl text-on-surface mb-2">Criar sua conta</h2>
              <p className="text-on-surface-variant text-sm font-body">
                Insira seus dados abaixo para iniciar sua jornada conosco.
              </p>
            </div>

            {/* Erro geral */}
            {errors.general && (
              <div role="alert" className="mb-6 px-4 py-3 bg-error-container/30 border border-error/30 rounded-lg flex items-center gap-2">
                <BrandIcon name="alert" size={17} className="text-error shrink-0" />
                <p className="text-sm text-on-error-container">{errors.general}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-6">

              {/* Nome completo */}
              <Input
                id="nome"
                label="Nome Completo"
                type="text"
                placeholder="Ex: Thiago Francisco"
                icon="person"
                value={form.nome}
                onChange={handleChange}
                error={errors.nome}
                autoComplete="name"
                required
              />

              {/* E-mail */}
              <Input
                id="email"
                label="E-mail"
                type="email"
                placeholder="thiago@gmail.com"
                icon="mail"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
                required
              />

              {/* Telefone */}
              <Input
                id="telefone"
                label="Telefone"
                type="tel"
                placeholder="(18) 99999-9999"
                icon="call"
                value={form.telefone}
                onChange={handleChange}
                error={errors.telefone}
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
                  maxLength={72}
                  showPasswordToggle
                  describedBy="register-password-strength"
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
                  maxLength={72}
                  showPasswordToggle
                  required
                />
              </div>

              {form.confirm_password && (
                <p role="status" className={`flex items-center gap-2 text-xs ${form.password === form.confirm_password ? 'text-emerald-300' : 'text-amber-300'}`}>
                  <BrandIcon name={form.password === form.confirm_password ? 'check' : 'alert'} size={15} />
                  {form.password === form.confirm_password ? 'As senhas coincidem.' : 'As senhas ainda não coincidem.'}
                </p>
              )}

              <PasswordStrengthMeter password={form.password} id="register-password-strength" />

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
                    <BrandIcon name="alert" size={15} />
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
                      <span className="w-4 h-4 rounded-full border-2 border-on-primary/25 border-t-on-primary animate-spin" aria-hidden="true" />
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
            <div className="mt-10 flex justify-between items-center opacity-50">
              <span className="text-[10px] uppercase font-label tracking-tighter text-outline">
                Suporte O Rei da Navalha
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

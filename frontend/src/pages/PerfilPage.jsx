import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMe, updateMe } from '../services/authService'
import BrandIcon from '../components/ui/BrandIcon'
import logoImg from '../assets/Logo1.avif'

const FORM_VAZIO = { nome: '', email: '', telefone: '' }

function formatarTelefone(valor = '') {
  const numeros = String(valor).replace(/\D/g, '').slice(0, 11)
  if (numeros.length <= 2) return numeros
  if (numeros.length <= 6) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`
  if (numeros.length <= 10) return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`
  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`
}

function dadosParaForm(perfil) {
  return {
    nome: perfil?.nome || perfil?.name || '',
    email: perfil?.email || '',
    telefone: formatarTelefone(perfil?.telefone || ''),
  }
}

function validar(form) {
  const erros = {}
  const nome = form.nome.trim().replace(/\s+/g, ' ')
  const email = form.email.trim().toLowerCase()
  const telefone = form.telefone.replace(/\D/g, '')
  if (nome.length < 2) erros.nome = 'Informe seu nome completo.'
  else if (nome.length > 100) erros.nome = 'O nome deve ter no máximo 100 caracteres.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.email = 'Informe um e-mail válido.'
  if (!/^\d{10,11}$/.test(telefone)) erros.telefone = 'Informe um telefone com DDD válido.'
  return { erros, dados: { nome, email, telefone } }
}

function Campo({ id, label, erro, ...props }) {
  return <div>
    <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant mb-2">{label}</label>
    <input id={id} aria-invalid={Boolean(erro)} aria-describedby={erro ? `${id}-erro` : undefined}
      className={`w-full min-h-12 rounded-xl border bg-background/70 px-4 py-3 text-sm text-on-surface outline-none transition-colors placeholder:text-white/25 focus:ring-2 ${erro ? 'border-error/60 focus:border-error focus:ring-error/20' : 'border-white/10 focus:border-primary/60 focus:ring-primary/15'}`}
      {...props} />
    {erro && <p id={`${id}-erro`} className="text-xs text-error mt-2">{erro}</p>}
  </div>
}

function SkeletonPerfil() {
  return <div className="space-y-5 animate-pulse" role="status" aria-label="Carregando perfil">
    <div className="glass-panel rounded-3xl border border-white/10 p-6 flex items-center gap-4"><div className="w-16 h-16 rounded-2xl bg-white/10" /><div className="space-y-3"><div className="w-52 h-6 rounded bg-white/10" /><div className="w-24 h-4 rounded bg-white/[0.06]" /></div></div>
    <div className="grid md:grid-cols-2 gap-5"><div className="h-44 rounded-3xl bg-white/[0.04] border border-white/10" /><div className="h-44 rounded-3xl bg-white/[0.04] border border-white/10" /></div>
    <span className="sr-only">Carregando...</span>
  </div>
}

export default function PerfilPage() {
  const { updateUser } = useAuth()
  const [perfil, setPerfil] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [editando, setEditando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    getMe()
      .then((dados) => {
        if (!ativo) return
        setPerfil(dados)
        setForm(dadosParaForm(dados))
      })
      .catch((err) => { if (ativo) setErroGeral(err.response?.data?.message || 'Não foi possível carregar seu perfil.') })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [tentativa])

  const iniciais = useMemo(() => String(perfil?.nome || perfil?.name || 'Cliente')
    .trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase(), [perfil])

  const alterado = useMemo(() => perfil && JSON.stringify(form) !== JSON.stringify(dadosParaForm(perfil)), [form, perfil])

  useEffect(() => {
    if (!editando || !alterado) return undefined
    function avisarSaida(event) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', avisarSaida)
    return () => window.removeEventListener('beforeunload', avisarSaida)
  }, [alterado, editando])

  function tentarNovamente() {
    setErroGeral('')
    setCarregando(true)
    setTentativa((valor) => valor + 1)
  }

  function iniciarEdicao() {
    setForm(dadosParaForm(perfil))
    setErros({})
    setErroGeral('')
    setSucesso('')
    setEditando(true)
  }

  function cancelarEdicao() {
    setForm(dadosParaForm(perfil))
    setErros({})
    setErroGeral('')
    setEditando(false)
  }

  function alterarCampo(event) {
    const { name, value } = event.target
    const novoValor = name === 'telefone' ? formatarTelefone(value) : value
    setForm((atual) => ({ ...atual, [name]: novoValor }))
    setErros((atual) => ({ ...atual, [name]: '' }))
    setSucesso('')
  }

  async function salvar(event) {
    event.preventDefault()
    const validacao = validar(form)
    setErros(validacao.erros)
    setErroGeral('')
    setSucesso('')
    if (Object.keys(validacao.erros).length) return

    setSalvando(true)
    try {
      const atualizado = await updateMe(validacao.dados)
      setPerfil(atualizado)
      setForm(dadosParaForm(atualizado))
      updateUser(atualizado)
      setEditando(false)
      setSucesso('Seus dados foram atualizados com sucesso.')
    } catch (err) {
      setErroGeral(err.response?.data?.message || 'Não foi possível atualizar seus dados.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="sticky top-0 z-40 border-b border-primary/15 bg-black/90 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/inicio" className="flex items-center gap-3 min-w-0 group" aria-label="O Rei da Navalha — página inicial">
            <img src={logoImg} alt="" width="44" height="44" decoding="async" className="h-11 w-11 object-contain shrink-0" />
            <div className="hidden sm:block"><p className="font-headline text-lg leading-none group-hover:text-primary transition-colors">O Rei da Navalha</p><p className="text-[8px] uppercase tracking-[0.24em] text-primary/75 mt-1">Área do cliente</p></div>
          </Link>
          <Link to="/dashboard" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-white/80 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-colors"><BrandIcon name="back" size={18} />Painel</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-7 px-4 py-7 sm:px-6 sm:py-10">
        <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-[linear-gradient(120deg,rgba(245,197,24,0.09),rgba(255,255,255,0.02)_50%,transparent)] p-5 sm:p-7">
          <div aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/[0.05] blur-3xl" />
          <div className="relative flex items-start gap-3 sm:gap-4">
            <Link to="/dashboard" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-on-surface-variant hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" aria-label="Voltar ao painel"><BrandIcon name="back" size={19} /></Link>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Área do cliente</p><h1 className="mt-1 font-headline text-3xl sm:text-4xl">Meu perfil</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">Mantenha seus dados atualizados para receber informações sobre seus agendamentos e pagamentos.</p></div>
          </div>
        </section>

        {sucesso && <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-emerald-200 flex items-start gap-3"><BrandIcon name="check" size={22} className="shrink-0" /><div><p className="text-sm font-bold">Perfil atualizado</p><p className="text-xs mt-1 opacity-85">{sucesso}</p></div></div>}
        {erroGeral && <div role="alert" className="rounded-2xl border border-error/25 bg-error/10 p-4 text-error flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span className="text-sm">{erroGeral}</span>{!perfil && <button type="button" onClick={tentarNovamente} className="self-start sm:self-auto rounded-full border border-error/35 px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-error/10">Tentar novamente</button>}</div>}

        {carregando ? <SkeletonPerfil /> : perfil && <div className="space-y-5">
          <section className="glass-panel relative overflow-hidden rounded-3xl border border-primary/20 p-5 sm:p-7">
            <div aria-hidden="true" className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/[0.055] blur-3xl" />
            <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-[linear-gradient(145deg,rgba(245,197,24,0.16),rgba(245,197,24,0.04))] font-headline text-2xl text-primary shadow-lg shadow-black/20 sm:h-20 sm:w-20" aria-hidden="true">{iniciais}</div><div className="min-w-0"><p className="truncate font-headline text-2xl sm:text-3xl">{perfil.nome}</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">Cliente</span><span className="flex items-center gap-1.5 text-xs text-on-surface-variant"><BrandIcon name="check" size={14} className="text-emerald-300" />Dados de contato cadastrados</span></div></div></div>
            {!editando && <button type="button" onClick={iniciarEdicao} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><BrandIcon name="edit" size={17} />Editar dados</button>}
            </div>
          </section>

          {editando ? <form onSubmit={salvar} className="glass-panel rounded-3xl border border-primary/15 p-5 sm:p-7" noValidate>
            <div className="flex items-start gap-3 mb-6"><div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0"><BrandIcon name="edit" size={23} /></div><div><h2 className="font-headline text-2xl">Editar dados pessoais</h2><p className="text-xs text-on-surface-variant mt-1">Todos os campos são obrigatórios.</p></div></div>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="md:col-span-2"><Campo id="perfil-nome" label="Nome completo" name="nome" value={form.nome} onChange={alterarCampo} erro={erros.nome} autoComplete="name" maxLength="100" autoFocus /></div>
              <Campo id="perfil-email" label="E-mail" name="email" type="email" value={form.email} onChange={alterarCampo} erro={erros.email} autoComplete="email" maxLength="150" />
              <Campo id="perfil-telefone" label="Telefone / WhatsApp" name="telefone" type="tel" inputMode="tel" value={form.telefone} onChange={alterarCampo} erro={erros.telefone} autoComplete="tel" maxLength="15" placeholder="(11) 99999-9999" />
            </div>
            <p className="mt-5 text-xs leading-relaxed text-on-surface-variant">O telefone será utilizado para as notificações do seu agendamento. Ao alterar o e-mail, ele também será usado no próximo acesso.</p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6 pt-5 border-t border-white/[0.07]"><button type="button" onClick={cancelarEdicao} disabled={salvando} className="min-h-11 rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-wider hover:border-primary/40 disabled:opacity-50">Cancelar</button><button type="submit" disabled={salvando || !alterado} className="min-h-11 rounded-full bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-45">{salvando ? 'Salvando...' : 'Salvar alterações'}</button></div>
          </form> : <div className="grid gap-5 md:grid-cols-2">
            <section className="glass-panel brand-card rounded-3xl border border-white/10 p-5 transition-colors hover:border-primary/20 sm:p-6"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="profile" size={23} /></div><div><h2 className="font-headline text-xl">Identificação</h2><p className="mt-0.5 text-xs text-on-surface-variant">Informações da sua conta</p></div></div><dl className="mt-6 grid gap-3"><div className="rounded-2xl border border-white/[0.06] bg-black/15 p-4"><dt className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Nome completo</dt><dd className="mt-1 break-words text-sm font-semibold">{perfil.nome}</dd></div><div className="rounded-2xl border border-white/[0.06] bg-black/15 p-4"><dt className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Tipo de perfil</dt><dd className="mt-1 text-sm font-semibold">Cliente</dd></div></dl></section>
            <section className="glass-panel brand-card rounded-3xl border border-white/10 p-5 transition-colors hover:border-primary/20 sm:p-6"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="phone" size={23} /></div><div><h2 className="font-headline text-xl">Contato</h2><p className="mt-0.5 text-xs text-on-surface-variant">Canais usados nas confirmações</p></div></div><dl className="mt-6 grid gap-3"><div className="rounded-2xl border border-white/[0.06] bg-black/15 p-4"><dt className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">E-mail</dt><dd className="mt-1 break-all text-sm font-semibold">{perfil.email}</dd></div><div className="rounded-2xl border border-white/[0.06] bg-black/15 p-4"><dt className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Telefone / WhatsApp</dt><dd className="mt-1 text-sm font-semibold">{formatarTelefone(perfil.telefone) || 'Não informado'}</dd></div></dl></section>
            <aside className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 md:col-span-2"><BrandIcon name="shield" size={20} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-xs font-bold text-on-surface">Privacidade dos seus dados</p><p className="mt-1 text-xs leading-relaxed text-on-surface-variant">Estas informações são utilizadas somente para sua identificação, acesso à conta e comunicações relacionadas aos atendimentos.</p></div></aside>
          </div>}
        </div>}
      </main>
    </div>
  )
}

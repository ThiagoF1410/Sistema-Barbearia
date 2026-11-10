import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import BrandIcon from '../../components/ui/BrandIcon'
import PasswordStrengthMeter from '../../components/ui/PasswordStrengthMeter'
import useFeedbackFocus from '../../hooks/useFeedbackFocus'
import {
  alterarStatusProfissional,
  atualizarProfissional,
  criarProfissional,
  listarProfissionaisAdmin,
} from '../../services/profissionaisService'

const FORM_VAZIO = { nome: '', email: '', especialidade: '', password: '' }

function iniciais(nome = '') {
  return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() || 'PR'
}

function Skeleton() {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando profissionais">{[1, 2, 3].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />)}</div>
}

function ModalProfissional({ profissional, salvando, erro, aoFechar, aoSalvar }) {
  const [form, setForm] = useState(profissional ? {
    nome: profissional.nome,
    email: profissional.email,
    especialidade: profissional.especialidade,
    password: '',
  } : FORM_VAZIO)
  const nomeRef = useRef(null)
  const editando = Boolean(profissional)

  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    nomeRef.current?.focus()
    function fecharEscape(event) { if (event.key === 'Escape' && !salvando) aoFechar() }
    document.addEventListener('keydown', fecharEscape)
    return () => {
      document.body.style.overflow = anterior
      document.removeEventListener('keydown', fecharEscape)
    }
  }, [aoFechar, salvando])

  function alterar(event) {
    const { name, value } = event.target
    setForm((atual) => ({ ...atual, [name]: value }))
  }

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !salvando) aoFechar() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="profissional-modal-titulo" className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#151515] shadow-2xl sm:max-w-2xl sm:rounded-3xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#151515]/95 px-5 py-5 backdrop-blur-xl sm:px-7">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><BrandIcon name="professional" size={23} /></div><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">Equipe</p><h2 id="profissional-modal-titulo" className="mt-1 font-headline text-2xl">{editando ? 'Editar profissional' : 'Novo profissional'}</h2></div></div>
        <button type="button" onClick={aoFechar} disabled={salvando} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/60 hover:border-primary/35 hover:text-primary disabled:opacity-50" aria-label="Fechar"><BrandIcon name="close" size={20} /></button>
      </header>

      <form onSubmit={(event) => { event.preventDefault(); aoSalvar(form) }} className="space-y-5 p-5 sm:p-7">
        {erro && <div role="alert" className="flex items-start gap-3 rounded-xl border border-error/25 bg-error/10 p-4 text-sm text-error"><BrandIcon name="alert" size={19} className="mt-0.5 shrink-0" /><span>{erro}</span></div>}
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-xs text-on-surface-variant sm:col-span-2"><span className="mb-2 block font-bold uppercase tracking-wider">Nome completo</span><input ref={nomeRef} name="nome" value={form.nome} onChange={alterar} minLength="2" maxLength="100" required autoComplete="name" placeholder="Ex.: Lucas Barbeiro" className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-white/25 focus:border-primary focus:outline-none" /></label>
          <label className="text-xs text-on-surface-variant"><span className="mb-2 block font-bold uppercase tracking-wider">E-mail de acesso</span><input name="email" type="email" value={form.email} onChange={alterar} maxLength="150" required autoComplete="email" placeholder="profissional@barbearia.com" className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-white/25 focus:border-primary focus:outline-none" /></label>
          <label className="text-xs text-on-surface-variant"><span className="mb-2 block font-bold uppercase tracking-wider">Especialidade</span><input name="especialidade" value={form.especialidade} onChange={alterar} minLength="2" maxLength="100" required placeholder="Ex.: Corte e barba" className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-white/25 focus:border-primary focus:outline-none" /></label>
          <label className="text-xs text-on-surface-variant sm:col-span-2"><span className="mb-2 block font-bold uppercase tracking-wider">{editando ? 'Nova senha (opcional)' : 'Senha temporária'}</span><div className="relative"><BrandIcon name="lock" size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" /><input name="password" type="password" value={form.password} onChange={alterar} minLength="12" maxLength="72" required={!editando} autoComplete="new-password" placeholder={editando ? 'Deixe em branco para manter a senha atual' : 'Mínimo de 12 caracteres'} className="w-full rounded-xl border border-outline-variant bg-surface py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-white/25 focus:border-primary focus:outline-none" /></div><small className="mt-2 block leading-relaxed text-white/40">{editando ? 'Ao definir uma nova senha, as sessões atuais desse profissional serão encerradas.' : 'O profissional utilizará este e-mail e esta senha para acessar o sistema.'}</small></label>
        </div>
        {form.password && <PasswordStrengthMeter password={form.password} id="professional-password-strength" />}
        <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={aoFechar} disabled={salvando} className="rounded-full border border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:border-primary/30 disabled:opacity-50">Cancelar</button><button type="submit" disabled={salvando} className="rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container disabled:opacity-50">{salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar profissional'}</button></div>
      </form>
    </section>
  </div>
}

function ConfirmarStatus({ profissional, processando, aoFechar, aoConfirmar }) {
  const ativar = !profissional.ativo
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm" role="presentation">
    <section role="alertdialog" aria-modal="true" aria-labelledby="status-titulo" aria-describedby="status-descricao" className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171717] p-6 shadow-2xl">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${ativar ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300' : 'border-error/25 bg-error/10 text-error'}`}><BrandIcon name={ativar ? 'check' : 'alert'} size={25} /></div>
      <h2 id="status-titulo" className="mt-5 font-headline text-2xl">{ativar ? 'Ativar profissional?' : 'Desativar profissional?'}</h2>
      <p id="status-descricao" className="mt-2 text-sm leading-relaxed text-on-surface-variant">{ativar ? `${profissional.nome} voltará a aparecer nas opções de agendamento.` : `${profissional.nome} deixará de receber novos agendamentos. A operação será bloqueada se houver atendimentos futuros.`}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={aoFechar} disabled={processando} className="rounded-full border border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Voltar</button><button type="button" onClick={aoConfirmar} disabled={processando} className={`rounded-full px-5 py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50 ${ativar ? 'bg-primary text-on-primary' : 'bg-error text-white'}`}>{processando ? 'Processando...' : ativar ? 'Ativar' : 'Desativar'}</button></div>
    </section>
  </div>
}

export default function ProfissionaisAdminPage() {
  const [profissionais, setProfissionais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [processandoStatus, setProcessandoStatus] = useState(false)
  const [modal, setModal] = useState(null)
  const [confirmacao, setConfirmacao] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [erro, setErro] = useState('')
  const erroRef = useFeedbackFocus(erro)
  const [sucesso, setSucesso] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      setErro('')
      setProfissionais(await listarProfissionaisAdmin())
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível carregar a equipe. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  function notificarSucesso(mensagem) {
    setErro('')
    setSucesso(mensagem)
    window.setTimeout(() => setSucesso(''), 5000)
  }

  async function salvar(form) {
    setSalvando(true)
    setErro('')
    try {
      if (modal) {
        await atualizarProfissional(modal.idprofissional, form)
        notificarSucesso('Dados do profissional atualizados com sucesso.')
      } else {
        await criarProfissional(form)
        notificarSucesso('Profissional cadastrado com sucesso.')
      }
      setModal(null)
      await carregar()
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível salvar o profissional. Revise os dados e tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarStatus() {
    setProcessandoStatus(true)
    setErro('')
    try {
      const novoStatus = !confirmacao.ativo
      await alterarStatusProfissional(confirmacao.idprofissional, novoStatus)
      notificarSucesso(`Profissional ${novoStatus ? 'ativado' : 'desativado'} com sucesso.`)
      setConfirmacao(null)
      await carregar()
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível alterar a situação do profissional.')
      setConfirmacao(null)
    } finally {
      setProcessandoStatus(false)
    }
  }

  const resumo = useMemo(() => {
    const ativos = profissionais.filter((item) => item.ativo).length
    const proximos = profissionais.reduce((total, item) => total + Number(item.proximos_agendamentos || 0), 0)
    const escalas = profissionais.filter((item) => item.escala_personalizada).length
    return [
      { icon: 'users', valor: profissionais.length, rotulo: 'Equipe cadastrada', detalhe: 'Total de profissionais' },
      { icon: 'check', valor: ativos, rotulo: 'Profissionais ativos', detalhe: 'Disponíveis para clientes' },
      { icon: 'calendar', valor: proximos, rotulo: 'Próximos atendimentos', detalhe: 'Agendamentos da equipe' },
      { icon: 'clock', valor: escalas, rotulo: 'Escalas personalizadas', detalhe: 'Expedientes individuais' },
    ]
  }, [profissionais])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return profissionais.filter((item) => {
      const situacao = filtro === 'todos' || (filtro === 'ativos' ? item.ativo : !item.ativo)
      const texto = `${item.nome} ${item.email} ${item.especialidade}`.toLocaleLowerCase('pt-BR')
      return situacao && (!termo || texto.includes(termo))
    })
  }, [busca, filtro, profissionais])

  return <AdminLayout titulo="Profissionais" subtitulo="Equipe e escalas">
    <main className="mx-auto max-w-[1480px] space-y-8 px-4 py-7 sm:px-6 sm:py-9">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Gestão da equipe</p><h1 className="mt-2 font-headline text-3xl sm:text-4xl">Profissionais</h1><p className="mt-2 max-w-2xl text-sm text-on-surface-variant">Cadastre a equipe, mantenha os dados de acesso e configure expedientes individuais.</p></div><button type="button" onClick={() => { setErro(''); setSucesso(''); setModal(false) }} className="inline-flex self-start items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container xl:self-auto"><span className="text-lg leading-none">+</span>Novo profissional</button></section>

      <section aria-label="Resumo da equipe" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{resumo.map((item) => <article key={item.rotulo} className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name={item.icon} size={21} /></div><span className="font-headline text-2xl text-primary">{carregando ? '—' : item.valor}</span></div><p className="mt-4 text-xs font-bold">{item.rotulo}</p><p className="mt-1 text-[10px] text-on-surface-variant">{item.detalhe}</p></article>)}</section>

      {erro && <div ref={erroRef} role="alert" className="flex items-start gap-3 rounded-2xl border border-error/25 bg-error/10 px-4 py-4 text-sm text-error"><BrandIcon name="alert" size={20} className="mt-0.5 shrink-0" /><span>{erro}</span></div>}
      {sucesso && <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200"><BrandIcon name="check" size={20} className="shrink-0" />{sucesso}</div>}

      <section aria-labelledby="equipe-titulo" className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Equipe cadastrada</p><h2 id="equipe-titulo" className="mt-2 font-headline text-2xl sm:text-3xl">Profissionais da barbearia</h2><p className="mt-1 text-xs text-on-surface-variant">{filtrados.length} {filtrados.length === 1 ? 'profissional encontrado' : 'profissionais encontrados'}</p></div><div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto"><label className="relative min-w-0 flex-1 xl:w-72"><span className="sr-only">Pesquisar profissional</span><BrandIcon name="search" size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" /><input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome, e-mail ou especialidade" className="w-full rounded-full border border-white/10 bg-surface py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-white/30 focus:border-primary focus:outline-none" /></label><div className="grid grid-cols-3 rounded-full border border-white/10 bg-surface p-1" aria-label="Filtrar situação">{[['todos', 'Todos'], ['ativos', 'Ativos'], ['inativos', 'Inativos']].map(([valor, texto]) => <button key={valor} type="button" onClick={() => setFiltro(valor)} aria-pressed={filtro === valor} className={`rounded-full px-4 py-2 text-[9px] font-bold uppercase tracking-wider ${filtro === valor ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{texto}</button>)}</div></div></div>

        {carregando ? <Skeleton /> : filtrados.length === 0 ? <div className="glass-panel rounded-2xl border border-white/10 p-10 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BrandIcon name="professional" size={34} /></div><h3 className="mt-5 font-headline text-xl">Nenhum profissional encontrado</h3><p className="mt-2 text-sm text-on-surface-variant">Altere a pesquisa ou cadastre um novo integrante da equipe.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtrados.map((item) => <article key={item.idprofissional} className={`glass-panel flex min-h-72 flex-col rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 ${item.ativo ? 'border-white/10 hover:border-primary/30' : 'border-white/[0.06] opacity-75'}`}>
          <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3 min-w-0"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 font-headline text-lg text-primary">{iniciais(item.nome)}</div><div className="min-w-0"><h3 className="truncate font-headline text-xl">{item.nome}</h3><p className="mt-1 truncate text-xs text-on-surface-variant">{item.especialidade}</p></div></div><span className={`shrink-0 rounded-full border px-3 py-1 text-[8px] font-bold uppercase tracking-wider ${item.ativo ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-white/45'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span></div>
          <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/15 p-4"><div className="flex items-center gap-2 text-xs text-on-surface-variant"><BrandIcon name="mail" size={16} className="shrink-0 text-primary" /><span className="truncate">{item.email}</span></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3"><div><strong className="font-headline text-lg text-primary">{item.proximos_agendamentos || 0}</strong><span className="block text-[9px] text-on-surface-variant">Próximos</span></div><div><strong className="font-headline text-lg">{item.total_agendamentos || 0}</strong><span className="block text-[9px] text-on-surface-variant">Total histórico</span></div></div></div>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-on-surface-variant"><BrandIcon name="clock" size={15} className={item.escala_personalizada ? 'text-primary' : ''} /><span>{item.escala_personalizada ? 'Escala individual configurada' : 'Utiliza o horário geral'}</span></div>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-5"><button type="button" onClick={() => { setErro(''); setSucesso(''); setModal(item) }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:border-primary/35 hover:bg-primary/10 hover:text-primary"><BrandIcon name="edit" size={16} />Editar</button><Link to={`/admin/agenda?secao=profissionais&profissionalId=${item.idprofissional}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/12"><BrandIcon name="calendar" size={16} />Escala</Link><button type="button" onClick={() => setConfirmacao(item)} className={`col-span-2 min-h-10 rounded-xl border text-[10px] font-bold uppercase tracking-wider ${item.ativo ? 'border-error/20 text-error hover:bg-error/10' : 'border-emerald-400/20 text-emerald-300 hover:bg-emerald-500/10'}`}>{item.ativo ? 'Desativar profissional' : 'Ativar profissional'}</button></div>
        </article>)}</div>}
      </section>
    </main>
    {modal !== null && <ModalProfissional profissional={modal || null} salvando={salvando} erro={erro} aoFechar={() => { if (!salvando) { setModal(null); setErro('') } }} aoSalvar={salvar} />}
    {confirmacao && <ConfirmarStatus profissional={confirmacao} processando={processandoStatus} aoFechar={() => { if (!processandoStatus) setConfirmacao(null) }} aoConfirmar={confirmarStatus} />}
  </AdminLayout>
}

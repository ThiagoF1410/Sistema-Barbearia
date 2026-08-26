import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  listarServicos,
  criarServico,
  atualizarServico,
  deletarServico,
} from '../../services/servicosService'
import BrandIcon from '../../components/ui/BrandIcon'

const FORM_VAZIO = { nome: '', tipo: 'servico', duracao: 30, preco: '', descricao: '' }

export default function ServicosAdminPage() {
  const { user, logout } = useAuth()
  const [servicos, setServicos]   = useState([])
  const [form, setForm]           = useState(FORM_VAZIO)
  const [editandoId, setEditandoId] = useState(null)
  const [erro, setErro]           = useState('')
  const [sucesso, setSucesso]     = useState('')
  const [loading, setLoading]     = useState(false)
  const formularioRef = useRef(null)
  const nomeInputRef = useRef(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      const data = await listarServicos()
      setServicos(data)
    } catch {
      setErro('Erro ao carregar serviços.')
    }
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function iniciarEdicao(s) {
    setEditandoId(s.idservico)
    setForm({
      nome:      s.nome,
      tipo:      s.tipo,
      duracao:   s.duracao,
      preco:     s.preco,
      descricao: s.descricao || '',
    })
    setErro('')
    setSucesso('')
    window.requestAnimationFrame(() => {
      formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      nomeInputRef.current?.focus({ preventScroll: true })
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setErro('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    setLoading(true)

    const payload = {
      ...form,
      duracao: Number(form.duracao),
      preco:   Number(form.preco),
    }

    try {
      if (editandoId) {
        await atualizarServico(editandoId, payload)
        setSucesso('Serviço atualizado com sucesso!')
      } else {
        await criarServico(payload)
        setSucesso('Serviço criado com sucesso!')
      }
      setEditandoId(null)
      setForm(FORM_VAZIO)
      await carregar()
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao salvar serviço.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeletar(id) {
    if (!confirm('Tem certeza que deseja remover este serviço?')) return
    try {
      await deletarServico(id)
      setSucesso('Serviço removido.')
      await carregar()
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao remover serviço.')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 bg-surface border-b border-outline-variant">
        <Link to="/admin" className="font-headline text-xl text-on-surface hover:text-primary transition-colors">
          O Rei da Navalha — Admin
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-on-surface-variant">{user?.nome || user?.name}</span>
          <button
            onClick={() => { logout(); window.location.href = '/login' }}
            className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-error transition-colors"
          >
            <BrandIcon name="logout" size={18} />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Título */}
        <div className="flex items-center gap-3">
          <Link to="/admin" aria-label="Voltar ao painel administrativo" className="text-on-surface-variant hover:text-primary transition-colors">
            <BrandIcon name="back" />
          </Link>
          <h1 className="font-headline text-3xl">Gerenciar Serviços</h1>
        </div>

        {/* Feedback */}
        {erro    && <p role="alert" className="text-error text-sm">{erro}</p>}
        {sucesso && <p role="status" className="text-primary text-sm">{sucesso}</p>}

        {/* Formulário */}
        <section ref={formularioRef} className="glass-panel rounded-2xl p-6 border border-outline-variant/10 space-y-6 scroll-mt-6">
          <h2 className="font-headline text-xl">
            {editandoId ? 'Editar Serviço' : 'Novo Serviço'}
          </h2>

          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="servico-nome" className="text-xs text-on-surface-variant uppercase tracking-widest">Nome</label>
              <input
                ref={nomeInputRef}
                id="servico-nome"
                name="nome" value={form.nome} onChange={handleChange} required
                placeholder="Ex: Corte masculino"
                className="bg-surface border border-outline-variant rounded-xl px-4 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="servico-tipo" className="text-xs text-on-surface-variant uppercase tracking-widest">Tipo</label>
              <select
                id="servico-tipo"
                name="tipo" value={form.tipo} onChange={handleChange}
                className="bg-surface border border-outline-variant rounded-xl px-4 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="servico">Serviço</option>
                <option value="produto">Produto</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="servico-duracao" className="text-xs text-on-surface-variant uppercase tracking-widest">Duração (min)</label>
              <input
                id="servico-duracao"
                name="duracao" type="number" min="1" value={form.duracao} onChange={handleChange} required
                placeholder="Ex: 30"
                className="bg-surface border border-outline-variant rounded-xl px-4 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="servico-preco" className="text-xs text-on-surface-variant uppercase tracking-widest">Preço (R$)</label>
              <input
                id="servico-preco"
                name="preco" type="number" min="0" step="0.01" value={form.preco} onChange={handleChange} required
                placeholder="Ex: 45.00"
                className="bg-surface border border-outline-variant rounded-xl px-4 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="servico-descricao" className="text-xs text-on-surface-variant uppercase tracking-widest">Descrição (opcional)</label>
              <input
                id="servico-descricao"
                name="descricao" value={form.descricao} onChange={handleChange}
                placeholder="Ex: Inclui lavagem e finalização"
                className="bg-surface border border-outline-variant rounded-xl px-4 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit" disabled={loading}
                className="px-6 py-2 bg-primary text-on-primary rounded-full text-xs font-label font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar serviço'}
              </button>
              {editandoId && (
                <button
                  type="button" onClick={cancelarEdicao}
                  className="px-6 py-2 border border-outline-variant text-on-surface-variant rounded-full text-xs font-label font-bold uppercase tracking-widest hover:border-primary transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Lista de serviços */}
        <section className="space-y-3">
          <h2 className="font-headline text-xl">Serviços cadastrados</h2>
          {servicos.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center border border-outline-variant/10">
              <BrandIcon name="razor" size={42} className="text-on-surface-variant mx-auto mb-2" />
              <p className="text-on-surface-variant text-sm">Nenhum serviço cadastrado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {servicos.map((s) => (
                <div
                  key={s.idservico}
                  className="glass-panel rounded-2xl px-6 py-4 border border-outline-variant/10 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-label font-bold text-sm text-on-surface">{s.nome}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{s.tipo}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {s.duracao} min · R$ {Number(s.preco).toFixed(2)}
                      {s.descricao && ` · ${s.descricao}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => iniciarEdicao(s)}
                      className="p-2 rounded-xl text-on-surface-variant hover:text-primary transition-colors"
                      title="Editar"
                      aria-label={`Editar ${s.nome}`}
                    >
                      <BrandIcon name="edit" size={18} />
                    </button>
                    <button
                      onClick={() => handleDeletar(s.idservico)}
                      className="p-2 rounded-xl text-on-surface-variant hover:text-error transition-colors"
                      title="Remover"
                      aria-label={`Remover ${s.nome}`}
                    >
                      <BrandIcon name="trash" size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

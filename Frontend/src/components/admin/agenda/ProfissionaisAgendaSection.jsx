import { useEffect, useRef, useState } from 'react'
import { listarProfissionais } from '../../../services/profissionaisService'
import {
  criarAusenciaProfissional,
  deletarAusenciaProfissional,
  listarAusenciasProfissional,
  listarHorariosProfissional,
  salvarHorariosProfissional,
} from '../../../services/agendaService'
import BrandIcon from '../../ui/BrandIcon'
import HorariosFuncionamentoSection from './HorariosFuncionamentoSection'
import { dataLocal } from './agendaConfig'

const AUSENCIA_INICIAL = { tipo: 'FOLGA', datainicio: '', datafim: '', descricao: '' }

export default function ProfissionaisAgendaSection({ aoErro, aoSucesso }) {
  const [profissionais, setProfissionais] = useState([])
  const [profissionalId, setProfissionalId] = useState('')
  const [horarios, setHorarios] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [ausencia, setAusencia] = useState(AUSENCIA_INICIAL)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [removendoId, setRemovendoId] = useState(null)
  const consultaRef = useRef(0)
  const profissionalAtualRef = useRef('')
  const montadoRef = useRef(true)

  const operando = salvando || removendoId !== null

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
      consultaRef.current += 1
    }
  }, [])

  useEffect(() => {
    let ativa = true
    listarProfissionais()
      .then((dados) => {
        if (!ativa || !montadoRef.current) return
        setProfissionais(dados)
        if (dados.length) setProfissionalId(String(dados[0].idprofissional))
        else setCarregando(false)
      })
      .catch((err) => {
        if (!ativa || !montadoRef.current) return
        aoErro(err.response?.data?.message || 'Erro ao carregar profissionais.')
        setCarregando(false)
      })
    return () => { ativa = false }
  }, [aoErro])

  useEffect(() => {
    profissionalAtualRef.current = profissionalId
    const consultaId = ++consultaRef.current
    if (!profissionalId) return
    Promise.all([
      listarHorariosProfissional(profissionalId),
      listarAusenciasProfissional(profissionalId),
    ])
      .then(([novosHorarios, novasAusencias]) => {
        if (consultaId !== consultaRef.current || profissionalAtualRef.current !== profissionalId) return
        setHorarios(novosHorarios)
        setAusencias(novasAusencias)
      })
      .catch((err) => {
        if (consultaId === consultaRef.current && profissionalAtualRef.current === profissionalId) {
          setHorarios([])
          setAusencias([])
          aoErro(err.response?.data?.message || 'Erro ao carregar a escala do profissional.')
        }
      })
      .finally(() => {
        if (consultaId === consultaRef.current && profissionalAtualRef.current === profissionalId) {
          setCarregando(false)
        }
      })
    return () => {
      if (consultaRef.current === consultaId) consultaRef.current += 1
    }
  }, [profissionalId, aoErro])

  function alterarHorario(diaSemana, campo, valor) {
    setHorarios((atuais) => atuais.map((item) => item.dia_semana === diaSemana
      ? { ...item, [campo]: valor }
      : item))
  }

  function selecionarProfissional(event) {
    const novoProfissionalId = event.target.value
    consultaRef.current += 1
    profissionalAtualRef.current = novoProfissionalId
    setCarregando(true)
    setHorarios([])
    setAusencias([])
    setAusencia(AUSENCIA_INICIAL)
    aoErro('')
    aoSucesso('')
    setProfissionalId(novoProfissionalId)
  }

  async function salvarHorarios(event) {
    event.preventDefault()
    const idDaOperacao = profissionalId
    setSalvando(true)
    aoErro('')
    aoSucesso('')
    try {
      const atualizados = await salvarHorariosProfissional(idDaOperacao, horarios)
      if (montadoRef.current && profissionalAtualRef.current === idDaOperacao) {
        setHorarios(atualizados)
        aoSucesso('Expediente individual atualizado.')
      }
    } catch (err) {
      if (montadoRef.current) aoErro(err.response?.data?.message || 'Erro ao salvar expediente individual.')
    } finally {
      if (montadoRef.current) setSalvando(false)
    }
  }

  async function adicionarAusencia(event) {
    event.preventDefault()
    const idDaOperacao = profissionalId
    aoErro('')
    aoSucesso('')
    setSalvando(true)
    try {
      const criada = await criarAusenciaProfissional(idDaOperacao, ausencia)
      if (montadoRef.current && profissionalAtualRef.current === idDaOperacao) {
        setAusencias((atuais) => [criada, ...atuais])
        setAusencia(AUSENCIA_INICIAL)
        aoSucesso('Ausência cadastrada. Esses dias não aceitarão novos agendamentos.')
      }
    } catch (err) {
      if (montadoRef.current) aoErro(err.response?.data?.message || 'Erro ao cadastrar ausência.')
    } finally {
      if (montadoRef.current) setSalvando(false)
    }
  }

  async function removerAusencia(id) {
    if (!window.confirm('Remover esta ausência da escala?')) return
    const idDaOperacao = profissionalId
    aoErro('')
    aoSucesso('')
    setRemovendoId(id)
    try {
      await deletarAusenciaProfissional(idDaOperacao, id)
      if (montadoRef.current && profissionalAtualRef.current === idDaOperacao) {
        setAusencias((atuais) => atuais.filter((item) => item.iddisponibilidade !== id))
        aoSucesso('Ausência removida.')
      }
    } catch (err) {
      if (montadoRef.current) aoErro(err.response?.data?.message || 'Erro ao remover ausência.')
    } finally {
      if (montadoRef.current) setRemovendoId(null)
    }
  }

  return (
    <div id="painel-profissionais" role="tabpanel" aria-labelledby="aba-profissionais" className="space-y-6">
      <section className="glass-panel rounded-2xl border border-outline-variant/10 p-4 sm:p-6">
        <label htmlFor="profissional-escala" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
          Profissional
        </label>
        <select id="profissional-escala" value={profissionalId} onChange={selecionarProfissional} disabled={operando}
          className="w-full sm:max-w-md bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface">
          {profissionais.length === 0 && <option value="">Nenhum profissional ativo</option>}
          {profissionais.map((item) => <option key={item.idprofissional} value={item.idprofissional}>{item.nome}</option>)}
        </select>
      </section>

      {carregando ? (
        <p role="status" className="text-center text-sm text-on-surface-variant py-10">Carregando escala...</p>
      ) : profissionalId && (
        <>
          <HorariosFuncionamentoSection horarios={horarios} salvando={salvando} aoAlterar={alterarHorario}
            aoSalvar={salvarHorarios} comoPainel={false} titulo="Expediente individual"
            descricao="Estes horários substituem o funcionamento global somente para o profissional selecionado."
            rotuloSalvar="Salvar escala" />

          <section className="glass-panel rounded-2xl border border-outline-variant/10 p-4 sm:p-6 space-y-5">
            <div>
              <h2 className="font-headline text-xl">Folgas, férias e indisponibilidades</h2>
              <p className="text-xs text-on-surface-variant mt-1">Períodos com agendamentos ativos não podem ser bloqueados.</p>
            </div>
            <form onSubmit={adicionarAusencia}>
              <fieldset disabled={operando} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <label className="text-xs text-on-surface-variant"><span className="block mb-2">Tipo</span>
                <select value={ausencia.tipo} onChange={(event) => setAusencia((atual) => ({ ...atual, tipo: event.target.value }))}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2.5 text-sm text-on-surface">
                  <option value="FOLGA">Folga</option><option value="FERIAS">Férias</option><option value="FERIADO">Feriado individual</option>
                </select>
              </label>
              <label className="text-xs text-on-surface-variant"><span className="block mb-2">Início</span>
                <input type="date" required value={ausencia.datainicio} onChange={(event) => setAusencia((atual) => ({ ...atual, datainicio: event.target.value, datafim: atual.datafim || event.target.value }))}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" />
              </label>
              <label className="text-xs text-on-surface-variant"><span className="block mb-2">Fim</span>
                <input type="date" required min={ausencia.datainicio || undefined} value={ausencia.datafim} onChange={(event) => setAusencia((atual) => ({ ...atual, datafim: event.target.value }))}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" />
              </label>
              <button type="submit" disabled={salvando || !profissionalId}
                className="rounded-full bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-primary disabled:opacity-50">Adicionar</button>
              <label className="sm:col-span-2 lg:col-span-4 text-xs text-on-surface-variant"><span className="block mb-2">Motivo ou observação (opcional)</span>
                <input maxLength="255" value={ausencia.descricao} onChange={(event) => setAusencia((atual) => ({ ...atual, descricao: event.target.value }))}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2.5 text-sm text-on-surface" />
              </label>
              </fieldset>
            </form>

            {ausencias.length === 0 ? <p className="text-sm text-on-surface-variant">Nenhuma ausência cadastrada.</p> : (
              <ul className="grid gap-3">
                {ausencias.map((item) => {
                  const inicio = dataLocal(item.datainicio)?.toLocaleDateString('pt-BR')
                  const fim = dataLocal(item.datafim)?.toLocaleDateString('pt-BR')
                  return <li key={item.iddisponibilidade} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/10 bg-surface/70 p-4">
                    <div><strong className="text-sm text-primary">{item.tipo}</strong><p className="text-sm mt-1">{inicio} até {fim}</p>{item.descricao && <p className="text-xs text-on-surface-variant mt-1">{item.descricao}</p>}</div>
                    <button type="button" onClick={() => removerAusencia(item.iddisponibilidade)}
                      disabled={operando} aria-label={`Remover ausência de ${inicio} até ${fim}`}
                      className="self-start sm:self-center rounded-full border border-error/25 p-2 text-error hover:bg-error/10"><BrandIcon name="trash" size={18} /></button>
                  </li>
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listarProfissionais } from '../../../services/profissionaisService'
import {
  analisarSolicitacaoAusencia,
  criarAusenciaProfissional,
  deletarAusenciaProfissional,
  listarAusenciasProfissional,
  listarHorariosProfissional,
  listarSolicitacoesAusenciaAdmin,
  salvarHorariosProfissional,
} from '../../../services/agendaService'
import BrandIcon from '../../ui/BrandIcon'
import BrandedDatePicker from '../../ui/BrandedDatePicker'
import ConfirmDialog from '../../ui/ConfirmDialog'
import HorariosFuncionamentoSection from './HorariosFuncionamentoSection'
import { dataLocal } from './agendaConfig'

const AUSENCIA_INICIAL = { tipo: 'FOLGA', datainicio: '', datafim: '', descricao: '' }

export default function ProfissionaisAgendaSection({ aoErro, aoSucesso }) {
  const [searchParams] = useSearchParams()
  const [profissionais, setProfissionais] = useState([])
  const [profissionalId, setProfissionalId] = useState('')
  const [horarios, setHorarios] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState([])
  const [respostasSolicitacoes, setRespostasSolicitacoes] = useState({})
  const [solicitacaoParaAnalisar, setSolicitacaoParaAnalisar] = useState(null)
  const [ausenciaParaRemover, setAusenciaParaRemover] = useState(null)
  const [ausencia, setAusencia] = useState(AUSENCIA_INICIAL)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [removendoId, setRemovendoId] = useState(null)
  const [analisandoId, setAnalisandoId] = useState(null)
  const consultaRef = useRef(0)
  const profissionalAtualRef = useRef('')
  const montadoRef = useRef(true)

  const operando = salvando || removendoId !== null || analisandoId !== null

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
      consultaRef.current += 1
    }
  }, [])

  useEffect(() => {
    let ativa = true
    Promise.all([listarProfissionais(), listarSolicitacoesAusenciaAdmin({ status: 'PENDENTE' })])
      .then(([dados, solicitacoes]) => {
        if (!ativa || !montadoRef.current) return
        setProfissionais(dados)
        setSolicitacoesPendentes(solicitacoes)
        const profissionalSolicitado = searchParams.get('profissionalId')
        const selecionado = dados.find((item) => String(item.idprofissional) === profissionalSolicitado) || dados[0]
        if (selecionado) setProfissionalId(String(selecionado.idprofissional))
        else setCarregando(false)
      })
      .catch((err) => {
        if (!ativa || !montadoRef.current) return
        aoErro(err.response?.data?.message || 'Não foi possível carregar os profissionais. Tente novamente.')
        setCarregando(false)
      })
    return () => { ativa = false }
  }, [aoErro, searchParams])

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
          aoErro(err.response?.data?.message || 'Não foi possível carregar a escala do profissional. Tente novamente.')
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
      if (montadoRef.current) aoErro(err.response?.data?.message || 'Não foi possível salvar o expediente individual. Tente novamente.')
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
      if (montadoRef.current) aoErro(err.response?.data?.message || 'Não foi possível cadastrar a ausência. Tente novamente.')
    } finally {
      if (montadoRef.current) setSalvando(false)
    }
  }

  function solicitarRemocaoAusencia(item) {
    setAusenciaParaRemover({ ...item, profissionalId })
  }

  async function confirmarRemocaoAusencia() {
    if (!ausenciaParaRemover) return
    const id = ausenciaParaRemover.iddisponibilidade
    const idDaOperacao = ausenciaParaRemover.profissionalId
    aoErro('')
    aoSucesso('')
    setRemovendoId(id)
    try {
      await deletarAusenciaProfissional(idDaOperacao, id)
      if (montadoRef.current && profissionalAtualRef.current === idDaOperacao) {
        setAusencias((atuais) => atuais.filter((item) => item.iddisponibilidade !== id))
        aoSucesso('Ausência removida.')
      }
      if (montadoRef.current) setAusenciaParaRemover(null)
    } catch (err) {
      if (montadoRef.current) aoErro(err.response?.data?.message || 'Não foi possível remover a ausência. Tente novamente.')
    } finally {
      if (montadoRef.current) setRemovendoId(null)
    }
  }

  async function analisarSolicitacao(item, decisao) {
    const resposta = respostasSolicitacoes[item.idsolicitacao]?.trim() || ''
    if (decisao === 'RECUSAR' && !resposta) {
      aoErro('Informe o motivo da recusa antes de continuar.')
      return
    }
    if (!solicitacaoParaAnalisar) {
      setSolicitacaoParaAnalisar({ item, decisao })
      return
    }
    aoErro('')
    aoSucesso('')
    setAnalisandoId(item.idsolicitacao)
    try {
      const resultado = await analisarSolicitacaoAusencia(item.idsolicitacao, decisao, resposta)
      if (!montadoRef.current) return
      setSolicitacoesPendentes((atuais) => atuais.filter((solicitacao) => solicitacao.idsolicitacao !== item.idsolicitacao))
      setRespostasSolicitacoes((atuais) => {
        const proximas = { ...atuais }
        delete proximas[item.idsolicitacao]
        return proximas
      })
      if (resultado.disponibilidade && String(item.profissional_idprofissional) === profissionalAtualRef.current) {
        setAusencias((atuais) => [resultado.disponibilidade, ...atuais])
      }
      aoSucesso(decisao === 'APROVAR'
        ? 'Solicitação aprovada. O período foi bloqueado na agenda do profissional.'
        : 'Solicitação recusada. A agenda do profissional permanece disponível.')
    } catch (err) {
      if (montadoRef.current) aoErro(err.response?.data?.message || 'Não foi possível analisar a solicitação. Tente novamente.')
    } finally {
      if (montadoRef.current) {
        setAnalisandoId(null)
        setSolicitacaoParaAnalisar(null)
      }
    }
  }

  return (
    <div id="painel-profissionais" role="tabpanel" aria-labelledby="aba-profissionais" className="space-y-6">
      <section className="glass-panel rounded-2xl border border-primary/15 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Aprovação necessária</p><h2 className="font-headline text-xl sm:text-2xl mt-2">Solicitações de folga e férias</h2><p className="text-xs text-on-surface-variant mt-1">Pedidos pendentes não bloqueiam horários até serem aprovados.</p></div>
          <span className="self-start rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">{solicitacoesPendentes.length} pendente(s)</span>
        </div>
        {solicitacoesPendentes.length ? <div className="grid lg:grid-cols-2 gap-3">{solicitacoesPendentes.map((item) => {
          const inicio = dataLocal(item.datainicio)?.toLocaleDateString('pt-BR')
          const fim = dataLocal(item.datafim)?.toLocaleDateString('pt-BR')
          return <article key={item.idsolicitacao} className="rounded-2xl border border-white/10 bg-surface/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-[9px] font-bold uppercase tracking-wider text-primary">{item.tipo}</span><h3 className="font-semibold mt-1">{item.profissional}</h3><p className="text-sm text-on-surface-variant mt-1">{inicio} até {fim}</p></div><span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[9px] font-bold text-amber-200">PENDENTE</span></div>
            {item.motivo && <p className="mt-3 rounded-xl border border-white/5 bg-black/10 p-3 text-xs text-on-surface-variant">{item.motivo}</p>}
            <label className="block mt-3 text-[10px] uppercase tracking-wider text-on-surface-variant"><span className="block mb-1.5">Resposta ao profissional</span><input value={respostasSolicitacoes[item.idsolicitacao] || ''} maxLength="255" onChange={(event) => setRespostasSolicitacoes((atuais) => ({ ...atuais, [item.idsolicitacao]: event.target.value }))} placeholder="Obrigatória em caso de recusa" className="w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm normal-case tracking-normal text-on-surface outline-none focus:border-primary/50" /></label>
            <div className="mt-4 flex flex-col sm:flex-row gap-2"><button type="button" disabled={operando} onClick={() => analisarSolicitacao(item, 'APROVAR')} className="rounded-full bg-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-on-primary disabled:opacity-50">Aprovar</button><button type="button" disabled={operando} onClick={() => analisarSolicitacao(item, 'RECUSAR')} className="rounded-full border border-error/30 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-error hover:bg-error/10 disabled:opacity-50">Recusar</button></div>
          </article>
        })}</div> : <div className="rounded-xl border border-white/5 bg-black/10 px-4 py-6 text-center"><BrandIcon name="check" size={25} className="mx-auto text-emerald-300" /><p className="text-sm mt-2">Nenhuma solicitação aguardando análise.</p></div>}
      </section>

      <ConfirmDialog aberto={Boolean(solicitacaoParaAnalisar)} variante={solicitacaoParaAnalisar?.decisao === 'APROVAR' ? 'principal' : 'perigo'} titulo={solicitacaoParaAnalisar?.decisao === 'APROVAR' ? 'Aprovar solicitação?' : 'Recusar solicitação?'} descricao={solicitacaoParaAnalisar?.decisao === 'APROVAR' ? 'O período será bloqueado na agenda após a aprovação.' : 'O profissional será informado e o período continuará disponível.'} rotuloConfirmar={solicitacaoParaAnalisar?.decisao === 'APROVAR' ? 'Confirmar aprovação' : 'Confirmar recusa'} rotuloProcessando="Salvando..." processando={analisandoId !== null} aoConfirmar={() => analisarSolicitacao(solicitacaoParaAnalisar.item, solicitacaoParaAnalisar.decisao)} aoFechar={() => setSolicitacaoParaAnalisar(null)}>
        {solicitacaoParaAnalisar && <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm"><div className="flex items-center justify-between gap-3"><strong>{solicitacaoParaAnalisar.item.profissional}</strong><span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">{solicitacaoParaAnalisar.item.tipo}</span></div><p className="mt-2 text-on-surface-variant">{dataLocal(solicitacaoParaAnalisar.item.datainicio)?.toLocaleDateString('pt-BR')} até {dataLocal(solicitacaoParaAnalisar.item.datafim)?.toLocaleDateString('pt-BR')}</p>{respostasSolicitacoes[solicitacaoParaAnalisar.item.idsolicitacao] && <p className="mt-3 border-t border-white/10 pt-3 text-xs text-on-surface-variant">{respostasSolicitacoes[solicitacaoParaAnalisar.item.idsolicitacao]}</p>}</div>}
      </ConfirmDialog>

      <ConfirmDialog
        aberto={Boolean(ausenciaParaRemover)}
        titulo="Remover ausência da escala?"
        descricao={ausenciaParaRemover
          ? `O período de ${dataLocal(ausenciaParaRemover.datainicio)?.toLocaleDateString('pt-BR')} até ${dataLocal(ausenciaParaRemover.datafim)?.toLocaleDateString('pt-BR')} voltará a seguir o expediente do profissional.`
          : ''}
        rotuloConfirmar="Remover ausência"
        rotuloProcessando="Removendo..."
        processando={removendoId !== null}
        aoConfirmar={confirmarRemocaoAusencia}
        aoFechar={() => { if (removendoId === null) setAusenciaParaRemover(null) }}
      />

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
            rotuloSalvar="Salvar escala" rotuloAtivo="Trabalha"
            rotuloInativo={'N\u00e3o trabalha'} rotuloResumo="dias de trabalho" />

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
              <div className="text-xs text-on-surface-variant"><span className="block mb-2">Início</span>
                <BrandedDatePicker id="ausencia-inicio" value={ausencia.datainicio} onChange={(valor) => setAusencia((atual) => ({ ...atual, datainicio: valor, datafim: !atual.datafim || atual.datafim < valor ? valor : atual.datafim }))} />
              </div>
              <div className="text-xs text-on-surface-variant"><span className="block mb-2">Fim</span>
                <BrandedDatePicker id="ausencia-fim" value={ausencia.datafim} min={ausencia.datainicio || undefined} onChange={(valor) => setAusencia((atual) => ({ ...atual, datafim: valor }))} />
              </div>
              <button type="submit" disabled={salvando || !profissionalId || !ausencia.datainicio || !ausencia.datafim}
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
                    <button type="button" onClick={() => solicitarRemocaoAusencia(item)}
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

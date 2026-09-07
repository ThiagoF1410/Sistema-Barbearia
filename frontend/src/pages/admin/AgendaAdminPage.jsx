import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  listarAgenda,
  listarHorariosFuncionamento,
  salvarHorariosFuncionamento,
  listarFeriados,
  importarFeriados,
  atualizarFeriado,
  criarData,
  alterarDisponibilidade,
  deletarData,
} from '../../services/agendaService'
import BrandIcon from '../../components/ui/BrandIcon'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import AdminLayout from '../../components/admin/AdminLayout'
import NavegacaoAgenda from '../../components/admin/agenda/NavegacaoAgenda'
import DatasEspeciaisSection from '../../components/admin/agenda/DatasEspeciaisSection'
import HorariosFuncionamentoSection from '../../components/admin/agenda/HorariosFuncionamentoSection'
import FeriadosSection from '../../components/admin/agenda/FeriadosSection'
import ProfissionaisAgendaSection from '../../components/admin/agenda/ProfissionaisAgendaSection'
import { SECOES_AGENDA } from '../../components/admin/agenda/agendaConfig'

export default function AgendaAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const secaoInformada = searchParams.get('secao')
  const secao = SECOES_AGENDA.some((item) => item.id === secaoInformada) ? secaoInformada : 'horarios'
  const [datas, setDatas] = useState([])
  const [novaData, setNovaData] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [horarios, setHorarios] = useState([])
  const [salvandoHorarios, setSalvandoHorarios] = useState(false)
  const [feriados, setFeriados] = useState([])
  const [anoFeriados, setAnoFeriados] = useState(new Date().getFullYear())
  const [importandoFeriados, setImportandoFeriados] = useState(false)
  const [carregandoAgenda, setCarregandoAgenda] = useState(true)
  const [dataParaExcluir, setDataParaExcluir] = useState(null)
  const [excluindoData, setExcluindoData] = useState(false)

  const hojeLocal = new Date()
  const dataMinima = `${hojeLocal.getFullYear()}-${String(hojeLocal.getMonth() + 1).padStart(2, '0')}-${String(hojeLocal.getDate()).padStart(2, '0')}`

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    listarFeriados(anoFeriados)
      .then(setFeriados)
      .catch((err) => setErro(err.response?.data?.message || 'Não foi possível carregar os feriados. Tente novamente.'))
  }, [anoFeriados])

  async function carregar() {
    try {
      const [agenda, funcionamento] = await Promise.all([listarAgenda(), listarHorariosFuncionamento()])
      setDatas(agenda)
      setHorarios(funcionamento)
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível carregar a agenda. Tente novamente.')
    } finally {
      setCarregandoAgenda(false)
    }
  }

  function alterarHorario(diaSemana, campo, valor) {
    setHorarios((atuais) => atuais.map((horario) =>
      horario.dia_semana === diaSemana ? { ...horario, [campo]: valor } : horario
    ))
  }

  async function handleSalvarHorarios(event) {
    event.preventDefault()
    setErro('')
    setSucesso('')
    setSalvandoHorarios(true)
    try {
      const atualizados = await salvarHorariosFuncionamento(horarios)
      setHorarios(atualizados)
      setSucesso('Horários de funcionamento atualizados.')
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível salvar os horários de funcionamento. Tente novamente.')
    } finally {
      setSalvandoHorarios(false)
    }
  }

  function alterarFeriadoLocal(id, campo, valor) {
    setFeriados((atuais) => atuais.map((feriado) =>
      feriado.idferiado === id ? { ...feriado, [campo]: valor } : feriado
    ))
  }

  async function handleImportarFeriados() {
    setErro('')
    setSucesso('')
    setImportandoFeriados(true)
    try {
      const importados = await importarFeriados(anoFeriados)
      setFeriados(importados)
      setSucesso(`Feriados nacionais de ${anoFeriados} importados.`)
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível importar os feriados. Tente novamente.')
    } finally {
      setImportandoFeriados(false)
    }
  }

  async function handleSalvarFeriado(feriado) {
    setErro('')
    setSucesso('')
    try {
      const atualizado = await atualizarFeriado(feriado.idferiado, {
        modo_funcionamento: feriado.modo_funcionamento,
        hora_abertura: feriado.hora_abertura,
        hora_fechamento: feriado.hora_fechamento,
      })
      setFeriados((atuais) => atuais.map((item) => item.idferiado === atualizado.idferiado ? atualizado : item))
      setSucesso(`${feriado.nome} atualizado.`)
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível atualizar o feriado. Tente novamente.')
    }
  }

  async function handleAdicionarData(event) {
    event.preventDefault()
    setErro('')
    setSucesso('')
    try {
      await criarData({ data: novaData, disponivel: true })
      setSucesso('Data adicionada à agenda.')
      setNovaData('')
      await carregar()
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível adicionar a data. Tente novamente.')
    }
  }

  async function handleToggle(id, disponivel) {
    try {
      await alterarDisponibilidade(id, !disponivel)
      await carregar()
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível alterar a disponibilidade. Tente novamente.')
    }
  }

  function handleDeletar(id) {
    setDataParaExcluir(datas.find((item) => item.idagenda === id) || { idagenda: id })
  }

  async function confirmarExclusao() {
    if (!dataParaExcluir) return
    setExcluindoData(true)
    setErro('')
    setSucesso('')
    try {
      await deletarData(dataParaExcluir.idagenda)
      setSucesso('Data removida.')
      setDataParaExcluir(null)
      await carregar()
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível remover a data. Tente novamente.')
    } finally {
      setExcluindoData(false)
    }
  }

  function mudarSecao(id) {
    setErro('')
    setSucesso('')
    setSearchParams({ secao: id }, { replace: true })
  }

  const diasAbertos = horarios.filter((item) => item.ativo).length
  const diasComIntervalo = horarios.filter((item) => item.ativo && item.intervalo_ativo).length
  const datasBloqueadas = datas.filter((item) => !item.disponivel).length
  const feriadosFechados = feriados.filter((item) => item.modo_funcionamento === 'fechado').length
  const indicadores = [
    { icon: 'clock', valor: diasAbertos, rotulo: 'Dias abertos', detalhe: 'Funcionamento semanal' },
    { icon: 'history', valor: diasComIntervalo, rotulo: 'Dias com intervalo', detalhe: 'Pausas configuradas' },
    { icon: 'holiday', valor: feriadosFechados, rotulo: 'Feriados fechados', detalhe: `Referência de ${anoFeriados}` },
    { icon: 'calendar', valor: datasBloqueadas, rotulo: 'Datas bloqueadas', detalhe: 'Exceções cadastradas' },
  ]

  return (
    <AdminLayout titulo="Agenda" subtitulo="Funcionamento e disponibilidade">
      <main className="max-w-[1480px] mx-auto px-4 sm:px-6 py-7 sm:py-9 space-y-7">
        <section className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
          <div><p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Operação</p><h1 className="font-headline text-3xl sm:text-4xl mt-2">Gerenciar agenda</h1><p className="text-sm text-on-surface-variant mt-2 max-w-2xl">Configure o funcionamento da barbearia, as escalas da equipe e todas as exceções do calendário.</p></div>
          <div className="inline-flex items-center gap-2 self-start xl:self-auto rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-200"><span className="w-2 h-2 rounded-full bg-emerald-400" />Agenda configurável por profissional</div>
        </section>

        <section aria-label="Resumo da agenda" className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">{indicadores.map((item) => <div key={item.rotulo} className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="w-10 h-10 rounded-xl border border-primary/20 bg-primary/10 text-primary flex items-center justify-center"><BrandIcon name={item.icon} size={21} /></div><span className="font-headline text-2xl text-primary">{carregandoAgenda ? '—' : item.valor}</span></div><p className="text-xs font-bold mt-4">{item.rotulo}</p><p className="text-[10px] text-on-surface-variant mt-1">{item.detalhe}</p></div>)}</section>

        {erro && <div role="alert" className="rounded-2xl border border-error/25 bg-error/10 px-4 py-4 text-sm text-error flex items-center gap-3"><BrandIcon name="alert" size={20} className="shrink-0" /><span>{erro}</span></div>}
        {sucesso && <div role="status" className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200 flex items-center gap-3"><BrandIcon name="check" size={20} className="shrink-0" /><span>{sucesso}</span></div>}

        <NavegacaoAgenda secao={secao} aoMudar={mudarSecao} />

        {secao === 'horarios' && (
          carregandoAgenda ? <div className="grid md:grid-cols-2 gap-4" role="status" aria-label="Carregando horários">{[1, 2, 3, 4].map((item) => <div key={item} className="h-44 rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse" />)}</div> : <HorariosFuncionamentoSection horarios={horarios} salvando={salvandoHorarios} aoAlterar={alterarHorario} aoSalvar={handleSalvarHorarios} />
        )}

        {secao === 'feriados' && (
          <FeriadosSection feriados={feriados} ano={anoFeriados} importando={importandoFeriados}
            aoAlterarAno={setAnoFeriados} aoImportar={handleImportarFeriados} aoAlterar={alterarFeriadoLocal} aoSalvar={handleSalvarFeriado} />
        )}

        {secao === 'profissionais' && (
          <ProfissionaisAgendaSection aoErro={setErro} aoSucesso={setSucesso} />
        )}

        {secao === 'datas' && (
          <DatasEspeciaisSection datas={datas} feriados={feriados} novaData={novaData} dataMinima={dataMinima} aoAlterarNovaData={setNovaData}
            aoAdicionar={handleAdicionarData} aoAlternar={handleToggle} aoExcluir={handleDeletar} aoAnoDoCalendario={setAnoFeriados} aoVerFeriados={() => mudarSecao('feriados')} />
        )}
      </main>
      <ConfirmDialog
        aberto={Boolean(dataParaExcluir)}
        titulo="Remover data especial?"
        descricao={dataParaExcluir?.data
          ? `A data ${new Date(`${dataParaExcluir.data}T12:00:00`).toLocaleDateString('pt-BR')} será removida da agenda. O histórico de agendamentos cancelados será preservado.`
          : 'Esta data será removida da agenda. O histórico de agendamentos cancelados será preservado.'}
        rotuloConfirmar="Remover data"
        processando={excluindoData}
        aoConfirmar={confirmarExclusao}
        aoFechar={() => { if (!excluindoData) setDataParaExcluir(null) }}
      />
    </AdminLayout>
  )
}

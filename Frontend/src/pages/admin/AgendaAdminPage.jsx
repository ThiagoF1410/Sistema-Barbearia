import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
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
import NavegacaoAgenda from '../../components/admin/agenda/NavegacaoAgenda'
import DatasEspeciaisSection from '../../components/admin/agenda/DatasEspeciaisSection'
import HorariosFuncionamentoSection from '../../components/admin/agenda/HorariosFuncionamentoSection'
import FeriadosSection from '../../components/admin/agenda/FeriadosSection'
import ProfissionaisAgendaSection from '../../components/admin/agenda/ProfissionaisAgendaSection'
import { SECOES_AGENDA } from '../../components/admin/agenda/agendaConfig'

export default function AgendaAdminPage() {
  const { user, logout } = useAuth()
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

  const hojeLocal = new Date()
  const dataMinima = `${hojeLocal.getFullYear()}-${String(hojeLocal.getMonth() + 1).padStart(2, '0')}-${String(hojeLocal.getDate()).padStart(2, '0')}`

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    listarFeriados(anoFeriados)
      .then(setFeriados)
      .catch(() => setErro('Erro ao carregar feriados. Execute a migração 003_feriados.sql.'))
  }, [anoFeriados])

  async function carregar() {
    try {
      const [agenda, funcionamento] = await Promise.all([listarAgenda(), listarHorariosFuncionamento()])
      setDatas(agenda)
      setHorarios(funcionamento)
    } catch {
      setErro('Erro ao carregar agenda.')
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
      setErro(err.response?.data?.message || 'Erro ao salvar horários de funcionamento.')
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
      setErro(err.response?.data?.message || 'Erro ao importar feriados.')
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
      setErro(err.response?.data?.message || 'Erro ao atualizar feriado.')
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
      setErro(err.response?.data?.message || 'Erro ao adicionar data.')
    }
  }

  async function handleToggle(id, disponivel) {
    try {
      await alterarDisponibilidade(id, !disponivel)
      await carregar()
    } catch {
      setErro('Erro ao alterar disponibilidade.')
    }
  }

  async function handleDeletar(id) {
    if (!confirm('Remover esta data da agenda?')) return
    try {
      await deletarData(id)
      setSucesso('Data removida.')
      await carregar()
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao remover data.')
    }
  }

  function mudarSecao(id) {
    setErro('')
    setSucesso('')
    setSearchParams({ secao: id }, { replace: true })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 bg-surface border-b border-outline-variant">
        <Link to="/admin" className="font-headline text-xl text-on-surface hover:text-primary transition-colors">O Rei da Navalha — Admin</Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-on-surface-variant">{user?.nome || user?.name}</span>
          <button onClick={() => { logout(); window.location.href = '/login' }} className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-error transition-colors">
            <BrandIcon name="logout" size={18} />Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-7">
        <div className="flex items-center gap-3">
          <Link to="/admin" aria-label="Voltar ao painel administrativo" className="text-on-surface-variant hover:text-primary transition-colors"><BrandIcon name="back" /></Link>
          <h1 className="font-headline text-3xl">Gerenciar Agenda</h1>
        </div>

        {erro && <p role="alert" className="text-error text-sm">{erro}</p>}
        {sucesso && <p role="status" className="text-primary text-sm">{sucesso}</p>}

        <NavegacaoAgenda secao={secao} aoMudar={mudarSecao} />

        {secao === 'horarios' && (
          <HorariosFuncionamentoSection horarios={horarios} salvando={salvandoHorarios} aoAlterar={alterarHorario} aoSalvar={handleSalvarHorarios} />
        )}

        {secao === 'feriados' && (
          <FeriadosSection feriados={feriados} ano={anoFeriados} importando={importandoFeriados}
            aoAlterarAno={setAnoFeriados} aoImportar={handleImportarFeriados} aoAlterar={alterarFeriadoLocal} aoSalvar={handleSalvarFeriado} />
        )}

        {secao === 'profissionais' && (
          <ProfissionaisAgendaSection aoErro={setErro} aoSucesso={setSucesso} />
        )}

        {secao === 'datas' && (
          <DatasEspeciaisSection datas={datas} novaData={novaData} dataMinima={dataMinima} aoAlterarNovaData={setNovaData}
            aoAdicionar={handleAdicionarData} aoAlternar={handleToggle} aoExcluir={handleDeletar} />
        )}
      </main>
    </div>
  )
}

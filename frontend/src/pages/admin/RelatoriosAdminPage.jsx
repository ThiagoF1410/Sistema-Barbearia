import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import BrandIcon from '../../components/ui/BrandIcon'
import { carregarRelatorioMensal } from '../../services/pagamentosService'
import useFeedbackFocus from '../../hooks/useFeedbackFocus'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function SkeletonRelatorio() {
  return <div className="p-5 space-y-3 animate-pulse" aria-hidden="true">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-14 rounded-xl bg-white/[0.05]" />)}</div>
}

export default function RelatoriosAdminPage() {
  const [ano, setAno] = useState(new Date().getFullYear())
  const [relatorio, setRelatorio] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [mesExportacao, setMesExportacao] = useState('')
  const [erro, setErro] = useState('')
  const erroRef = useFeedbackFocus(erro)

  async function carregar(anoSelecionado) {
    setCarregando(true)
    setErro('')
    try {
      setRelatorio(await carregarRelatorioMensal(anoSelecionado))
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível gerar o relatório.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    let ativa = true
    carregarRelatorioMensal(new Date().getFullYear())
      .then((dados) => { if (ativa) setRelatorio(dados) })
      .catch((err) => {
        if (ativa) setErro(err.response?.data?.message || 'Não foi possível gerar o relatório.')
      })
      .finally(() => { if (ativa) setCarregando(false) })
    return () => { ativa = false }
  }, [])

  function consultar(event) {
    event.preventDefault()
    carregar(ano)
  }

  async function exportarXlsx() {
    if (!relatorio || exportando) return
    setExportando(true)
    setErro('')
    try {
      const modulo = await import('exceljs')
      const ExcelJS = modulo.default || modulo
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'O Rei da Navalha'
      workbook.company = 'O Rei da Navalha Barbearia'
      workbook.title = `Relatório financeiro de ${relatorio.ano}`
      workbook.subject = 'Atendimentos, pagamentos e faturamento confirmado'
      workbook.created = new Date()

      const meses = mesExportacao
        ? relatorio.meses.filter((item) => Number(item.mes) === Number(mesExportacao))
        : relatorio.meses
      const periodo = mesExportacao
        ? `${MESES[Number(mesExportacao) - 1]} de ${relatorio.ano}`
        : `Ano de ${relatorio.ano}`
      const totaisExportados = meses.reduce((acumulado, item) => ({
        agendamentos: acumulado.agendamentos + Number(item.total_agendamentos || 0),
        concluidos: acumulado.concluidos + Number(item.concluidos || 0),
        cancelados: acumulado.cancelados + Number(item.cancelados || 0),
        pagamentos: acumulado.pagamentos + Number(item.pagamentos_confirmados || 0),
        faturamento: acumulado.faturamento + Number(item.faturamento || 0),
      }), { agendamentos: 0, concluidos: 0, cancelados: 0, pagamentos: 0, faturamento: 0 })

      const planilha = workbook.addWorksheet('Relatório', {
        views: [{ state: 'frozen', ySplit: 5 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
        properties: { defaultRowHeight: 21 },
      })
      planilha.pageMargins = { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
      planilha.headerFooter.oddFooter = '&L O Rei da Navalha&C Relatório financeiro&R Página &P de &N'
      planilha.columns = [
        { key: 'mes', width: 22 },
        { key: 'agendamentos', width: 18 },
        { key: 'concluidos', width: 16 },
        { key: 'cancelados', width: 16 },
        { key: 'pagamentos', width: 23 },
        { key: 'faturamento', width: 21 },
      ]

      planilha.mergeCells('A1:F1')
      planilha.getCell('A1').value = 'O REI DA NAVALHA — RELATÓRIO FINANCEIRO'
      planilha.getCell('A1').font = { name: 'Georgia', size: 20, bold: true, color: { argb: 'FFF4C84A' } }
      planilha.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B0B0B' } }
      planilha.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' }
      planilha.getRow(1).height = 38

      planilha.mergeCells('A2:F2')
      planilha.getCell('A2').value = `Período: ${periodo}`
      planilha.getCell('A2').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF2A2A2A' } }
      planilha.getCell('A2').alignment = { horizontal: 'center' }
      planilha.getRow(2).height = 25

      planilha.mergeCells('A3:F3')
      planilha.getCell('A3').value = `Gerado em ${new Date().toLocaleString('pt-BR')}`
      planilha.getCell('A3').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } }
      planilha.getCell('A3').alignment = { horizontal: 'center' }

      const cabecalho = planilha.getRow(5)
      cabecalho.values = ['Mês', 'Agendamentos', 'Concluídos', 'Cancelados', 'Pagamentos confirmados', 'Faturamento']
      cabecalho.height = 28
      cabecalho.eachCell((celula) => {
        celula.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF17120A' } }
        celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4C84A' } }
        celula.alignment = { vertical: 'middle', horizontal: 'center' }
        celula.border = { bottom: { style: 'medium', color: { argb: 'FF9A751A' } } }
      })

      meses.forEach((item, indice) => {
        const linha = planilha.addRow({
          mes: MESES[item.mes - 1],
          agendamentos: Number(item.total_agendamentos || 0),
          concluidos: Number(item.concluidos || 0),
          cancelados: Number(item.cancelados || 0),
          pagamentos: Number(item.pagamentos_confirmados || 0),
          faturamento: Number(item.faturamento || 0),
        })
        linha.height = 24
        linha.eachCell((celula, coluna) => {
          celula.font = { name: 'Arial', size: 10, color: { argb: 'FF282828' }, bold: coluna === 1 }
          celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: indice % 2 === 0 ? 'FFF8F8F8' : 'FFFFFFFF' } }
          celula.alignment = { vertical: 'middle', horizontal: coluna === 1 ? 'left' : 'center' }
          celula.border = { bottom: { style: 'thin', color: { argb: 'FFE1E1E1' } } }
        })
        linha.getCell(6).numFmt = 'R$ #,##0.00'
      })

      const linhaTotal = planilha.addRow({
        mes: 'TOTAL',
        agendamentos: totaisExportados.agendamentos,
        concluidos: totaisExportados.concluidos,
        cancelados: totaisExportados.cancelados,
        pagamentos: totaisExportados.pagamentos,
        faturamento: totaisExportados.faturamento,
      })
      linhaTotal.height = 30
      linhaTotal.eachCell((celula, coluna) => {
        celula.font = { name: 'Arial', size: 11, bold: true, color: { argb: coluna === 6 ? 'FFF4C84A' : 'FFFFFFFF' } }
        celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF151515' } }
        celula.alignment = { vertical: 'middle', horizontal: coluna === 1 ? 'left' : 'center' }
      })
      linhaTotal.getCell(6).numFmt = 'R$ #,##0.00'
      planilha.autoFilter = { from: 'A5', to: `F${5 + meses.length}` }

      const buffer = await workbook.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a')
      const mesArquivo = mesExportacao ? `-${MESES[Number(mesExportacao) - 1].toLowerCase()}` : ''
      link.href = url
      link.download = `relatorio${mesArquivo}-${relatorio.ano}-rei-da-navalha.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setErro('Não foi possível gerar a planilha Excel. Tente novamente em alguns instantes.')
    } finally {
      setExportando(false)
    }
  }

  const maximo = Math.max(...(relatorio?.meses || []).map((item) => Number(item.faturamento)), 1)
  const totais = relatorio?.totais || {}
  const pagamentosConfirmados = Number(totais.pagamentos_confirmados || 0)
  const ticketMedio = pagamentosConfirmados > 0 ? Number(totais.faturamento || 0) / pagamentosConfirmados : 0
  const mesDestaque = relatorio?.meses?.reduce((melhor, item) => (
    Number(item.faturamento) > Number(melhor?.faturamento || 0) ? item : melhor
  ), null)
  const cards = [
    { icone: 'calendar', valor: totais.total_agendamentos || 0, rotulo: 'Agendamentos', cor: 'text-primary', fundo: 'bg-primary/10', borda: 'border-primary/20' },
    { icone: 'check', valor: totais.concluidos || 0, rotulo: 'Concluídos', cor: 'text-emerald-300', fundo: 'bg-emerald-500/10', borda: 'border-emerald-400/20' },
    { icone: 'alert', valor: totais.cancelados || 0, rotulo: 'Cancelados', cor: 'text-red-300', fundo: 'bg-red-500/10', borda: 'border-red-400/20' },
    { icone: 'chart', valor: moeda(totais.faturamento), rotulo: 'Faturamento confirmado', cor: 'text-primary', fundo: 'bg-primary/10', borda: 'border-primary/20' },
  ]

  return (
    <AdminLayout titulo="Relatórios" subtitulo="Indicadores e faturamento">
      <main className="max-w-[1480px] mx-auto px-4 sm:px-6 py-7 sm:py-9 space-y-7">
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5"><div><p className="text-xs uppercase tracking-[0.2em] text-primary font-bold">Financeiro</p><h1 className="font-headline text-3xl sm:text-4xl mt-2">Relatório mensal</h1><p className="text-sm text-on-surface-variant mt-2">Analise atendimentos, pagamentos e faturamento confirmado ao longo do ano.</p></div><form onSubmit={consultar} className="glass-panel rounded-2xl border border-white/10 p-2 flex items-center gap-2 w-full sm:w-auto"><button type="button" onClick={() => setAno((valor) => Math.max(2000, Number(valor) - 1))} className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center hover:border-primary/35 hover:text-primary" aria-label="Ano anterior"><BrandIcon name="back" size={18} /></button><label className="sr-only" htmlFor="ano-relatorio">Ano do relatório</label><input id="ano-relatorio" type="number" min="2000" max="2100" value={ano} onChange={(e) => setAno(e.target.value)} className="min-w-0 w-full sm:w-24 bg-transparent px-2 py-2 text-center text-sm font-bold focus-visible:outline-none" /><button type="button" onClick={() => setAno((valor) => Math.min(2100, Number(valor) + 1))} className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center hover:border-primary/35 hover:text-primary" aria-label="Próximo ano"><BrandIcon name="next" size={18} /></button><button type="submit" disabled={carregando} className="px-5 py-3 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:bg-primary-container disabled:opacity-50">Consultar</button></form></section>

        {erro && <div ref={erroRef} role="alert" className="rounded-2xl border border-error/25 bg-error/10 px-4 py-4 text-sm text-error flex flex-col sm:flex-row sm:items-center justify-between gap-3"><span>{erro}</span><button type="button" onClick={() => carregar(ano)} className="self-start sm:self-auto rounded-full border border-error/35 px-4 py-2 text-xs font-bold uppercase tracking-wider">Tentar novamente</button></div>}

        <section aria-label="Totais anuais" className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">{cards.map((card) => <article key={card.rotulo} className="brand-card glass-panel border border-white/10 p-4 sm:p-5 min-w-0"><div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${card.fundo} ${card.borda} ${card.cor}`}><BrandIcon name={card.icone} size={22} /></div><p className={`font-headline text-xl sm:text-2xl mt-3 break-words ${card.cor}`}>{carregando ? '—' : card.valor}</p><p className="text-xs sm:text-xs uppercase sm:normal-case tracking-wider sm:tracking-normal text-on-surface-variant mt-1">{card.rotulo}</p></article>)}</section>

        {!carregando && relatorio && <section aria-label="Destaques do relatório" className="grid sm:grid-cols-3 gap-3"><article className="glass-panel rounded-2xl border border-white/10 p-4"><p className="text-xs uppercase tracking-wider text-on-surface-variant">Pagamentos confirmados</p><p className="font-headline text-xl text-emerald-300 mt-2">{pagamentosConfirmados}</p></article><article className="glass-panel rounded-2xl border border-white/10 p-4"><p className="text-xs uppercase tracking-wider text-on-surface-variant">Ticket médio</p><p className="font-headline text-xl text-primary mt-2">{moeda(ticketMedio)}</p></article><article className="glass-panel rounded-2xl border border-white/10 p-4"><p className="text-xs uppercase tracking-wider text-on-surface-variant">Mês de maior faturamento</p><p className="font-headline text-xl mt-2">{mesDestaque && Number(mesDestaque.faturamento) > 0 ? MESES[mesDestaque.mes - 1] : 'Sem movimentação'}</p></article></section>}

        <section className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5" aria-labelledby="grafico-faturamento"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-primary font-bold">Visão anual</p><h2 id="grafico-faturamento" className="font-headline text-2xl mt-2">Evolução do faturamento</h2><p className="text-xs text-on-surface-variant mt-1">Valores confirmados em cada mês de {relatorio?.ano || ano}.</p></div>{carregando ? <div className="h-44 rounded-xl bg-white/[0.04] animate-pulse" /> : <div className="grid grid-cols-6 xl:grid-cols-12 gap-2 sm:gap-3 items-end" style={{ minHeight: '190px' }}>{relatorio?.meses.map((item) => { const percentual = (Number(item.faturamento) / maximo) * 100; return <div key={item.mes} className="h-44 flex flex-col justify-end items-center gap-2 group"><span className="text-xs text-primary opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity whitespace-nowrap">{moeda(item.faturamento)}</span><div className="w-full max-w-10 min-h-1 rounded-t-lg bg-primary/80 group-hover:bg-primary transition-colors" style={{ height: `${Math.max(percentual, 3)}%` }} title={`${MESES[item.mes - 1]}: ${moeda(item.faturamento)}`} /><span className="text-xs uppercase text-on-surface-variant">{MESES[item.mes - 1].slice(0, 3)}</span></div> })}</div>}</section>

        <section className="glass-panel rounded-2xl border border-white/10 overflow-hidden" aria-labelledby="resultado-relatorio"><div className="p-4 sm:p-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.2em] text-primary font-bold">Detalhamento</p><h2 id="resultado-relatorio" className="font-headline text-2xl mt-2">Resultado de {relatorio?.ano || ano}</h2></div><div className="flex flex-col sm:flex-row gap-2"><label className="sr-only" htmlFor="mes-exportacao">Período da planilha</label><select id="mes-exportacao" value={mesExportacao} onChange={(event) => setMesExportacao(event.target.value)} disabled={!relatorio || carregando || exportando} className="min-h-11 rounded-xl border border-white/10 bg-surface px-4 text-sm text-on-surface disabled:opacity-40"><option value="">Ano completo</option>{MESES.map((mes, indice) => <option key={mes} value={indice + 1}>{mes}</option>)}</select><button type="button" onClick={exportarXlsx} disabled={!relatorio || carregando || exportando} className="inline-flex justify-center items-center gap-2 min-h-11 px-5 rounded-full border border-primary/35 text-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/10 disabled:opacity-40"><BrandIcon name="chart" size={17} />{exportando ? 'Gerando Excel...' : 'Exportar Excel'}</button></div></div>{carregando ? <><p className="sr-only" role="status">Gerando relatório...</p><SkeletonRelatorio /></> : <><div className="hidden md:block overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-on-surface-variant"><tr><th className="px-5 py-4">Mês</th><th className="px-5 py-4">Agendamentos</th><th className="px-5 py-4">Concluídos</th><th className="px-5 py-4">Cancelados</th><th className="px-5 py-4">Pagamentos</th><th className="px-5 py-4 text-right">Faturamento</th></tr></thead><tbody className="divide-y divide-white/10">{relatorio?.meses.map((item) => <tr key={item.mes} className="hover:bg-white/[0.025]"><td className="px-5 py-4 font-bold"><div>{MESES[item.mes - 1]}</div><div className="h-1.5 bg-white/5 rounded-full mt-2 w-28"><div className="h-full bg-primary rounded-full" style={{ width: `${(Number(item.faturamento) / maximo) * 100}%` }} /></div></td><td className="px-5 py-4">{item.total_agendamentos}</td><td className="px-5 py-4 text-emerald-300">{item.concluidos}</td><td className="px-5 py-4 text-red-300">{item.cancelados}</td><td className="px-5 py-4">{item.pagamentos_confirmados}</td><td className="px-5 py-4 text-right text-primary font-bold">{moeda(item.faturamento)}</td></tr>)}</tbody></table></div><div className="md:hidden divide-y divide-white/10">{relatorio?.meses.map((item) => <article key={item.mes} className="p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-headline text-lg">{MESES[item.mes - 1]}</h3><strong className="text-primary">{moeda(item.faturamento)}</strong></div><div className="h-1.5 bg-white/5 rounded-full mt-3"><div className="h-full bg-primary rounded-full" style={{ width: `${(Number(item.faturamento) / maximo) * 100}%` }} /></div><dl className="grid grid-cols-2 gap-3 mt-4 text-xs"><div><dt className="text-on-surface-variant">Agendamentos</dt><dd className="font-bold mt-1">{item.total_agendamentos}</dd></div><div><dt className="text-on-surface-variant">Pagamentos</dt><dd className="font-bold mt-1">{item.pagamentos_confirmados}</dd></div><div><dt className="text-on-surface-variant">Concluídos</dt><dd className="font-bold text-emerald-300 mt-1">{item.concluidos}</dd></div><div><dt className="text-on-surface-variant">Cancelados</dt><dd className="font-bold text-red-300 mt-1">{item.cancelados}</dd></div></dl></article>)}</div></>}</section>
      </main>
    </AdminLayout>
  )
}

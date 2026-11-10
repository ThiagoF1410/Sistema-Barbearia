import { useEffect, useState } from 'react'
import api from '../services/api'

export default function PreferenciaLembretes() {
  const [habilitado, setHabilitado] = useState(false)
  const [ocupado, setOcupado] = useState(true)
  const [erro, setErro] = useState('')
  useEffect(() => {
    let ativo = true
    api.get('/auth/me/lembretes').then(({data}) => { if (ativo) setHabilitado(data.habilitado) })
      .catch(() => { if (ativo) setErro('Não foi possível carregar sua preferência. Recarregue a página.') })
      .finally(() => { if (ativo) setOcupado(false) })
    return () => { ativo = false }
  }, [])
  async function alterar(event) {
    const valor = event.target.checked
    setOcupado(true)
    setErro('')
    try { const {data} = await api.patch('/auth/me/lembretes', {habilitado:valor}); setHabilitado(data.habilitado) }
    catch { setErro('Não foi possível salvar. Tente novamente.') }
    finally { setOcupado(false) }
  }
  return <section className="rounded-2xl border border-white/10 p-5 space-y-3">
    <h2 className="font-headline text-xl">Lembretes de atendimento</h2>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={habilitado} disabled={ocupado} onChange={alterar} />Quero receber lembretes pelo WhatsApp</label>
    <p className="text-sm text-on-surface-variant">Enviaremos um lembrete 24 horas antes ou, para reservas com menor antecedência, 12 horas antes. Você pode desativar esta opção quando quiser.</p>
    {erro && <p role="alert" className="text-sm text-error">{erro}</p>}
  </section>
}

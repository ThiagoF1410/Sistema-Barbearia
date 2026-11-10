import BrandIcon from './BrandIcon'
import {
  analisarSenha, PASSWORD_BASIC_REQUIREMENTS, PASSWORD_GROUP_REQUIREMENTS,
} from '../../utils/passwordStrength'

const NIVEIS = {
  empty: { label: 'Aguardando senha', message: 'Atenda aos requisitos básicos e use pelo menos 3 dos 4 grupos.', active: 0, color: 'bg-white/10', text: 'text-on-surface-variant' },
  weak: { label: 'Senha fraca', message: 'Corrija os requisitos obrigatórios indicados abaixo.', active: 1, color: 'bg-red-400', text: 'text-red-300' },
  medium: { label: 'Senha média', message: 'Boa base. Use pelo menos mais um grupo de caracteres.', active: 2, color: 'bg-amber-400', text: 'text-amber-300' },
  strong: { label: 'Senha forte', message: 'A senha atende à política de segurança do sistema.', active: 3, color: 'bg-emerald-400', text: 'text-emerald-300' },
}

function RequirementList({ items, requisitos }) {
  return <ul className="mt-3 grid gap-2 sm:grid-cols-2">{items.map((item) => {
    const atendido = requisitos[item.id]
    return <li key={item.id} className={`flex items-center gap-2 text-[11px] ${atendido ? 'text-emerald-300' : 'text-on-surface-variant'}`}><BrandIcon name={atendido ? 'check' : 'emptyCircle'} size={15} className="shrink-0" />{item.label}</li>
  })}</ul>
}

export default function PasswordStrengthMeter({ password, id = 'password-strength' }) {
  const analise = analisarSenha(password)
  const nivel = NIVEIS[analise.nivel]

  return (
    <section id={id} aria-label="Requisitos da senha" className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Segurança da senha</span>
        <strong className={`text-xs ${nivel.text}`} aria-live="polite">{nivel.label}</strong>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((segmento) => <span key={segmento} className={`h-1.5 rounded-full transition-colors duration-200 ${segmento <= nivel.active ? nivel.color : 'bg-white/10'}`} />)}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">{nivel.message}</p>
      {analise.errosCaracteres.length > 0 && (
        <div role="alert" aria-live="polite" className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-red-200">
          {analise.errosCaracteres.map((erro) => <p key={erro}>{erro}</p>)}
        </div>
      )}
      <RequirementList items={PASSWORD_BASIC_REQUIREMENTS} requisitos={analise.requisitos} />
      <div className="mt-4 border-t border-white/[0.07] pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Pelo menos 3 das 4 opções <span className={analise.gruposAtendidos >= 3 ? 'text-emerald-300' : 'text-primary'}>({analise.gruposAtendidos}/4)</span></p>
        <RequirementList items={PASSWORD_GROUP_REQUIREMENTS} requisitos={analise.requisitos} />
      </div>
    </section>
  )
}

import { useState } from 'react'
import BrandIcon from './BrandIcon'

const iconNames = { person: 'profile', mail: 'mail', call: 'phone', lock: 'lock', lock_reset: 'lock' }

export default function Input({
  id,
  label,
  type = 'text',
  placeholder,
  icon,           // nome de um ícone do kit visual, ex: "mail"
  value,
  onChange,
  error,
  required,
  autoComplete,
  maxLength,
  showPasswordToggle = false,
  describedBy,
  animatedLine = false, // linha dourada animada (estilo da tela de login)
  className = '',
}) {
  const errorId = `${id}-error`
  const [passwordVisible, setPasswordVisible] = useState(false)
  const inputType = showPasswordToggle && type === 'password' && passwordVisible ? 'text' : type
  const ariaDescribedBy = [describedBy, error ? errorId : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label htmlFor={id} className="label-heritage">
          {label}
        </label>
      )}

      <div className="relative group">
        {icon && (
          <BrandIcon name={iconNames[icon] || icon} size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
        )}

        <input
          id={id}
          name={id}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          aria-describedby={ariaDescribedBy}
          className={`
            w-full bg-surface-container-low border text-on-surface rounded-lg
            py-4 ${showPasswordToggle ? 'pr-12' : 'pr-4'} transition-all duration-200
            placeholder:text-outline/50
            focus:bg-surface-container-high focus:ring-1
            ${error
              ? 'border-error/50 focus:ring-error/40'
              : 'border-outline-variant/20 focus:ring-primary/40'
            }
            ${icon ? 'pl-12' : 'pl-4'}
            ${animatedLine ? 'bg-surface-container-lowest border-none' : ''}
          `}
        />

        {showPasswordToggle && type === 'password' && (
          <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-outline transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={passwordVisible}>
            <BrandIcon name={passwordVisible ? 'eyeOff' : 'eye'} size={18} />
          </button>
        )}

        {/* Linha de foco animada (estilo tela de login) */}
        {animatedLine && (
          <div className="focus-line" />
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-error flex items-center gap-1 mt-1">
          <BrandIcon name="alert" size={15} />
          {error}
        </p>
      )}
    </div>
  )
}

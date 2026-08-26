<<<<<<< HEAD:Frontend/src/components/ui/input.jsx
export default function Input({
  id,
  label,
  type = 'text',
  placeholder,
  icon,           // string do Material Symbols, ex: "mail"
  value,
  onChange,
  error,
  required,
  autoComplete,
  animatedLine = false, // linha dourada animada (estilo da tela de login)
  className = '',
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label htmlFor={id} className="label-heritage">
          {label}
        </label>
      )}

      <div className="relative group">
        {icon && (
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none select-none">
            {icon}
          </span>
        )}

        <input
          id={id}
          name={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          className={`
            w-full bg-surface-container-low border text-on-surface rounded-lg
            py-4 pr-4 transition-all duration-200
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

        {/* Linha de foco animada (estilo tela de login) */}
        {animatedLine && (
          <div className="focus-line" />
        )}
      </div>

      {error && (
        <p className="text-xs text-error flex items-center gap-1 mt-1">
          <span className="material-symbols-outlined text-sm">error</span>
          {error}
        </p>
      )}
    </div>
  )
}
=======
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
  animatedLine = false, // linha dourada animada (estilo da tela de login)
  className = '',
}) {
  const errorId = `${id}-error`

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
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`
            w-full bg-surface-container-low border text-on-surface rounded-lg
            py-4 pr-4 transition-all duration-200
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
>>>>>>> fd3eb50 (Commit Projeto):frontend/src/components/ui/input.jsx

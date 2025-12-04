import { forwardRef, useId } from 'react';
import clsx from 'clsx';
import { Search } from 'lucide-react';

export const Input = forwardRef(function Input({
  label,
  error,
  helperText,
  icon: Icon,
  className = '',
  containerClassName = '',
  id: providedId,
  'aria-describedby': ariaDescribedBy,
  ...props
}, ref) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  
  const describedBy = [
    error && errorId,
    helperText && !error && helperId,
    ariaDescribedBy
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" aria-hidden="true" />
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={clsx(
            'w-full rounded-xl bg-slate-800/50 border border-slate-700/50',
            'text-[var(--text-primary)] placeholder-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50',
            'transition-all duration-200',
            Icon ? 'pl-10 pr-4 py-3' : 'px-4 py-3',
            error && 'border-rose-500/50 focus:ring-rose-500/50 focus:border-rose-500/50',
            className
          )}
          {...props}
        />
      </div>
      {helperText && !error && (
        <p id={helperId} className="mt-2 text-xs text-slate-500">{helperText}</p>
      )}
      {error && (
        <p id={errorId} className="mt-2 text-sm text-rose-400" role="alert">{error}</p>
      )}
    </div>
  );
});

export function SearchInput({ 
  value, 
  onChange, 
  placeholder = 'Search...', 
  className = '',
  'aria-label': ariaLabel = 'Search',
  ...props 
}) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={clsx(
          'w-full pl-12 pr-4 py-3',
          'bg-slate-800/30 backdrop-blur-sm',
          'border border-slate-700/50 rounded-xl',
          'text-[var(--text-primary)] placeholder-slate-500',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50',
          'transition-all duration-200'
        )}
        {...props}
      />
    </div>
  );
}

export function Select({ 
  label, 
  options = [], 
  error, 
  className = '',
  containerClassName = '',
  id: providedId,
  ...props 
}) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;

  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-2">
          {label}
        </label>
      )}
      <select
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={clsx(
          'w-full px-4 py-3 rounded-xl',
          'bg-slate-800/50 border border-slate-700/50',
          'text-[var(--text-primary)]',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50',
          'transition-all duration-200',
          'appearance-none cursor-pointer',
          error && 'border-rose-500/50',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="mt-2 text-sm text-rose-400" role="alert">{error}</p>
      )}
    </div>
  );
}

export function Toggle({ 
  checked, 
  onChange, 
  label,
  description,
  disabled = false,
  className = '',
  id: providedId,
}) {
  const generatedId = useId();
  const id = providedId || generatedId;

  const handleClick = () => {
    if (disabled) return;
    // Create a synthetic event-like object for backwards compatibility
    const syntheticEvent = {
      target: { checked: !checked },
    };
    onChange?.(syntheticEvent);
  };

  return (
    <div className={clsx(
      'flex items-center gap-3',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    )}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-label={label || 'Toggle switch'}
        onClick={handleClick}
        disabled={disabled}
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-slate-900',
          checked ? 'bg-indigo-500' : 'bg-slate-700',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full',
            'bg-white shadow-lg',
            'transition-transform duration-200',
            checked && 'translate-x-5'
          )}
        />
      </button>
      {(label || description) && (
        <label htmlFor={id} className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}>
          {label && <span className="text-sm font-medium text-white block">{label}</span>}
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </label>
      )}
    </div>
  );
}

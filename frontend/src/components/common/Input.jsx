import { forwardRef } from 'react';
import clsx from 'clsx';
import { Search } from 'lucide-react';

export const Input = forwardRef(function Input({
  label,
  error,
  icon: Icon,
  className = '',
  containerClassName = '',
  ...props
}, ref) {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        )}
        <input
          ref={ref}
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
      {error && (
        <p className="mt-2 text-sm text-rose-400">{error}</p>
      )}
    </div>
  );
});

export function SearchInput({ 
  value, 
  onChange, 
  placeholder = 'Search...', 
  className = '',
  ...props 
}) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
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
  ...props 
}) {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {label}
        </label>
      )}
      <select
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
        <p className="mt-2 text-sm text-rose-400">{error}</p>
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
  className = '' 
}) {
  return (
    <label className={clsx(
      'flex items-center gap-3 cursor-pointer',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    )}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className={clsx(
          'w-11 h-6 rounded-full transition-colors duration-200',
          'bg-slate-700 peer-checked:bg-indigo-500',
          'peer-focus:ring-2 peer-focus:ring-indigo-500/30'
        )} />
        <div className={clsx(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full',
          'bg-white shadow-lg',
          'transition-transform duration-200',
          'peer-checked:translate-x-5'
        )} />
      </div>
      {(label || description) && (
        <div>
          {label && <span className="text-sm font-medium text-white">{label}</span>}
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
      )}
    </label>
  );
}

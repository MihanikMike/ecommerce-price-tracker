import clsx from 'clsx';

/**
 * Skip to main content link for keyboard navigation accessibility
 * This link is visually hidden but appears when focused
 */
export default function SkipLink({ href = '#main-content', children = 'Skip to main content' }) {
  return (
    <a
      href={href}
      className={clsx(
        'sr-only focus:not-sr-only',
        'fixed top-4 left-4 z-[100]',
        'px-4 py-2 rounded-lg',
        'bg-indigo-600 text-white font-medium',
        'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900',
        'transition-transform duration-200',
        '-translate-y-16 focus:translate-y-0'
      )}
    >
      {children}
    </a>
  );
}

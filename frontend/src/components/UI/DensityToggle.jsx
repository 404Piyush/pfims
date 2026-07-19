import clsx from 'clsx';

const KEY = 'pfims.density';

function setDensity(value) {
  document.documentElement.classList.toggle('density-compact', value === 'compact');
  localStorage.setItem(KEY, value);
}

export default function DensityToggle({ compact = false }) {
  const isCompact = typeof document !== 'undefined' && document.documentElement.classList.contains('density-compact');
  return (
    <div className={clsx('inline-flex rounded-full border border-white/10 bg-white/5 p-[2px]', !compact && 'text-xs font-medium')}>
      <button
        type="button"
        aria-pressed={!isCompact}
        onClick={() => setDensity('comfortable')}
        className={clsx(
          'rounded-full px-3 py-1 transition-colors',
          !isCompact ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
        )}
      >
        Comfort
      </button>
      <button
        type="button"
        aria-pressed={isCompact}
        onClick={() => setDensity('compact')}
        className={clsx(
          'rounded-full px-3 py-1 transition-colors',
          isCompact ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
        )}
      >
        Compact
      </button>
    </div>
  );
}

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Single KPI: label, value (tabular), delta%, trend icon.
// Brutalist by default — chunky 2px ink border + offset shadow.
// Pass `variant="aurora"` for the old glass look.
export default function NumberStat({
  label,
  value,
  delta,
  prefix,
  suffix,
  trend,
  variant = 'brutal',
  className,
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      className={clsx(
        variant === 'aurora'
          ? 'rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-xl px-5 py-4'
          : 'border-2 border-brutal-ink bg-brutal-paper shadow-[6px_6px_0_0_#0a0a0a] px-5 py-4',
        className
      )}
    >
      <div
        className={clsx(
          'text-[11px] font-bold tracking-[0.14em] uppercase',
          variant === 'aurora' ? 'text-white/60' : 'text-brutal-ink/70'
        )}
      >
        {label}
      </div>
      <div
        className={clsx(
          'mt-2 flex items-baseline gap-2 font-mono tabular-nums',
          variant === 'aurora' ? 'text-white' : 'text-brutal-ink'
        )}
      >
        {prefix && <span className={variant === 'aurora' ? 'text-white/60' : 'text-brutal-ink/60'}>{prefix}</span>}
        <span className="text-3xl font-extrabold tracking-tighter">{value}</span>
        {suffix && <span className={variant === 'aurora' ? 'text-white/60' : 'text-brutal-ink/60'}>{suffix}</span>}
      </div>
      {typeof delta === 'number' && Number.isFinite(delta) && (
        <div
          className={clsx(
            'mt-1.5 inline-flex items-center gap-1 text-xs font-bold',
            variant === 'aurora'
              ? positive ? 'text-emerald-300' : 'text-rose-300'
              : positive ? 'text-emerald-700' : 'text-rose-700'
          )}
        >
          {positive ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
          {positive ? '+' : ''}
          {delta.toFixed(1)}%
          {trend && (
            <span
              className={clsx(
                'font-normal ml-1',
                variant === 'aurora' ? 'text-white/50' : 'text-brutal-ink/50'
              )}
            >
              vs {trend}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Single KPI: label, value (tabular), delta%, trend icon.
// Pass `aurora` for cyan/glow styling and `brutal` for chunky border styling.
export default function NumberStat({
  label,
  value,
  delta,
  prefix,
  suffix,
  trend,
  variant = 'aurora',
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
          : 'rounded-[3px] border-2 border-brutal-ink bg-brutal-paper shadow-brutal px-5 py-4',
        className
      )}
    >
      <div className="text-[11px] font-medium tracking-[0.12em] uppercase text-white/60 dark:text-white/60 opacity-80">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums text-white dark:text-white">
        {prefix && <span className="text-white/60">{prefix}</span>}
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        {suffix && <span className="text-white/60">{suffix}</span>}
      </div>
      {typeof delta === 'number' && (
        <div
          className={clsx(
            'mt-1 inline-flex items-center gap-1 text-xs font-medium',
            positive ? 'text-emerald-300' : 'text-rose-300'
          )}
        >
          {positive ? (
            <TrendingUp size={12} aria-hidden />
          ) : (
            <TrendingDown size={12} aria-hidden />
          )}
          {positive ? '+' : ''}
          {delta.toFixed(1)}%
          {trend && <span className="text-white/50 font-normal">vs {trend}</span>}
        </div>
      )}
    </motion.div>
  );
}

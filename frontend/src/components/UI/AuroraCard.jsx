import clsx from 'clsx';
import { motion } from 'framer-motion';

// Frosted glass card used on Aurora surfaces (Login, Dashboard, Onboarding).
// `glow` adds a coloured outer halo using the `accent` prop (indigo/cyan/pink).
export default function AuroraCard({
  as: Tag = 'div',
  accent = 'indigo',
  glow = true,
  children,
  className,
  ...rest
}) {
  const accentRgb = {
    indigo: '99,102,241',
    cyan: '6,182,212',
    pink: '236,72,153',
  }[accent] || '99,102,241';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        boxShadow: glow
          ? `0 0 0 1px rgba(255,255,255,0.18), 0 24px 80px -16px rgba(${accentRgb}, 0.35), inset 0 1px 0 rgba(255,255,255,0.25)`
          : '0 24px 60px -20px rgba(0,0,0,0.45)',
      }}
      className={clsx(
        'relative rounded-2xl border border-white/10',
        'bg-white/[0.06] backdrop-blur-2xl backdrop-saturate-150',
        'dark:bg-black/30',
        className
      )}
      {...rest}
    >
      <Tag className="relative">{children}</Tag>
    </motion.div>
  );
}

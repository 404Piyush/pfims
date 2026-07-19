import clsx from 'clsx';
import { motion } from 'framer-motion';

// Frosted glass card used on Aurora surfaces (Login, Dashboard, Onboarding).
// Always dark — aurora surfaces are dark by definition. `accent` paints a
// coloured outer halo (indigo/cyan/pink) plus an inner gradient stroke.
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
          ? `0 0 0 1px rgba(255,255,255,0.08), 0 30px 80px -16px rgba(${accentRgb}, 0.55), inset 0 1px 0 rgba(255,255,255,0.18)`
          : '0 24px 60px -20px rgba(0,0,0,0.45)',
      }}
      className={clsx(
        'relative isolate overflow-hidden rounded-2xl',
        'border border-white/10',
        'bg-black/40 backdrop-blur-2xl backdrop-saturate-150',
        className
      )}
      {...rest}
    >
      {/* Accent halo behind the card content (pink-cyan-indigo gradient blob). */}
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1/3 -z-10 opacity-60"
          style={{
            background:
              accent === 'cyan'
                ? 'radial-gradient(60% 60% at 20% 20%, rgba(6,182,212,0.45), transparent 65%), radial-gradient(50% 50% at 90% 80%, rgba(236,72,153,0.35), transparent 70%)'
                : accent === 'pink'
                ? 'radial-gradient(60% 60% at 80% 20%, rgba(236,72,153,0.5), transparent 65%), radial-gradient(50% 50% at 10% 90%, rgba(99,102,241,0.4), transparent 70%)'
                : 'radial-gradient(60% 60% at 25% 25%, rgba(99,102,241,0.5), transparent 65%), radial-gradient(50% 50% at 85% 75%, rgba(6,182,212,0.4), transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      )}
      <Tag className="relative">{children}</Tag>
    </motion.div>
  );
}

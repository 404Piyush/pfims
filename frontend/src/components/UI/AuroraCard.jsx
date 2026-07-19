import clsx from 'clsx';
import { motion } from 'framer-motion';

// Aurora-themed card. Not frosted glass — the look is a darker "ink" panel
// wrapped in a coloured aurora glow that breathes. `accent` paints the
// primary hue of the halo and the gradient border.
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

  // Halo palette per accent — every halo uses the FULL brand spectrum so the
  // card reads "aurora" at a glance.
  const halo = {
    indigo:
      'radial-gradient(60% 55% at 18% 22%, rgba(99,102,241,0.85), transparent 60%), ' +
      'radial-gradient(55% 50% at 88% 80%, rgba(236,72,153,0.70), transparent 65%), ' +
      'radial-gradient(40% 35% at 50% 50%, rgba(6,182,212,0.55), transparent 70%)',
    cyan:
      'radial-gradient(60% 55% at 18% 22%, rgba(6,182,212,0.85), transparent 60%), ' +
      'radial-gradient(55% 50% at 88% 80%, rgba(99,102,241,0.65), transparent 65%), ' +
      'radial-gradient(40% 35% at 50% 50%, rgba(236,72,153,0.50), transparent 70%)',
    pink:
      'radial-gradient(60% 55% at 18% 22%, rgba(236,72,153,0.85), transparent 60%), ' +
      'radial-gradient(55% 50% at 88% 80%, rgba(6,182,212,0.70), transparent 65%), ' +
      'radial-gradient(40% 35% at 50% 50%, rgba(99,102,241,0.55), transparent 70%)',
  }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      className={clsx(
        'relative isolate rounded-2xl',
        'bg-ink-950/80', // darker panel, less "glass", more "ink"
        className
      )}
      {...rest}
    >
      {/* Soft halo behind the card (animated). */}
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1/3 -z-10 animate-aurora-drift"
          style={{
            background: halo,
            filter: 'blur(64px)',
            opacity: 0.85,
          }}
        />
      )}

      {/* Animated aurora gradient border (the aurora "frame"). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl p-px"
        style={{
          background:
            'linear-gradient(120deg, rgba(99,102,241,0.85), rgba(6,182,212,0.85), rgba(236,72,153,0.85), rgba(99,102,241,0.85))',
          backgroundSize: '300% 300%',
          animation: 'aurora-pan 8s linear infinite',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Top aurora sweep inside the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(${accentRgb},0.85), transparent)`,
        }}
      />

      <Tag className="relative">{children}</Tag>
    </motion.div>
  );
}
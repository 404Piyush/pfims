import clsx from 'clsx';
import { motion } from 'framer-motion';

// Aurora-themed card. Painterly, not HUD-like — the card itself is a
// near-opaque ink panel; the "aurora" reads as soft, out-of-focus color
// clouds drifting behind and partially through the edges. No neon rings.
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

  // Two loose blobs per accent — different positions + sizes per accent so
  // the card feels like it's drifting through colored fog, not framed.
  const haloA = {
    indigo:
      'radial-gradient(48% 42% at 22% 32%, rgba(99,102,241,0.55), transparent 70%)',
    cyan:
      'radial-gradient(48% 42% at 22% 32%, rgba(6,182,212,0.55), transparent 70%)',
    pink:
      'radial-gradient(48% 42% at 22% 32%, rgba(236,72,153,0.55), transparent 70%)',
  }[accent];

  const haloB = {
    indigo:
      'radial-gradient(54% 48% at 78% 72%, rgba(236,72,153,0.40), transparent 70%)',
    cyan:
      'radial-gradient(54% 48% at 78% 72%, rgba(99,102,241,0.40), transparent 70%)',
    pink:
      'radial-gradient(54% 48% at 78% 72%, rgba(6,182,212,0.40), transparent 70%)',
  }[accent];

  const haloC = {
    indigo:
      'radial-gradient(36% 30% at 60% 20%, rgba(6,182,212,0.30), transparent 75%)',
    cyan:
      'radial-gradient(36% 30% at 60% 20%, rgba(236,72,153,0.30), transparent 75%)',
    pink:
      'radial-gradient(36% 30% at 60% 20%, rgba(99,102,241,0.30), transparent 75%)',
  }[accent];

  // Soft inner bleed — the colored fog "creeps" inside the panel edges,
  // dissolving the border so the card feels merged with the background.
  const innerBleed =
    'radial-gradient(120% 80% at 50% 0%, ' +
    `rgba(${accentRgb}, 0.18) 0%, transparent 55%)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      className={clsx(
        'relative isolate rounded-2xl',
        'bg-ink-950/70', // panel; soft transparency so aurora bleeds through
        // Edge-mask: fade the corners into transparency so the card has no
        // crisp rectangular boundary.
        '[-webkit-mask-image:radial-gradient(120%_120%_at_50%_50%,_black_72%,_transparent_100%)]',
        '[mask-image:radial-gradient(120%_120%_at_50%_50%,_black_72%,_transparent_100%)]',
        className
      )}
      {...rest}
    >
      {/* Outer cloud — soft, out-of-focus, drifts. */}
      {glow && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[40%] -z-20 animate-aurora-drift-a"
            style={{ background: haloA, filter: 'blur(72px)', opacity: 0.85 }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[35%] -z-20 animate-aurora-drift-b"
            style={{ background: haloB, filter: 'blur(80px)', opacity: 0.75 }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[25%] -z-20 animate-aurora-drift-c"
            style={{ background: haloC, filter: 'blur(64px)', opacity: 0.6 }}
          />
        </>
      )}

      {/* Inner bleed — color creeps inside, dissolves the edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl"
        style={{ background: innerBleed }}
      />

      {/* Hairline highlight only on the top edge, very low opacity, so the
          card has a sense of "lit from above" without being a neon ring. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(${accentRgb},0.35), transparent)`,
        }}
      />

      <Tag className="relative">{children}</Tag>
    </motion.div>
  );
}
import { useEffect } from 'react';
import AuroraCanvas from '../effects/AuroraCanvas';

// Wraps a route in the dark aurora shell:
//  - <body class="aurora"> for the ink/black gradient
//  - Full-viewport OGL canvas behind the content
//  - Subtle vignette overlay for legibility
export default function AuroraScreen({ children, colors, intensity = 1.15 }) {
  useEffect(() => {
    document.body.classList.add('aurora');
    document.body.classList.remove('brutal');
    return () => {
      document.body.classList.remove('aurora');
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full text-white">
      <AuroraCanvas {...(colors ? { colors } : {})} intensity={intensity} />
      {/* Bottom vignette to anchor the foreground card; top edge stays bright. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 70% at 50% 100%, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 50%, transparent 75%)',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
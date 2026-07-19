// Central brand tokens. Light + dark surfaces; indigo/cyan/pink aurora stops.
// Loaded into Tailwind's "theme.extend.colors" via tailwind.config.js and
// referenced from CSS variables (in src/index.css).

export const palette = {
  indigo: '#6366f1',
  indigoSoft: '#a5b4fc',
  indigoDeep: '#312e81',
  cyan: '#06b6d4',
  cyanSoft: '#67e8f9',
  cyanDeep: '#155e75',
  pink: '#ec4899',
  pinkSoft: '#f9a8d4',
  pinkDeep: '#831843',
  ink: '#0a0a14',
  paper: '#fafafa',
  snow: '#ffffff',
  glass: 'rgba(255,255,255,0.65)',
  glassDark: 'rgba(10,10,20,0.65)',
  hairline: 'rgba(15,15,25,0.08)',
  hairlineDark: 'rgba(255,255,255,0.10)',
  // Brutalist palette
  brutalPaper: '#f5f5f0',
  brutalInk: '#0a0a0a',
  brutalAccent: '#ff3b3b',
};

export const surfaces = {
  light: {
    bg: '#fafafa',
    surface: '#ffffff',
    surfaceAlt: '#f3f4f6',
    text: '#0a0a14',
    textMuted: '#4b5563',
    border: 'rgba(15,15,25,0.08)',
    shadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
  },
  dark: {
    bg: '#0a0a14',
    surface: '#11121a',
    surfaceAlt: '#1a1c28',
    text: '#f5f5f7',
    textMuted: '#9aa0aa',
    border: 'rgba(255,255,255,0.08)',
    shadow: '0 1px 2px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.4)',
  },
};

export const radius = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  xl: '24px',
  pill: '999px',
};

export const motion = {
  fast: '120ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  base: '220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  slow: '420ms cubic-bezier(0.2, 0.8, 0.2, 1)',
};

export const shadow = {
  card: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
  cardDark: '0 1px 2px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.4)',
  brutal: '8px 8px 0 0 #0a0a0a',
  glow: (rgb) => `0 0 0 1px rgba(${rgb}, 0.18), 0 18px 60px -10px rgba(${rgb}, 0.35)`,
};

export const density = {
  comfortable: { row: '52px', rowPx: 16, headerPx: 24 },
  compact: { row: '40px', rowPx: 12, headerPx: 18 },
};

export const brand = {
  name: 'PFIMS',
  tagline: 'Personal Finance in Motion',
};

export default { palette, surfaces, radius, motion, shadow, density, brand };

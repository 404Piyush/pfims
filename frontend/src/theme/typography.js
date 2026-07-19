// Typography tokens. Display = Geist (variable axis), tabular numerals = Geist Mono.
export const display = {
  family: '"Geist", "Geist Fallback", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, black: 800 },
  tight: '0.985',
  wide: '0.04em',
};

export const body = {
  family: '"Geist", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  size: { sm: '13px', base: '14px', lg: '16px' },
  lineHeight: { tight: 1.35, base: 1.55 },
};

export const mono = {
  family:
    '"Geist Mono", "JetBrains Mono", "SF Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  // Tabular figures + stylistic alternates so currency columns align.
  features: '"tnum" 1, "ss01" 1, "cv01" 1',
  weights: { regular: 400, medium: 500, semibold: 600 },
};

// <link> tag is loaded in public/index.html (Geist + Geist Mono via Google Fonts).
export const fontLinks = [
  'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap',
];

export default { display, body, mono, fontLinks };
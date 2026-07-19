// Typography tokens. Display = Inter Display, tabular numerals = JetBrains Mono.
export const display = {
  family: '"Inter Display", "Inter", "SF Pro Display", system-ui, sans-serif',
  weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
  tight: '0.99',
  wide: '0.04em',
};

export const body = {
  family: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  size: { sm: '13px', base: '14px', lg: '16px' },
  lineHeight: { tight: 1.35, base: 1.55 },
};

export const mono = {
  family:
    '"JetBrains Mono", "SF Mono", ui-monospace, SFMono-Regular, "Cascadia Code", Menlo, monospace',
  // For numbers we always want tabular figures so columns align.
  features: '"tnum" 1, "cv11" 1, "ss01" 1',
  weights: { regular: 400, medium: 500, bold: 700 },
};

// Recommended <link> tags (drop into public/index.html):
//   Inter 400/500/600/700 + Inter Display 600/700 + JetBrains Mono 400/500
export const fontLinks = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter:wght@600;700&display=swap&family=JetBrains+Mono:wght@400;500&display=swap',
];

export default { display, body, mono, fontLinks };

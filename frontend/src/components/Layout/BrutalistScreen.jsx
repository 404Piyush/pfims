import { useEffect } from 'react';

// Wraps a route in the brutalist surface (paper background, ink type).
// Used by data-dense pages (transactions, budgets, ...).
export default function BrutalistScreen({ children }) {
  useEffect(() => {
    document.body.classList.add('brutal');
    document.body.classList.remove('aurora');
    return () => {
      document.body.classList.remove('brutal');
    };
  }, []);
  return <div className="min-h-screen w-full text-brutal-ink bg-brutal-paper">{children}</div>;
}

import { Pause, Play } from 'lucide-react';

const KEY = 'pfims.motion';

export default function MotionToggle() {
  const reduced = localStorage.getItem(KEY) === 'reduced';
  const flip = () => {
    const next = !reduced;
    localStorage.setItem(KEY, next ? 'reduced' : 'normal');
    document.documentElement.classList.toggle('reduce-motion', next);
    // Force re-render via storage event from a different window; fall back to reload.
    window.location.reload();
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={reduced ? 'Enable motion' : 'Reduce motion'}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/10 transition-colors"
    >
      {reduced ? <Play size={14} /> : <Pause size={14} />}
      <span>{reduced ? 'Motion on' : 'Motion off'}</span>
    </button>
  );
}

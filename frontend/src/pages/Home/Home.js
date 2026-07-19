import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  Wallet,
  Bot,
  ShieldCheck,
  LineChart,
  Layers,
  Receipt,
  Lock,
} from 'lucide-react';
import AuroraScreen from '../../components/layout/AuroraScreen';
import AuroraCard from '../../components/ui/AuroraCard';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

const features = [
  {
    icon: Receipt,
    accent: 'indigo',
    title: 'One ledger for everything',
    body: 'Bank statements, UPI, credit cards, mutual funds — imported, parsed and tagged in seconds.',
  },
  {
    icon: LineChart,
    accent: 'cyan',
    title: 'Stock signals without the noise',
    body: 'RSI, MACD, SMA and volume flags distilled into one daily summary. Track 200+ tickers out of the box.',
  },
  {
    icon: Bot,
    accent: 'pink',
    title: 'An AI that knows your money',
    body: 'Ask in plain English. "What did I spend on dining in May?" The assistant pulls the real numbers.',
  },
  {
    icon: Wallet,
    accent: 'indigo',
    title: 'Budgets that flex with you',
    body: 'Rollover-friendly envelopes and per-category pacing so you stop guessing where the month went.',
  },
  {
    icon: TrendingUp,
    accent: 'cyan',
    title: 'Portfolio, finally readable',
    body: 'Holdings across brokers in one view. Allocation drift, realised gains and dividend calendar.',
  },
  {
    icon: Layers,
    accent: 'pink',
    title: 'Reports that mail themselves',
    body: 'Weekly and monthly summaries delivered on schedule — no spreadsheet, no login, no friction.',
  },
];

const stats = [
  { k: 'Encrypted at rest', v: 'AES-256', accent: 'from-emerald-300/80 to-cyan-300/80' },
  { k: 'MFA on by default', v: 'TOTP', accent: 'from-cyan-300/80 to-indigo-300/80' },
  { k: 'AI provider', v: 'You choose', accent: 'from-indigo-300/80 to-pink-300/80' },
];

export default function Home() {
  // If the user is already authenticated, the dashboard is the real "home".
  const { isAuthenticated } = useSelector((state) => state.auth);
  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <AuroraScreen>
      <div className="aurora-shell relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-20 pt-10 sm:px-8 lg:px-12">
        {/* Top nav */}
        <header className="flex items-center justify-between">
          <Link to="/home" className="group flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-[0_18px_60px_-12px_rgba(99,102,241,0.6)]"
              style={{
                background:
                  'conic-gradient(from 220deg at 50% 50%, #6366f1 0%, #06b6d4 35%, #ec4899 70%, #6366f1 100%)',
              }}
            >
              <Sparkles size={16} strokeWidth={2.4} />
            </div>
            <span className="text-base font-semibold tracking-tight text-white">
              PFIMS
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#trust" className="hover:text-white transition-colors">Security</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden text-sm font-medium text-white/80 hover:text-white sm:inline-block transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="btn-primary inline-flex items-center gap-1.5 !py-2 !px-4 text-sm"
            >
              Get started
              <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="mt-20 sm:mt-28">
          <div className="flex flex-col items-center text-center">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              v2 — Aurora redesign is live
            </span>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              <span className="block text-white">Your finances,</span>
              <span
                className="block bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(120deg, #ffffff 0%, #a5b4fc 30%, #67e8f9 55%, #f9a8d4 80%, #ffffff 100%)',
                }}
              >
                illuminated.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              PFIMS turns a pile of bank statements, broker logins and forgotten
              UPI transactions into a single calm dashboard — with an AI that
              answers your money questions like a friend, not a form.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
              <Link
                to="/register"
                className="btn-primary inline-flex items-center gap-2"
              >
                Start free
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                className="btn-ghost inline-flex items-center gap-2"
              >
                <Lock size={14} className="text-white/60" />
                I already have an account
              </Link>
            </div>
            <p className="mt-3 text-xs text-white/45">
              No credit card. Email-verified. Export any time.
            </p>
          </div>
        </section>

        {/* "Dashboard preview" mock — a single floating AuroraCard. */}
        <section className="relative mt-20">
          <AuroraCard accent="indigo" className="mx-auto max-w-4xl p-6 sm:p-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: 'Net cash flow', value: '+₹48,210', delta: '+12.4%', tone: 'emerald' },
                { label: 'Savings rate', value: '32.8%', delta: '+3.1pp', tone: 'cyan' },
                { label: 'Invested', value: '₹6,40,500', delta: '+1.8%', tone: 'pink' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <p className="text-xs uppercase tracking-wider text-white/50">
                    {s.label}
                  </p>
                  <p className="num mt-2 text-2xl font-semibold text-white">
                    {s.value}
                  </p>
                  <p
                    className={`mt-1 text-xs font-medium ${
                      s.tone === 'emerald'
                        ? 'text-emerald-300'
                        : s.tone === 'cyan'
                        ? 'text-cyan-300'
                        : 'text-pink-300'
                    }`}
                  >
                    {s.delta} vs last month
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-7 items-end gap-2 sm:gap-3">
              {[42, 56, 38, 70, 84, 60, 92].map((h, i) => (
                <div
                  key={i}
                  className="rounded-md"
                  style={{
                    height: `${h}px`,
                    background:
                      'linear-gradient(180deg, rgba(99,102,241,0.85) 0%, rgba(6,182,212,0.55) 50%, rgba(236,72,153,0.35) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </div>
            <p className="num mt-4 text-center text-xs text-white/40 tracking-wider">
              LAST 7 DAYS · CASH FLOW
            </p>
          </AuroraCard>
        </section>

        {/* Features */}
        <section id="features" className="mt-32">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built for the way money actually moves.
            </h2>
            <p className="mt-3 text-white/65">
              Six things that used to live in five different apps — now they
              live in one quiet tab.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <AuroraCard
                  key={f.title}
                  accent={f.accent}
                  className="p-6 transition-transform hover:-translate-y-0.5"
                >
                  <div
                    className="mb-4 grid h-10 w-10 place-items-center rounded-lg text-white"
                    style={{
                      background:
                        f.accent === 'indigo'
                          ? 'linear-gradient(135deg, rgba(99,102,241,0.85), rgba(6,182,212,0.55))'
                          : f.accent === 'cyan'
                          ? 'linear-gradient(135deg, rgba(6,182,212,0.85), rgba(99,102,241,0.55))'
                          : 'linear-gradient(135deg, rgba(236,72,153,0.85), rgba(99,102,241,0.55))',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
                    }}
                  >
                    <Icon size={18} strokeWidth={2.2} />
                  </div>
                  <h3 className="text-base font-semibold text-white">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/65">{f.body}</p>
                </AuroraCard>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mt-32">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              From statement to insight in 3 steps.
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { n: '01', t: 'Drop your statement', d: 'Upload a PDF or XLSX — even password-protected ones. We auto-detect the bank.' },
              { n: '02', t: 'AI does the tagging', d: 'Categories, merchants, recurring bills — populated in seconds, fully editable.' },
              { n: '03', t: 'Get your answers', d: 'Ask the assistant. Or read the weekly digest it emails you every Monday.' },
            ].map((s) => (
              <AuroraCard key={s.n} accent="indigo" className="p-6">
                <p
                  className="num text-3xl font-bold tracking-tighter"
                  style={{
                    backgroundImage:
                      'linear-gradient(120deg, #a5b4fc 0%, #67e8f9 50%, #f9a8d4 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {s.n}
                </p>
                <h3 className="mt-3 text-base font-semibold text-white">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">{s.d}</p>
              </AuroraCard>
            ))}
          </div>
        </section>

        {/* Trust strip */}
        <section id="trust" className="mt-32">
          <AuroraCard accent="cyan" className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-md">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/80">
                  <ShieldCheck size={14} className="text-cyan-300" />
                  Privacy by design
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Your data stays yours.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  No ad partners. No data resale. Browser-side parsing where
                  it makes sense. Encryption at rest, MFA on by default.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:gap-5">
                {stats.map((s) => (
                  <div
                    key={s.k}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center"
                  >
                    <p
                      className={`num bg-gradient-to-r bg-clip-text text-xl font-bold tracking-tighter text-transparent ${s.accent}`}
                    >
                      {s.v}
                    </p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-white/55">
                      {s.k}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </AuroraCard>
        </section>

        {/* Final CTA */}
        <section className="mt-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to look at your money clearly?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-white/65">
            Free, fast, and the assistant is surprisingly good.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register" className="btn-primary inline-flex items-center gap-2">
              Create your account
              <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="btn-ghost inline-flex items-center gap-2">
              Sign in
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto pt-20">
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row">
            <p>© {new Date().getFullYear()} PFIMS · Personal Finance Management</p>
            <div className="flex items-center gap-5">
              <Link to="/login" className="hover:text-white transition-colors">Sign in</Link>
              <Link to="/register" className="hover:text-white transition-colors">Sign up</Link>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">Made with aurora</span>
            </div>
          </div>
        </footer>
      </div>
    </AuroraScreen>
  );
}
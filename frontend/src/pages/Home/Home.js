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
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import BrutalistScreen from '../../components/layout/BrutalistScreen';
import BrutalCard from '../../components/ui/BrutalCard';

const features = [
  { icon: Receipt, title: 'One ledger for everything', body: 'Bank statements, UPI, credit cards, mutual funds — imported, parsed and tagged in seconds.' },
  { icon: LineChart, title: 'Stock signals without the noise', body: 'RSI, MACD, SMA and volume flags distilled into one daily summary. Track 200+ tickers out of the box.' },
  { icon: Bot, title: 'An AI that knows your money', body: 'Ask in plain English. "What did I spend on dining in May?" The assistant pulls the real numbers.' },
  { icon: Wallet, title: 'Budgets that flex with you', body: 'Rollover-friendly envelopes and per-category pacing so you stop guessing where the month went.' },
  { icon: TrendingUp, title: 'Portfolio, finally readable', body: 'Holdings across brokers in one view. Allocation drift, realised gains and dividend calendar.' },
  { icon: Layers, title: 'Reports that mail themselves', body: 'Weekly and monthly summaries delivered on schedule — no spreadsheet, no login, no friction.' },
];

const stats = [
  { k: 'Encrypted at rest', v: 'AES-256' },
  { k: 'MFA on by default', v: 'TOTP' },
  { k: 'AI provider', v: 'You choose' },
];

export default function Home() {
  const { isAuthenticated } = useSelector((state) => state.auth);
  if (isAuthenticated) return <Navigate to="/" replace />;

  const brutalBtn =
    'inline-flex items-center justify-center gap-2 bg-brutal-ink text-brutal-paper border-2 border-brutal-ink px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] shadow-[6px_6px_0_0_#0a0a0a] hover:shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[3px] hover:translate-y-[3px] active:shadow-none active:translate-x-[6px] active:translate-y-[6px] transition-all';
  const brutalBtnSecondary =
    'inline-flex items-center justify-center gap-2 bg-brutal-paper text-brutal-ink border-2 border-brutal-ink px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] shadow-[6px_6px_0_0_#0a0a0a] hover:shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[3px] hover:translate-y-[3px] active:shadow-none active:translate-x-[6px] active:translate-y-[6px] transition-all';

  return (
    <BrutalistScreen>
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-20 pt-10 sm:px-8 lg:px-12">
        {/* Top nav */}
        <header className="flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center bg-brutal-ink text-brutal-paper border-2 border-brutal-ink shadow-[4px_4px_0_0_#0a0a0a]">
              <Sparkles size={16} strokeWidth={2.4} />
            </div>
            <span className="text-base font-extrabold tracking-tight text-brutal-ink">PFIMS</span>
          </Link>
          <nav className="hidden items-center gap-8 text-xs font-bold uppercase tracking-[0.14em] text-brutal-ink md:flex">
            <a href="#features" className="hover:text-brutal-accent transition-colors">Features</a>
            <a href="#how" className="hover:text-brutal-accent transition-colors">How</a>
            <a href="#trust" className="hover:text-brutal-accent transition-colors">Security</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden text-xs font-bold uppercase tracking-[0.14em] text-brutal-ink underline underline-offset-4 decoration-2 decoration-brutal-accent hover:text-brutal-ink sm:inline-block">
              Sign in
            </Link>
            <Link to="/register" className={brutalBtn + ' !py-2 !px-3 text-xs'}>
              Get started
              <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="mt-20 sm:mt-28">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <span className="mb-6 inline-flex items-center gap-2 bg-brutal-ink text-brutal-paper px-3 py-1.5">
                <span className="h-1.5 w-1.5 bg-brutal-accent" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]">v2 · Aurora redesign is live</span>
              </span>
              <h1 className="font-display text-5xl font-extrabold leading-[0.92] tracking-tight text-brutal-ink sm:text-7xl">
                Your finances,
                <br />
                <span className="inline-block bg-brutal-ink text-brutal-paper px-3 mt-2">
                  illuminated
                  <span className="text-brutal-accent">.</span>
                </span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-relaxed text-brutal-ink/80 sm:text-lg">
                PFIMS turns a pile of bank statements, broker logins and forgotten
                UPI transactions into a single calm dashboard — with an AI that
                answers your money questions like a friend, not a form.
              </p>
              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row">
                <Link to="/register" className={brutalBtn}>
                  Start free
                  <ArrowRight size={16} />
                </Link>
                <Link to="/login" className={brutalBtnSecondary}>
                  <Lock size={14} className="text-brutal-ink/60" />
                  I have an account
                </Link>
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink/50">
                No credit card · Email-verified · Export any time
              </p>
            </div>

            {/* Sidecard with stats */}
            <div className="lg:col-span-4">
              <BrutalCard className="p-6">
                <div className="flex items-center justify-between border-b-2 border-brutal-ink pb-3 mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brutal-ink/70">This month</p>
                  <span className="h-2 w-2 bg-emerald-700" />
                </div>
                {[
                  { l: 'Net cash flow', v: '+₹48,210', d: '+12.4%' },
                  { l: 'Savings rate', v: '32.8%', d: '+3.1pp' },
                  { l: 'Invested', v: '₹6,40,500', d: '+1.8%' },
                ].map((s) => (
                  <div key={s.l} className="py-3 border-b border-brutal-ink/15 last:border-b-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brutal-ink/60">{s.l}</p>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="num text-2xl font-extrabold text-brutal-ink">{s.v}</span>
                      <span className="text-[11px] font-bold text-emerald-700">{s.d}</span>
                    </div>
                  </div>
                ))}
              </BrutalCard>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mt-32">
          <div className="flex items-end justify-between border-b-4 border-brutal-ink pb-4 mb-10">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brutal-ink/60">01 / Features</p>
              <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-brutal-ink sm:text-5xl">
                Built for the way<br />money actually moves.
              </h2>
            </div>
            <p className="hidden max-w-xs text-sm text-brutal-ink/70 md:block">
              Six things that used to live in five different apps — now they
              live in one quiet tab.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <BrutalCard key={f.title} hoverable className="p-6">
                  <div className="mb-4 grid h-11 w-11 place-items-center bg-brutal-ink text-brutal-paper border-2 border-brutal-ink">
                    <Icon size={18} strokeWidth={2.2} />
                  </div>
                  <h3 className="text-base font-extrabold text-brutal-ink">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-brutal-ink/70">{f.body}</p>
                </BrutalCard>
              );
            })}
          </div>
        </section>

        {/* How */}
        <section id="how" className="mt-32">
          <div className="flex items-end justify-between border-b-4 border-brutal-ink pb-4 mb-10">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brutal-ink/60">02 / How it works</p>
              <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-brutal-ink sm:text-5xl">
                Statement → insight<br />in 3 steps.
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              { n: '01', t: 'Drop your statement', d: 'Upload a PDF or XLSX — even password-protected ones. We auto-detect the bank.' },
              { n: '02', t: 'AI does the tagging', d: 'Categories, merchants, recurring bills — populated in seconds, fully editable.' },
              { n: '03', t: 'Get your answers', d: 'Ask the assistant. Or read the weekly digest it emails you every Monday.' },
            ].map((s) => (
              <BrutalCard key={s.n} className="p-6">
                <p className="num text-5xl font-extrabold tracking-tighter text-brutal-ink">{s.n}</p>
                <h3 className="mt-3 text-base font-extrabold text-brutal-ink">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-brutal-ink/70">{s.d}</p>
              </BrutalCard>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section id="trust" className="mt-32">
          <div className="flex items-end justify-between border-b-4 border-brutal-ink pb-4 mb-10">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brutal-ink/60">03 / Security</p>
              <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-brutal-ink sm:text-5xl">
                Your data stays<br />yours.
              </h2>
            </div>
          </div>
          <BrutalCard className="p-6 sm:p-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 bg-brutal-ink text-brutal-paper px-3 py-1.5">
                  <ShieldCheck size={14} className="text-brutal-accent" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Privacy by design</span>
                </div>
                <p className="text-base leading-relaxed text-brutal-ink/80">
                  No ad partners. No data resale. Browser-side parsing where it makes sense. Encryption at rest, MFA on by default.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {stats.map((s) => (
                  <div key={s.k} className="border-2 border-brutal-ink bg-brutal-paper px-3 py-4 text-center">
                    <p className="num text-xl font-extrabold text-brutal-ink tracking-tighter">{s.v}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brutal-ink/60">{s.k}</p>
                  </div>
                ))}
              </div>
            </div>
          </BrutalCard>
        </section>

        {/* Final CTA */}
        <section className="mt-24">
          <BrutalCard className="p-10 sm:p-14 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brutal-ink/60">04 / Start</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-brutal-ink sm:text-5xl">
              Ready to look at your<br />money clearly?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-brutal-ink/70">
              Free, fast, and the assistant is surprisingly good.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register" className={brutalBtn}>
                Create your account
                <ArrowRight size={16} />
              </Link>
              <Link to="/login" className={brutalBtnSecondary}>
                Sign in
              </Link>
            </div>
          </BrutalCard>
        </section>

        <footer className="mt-auto pt-20">
          <div className="flex flex-col items-center justify-between gap-3 border-t-2 border-brutal-ink pt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-brutal-ink/60 sm:flex-row">
            <p>© {new Date().getFullYear()} PFIMS · Personal Finance Management</p>
            <div className="flex items-center gap-5">
              <Link to="/login" className="hover:text-brutal-ink underline underline-offset-2">Sign in</Link>
              <Link to="/register" className="hover:text-brutal-ink underline underline-offset-2">Sign up</Link>
              <span className="hidden sm:inline">/ Made with concrete</span>
            </div>
          </div>
        </footer>
      </div>
    </BrutalistScreen>
  );
}
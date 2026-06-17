import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { ApiError } from '../lib/api';
import { authApi } from '../services/auth';

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await authApi.login(email.trim().toLowerCase(), password);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_CREDENTIALS') setError('Email or password is incorrect.');
        else if (err.code === 'ACCOUNT_LOCKED')
          setError('Account is temporarily locked. Try again in 15 minutes.');
        else if (err.code === 'VALIDATION_FAILED') setError('Please enter a valid email and password.');
        else setError(err.message);
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Top bar */}
      <header className="relative z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to site
          </Link>
        </div>
      </header>

      <main className="relative z-10 grid min-h-[calc(100vh-88px)] lg:grid-cols-[1.05fr_1fr]">
        {/* ---------- Left column: brand ---------- */}
        <BrandColumn />

        {/* ---------- Right column: form ---------- */}
        <section className="relative flex items-center justify-center px-6 py-14 sm:px-10 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-full max-w-md"
          >
            <div className="mb-8">
              <span className="label-pill mb-4 inline-flex">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                </span>
                Welcome back
              </span>
              <h1 className="display text-4xl font-extrabold leading-[1.05] text-ink-900 sm:text-[2.6rem]">
                Sign in to your{' '}
                <span className="gradient-text-warm">restaurant.</span>
              </h1>
              <p className="mt-3 text-[15px] text-ink-600">
                One platform for POS, QR ordering, kitchen display, reservations and analytics.
              </p>
            </div>

            {/* Social */}
            <div className="grid grid-cols-2 gap-2.5">
              <SocialButton provider="google" />
              <SocialButton provider="apple" />
            </div>

            <Divider />

            <form onSubmit={onSubmit} className="space-y-4">
              <Field label="Work email" htmlFor="email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@restaurant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="vue-input pl-10"
                  />
                </div>
              </Field>

              <Field
                label="Password"
                htmlFor="password"
                trailing={
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Forgot password?
                  </button>
                }
              >
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="password"
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="vue-input pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <label className="flex select-none items-center gap-2.5 text-sm">
                <span className="relative inline-flex">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-ink-300 bg-white transition checked:border-brand-500 checked:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40"
                  />
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8l3.5 3.5L13 5" />
                  </svg>
                </span>
                <span className="text-ink-700">Keep me signed in for 30 days</span>
              </label>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary shine group flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold disabled:opacity-80"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in to dashboard
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-[12px] text-ink-500">
              Demo: <span className="font-mono font-bold">owner@vuedine.demo</span> ·{' '}
              <span className="font-mono font-bold">vuedine123</span>
            </p>

            <p className="mt-3 text-center text-[11px] text-ink-400">
              By signing in you agree to our{' '}
              <Link to="/" className="underline-offset-2 hover:text-ink-700 hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/" className="underline-offset-2 hover:text-ink-700 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </motion.div>
        </section>
      </main>
    </div>
  );
}

/* ============================================================ */

function Field({
  label,
  htmlFor,
  children,
  trailing,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-800">
          {label}
        </label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-ink-200 to-transparent" />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">or</span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-ink-200 to-transparent" />
    </div>
  );
}

function SocialButton({ provider }: { provider: 'google' | 'apple' }) {
  const isGoogle = provider === 'google';
  return (
    <button
      type="button"
      className="group inline-flex h-11 items-center justify-center gap-2.5 rounded-xl border border-ink-200 bg-white text-sm font-semibold text-ink-800 shadow-sm transition hover:-translate-y-px hover:border-ink-300 hover:bg-ink-50"
    >
      {isGoogle ? <GoogleIcon /> : <AppleIcon />}
      Continue with {isGoogle ? 'Google' : 'Apple'}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.12A6.97 6.97 0 0 1 5.5 12c0-.74.13-1.45.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-900" fill="currentColor">
      <path d="M16.4 1c0 1.2-.5 2.3-1.2 3.1-.9.9-2.3 1.7-3.5 1.6-.2-1.2.4-2.4 1.1-3.2.9-.9 2.4-1.6 3.6-1.5zM20.7 17.4c-.6 1.3-.9 1.9-1.6 3.1-1 1.6-2.4 3.5-4.1 3.5-1.6 0-2-1-4.1-1-2.1 0-2.6 1-4.1 1-1.7 0-3-1.7-4-3.3C-.7 16.7-.9 11.6 1.4 8.9c1.3-1.6 3.4-2.5 5.4-2.5 2 0 3.3 1.1 4.9 1.1 1.6 0 2.6-1.1 4.9-1.1 1.7 0 3.6.9 4.9 2.5-4.4 2.4-3.7 8.6-.8 8.5z" />
    </svg>
  );
}

/* ============================================================ */

function BrandColumn() {
  return (
    <section
      aria-hidden
      className="relative hidden overflow-hidden lg:block"
      style={{
        background:
          'radial-gradient(circle at 25% 20%, #FF5C9C, transparent 55%), radial-gradient(circle at 80% 75%, #F97316, transparent 55%), linear-gradient(135deg, #EC1B7C 0%, #A60C5C 60%, #54052F 100%)',
      }}
    >
      {/* Grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at center, #000 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, #000 30%, transparent 75%)',
        }}
      />

      {/* Floating decorative shapes */}
      <div className="pointer-events-none absolute inset-0">
        <div className="floaty absolute left-[8%] top-[14%] h-12 w-12 rotate-12 rounded-2xl bg-white/15 backdrop-blur-sm" />
        <div className="floaty-2 absolute right-[12%] top-[24%] h-16 w-16 rounded-full bg-white/15 backdrop-blur-sm" />
        <div className="floaty absolute left-[18%] bottom-[16%] h-10 w-10 rotate-45 rounded-xl bg-white/20 backdrop-blur-sm" />
        <div className="floaty-2 absolute right-[10%] bottom-[20%] h-14 w-14 rounded-full bg-white/15 backdrop-blur-sm" />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
        {/* Top: pill */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white ring-1 ring-white/30 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Restaurant OS · v2.6
          </div>
          <h2 className="mt-8 text-5xl font-extrabold leading-[1.05] tracking-tight text-white xl:text-6xl">
            One platform.{' '}
            <span className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 bg-clip-text text-transparent">
              Every surface.
            </span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-white/85">
            POS, QR ordering, kitchen display, reservations, payments and analytics — built for the rush, designed to feel calm.
          </p>
        </div>

        {/* Floating live tile */}
        <BrandLiveCard />

        {/* Bottom: testimonial + trust row */}
        <div className="space-y-7">
          <figure className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-md">
            <div className="flex items-center gap-1 text-amber-200">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M12 2l2.6 6.6L22 10l-5.5 4.6L18 22l-6-3.7L6 22l1.5-7.4L2 10l7.4-1.4L12 2z" />
                </svg>
              ))}
            </div>
            <blockquote className="mt-3 text-[15px] leading-relaxed text-white">
              "Vuedine cut our average bill time from 9 minutes to 2. QR ordering alone added 18% to weekend revenue. It just feels alive."
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-200 via-pink-200 to-rose-300" />
              <div>
                <div className="text-[13px] font-bold text-white">Aarav Mehta</div>
                <div className="text-[11px] text-white/70">Owner · Bandra Bistro · 4 outlets</div>
              </div>
            </figcaption>
          </figure>

          <div className="grid grid-cols-3 gap-3 text-white">
            <Trust label="Outlets" value="12,000+" />
            <Trust label="Uptime" value="99.99%" />
            <Trust label="Rating" value="4.9 ★" />
          </div>

          <div className="flex items-center gap-4 text-[11px] font-semibold text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              SOC 2 Type II
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              AES-256 encrypted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              GDPR ready
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Trust({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20 backdrop-blur-md">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">{label}</div>
    </div>
  );
}

function BrandLiveCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      className="self-stretch rounded-2xl bg-white/95 p-5 shadow-2xl ring-1 ring-white/30 backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">Today · live</div>
          <div className="mt-1 text-3xl font-extrabold text-ink-900">₹1,84,350</div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          LIVE
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-lg bg-ink-50 p-2.5">
          <div className="font-semibold text-ink-500">Orders</div>
          <div className="text-base font-extrabold text-ink-900">324</div>
        </div>
        <div className="rounded-lg bg-ink-50 p-2.5">
          <div className="font-semibold text-ink-500">Tables</div>
          <div className="text-base font-extrabold text-ink-900">22<span className="text-ink-400">/28</span></div>
        </div>
        <div className="rounded-lg bg-ink-50 p-2.5">
          <div className="font-semibold text-ink-500">QR</div>
          <div className="text-base font-extrabold text-ink-900">47%</div>
        </div>
      </div>
      <svg viewBox="0 0 320 80" className="mt-3 h-16 w-full">
        <defs>
          <linearGradient id="loginLine" x1="0" x2="1">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="50%" stopColor="#EC1B7C" />
            <stop offset="100%" stopColor="#A60C5C" />
          </linearGradient>
          <linearGradient id="loginFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#EC1B7C" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#EC1B7C" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,55 C40,35 60,65 100,45 C140,25 160,15 200,25 C240,35 260,8 300,5 L320,5 L320,80 L0,80 Z"
          fill="url(#loginFill)"
        />
        <path
          d="M0,55 C40,35 60,65 100,45 C140,25 160,15 200,25 C240,35 260,8 300,5 L320,5"
          fill="none"
          stroke="url(#loginLine)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}

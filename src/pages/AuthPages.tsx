import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useAppContext } from '../context/AppContext';
import { useReducedMotionSafe } from '../hooks/useReducedMotionSafe';

export type AuthMode = 'login' | 'register' | 'forgot';

interface AuthPagesProps {
  mode: AuthMode;
}

function evaluatePasswordStrength(pwd: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!pwd) return { score: 0, label: 'Enter a password', color: 'bg-white/10' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-[#E06C65]' };
  if (score === 2) return { score: 2, label: 'Fair', color: 'bg-[#D4A857]' };
  if (score === 3) return { score: 3, label: 'Good', color: 'bg-[#36C982]/80' };
  return { score: 4, label: 'Strong', color: 'bg-[#36C982]' };
}

const AuthVisualPanel: React.FC<{ accountReady: boolean }> = ({
  accountReady,
}) => {
  const reducedMotion = useReducedMotionSafe();

  const candles = [
    { x: 52, y: 170, h: 48, bull: true },
    { x: 98, y: 148, h: 64, bull: true },
    { x: 144, y: 162, h: 42, bull: false },
    { x: 190, y: 124, h: 72, bull: true },
    { x: 236, y: 108, h: 58, bull: true },
    { x: 282, y: 86, h: 76, bull: true },
    { x: 328, y: 96, h: 46, bull: false },
    { x: 374, y: 64, h: 68, bull: true },
  ];

  return (
    <div className="relative hidden lg:flex flex-col justify-between rounded-2xl border border-white/8 bg-[#141C17] p-8 overflow-hidden min-h-[540px]">
      <div
        className="absolute inset-0 pointer-events-none opacity-65"
        style={{
          background:
            'radial-gradient(circle at 80% 25%, rgba(54,201,130,0.16) 0%, rgba(20,28,23,0) 65%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-3">
        <p className="text-xs font-medium text-[#A5EBC3]">
          BULLSIGHT · See the Bull. Predict the Move.
        </p>
        <h2 className="font-display text-2xl font-bold text-[#E8F0EA] leading-snug">
          Unified equity intelligence for Indian and US markets.
        </h2>
        <p className="text-sm text-[#91A197] leading-relaxed">
          Sync your personalized India &amp; US watchlist across sessions with a
          MongoDB-backed research account, or explore immediately as a guest.
        </p>
      </div>

      {/* Subdued Animated Candlestick & Trend Pattern */}
      <div className="relative z-10 my-6 rounded-xl border border-white/8 bg-[#101512]/70 p-4">
        <div className="flex items-center justify-between text-[11px] font-mono-num text-[#91A197] mb-2">
          <span>NSE · NASDAQ Composite Trace</span>
          <span className="text-[#36C982]">
            {accountReady ? 'Account Sync Ready' : 'Guest Workspace'}
          </span>
        </div>
        <svg viewBox="0 0 420 245" className="w-full h-44" aria-hidden="true">
          {[55, 115, 175].map((y) => (
            <line
              key={y}
              x1="16"
              y1={y}
              x2="404"
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="3 4"
            />
          ))}

          {candles.map((c, idx) => (
            <motion.g
              key={c.x}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: reducedMotion ? 0 : idx * 0.04 }}
            >
              <line
                x1={c.x}
                y1={c.y - 16}
                x2={c.x}
                y2={c.y + c.h + 16}
                stroke="#91A197"
                strokeOpacity="0.4"
                strokeWidth="1.2"
              />
              <rect
                x={c.x - 8}
                y={c.y}
                width="16"
                height={c.h}
                rx="2"
                fill={c.bull ? '#36C982' : '#214B37'}
                fillOpacity={c.bull ? 0.45 : 0.7}
                stroke={c.bull ? '#A5EBC3' : '#36C982'}
                strokeOpacity="0.35"
              />
            </motion.g>
          ))}

          <motion.path
            d="M 48 188 C 120 165, 200 138, 282 104 C 325 88, 360 72, 392 56"
            fill="none"
            stroke="#A5EBC3"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: reducedMotion ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          />
        </svg>
      </div>

      <div className="relative z-10 flex items-center gap-3 pt-4 border-t border-white/8 text-xs text-[#91A197]">
        <ShieldCheck className="w-4 h-4 text-[#36C982] shrink-0" aria-hidden="true" />
        <span>
          Bcrypt-hashed passwords &amp; HttpOnly JWT session cookies via Express
        </span>
      </div>
    </div>
  );
};

export const AuthPages: React.FC<AuthPagesProps> = ({ mode }) => {
  const navigate = useNavigate();
  const {
    user,
    authLoading,
    accountService,
    loginUser,
    registerUser,
    logoutUser,
  } = useAppContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [forgotNotice, setForgotNotice] = useState(false);

  const accountReady = Boolean(accountService?.ready);
  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (mode === 'register' && name.trim().length < 2) {
      errs.name = 'Enter at least 2 characters for your display name.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      errs.email = 'Enter a valid email address.';
    }
    if (mode !== 'forgot' && password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }
    if (mode === 'register' && confirmPassword !== password) {
      errs.confirmPassword = 'Passwords do not match.';
    }
    return errs;
  }, [mode, name, email, password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setForgotNotice(false);
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (mode === 'forgot') {
      setForgotNotice(true);
      return;
    }

    if (!accountReady) {
      setServerError(
        accountService?.message ||
          'Account service is unconfigured on the server. Add MONGODB_URI and JWT_SECRET in Secrets to enable sign-in.'
      );
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await registerUser(name.trim(), email.trim(), password);
      } else {
        await loginUser(email.trim(), password);
      }
      navigate('/app/overview');
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'Unable to complete authentication request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    mode === 'login'
      ? 'Sign in to BULLSIGHT'
      : mode === 'register'
      ? 'Create a research account'
      : 'Reset account password';

  const subtitle =
    mode === 'login'
      ? 'Access your dual-market equity workspace and saved MongoDB watchlist.'
      : mode === 'register'
      ? 'Create an account to save your watchlists across sessions.'
      : 'Password reset instructions and email delivery status.';

  return (
    <div className="min-h-screen bg-[#101512] text-[#E8F0EA] flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5">
            <AuthVisualPanel accountReady={accountReady} />
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
            {/* Account Service Status Banner */}
            {!accountService || !accountService.ready ? (
              <div
                role="status"
                className="rounded-xl border border-[#D4A857]/35 bg-[#18211C] p-4 flex items-start gap-3"
              >
                <Info
                  className="w-4 h-4 text-[#D4A857] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="text-xs text-[#91A197] leading-relaxed">
                  <strong className="text-[#E8F0EA] block mb-0.5">
                    {accountService?.configured
                      ? 'Account Service Unavailable'
                      : 'Account Service Unconfigured'}
                  </strong>
                  {accountService?.message ??
                    'Account service is unconfigured. Set MONGODB_URI and JWT_SECRET on the server to enable registration and sign-in. Guest mode and local watchlists remain available.'}
                </div>
              </div>
            ) : (
              <div
                role="status"
                className="rounded-xl border border-[#36C982]/30 bg-[#18211C] px-4 py-3 flex items-center gap-2.5 text-xs text-[#A5EBC3]"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  MongoDB account service connected · Watchlists sync automatically on sign-in
                </span>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-[#18211C] p-6 sm:p-8 shadow-xl">
              {!authLoading && user ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-mono-num text-[#A5EBC3]">
                      Active HttpOnly Session
                    </p>
                    <h1 className="font-display text-2xl font-bold text-[#E8F0EA] mt-1">
                      Signed in as {user.name}
                    </h1>
                    <p className="text-sm text-[#91A197] mt-1">
                      {user.email} · {user.watchlist.length} watchlist equity
                      {user.watchlist.length === 1 ? '' : ' entries'} synced in MongoDB
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      to="/app/overview"
                      data-cursor="magnetic"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#36C982] text-[#101512] text-sm font-semibold hover:bg-[#A5EBC3] transition-colors"
                    >
                      Open Dashboard
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => void logoutUser()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/12 bg-[#141C17] text-sm font-medium text-[#E8F0EA] hover:border-white/25 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-[#91A197]" aria-hidden="true" />
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="font-display text-2xl font-bold text-[#E8F0EA]">
                    {title}
                  </h1>
                  <p className="text-sm text-[#91A197] mt-1.5">{subtitle}</p>

                  {serverError && (
                    <div
                      role="alert"
                      className="mt-4 rounded-lg border border-[#E06C65]/40 bg-[#E06C65]/10 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-[#E06C65]"
                    >
                      <AlertCircle
                        className="w-4 h-4 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{serverError}</span>
                    </div>
                  )}

                  <form
                    onSubmit={handleSubmit}
                    noValidate
                    className="mt-6 space-y-3"
                  >
                    {mode === 'register' && (
                      <div>
                        <label
                          htmlFor="auth-name"
                          className="block text-xs font-medium text-[#E8F0EA] mb-1.5"
                        >
                          Full Name
                        </label>
                        <input
                          id="auth-name"
                          type="text"
                          value={name}
                          onBlur={() =>
                            setTouched((t) => ({ ...t, name: true }))
                          }
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Aarav Mehta"
                          aria-invalid={Boolean(touched.name && errors.name)}
                          aria-describedby={
                            touched.name && errors.name ? 'err-name' : undefined
                          }
                          className="w-full h-10 px-3 rounded-lg border border-white/12 bg-[#141C17] text-sm text-[#E8F0EA] placeholder:text-[#91A197]/60 focus:border-[#36C982] focus:outline-none"
                        />
                        <div className="min-h-[18px] mt-1">
                          <AnimatePresence mode="wait">
                            {touched.name && errors.name && (
                              <motion.p
                                key="err-name"
                                id="err-name"
                                initial={{ opacity: 0, y: -2 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16 }}
                                className="text-xs text-[#E06C65]"
                              >
                                {errors.name}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="auth-email"
                        className="block text-xs font-medium text-[#E8F0EA] mb-1.5"
                      >
                        Email Address
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="analyst@example.com"
                        aria-invalid={Boolean(touched.email && errors.email)}
                        aria-describedby={
                          touched.email && errors.email ? 'err-email' : undefined
                        }
                        className="w-full h-10 px-3 rounded-lg border border-white/12 bg-[#141C17] text-sm text-[#E8F0EA] placeholder:text-[#91A197]/60 focus:border-[#36C982] focus:outline-none"
                      />
                      <div className="min-h-[18px] mt-1">
                        <AnimatePresence mode="wait">
                          {touched.email && errors.email && (
                            <motion.p
                              key="err-email"
                              id="err-email"
                              initial={{ opacity: 0, y: -2 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.16 }}
                              className="text-xs text-[#E06C65]"
                            >
                              {errors.email}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {mode !== 'forgot' && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="auth-password"
                            className="block text-xs font-medium text-[#E8F0EA]"
                          >
                            Password
                          </label>
                          {mode === 'login' && (
                            <Link
                              to="/forgot-password"
                              className="text-xs text-[#A5EBC3] hover:underline"
                            >
                              Forgot password?
                            </Link>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            id="auth-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onBlur={() =>
                              setTouched((t) => ({ ...t, password: true }))
                            }
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 8 characters"
                            aria-invalid={Boolean(
                              touched.password && errors.password
                            )}
                            aria-describedby={
                              touched.password && errors.password
                                ? 'err-password'
                                : undefined
                            }
                            className="w-full h-10 pl-3 pr-10 rounded-lg border border-white/12 bg-[#141C17] text-sm text-[#E8F0EA] placeholder:text-[#91A197]/60 focus:border-[#36C982] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={
                              showPassword ? 'Hide password' : 'Show password'
                            }
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#91A197] hover:text-[#E8F0EA]"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <div className="min-h-[18px] mt-1">
                          <AnimatePresence mode="wait">
                            {touched.password && errors.password && (
                              <motion.p
                                key="err-password"
                                id="err-password"
                                initial={{ opacity: 0, y: -2 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16 }}
                                className="text-xs text-[#E06C65]"
                              >
                                {errors.password}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>

                        {mode === 'register' && (
                          <div className="mt-1">
                            <div className="flex items-center justify-between text-[11px] text-[#91A197] mb-1">
                              <span>Password strength</span>
                              <span className="font-medium text-[#E8F0EA]">
                                {strength.label}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[1, 2, 3, 4].map((step) => {
                                const active = strength.score >= step;
                                return (
                                  <div
                                    key={step}
                                    className="h-1.5 rounded-full bg-white/10 overflow-hidden"
                                  >
                                    <motion.div
                                      initial={false}
                                      animate={{
                                        scaleX: active ? 1 : 0,
                                        opacity: active ? 1 : 0,
                                      }}
                                      transition={{ duration: 0.2, ease: 'easeOut' }}
                                      style={{ transformOrigin: 'left center' }}
                                      className={`h-full w-full rounded-full ${strength.color}`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {mode === 'register' && (
                      <div>
                        <label
                          htmlFor="auth-confirm"
                          className="block text-xs font-medium text-[#E8F0EA] mb-1.5"
                        >
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            id="auth-confirm"
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPassword}
                            onBlur={() =>
                              setTouched((t) => ({
                                ...t,
                                confirmPassword: true,
                              }))
                            }
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            aria-invalid={Boolean(
                              touched.confirmPassword && errors.confirmPassword
                            )}
                            aria-describedby={
                              touched.confirmPassword && errors.confirmPassword
                                ? 'err-confirm'
                                : undefined
                            }
                            className="w-full h-10 pl-3 pr-10 rounded-lg border border-white/12 bg-[#141C17] text-sm text-[#E8F0EA] placeholder:text-[#91A197]/60 focus:border-[#36C982] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm((s) => !s)}
                            aria-label={
                              showConfirm
                                ? 'Hide confirm password'
                                : 'Show confirm password'
                            }
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#91A197] hover:text-[#E8F0EA]"
                          >
                            {showConfirm ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <div className="min-h-[18px] mt-1">
                          <AnimatePresence mode="wait">
                            {touched.confirmPassword && errors.confirmPassword && (
                              <motion.p
                                key="err-confirm"
                                id="err-confirm"
                                initial={{ opacity: 0, y: -2 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16 }}
                                className="text-xs text-[#E06C65]"
                              >
                                {errors.confirmPassword}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-10 rounded-lg bg-[#36C982] text-[#101512] text-sm font-semibold hover:bg-[#A5EBC3] transition-colors disabled:opacity-60"
                    >
                      {submitting
                        ? mode === 'login'
                          ? 'Signing in...'
                          : 'Creating account...'
                        : mode === 'login'
                        ? 'Sign In'
                        : mode === 'register'
                        ? 'Create Account'
                        : 'Check Password Recovery'}
                    </button>
                  </form>

                  <AnimatePresence>
                    {forgotNotice && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        role="status"
                        className="mt-4 rounded-xl border border-white/12 bg-[#141C17] p-3.5 text-xs text-[#91A197] space-y-2"
                      >
                        <p className="leading-relaxed">
                          Email password-reset delivery is not enabled in this workspace. Please sign in with your existing password, register a new account, or continue in guest mode.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-6 pt-5 border-t border-white/8 space-y-3">
                    <Link
                      to="/app/overview"
                      data-cursor="magnetic"
                      className="w-full h-10 rounded-lg border border-white/12 bg-[#141C17] text-[#E8F0EA] text-sm font-semibold hover:border-[#36C982]/50 transition-colors flex items-center justify-center gap-2"
                    >
                      Continue as Guest
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>

                    <div className="text-center text-xs text-[#91A197]">
                      {mode === 'login' ? (
                        <>
                          Need an account?{' '}
                          <Link
                            to="/register"
                            className="text-[#A5EBC3] hover:underline"
                          >
                            Register
                          </Link>
                        </>
                      ) : (
                        <>
                          Already have an account?{' '}
                          <Link
                            to="/login"
                            className="text-[#A5EBC3] hover:underline"
                          >
                            Sign In
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};


"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type DemoUser = {
  id: string;
  name: string;
  business: string;
  email: string;
};

type AuthResult = Promise<{ ok: boolean; message?: string }>;

type AuthContextValue = {
  user: DemoUser | null;
  ready: boolean;
  login: (email: string, password: string) => AuthResult;
  verifyLoginCode: (email: string, code: string) => AuthResult;
  resendLoginCode: (email: string) => AuthResult;
  register: (user: Omit<DemoUser, "id"> & { password: string }) => AuthResult;
  requestPasswordReset: (email: string) => AuthResult;
  updatePassword: (password: string) => AuthResult;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const loginVerifiedKey = "vendoraq-login-code-verified-user";
const pendingLoginEmailKey = "vendoraq-pending-login-email";

function toDemoUser(sessionUser: { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null): DemoUser | null {
  if (!sessionUser?.email) {
    return null;
  }
  return {
    id: String(sessionUser.id ?? ""),
    email: sessionUser.email,
    name: String(sessionUser.user_metadata?.name ?? "Seller"),
    business: String(sessionUser.user_metadata?.business ?? "My Store"),
  };
}

function formatAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("failed to fetch")) {
    return "Could not reach Supabase. Refresh the page and try again. If it continues, confirm the Supabase project URL and publishable key.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email first, then log in again.";
  }
  if (normalized.includes("expired") || normalized.includes("invalid")) {
    return "This code is expired or not the newest one. Click Send new code and use the latest code from your email.";
  }
  return message;
}

function validatePassword(password: string) {
  if (password.length < 8) {
    return "Use at least 8 characters for your password.";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Use uppercase, lowercase, and a number in your password.";
  }
  return "";
}

function isGmailAddress(email: string) {
  return email.trim().toLowerCase().endsWith("@gmail.com");
}

function markLoginCodeVerified(userId: string) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(loginVerifiedKey, userId);
  }
}

function clearLoginCodeVerified() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(loginVerifiedKey);
  }
}

function savePendingLoginEmail(email: string) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(pendingLoginEmailKey, email.trim().toLowerCase());
  }
}

function getPendingLoginEmail() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.sessionStorage.getItem(pendingLoginEmailKey) ?? "";
}

function clearPendingLoginEmail() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(pendingLoginEmailKey);
  }
}

function hasVerifiedLoginCode(userId: string) {
  if (typeof window === "undefined") {
    return false;
  }
  return window.sessionStorage.getItem(loginVerifiedKey) === userId;
}

function isPasswordResetPage() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.pathname === "/reset-password";
}

function toVerifiedSellerUser(sessionUser: { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null) {
  if (!sessionUser?.id || !hasVerifiedLoginCode(String(sessionUser.id))) {
    return null;
  }
  return toDemoUser(sessionUser);
}

function getRedirectUrl(path: string) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configuredSiteUrl) {
    return `${configuredSiteUrl}${path}`;
  }
  if (typeof window === "undefined") {
    return undefined;
  }
  return `${window.location.origin}${path}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      if (!isPasswordResetPage() && sessionUser?.id && !hasVerifiedLoginCode(String(sessionUser.id))) {
        setUser(null);
      } else {
        setUser(isPasswordResetPage() ? null : toVerifiedSellerUser(sessionUser));
      }
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      if (!isPasswordResetPage() && sessionUser?.id && !hasVerifiedLoginCode(String(sessionUser.id))) {
        setUser(null);
      } else {
        setUser(isPasswordResetPage() ? null : toVerifiedSellerUser(sessionUser));
      }
      setReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    clearLoginCodeVerified();
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      return { ok: false, message: formatAuthError(error.message) };
    }
    savePendingLoginEmail(normalizedEmail);
    await supabase.auth.signOut();
    setUser(null);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: getRedirectUrl(`/login?code_email=${encodeURIComponent(normalizedEmail)}`),
        shouldCreateUser: false,
      },
    });
    if (otpError) {
      return { ok: false, message: formatAuthError(otpError.message) };
    }

    return { ok: true, message: "Password accepted. We sent a login code to your email." };
  }, []);

  const verifyLoginCode = useCallback(async (email: string, code: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      return { ok: false, message: formatAuthError(error.message) };
    }
    if (data.user?.id) {
      markLoginCodeVerified(data.user.id);
    }
    clearPendingLoginEmail();
    setUser(toDemoUser(data.user));
    return { ok: true };
  }, []);

  const resendLoginCode = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return { ok: false, message: "Enter your email first." };
    }

    savePendingLoginEmail(normalizedEmail);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: getRedirectUrl(`/login?code_email=${encodeURIComponent(normalizedEmail)}`),
        shouldCreateUser: false,
      },
    });
    if (error) {
      return { ok: false, message: formatAuthError(error.message) };
    }

    return { ok: true, message: "We sent a fresh login code to your email. Use the newest code only." };
  }, []);

  const register = useCallback(async (newUser: Omit<DemoUser, "id"> & { password: string }) => {
    const normalizedEmail = newUser.email.trim().toLowerCase();
    if (!isGmailAddress(normalizedEmail)) {
      return { ok: false, message: "Please register with a Gmail address ending in @gmail.com." };
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: newUser.password,
      options: {
        emailRedirectTo: getRedirectUrl("/login?confirmed=1"),
        data: {
          name: newUser.name,
          business: newUser.business,
        },
      },
    });
    if (error) {
      return { ok: false, message: formatAuthError(error.message) };
    }
    if (data.session) {
      setUser(toDemoUser(data.user));
      return { ok: true };
    }
    setUser(null);
    return { ok: true, message: "Account created. Check your email and confirm your account before logging in." };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getRedirectUrl("/reset-password"),
    });
    if (error) {
      return { ok: false, message: formatAuthError(error.message) };
    }
    return { ok: true, message: "If this email belongs to a seller account, a reset link has been sent." };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const passwordMessage = validatePassword(password);
    if (passwordMessage) {
      return { ok: false, message: passwordMessage };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return { ok: false, message: formatAuthError(error.message) };
    }
    clearLoginCodeVerified();
    clearPendingLoginEmail();
    await supabase.auth.signOut();
    setUser(null);
    return { ok: true, message: "Password updated. You can now log in with your new password." };
  }, []);

  const logout = useCallback(async () => {
    clearLoginCodeVerified();
    clearPendingLoginEmail();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, verifyLoginCode, resendLoginCode, register, requestPasswordReset, updatePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { ready, user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) {
      router.replace("/login");
      return;
    }

    if (ready && user && !hasVerifiedLoginCode(user.id)) {
      logout().finally(() => {
        router.replace("/login?code_required=1");
      });
    }
  }, [logout, ready, router, user]);

  if (!ready || !user || !hasVerifiedLoginCode(user.id)) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-5">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-bold text-slate-700">Checking seller access...</p>
        </div>
      </main>
    );
  }

  return children;
}

function PasswordField({
  name,
  label,
  placeholder,
  minLength = 1,
  autoComplete,
}: {
  name: string;
  label: string;
  placeholder: string;
  minLength?: number;
  autoComplete: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <span className="relative">
        <input
          name={name}
          type={showPassword ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          className="w-full rounded-md border border-slate-300 px-3 py-3 pr-12 font-normal outline-none focus:border-emerald-600"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShowPassword((visible) => !visible)}
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"
          aria-label={showPassword ? "Hide password" : "Show password"}
          title={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" />
              <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c5 0 8.6 4 10 8a13.6 13.6 0 0 1-2.4 4.2" />
              <path d="M6.4 6.4A13.5 13.5 0 0 0 2 12c1.4 4 5 8 10 8a10.5 10.5 0 0 0 4.4-.9" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8-10-8-10-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </span>
    </label>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="hidden bg-[linear-gradient(135deg,#064e3b,#0f172a_52%,#be123c)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="text-2xl font-black">VENDORAQ</Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Seller access</p>
          <h1 className="mt-4 max-w-xl text-5xl font-black leading-tight">Seller dashboard access for your WhatsApp store.</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-100">Customers shop from the public store. Sellers log in here to manage products, orders, inventory, receipts, and customers.</p>
        </div>
        <p className="text-sm text-slate-200">Secure seller account access for VENDORAQ.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-10">{children}</section>
    </main>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { login, verifyLoginCode, resendLoginCode, register, logout } = useAuth();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  useEffect(() => {
    if (mode === "login") {
      const savedPendingEmail = getPendingLoginEmail();
      if (savedPendingEmail) {
        setPendingEmail(savedPendingEmail);
      }
      logout();
      if (savedPendingEmail) {
        savePendingLoginEmail(savedPendingEmail);
      }
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("confirmed") === "1") {
          setNotice("Email confirmed. You can now log in to your seller dashboard.");
        }
        if (params.get("code_required") === "1") {
          setNotice("For security, enter your password and email code before opening the dashboard.");
        }
        const codeEmail = params.get("code_email");
        if (codeEmail) {
          const normalizedCodeEmail = codeEmail.trim().toLowerCase();
          savePendingLoginEmail(normalizedCodeEmail);
          setPendingEmail(normalizedCodeEmail);
          setNotice(`Enter the login code sent to ${normalizedCodeEmail}.`);
        }
      }
    }
  }, [logout, mode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const loginCode = String(formData.get("login_code") ?? "").trim();
    const name = String(formData.get("name") ?? "Ada Seller").trim();
    const business = String(formData.get("business") ?? "My Store").trim();

    if (mode === "register") {
      if (!isGmailAddress(email)) {
        setError("Please register with a Gmail address ending in @gmail.com.");
        setLoading(false);
        return;
      }

      const passwordMessage = validatePassword(password);
      if (passwordMessage) {
        setError(passwordMessage);
        setLoading(false);
        return;
      }

      const result = await register({ name, business, email, password });
      if (result.ok) {
        if (result.message) {
          setNotice(result.message);
        } else {
          window.location.href = "/dashboard/account";
        }
      } else {
        setError(result.message ?? "Registration failed. Please try again.");
      }
      setLoading(false);
      return;
    }

    if (pendingEmail) {
      if (!loginCode) {
        setError("Enter the code sent to your email.");
        setLoading(false);
        return;
      }
      const codeResult = await verifyLoginCode(pendingEmail, loginCode);
      if (!codeResult.ok) {
        setError(codeResult.message ?? "The code is wrong or expired. Please try again.");
        setLoading(false);
        return;
      }
      setLoading(false);
      window.location.href = "/dashboard/account";
      return;
    }

    const result = await login(email, password);
    if (!result.ok) {
      setError(result.message ?? "Login failed. Check your email and password.");
      setLoading(false);
      return;
    }
    setPendingEmail(email);
    setNotice(result.message ?? "We sent a login code to your email.");
    setLoading(false);
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/" className="text-xl font-black text-slate-950 lg:hidden">VENDORAQ</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{mode === "login" ? "Seller login" : "Create seller account"}</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">
          {mode === "login" ? (pendingEmail ? "Enter your email code" : "Login to your seller dashboard") : "Start your seller account"}
        </h2>
        {mode === "login" ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {pendingEmail ? `We sent a one-time login code to ${pendingEmail}. Enter it here to open your dashboard.` : "This login is for business owners. Customers can shop without logging in."}
          </p>
        ) : null}
        <div className="mt-6 grid gap-4">
          {mode === "login" && pendingEmail ? (
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Email login code
              <input
                name="login_code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                autoComplete="off"
                required
                className="rounded-md border border-slate-300 px-3 py-3 text-center text-2xl font-black tracking-[0.24em] outline-none focus:border-emerald-600"
                placeholder="12345678"
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 8);
                }}
              />
            </label>
          ) : (
            <>
          {mode === "register" ? (
            <>
              <label className="grid gap-2 text-sm font-bold text-slate-700">Your name<input name="name" required className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600" placeholder="Ada Okafor" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">Business name<input name="business" required className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600" placeholder="Victor Stores, Beauty Hub, Builders Mart" /></label>
            </>
          ) : null}
          <label className="grid gap-2 text-sm font-bold text-slate-700">Email<input name="email" type="email" required autoComplete="username" className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600" placeholder={mode === "register" ? "seller@gmail.com" : "seller@example.com"} /></label>
          <PasswordField
            name="password"
            label="Password"
            minLength={mode === "login" ? 1 : 8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "login" ? "Your password" : "8+ characters, uppercase, lowercase, number"}
          />
            </>
          )}
        </div>
        {mode === "login" && !pendingEmail ? (
          <button type="button" onClick={() => router.push("/forgot-password")} className="mt-3 text-sm font-bold text-emerald-700 hover:text-emerald-900">
            Forgot password?
          </button>
        ) : null}
        {mode === "login" && pendingEmail ? (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setPendingEmail("");
                clearPendingLoginEmail();
                setError("");
                setNotice("");
              }}
              className="text-sm font-bold text-emerald-700 hover:text-emerald-900"
            >
              Use another email
            </button>
            <button
              type="button"
              disabled={resendingCode}
              onClick={async () => {
                setError("");
                setNotice("");
                setResendingCode(true);
                const result = await resendLoginCode(pendingEmail);
                setResendingCode(false);
                if (result.ok) {
                  setNotice(result.message ?? "We sent a fresh code.");
                } else {
                  setError(result.message ?? "Could not send a fresh code.");
                }
              }}
              className="text-sm font-bold text-slate-700 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {resendingCode ? "Sending new code..." : "Send new code"}
            </button>
          </div>
        ) : null}
        {error ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {notice ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
        <button type="submit" disabled={loading} className="mt-6 w-full rounded-md bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
          {loading ? "Please wait..." : mode === "login" ? (pendingEmail ? "Verify code and open dashboard" : "Continue securely") : "Create seller account"}
        </button>
        <div className="mt-5 text-center text-sm text-slate-600">
          <span>{mode === "login" ? "Need a seller account? " : "Already registered? "}</span>
          <button
            type="button"
            onClick={() => router.push(mode === "login" ? "/register" : "/login")}
            className="font-bold text-emerald-700 hover:text-emerald-900"
          >
            {mode === "login" ? "Register" : "Login"}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const { requestPasswordReset } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const result = await requestPasswordReset(email);
    setLoading(false);
    if (result.ok) {
      setMessage(result.message ?? "Check your email for the reset link.");
    } else {
      setError(result.message ?? "Could not send reset email. Please try again.");
    }
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/" className="text-xl font-black text-slate-950 lg:hidden">VENDORAQ</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Account recovery</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">Reset your password</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Enter your seller email. We will send a secure reset link if the account exists.</p>
        <label className="mt-6 grid gap-2 text-sm font-bold text-slate-700">Email<input name="email" type="email" required autoComplete="username" className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600" placeholder="seller@example.com" /></label>
        {error ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {message ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
        <button type="submit" disabled={loading} className="mt-6 w-full rounded-md bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
          {loading ? "Sending..." : "Send reset link"}
        </button>
        <Link href="/login" className="mt-5 block text-center text-sm font-bold text-emerald-700 hover:text-emerald-900">Back to login</Link>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const { updatePassword } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");
    if (password !== confirmPassword) {
      setError("Both passwords must match.");
      setLoading(false);
      return;
    }
    const result = await updatePassword(password);
    setLoading(false);
    if (result.ok) {
      setMessage(result.message ?? "Password updated. You can log in now.");
    } else {
      setError(result.message ?? "Could not update password. Open the reset link from your email again.");
    }
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/" className="text-xl font-black text-slate-950 lg:hidden">VENDORAQ</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">New password</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">Create a new password</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Use a strong password with uppercase, lowercase, and a number.</p>
        <div className="mt-6 grid gap-4">
          <PasswordField name="password" label="New password" minLength={8} autoComplete="new-password" placeholder="8+ characters, uppercase, lowercase, number" />
          <PasswordField name="confirm_password" label="Confirm password" minLength={8} autoComplete="new-password" placeholder="Repeat new password" />
        </div>
        {error ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {message ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
        <button type="submit" disabled={loading || Boolean(message)} className="mt-6 w-full rounded-md bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
          {loading ? "Updating..." : "Update password"}
        </button>
        <Link href="/login" className="mt-5 block text-center text-sm font-bold text-emerald-700 hover:text-emerald-900">Back to login</Link>
      </form>
    </AuthShell>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <button
      onClick={async () => {
        await logout();
        router.push("/login");
      }}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
    >
      Logout
    </button>
  );
}



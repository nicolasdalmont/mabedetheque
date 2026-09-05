"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getNeonClient, safeAuthCall } from "@/lib/neon-client";

const cardClass =
  "w-full max-w-sm space-y-4 rounded-xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-950";
const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 sm:text-sm dark:border-white/20 dark:focus:border-white/50";
const buttonClass =
  "w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200";

// Sign-in happens client-side (not a Server Action): the browser's Neon
// client caches the session's JWT (from the `set-auth-jwt` response header)
// in memory when IT performs the sign-in. A server-side sign-in sets the
// session cookie fine, but leaves the browser client's own token cache
// empty, which then makes every Data API call fail with AuthRequiredError.
function SignInForm({ onForgotPassword }: { onForgotPassword: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const { error } = await safeAuthCall(
      getNeonClient().auth.signIn.email({ email, password }),
    );
    setPending(false);
    if (error) {
      setError(error.message ?? "Connexion impossible.");
      return;
    }
    router.push("/");
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <div>
        <h1 className="text-xl font-semibold">Ma Bédéthèque</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connexion à votre collection.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Connexion..." : "Se connecter"}
      </button>

      <button
        type="button"
        onClick={onForgotPassword}
        className="w-full text-center text-sm text-zinc-500 hover:underline"
      >
        Mot de passe oublié ?
      </button>
    </form>
  );
}

// Reset via a 6-digit code by email rather than a link: Neon's shared email
// provider only supports OTP-style emails, not "click this link" ones (a
// custom email provider is required for the link flow).
function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await safeAuthCall(
      getNeonClient().auth.forgetPassword.emailOtp({ email }),
    );
    setPending(false);
    if (error) {
      setError(error.message ?? "Envoi impossible.");
      return;
    }
    setStep("confirm");
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await safeAuthCall(
      getNeonClient().auth.emailOtp.resetPassword({ email, otp, password }),
    );
    setPending(false);
    if (error) {
      setError(error.message ?? "Réinitialisation impossible.");
      return;
    }
    onBack();
  }

  if (step === "confirm") {
    return (
      <form onSubmit={handleConfirm} className={cardClass}>
        <div>
          <h1 className="text-xl font-semibold">Code reçu par email</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Entrez le code envoyé à {email} et votre nouveau mot de passe.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="otp" className="text-sm font-medium">
            Code
          </label>
          <input
            id="otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            autoComplete="one-time-code"
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="new-password" className="text-sm font-medium">
            Nouveau mot de passe
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Enregistrement..." : "Réinitialiser le mot de passe"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequestCode} className={cardClass}>
      <div>
        <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Un code de vérification vous sera envoyé par email.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={inputClass}
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Envoi..." : "Envoyer le code"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-sm text-zinc-500 hover:underline"
      >
        ← Retour à la connexion
      </button>
    </form>
  );
}

export default function LoginPage() {
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      {showForgotPassword ? (
        <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
      ) : (
        <SignInForm onForgotPassword={() => setShowForgotPassword(true)} />
      )}
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { getCurrentUser, login, RiskoraApiError } from "@/lib/riskora-api";
import { buttonClass, inputClass } from "./presentation";

export function AuthView({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError) {
      setError("Google sign-in did not complete. Try again or use your platform password.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    getCurrentUser()
      .then(() => onAuthenticated())
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [onAuthenticated]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof RiskoraApiError ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-hairline bg-forest p-6 sm:p-8">
        <div className="flex items-center gap-3 text-lime">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em]">Secure workspace</p>
        </div>
        <h1 className="mt-5 text-2xl text-foreground">Sign in to Riskora</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use your platform account to access borrower and portfolio analysis.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Username
            </span>
            <input
              className={`${inputClass} mt-2`}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Password
            </span>
            <input
              className={`${inputClass} mt-2`}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className={`${buttonClass} w-full justify-center`}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-hairline" />
            or
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <a
            href="/api/auth/google/start"
            className={`${buttonClass} w-full justify-center border border-hairline-strong bg-transparent text-foreground hover:bg-forest-raised`}
          >
            Continue with Google
          </a>
        </form>
      </section>
    </main>
  );
}

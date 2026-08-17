import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase recovery links deliver a session via the URL hash — wait for it.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("At least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. You're signed in.");
    nav({ to: "/dashboard" });
  }

  return (
    <main className="container-x flex min-h-[calc(100vh-8rem)] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-10 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze text-center">Reset password</p>
        <h1 className="mt-3 text-center font-serif text-3xl">Choose a new password</h1>

        {!ready ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Verifying reset link… If nothing happens, request a new link from the sign-in page.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">New password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                minLength={8} required
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Confirm password</span>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                minLength={8} required
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
            </label>
            <button type="submit" disabled={loading}
              className="w-full rounded-full bg-primary py-3 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

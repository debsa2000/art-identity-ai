import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

const schema = z.object({ email: z.string().email().max(255) });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) return toast.error("Enter a valid email");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Reset link sent — check your inbox.");
  }

  return (
    <main className="container-x flex min-h-[calc(100vh-8rem)] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-10 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze text-center">Password help</p>
        <h1 className="mt-3 text-center font-serif text-3xl">Forgot your password?</h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Enter your email and we'll send you a link to set a new one.
        </p>

        {sent ? (
          <div className="mt-8 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
            If an account exists for <span className="text-foreground">{email}</span>, a reset link is on its way.
            The link expires shortly — check your spam folder if you don't see it.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
            </label>
            <button type="submit" disabled={loading}
              className="w-full rounded-full bg-primary py-3 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Remembered it? <Link to="/auth" search={{ mode: "signin" }} className="bronze-link">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}

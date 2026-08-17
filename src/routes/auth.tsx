import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { becomeGallery } from "@/lib/gallery.functions";
import { attachMakeover } from "@/lib/makeover.functions";
import { getClaimToken } from "@/lib/makeover-client";


// Same-origin relative path only; drop anything else to avoid open-redirects.
function sanitizeNext(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length === 0) return undefined;
  if (!v.startsWith("/") || v.startsWith("//")) return undefined;
  return v;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode as string) === "signup" ? "signup" : "signin",
    next: sanitizeNext(s.next),
    makeover: typeof s.makeover === "string" ? s.makeover : undefined,
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

function AuthPage() {
  const { mode, next, makeover } = Route.useSearch();
  const nav = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">(mode);
  const [accountType, setAccountType] = useState<"artist" | "gallery">("artist");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const become = useServerFn(becomeGallery);
  const attachMk = useServerFn(attachMakeover);

  async function tryAttachMakeover() {
    if (!makeover) return;
    const token = getClaimToken(makeover);
    if (!token) return;
    try { await attachMk({ data: { sessionId: makeover, claimToken: token } }); }
    catch { /* non-fatal */ }
  }



  // Where to land after successful auth. `next` (e.g. an OAuth consent URL)
  // takes priority over the default post-auth destination.
  function goPostAuth(defaultTo: "/dashboard" | "/gallery-onboarding") {
    if (next) {
      window.location.href = next;
      return;
    }
    nav({ to: defaultTo });
  }

  useEffect(() => setTab(mode), [mode]);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        await tryAttachMakeover();
        if (next) window.location.href = next;
        else nav({ to: makeover ? "/onboarding" : "/dashboard" });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, next, makeover]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      if (tab === "signup") {
        const emailRedirectTo = next
          ? `${window.location.origin}${next}`
          : window.location.origin;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: { account_type: accountType },
          },
        });
        if (error) throw error;
        if (accountType === "gallery") {
          try { await become({ data: {} }); } catch { /* non-fatal; user can retry from settings */ }
          toast.success("Gallery account created.");
          goPostAuth("/gallery-onboarding");
        } else {
          await tryAttachMakeover();
          toast.success("Account created.");
          if (makeover) nav({ to: "/onboarding" });
          else goPostAuth("/dashboard");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await tryAttachMakeover();
        if (makeover) nav({ to: "/onboarding" });
        else goPostAuth("/dashboard");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    const redirect_uri = next
      ? `${window.location.origin}${next}`
      : window.location.origin;
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri });
    if (result.error) {
      toast.error(result.error.message);
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    goPostAuth("/dashboard");
  }

  return (
    <main className="container-x flex min-h-[calc(100vh-8rem)] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-10 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze text-center">
          {tab === "signup" ? "Begin your identity" : "Welcome back"}
        </p>
        <h1 className="mt-3 text-center font-serif text-3xl">
          {tab === "signup" ? "Create your account" : "Sign in"}
        </h1>

        <div className="mt-8 flex rounded-full border border-border p-1 text-xs">
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full px-3 py-2 uppercase tracking-widest transition ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {t === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        {tab === "signup" && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">I am a…</p>
            <div className="flex rounded-full border border-border p-1 text-xs">
              {(["artist", "gallery"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setAccountType(t)}
                  className={`flex-1 rounded-full px-3 py-2 uppercase tracking-widest transition ${accountType === t ? "bg-bronze text-bronze-foreground" : "text-muted-foreground"}`}
                >
                  {t === "artist" ? "Artist" : "Gallery"}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary py-3 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >{loading ? "Please wait…" : tab === "signup" ? "Create account" : "Sign in"}</button>
          {tab === "signin" && (
            <p className="text-center text-xs">
              <Link to="/forgot-password" className="bronze-link">Forgot password?</Link>
            </p>
          )}
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={google}
          disabled={loading}
          className="w-full rounded-full border border-border py-3 text-xs uppercase tracking-widest hover:bg-secondary disabled:opacity-50"
        >Continue with Google</button>
      </div>
    </main>
  );
}

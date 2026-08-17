import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "aia_signup_nudge_v1";

export function SignUpNudge() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const p = window.location.pathname;
      if (p.startsWith("/makeover") || p.startsWith("/m/")) return;
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch { /* ignore */ }

    let dismissed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    supabase.auth.getUser().then(({ data }) => {
      if (data.user || dismissed) return;
      timer = setTimeout(() => setOpen(true), 8000);
    });

    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !dismissed) setOpen(true);
    };
    document.addEventListener("mouseleave", onLeave);

    return () => {
      dismissed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  function close() {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* ignore */ }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl glass p-8">
        <button onClick={close} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="size-5" />
        </button>
        <div className="inline-flex size-10 items-center justify-center rounded-full neon-border text-[color:var(--color-neon)]">
          <Sparkles className="size-5" />
        </div>
        <h2 className="mt-4 font-serif text-3xl">Start your artist profile</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your account, complete your profile, and submit it for curator review. Approved artists unlock their public site, portfolio PDF and inquiries.
        </p>
        <ol className="mt-4 space-y-1 text-xs text-muted-foreground">
          <li><span className="text-[color:var(--color-emerald-glow)]">1.</span> Sign up in 30 seconds</li>
          <li><span className="text-[color:var(--color-emerald-glow)]">2.</span> Complete your profile (guided by Aria)</li>
          <li><span className="text-[color:var(--color-emerald-glow)]">3.</span> Submit for review — approval unlocks everything</li>
        </ol>
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          onClick={close}
          className="mt-6 block w-full rounded-full btn-neon px-5 py-2.5 text-center text-sm uppercase tracking-widest"
        >
          Create my artist profile
        </Link>
        <button onClick={close} className="mt-3 block w-full text-center text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
          Maybe later
        </button>
      </div>
    </div>
  );
}

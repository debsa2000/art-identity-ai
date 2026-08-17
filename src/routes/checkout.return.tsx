import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadEntitlements } from "@/lib/entitlements";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (s: Record<string, unknown>) => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
  }),
  component: Return,
});

function resolveDestination(to?: string): string {
  if (!to) return "/dashboard";
  // Allow same-origin relative paths only
  if (!to.startsWith("/") || to.startsWith("//")) return "/dashboard";
  const known = ["/portfolio", "/website", "/resume", "/membership", "/dashboard"];
  return known.includes(to) ? to : "/dashboard";
}

function Return() {
  const { to } = Route.useSearch();
  const nav = useNavigate();
  const dest = resolveDestination(to);
  const [status, setStatus] = useState<"pending" | "ready" | "timeout">("pending");

  // Poll entitlements up to ~10s so the destination page reflects the new unlock.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    async function tick() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setStatus("ready"); return; }
      const before = await loadEntitlements(data.user.id);
      // Simple readiness: any unlock present is good enough
      if (before.canDownloadPdf || before.canPublishWebsite || before.canDownloadResume || before.memberActive) {
        if (!cancelled) setStatus("ready");
        return;
      }
      attempts += 1;
      if (attempts >= 10) { if (!cancelled) setStatus("timeout"); return; }
      setTimeout(tick, 1000);
    }
    tick();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-[11px] uppercase tracking-[0.3em] text-teal-300">Confirmed</p>
      <h1 className="mt-3 font-serif text-5xl">Thank you.</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        {status === "pending" && "Activating your access…"}
        {status === "ready" && "Your access is unlocked."}
        {status === "timeout" && "Payment received — access should appear shortly. If not, refresh the page in a minute."}
      </p>
      <button
        onClick={() => nav({ to: dest })}
        disabled={status === "pending"}
        className="mt-8 rounded-full bg-teal-400 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-slate-950 hover:bg-teal-300 disabled:opacity-50"
      >
        {status === "pending" ? "Please wait…" : "Continue"}
      </button>
    </div>
  );
}

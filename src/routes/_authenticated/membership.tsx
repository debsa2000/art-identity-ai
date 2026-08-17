import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, XCircle, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/membership")({ component: MembershipPage });

type Status = "draft" | "submitted" | "approved" | "rejected";

const PERKS = [
  "Featured placement in the collector-facing directory",
  "Shared with interior designers and Renovate AI room-visualization buyers",
  "Direct inquiry inbox with email notifications",
  "Full analytics on views, saves, and downloads",
  "Priority curator support for new work you upload",
];

function MembershipPage() {
  const [status, setStatus] = useState<Status>("draft");
  const [pct, setPct] = useState<number>(0);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const { data } = await supabase.from("profiles")
        .select("application_status,completion_percent,buyer_network_note")
        .eq("id", u.user.id).maybeSingle();
      setStatus((((data as any)?.application_status) ?? "draft") as Status);
      setPct(((data as any)?.completion_percent ?? 0) as number);
      setNote(((data as any)?.buyer_network_note ?? null) as string | null);
    } finally { setLoading(false); }
  })(); }, []);

  if (loading) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-teal-300">Buyer Network · invitation only</p>
        <h1 className="mt-2 font-serif text-4xl">Membership</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The Buyer Network is a curated circle of artists shown to collectors, interior designers and Renovate AI buyers.
          There is no self-serve checkout — every artist is invited by our curators after reviewing their work.
        </p>
      </header>

      {status === "approved" && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 text-emerald-400" />
            <div>
              <p className="font-serif text-2xl">You've been approved.</p>
              <p className="mt-1 text-sm text-muted-foreground">Your profile is being surfaced to collectors and design buyers. An admin will reach out about pricing (or complimentary access, depending on your tier) — no action needed from you right now.</p>
            </div>
          </div>
        </div>
      )}
      {status === "submitted" && (
        <div className="rounded-2xl border border-teal-400/40 bg-teal-500/5 p-6">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 size-5 text-teal-300" />
            <div>
              <p className="font-serif text-2xl">Your application is in review.</p>
              <p className="mt-1 text-sm text-muted-foreground">Aria's curators are looking at your work. You'll be notified by email as soon as it's decided.</p>
            </div>
          </div>
        </div>
      )}
      {status === "rejected" && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="font-serif text-2xl">Not approved this round.</p>
              <p className="mt-1 text-sm text-muted-foreground">Please refine your portfolio and resubmit — curators re-review when your profile changes.</p>
              {note && <p className="mt-2 text-xs text-muted-foreground"><span className="uppercase tracking-widest text-bronze">Curator note · </span>{note}</p>}
            </div>
          </div>
        </div>
      )}
      {status === "draft" && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/5 p-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-amber-300">Your application · {pct}% complete</p>
          <p className="mt-2 font-serif text-2xl">Complete your profile to apply.</p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">There's no fee to apply. Your completed profile <em>is</em> your application. Only the first 100 approved artists get lifetime free access to everything.</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${pct}%` }} />
          </div>
          <Link to="/profile" className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-950 hover:bg-amber-300">
            Complete profile <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center gap-2 text-teal-300">
          <Sparkles className="size-4" />
          <p className="text-[11px] uppercase tracking-[0.3em]">What approved artists receive</p>
        </div>
        <ul className="mt-4 space-y-3 text-sm">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-300" /> {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

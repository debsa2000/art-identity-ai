import { X, Clock, CheckCircle2, XCircle, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PricingIntent = "portfolio" | "resume" | "website" | "studio" | "mockups";

const INTENT_COPY: Record<PricingIntent, { title: string; sub: string }> = {
  portfolio: { title: "Portfolio PDF — locked", sub: "Your print-ready portfolio unlocks once your application is approved." },
  resume:    { title: "Resume / CV — locked", sub: "Your downloadable CV unlocks once your application is approved." },
  website:   { title: "Public website — locked", sub: "Publishing your public site goes live once your application is approved." },
  studio:    { title: "AI Studio — locked", sub: "The AI writer unlocks once your application is approved." },
  mockups:   { title: "Room mockups — locked", sub: "Photorealistic room previews unlock once your application is approved." },
};

type Status = "draft" | "submitted" | "approved" | "rejected";

export function PricingModal({
  open,
  intent,
  onClose,
}: {
  open: boolean;
  intent: PricingIntent;
  onClose: () => void;
  returnTo?: string;
}) {
  const [status, setStatus] = useState<Status>("draft");
  const [pct, setPct] = useState<number>(0);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("application_status,completion_percent").eq("id", u.user.id).maybeSingle();
      setStatus(((data as any)?.application_status ?? "draft") as Status);
      setPct(((data as any)?.completion_percent ?? 0) as number);
    })();
  }, [open]);

  if (!open) return null;
  const copy = INTENT_COPY[intent];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm sm:p-6">
      <div className="glass relative my-6 w-full max-w-lg rounded-3xl border border-teal-400/20 bg-slate-950/90 p-8">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full border border-white/10 p-2 text-white/60 hover:text-white">
          <X className="size-4" />
        </button>
        <p className="text-[11px] uppercase tracking-[0.3em] text-teal-300">Members only</p>
        <h2 className="mt-2 font-serif text-3xl text-white">{copy.title}</h2>
        <p className="mt-3 text-sm text-white/70">{copy.sub}</p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          {status === "approved" && (
            <div className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="mt-0.5 size-5 text-emerald-400" />
              <p className="text-white/80">You're approved — reload the page to access this feature.</p>
            </div>
          )}
          {status === "submitted" && (
            <div className="flex items-start gap-3 text-sm">
              <Clock className="mt-0.5 size-5 text-teal-300" />
              <p className="text-white/80">Your application is in review with our curators. You'll receive an email as soon as it's decided — typically within 48 hours.</p>
            </div>
          )}
          {status === "rejected" && (
            <div className="flex items-start gap-3 text-sm">
              <XCircle className="mt-0.5 size-5 text-destructive" />
              <p className="text-white/80">Your application wasn't approved this round. Update your work and resubmit — Aria will review again.</p>
            </div>
          )}
          {status === "draft" && (
            <>
              <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/60">
                <span>Application completion</span>
                <span className="text-teal-300">{pct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-400" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-4 text-sm text-white/75">
                Your <strong>completed profile is your application</strong>. Finish it to submit — an admin will review and approve access to all premium features.
              </p>
              <p className="mt-3 flex items-center gap-2 text-xs text-amber-300">
                <Sparkles className="size-3.5" /> Only the first 100 approved artists get lifetime free access.
              </p>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/profile" onClick={onClose} className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-950 hover:bg-teal-300">
            Complete your application <ArrowRight className="size-3.5" />
          </Link>
          <button onClick={onClose} className="rounded-full border border-white/20 px-5 py-2.5 text-xs uppercase tracking-widest text-white/80 hover:bg-white/5">Close</button>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Image as ImageIcon, Sparkles, Globe, FileDown, FileText, Mail, LineChart, Settings as SettingsIcon, Crown, Upload, Check, ChevronDown, ChevronUp, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("profiles").select("artist_name").eq("id", u.user.id).maybeSingle();
    if (!data || !data.artist_name) throw redirect({ to: "/onboarding" });
  },
  component: Dashboard,
});

const CARDS = [
  { to: "/profile", label: "My Profile", desc: "Complete this to submit your application", icon: User },
  { to: "/artworks", label: "My Artworks", desc: "Upload up to 15 pieces", icon: ImageIcon },
  { to: "/studio", label: "AI Studio", desc: "Statement & biography · after approval", icon: Sparkles },
  { to: "/website", label: "My Website", desc: "Preview free · publish after approval", icon: Globe },
  { to: "/portfolio", label: "Portfolio PDF", desc: "Preview free · download after approval", icon: FileDown },
  { to: "/resume", label: "Resume / CV", desc: "Preview free · download after approval", icon: FileText },
  { to: "/membership", label: "Buyer Network", desc: "Invitation-only for approved artists", icon: Crown },
  { to: "/inquiries", label: "My Inquiries", desc: "Collector & gallery messages", icon: Mail },
  { to: "/analytics", label: "Analytics", desc: "Views, downloads, inquiries", icon: LineChart },
  { to: "/settings", label: "Settings", desc: "Account & preferences", icon: SettingsIcon },
] as const;

type ProfileMe = {
  artist_name: string | null;
  slug: string;
  published: boolean;
  application_status: "draft" | "submitted" | "approved" | "rejected";
  completion_percent: number;
  free_teaser_used: boolean;
  city: string | null;
  country: string | null;
  medium: string | null;
  instagram: string | null;
  style: string | null;
  price_range: string | null;
  exhibitions: string | null;
};

function Dashboard() {
  const { data: profile } = useQuery({
    queryKey: ["profile-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("artist_name,slug,published,application_status,completion_percent,free_teaser_used,city,country,medium,instagram,style,price_range,exhibitions")
        .eq("id", u.user.id)
        .maybeSingle();
      return data as ProfileMe | null;
    },
  });

  const { data: artworkCount } = useQuery({
    queryKey: ["artwork-count"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return 0;
      const { count } = await supabase.from("artworks").select("id", { count: "exact", head: true }).eq("user_id", u.user.id);
      return count ?? 0;
    },
  });

  const { data: questionsAnswered } = useQuery({
    queryKey: ["questions-answered"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return 0;
      const { data } = await supabase.from("questionnaires").select("q1,q2,q3,q4,q5,q6").eq("user_id", u.user.id).maybeSingle();
      if (!data) return 0;
      return (["q1","q2","q3","q4","q5","q6"] as const).filter((k) => ((data as any)[k] ?? "").toString().trim()).length;
    },
  });

  const status = ((profile as any)?.application_status ?? "draft") as "draft" | "submitted" | "approved" | "rejected";
  const pct = ((profile as any)?.completion_percent ?? 0) as number;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Studio</p>
          <h1 className="mt-2 font-serif text-4xl">Welcome{profile?.artist_name ? `, ${profile.artist_name}` : ""}.</h1>
        </div>
        {profile?.slug && profile.published && (
          <Link to="/a/$slug" params={{ slug: profile.slug }} className="text-sm bronze-link">View public site →</Link>
        )}
      </header>

      <NextStepCard
        artworkCount={artworkCount ?? 0}
        questionsAnswered={questionsAnswered ?? 0}
        status={status}
        pct={pct}
      />

      {profile && status !== "approved" && (
        <FinishProfileChecklist profile={profile} />
      )}

      {status !== "draft" && <ApplicationCard status={status} pct={pct} />}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group rounded-2xl border border-border bg-card p-6 transition hover:border-bronze"
          >
            <c.icon className="size-5 text-bronze" />
            <h3 className="mt-4 font-serif text-xl">{c.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NextStepCard({ artworkCount, questionsAnswered, status, pct }: { artworkCount: number; questionsAnswered: number; status: string; pct: number }) {
  // Two mandatory steps: 10 artworks, then 6 questions. Then submitted.
  if (artworkCount < 10) {
    const remaining = 10 - artworkCount;
    return (
      <StepCTA
        eyebrow="Step 1 of 2"
        title="Upload your 10 pieces"
        body={`You're at ${artworkCount} / 10. Upload ${remaining} more — image and title only — to move on.`}
        cta="Continue uploading"
        to="/onboarding"
        icon={Upload}
        tone="amber"
      />
    );
  }
  if (questionsAnswered < 6) {
    return (
      <StepCTA
        eyebrow="Step 2 of 2"
        title="Tell us about your art (6 quick questions)"
        body={`${questionsAnswered} / 6 answered. Short honest answers work best — this is what Aria uses to write your voice.`}
        cta="Answer the questions"
        to="/onboarding"
        icon={Sparkles}
        tone="emerald"
      />
    );
  }
  if (status === "draft" && pct < 100) {
    return (
      <StepCTA
        eyebrow="Almost submitted"
        title="Finish the last details to submit"
        body={`You're ${pct}% complete. Wrap it up and your application goes to our curators automatically.`}
        cta="Finish now"
        to="/onboarding"
        icon={User}
        tone="amber"
      />
    );
  }
  if (status === "draft") return null;
  // Submitted / approved / rejected — show the polish-anytime nudge
  return (
    <StepCTA
      eyebrow="You're submitted"
      title="Polish your profile anytime"
      body="Optional details — CV, location, medium, Instagram, style, price range, exhibitions — strengthen your presence but never block your application."
      cta="Polish profile"
      to="/profile"
      icon={User}
      tone="emerald"
    />
  );
}

function StepCTA({ eyebrow, title, body, cta, to, icon: Icon, tone }: { eyebrow: string; title: string; body: string; cta: string; to: string; icon: React.ComponentType<{ className?: string }>; tone: "amber" | "emerald" }) {
  const toneCls = tone === "emerald"
    ? "border-emerald-400/40 from-emerald-500/10 to-teal-500/5 text-emerald-300"
    : "border-amber-400/40 from-amber-500/10 to-orange-500/5 text-amber-300";
  const btnCls = tone === "emerald"
    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
    : "bg-amber-400 hover:bg-amber-300 text-slate-950";
  return (
    <div className={`mt-8 rounded-2xl border bg-gradient-to-br p-6 ${toneCls}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.3em]">{eyebrow}</p>
          <div className="mt-2 flex items-center gap-3">
            <Icon className="size-6" />
            <h2 className="font-serif text-2xl text-foreground">{title}</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </div>
        <Link to={to as any} className={`rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-widest ${btnCls}`}>
          {cta} →
        </Link>
      </div>
    </div>
  );
}

const CHECKLIST_DISMISS_KEY = "aia:dismissed-profile-checklist";

function FinishProfileChecklist({ profile }: { profile: ProfileMe }) {
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && localStorage.getItem(CHECKLIST_DISMISS_KEY) === "1");
  const [open, setOpen] = useState(true);

  const items = [
    { key: "location", label: "Add your city & country", done: Boolean(profile.city && profile.country), to: "/profile" as const },
    { key: "medium", label: "Set your primary medium", done: Boolean(profile.medium), to: "/profile" as const },
    { key: "instagram", label: "Connect Instagram", done: Boolean(profile.instagram), to: "/profile" as const },
    { key: "style", label: "Describe your style", done: Boolean(profile.style), to: "/profile" as const },
    { key: "price_range", label: "Add a price range", done: Boolean(profile.price_range), to: "/profile" as const },
    { key: "exhibitions", label: "List past exhibitions", done: Boolean(profile.exhibitions), to: "/profile" as const },
  ];
  const remaining = items.filter((i) => !i.done).length;
  if (dismissed || remaining === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Finish your profile</p>
          <p className="mt-1 text-sm text-muted-foreground">{remaining} optional section{remaining === 1 ? "" : "s"} left · never blocking, but each one strengthens your application.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); localStorage.setItem(CHECKLIST_DISMISS_KEY, "1"); setDismissed(true); }}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            title="Dismiss"
          >
            <X className="size-4" />
          </button>
          {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <ul className="grid gap-1 border-t border-border p-3 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.key}>
              <Link
                to={i.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-secondary ${i.done ? "text-muted-foreground" : "text-foreground"}`}
              >
                <span className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border ${i.done ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-300" : "border-border text-muted-foreground"}`}>
                  {i.done && <Check className="size-3" />}
                </span>
                <span className={i.done ? "line-through" : ""}>{i.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicationCard({ status, pct }: { status: "draft" | "submitted" | "approved" | "rejected"; pct: number }) {
  if (status === "approved") {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-400">Approved · full access</p>
        <p className="mt-2 font-serif text-2xl">You're in. Every premium feature is unlocked.</p>
        <p className="mt-2 text-sm text-muted-foreground">Aria's AI Studio, PDF portfolio, CV, mockups and publishing are all live for you.</p>
      </div>
    );
  }
  if (status === "submitted") {
    return (
      <div className="mt-8 rounded-2xl border border-teal-400/40 bg-teal-500/5 p-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-teal-300">Application submitted · in review</p>
        <p className="mt-2 font-serif text-2xl">Aria is reviewing your work.</p>
        <p className="mt-2 text-sm text-muted-foreground">You'll get an email as soon as a curator decides — typically within 48 hours. Meanwhile, keep refining your artworks.</p>
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/5 p-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-destructive">Not approved this round</p>
        <p className="mt-2 font-serif text-2xl">Update your work and resubmit.</p>
        <p className="mt-2 text-sm text-muted-foreground">Add stronger pieces or refine your profile — curators re-review automatically when your profile changes.</p>
      </div>
    );
  }
  const remaining = 100 - pct;
  return (
    <div className="mt-8 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-amber-300">Your application · {pct}% complete</p>
          <p className="mt-2 font-serif text-2xl">Only {remaining}% away from submitting.</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

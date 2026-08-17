import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Globe, FileDown, Mail, QrCode, LineChart, Instagram } from "lucide-react";
import { FreeSlotsBanner } from "@/components/FreeSlotsBanner";
import { PricingCalculator } from "@/components/PricingCalculator";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <main className="relative overflow-hidden">
      {/* Painterly background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="blob blob-a" />
        <div className="blob blob-b" />
        <div className="blob blob-c" />
        <div className="grain" />
      </div>

      {/* Hero */}
      <section className="container-x relative pt-24 pb-32">
        <div className="mx-auto max-w-4xl text-center">
          <p className="chip mx-auto">
            <span className="chip-dot" /> Art Identity AI · Curated by Aria
          </p>
          <div className="mt-5 flex justify-center"><FreeSlotsBanner /></div>
          <h1 className="mt-8 font-serif text-5xl leading-[1.02] md:text-7xl">
            A professional art identity,<br />
            <span className="relative inline-block italic text-bronze">
              crafted in ten minutes.
              <BrushUnderline />
            </span>
          </h1>
          <p className="mt-8 mx-auto max-w-2xl text-lg text-muted-foreground">
            Upload your work, answer ten questions, and receive a gallery-grade artist statement,
            biography, personal website, and printable portfolio — instantly.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/makeover"
              className="group inline-flex items-center gap-2 rounded-full btn-neon px-6 py-3 text-sm uppercase tracking-widest">
              Try the free Magic Makeover <Sparkles className="size-4" />
            </Link>
            <Link to="/auth" search={{ mode: "signup" }}
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm uppercase tracking-widest hover:bg-secondary">
              Create my profile <ArrowRight className="size-4" />
            </Link>
            <Link to="/directory" className="text-sm text-muted-foreground hover:text-foreground">Explore artists →</Link>
          </div>

          {/* Floating artistic frames */}
          <div className="relative mx-auto mt-20 hidden max-w-3xl md:block">
            <FloatingFrame className="absolute -left-6 -top-4 rotate-[-6deg]" style={{ animationDelay: "0s" }} label="Statement" variant="statement" />
            <FloatingFrame className="absolute left-1/2 -top-10 -translate-x-1/2 rotate-[2deg]" style={{ animationDelay: "1.2s" }} label="Website" variant="website" tall />
            <FloatingFrame className="absolute -right-6 -top-2 rotate-[7deg]" style={{ animationDelay: "0.6s" }} label="Portfolio" variant="portfolio" />
            <div className="h-56" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative border-y border-border bg-secondary/40">
        <div className="container-x py-20">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">The Ritual</p>
              <h2 className="mt-2 font-serif text-4xl md:text-5xl">Three brushstrokes.</h2>
            </div>
            <p className="hidden max-w-xs text-sm text-muted-foreground md:block italic">
              "Every artist deserves a stage. I'll help you build yours." — Aria
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { n: "01", t: "Upload your work", d: "Add up to 15 pieces with medium, dimensions, and year." },
              { n: "02", t: "Answer 10 questions", d: "Share your voice, intention, and journey in your own words." },
              { n: "03", t: "Receive your identity", d: "AI generates statement, biography, website, and portfolio PDF." },
            ].map((s) => (
              <div key={s.n} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 transition hover:-translate-y-1 hover:border-bronze">
                <div className="pointer-events-none absolute -right-8 -top-8 font-serif text-[8rem] leading-none text-bronze/10 transition group-hover:text-bronze/20">
                  {s.n}
                </div>
                <div className="relative">
                  <div className="text-[11px] uppercase tracking-[0.3em] text-bronze">{s.n}</div>
                  <h3 className="mt-4 font-serif text-2xl">{s.t}</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container-x py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">The Atelier</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl">Everything an artist needs.</h2>
          <p className="mt-4 text-muted-foreground">No design skills. No writing. Just your work.</p>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            { i: Sparkles, t: "AI Studio", d: "Artist statement, biography, Instagram bio, elevator pitch — refined and editable." },
            { i: Globe, t: "Personal website", d: "A minimal editorial site at art-identity.ai/a/your-name." },
            { i: FileDown, t: "Portfolio PDF", d: "Print-ready, gallery-quality PDF you can download anytime." },
            { i: Mail, t: "Direct inquiries", d: "Collectors, galleries, and designers reach you through a private inbox." },
            { i: QrCode, t: "QR code", d: "For exhibitions, cards, and gallery walls — one scan opens your identity." },
            { i: LineChart, t: "Analytics", d: "See views, downloads, and inquiries at a glance." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="group rounded-2xl border border-border bg-card p-6 transition hover:border-bronze">
              <div className="inline-flex size-10 items-center justify-center rounded-full bg-bronze/10 text-bronze transition group-hover:bg-bronze group-hover:text-bronze-foreground">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 font-serif text-xl">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Calculator */}
      <PricingCalculator />

      {/* Instagram ribbon */}
      <section className="container-x pb-16">

        <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-border bg-card p-8">
          <div className="flex items-center gap-4">
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white">
              <Instagram className="size-6" />
            </div>
            <div>
              <p className="font-serif text-xl">Bring your Instagram along.</p>
              <p className="text-sm text-muted-foreground">Connect your handle during onboarding — Aria will pull it into your public site and press kit.</p>
            </div>
          </div>
          <Link to="/auth" search={{ mode: "signup" }} className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest hover:bg-secondary">
            Start with Aria →
          </Link>
        </div>
      </section>

      {/* Future */}

      <section id="future" className="container-x pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-primary p-10 text-primary-foreground md:p-16">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-bronze/30 blur-3xl" />
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Coming Soon</p>
          <h2 className="mt-4 font-serif text-4xl md:text-5xl">Visualize My Art in Your Room</h2>
          <p className="mt-6 max-w-2xl text-primary-foreground/70">
            Homeowners, interior designers, and architects will soon upload photos of their space and preview
            your artwork on the wall — powered by our upcoming Renovate AI integration.
          </p>
        </div>
      </section>
    </main>
  );
}

function BrushUnderline() {
  return (
    <svg className="absolute -bottom-3 left-0 h-3 w-full text-bronze" viewBox="0 0 300 12" preserveAspectRatio="none" fill="none">
      <path d="M2 8 C 60 2, 120 12, 180 5 S 280 3, 298 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

type FrameVariant = "statement" | "website" | "portfolio";

function FloatingFrame({ className, style, label, tall, variant }: { className?: string; style?: React.CSSProperties; label: string; tall?: boolean; variant: FrameVariant }) {
  return (
    <div
      className={`float-y rounded-2xl glass p-3 shadow-2xl ${className ?? ""}`}
      style={style}
    >
      <div className={`w-44 overflow-hidden rounded-lg ${tall ? "h-64" : "h-44"} bg-gradient-to-br from-[color:var(--color-secondary)] to-[color:color-mix(in_oklab,var(--color-neon)_18%,transparent)]`}>
        {variant === "statement" && <StatementMock />}
        {variant === "website" && <WebsiteMock />}
        {variant === "portfolio" && <PortfolioMock />}
      </div>
      <p className="mt-2 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
    </div>
  );
}

function StatementMock() {
  return (
    <div className="flex h-full flex-col gap-1 p-3 text-[7px] leading-[1.3] text-foreground/85">
      <div className="text-[6px] uppercase tracking-widest text-[color:var(--color-emerald-glow)]">Artist Statement</div>
      <div className="font-serif text-[10px] leading-tight text-foreground">Between silence and pigment,<br/> I trace the residue of memory.</div>
      <p className="mt-1 opacity-80">My practice moves between abstraction and figuration, guided by the tension of what a surface can hold before it dissolves. Each canvas is a slow negotiation with light —</p>
      <p className="opacity-70">— a place where colour becomes weather, and gesture becomes an argument for tenderness.</p>
      <div className="mt-auto flex items-center gap-1"><span className="h-px w-6 bg-[color:var(--color-neon)]" /><span className="text-[6px] uppercase tracking-widest text-muted-foreground">Curated by Aria</span></div>
    </div>
  );
}

function WebsiteMock() {
  return (
    <div className="flex h-full flex-col text-[7px]">
      <div className="flex items-center justify-between border-b border-white/10 px-2 py-1">
        <span className="font-serif text-[9px] text-foreground">Elena Marchetti</span>
        <span className="text-[6px] uppercase tracking-widest text-muted-foreground">Works · About · Contact</span>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-1 p-2">
        <div className="rounded-sm bg-gradient-to-br from-[#1a3a5c] to-[#0e6a63]" />
        <div className="rounded-sm bg-gradient-to-br from-[#26506b] to-[#4b1f4d]" />
        <div className="rounded-sm bg-gradient-to-br from-[#0e3b4a] to-[#1c7370]" />
        <div className="rounded-sm bg-gradient-to-br from-[#38264a] to-[#1c4a55]" />
        <div className="rounded-sm bg-gradient-to-br from-[#0f2a44] to-[#0a8079]" />
        <div className="rounded-sm bg-gradient-to-br from-[#5a2a3d] to-[#124a58]" />
      </div>
      <div className="px-2 pb-2 text-[6px] uppercase tracking-widest text-muted-foreground">art-identity.ai/a/elena</div>
    </div>
  );
}

function PortfolioMock() {
  return (
    <div className="flex h-full flex-col items-center justify-between p-3 text-center">
      <div className="text-[6px] uppercase tracking-[0.35em] text-[color:var(--color-emerald-glow)]">Portfolio · 2026</div>
      <div>
        <div className="font-serif text-[13px] leading-none text-foreground">Elena<br/>Marchetti</div>
        <div className="mx-auto mt-2 h-px w-8 bg-[color:var(--color-neon)]" />
        <div className="mt-2 text-[7px] tracking-widest text-muted-foreground">Selected Works</div>
      </div>
      <div className="grid w-full grid-cols-2 gap-1">
        <div className="h-6 rounded-sm bg-gradient-to-br from-[#1a3a5c] to-[#0e6a63]" />
        <div className="h-6 rounded-sm bg-gradient-to-br from-[#38264a] to-[#1c4a55]" />
      </div>
      <div className="text-[6px] uppercase tracking-widest text-muted-foreground">Print-ready PDF · 24pp</div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, Lock, Sparkles } from "lucide-react";

const MEDIUMS = [
  "Oil on Canvas",
  "Acrylic",
  "Mixed Media",
  "Digital Art",
  "Watercolor",
  "Sculpture",
] as const;

const LEVELS = [
  { key: "emerging", label: "Emerging Artist", rate: 2.5, hint: "0–5 yrs practice" },
  { key: "mid", label: "Mid-Career Artist", rate: 6.0, hint: "Regular exhibitions" },
  { key: "established", label: "Established Artist", rate: 15.0, hint: "Collected · represented" },
] as const;

const LABOR_RATE = 25;

function roundToNearest5(n: number) {
  return Math.max(0, Math.round(n / 5) * 5);
}

export function PricingCalculator() {
  const [medium, setMedium] = useState<(typeof MEDIUMS)[number]>("Oil on Canvas");
  const [width, setWidth] = useState<number>(24);
  const [height, setHeight] = useState<number>(36);
  const [levelKey, setLevelKey] = useState<(typeof LEVELS)[number]["key"]>("mid");
  const [hours, setHours] = useState<number>(20);

  const level = LEVELS.find((l) => l.key === levelKey)!;

  const { basePrice, labor, retail } = useMemo(() => {
    const area = Math.max(0, width) * Math.max(0, height);
    const base = area * level.rate;
    const lab = Math.max(0, hours) * LABOR_RATE;
    return { basePrice: base, labor: lab, retail: roundToNearest5(base + lab) };
  }, [width, height, hours, level.rate]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <section className="container-x py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">The Ledger</p>
        <h2 className="mt-3 font-serif text-4xl md:text-5xl">US Market Pricing Calculator</h2>
        <p className="mt-4 text-muted-foreground">
          A transparent formula collectors and galleries recognize. Adjust the inputs — your recommended retail price updates instantly.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* Editor */}
        <div className="rounded-3xl glass p-8">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-[color:var(--color-emerald-glow)]">
            <Calculator className="size-4" /> Editor
          </div>

          {/* Medium */}
          <div className="mt-6">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Medium</label>
            <select
              value={medium}
              onChange={(e) => setMedium(e.target.value as (typeof MEDIUMS)[number])}
              className="mt-2 w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm focus:border-[color:var(--color-neon)] focus:outline-none"
            >
              {MEDIUMS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Dimensions */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Width (in)</label>
              <input
                type="number" min={1} value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm focus:border-[color:var(--color-neon)] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Height (in)</label>
              <input
                type="number" min={1} value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm focus:border-[color:var(--color-neon)] focus:outline-none"
              />
            </div>
          </div>

          {/* Experience */}
          <div className="mt-6">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Experience</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {LEVELS.map((l) => {
                const active = l.key === levelKey;
                return (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLevelKey(l.key)}
                    className={`rounded-xl border px-3 py-3 text-left text-xs transition ${
                      active
                        ? "border-[color:var(--color-neon)] bg-[color:var(--color-neon)]/10 text-foreground"
                        : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-medium text-foreground">{l.label}</div>
                    <div className="mt-1 opacity-70">{l.hint}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-widest text-[color:var(--color-emerald-glow)]">
                      ${l.rate.toFixed(2)}/in²
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hours */}
          <div className="mt-6">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Time Spent (hours)</label>
            <input
              type="number" min={0} value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm focus:border-[color:var(--color-neon)] focus:outline-none"
            />
            <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">Labor @ ${LABOR_RATE}/hr</p>
          </div>
        </div>

        {/* Result */}
        <div className="relative flex flex-col rounded-3xl glass p-8">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-bronze">
            <Sparkles className="size-4" /> Recommended Retail
          </div>

          <div className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">{medium} · {width}″ × {height}″</div>
          <div className="mt-2 font-serif text-6xl md:text-7xl leading-none text-foreground tabular-nums">
            {fmt(retail)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Rounded to nearest $5 · US market standard</p>

          <div className="mt-6 space-y-2 text-sm">
            <Row label={`Base (${width} × ${height} × $${level.rate.toFixed(2)})`} value={fmt(basePrice)} />
            <Row label={`Labor (${Math.max(0, hours)} hrs × $${LABOR_RATE})`} value={fmt(labor)} />
            <div className="h-px bg-border" />
            <Row label="Retail (rounded)" value={fmt(retail)} bold />
          </div>

          {/* Lock CTA */}
          <div className="mt-6 rounded-2xl border border-[color:var(--color-neon)]/40 bg-[color:var(--color-neon)]/5 p-5">
            <div className="flex items-start gap-3">
              <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-full neon-border text-[color:var(--color-neon)]">
                <Lock className="size-4" />
              </div>
              <p className="text-sm text-foreground/90">
                💡 Collectors expect consistency. Lock in this pricing formula and auto-generate your professional invoice/portfolio sheet by saving this piece to your profile.
              </p>
            </div>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="mt-4 block w-full rounded-full btn-neon px-5 py-3 text-center text-xs uppercase tracking-widest"
            >
              Save & Apply to Profile
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-serif text-lg text-foreground" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

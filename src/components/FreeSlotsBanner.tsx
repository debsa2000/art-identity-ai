import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getOnboardingCount } from "@/lib/portfolio.functions";

export function FreeSlotsBanner() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const fetchCount = useServerFn(getOnboardingCount);

  useEffect(() => {
    fetchCount()
      .then((done) => setRemaining(Math.max(0, 100 - (done ?? 0))))
      .catch(() => setRemaining(null));
  }, [fetchCount]);

  const label =
    remaining === null ? "First 100 artists get free onboarding" :
    remaining > 0 ? `Only ${remaining} of 100 free onboarding spots left` :
    "Free onboarding cohort is full — join the waitlist";

  return (
    <Link
      to="/auth" search={{ mode: "signup" }}
      className="group mx-auto inline-flex max-w-full items-center gap-3 rounded-full glass px-4 py-2 text-sm text-foreground/90 hover:text-foreground"
    >
      <span className="inline-flex size-6 items-center justify-center rounded-full btn-neon">
        <Sparkles className="size-3" />
      </span>
      <span className="truncate">
        <span className="font-medium text-[color:var(--color-emerald-glow)]">{label}</span>
        <span className="hidden sm:inline text-muted-foreground"> — start uploading the art you want to sell.</span>
      </span>
      <ArrowRight className="size-4 text-[color:var(--color-neon)] transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

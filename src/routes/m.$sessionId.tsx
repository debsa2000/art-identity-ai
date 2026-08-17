import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Share2, Copy, ArrowRight, Sparkles, MessageCircle, Instagram, Download } from "lucide-react";
import { getMakeoverSession, saveMakeoverFallbackEmail } from "@/lib/makeover.functions";
import { getClaimToken, getDownloadCount, incrementDownloadCount, FREE_DOWNLOAD_LIMIT } from "@/lib/makeover-client";
import { composeStoryImage, composeSquareShare, shareOrDownload } from "@/lib/story-share";

const VIBE_LABELS: Record<string, string> = {
  modern_minimalist: "Modern Minimalist",
  scandinavian: "Scandinavian",
  industrial_loft: "Industrial Loft",
  bohemian: "Bohemian",
  traditional_classic: "Traditional",
  gallery_white_cube: "Gallery White Cube",
};

export const Route = createFileRoute("/m/$sessionId")({
  head: ({ params }) => ({
    meta: [
      { title: "My Magic Makeover — Art Identity AI" },
      { name: "description", content: "See this artist's collector-ready makeover — three room mockups, a curator bio, and a readiness score." },
      { property: "og:title", content: "My Magic Makeover — Art Identity AI" },
      { property: "og:description", content: "See this artist's collector-ready makeover." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MakeoverResults,
});

function MakeoverResults() {
  const { sessionId } = Route.useParams();
  const load = useServerFn(getMakeoverSession);
  const saveEmail = useServerFn(saveMakeoverFallbackEmail);
  const [data, setData] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const [showFallback, setShowFallback] = useState(false);
  const [email, setEmail] = useState("");
  const [claim] = useState(() => getClaimToken(sessionId));

  useEffect(() => {
    let stopped = false;
    let elapsed = 0;
    const poll = async () => {
      try {
        const d = await load({ data: { sessionId } });
        if (stopped) return;
        setData(d);
        const done = d?.status === "ready" || d?.status === "failed" || (d?.mockups && Object.keys(d.mockups).length >= 3);
        elapsed += 3;
        if (elapsed > 95 && (!d || Object.keys(d?.mockups ?? {}).length === 0)) setShowFallback(true);
        if (!done) setTimeout(poll, 3000);
      } catch { /* keep polling */ }
    };
    poll();
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => { stopped = true; clearInterval(t); };
  }, [sessionId, load]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/m/${sessionId}` : `/m/${sessionId}`;
  const scoreText = data?.score ? `Collector-Ready Score: ${data.score}/100` : "";

  const mockupEntries = Object.entries<string>(data?.mockups ?? {});
  const bioReady = !!data?.bio;

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); toast.success("Link copied"); } catch { /* ignore */ }
  }
  function whatsapp() {
    const t = encodeURIComponent(`${scoreText}\nMy free art makeover from Aria at Art Identity AI:\n${shareUrl}`);
    window.open(`https://wa.me/?text=${t}`, "_blank");
  }
  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    try { await saveEmail({ data: { sessionId, email } }); toast.success("We'll email you when it's ready."); setShowFallback(false); }
    catch { toast.error("Failed to save email"); }
  }

  const signUpHref = `/auth?mode=signup${claim ? `&makeover=${sessionId}` : ""}`;

  const [busyShare, setBusyShare] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<number>(() => (typeof window !== "undefined" ? getDownloadCount() : 0));
  const [showLock, setShowLock] = useState(false);
  const locked = downloads >= FREE_DOWNLOAD_LIMIT;

  function tryConsume(): boolean {
    if (locked) { setShowLock(true); return false; }
    const n = incrementDownloadCount();
    setDownloads(n);
    if (n >= FREE_DOWNLOAD_LIMIT) {
      // Allow this one, then show lock next time
    }
    return true;
  }

  async function shareStory(vibe: string, imageUrl: string) {
    if (!tryConsume()) return;
    setBusyShare(`story-${vibe}`);
    try {
      const blob = await composeStoryImage({
        imageUrl,
        artistName: data?.artist_name ?? "The Artist",
        title: data?.title ?? "New work",
        vibeLabel: VIBE_LABELS[vibe] ?? vibe,
        score: data?.score ?? null,
      });
      const result = await shareOrDownload(
        blob,
        `magic-makeover-${vibe}-story.png`,
        `My Magic Makeover from Aria at Art Identity AI — ${shareUrl}`,
      );
      toast.success(result === "shared" ? "Opening share sheet…" : "Story image downloaded — upload it to your Instagram Story.");
    } catch {
      toast.error("Couldn't build the story image");
    } finally { setBusyShare(null); }
  }

  async function downloadWatermarked(vibe: string, imageUrl: string) {
    if (!tryConsume()) return;
    setBusyShare(`dl-${vibe}`);
    try {
      const blob = await composeSquareShare({
        imageUrl,
        artistName: data?.artist_name ?? "The Artist",
        title: data?.title ?? "New work",
        vibeLabel: VIBE_LABELS[vibe] ?? vibe,
        score: data?.score ?? null,
      });
      await shareOrDownload(blob, `magic-makeover-${vibe}.png`);
      toast.success("Saved with watermark.");
    } catch {
      toast.error("Download failed");
    } finally { setBusyShare(null); }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container-x max-w-4xl py-10 md:py-16">
        <p className="text-center text-[11px] uppercase tracking-[0.3em] text-bronze">Curated by Aria</p>
        <h1 className="mt-2 text-center font-serif text-4xl md:text-5xl">
          {data?.artist_name ?? "The Artist"} — <span className="italic text-bronze">{data?.title ?? "New work"}</span>
        </h1>

        {/* Mockups */}
        <section className="mt-10 grid gap-5 md:grid-cols-3">
          {["modern_minimalist", "industrial_loft", "bohemian"].map((vibe) => {
            const url = (data?.mockups ?? {})[vibe];
            const label = VIBE_LABELS[vibe] ?? vibe;
            return (
              <div key={vibe} className="group flex flex-col gap-3">
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border glass">
                  {url ? (
                    <>
                      <img src={url} alt={label} className="h-full w-full object-cover animate-in fade-in duration-700" />
                      <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[9px] uppercase tracking-widest text-white/90 backdrop-blur-sm">
                        {label}
                      </div>
                      <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[9px] uppercase tracking-widest text-white/80 backdrop-blur-sm">
                        Art Identity AI
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
                      <Sparkles className="size-4 animate-pulse text-[color:var(--color-neon)]" />
                      Aria is painting <span className="capitalize">{label}</span>…
                    </div>
                  )}
                </div>
                {url && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => shareStory(vibe, url)}
                      disabled={busyShare === `story-${vibe}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-bronze/50 bg-bronze/10 px-3 py-2 text-[11px] uppercase tracking-widest text-bronze hover:bg-bronze/20 disabled:opacity-50"
                    >
                      <Instagram className="size-3.5" /> {busyShare === `story-${vibe}` ? "…" : "Story"}
                    </button>
                    <button
                      onClick={() => downloadWatermarked(vibe, url)}
                      disabled={busyShare === `dl-${vibe}`}
                      title="Download watermarked image"
                      className="inline-flex items-center justify-center rounded-full border border-border px-3 py-2 text-[11px] hover:bg-secondary disabled:opacity-50"
                    >
                      <Download className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>



        {/* Score + Bio */}
        <section className="mt-10 grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl glass p-6">
            <p className="text-[10px] uppercase tracking-widest text-bronze">Collector-Ready Score</p>
            {data?.score != null ? (
              <>
                <p className="mt-2 font-serif text-6xl">{data.score}<span className="text-2xl text-muted-foreground">/100</span></p>
                <ul className="mt-5 space-y-3 text-sm">
                  {(data.insights ?? []).map((i: any) => (
                    <li key={i.label}>
                      <div className="flex items-baseline justify-between">
                        <span className="font-medium">{i.label}</span>
                        <span className="text-xs text-muted-foreground">{i.value}/100</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{i.insight}</p>
                      <p className="mt-1 text-xs italic text-[color:var(--color-emerald-glow)]">Tip: {i.tip}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Scoring…</p>
            )}
          </div>
          <div className="rounded-2xl glass p-6">
            <p className="text-[10px] uppercase tracking-widest text-bronze">Aria's Bio Draft</p>
            {bioReady ? (
              <p className="mt-3 font-serif text-lg leading-relaxed">{data.bio}</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Aria is writing…</p>
            )}
          </div>
        </section>

        {/* Share */}
        <section className="mt-10 rounded-2xl glass p-6">
          <p className="text-[10px] uppercase tracking-widest text-bronze">Share your makeover</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={whatsapp} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary">
              <MessageCircle className="size-4" /> WhatsApp
            </button>
            <button onClick={copyLink} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary">
              <Copy className="size-4" /> Copy link
            </button>
            {typeof navigator !== "undefined" && (navigator as any).share && (
              <button
                onClick={() => (navigator as any).share({ title: "My Magic Makeover", text: scoreText, url: shareUrl }).catch(() => {})}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary">
                <Share2 className="size-4" /> More…
              </button>
            )}
          </div>
        </section>

        {/* Convert */}
        <section className="mt-8 rounded-2xl border border-bronze/40 bg-gradient-to-br from-bronze/10 to-transparent p-6 text-center">
          <p className="font-serif text-2xl">This is a preview of your full professional identity.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Founding artists join free. Complete your profile and unlock your public site, portfolio PDF, and inquiries.
          </p>
          <Link
            to="/auth"
            search={{ mode: "signup", ...(claim ? { makeover: sessionId } : {}) } as any}
            className="mt-5 inline-flex items-center gap-2 rounded-full btn-neon px-6 py-3 text-sm uppercase tracking-widest"
          >
            {claim ? "Claim this makeover" : "Create my identity"} <ArrowRight className="size-4" />
          </Link>
        </section>

        {showFallback && (
          <section className="mt-6 rounded-2xl border border-border bg-secondary/40 p-6 text-center">
            <p className="font-serif text-lg">Aria is polishing your renders.</p>
            <p className="mt-1 text-xs text-muted-foreground">Leave your email — we'll send them the moment they're ready.</p>
            <form onSubmit={submitEmail} className="mx-auto mt-3 flex max-w-sm gap-2">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm" placeholder="you@example.com" />
              <button type="submit" className="rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-widest text-primary-foreground">Notify me</button>
            </form>
          </section>
        )}

        <p className="mt-6 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
          Free downloads used: {Math.min(downloads, FREE_DOWNLOAD_LIMIT)} / {FREE_DOWNLOAD_LIMIT}
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Want to try another? <Link to="/makeover" className="bronze-link">Start a new makeover</Link>
        </p>
      </div>

      {showLock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowLock(false)}>
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg rounded-3xl glass border border-bronze/40 p-8 md:p-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">You've used your 3 free downloads</p>
            <h2 className="mt-3 font-serif text-3xl md:text-4xl leading-tight">
              Join the <span className="italic text-bronze">Top 100 Curated Artists</span> shown to our Buyer Network
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Create your full artist profile to unlock unlimited downloads, Instagram-ready story exports, a public site, and a place in the founding cohort seen by collectors and galleries in our Buyer Network.
            </p>
            <ul className="mt-5 space-y-2 text-left text-sm">
              <li className="flex gap-2"><Sparkles className="size-4 shrink-0 text-bronze mt-0.5" /> Unlimited watermarked story & feed exports</li>
              <li className="flex gap-2"><Sparkles className="size-4 shrink-0 text-bronze mt-0.5" /> Curator-written bio + Collector-Ready score on your public page</li>
              <li className="flex gap-2"><Sparkles className="size-4 shrink-0 text-bronze mt-0.5" /> Application reviewed for the Top 100 shown to buyers</li>
            </ul>
            <Link
              to="/auth"
              search={{ mode: "signup", ...(claim ? { makeover: sessionId } : {}) } as any}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full btn-neon px-6 py-3 text-sm uppercase tracking-widest"
            >
              {claim ? "Claim & apply for the Top 100" : "Apply to the Top 100"} <ArrowRight className="size-4" />
            </Link>
            <button onClick={() => setShowLock(false)} className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
              Maybe later
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

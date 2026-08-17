import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Upload, ArrowRight, Share2, Copy, Loader2 } from "lucide-react";
import {
  createMakeoverSession,
  updateMakeoverAnswers,
  runMakeover,
  getMakeoverSession,
  saveMakeoverFallbackEmail,
} from "@/lib/makeover.functions";
import { downscaleImage, uploadMakeoverImage, getDeviceFp, saveClaimToken, getClaimToken } from "@/lib/makeover-client";

export const Route = createFileRoute("/makeover")({
  head: () => ({
    meta: [
      { title: "Free Magic Makeover — See your art in a gallery in 60 seconds | Art Identity AI" },
      { name: "description", content: "Upload one artwork. Aria conjures three collector-ready room mockups, a curator bio, and your Collector-Ready Score. Free. No sign-up." },
      { property: "og:title", content: "Free Magic Makeover — Art Identity AI" },
      { property: "og:description", content: "Upload one artwork. See it in a collector's living room in 60 seconds. Free." },
    ],
  }),
  component: MakeoverPage,
});

type Step = "upload" | "questions" | "generating" | "results";

function MakeoverPage() {
  const [step, setStep] = useState<Step>("upload");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = useServerFn(createMakeoverSession);
  const saveAns = useServerFn(updateMakeoverAnswers);
  const run = useServerFn(runMakeover);
  const nav = useNavigate();

  async function onFile(file: File) {
    setBusy(true);
    try {
      const blob = await downscaleImage(file);
      const path = await uploadMakeoverImage(blob);
      const res = await create({ data: { image_path: path, device_fp: getDeviceFp() } });
      setSessionId(res.sessionId);
      setClaimToken(res.claimToken);
      saveClaimToken(res.sessionId, res.claimToken);
      setStep("questions");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setBusy(false); }
  }

  async function onAnswers(a: { title: string; medium: string; dimensions?: string; description: string; artist_name?: string }) {
    if (!sessionId || !claimToken) return;
    setBusy(true);
    try {
      await saveAns({ data: { sessionId, claimToken, ...a } });
      setStep("generating");
      // Kick generation in background
      run({ data: { sessionId, claimToken } }).catch(() => { /* status flips to failed */ });
      setTimeout(() => nav({ to: "/m/$sessionId", params: { sessionId } }), 500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container-x max-w-2xl py-10 md:py-16">
        <div className="mb-8 flex items-center justify-center gap-2 text-center">
          <span className="chip"><span className="chip-dot" /> Free · No sign-up · 60 seconds</span>
        </div>
        <h1 className="text-center font-serif text-4xl md:text-5xl leading-[1.05]">
          The <span className="italic text-bronze">Magic Makeover</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-center text-muted-foreground">
          Upload one artwork. Aria will hang it in three collector homes, write your bio, and score your readiness.
        </p>

        <div className="mt-10">
          {step === "upload" && <UploadStep onFile={onFile} busy={busy} />}
          {step === "questions" && <QuestionsStep onSubmit={onAnswers} busy={busy} />}
          {step === "generating" && <GeneratingStep />}
        </div>
      </div>
    </main>
  );
}

function UploadStep({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const f = e.dataTransfer.files?.[0]; if (f) onFile(f);
        }}
        className={`block cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition ${dragOver ? "border-bronze bg-bronze/5" : "border-border glass"} ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
        <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full neon-border">
          {busy ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
        </div>
        <p className="font-serif text-2xl">{busy ? "Uploading…" : "Drop your artwork here"}</p>
        <p className="mt-2 text-sm text-muted-foreground">or tap to browse · JPG / PNG / HEIC · up to 15MB</p>
      </label>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        You keep full rights to your work. Nothing is published without your permission.
      </p>
    </div>
  );
}

function QuestionsStep({ onSubmit, busy }: { onSubmit: (a: any) => void; busy: boolean }) {
  const [title, setTitle] = useState("");
  const [medium, setMedium] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [description, setDescription] = useState("");
  const [artistName, setArtistName] = useState("");
  const valid = title.trim() && medium.trim() && description.trim();
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit({ title, medium, dimensions, description, artist_name: artistName }); }}
      className="space-y-5 rounded-3xl glass p-6 md:p-8"
    >
      <p className="text-sm italic text-muted-foreground">"Three quick things, then I'll go to work." — Aria</p>
      <label className="block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Title of the work</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200}
          placeholder="e.g. Monsoon Study No. 3"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-bronze focus:outline-none" />
      </label>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Medium</span>
          <input value={medium} onChange={(e) => setMedium(e.target.value)} required maxLength={200}
            placeholder="Oil on canvas"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-bronze focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Dimensions (optional)</span>
          <input value={dimensions} onChange={(e) => setDimensions(e.target.value)} maxLength={120}
            placeholder='24 x 36 in'
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-bronze focus:outline-none" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">One line about this work</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={600} rows={3}
          placeholder="What were you chasing when you made it?"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-bronze focus:outline-none" />
      </label>
      <label className="block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Your name (optional)</span>
        <input value={artistName} onChange={(e) => setArtistName(e.target.value)} maxLength={120}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-bronze focus:outline-none" />
      </label>
      <button type="submit" disabled={!valid || busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full btn-neon px-5 py-3 text-sm uppercase tracking-widest disabled:opacity-50">
        {busy ? "…" : <>Conjure my makeover <Sparkles className="size-4" /></>}
      </button>
    </form>
  );
}

function GeneratingStep() {
  return (
    <div className="rounded-3xl glass p-12 text-center">
      <Loader2 className="mx-auto size-8 animate-spin text-[color:var(--color-neon)]" />
      <p className="mt-4 font-serif text-2xl">Aria is at the easel…</p>
      <p className="mt-2 text-sm text-muted-foreground">Three rooms, one bio, one score — arriving in a moment.</p>
    </div>
  );
}

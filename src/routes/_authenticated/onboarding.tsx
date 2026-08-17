import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ArrowLeft, Check, Palette, Upload, ImageIcon, X, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage, signedUrl } from "@/lib/storage";
import { generateArtworkMockup } from "@/lib/mockup.functions";
import { generateArtistContent } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

type StepKey = "welcome" | "upload" | "questions" | "reward" | "done";
type Step = { key: StepKey; title: string; aria: string };

const STEPS: Step[] = [
  { key: "welcome", title: "Meet Aria", aria: "Hello — I'm Aria, your curator. Two things get you fully submitted: ten pieces of your work, and six short answers about your practice. About 15 minutes, and everything else is optional." },
  { key: "upload", title: "Upload your 10 pieces", aria: "Drag in ten works — image and title, that's all. I'll stage each one in a room right after it uploads so you can see it live." },
  { key: "questions", title: "Tell me about your art", aria: "Six quick questions, one at a time. Short honest answers work best — this is what I'll use to write your voice." },
  { key: "reward", title: "Your AI-drafted voice", aria: "Here's what I hear in your work — a first draft of your biography, statement, Instagram bio and more. Yours to keep." },
  { key: "done", title: "You're submitted", aria: "Beautiful. Your application is in front of our curators. While you wait, polish the optional details anytime from your profile." },
];

const REQUIRED_ARTWORKS = 10;

const QUESTIONS: { key: `q${1|2|3|4|5|6}`; label: string; hint: string; placeholder: string }[] = [
  { key: "q1", label: "What draws you to make art?",       hint: "The pull, the reason, the itch you can't ignore.", placeholder: "I make art because…" },
  { key: "q2", label: "What themes or subjects recur in your work?", hint: "The ideas or images that keep coming back.", placeholder: "I keep returning to…" },
  { key: "q3", label: "Your materials and process?",       hint: "What you use, and how a piece typically comes together.", placeholder: "I work primarily in… I usually begin by…" },
  { key: "q4", label: "What makes your work distinct?",    hint: "What a collector wouldn't find in anyone else's practice.", placeholder: "My work is different because…" },
  { key: "q5", label: "What feeling should viewers take away?", hint: "The emotional residue you're aiming for.", placeholder: "I want viewers to feel…" },
  { key: "q6", label: "Where do you want the work to go next?", hint: "Directions, ambitions, or open questions.", placeholder: "Next, I want to explore…" },
];

type Pending = { id: string; file: File; title: string; previewUrl: string; uploading?: boolean; done?: boolean; error?: string; artworkId?: string; mockupUrl?: string | null; mockupLoading?: boolean };

function Onboarding() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<StepKey>("welcome");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [existingCount, setExistingCount] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({ q1:"",q2:"",q3:"",q4:"",q5:"",q6:"" });
  const [qIdx, setQIdx] = useState(0);
  const mockupFn = useServerFn(generateArtworkMockup);
  const generate = useServerFn(generateArtistContent);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);

      const [{ count }, { data: q }] = await Promise.all([
        supabase.from("artworks").select("id", { count: "exact", head: true }).eq("user_id", u.user.id),
        supabase.from("questionnaires").select("*").eq("user_id", u.user.id).maybeSingle(),
      ]);
      setExistingCount(count ?? 0);
      if (q) {
        setAnswers({
          q1: (q as any).q1 ?? "", q2: (q as any).q2 ?? "", q3: (q as any).q3 ?? "",
          q4: (q as any).q4 ?? "", q5: (q as any).q5 ?? "", q6: (q as any).q6 ?? "",
        });
      }
    })();
  }, []);

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const s = STEPS[stepIdx];
  const totalUploaded = existingCount + pending.filter((p) => p.done).length;
  const remainingArtworks = Math.max(0, REQUIRED_ARTWORKS - totalUploaded);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const room = REQUIRED_ARTWORKS + 5 - (existingCount + pending.length); // small overflow allowed
    if (room <= 0) { toast.error(`You already have ${existingCount + pending.length} pieces staged.`); return; }
    const next = arr.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      file,
      title: file.name.replace(/\.[^.]+$/, "").slice(0, 60),
      previewUrl: URL.createObjectURL(file),
    }));
    setPending((p) => [...p, ...next]);
  }

  async function uploadOne(item: Pending) {
    if (!userId) return;
    setPending((p) => p.map((x) => x.id === item.id ? { ...x, uploading: true, error: undefined } : x));
    try {
      const path = await uploadImage("artworks", userId, item.file);
      const { data: inserted, error } = await supabase.from("artworks").insert({
        user_id: userId,
        image_path: path,
        title: item.title.trim() || "Untitled",
      }).select("id").single();
      if (error) throw error;
      const artworkId = inserted?.id as string;
      setPending((p) => p.map((x) => x.id === item.id ? { ...x, uploading: false, done: true, artworkId, mockupLoading: true } : x));

      // Fire-and-forget mockup generation for instant staged preview
      (async () => {
        try {
          const res = await mockupFn({ data: { artworkId } });
          const url = res?.mockup_path ? await signedUrl("artworks", res.mockup_path) : null;
          setPending((p) => p.map((x) => x.id === item.id ? { ...x, mockupLoading: false, mockupUrl: url } : x));
        } catch {
          setPending((p) => p.map((x) => x.id === item.id ? { ...x, mockupLoading: false, mockupUrl: null } : x));
        }
      })();
    } catch (e) {
      setPending((p) => p.map((x) => x.id === item.id ? { ...x, uploading: false, error: e instanceof Error ? e.message : "Failed" } : x));
    }
  }

  async function uploadAll() {
    const todo = pending.filter((p) => !p.done && !p.uploading);
    for (const item of todo) {
      // sequential to keep server load reasonable
      // eslint-disable-next-line no-await-in-loop
      await uploadOne(item);
    }
  }

  function goUploadNext() {
    if (totalUploaded < REQUIRED_ARTWORKS) {
      toast.error(`Upload ${REQUIRED_ARTWORKS - totalUploaded} more piece${REQUIRED_ARTWORKS - totalUploaded === 1 ? "" : "s"} to continue.`);
      return;
    }
    setStep("questions");
  }

  async function saveAnswer(next: boolean) {
    if (!userId) return;
    const cur = QUESTIONS[qIdx];
    if (!(answers[cur.key] ?? "").trim()) { toast.error("Aria needs a short answer to move on."); return; }
    setBusy(true);
    const payload: Record<string, any> = { user_id: userId, updated_at: new Date().toISOString() };
    for (const k of Object.keys(answers)) payload[k] = answers[k];
    const { error } = await supabase.from("questionnaires").upsert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (next) {
      if (qIdx < QUESTIONS.length - 1) setQIdx(qIdx + 1);
      else setStep("reward");
    }
  }

  return (
    <div className="relative mx-auto min-h-[70vh] max-w-3xl">
      <div className="mb-10 flex items-center gap-2">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition ${i <= stepIdx ? "bg-bronze" : "bg-border"}`} />
        ))}
      </div>

      <div className="flex items-start gap-5 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="relative shrink-0">
          <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-bronze via-[#c9a06b] to-[#8b6944] text-primary-foreground">
            <Palette className="size-7" />
          </div>
          <span className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-card bg-emerald-500" />
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <p className="font-serif text-xl">Aria</p>
            <span className="text-[10px] uppercase tracking-[0.25em] text-bronze">your curator</span>
          </div>
          <p className="mt-2 font-serif text-lg italic leading-relaxed text-muted-foreground">"{s.aria}"</p>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-border bg-card p-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Step {stepIdx + 1} of {STEPS.length}</p>
        <h1 className="mt-2 font-serif text-4xl">{s.title}</h1>

        <div className="mt-8 space-y-4">
          {s.key === "welcome" && (
            <div className="space-y-4">
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "Upload 10 pieces (image + title, ~5 minutes)",
                  "Answer 6 short questions about your practice (~10 minutes)",
                  "Get your AI-drafted bio & statement instantly",
                  "Everything else — CV, location, medium, Instagram — is optional and can wait",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-bronze" /> <span>{t}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Approval, publishing, PDF & website unlock after our curators review your submission.</p>
            </div>
          )}

          {s.key === "upload" && (
            <UploadStep
              pending={pending}
              existingCount={existingCount}
              required={REQUIRED_ARTWORKS}
              onAdd={addFiles}
              onRemove={(id) => setPending((p) => p.filter((x) => x.id !== id))}
              onTitle={(id, t) => setPending((p) => p.map((x) => x.id === id ? { ...x, title: t } : x))}
            />
          )}

          {s.key === "questions" && (
            <QuestionsStep
              index={qIdx}
              total={QUESTIONS.length}
              current={QUESTIONS[qIdx]}
              value={answers[QUESTIONS[qIdx].key] ?? ""}
              onChange={(v) => setAnswers((a) => ({ ...a, [QUESTIONS[qIdx].key]: v }))}
              onPrev={() => setQIdx(Math.max(0, qIdx - 1))}
            />
          )}

          {s.key === "reward" && (
            <RewardStep runGenerate={async () => { await generate({ data: {} }); }} userId={userId} />
          )}

          {s.key === "done" && (
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-6 text-center">
              <p className="font-serif text-2xl">You're submitted.</p>
              <p className="mt-2 text-sm text-muted-foreground">Aria and our curators will review your application — typically within 48 hours. In the meantime, polish the optional details from your profile whenever you like.</p>
            </div>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={() => {
              if (s.key === "questions" && qIdx > 0) { setQIdx(qIdx - 1); return; }
              const prev = STEPS[Math.max(0, stepIdx - 1)];
              setStep(prev.key);
            }}
            disabled={stepIdx === 0 || busy}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground disabled:opacity-40 hover:bg-secondary"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
          <PrimaryButton
            step={s.key}
            busy={busy}
            pendingReady={pending.filter((p) => !p.done && !p.uploading).length}
            remainingArtworks={remainingArtworks}
            qIdx={qIdx}
            qTotal={QUESTIONS.length}
            onWelcome={() => setStep("upload")}
            onUploadStage={() => uploadAll()}
            onUploadContinue={() => goUploadNext()}
            onSaveAnswer={() => saveAnswer(true)}
            onRewardNext={() => setStep("done")}
            onDone={() => router.navigate({ to: "/dashboard" })}
          />
        </div>
      </div>

      <div className="mt-6 text-center">
        <button onClick={() => router.navigate({ to: "/dashboard" })} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          Skip to dashboard
        </button>
      </div>
    </div>
  );
}

function PrimaryButton(props: {
  step: StepKey; busy: boolean; pendingReady: number; remainingArtworks: number; qIdx: number; qTotal: number;
  onWelcome: () => void; onUploadStage: () => void; onUploadContinue: () => void; onSaveAnswer: () => void; onRewardNext: () => void; onDone: () => void;
}) {
  const { step, busy, pendingReady, remainingArtworks, qIdx, qTotal } = props;
  const cls = "group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-60";
  if (step === "welcome") return <button className={cls} onClick={props.onWelcome}>Let's begin <ArrowRight className="size-4" /></button>;
  if (step === "upload") {
    if (pendingReady > 0) return <button className={cls} onClick={props.onUploadStage}>Upload {pendingReady} staged <ArrowRight className="size-4" /></button>;
    return <button className={cls} disabled={remainingArtworks > 0} onClick={props.onUploadContinue}>{remainingArtworks > 0 ? `Add ${remainingArtworks} more` : "Continue to questions"} <ArrowRight className="size-4" /></button>;
  }
  if (step === "questions") {
    const last = qIdx === qTotal - 1;
    return <button className={cls} disabled={busy} onClick={props.onSaveAnswer}>{busy ? "Saving…" : last ? "Finish & see AI draft" : `Next question (${qIdx + 2}/${qTotal})`} <ArrowRight className="size-4" /></button>;
  }
  if (step === "reward") return <button className={cls} onClick={props.onRewardNext}>Continue <ArrowRight className="size-4" /></button>;
  return <button className={cls} onClick={props.onDone}>Enter your studio <ArrowRight className="size-4" /></button>;
}

function UploadStep({ pending, existingCount, required, onAdd, onRemove, onTitle }: {
  pending: Pending[]; existingCount: number; required: number;
  onAdd: (f: FileList | File[]) => void; onRemove: (id: string) => void; onTitle: (id: string, t: string) => void;
}) {
  const [drag, setDrag] = useState(false);
  const uploaded = pending.filter((p) => p.done).length + existingCount;
  const remaining = Math.max(0, required - uploaded);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm">
        <span><strong className="font-medium text-foreground">{uploaded}</strong> / {required} uploaded</span>
        <span className="text-xs text-muted-foreground">{remaining > 0 ? `${remaining} more required` : "You're done — continue when ready"}</span>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) onAdd(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${drag ? "border-bronze bg-bronze/5" : "border-border hover:border-bronze/60"}`}
      >
        <Upload className="mb-3 size-8 text-bronze" />
        <p className="font-serif text-lg">Drag your images in, or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">JPG or PNG · exactly {required} pieces required · title only, everything else can wait</p>
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) onAdd(e.target.files); e.target.value = ""; }} />
      </label>

      {pending.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {pending.map((p) => (
            <div key={p.id} className={`relative flex flex-col gap-3 rounded-xl border p-3 ${p.error ? "border-destructive/60" : "border-border"} bg-background/60`}>
              <div className="flex gap-3">
                <img src={p.previewUrl} alt="" className="size-20 shrink-0 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <input
                    value={p.title}
                    onChange={(e) => onTitle(p.id, e.target.value)}
                    placeholder="Title"
                    disabled={p.done}
                    className="w-full border-b border-transparent bg-transparent text-sm focus:border-bronze focus:outline-none disabled:opacity-70"
                  />
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{p.file.name}</p>
                  {p.uploading && <p className="mt-1 flex items-center gap-1 text-[11px] text-bronze"><Loader2 className="size-3 animate-spin" /> Uploading…</p>}
                  {p.done && !p.mockupLoading && !p.mockupUrl && <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400"><Check className="size-3" /> Uploaded</p>}
                  {p.mockupLoading && <p className="mt-1 flex items-center gap-1 text-[11px] text-bronze"><Loader2 className="size-3 animate-spin" /> Staging in a room…</p>}
                  {p.error && <p className="mt-1 text-[11px] text-destructive">{p.error}</p>}
                </div>
                {!p.done && (
                  <button onClick={() => onRemove(p.id)} className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-secondary">
                    <X className="size-3" />
                  </button>
                )}
              </div>
              {p.mockupUrl && (
                <div className="overflow-hidden rounded-lg border border-border">
                  <img src={p.mockupUrl} alt="Staged in a room" className="h-40 w-full object-cover" />
                  <p className="border-t border-border bg-background/60 px-2 py-1 text-[10px] uppercase tracking-widest text-bronze">Staged preview</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {pending.length === 0 && existingCount === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
          <ImageIcon className="size-4 text-bronze" /> Drop {required} pieces to complete this step.
        </div>
      )}
    </div>
  );
}

function QuestionsStep({ index, total, current, value, onChange, onPrev }: {
  index: number; total: number; current: { key: string; label: string; hint: string; placeholder: string };
  value: string; onChange: (v: string) => void; onPrev: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-bronze">
        <span>Question {index + 1} of {total}</span>
        {index > 0 && <button onClick={onPrev} className="text-muted-foreground hover:text-foreground">← previous question</button>}
      </div>
      <label className="block">
        <span className="font-serif text-2xl">{current.label}</span>
        <p className="mt-1 text-sm text-muted-foreground">{current.hint}</p>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder={current.placeholder}
          className="mt-4 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed focus:border-bronze focus:outline-none"
        />
        <p className="mt-2 text-[11px] text-muted-foreground">Two to four sentences is plenty. You can always refine this later.</p>
      </label>
    </div>
  );
}

function RewardStep({ runGenerate, userId }: { runGenerate: () => Promise<void>; userId: string | null }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [content, setContent] = useState<{ artist_statement: string | null; short_statement: string | null; biography: string | null; instagram_bio: string | null; homepage_copy: string | null; elevator_pitch: string | null } | null>(null);

  const started = useMemo(() => ({ started: false }), []);
  useEffect(() => {
    if (!userId || started.started) return;
    started.started = true;
    (async () => {
      setState("loading"); setError("");
      try {
        await runGenerate();
        const { data } = await supabase.from("ai_content").select("artist_statement,short_statement,biography,instagram_bio,homepage_copy,elevator_pitch").eq("user_id", userId).maybeSingle();
        setContent(data as any);
        setState("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setState("error");
      }
    })();
  }, [userId, runGenerate, started]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-5">
        <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300">Your reward</p>
        <p className="mt-2 font-serif text-2xl">A first draft of your artist voice — written from your own answers.</p>
        <p className="mt-2 text-sm text-muted-foreground">Edit anytime from AI Studio after approval. This draft is yours to keep either way.</p>
      </div>
      {state === "loading" && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-bronze" /> Aria is writing your bio, statement and more…
        </div>
      )}
      {state === "error" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error || "Something went wrong."}</div>
      )}
      {state === "ready" && content && (
        <div className="space-y-3">
          {content.short_statement && <RewardField label="Short statement" value={content.short_statement} />}
          {content.biography && <RewardField label="Biography" value={content.biography} />}
          {content.artist_statement && <RewardField label="Artist statement" value={content.artist_statement} />}
          {content.instagram_bio && <RewardField label="Instagram bio" value={content.instagram_bio} />}
          {content.homepage_copy && <RewardField label="Homepage line" value={content.homepage_copy} />}
          {content.elevator_pitch && <RewardField label="Elevator pitch" value={content.elevator_pitch} />}
        </div>
      )}
    </div>
  );
}

function RewardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.25em] text-bronze">{label}</p>
        <button
          onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
          className="text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >Copy</button>
      </div>
      <p className="mt-2 whitespace-pre-wrap font-serif text-base leading-relaxed">{value}</p>
    </div>
  );
}

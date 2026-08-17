import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateArtistContent } from "@/lib/ai.functions";
import { interviewForStatement } from "@/lib/statement-interview.functions";
import { Sparkles, Send, MessageCircle, Lock } from "lucide-react";
import { loadEntitlements, type Entitlements } from "@/lib/entitlements";
import { PricingModal } from "@/components/PricingModal";

export const Route = createFileRoute("/_authenticated/studio")({
  component: StudioPage,
});


const QUESTIONS = [
  "Why do you create?",
  "What inspires your work?",
  "What emotions should viewers experience?",
  "Describe your artistic journey.",
  "What themes repeat in your work?",
  "What materials do you use?",
  "Who inspires you?",
  "What makes your work unique?",
  "What impact do you hope to create?",
  "What are your future goals?",
];

type Q = Record<`q${1|2|3|4|5|6|7|8|9|10}`, string>;
type AIC = {
  artist_statement: string | null; short_statement: string | null; biography: string | null;
  instagram_bio: string | null; homepage_copy: string | null; collection_description: string | null;
  seo_description: string | null; elevator_pitch: string | null;
};

const emptyQ: Q = { q1:"",q2:"",q3:"",q4:"",q5:"",q6:"",q7:"",q8:"",q9:"",q10:"" };
const emptyAIC: AIC = { artist_statement:"", short_statement:"", biography:"", instagram_bio:"", homepage_copy:"", collection_description:"", seo_description:"", elevator_pitch:"" };

function StudioPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [q, setQ] = useState<Q>(emptyQ);
  const [aic, setAic] = useState<AIC>(emptyAIC);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const generate = useServerFn(generateArtistContent);

  useEffect(() => { (async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUid(u.user.id);
    const [{ data: qd }, { data: ad }] = await Promise.all([
      supabase.from("questionnaires").select("*").eq("user_id", u.user.id).maybeSingle(),
      supabase.from("ai_content").select("*").eq("user_id", u.user.id).maybeSingle(),
    ]);
    if (qd) setQ({ ...emptyQ, ...Object.fromEntries(Object.entries(qd).filter(([k]) => k.startsWith("q"))) } as Q);
    if (ad) setAic({ ...emptyAIC, ...ad });
    setEnt(await loadEntitlements(u.user.id));
  })(); }, []);

  async function saveQ() {
    if (!uid) return;
    setSaving(true);
    const { error } = await supabase.from("questionnaires").upsert({ user_id: uid, ...q });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Answers saved.");
  }
  async function saveAIC() {
    if (!uid) return;
    setSaving(true);
    const { error } = await supabase.from("ai_content").upsert({ user_id: uid, ...aic });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Content saved.");
  }
  async function runGenerate() {
    if (!uid) return;
    if (!ent?.canUseStudio) { setShowPricing(true); return; }
    await supabase.from("questionnaires").upsert({ user_id: uid, ...q });
    setGenerating(true);
    try {
      await generate({ data: {} });
      const { data: ad } = await supabase.from("ai_content").select("*").eq("user_id", uid).maybeSingle();
      if (ad) setAic({ ...emptyAIC, ...ad });
      toast.success("Identity generated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally { setGenerating(false); }
  }

  return (
    <div className="space-y-10">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">AI Studio</p>
        <h1 className="mt-2 font-serif text-4xl">Your voice, refined.</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Talk with Aria to shape your artist statement, then generate the rest of your identity. Generation unlocks after your application is approved.</p>
      </header>

      {ent && !ent.canUseStudio && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/5 p-5 text-sm flex items-start gap-3">
          <Lock className="mt-0.5 size-4 text-amber-300" />
          <div>
            <p className="font-medium text-amber-200">Available after approval</p>
            <p className="mt-1 text-muted-foreground">You can practice the interview and questionnaire below. AI generation activates when Aria's curators approve your application.</p>
          </div>
        </div>
      )}

      <StatementInterview onStatement={(s) => setAic((a) => ({ ...a, artist_statement: s }))} />



      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-serif text-2xl">Questionnaire</h2>
        {QUESTIONS.map((text, i) => {
          const key = `q${i+1}` as keyof Q;
          return (
            <label key={key} className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{`${i+1}. ${text}`}</span>
              <textarea rows={3} value={q[key]} onChange={(e) => setQ({ ...q, [key]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
            </label>
          );
        })}
        <div className="flex flex-wrap gap-3">
          <button onClick={saveQ} disabled={saving} className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest hover:bg-secondary">Save answers</button>
          <button onClick={runGenerate} disabled={generating} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
            <Sparkles className="size-4" /> {generating ? "Generating…" : "Generate identity"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-serif text-2xl">Generated content</h2>
        <p className="text-xs text-muted-foreground">Edit any field freely — your changes save independently.</p>
        <TextArea label="Artist statement" rows={8} v={aic.artist_statement} set={(v) => setAic({ ...aic, artist_statement: v })} />
        <TextArea label="Short statement" rows={3} v={aic.short_statement} set={(v) => setAic({ ...aic, short_statement: v })} />
        <TextArea label="Biography" rows={6} v={aic.biography} set={(v) => setAic({ ...aic, biography: v })} />
        <TextArea label="Homepage headline" rows={2} v={aic.homepage_copy} set={(v) => setAic({ ...aic, homepage_copy: v })} />
        <TextArea label="Instagram bio" rows={2} v={aic.instagram_bio} set={(v) => setAic({ ...aic, instagram_bio: v })} />
        <TextArea label="Collection description" rows={4} v={aic.collection_description} set={(v) => setAic({ ...aic, collection_description: v })} />
        <TextArea label="Elevator pitch" rows={3} v={aic.elevator_pitch} set={(v) => setAic({ ...aic, elevator_pitch: v })} />
        <TextArea label="SEO meta description" rows={2} v={aic.seo_description} set={(v) => setAic({ ...aic, seo_description: v })} />
        <div className="flex justify-end">
          <button onClick={saveAIC} disabled={saving} className="rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-widest text-primary-foreground">Save content</button>
        </div>
      </section>

      <PricingModal open={showPricing} intent="studio" onClose={() => setShowPricing(false)} returnTo="/studio" />
    </div>
  );
}

type ChatMsg = { role: "user" | "assistant"; content: string };

function StatementInterview({ onStatement }: { onStatement: (s: string) => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "I'm here to help shape your artist statement. Let's start simply — what do you make, and what draws you back to it every time you work?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [statement, setStatement] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = useServerFn(interviewForStatement);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(finalize = false) {
    const text = input.trim();
    if ((!text && !finalize) || busy) return;
    const next: ChatMsg[] = text ? [...messages, { role: "user", content: text }] : messages;
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chat({ data: { messages: next, finalize } });
      if (res.kind === "statement") {
        setStatement(res.statement);
        onStatement(res.statement);
        setMessages([...next, { role: "assistant", content: "Here's your statement — I've saved it to your identity. You can edit it below or ask for a revision." }]);
        toast.success("Artist statement generated.");
      } else {
        setMessages([...next, { role: "assistant", content: res.reply }]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aria couldn't respond.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-5 text-bronze" />
        <h2 className="font-serif text-2xl">Interview with Aria</h2>
      </div>
      <p className="text-xs text-muted-foreground">A short conversation, one question at a time. When you're ready, ask her to write your statement.</p>
      <div ref={scrollRef} className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-background/40 p-4 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user"
              ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary/90 px-3 py-2 text-primary-foreground"
              : "max-w-[85%] rounded-2xl rounded-bl-sm border border-border/60 bg-card px-3 py-2"}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="text-xs italic text-muted-foreground">Aria is thinking…</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(false); }} className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your answer…"
          className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button type="submit" disabled={busy || !input.trim()} className="inline-flex size-9 items-center justify-center rounded-full btn-neon disabled:opacity-50" aria-label="Send">
          <Send className="size-4" />
        </button>
        <button type="button" onClick={() => void send(true)} disabled={busy || messages.length < 3}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
          <Sparkles className="size-4" /> Write statement
        </button>
      </form>
      {statement && (
        <div className="rounded-lg border border-bronze/40 bg-background/60 p-4">
          <p className="text-[11px] uppercase tracking-widest text-bronze">Final statement</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{statement}</p>
        </div>
      )}
    </section>
  );
}


function TextArea({ label, v, set, rows = 4 }: { label: string; v: string | null; set: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <textarea rows={rows} value={v ?? ""} onChange={(e) => set(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
    </label>
  );
}

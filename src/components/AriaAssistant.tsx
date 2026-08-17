import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { chatWithAria } from "@/lib/aria-chat.functions";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content:
    "I'm Aria, your curator. I'll guide you through each step — from uploading your work to publishing your website. What can I help you shape next?",
};

export function AriaAssistant() {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = useServerFn(chatWithAria);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (!authed) return null;

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await chat({ data: { messages: next.slice(-10) } });
      setMessages([...next, { role: "assistant", content: res.reply || "…" }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages([...next, { role: "assistant", content: msg }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full btn-neon px-4 py-3 text-sm pulse-glow"
          aria-label="Open Aria"
        >
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">Ask Aria</span>
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 flex h-[520px] w-[min(380px,calc(100vw-2rem))] flex-col rounded-2xl glass overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex size-8 items-center justify-center rounded-full btn-neon">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Aria</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Your curator</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary/90 px-3 py-2 text-primary-foreground"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm border border-border/60 bg-background/40 px-3 py-2"
                }>{m.content}</div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-border/60 bg-background/40 px-3 py-2 text-muted-foreground">
                  <span className="inline-block animate-pulse">Aria is thinking…</span>
                </div>
              </div>
            )}
          </div>
          <form onSubmit={send} className="flex items-center gap-2 border-t border-border/60 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Aria what's next…"
              className="flex-1 rounded-full border border-input bg-background/60 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="submit" disabled={sending || !input.trim()} className="inline-flex size-9 items-center justify-center rounded-full btn-neon disabled:opacity-50">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export { MessageCircle };

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/inquiries")({
  component: InquiriesPage,
});

type Inquiry = {
  id: string; name: string; email: string; phone: string | null;
  budget: string | null; message: string; status: string; created_at: string;
};

function InquiriesPage() {
  const [items, setItems] = useState<Inquiry[]>([]);
  useEffect(() => { (async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("inquiries").select("*").eq("artist_id", u.user.id).order("created_at", { ascending: false });
    setItems((data ?? []) as Inquiry[]);
  })(); }, []);

  async function markRead(id: string) {
    await supabase.from("inquiries").update({ status: "read" }).eq("id", id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "read" } : i));
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Correspondence</p>
        <h1 className="mt-2 font-serif text-4xl">My Inquiries</h1>
      </header>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center text-muted-foreground">
          No inquiries yet. Publish your website to start receiving messages.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.id} className={`rounded-2xl border p-6 ${i.status === "new" ? "border-bronze bg-card" : "border-border bg-card"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-serif text-xl">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.email}{i.phone ? ` · ${i.phone}` : ""}{i.budget ? ` · Budget ${i.budget}` : ""}</p>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{i.message}</p>
              <div className="mt-4 flex gap-2">
                <a href={`mailto:${i.email}`} className="rounded-full bg-primary px-4 py-1 text-xs uppercase tracking-widest text-primary-foreground">Reply</a>
                {i.status === "new" && <button onClick={() => markRead(i.id)} className="rounded-full border border-border px-4 py-1 text-xs uppercase tracking-widest">Mark read</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

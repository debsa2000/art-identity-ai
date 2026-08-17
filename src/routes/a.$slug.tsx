import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { signedUrl } from "@/lib/storage";
import { logEvent } from "@/lib/analytics";
import { useSignedUrl } from "@/lib/use-signed-url";
import { toast } from "sonner";
import { Instagram, Globe, Mail, Phone, Download } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/a/$slug")({
  loader: async ({ params }) => {
    const { data: profile } = await supabase.from("public_profiles").select("*").eq("slug", params.slug).maybeSingle();
    if (!profile || !profile.id) throw notFound();
    const [{ data: aic }, { data: artworks }] = await Promise.all([
      supabase.from("ai_content").select("*").eq("user_id", profile.id).eq("is_public", true).maybeSingle(),
      supabase.from("artworks").select("*").eq("user_id", profile.id).order("created_at"),
    ]);
    return { profile, aic, artworks: artworks ?? [] };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.profile) return { meta: [{ title: "Artist not found" }, { name: "robots", content: "noindex" }] };
    const p = loaderData.profile;
    const desc = loaderData.aic?.seo_description ?? loaderData.aic?.short_statement ?? `Discover work by ${p.artist_name}.`;
    return {
      meta: [
        { title: `${p.artist_name ?? "Artist"} — Art Identity` },
        { name: "description", content: desc },
        { property: "og:title", content: p.artist_name ?? "Artist" },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ArtistSite,
  notFoundComponent: () => <div className="container-x py-24 text-center"><h1 className="font-serif text-5xl">Artist not found</h1></div>,
  errorComponent: ({ error }) => <div className="container-x py-24 text-center"><p className="text-destructive">{error.message}</p></div>,
});

function ArtistSite() {
  const { profile, aic, artworks } = Route.useLoaderData();
  const avatar = useSignedUrl("avatars", profile.avatar_path);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => { logEvent(profile.id, "site_view"); }, [profile.id]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    QRCode.toDataURL(window.location.href, { margin: 1, width: 320 }).then(setQr);
  }, []);

  return (
    <main className="pb-24">
      {/* Hero */}
      <section className="container-x pt-16 pb-20">
        <div className="grid gap-10 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="mx-auto size-56 overflow-hidden rounded-full border border-border bg-secondary md:mx-0">
            {avatar && <img src={avatar} alt={profile.artist_name ?? ""} className="size-full object-cover" />}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">{[profile.city, profile.country].filter(Boolean).join(" · ")}</p>
            <h1 className="mt-3 font-serif text-6xl leading-tight">{profile.artist_name}</h1>
            {aic?.homepage_copy && <p className="mt-6 max-w-2xl font-serif text-2xl italic text-muted-foreground">{aic.homepage_copy}</p>}
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              {profile.instagram && <a href={`https://instagram.com/${profile.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 bronze-link"><Instagram className="size-4" /> {profile.instagram}</a>}
              {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 bronze-link"><Globe className="size-4" /> Website</a>}
              {/* Email/phone intentionally hidden from public — collectors reach the artist via the inquiry form below. */}
            </div>
            <div className="mt-8 flex gap-3">
              <a href="#inquiry" className="rounded-full bg-primary px-6 py-3 text-xs uppercase tracking-widest text-primary-foreground">Send inquiry</a>
              <Link to="/directory" className="rounded-full border border-border px-6 py-3 text-xs uppercase tracking-widest hover:bg-secondary">
                <Download className="mr-2 inline size-3" /> More artists
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Biography + Statement */}
      {(aic?.biography || aic?.artist_statement) && (
        <section className="container-x hairline pt-16 grid gap-12 md:grid-cols-2">
          {aic?.biography && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Biography</p>
              <p className="mt-4 whitespace-pre-wrap font-serif text-lg leading-relaxed">{aic.biography}</p>
            </div>
          )}
          {aic?.artist_statement && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Artist Statement</p>
              <p className="mt-4 whitespace-pre-wrap font-serif text-lg leading-relaxed">{aic.artist_statement}</p>
            </div>
          )}
        </section>
      )}

      {/* Curriculum Vitae */}
      {profile.cv && Object.values(profile.cv).some((arr: any) => Array.isArray(arr) && arr.length > 0) && (
        <section className="container-x hairline mt-16 pt-16">
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Curriculum Vitae</p>
          <div className="mt-6 grid gap-10 md:grid-cols-2">
            {(["education","exhibitions","awards","residencies","press"] as const).map((k) => {
              const entries = (profile.cv?.[k] ?? []) as { year: string; title: string; detail: string }[];
              if (!entries.length) return null;
              return (
                <div key={k}>
                  <h3 className="font-serif text-xl capitalize">{k === "press" ? "Press & Publications" : k}</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {entries.map((e, i) => (
                      <li key={i} className="grid grid-cols-[60px_minmax(0,1fr)] gap-3">
                        <span className="text-muted-foreground">{e.year}</span>
                        <span><span className="font-medium">{e.title}</span>{e.detail ? <span className="text-muted-foreground"> — {e.detail}</span> : null}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Artworks */}
      <section className="container-x hairline mt-16 pt-16">
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Selected Works</p>
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {artworks.map((a: any) => <PublicArt key={a.id} art={a} artistId={profile.id} />)}
        </div>
      </section>

      {/* Inquiry */}
      <section id="inquiry" className="container-x hairline mt-16 pt-16">
        <div className="mx-auto max-w-xl">
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Inquire</p>
          <h2 className="mt-3 font-serif text-4xl">Contact {profile.artist_name}</h2>
          <InquiryForm artistId={profile.id} />
        </div>
      </section>

      {/* QR */}
      {qr && (
        <section className="container-x mt-16 flex flex-col items-center gap-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Share</p>
          <img src={qr} alt="QR" className="size-40 rounded-xl border border-border bg-card p-2" />
        </section>
      )}
    </main>
  );
}

function PublicArt({ art, artistId }: { art: any; artistId: string }) {
  const url = useSignedUrl("artworks", art.image_path);
  useEffect(() => { logEvent(artistId, "artwork_view", art.id); }, [art.id, artistId]);
  return (
    <figure className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-xl bg-secondary">
        {url && <img src={url} alt={art.title} className="size-full object-cover transition duration-700 hover:scale-105" />}
      </div>
      <figcaption>
        <p className="font-serif text-lg">{art.title}</p>
        <p className="text-xs text-muted-foreground">{[art.medium, art.dimensions, art.year].filter(Boolean).join(" · ")}</p>
        {art.description && <p className="mt-1 text-sm text-muted-foreground">{art.description}</p>}
      </figcaption>
    </figure>
  );
}

function InquiryForm({ artistId }: { artistId: string }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", budget: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name || !f.email || !f.message) { toast.error("Please fill required fields."); return; }
    setSending(true);
    const { error } = await supabase.from("inquiries").insert({ artist_id: artistId, ...f });
    setSending(false);
    if (error) toast.error(error.message);
    else { setSent(true); setF({ name: "", email: "", phone: "", budget: "", message: "" }); }
  }

  if (sent) return <p className="mt-6 rounded-xl border border-bronze bg-secondary p-6 text-center">Your inquiry has been sent. Thank you.</p>;

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <input required placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <input required type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <input placeholder="Phone (optional)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <input placeholder="Budget (optional)" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <textarea required rows={5} placeholder="Your message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      <button type="submit" disabled={sending} className="w-full rounded-full bg-primary py-3 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
        {sending ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}

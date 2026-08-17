import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { approveBuyerNetworkApplicant, rejectBuyerNetworkApplicant } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useSignedUrl } from "@/lib/use-signed-url";
import {
  getAdminOverview, listArtistsForAdmin, getArtistDetailForAdmin, upsertSectionReview,
  setArtistFeatured, setArtworkModeration, listAdminNotifications, markNotificationRead,
  listAllArtworksForAdmin, exportArtistsCsv, listApplications, decideApplication,
} from "@/lib/admin.functions";
import {
  listUsersForAdmin, getUsersSummary, listEmailsForUser, sendAdminEmail,
  listAdminEmailTemplates, ADMIN_EMAIL_TEMPLATES,
} from "@/lib/admin-users.functions";
import { computeReadiness } from "@/lib/readiness.functions";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

type Tab = "overview" | "users" | "applications" | "directory" | "queue" | "artists" | "artworks" | "messages" | "notifications" | "stats";

function AdminPage() {
  const [role, setRole] = useState<{ isAdmin: boolean; isSuper: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("users");

  useEffect(() => { (async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setRole({ isAdmin: false, isSuper: false }); return; }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const set = new Set(((roles ?? []) as any[]).map((r) => r.role));
    setRole({ isAdmin: set.has("admin") || set.has("super_admin"), isSuper: set.has("super_admin") });
  })(); }, []);

  if (role === null) return <p className="text-muted-foreground">Loading…</p>;
  if (!role.isAdmin) return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center">
      <p className="font-serif text-2xl">Admin access required</p>
      <p className="mt-2 text-sm text-muted-foreground">Your email must be on the admin allowlist. Contact support to be added.</p>
    </div>
  );

  const tabs: [Tab, string][] = [
    ["users", "Users"],
    ["applications", "Applications"],
    ["messages", "Messages"],
    ["overview", "Overview"],
    ["directory", "Artist Directory"],
    ["queue", "Buyer Network Queue"],
    ["artworks", "Artworks"],
    ["notifications", "Notifications"],
    ["artists", "Legacy Artists"],
    ["stats", "Stats"],
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Administration</p>
          <h1 className="mt-2 font-serif text-4xl">Admin Dashboard</h1>
          <p className="mt-1 text-xs text-muted-foreground">Signed in as {role.isSuper ? "Super Admin" : "Admin"}</p>
        </div>
        {role.isSuper && <ExportButton />}
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2 text-xs uppercase tracking-widest transition ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >{label}</button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "messages" && <MessagesTab />}
      {tab === "applications" && <ApplicationsTab />}
      {tab === "overview" && <OverviewTab />}
      {tab === "directory" && <DirectoryTab isSuper={role.isSuper} />}
      {tab === "queue" && <QueueTab />}
      {tab === "artworks" && <ArtworksTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "artists" && <ArtistsTab />}
      {tab === "stats" && <StatsTab />}
    </div>
  );
}

// ================= Users tab (application-state directory) =================

function UsersTab() {
  const [bucket, setBucket] = useState<"all" | "not_started" | "in_progress" | "submitted" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<any | null>(null);

  async function load() {
    try {
      setRows(await listUsersForAdmin({ data: { bucket, search } }));
      setSummary(await getUsersSummary());
    } catch (e) { toast.error(e instanceof Error ? e.message : "Load failed"); }
  }
  useEffect(() => { load(); }, [bucket]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    if (!rows) return;
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  const buckets: [typeof bucket, string, number | undefined][] = [
    ["all", "All", summary?.total],
    ["not_started", "Not started", summary?.not_started],
    ["in_progress", "In progress", summary?.in_progress],
    ["submitted", "Submitted", summary?.submitted],
    ["approved", "Approved", summary?.approved],
    ["rejected", "Rejected", summary?.rejected],
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {buckets.map(([b, label, n]) => (
          <button key={b} onClick={() => setBucket(b)}
            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest ${bucket === b ? "border-bronze bg-bronze/10 text-bronze" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {label}{typeof n === "number" ? ` · ${n}` : ""}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input placeholder="Search name, email, slug…" value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          className="flex-1 min-w-[200px] rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <button onClick={load} className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-widest hover:bg-secondary">Search</button>
        {selected.size > 0 && (
          <button onClick={() => setComposerOpen(true)} className="rounded-full bg-bronze px-4 py-2 text-xs uppercase tracking-widest text-bronze-foreground">
            Email {selected.size} selected
          </button>
        )}
      </div>

      {rows === null ? <p className="text-muted-foreground">Loading…</p> : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">No users in this bucket.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3"><input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} /></th>
                <th className="p-3">Artist</th>
                <th className="p-3">Status</th>
                <th className="p-3">Completion</th>
                <th className="p-3">Joined</th>
                <th className="p-3">Last reminder</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="p-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td className="p-3">
                    <div>{r.artist_name || <span className="text-muted-foreground italic">(no name)</span>}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="p-3"><StatusBadge status={r.application_status} completion={r.completion_percent ?? 0} /></td>
                  <td className="p-3"><Bar v={r.completion_percent ?? 0} /></td>
                  <td className="p-3 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-xs">{r.last_reminder_sent_at ? `${new Date(r.last_reminder_sent_at).toLocaleDateString()} (${r.reminder_count})` : "—"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => { setSelected(new Set([r.id])); setComposerOpen(true); }} className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-widest hover:bg-secondary">Email</button>
                      <button onClick={() => setHistoryFor(r)} className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-widest hover:bg-secondary">History</button>
                      {r.slug && <Link to="/a/$slug" params={{ slug: r.slug }} className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-widest hover:bg-secondary">View →</Link>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {composerOpen && (
        <EmailComposer
          recipientIds={Array.from(selected)}
          recipients={rows?.filter((r) => selected.has(r.id)) ?? []}
          onClose={() => setComposerOpen(false)}
          onSent={() => { setComposerOpen(false); setSelected(new Set()); load(); }}
        />
      )}
      {historyFor && <EmailHistoryDrawer user={historyFor} onClose={() => setHistoryFor(null)} />}
    </section>
  );
}

function StatusBadge({ status, completion }: { status: string | null; completion: number }) {
  const s = status ?? "draft";
  let label = s;
  let color = "bg-secondary text-muted-foreground";
  if (s === "draft" && completion === 0) { label = "not started"; color = "bg-secondary text-muted-foreground"; }
  else if (s === "draft") { label = "in progress"; color = "bg-amber-500/20 text-amber-500"; }
  else if (s === "submitted") { label = "submitted"; color = "bg-blue-500/20 text-blue-400"; }
  else if (s === "approved") { label = "approved"; color = "bg-emerald-500/20 text-emerald-400"; }
  else if (s === "rejected") { label = "rejected"; color = "bg-destructive/20 text-destructive"; }
  return <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${color}`}>{label}</span>;
}

// ================= Email Composer =================

function EmailComposer({ recipientIds, recipients, onClose, onSent }: { recipientIds: string[]; recipients: any[]; onClose: () => void; onSent: () => void }) {
  const [templateKey, setTemplateKey] = useState<string>("complete_profile");
  const [subject, setSubject] = useState(ADMIN_EMAIL_TEMPLATES.complete_profile.subject);
  const [body, setBody] = useState(ADMIN_EMAIL_TEMPLATES.complete_profile.body);
  const [busy, setBusy] = useState(false);

  function applyTemplate(k: string) {
    setTemplateKey(k);
    const t = ADMIN_EMAIL_TEMPLATES[k];
    if (t) { setSubject(t.subject); setBody(t.body); }
  }

  function render(text: string, r: any): string {
    const ctx: Record<string, string> = {
      artist_name: r?.artist_name ?? "there",
      completion_percent: String(r?.completion_percent ?? 0),
      profile_url: "https://artist-essence-ai.lovable.app/dashboard",
      public_url: r?.slug ? `https://artist-essence-ai.lovable.app/a/${r.slug}` : "https://artist-essence-ai.lovable.app",
    };
    return text.replace(/\{\{(\w+)\}\}/g, (_m, k) => ctx[k] ?? "");
  }

  async function send() {
    if (!subject.trim() || !body.trim()) { toast.error("Subject and body required"); return; }
    setBusy(true);
    try {
      const res = await sendAdminEmail({ data: { recipientIds, subject, body, templateKey } });
      toast.success(`Sent to ${res.sent}/${res.total}${res.failed ? ` (${res.failed} failed — verify email domain is set up)` : ""}`);
      onSent();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Send failed"); }
    finally { setBusy(false); }
  }

  const preview = recipients[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Compose email</p>
          <button onClick={onClose} className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest hover:bg-secondary">Close</button>
        </div>

        <p className="text-xs text-muted-foreground">Sending to {recipients.length} recipient{recipients.length === 1 ? "" : "s"}: {recipients.slice(0, 3).map((r) => r.email).join(", ")}{recipients.length > 3 ? ` +${recipients.length - 3} more` : ""}</p>

        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Template</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(ADMIN_EMAIL_TEMPLATES).map(([k, t]) => (
              <button key={k} onClick={() => applyTemplate(k)}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest ${templateKey === k ? "border-bronze text-bronze" : "border-border text-muted-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </label>

        <label className="mt-4 block">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Body (supports {"{{artist_name}}"}, {"{{completion_percent}}"}, {"{{profile_url}}"}, {"{{public_url}}"})</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono" />
        </label>

        {preview && (
          <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Preview (for {preview.email})</p>
            <p className="mt-2 font-serif text-lg">{render(subject, preview)}</p>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{render(body, preview)}</pre>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-widest hover:bg-secondary">Cancel</button>
          <button onClick={send} disabled={busy} className="rounded-full bg-bronze px-5 py-2 text-xs uppercase tracking-widest text-bronze-foreground disabled:opacity-50">
            {busy ? "Sending…" : `Send to ${recipients.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailHistoryDrawer({ user, onClose }: { user: any; onClose: () => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    listEmailsForUser({ data: { recipientId: user.id } }).then(setRows).catch((e) => toast.error(e.message));
  }, [user.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Email history</p>
            <p className="mt-1 font-serif text-xl">{user.artist_name ?? user.email}</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest hover:bg-secondary">Close</button>
        </div>
        {rows === null ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No emails have been sent to this user yet.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-widest">{r.kind}{r.template_key ? ` · ${r.template_key}` : ""}</span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 font-medium">{r.subject}</p>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-foreground/80">{r.body}</pre>
                <p className={`mt-2 text-[10px] uppercase tracking-widest ${r.send_status === "sent" ? "text-emerald-400" : "text-destructive"}`}>
                  {r.send_status}{r.error_message ? ` · ${r.error_message}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ================= Messages tab (recent activity) =================

function MessagesTab() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("admin_email_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) toast.error(error.message); else setRows(data ?? []);
    })();
  }, []);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Email tooling</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the <strong>Users</strong> tab to select recipients and open the composer. Emails require an email domain to be configured in Cloud → Emails; without it, sends are logged as <em>failed</em>.
        </p>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Recent emails (last 200)</p>
        {rows === null ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No emails have been sent yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr><th className="p-3">When</th><th className="p-3">Kind</th><th className="p-3">To</th><th className="p-3">Subject</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="p-3 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-3 text-xs uppercase tracking-widest">{r.kind}</td>
                    <td className="p-3 text-xs">{r.recipient_email}</td>
                    <td className="p-3">{r.subject}</td>
                    <td className={`p-3 text-xs ${r.send_status === "sent" ? "text-emerald-400" : "text-destructive"}`}>{r.send_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// ================= Applications =================

function ApplicationsTab() {
  const [status, setStatus] = useState<"submitted" | "approved" | "rejected" | "all">("submitted");
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setRows(null);
    try { setRows(await listApplications({ data: { status } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
  }
  useEffect(() => { load(); }, [status]);

  async function decide(id: string, decision: "approved" | "rejected") {
    const notes = decision === "rejected" ? (prompt("Optional note to artist (why rejected):") ?? "") : "";
    setBusy(id);
    try {
      await decideApplication({ data: { artistId: id, decision, notes: notes || null } });
      toast.success(`Application ${decision}`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["submitted", "approved", "rejected", "all"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest ${status === s ? "border-bronze bg-bronze/10 text-bronze" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {s}
          </button>
        ))}
      </div>

      {rows === null ? <p className="text-muted-foreground">Loading…</p> : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">No applications in this bucket.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            const ig = (r.instagram ?? "").replace(/^@/, "").trim();
            const igUrl = ig ? `https://instagram.com/${ig}` : null;
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-serif text-xl">{r.artist_name ?? "(no name)"}</p>
                    <p className="text-xs text-muted-foreground">{[r.city, r.country].filter(Boolean).join(", ")} · {r.medium ?? "—"} · {r.years_creating ?? "?"} yrs</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.email}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      {igUrl && <a href={igUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-pink-400/40 bg-pink-500/10 px-3 py-1 text-pink-200 hover:bg-pink-500/20">Instagram @{ig} ↗</a>}
                      {r.website && <a href={r.website} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1 hover:bg-secondary">Website ↗</a>}
                      {r.slug && <Link to="/a/$slug" params={{ slug: r.slug }} className="rounded-full border border-border px-3 py-1 hover:bg-secondary">Preview site ↗</Link>}
                    </div>
                    {r.application_review_notes && <p className="mt-3 text-xs italic text-muted-foreground">Prior note: {r.application_review_notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Completion</p>
                    <p className="font-serif text-3xl">{r.completion_percent ?? 0}%</p>
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{r.application_status}</p>
                    {r.application_status !== "approved" && (
                      <button disabled={busy === r.id} onClick={() => decide(r.id, "approved")} className="mt-3 block w-full rounded-full bg-emerald-500 px-4 py-1.5 text-xs uppercase tracking-widest text-white disabled:opacity-50">Approve</button>
                    )}
                    {r.application_status !== "rejected" && (
                      <button disabled={busy === r.id} onClick={() => decide(r.id, "rejected")} className="mt-2 block w-full rounded-full border border-destructive/60 px-4 py-1.5 text-xs uppercase tracking-widest text-destructive hover:bg-destructive/10 disabled:opacity-50">Reject</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ================= Overview =================

function OverviewTab() {
  const [s, setS] = useState<Awaited<ReturnType<typeof getAdminOverview>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { getAdminOverview().then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">{err}</div>;
  if (!s) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Total artists" value={s.totalArtists} />
      <Stat label="New signups (7d)" value={s.newSignups7} />
      <Stat label="Active users (7d)" value={s.activeUsers7} />
      <Stat label="Avg readiness score" value={`${s.avgReadiness}/100`} />
      <Stat label="Buyer ready" value={s.buyerReady} />
      <Stat label="Pending review" value={s.pendingReview} />
      <Stat label="Featured artists" value={s.featured} />
      <Stat label="Publicly listed" value={s.publicListed} />
      <div className="rounded-2xl border border-border bg-card p-5 sm:col-span-2 lg:col-span-4">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Recently active</p>
        {s.recentActive.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No login activity yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {s.recentActive.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                <span className="truncate">{r.id.slice(0, 8)}…</span>
                <span className="text-xs text-muted-foreground">{new Date(r.last_login_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ExportButton() {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const { csv } = await exportArtistsCsv();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `artists-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Export failed"); }
    finally { setBusy(false); }
  }
  return (
    <button onClick={run} disabled={busy} className="rounded-full border border-bronze px-4 py-2 text-xs uppercase tracking-widest text-bronze hover:bg-bronze/5 disabled:opacity-50">
      {busy ? "Exporting…" : "Export CSV (Super)"}
    </button>
  );
}

// ================= Directory (admin) =================

type DirRow = Awaited<ReturnType<typeof listArtistsForAdmin>>[number];

function DirectoryTab({ isSuper }: { isSuper: boolean }) {
  const [rows, setRows] = useState<DirRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ country: "", medium: "", experience: "", minCompletion: 0, status: "", buyerReady: false, recent: false });
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    try { setRows(await listArtistsForAdmin()); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (rows ?? []).filter((r) => {
    if (q) {
      const s = q.toLowerCase();
      if (![r.artist_name, r.email, r.slug, r.country, r.medium].some((v) => v?.toLowerCase().includes(s))) return false;
    }
    if (f.country && !r.country?.toLowerCase().includes(f.country.toLowerCase())) return false;
    if (f.medium && !r.medium?.toLowerCase().includes(f.medium.toLowerCase())) return false;
    if (f.experience) {
      const yr = r.years_creating ?? 0;
      if (f.experience === "0-2" && !(yr <= 2)) return false;
      if (f.experience === "3-5" && !(yr >= 3 && yr <= 5)) return false;
      if (f.experience === "6-10" && !(yr >= 6 && yr <= 10)) return false;
      if (f.experience === "10+" && !(yr > 10)) return false;
    }
    if (f.minCompletion && r.completion < f.minCompletion) return false;
    if (f.status && r.buyer_network_status !== f.status) return false;
    if (f.buyerReady && !r.buyer_ready) return false;
    if (f.recent) {
      const d = new Date(r.created_at).getTime();
      if (Date.now() - d > 30 * 86_400_000) return false;
    }
    return true;
  }), [rows, q, f]);

  if (err) return <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">{err}</div>;
  if (rows === null) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading directory…</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <input placeholder="Search name, email, country…" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-full border border-input bg-background px-4 py-2 text-sm md:col-span-2" />
        <input placeholder="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} className="rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <input placeholder="Medium" value={f.medium} onChange={(e) => setF({ ...f, medium: e.target.value })} className="rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <select value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value })} className="rounded-full border border-input bg-background px-4 py-2 text-sm">
          <option value="">Any experience</option>
          <option value="0-2">0–2 years</option>
          <option value="3-5">3–5 years</option>
          <option value="6-10">6–10 years</option>
          <option value="10+">10+ years</option>
        </select>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="rounded-full border border-input bg-background px-4 py-2 text-sm">
          <option value="">Any review status</option>
          <option value="not_applied">Not applied</option>
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <label className="flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm">
          Min completion
          <input type="number" min={0} max={100} value={f.minCompletion} onChange={(e) => setF({ ...f, minCompletion: Number(e.target.value) })} className="w-16 bg-transparent" />
          %
        </label>
        <label className="flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm"><input type="checkbox" checked={f.buyerReady} onChange={(e) => setF({ ...f, buyerReady: e.target.checked })} /> Buyer ready</label>
        <label className="flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm"><input type="checkbox" checked={f.recent} onChange={(e) => setF({ ...f, recent: e.target.checked })} /> Recently joined (30d)</label>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} of {rows.length} artists</p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-3">Artist</th><th className="p-3">Country</th><th className="p-3">Medium</th>
              <th className="p-3">Joined</th><th className="p-3">Last login</th>
              <th className="p-3">Completion</th><th className="p-3">Readiness</th>
              <th className="p-3">Buyer</th><th className="p-3">Review</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/40" onClick={() => setSelected(r.id)}>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <AvatarThumb path={r.avatar_path} />
                    <div>
                      <div>{r.artist_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">{r.country || "—"}</td>
                <td className="p-3">{r.medium || "—"}</td>
                <td className="p-3 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-3 text-xs">{r.last_login_at ? new Date(r.last_login_at).toLocaleDateString() : "—"}</td>
                <td className="p-3"><Bar v={r.completion} /></td>
                <td className="p-3 text-xs">{r.readiness_score ?? "—"}{r.readiness_level ? ` · ${r.readiness_level}` : ""}</td>
                <td className="p-3">{r.buyer_ready ? <span className="rounded-full bg-bronze px-2 py-1 text-[10px] uppercase text-bronze-foreground">Ready</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                <td className="p-3"><span className="rounded-full bg-secondary px-2 py-1 text-[10px] uppercase tracking-widest">{r.buyer_network_status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <ArtistDetailDrawer artistId={selected} isSuper={isSuper} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function AvatarThumb({ path }: { path: string | null }) {
  const url = useSignedUrl("avatars", path);
  return <div className="size-8 shrink-0 overflow-hidden rounded-full bg-secondary">{url && <img src={url} alt="" className="size-full object-cover" />}</div>;
}

function Bar({ v }: { v: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-bronze" style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{v}%</span>
    </div>
  );
}

// ================= Artist Detail Drawer =================

const REVIEW_SECTIONS = [
  "artist_statement", "biography", "portfolio", "website", "artwork_pricing",
  "collections", "certificates", "cv", "instagram", "business_info",
] as const;

const SECTION_LABELS: Record<(typeof REVIEW_SECTIONS)[number], string> = {
  artist_statement: "Artist Statement",
  biography: "Biography",
  portfolio: "Portfolio",
  website: "Website",
  artwork_pricing: "Artwork Pricing",
  collections: "Collections",
  certificates: "Certificates",
  cv: "CV",
  instagram: "Instagram",
  business_info: "Business Information",
};

function ArtistDetailDrawer({ artistId, isSuper, onClose, onChanged }: { artistId: string; isSuper: boolean; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof getArtistDetailForAdmin>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setD(await getArtistDetailForAdmin({ data: { artistId } })); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, [artistId]);

  async function recomputeReadiness() {
    setBusy(true);
    try {
      await computeReadiness({ data: { artistId } });
      toast.success("Readiness score updated");
      await load();
      onChanged();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function toggleFeatured(v: boolean) {
    try { await setArtistFeatured({ data: { artistId, featured: v } }); toast.success(v ? "Marked as featured" : "Unfeatured"); onChanged(); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Artist review</p>
          <button onClick={onClose} className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest hover:bg-secondary">Close</button>
        </div>

        {err && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{err}</div>}
        {!d ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl">{d.profile.artist_name || "—"}</h2>
                  <p className="text-xs text-muted-foreground">{d.profile.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{[d.profile.city, d.profile.country].filter(Boolean).join(", ")}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {d.profile.medium && <span className="rounded-full bg-secondary px-2 py-1">{d.profile.medium}</span>}
                    {d.profile.style && <span className="rounded-full bg-secondary px-2 py-1">{d.profile.style}</span>}
                    <span className="rounded-full bg-secondary px-2 py-1">{d.profile.buyer_network_status}</span>
                    {d.profile.featured && <span className="rounded-full bg-primary px-2 py-1 text-primary-foreground">Featured</span>}
                    {d.profile.public_listed && <span className="rounded-full bg-secondary px-2 py-1">Public</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Link to="/a/$slug" params={{ slug: d.profile.slug }} className="bronze-link text-xs">View portfolio →</Link>
                  {isSuper && (
                    <button onClick={() => toggleFeatured(!d.profile.featured)} className="rounded-full border border-bronze px-3 py-1 text-xs uppercase tracking-widest text-bronze">
                      {d.profile.featured ? "Unfeature" : "Feature"}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Completion</p><Bar v={d.computed.completion} /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Readiness</p>
                  <p className="font-serif text-xl">{d.profile.readiness_score ?? "—"}{d.profile.readiness_score != null ? "/100" : ""}</p>
                  <p className="text-xs text-muted-foreground">{d.profile.readiness_level ?? "Not computed"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Artworks</p>
                  <p className="font-serif text-xl">{d.computed.artworkCount}</p>
                </div>
              </div>
              <button onClick={recomputeReadiness} disabled={busy} className="mt-3 rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest hover:bg-secondary disabled:opacity-50">
                {busy ? "Computing…" : "Recompute readiness (AI)"}
              </button>
              {Array.isArray(d.profile.readiness_recommendations) && (d.profile.readiness_recommendations as any[]).length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-xs text-muted-foreground">
                  {(d.profile.readiness_recommendations as any[]).map((r, i) => <li key={i}>{String(r)}</li>)}
                </ul>
              )}
            </div>

            {/* Activity */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Activity</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                <Info label="Signup" v={new Date(d.profile.created_at).toLocaleString()} />
                <Info label="Last login" v={d.profile.last_login_at ? new Date(d.profile.last_login_at).toLocaleString() : "—"} />
                <Info label="Website published" v={d.profile.published ? "Yes" : "No"} />
                <Info label="Public listed" v={d.profile.public_listed ? "Yes" : "No"} />
                <Info label="Artworks uploaded" v={d.computed.artworkCount} />
                <Info label="Recent events" v={(d.activity ?? []).length} />
              </div>
            </section>

            {/* Section reviews */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Section reviews</p>
              <div className="mt-4 grid gap-3">
                {REVIEW_SECTIONS.map((sec) => {
                  const existing = (d.reviews as any[]).find((r) => r.section === sec) ?? { status: "pending", admin_notes: "", artist_feedback: "" };
                  return <SectionReview key={sec} artistId={artistId} section={sec} label={SECTION_LABELS[sec]} initial={existing} onSaved={load} />;
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, v }: { label: string; v: any }) {
  return <div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p><p>{v}</p></div>;
}

function SectionReview({ artistId, section, label, initial, onSaved }: { artistId: string; section: string; label: string; initial: any; onSaved: () => void }) {
  const [status, setStatus] = useState<string>(initial.status ?? "pending");
  const [notes, setNotes] = useState<string>(initial.admin_notes ?? "");
  const [feedback, setFeedback] = useState<string>(initial.artist_feedback ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await upsertSectionReview({ data: { artistId, section, status: status as any, admin_notes: notes, artist_feedback: feedback } });
      toast.success(`${label} saved`);
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  const badge = status === "approved" ? "bg-emerald-500/20 text-emerald-500" : status === "needs_changes" ? "bg-amber-500/20 text-amber-500" : status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-secondary text-muted-foreground";

  return (
    <details className="rounded-lg border border-border bg-background/50 p-3">
      <summary className="flex cursor-pointer items-center justify-between text-sm">
        <span>{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${badge}`}>{status.replace("_", " ")}</span>
      </summary>
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {(["approved", "needs_changes", "rejected", "pending"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest ${status === s ? "border-bronze text-bronze" : "border-border text-muted-foreground"}`}>{s.replace("_", " ")}</button>
          ))}
        </div>
        <textarea placeholder="Internal admin notes (never shown to artist)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <textarea placeholder="Feedback message for the artist" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <button onClick={save} disabled={busy} className="rounded-full bg-primary px-4 py-1.5 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
          {busy ? "Saving…" : "Save review"}
        </button>
      </div>
    </details>
  );
}

// ================= Artworks (admin) =================

function ArtworksTab() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAllArtworksForAdmin>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "hidden" | "rejected" | "featured">("all");

  async function load() {
    try { setRows(await listAllArtworksForAdmin()); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (rows ?? []).filter((a: any) => {
    if (filter === "all") return true;
    if (filter === "featured") return a.featured;
    return a.admin_status === filter;
  }), [rows, filter]);

  async function moderate(_id: string, patch: { artworkId: string; admin_status?: "pending" | "approved" | "hidden" | "rejected"; featured?: boolean; admin_notes?: string | null }) {
    try { await setArtworkModeration({ data: patch }); toast.success("Updated"); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  if (err) return <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">{err}</div>;
  if (rows === null) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading artworks…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "approved", "hidden", "rejected", "featured"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest ${filter === f ? "border-bronze text-bronze" : "border-border text-muted-foreground"}`}>{f}</button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a: any) => <ArtworkAdminCard key={a.id} a={a} onModerate={moderate} />)}
      </div>
      {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground">No artworks in this bucket.</p>}
    </div>
  );
}

function ArtworkAdminCard({ a, onModerate }: { a: any; onModerate: (id: string, patch: any) => void }) {
  const img = useSignedUrl("artworks", a.image_path);
  const [notes, setNotes] = useState(a.admin_notes ?? "");
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="aspect-square overflow-hidden rounded-lg bg-secondary">
        {img && <img src={img} alt={a.title} className="size-full object-cover" />}
      </div>
      <p className="mt-3 font-serif text-lg">{a.title}</p>
      <p className="text-xs text-muted-foreground">{a.artist?.artist_name ?? "—"} · {a.medium ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{a.dimensions ?? "—"} · {a.price ? `$${a.price}` : "no price"}</p>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px] uppercase tracking-widest">
        <span className="rounded-full bg-secondary px-2 py-0.5">{a.admin_status}</span>
        {a.featured && <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">Featured</span>}
      </div>
      <textarea rows={2} placeholder="Internal notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2 w-full rounded-lg border border-input bg-background px-2 py-1 text-xs" />
      <div className="mt-2 flex flex-wrap gap-1">
        <button onClick={() => onModerate(a.id, { artworkId: a.id, admin_status: "approved", admin_notes: notes })} className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-widest hover:border-bronze">Approve</button>
        <button onClick={() => onModerate(a.id, { artworkId: a.id, admin_status: "hidden", admin_notes: notes })} className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-widest hover:border-bronze">Hide</button>
        <button onClick={() => onModerate(a.id, { artworkId: a.id, admin_status: "rejected", admin_notes: notes })} className="rounded-full border border-destructive px-2 py-1 text-[10px] uppercase tracking-widest text-destructive">Reject</button>
        <button onClick={() => onModerate(a.id, { artworkId: a.id, featured: !a.featured, admin_notes: notes })} className="rounded-full border border-bronze px-2 py-1 text-[10px] uppercase tracking-widest text-bronze">{a.featured ? "Unfeature" : "Feature"}</button>
      </div>
    </div>
  );
}

// ================= Notifications =================

function NotificationsTab() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAdminNotifications>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function load() {
    try { setRows(await listAdminNotifications()); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    try { await markNotificationRead({ data: { id } }); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  if (err) return <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">{err}</div>;
  if (rows === null) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>;
  if (rows.length === 0) return <div className="rounded-2xl border border-dashed border-border p-16 text-center text-muted-foreground">No notifications yet. Signup, publish, portfolio, readiness and inactivity events will appear here as they occur.</div>;

  return (
    <div className="space-y-2">
      {rows.map((n: any) => (
        <div key={n.id} className={`flex items-center justify-between rounded-lg border border-border p-3 text-sm ${n.read_at ? "opacity-60" : "bg-card"}`}>
          <div className="min-w-0">
            <p className="font-medium">{n.kind.replace(/_/g, " ")}{n.artist ? ` · ${n.artist.artist_name ?? n.artist.slug}` : ""}</p>
            <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
          </div>
          {!n.read_at && <button onClick={() => markRead(n.id)} className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest hover:bg-secondary">Mark read</button>}
        </div>
      ))}
    </div>
  );
}

// ================= Buyer Network Queue (existing, unchanged) =================

type QueueRow = {
  id: string; artist_name: string | null; slug: string; email: string | null; country: string | null; medium: string | null;
  avatar_path: string | null; buyer_network_applied_at: string | null; artwork_count: number;
};

function QueueTab() {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  async function load() {
    try {
      const { data: profs, error } = await supabase
        .from("profiles")
        .select("id,artist_name,slug,email,country,medium,avatar_path,buyer_network_applied_at")
        .eq("buyer_network_status", "pending_review")
        .order("buyer_network_applied_at", { ascending: true });
      if (error) throw error;
      const ids = (profs ?? []).map((p: any) => p.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: arts } = await supabase.from("artworks").select("user_id").in("user_id", ids);
        for (const a of (arts ?? []) as any[]) counts[a.user_id] = (counts[a.user_id] ?? 0) + 1;
      }
      setRows(((profs ?? []) as any[]).map((p) => ({ ...p, artwork_count: counts[p.id] ?? 0 })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load queue");
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (rows ?? []).filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [r.artist_name, r.email, r.country, r.medium, r.slug].some((v) => v?.toLowerCase().includes(s));
  }), [rows, q]);
  const paged = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  if (err) return <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">{err}</div>;
  if (rows === null) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading queue…</div>;
  if (rows.length === 0) return (
    <div className="rounded-2xl border border-dashed border-border p-16 text-center text-muted-foreground">
      No pending applications. When artists purchase a Buyer Network membership, they appear here for review.
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input placeholder="Search name, email, country, medium…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="w-full max-w-sm rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <p className="text-xs text-muted-foreground">{filtered.length} pending</p>
      </div>
      <div className="grid gap-4">
        {paged.map((r) => <QueueCard key={r.id} row={r} onDone={load} />)}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-40">Prev</button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

function QueueCard({ row, onDone }: { row: QueueRow; onDone: () => void }) {
  const avatar = useSignedUrl("avatars", row.avatar_path);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function approve() {
    setBusy("approve");
    const r = await approveBuyerNetworkApplicant({ data: { artistId: row.id, note: note || undefined } });
    setBusy(null);
    if ("error" in r) { toast.error(r.error); return; }
    toast.success(`Approved ${row.artist_name ?? "artist"}`);
    onDone();
  }
  async function reject() {
    if (!confirm(`Reject ${row.artist_name ?? "this artist"}? This will refund their $197 payment in full and cancel the subscription.`)) return;
    setBusy("reject");
    const r = await rejectBuyerNetworkApplicant({ data: { artistId: row.id, note: note || undefined, environment: getStripeEnvironment() } });
    setBusy(null);
    if ("error" in r) { toast.error(r.error); return; }
    toast.success(`Rejected & refunded ${(r.amount / 100).toFixed(2)} USD`);
    onDone();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-full bg-secondary">
          {avatar && <img src={avatar} alt="" className="size-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <p className="font-serif text-xl">{row.artist_name || "Untitled artist"}</p>
            <Link to="/a/$slug" params={{ slug: row.slug }} className="bronze-link text-xs">View portfolio →</Link>
          </div>
          <p className="text-xs text-muted-foreground">{row.email}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            {row.country && <span className="rounded-full bg-secondary px-2 py-1">{row.country}</span>}
            {row.medium && <span className="rounded-full bg-secondary px-2 py-1">{row.medium}</span>}
            <span className="rounded-full bg-secondary px-2 py-1">{row.artwork_count} artworks</span>
            {row.buyer_network_applied_at && <span className="rounded-full bg-secondary px-2 py-1">Applied {new Date(row.buyer_network_applied_at).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>
      <textarea
        placeholder="Internal note (visible to admins; short reason shown to artist on rejection)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="mt-4 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={approve} disabled={!!busy} className="rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button onClick={reject} disabled={!!busy} className="rounded-full border border-destructive px-5 py-2 text-xs uppercase tracking-widest text-destructive hover:bg-destructive/5 disabled:opacity-50">
          {busy === "reject" ? "Refunding…" : "Reject & refund"}
        </button>
      </div>
    </div>
  );
}

// ================= Legacy Artists (existing, unchanged) =================

type Row = { id: string; artist_name: string | null; slug: string; email: string | null; country: string | null; featured: boolean; published: boolean; buyer_network_status: string };

function ArtistsTab() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { (async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("id,artist_name,slug,email,country,featured,published,buyer_network_status").order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as Row[]);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to load"); }
  })(); }, []);

  async function toggle(id: string, field: "featured" | "published", value: boolean) {
    const patch = field === "featured" ? { featured: value } : { published: value };
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else setRows((p) => p ? p.map((r) => r.id === id ? { ...r, [field]: value } : r) : p);
  }

  if (err) return <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">{err}</div>;
  if (rows === null) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading artists…</div>;
  if (rows.length === 0) return <div className="rounded-2xl border border-dashed border-border p-16 text-center text-muted-foreground">No artists on the platform yet.</div>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
          <tr><th className="p-4">Artist</th><th className="p-4">Slug</th><th className="p-4">Country</th><th className="p-4">Buyer Network</th><th className="p-4">Published</th><th className="p-4">Featured</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="p-4"><div>{r.artist_name || "—"}</div><div className="text-xs text-muted-foreground">{r.email}</div></td>
              <td className="p-4"><a href={`/a/${r.slug}`} className="bronze-link">{r.slug}</a></td>
              <td className="p-4">{r.country || "—"}</td>
              <td className="p-4"><span className="rounded-full bg-secondary px-2 py-1 text-[10px] uppercase tracking-widest">{r.buyer_network_status}</span></td>
              <td className="p-4"><input type="checkbox" checked={r.published} onChange={(e) => toggle(r.id, "published", e.target.checked)} /></td>
              <td className="p-4"><input type="checkbox" checked={r.featured} onChange={(e) => toggle(r.id, "featured", e.target.checked)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ================= Stats (existing, unchanged) =================

type Stats = {
  totalArtists: number; publishedArtists: number; totalArtworks: number;
  pdfUnits: number; pdfRevenueCents: number;
  bnPending: number; bnApproved: number; bnRejected: number;
  bnActiveRevenueCents: number; refundsCents: number; refundsCount: number;
  inquiries: number; renovateAttempts: number; siteViews: number;
  recentRefunds: { id: string; user_id: string; amount_cents: number; created_at: string; artist_name: string | null; admin_id: string | null }[];
};

function StatsTab() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { (async () => {
    try {
      const env = getStripeEnvironment();
      const [profs, arts, credits, subs, refunds, inqs, evs] = await Promise.all([
        supabase.from("profiles").select("id,artist_name,published,buyer_network_status"),
        supabase.from("artworks").select("id", { count: "exact", head: true }),
        supabase.from("portfolio_credits").select("purchased"),
        supabase.from("subscriptions").select("status,current_period_end,product_id,environment").eq("product_id", "buyer_network").eq("environment", env),
        supabase.from("refunds").select("id,user_id,admin_id,amount_cents,created_at").eq("environment", env).order("created_at", { ascending: false }),
        supabase.from("inquiries").select("id", { count: "exact", head: true }),
        supabase.from("analytics_events").select("event_type"),
      ]);

      const profiles = (profs.data ?? []) as any[];
      const nameById = new Map(profiles.map((p) => [p.id, p.artist_name]));
      const pdfUnits = ((credits.data ?? []) as any[]).reduce((n, r) => n + (r.purchased ?? 0), 0);
      const activeSubs = ((subs.data ?? []) as any[]).filter((x) => ["active","trialing","past_due"].includes(x.status) || (x.status === "canceled" && x.current_period_end && new Date(x.current_period_end) > new Date()));
      const refundRows = (refunds.data ?? []) as any[];
      const refundsCents = refundRows.reduce((n, r) => n + (r.amount_cents ?? 0), 0);
      const events = ((evs.data ?? []) as any[]);

      setS({
        totalArtists: profiles.length,
        publishedArtists: profiles.filter((p) => p.published).length,
        totalArtworks: arts.count ?? 0,
        pdfUnits, pdfRevenueCents: pdfUnits * 4700,
        bnPending: profiles.filter((p) => p.buyer_network_status === "pending_review").length,
        bnApproved: profiles.filter((p) => p.buyer_network_status === "approved").length,
        bnRejected: profiles.filter((p) => p.buyer_network_status === "rejected").length,
        bnActiveRevenueCents: activeSubs.length * 19700 - refundsCents,
        refundsCents, refundsCount: refundRows.length,
        inquiries: inqs.count ?? 0,
        renovateAttempts: events.filter((e) => e.event_type === "renovate_attempt").length,
        siteViews: events.filter((e) => e.event_type === "site_view").length,
        recentRefunds: refundRows.slice(0, 10).map((r) => ({ ...r, artist_name: nameById.get(r.user_id) ?? null })),
      });
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  })(); }, []);

  if (err) return <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">{err}</div>;
  if (!s) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading stats…</div>;

  const money = (c: number) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total artists" value={s.totalArtists} sub={`${s.publishedArtists} published`} />
        <Stat label="Artworks uploaded" value={s.totalArtworks} />
        <Stat label="Portfolio PDFs sold" value={s.pdfUnits} sub={money(s.pdfRevenueCents)} />
        <Stat label="Directory / site views" value={s.siteViews} />

        <Stat label="Buyer Network · pending" value={s.bnPending} />
        <Stat label="Buyer Network · approved" value={s.bnApproved} />
        <Stat label="Buyer Network · rejected" value={s.bnRejected} />
        <Stat label="BN revenue (net of refunds)" value={money(s.bnActiveRevenueCents)} />

        <Stat label="Refunds issued" value={s.refundsCount} sub={money(s.refundsCents)} />
        <Stat label="Inquiries sent" value={s.inquiries} />
        <Stat label="Renovate AI renders" value={s.renovateAttempts} sub="Ready when live" />
      </div>

      <section>
        <h2 className="font-serif text-2xl">Recent refunds</h2>
        {s.recentRefunds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No refunds issued yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr><th className="p-4">Artist</th><th className="p-4">Amount</th><th className="p-4">Admin</th><th className="p-4">Date</th></tr>
              </thead>
              <tbody>
                {s.recentRefunds.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="p-4">{r.artist_name ?? r.user_id.slice(0, 8)}</td>
                    <td className="p-4">{money(r.amount_cents)}</td>
                    <td className="p-4 text-xs text-muted-foreground">{r.admin_id ? r.admin_id.slice(0, 8) : "—"}</td>
                    <td className="p-4 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

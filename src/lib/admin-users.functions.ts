import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = new Set<string>((data ?? []).map((r: any) => r.role));
  if (!(roles.has("admin") || roles.has("super_admin"))) throw new Error("Forbidden: admin access required");
  return { isSuper: roles.has("super_admin") };
}

export type UserBucket = "all" | "not_started" | "in_progress" | "submitted" | "approved" | "rejected";

export const listUsersForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    bucket: z.enum(["all", "not_started", "in_progress", "submitted", "approved", "rejected"]).default("all"),
    search: z.string().optional().default(""),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id,artist_name,slug,email,avatar_path,city,country,medium,instagram,application_status,completion_percent,created_at,last_login_at,application_submitted_at,application_reviewed_at,last_reminder_sent_at,reminder_count")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    const filtered = (rows ?? []).filter((r: any) => {
      // bucket
      const c = r.completion_percent ?? 0;
      const s = r.application_status ?? "draft";
      if (data.bucket === "not_started" && !(c === 0 && s === "draft")) return false;
      if (data.bucket === "in_progress" && !(c > 0 && c < 100 && s === "draft")) return false;
      if (data.bucket === "submitted" && s !== "submitted") return false;
      if (data.bucket === "approved" && s !== "approved") return false;
      if (data.bucket === "rejected" && s !== "rejected") return false;
      // search
      if (data.search) {
        const q = data.search.toLowerCase();
        const hay = `${r.artist_name ?? ""} ${r.email ?? ""} ${r.slug ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return filtered;
  });

export const getUsersSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("profiles")
      .select("application_status,completion_percent");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    return {
      total: rows.length,
      not_started: rows.filter((r) => (r.completion_percent ?? 0) === 0 && (r.application_status ?? "draft") === "draft").length,
      in_progress: rows.filter((r) => (r.completion_percent ?? 0) > 0 && (r.completion_percent ?? 0) < 100 && (r.application_status ?? "draft") === "draft").length,
      submitted: rows.filter((r) => r.application_status === "submitted").length,
      approved: rows.filter((r) => r.application_status === "approved").length,
      rejected: rows.filter((r) => r.application_status === "rejected").length,
    };
  });

export const listEmailsForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ recipientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: rows, error } = await supabase
      .from("admin_email_log")
      .select("*")
      .eq("recipient_id", data.recipientId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Templates
export const ADMIN_EMAIL_TEMPLATES: Record<string, { label: string; subject: string; body: string }> = {
  complete_profile: {
    label: "Complete your profile",
    subject: "Aria: your artist profile is waiting",
    body:
      "Hi {{artist_name}},\n\n" +
      "You started your Art Identity profile but it's still {{completion_percent}}% complete. " +
      "Finish it in about 10 minutes and Aria will submit it for curator review — approved artists unlock their public website, portfolio PDF and direct inquiries.\n\n" +
      "Continue here: {{profile_url}}\n\n" +
      "— Aria, Art Identity AI",
  },
  application_reminder: {
    label: "Application reminder",
    subject: "One step left to submit your artist application",
    body:
      "Hi {{artist_name}},\n\n" +
      "Your profile is ready to go. Head to your dashboard and submit for review so a curator can look at your work.\n\n" +
      "{{profile_url}}\n\n" +
      "— Aria",
  },
  approval_welcome: {
    label: "Approval welcome",
    subject: "Welcome — your Art Identity profile is approved",
    body:
      "Hi {{artist_name}},\n\n" +
      "Congratulations — you're in. Your public site, portfolio PDF and inquiry inbox are unlocked. " +
      "Share your page anywhere: {{public_url}}\n\n" +
      "— The Art Identity team",
  },
  rejection_followup: {
    label: "Rejection follow-up",
    subject: "About your Art Identity application",
    body:
      "Hi {{artist_name}},\n\n" +
      "Thank you for applying. After curator review we're not able to approve your profile at this time. " +
      "You're welcome to strengthen your portfolio and reapply.\n\n" +
      "— The Art Identity team",
  },
  blank: {
    label: "Blank",
    subject: "",
    body: "",
  },
};

export const listAdminEmailTemplates = createServerFn({ method: "GET" }).handler(async () => {
  return Object.entries(ADMIN_EMAIL_TEMPLATES).map(([key, v]) => ({ key, ...v }));
});

function mergeFields(template: string, ctx: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, k) => ctx[k] ?? "");
}

async function tryDeliverEmail(to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  // Try Lovable Emails transactional route if the LOVABLE_API_KEY is present.
  // The transactional email infrastructure must be scaffolded separately (email domain + templates).
  // If the route is missing (404), we mark queued and let the admin know.
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ok: false, error: "Email transport not configured (email domain setup required)" };
  try {
    const res = await fetch("http://127.0.0.1:3000/lovable/email/transactional/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        templateName: "admin-message",
        recipientEmail: to,
        templateData: { subject, body },
      }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

export const sendAdminEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    recipientIds: z.array(z.string().uuid()).min(1).max(100),
    subject: z.string().min(1).max(300),
    body: z.string().min(1).max(20_000),
    templateKey: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: profs, error } = await supabase
      .from("profiles")
      .select("id,artist_name,email,slug,completion_percent")
      .in("id", data.recipientIds);
    if (error) throw new Error(error.message);
    const recipients = (profs ?? []) as any[];

    let sent = 0;
    let failed = 0;
    for (const p of recipients) {
      if (!p.email) { failed++; continue; }
      const ctx = {
        artist_name: p.artist_name ?? "there",
        completion_percent: String(p.completion_percent ?? 0),
        profile_url: "https://artist-essence-ai.lovable.app/dashboard",
        public_url: p.slug ? `https://artist-essence-ai.lovable.app/a/${p.slug}` : "https://artist-essence-ai.lovable.app",
      };
      const subject = mergeFields(data.subject, ctx);
      const body = mergeFields(data.body, ctx);
      const result = await tryDeliverEmail(p.email, subject, body);
      await supabase.from("admin_email_log").insert({
        recipient_id: p.id,
        recipient_email: p.email,
        subject,
        body,
        template_key: data.templateKey ?? null,
        kind: "manual",
        sent_by: userId,
        send_status: result.ok ? "sent" : "failed",
        error_message: result.error ?? null,
      });
      if (result.ok) sent++; else failed++;
    }

    return { sent, failed, total: recipients.length };
  });

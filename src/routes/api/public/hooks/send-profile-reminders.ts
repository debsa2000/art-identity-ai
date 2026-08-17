import { createFileRoute } from "@tanstack/react-router";

// Cron endpoint (called from pg_cron with the Supabase anon apikey header).
// Sends reminder emails to artists who haven't completed or submitted their profile.
export const Route = createFileRoute("/api/public/hooks/send-profile-reminders")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Require the Supabase anon apikey header — matches the project's cron auth pattern.
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = Date.now();
        const dayMs = 86_400_000;
        const throttleMs = 7 * dayMs;

        const { data: rows, error } = await supabaseAdmin
          .from("profiles")
          .select("id,artist_name,email,slug,completion_percent,application_status,created_at,last_reminder_sent_at,reminder_count");
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const lovableKey = process.env.LOVABLE_API_KEY;

        const results: any[] = [];
        for (const p of (rows ?? []) as any[]) {
          if (!p.email) continue;
          const ageMs = now - new Date(p.created_at).getTime();
          const status = p.application_status ?? "draft";
          const completion = p.completion_percent ?? 0;
          const lastMs = p.last_reminder_sent_at ? now - new Date(p.last_reminder_sent_at).getTime() : Infinity;
          if (lastMs < throttleMs) continue;

          let kind: string | null = null;
          if (status === "draft" && completion < 100 && ageMs > 2 * dayMs) kind = "complete_profile";
          else if (status === "draft" && completion >= 100 && ageMs > dayMs) kind = "submit_application";
          if (!kind) continue;

          const subject = kind === "complete_profile"
            ? "Aria: your artist profile is waiting"
            : "One step left — submit your Art Identity application";
          const body = kind === "complete_profile"
            ? `Hi ${p.artist_name ?? "there"},\n\nYour Art Identity profile is ${completion}% complete. Finish it in about 10 minutes and Aria will submit it for curator review.\n\nContinue: https://artist-essence-ai.lovable.app/dashboard\n\n— Aria`
            : `Hi ${p.artist_name ?? "there"},\n\nYour profile is ready. Head to your dashboard to submit it for review.\n\nhttps://artist-essence-ai.lovable.app/dashboard\n\n— Aria`;

          let sendOk = false;
          let sendErr: string | null = null;
          if (lovableKey) {
            try {
              const res = await fetch(`${new URL(request.url).origin}/lovable/email/transactional/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
                body: JSON.stringify({
                  templateName: "admin-message",
                  recipientEmail: p.email,
                  idempotencyKey: `reminder-${kind}-${p.id}-${new Date().toISOString().slice(0, 10)}`,
                  templateData: { subject, body },
                }),
              });
              sendOk = res.ok;
              if (!res.ok) sendErr = `HTTP ${res.status}`;
            } catch (e) {
              sendErr = e instanceof Error ? e.message : "send failed";
            }
          } else {
            sendErr = "Email transport not configured";
          }

          await supabaseAdmin.from("admin_email_log").insert({
            recipient_id: p.id,
            recipient_email: p.email,
            subject,
            body,
            template_key: kind,
            kind: "automated",
            sent_by: null,
            send_status: sendOk ? "sent" : "failed",
            error_message: sendErr,
          });

          if (sendOk) {
            await supabaseAdmin
              .from("profiles")
              .update({ last_reminder_sent_at: new Date().toISOString(), reminder_count: (p.reminder_count ?? 0) + 1 })
              .eq("id", p.id);
          }

          results.push({ id: p.id, kind, sent: sendOk, error: sendErr });
        }

        return Response.json({ processed: results.length, results });
      },
    },
  },
} as never);

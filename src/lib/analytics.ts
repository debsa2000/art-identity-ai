import { supabase } from "@/integrations/supabase/client";

export async function logEvent(artistId: string, eventType: "site_view" | "artwork_view" | "portfolio_download", refId?: string) {
  try {
    await supabase.from("analytics_events").insert({ artist_id: artistId, event_type: eventType, ref_id: refId ?? null });
  } catch {
    // ignore
  }
}

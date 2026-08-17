import { supabase } from "@/integrations/supabase/client";

export type Entitlements = {
  pdfAvailable: number;
  bundleUnlocked: boolean;
  memberActive: boolean;
  applicationApproved: boolean;
  applicationStatus: "draft" | "submitted" | "approved" | "rejected";
  completionPercent: number;
  canDownloadPdf: boolean;
  canPublishWebsite: boolean;
  canDownloadResume: boolean;
  canUseStudio: boolean;
  canUseMockups: boolean;
  canUseFreeTeaser: boolean;
  freeTeaserUsed: boolean;
};

export async function loadEntitlements(userId: string): Promise<Entitlements> {
  const [{ data: credits }, { data: prof }] = await Promise.all([
    supabase.from("portfolio_credits").select("purchased,used,resume_bundle_purchased,resume_bundle_used").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("buyer_network_status,application_status,completion_percent,free_teaser_used").eq("id", userId).maybeSingle(),
  ]);

  const pdfAvailable = ((credits?.purchased as number) ?? 0) - ((credits?.used as number) ?? 0);
  const bundleUnlocked = (((credits?.resume_bundle_purchased as number) ?? 0) > 0);
  const memberActive = (prof as any)?.buyer_network_status === "approved";
  const applicationStatus = (((prof as any)?.application_status) ?? "draft") as Entitlements["applicationStatus"];
  const applicationApproved = applicationStatus === "approved";
  const completionPercent = ((prof as any)?.completion_percent ?? 0) as number;
  const freeTeaserUsed = Boolean((prof as any)?.free_teaser_used);

  // Approval unlocks everything. Legacy credits/membership also unlock.
  const unlocked = applicationApproved || memberActive;

  return {
    pdfAvailable,
    bundleUnlocked,
    memberActive,
    applicationApproved,
    applicationStatus,
    completionPercent,
    canDownloadPdf: unlocked || pdfAvailable > 0,
    canPublishWebsite: unlocked || bundleUnlocked,
    canDownloadResume: unlocked || bundleUnlocked,
    canUseStudio: unlocked,
    canUseMockups: unlocked,
    canUseFreeTeaser: !freeTeaserUsed,
    freeTeaserUsed,
  };
}


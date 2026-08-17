import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { becomeGallery } from "@/lib/gallery.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const nav = useNavigate();
  const become = useServerFn(becomeGallery);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isGallery, setIsGallery] = useState<boolean>(false);
  const [pw, setPw] = useState("");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
      if (data.user) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
        setIsGallery((roles ?? []).some((r) => (r.role as string) === "gallery"));
      }
    });
  }, []);

  async function updatePw() {
    if (pw.length < 8) { toast.error("Min 8 characters"); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast.error(error.message); else { toast.success("Password updated."); setPw(""); }
  }

  async function switchToGallery() {
    setSwitching(true);
    try {
      await become({ data: {} });
      toast.success("Gallery access unlocked. Let's set it up.");
      nav({ to: "/gallery-onboarding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Account</p>
        <h1 className="mt-2 font-serif text-4xl">Settings</h1>
      </header>
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Signed in as</p>
          <p className="mt-1">{email}</p>
        </div>
        <div>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">New password</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
          </label>
          <button onClick={updatePw} className="mt-3 rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-widest text-primary-foreground">Update password</button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Account type</p>
        {isGallery ? (
          <p className="text-sm">You have a <span className="text-bronze">Gallery</span> account. Manage it from the Gallery tab.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Represent artists or run a gallery space? Add a public gallery page to your account.</p>
            <button onClick={switchToGallery} disabled={switching || !userId}
              className="rounded-full border border-bronze px-5 py-2 text-xs uppercase tracking-widest text-bronze hover:bg-secondary disabled:opacity-50">
              {switching ? "Setting up…" : "Add a Gallery account"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}


import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Awaitable<T> = T | Promise<T>;
interface AuthorizationDetails {
  client?: { name?: string; redirect_uri?: string } | null;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
}
interface OAuthResponse<T> {
  data: T | null;
  error: { message: string } | null;
}
interface SupabaseOAuthNamespace {
  getAuthorizationDetails: (id: string) => Awaitable<OAuthResponse<AuthorizationDetails>>;
  approveAuthorization: (id: string) => Awaitable<OAuthResponse<AuthorizationDetails>>;
  denyAuthorization: (id: string) => Awaitable<OAuthResponse<AuthorizationDetails>>;
}
function sbOAuth(): SupabaseOAuthNamespace {
  // The auth.oauth namespace is beta and not yet in the generated Supabase types.
  return (supabase.auth as unknown as { oauth: SupabaseOAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase client reads its session from localStorage,
  // absent during SSR. Without this the loader can't see the signed-in user.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { mode: "signin" as const, next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await sbOAuth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="container-x flex min-h-[60vh] items-center justify-center py-16">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="font-serif text-2xl">Authorization error</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await sbOAuth().approveAuthorization(authorization_id)
      : await sbOAuth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an external app";

  return (
    <main className="container-x flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-10 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze text-center">
          Authorize integration
        </p>
        <h1 className="mt-3 text-center font-serif text-3xl">
          Connect {clientName} to Art Identity AI
        </h1>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {clientName} will be able to use Art Identity AI's tools while signed in as you —
          read and update your profile, list and create your artworks, view your inquiries,
          and search the public artist directory. This does not bypass Art Identity AI's
          permissions or backend policies.
        </p>

        {details?.client?.redirect_uri && (
          <p className="mt-4 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
            Returns to: <span className="text-foreground">{details.client.redirect_uri}</span>
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="w-full rounded-full bg-primary py-3 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Please wait…" : `Approve & connect ${clientName}`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="w-full rounded-full border border-border py-3 text-xs uppercase tracking-widest hover:bg-secondary disabled:opacity-50"
          >
            Cancel connection
          </button>
        </div>
      </div>
    </main>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { SignUpNudge } from "@/components/SignUpNudge";
import { AriaAssistant } from "@/components/AriaAssistant";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl">404</h1>
        <p className="mt-3 text-muted-foreground">This page has left the gallery.</p>
        <Link to="/" className="mt-6 inline-block bronze-link">Return home</Link>
      </div>
    </div>
  );
}

function ErrorView({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Art Identity AI — Build your professional art identity in minutes" },
      { name: "description", content: "The luxury AI platform helping artists craft a professional online presence — statements, biography, personal website, portfolio PDF, and direct inquiries." },
      { property: "og:title", content: "Art Identity AI — Build your professional art identity in minutes" },
      { property: "og:description", content: "The luxury AI platform helping artists craft a professional online presence — statements, biography, personal website, portfolio PDF, and direct inquiries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Art Identity AI — Build your professional art identity in minutes" },
      { name: "twitter:description", content: "The luxury AI platform helping artists craft a professional online presence — statements, biography, personal website, portfolio PDF, and direct inquiries." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3748c7ec-769d-4be0-a5d3-4008b9cde551/id-preview-857459d2--963e78c8-28e9-4f68-b583-1cdb80303f62.lovable.app-1783741682900.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3748c7ec-769d-4be0-a5d3-4008b9cde551/id-preview-857459d2--963e78c8-28e9-4f68-b583-1cdb80303f62.lovable.app-1783741682900.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=Sora:wght@300;400;500;600;700&display=swap" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  shellComponent: Shell,
  component: Root,
  notFoundComponent: NotFound,
  errorComponent: ErrorView,
});

function Shell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function Root() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <Nav />
      <Outlet />
      <Footer />
      <SignUpNudge />
      <AriaAssistant />
      <Toaster position="top-center" theme="dark" />
    </QueryClientProvider>
  );
}

function AuthSync() {
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);
  return null;
}

function Nav() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-serif text-xl tracking-tight">Art Identity</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-bronze">AI</span>
        </Link>
        <nav className="hidden gap-8 md:flex text-sm">
          <Link to="/directory" className="text-muted-foreground hover:text-foreground">Directory</Link>
          <a href="/#how" className="text-muted-foreground hover:text-foreground">How it works</a>
          <a href="/#future" className="text-muted-foreground hover:text-foreground">Coming Soon</a>
        </nav>
        <div className="flex items-center gap-3">
          {email ? (
            <Link to="/dashboard" className="rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-widest text-primary-foreground">Dashboard</Link>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "signin" }} className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
              <Link to="/auth" search={{ mode: "signup" }} className="rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-widest text-primary-foreground">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="container-x flex flex-col gap-4 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="font-serif text-lg text-foreground">Art Identity</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-bronze">AI</span>
        </div>
        <nav className="flex flex-wrap items-center gap-5">
          <Link to="/directory" className="hover:text-foreground">Directory</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/refund-policy" className="hover:text-foreground">Refund Policy</Link>
        </nav>
        <p>© {new Date().getFullYear()} Art Identity AI</p>
      </div>
    </footer>
  );
}

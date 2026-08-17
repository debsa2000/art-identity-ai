import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getPublicGallery } from "@/lib/gallery.functions";

const galleryQO = (slug: string) =>
  queryOptions({
    queryKey: ["gallery", slug],
    queryFn: () => getPublicGallery({ data: { slug } }),
  });

export const Route = createFileRoute("/g/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(galleryQO(params.slug));
    if (!data) throw notFound();
    return { slug: params.slug };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.slug} — Gallery` },
          { name: "description", content: "Gallery on Art Identity AI." },
        ]
      : [],
  }),
  component: GalleryPublic,
  errorComponent: () => <main className="container-x py-20 text-center text-muted-foreground">Something went wrong.</main>,
  notFoundComponent: () => <main className="container-x py-20 text-center text-muted-foreground">Gallery not found.</main>,
});

function GalleryPublic() {
  const { slug } = Route.useLoaderData();
  const { data: g } = useSuspenseQuery(galleryQO(slug));
  if (!g) return null;

  return (
    <main className="container-x py-16">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Gallery</p>
        <h1 className="mt-4 font-serif text-5xl">{g.name ?? g.slug}</h1>
        {(g.city || g.country) && (
          <p className="mt-2 text-sm text-muted-foreground">{[g.city, g.country].filter(Boolean).join(", ")}</p>
        )}
      </header>

      {g.bio && (
        <section className="mx-auto mt-12 max-w-2xl whitespace-pre-line text-center text-base leading-relaxed text-foreground/90">
          {g.bio}
        </section>
      )}

      <section className="mx-auto mt-12 flex max-w-2xl flex-wrap justify-center gap-4 text-sm">
        {g.website && (
          <a href={g.website} target="_blank" rel="noreferrer" className="rounded-full border border-border px-4 py-2 hover:bg-secondary">
            Website
          </a>
        )}
        {g.instagram && (
          <a href={`https://instagram.com/${g.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="rounded-full border border-border px-4 py-2 hover:bg-secondary">
            @{g.instagram.replace(/^@/, "")}
          </a>
        )}
        {g.email && (
          <a href={`mailto:${g.email}`} className="rounded-full bg-primary px-4 py-2 text-primary-foreground">
            Contact
          </a>
        )}
      </section>
    </main>
  );
}

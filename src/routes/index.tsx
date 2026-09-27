import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Start Here" },
      {
        name: "description",
        content: "A clean starting point — tell me what to build next.",
      },
      { property: "og:title", content: "Start Here" },
      {
        property: "og:description",
        content: "A clean starting point — tell me what to build next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <span className="mb-6 inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        New project
      </span>
      <h1 className="max-w-2xl text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
        A blank canvas, ready to go.
      </h1>
      <p className="mt-5 max-w-md text-lg text-muted-foreground">
        This is your starting point. Describe what you'd like to build and it
        will take shape right here.
      </p>
    </main>
  );
}

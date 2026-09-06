import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { buildPlayerUrl, scheduleDetailsQuery } from "@/lib/content/client";

type PlaySearch = {
  batchSlug: string;
  subjectSlug: string;
  scheduleId: string;
  batchId: string;
  title?: string | undefined;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

export const Route = createFileRoute("/play")({
  validateSearch: (search: Record<string, unknown>): PlaySearch => ({
    batchSlug: str(search["batchSlug"]),
    subjectSlug: str(search["subjectSlug"]),
    scheduleId: str(search["scheduleId"]),
    batchId: str(search["batchId"]),
    title: typeof search["title"] === "string" ? search["title"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Opening Lecture — PW-MARCO" },
      { name: "description", content: "Opening your PW-MARCO lecture in the player." },
      { property: "og:title", content: "Opening Lecture — PW-MARCO" },
      { property: "og:description", content: "Opening your PW-MARCO lecture in the player." },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { batchSlug, subjectSlug, scheduleId, batchId, title } = Route.useSearch();

  const details = useQuery({
    ...scheduleDetailsQuery(batchSlug, subjectSlug, scheduleId),
    enabled: Boolean(batchSlug && subjectSlug && scheduleId),
  });

  const target = details.data ? buildPlayerUrl(details.data, batchId) : null;

  useEffect(() => {
    if (target) window.location.replace(target);
  }, [target]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      {details.isError ? (
        <>
          <p className="text-sm text-muted-foreground">
            {(details.error as Error).message || "Couldn't open this lecture."}
          </p>
          <button
            onClick={() => details.refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Retry
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">{title ?? "Lecture"}</p>
          <p className="text-sm text-muted-foreground">Opening player…</p>
          {target ? (
            <a href={target} className="text-xs font-semibold underline">
              Tap here if it doesn&apos;t open
            </a>
          ) : null}
        </>
      )}
    </div>
  );
}

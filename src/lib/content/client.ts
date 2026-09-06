/**
 * Browser-safe content client. Talks only to our own /api/content proxy —
 * never to the upstream host directly.
 */



export class ContentError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function contentGet<T>(path: string, params?: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  }
  const qs = search.toString();
  const res = await fetch(`/api/content/${path}${qs ? `?${qs}` : ""}`, {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON upstream response */
  }
  if (!res.ok) {
    const message =
      (json as { message?: string } | null)?.message ??
      (res.status === 404 ? "This content isn't available." : "Couldn't load this content.");
    throw new ContentError(message, res.status);
  }
  const payload = json as { success?: boolean; data?: T; message?: string } | null;
  if (!payload || payload.success === false) {
    throw new ContentError(payload?.message ?? "Content source returned an error.", 502);
  }
  return payload.data as T;
}

/* ---------------------------------------------------------------- types */

export type ImageRef = { baseUrl?: string; key?: string } | null;

export type BatchSubject = {
  _id: string;
  subject: string;
  subjectId?: string;
  slug: string;
  imageId?: ImageRef;
  lectureCount?: number;
  tagCount?: number;
};

export type BatchDetails = {
  _id: string;
  name: string;
  slug: string;
  byName?: string;
  programId?: string;
  language?: string;
  class?: string;
  previewImage?: ImageRef;
  startDate?: string;
  endDate?: string;
  shortDescription?: string;
  subjects?: BatchSubject[];
};

export type Topic = {
  _id: string;
  name: string;
  slug: string;
  videos?: number;
  lectureVideos?: number;
  notes?: number;
  exercises?: number;
};

export type ContentItem = {
  _id: string;
  topic?: string;
  url?: string;
  urlType?: string;
  videoDetails?: {
    _id?: string;
    id?: string;
    image?: string;
    name?: string;
    duration?: string;
    videoUrl?: string;
    hls_url?: string;
    embedCode?: string;
  };
  startTime?: string;
  date?: string;
  isFree?: boolean;
  lectureType?: string;
  tags?: { _id: string; name: string }[];
  homeworkIds?: Homework[];
  exerciseIds?: Homework[];
};

export type Attachment = { _id: string; name?: string; baseUrl?: string; key?: string };

export type Homework = {
  _id: string;
  topic?: string;
  note?: string;
  attachmentIds?: Attachment[];
};

/** Full detail for a single schedule item — the only place attachment keys are populated. */
export type ScheduleDetails = ContentItem & {
  batchId?: string;
  batchSubjectId?: string;
  isDPPNotes?: boolean;
  slug?: string;
  dRoomId?: string | null;
  conversationId?: string | null;
  tagIds?: string[];
  subject?: { _id?: string; name?: string; slug?: string };
};


export function imageUrl(ref: ImageRef | undefined, fallback?: string | null): string | null {
  if (ref?.baseUrl && ref?.key) return `${ref.baseUrl}${ref.key}`;
  return fallback ?? null;
}

/* ------------------------------------------------------------ endpoints */

export const batchDetailsQuery = (batchId: string) => ({
  queryKey: ["batch-details", batchId],
  queryFn: () => contentGet<BatchDetails>(`v3/batches/${batchId}/details`),
  staleTime: 5 * 60 * 1000,
});

export const topicsQuery = (batchSlug: string, subjectSlug: string) => ({
  queryKey: ["topics", batchSlug, subjectSlug],
  queryFn: () => contentGet<Topic[]>(`v2/batches/${batchSlug}/subject/${subjectSlug}/topics`),
  staleTime: 5 * 60 * 1000,
});

export type ContentType = "videos" | "notes" | "DppNotes" | "DppVideos";

export const contentsQuery = (
  batchSlug: string,
  subjectSlug: string,
  topicId: string,
  contentType: ContentType,
  page = 1,
) => ({
  queryKey: ["contents", batchSlug, subjectSlug, topicId, contentType, page],
  queryFn: () =>
    contentGet<ContentItem[]>(`v2/batches/${batchSlug}/subject/${subjectSlug}/contents`, {
      page,
      contentType,
      tag: topicId,
    }),
  staleTime: 2 * 60 * 1000,
});

export type DppTest = {
  test?: {
    _id?: string;
    name?: string;
    totalMarks?: number;
    totalQuestions?: number;
    maxDuration?: number;
  };
  scheduleId?: string;
  contentId?: string;
  isFree?: boolean;
  tag?: string;
};

export const dppTestsQuery = (
  batchId: string,
  batchSubjectId: string,
  chapterId: string,
  page = 1,
) => ({
  queryKey: ["dpp-tests", batchId, batchSubjectId, chapterId, page],
  queryFn: () =>
    contentGet<DppTest[]>(`v3/test-service/tests/dpp`, {
      batchId,
      batchSubjectId,
      chapterId,
      isSubjective: "false",
      page,
    }),
  staleTime: 5 * 60 * 1000,
});

export type ScheduleItem = ContentItem & {
  batchSubjectId?: string | undefined;
  subjectId?: string | undefined;
  endTime?: string | undefined;
  status?: string | undefined;
  tag?: string | undefined;
  type?: string | undefined;
  isVideoLecture?: boolean | undefined;
};


type RawScheduleItem = { type?: string; _id?: string; data?: Record<string, unknown> };

/** Today's schedule ships items wrapped as { type, data }; flatten to a usable shape. */
function normalizeSchedule(raw: RawScheduleItem[] | null | undefined): ScheduleItem[] {
  return (raw ?? []).map((entry) => {
    const d = (entry.data ?? {}) as Record<string, unknown>;
    const subject = d["subjectId"] as { _id?: string } | string | undefined;
    return {
      ...(d as unknown as ScheduleItem),
      _id: (d["_id"] as string) ?? entry._id ?? "",
      type: entry.type,
      subjectId: typeof subject === "string" ? subject : subject?._id,
    };
  });
}

export const todaysScheduleQuery = (batchId: string) => ({
  queryKey: ["todays-schedule", batchId],
  queryFn: async () =>
    normalizeSchedule(await contentGet<RawScheduleItem[]>(`v2/batches/${batchId}/todays-schedule`)),
  staleTime: 60 * 1000,
});


export const scheduleDetailsQuery = (batchSlug: string, subjectSlug: string, scheduleId: string) => ({
  queryKey: ["schedule-details", batchSlug, subjectSlug, scheduleId],
  queryFn: () =>
    contentGet<ScheduleDetails>(
      `v1/batches/${batchSlug}/subject/${subjectSlug}/schedule/${scheduleId}/schedule-details`,
    ),
  staleTime: 5 * 60 * 1000,
});


/** Resolves an attachment to its absolute file URL, or null when the source has none. */
export function attachmentUrl(a: Attachment | undefined | null): string | null {
  if (!a?.baseUrl || !a?.key) return null;
  const base = a.baseUrl.endsWith("/") ? a.baseUrl : `${a.baseUrl}/`;
  const key = a.key.replace(/^\/+/, "");
  return `${base}${key}`;
}

/* ------------------------------------------------------------- playback */

export const STREAM_API = "https://pw-stream.pages.dev/api/video-url";
export const PLAYER_ORIGIN = "https://pw-player2.ai.studio";

/** In-app watch page path for a lecture / DPP video. */
export function buildWatchPath(input: { batchId: string; subjectId: string; scheduleId: string }) {
  const params = new URLSearchParams({
    batchId: input.batchId,
    subjectId: input.subjectId,
    scheduleId: input.scheduleId,
  });
  return `/watch?${params.toString()}`;
}

/** Resolves the HLS (m3u8) stream URL for a schedule item. */
export async function fetchStreamUrl(input: {
  batchId: string;
  subjectId: string;
  scheduleId: string;
}): Promise<string> {
  const params = new URLSearchParams(input as unknown as Record<string, string>);
  const res = await fetch(`${STREAM_API}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const hls =
    (json?.["HLS_STREAM_URL"] as string | undefined) ??
    (json?.["hls_url"] as string | undefined) ??
    null;
  if (!hls) throw new ContentError("Stream isn't available for this lecture yet.", res.status || 502);
  return hls;
}

export const streamUrlQuery = (input: { batchId: string; subjectId: string; scheduleId: string }) => ({
  queryKey: ["stream-url", input.batchId, input.subjectId, input.scheduleId],
  queryFn: () => fetchStreamUrl(input),
  staleTime: 60 * 1000,
  retry: 1,
});

export function buildPlayerEmbedUrl(m3u8: string) {
  return `${PLAYER_ORIGIN}/?url=${encodeURIComponent(m3u8)}`;
}



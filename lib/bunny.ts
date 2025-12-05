const BUNNY_ANALYTICS_URL = process.env.BUNNY_ANALYTICS_URL;
const BUNNY_ANALYTICS_KEY = process.env.BUNNY_ANALYTICS_API_KEY;
const BUNNY_STORAGE_BASE = process.env.BUNNY_STORAGE_API_BASE;
const BUNNY_STORAGE_KEY = process.env.BUNNY_STORAGE_ACCESS_KEY;

export type BunnyAnalyticsEntry = {
  Path?: string;
  BytesSent?: number;
  Bytes?: number;
  SentBytes?: number;
  RequestCount?: number;
  Hits?: number;
};

export async function fetchCdnSummaryLastHour(): Promise<BunnyAnalyticsEntry[]> {
  if (!BUNNY_ANALYTICS_URL || !BUNNY_ANALYTICS_KEY) {
    console.warn("Bunny analytics env not configured; skipping CDN billing fetch.");
    return [];
  }

  const now = new Date();
  const from = new Date(now.getTime() - 60 * 60 * 1000);
  const url = new URL(BUNNY_ANALYTICS_URL);
  url.searchParams.set("from", from.toISOString());
  url.searchParams.set("to", now.toISOString());

  const response = await fetch(url.toString(), {
    headers: {
      AccessKey: BUNNY_ANALYTICS_KEY,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    console.error("Failed to fetch Bunny analytics", await response.text());
    return [];
  }

  try {
    const data = (await response.json()) as unknown;
    if (Array.isArray(data)) return data as BunnyAnalyticsEntry[];
    if (data && typeof data === "object") {
      const maybeItems = (data as { items?: unknown }).items;
      if (Array.isArray(maybeItems)) return maybeItems as BunnyAnalyticsEntry[];
    }
    return [];
  } catch (error) {
    console.error("Failed to parse Bunny analytics response", error);
    return [];
  }
}

export async function deleteUserStorage(uidToken: string) {
  if (!BUNNY_STORAGE_BASE || !BUNNY_STORAGE_KEY) {
    console.warn("Bunny storage env not configured; skipping purge for", uidToken);
    return;
  }

  const target = `${BUNNY_STORAGE_BASE.replace(/\/$/, "")}/${uidToken}`;
  const response = await fetch(target, {
    method: "DELETE",
    headers: {
      AccessKey: BUNNY_STORAGE_KEY,
    },
  });

  if (!response.ok) {
    console.error("Failed to purge Bunny storage for", uidToken, await response.text());
  }
}

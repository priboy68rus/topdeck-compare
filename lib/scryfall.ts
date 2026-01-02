import fs from "fs/promises";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import path from "path";
import { pipeline } from "stream/promises";
import { parser as jsonParser } from "stream-json";
import { streamArray } from "stream-json/streamers/StreamArray";
import { cleanCardName } from "./names";
import { log } from "./logger";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_PATH = path.join(DATA_DIR, "scryfall-default-cards.json");
const META_PATH = path.join(DATA_DIR, "scryfall-default-cards.meta.json");
const BULK_META_URL = "https://api.scryfall.com/bulk-data/default_cards";
const USE_API_MODE = process.env.SCRYFALL_MODE === "api";
const RESOLVER_URL = process.env.ORACLE_RESOLVER_URL;

interface ScryfallBulkMeta {
  object: string;
  id: string;
  type: string;
  updated_at: string;
  download_uri: string;
}

interface ScryfallCard {
  oracle_id?: string;
  name?: string;
  printed_name?: string;
  lang?: string;
  released_at?: string;
  finishes?: string[];
  promo?: boolean;
  frame_effects?: string[];
  full_art?: boolean;
  set_type?: string;
  border_color?: string;
  booster?: boolean;
  frame?: string;
  set?: string;
  games?: string[];
  prices?: { eur?: string | null };
  image_uris?: Record<string, string>;
  card_faces?: { image_uris?: Record<string, string> }[];
}

interface StoredMeta {
  updatedAt: string;
  downloadedAt: string;
}

type OracleResolver = (name: string) => string | undefined;
interface OracleData {
  oracleId?: string;
  imageUrls: string[];
  eurPrice?: number;
}

let resolverPromise: Promise<OracleResolver> | null = null;
const oracleImages = new Map<string, string[]>();
const oraclePrices = new Map<string, number>();
const apiNameCache = new Map<string, OracleData>();
const resolverMisses = new Set<string>();

const resolverKey = (name: string) => cleanCardName(name);

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readStoredMeta(): Promise<StoredMeta | null> {
  if (!(await fileExists(META_PATH))) {
    return null;
  }
  try {
    const raw = await fs.readFile(META_PATH, "utf8");
    return JSON.parse(raw) as StoredMeta;
  } catch {
    return null;
  }
}

async function fetchBulkMeta(): Promise<ScryfallBulkMeta> {
  const response = await fetch(BULK_META_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch Scryfall metadata (${response.status})`);
  }
  return (await response.json()) as ScryfallBulkMeta;
}

async function downloadBulkData(downloadUri: string, updatedAt: string) {
  const response = await fetch(downloadUri, { cache: "no-store" });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Scryfall data (${response.status})`);
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  const out = createWriteStream(DATA_PATH, { encoding: "utf8" });
  const arrayStreamer = streamArray();
  let first = true;
  let wroteAny = false;

  arrayStreamer.on("data", ({ value }: { value: any }) => {
    const slim = {
      oracle_id: value.oracle_id,
      name: value.name,
      printed_name: value.printed_name,
      games: value.games,
      finishes: value.finishes,
      frame_effects: value.frame_effects,
      full_art: value.full_art,
      promo: value.promo,
      set_type: value.set_type,
      set: value.set,
      border_color: value.border_color,
      frame: value.frame,
      prices: { eur: value.prices?.eur ?? null },
      image_uris: value.image_uris,
      card_faces: value.card_faces
    };
    out.write((first ? "[" : ",") + JSON.stringify(slim));
    first = false;
    wroteAny = true;
  });

  const readable = response.body ? (Readable.fromWeb(response.body as any) as any) : null;
  if (!readable) {
    throw new Error("No response body while downloading Scryfall data");
  }

  await pipeline(readable as any, jsonParser() as any, arrayStreamer as any);
  if (wroteAny) {
    out.write("]");
  } else {
    out.write("[]");
  }
  out.end();

  const meta: StoredMeta = {
    updatedAt,
    downloadedAt: new Date().toISOString()
  };
  await fs.writeFile(META_PATH, JSON.stringify(meta, null, 2), "utf8");
}

async function ensureDataUpToDate() {
  const localMeta = await readStoredMeta();
  let remoteMeta: ScryfallBulkMeta | null = null;

  try {
    remoteMeta = await fetchBulkMeta();
  } catch (error) {
    if (!(await fileExists(DATA_PATH))) {
      throw error instanceof Error ? error : new Error("Unable to fetch Scryfall metadata.");
    }
    // If we cannot reach Scryfall but have a local copy, continue using it.
    return;
  }

  const needsDownload =
    !(await fileExists(DATA_PATH)) ||
    !localMeta ||
    new Date(remoteMeta.updated_at).getTime() >
      new Date(localMeta.updatedAt).getTime();

  if (needsDownload) {
    log("info", "Updating Scryfall bulk data", { updatedAt: remoteMeta.updated_at });
    await downloadBulkData(remoteMeta.download_uri, remoteMeta.updated_at);
  }
}

async function loadCards(): Promise<ScryfallCard[]> {
  await ensureDataUpToDate();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw) as ScryfallCard[];
  return data;
}

function buildResolver(cards: ScryfallCard[]): OracleResolver {
  const map = new Map<string, string>();
  const buckets = new Map<string, ScryfallCard[]>();

  const hasNonFoil = (card: ScryfallCard) => (card.finishes ?? []).includes("nonfoil");
  const hasSpecialFrame = (card: ScryfallCard) => {
    const effects = card.frame_effects ?? [];
    return effects.some((effect) =>
      ["extendedart", "showcase", "borderless", "etched", "inverted", "retro"].includes(effect)
    );
  };
  const isWhiteBorder = (card: ScryfallCard) => card.border_color === "white";
  const frameWeight = (card: ScryfallCard) => {
    switch (card.frame) {
      case "1993":
        return 1;
      case "1997":
        return 2;
      case "2003":
        return 3;
      case "2015":
        return 4;
      case "future":
        return 5;
      default:
        return 0;
    }
  };
  const setWeight = (card: ScryfallCard) => {
    if (card.set === "sld") return 0;
    if (card.set_type === "promo" || card.set_type === "token") {
      return 0;
    }
    return 1;
  };
  const printWeight = (card: ScryfallCard) => {
    let weight = 0;
    if ((card.finishes ?? []).includes("nonfoil")) weight += 3;
    if (hasSpecialFrame(card)) weight -= 2;
    if (card.full_art) weight -= 2;
    if (card.promo || card.set_type === "promo") weight -= 3;
    if (card.set === "sld") weight -= 5;
    if (isWhiteBorder(card)) weight -= 4;
    const games = card.games ?? [];
    const isPaper = games.includes("paper");
    const isArenaOnly = games.length > 0 && games.every((g) => g === "arena" || g === "mtgo");
    if (isPaper) weight += 4;
    if (isArenaOnly) weight -= 6;
    weight += setWeight(card) * 2;
    return weight;
  };

  const imagesForCard = (card: ScryfallCard): string[] => {
    const images: string[] = [];
    if (card.card_faces?.length) {
      card.card_faces.forEach((face) => {
        const uri = face.image_uris?.normal || face.image_uris?.large;
        if (uri) images.push(uri);
      });
      // Some multi-face layouts (e.g., Rooms) have no per-face image_uris; fall back to card image.
      if (images.length === 0) {
        const fallback = card.image_uris?.normal || card.image_uris?.large;
        if (fallback) images.push(fallback);
      }
    } else {
      const uri = card.image_uris?.normal || card.image_uris?.large;
      if (uri) images.push(uri);
    }
    return images;
  };

  const releaseTs = (card: ScryfallCard) =>
    card.released_at ? Date.parse(card.released_at) : 0;

  for (const card of cards) {
    if (!card.oracle_id) continue;
    const bucket = buckets.get(card.oracle_id) ?? [];
    bucket.push(card);
    buckets.set(card.oracle_id, bucket);

    const names = new Set<string>();
    if (card.name) names.add(card.name);
    if (card.printed_name) names.add(card.printed_name);
    card.card_faces?.forEach((face: any) => {
      if (face?.name) names.add(face.name);
      if (face?.printed_name) names.add(face.printed_name);
    });

    names.forEach((name) => {
      const key = resolverKey(name);
      if (key) {
        map.set(key, card.oracle_id!);
      }
    });
  }

  // Choose the best image per oracle: prefer non-foil, non-promo, non-special frames, latest printing.
  buckets.forEach((cardsForOracle, oracleId) => {
    const sorted = cardsForOracle.sort((a, b) => {
      const printDiff = printWeight(b) - printWeight(a);
      if (printDiff !== 0) return printDiff;
      const setDiff = setWeight(b) - setWeight(a);
      if (setDiff !== 0) return setDiff;
      const releaseDiff = releaseTs(b) - releaseTs(a);
      if (releaseDiff !== 0) return releaseDiff;
      return frameWeight(b) - frameWeight(a);
    });
    const preferred = sorted.find((card) => imagesForCard(card).length > 0);
    const images = preferred ? imagesForCard(preferred) : [];
    if (images.length > 0) {
      oracleImages.set(oracleId, images);
    }

    const priced = sorted.find((card) => {
      const raw = card.prices?.eur;
      return raw !== null && raw !== undefined && raw !== "";
    });
    if (priced?.prices?.eur) {
      const parsed = Number.parseFloat(priced.prices.eur);
      if (Number.isFinite(parsed)) {
        oraclePrices.set(oracleId, parsed);
      }
    }
  });

  return (name: string) => map.get(resolverKey(name));
}

export async function getOracleResolver(): Promise<OracleResolver> {
  if (USE_API_MODE) {
    // In API mode we resolve names on demand; the resolver is a passthrough.
    return (name: string) => name;
  }
  if (!resolverPromise) {
    resolverPromise = (async () => {
      const cards = await loadCards();
      return buildResolver(cards);
    })();
  }
  return resolverPromise;
}

export async function getOracleImageUrl(oracleId: string): Promise<string | undefined> {
  if (USE_API_MODE) {
    const match = [...apiNameCache.values()].find((entry) => entry.oracleId === oracleId);
    return match?.imageUrls[0];
  }
  if (!resolverPromise) {
    await getOracleResolver();
  } else {
    await resolverPromise;
  }
  return (oracleImages.get(oracleId) ?? [])[0];
}

export async function getOracleImageUrls(oracleId: string): Promise<string[]> {
  if (USE_API_MODE) {
    const match = [...apiNameCache.values()].find((entry) => entry.oracleId === oracleId);
    return match?.imageUrls ?? [];
  }
  if (!resolverPromise) {
    await getOracleResolver();
  } else {
    await resolverPromise;
  }
  return oracleImages.get(oracleId) ?? [];
}

export async function getOraclePriceEur(oracleId: string): Promise<number | undefined> {
  if (USE_API_MODE) {
    const match = [...apiNameCache.values()].find((entry) => entry.oracleId === oracleId);
    return match?.eurPrice;
  }
  if (!resolverPromise) {
    await getOracleResolver();
  } else {
    await resolverPromise;
  }
  return oraclePrices.get(oracleId);
}

function extractJsonFromJina(markdown: string): string {
  const marker = "```json";
  const start = markdown.indexOf(marker);
  if (start !== -1) {
    const after = markdown.indexOf("```", start + marker.length);
    if (after !== -1) {
      return markdown.slice(start + marker.length, after).trim();
    }
  }
  const fallbackMarker = "Markdown Content:";
  const idx = markdown.indexOf(fallbackMarker);
  if (idx !== -1) {
    return markdown.slice(idx + fallbackMarker.length).trim();
  }
  return markdown.trim();
}

async function fetchJsonWithFallback(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      return res.json();
    }
  } catch (error) {
    log("warn", "Primary Scryfall fetch failed, trying proxy", { url, error: String(error) });
  }

  const proxyUrl = `https://r.jina.ai/${url}`;
  const proxyRes = await fetch(proxyUrl, { cache: "no-store" });
  if (!proxyRes.ok) {
    throw new Error(`Failed to fetch Scryfall data (${proxyRes.status})`);
  }
  const text = await proxyRes.text();
  const cleaned = extractJsonFromJina(text);
  return JSON.parse(cleaned);
}

function extractImagesFromCard(card: ScryfallCard): string[] {
  const images: string[] = [];
  if (card.card_faces?.length) {
    card.card_faces.forEach((face) => {
      const uri = face.image_uris?.normal || face.image_uris?.large;
      if (uri) images.push(uri);
    });
    // Some multi-face layouts have only a single shared image.
    if (images.length === 0) {
      const fallback = card.image_uris?.normal || card.image_uris?.large;
      if (fallback) images.push(fallback);
    }
  } else {
    const uri = card.image_uris?.normal || card.image_uris?.large;
    if (uri) images.push(uri);
  }
  return images;
}

async function fetchCardFromApi(searchName: string): Promise<ScryfallCard | null> {
  const fetchCard = async (url: string) => {
    try {
      const data = await fetchJsonWithFallback(url);
      if (data.object === "card") return data as ScryfallCard;
      if (data.object === "list" && Array.isArray(data.data) && data.data.length > 0) {
        return data.data[0] as ScryfallCard;
      }
    } catch (error) {
      log("warn", "Scryfall API fetch failed", { url, error: String(error) });
    }
    return null;
  };

  const namedUrl = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(searchName)}`;
  let card = await fetchCard(namedUrl);

  const needsPaper =
    !card || (card.games && card.games.length > 0 && !card.games.includes("paper"));
  if (needsPaper) {
    const searchUrl = `https://api.scryfall.com/cards/search?order=released&dir=desc&q=${encodeURIComponent(
      `!"${searchName}" game:paper`
    )}&unique=prints`;
    card = await fetchCard(searchUrl);
  }
  return card;
}

export async function getOracleData(name: string): Promise<OracleData> {
  const key = name.trim();

  // If external resolver is configured, prefer it.
  if (RESOLVER_URL) {
    if (key && apiNameCache.has(key)) {
      return apiNameCache.get(key)!;
    }
    const url = `${RESOLVER_URL.replace(/\/$/, "")}/resolve?name=${encodeURIComponent(name)}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Resolver responded ${res.status}`);
      }
      const data = (await res.json()) as OracleData;
      const payload: OracleData = {
        oracleId: data.oracleId,
        imageUrls: data.imageUrls ?? [],
        eurPrice: data.eurPrice
      };
      if (key) apiNameCache.set(key, payload);
      return payload;
    } catch (error) {
      log("warn", "External resolver failed, falling back to local", {
        error: String(error)
      });
      // continue to local resolution below
    }
  }

  if (!USE_API_MODE) {
    const resolver = await getOracleResolver();
    const oracleId = resolver(name);
    const imageUrls = oracleId ? await getOracleImageUrls(oracleId) : [];
    const eurPrice = oracleId ? await getOraclePriceEur(oracleId) : undefined;
    return { oracleId: oracleId || undefined, imageUrls, eurPrice };
  }

  if (key && apiNameCache.has(key)) {
    return apiNameCache.get(key)!;
  }

  const card = await fetchCardFromApi(name);
  if (!card) {
    const fallback: OracleData = { oracleId: undefined, imageUrls: [], eurPrice: undefined };
    if (key) apiNameCache.set(key, fallback);
    return fallback;
  }

  const imageUrls = extractImagesFromCard(card);
  const eurPrice = card.prices?.eur ? Number.parseFloat(card.prices.eur) : undefined;
  const result: OracleData = {
    oracleId: card.oracle_id,
    imageUrls,
    eurPrice
  };
  if (key) apiNameCache.set(key, result);
  return result;
}

export async function primeOracleData(names: string[]): Promise<void> {
  if (!RESOLVER_URL) return;
  resolverMisses.clear();
  const unique = Array.from(new Set(names.filter(Boolean)));
  const missing = unique.filter((n) => {
    const cached = apiNameCache.get(n);
    if (!cached) return true;
    if (cached.oracleId === undefined) {
      apiNameCache.delete(n);
      return true;
    }
    return false;
  });
  if (missing.length === 0) return;

  try {
    const url = `${RESOLVER_URL.replace(/\/$/, "")}/resolve-batch`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        names: missing
      }),
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`Batch resolver responded ${res.status}`);
    const payload = (await res.json()) as { results?: Array<OracleData & { name?: string }> };
    const resultMap = new Map<string, OracleData>();
    payload.results?.forEach((item) => {
      const key = item.name ? item.name.trim() : undefined;
      if (!key) return;
      resultMap.set(key, {
        oracleId: item.oracleId,
        imageUrls: item.imageUrls ?? [],
        eurPrice: item.eurPrice
      });
    });

    missing.forEach((name) => {
      const entry = resultMap.get(name);
      if (entry) {
        apiNameCache.set(name, entry);
      } else {
        resolverMisses.add(name);
        apiNameCache.set(name, { oracleId: undefined, imageUrls: [], eurPrice: undefined });
      }
    });
  } catch (error) {
    log("warn", "Batch resolver failed", { error: String(error) });
  }
}

export function getResolverMissCount(): number {
  return resolverMisses.size;
}

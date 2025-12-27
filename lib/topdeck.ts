import { load } from "cheerio";
import { log } from "./logger";

export interface TopdeckListingEntry {
  name: string;
  price: number;
  quantity?: number;
  rawLine: string;
}

type CacheEntry = {
  data: TopdeckListingEntry[];
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function parsePriceString(value: string): number | null {
  const normalized = value.replace(/[^\d.,]/g, "").replace(/\s/g, "");
  const withDot = normalized.replace(",", ".");
  const parsed = Number.parseFloat(withDot);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanName(raw: string): string {
  return raw
    .replace(/^[•\-\u2013\u2014\s]+/, "")
    .replace(/^\d+\s*[xX]?\s+/, "")
    .replace(/\s+[xX]?\d+\s*$/, "")
    .replace(/\s*\([^)]+\)\s*$/,"")
    .trim();
}

function pickContent(html: string): string {
  const $ = load(html);
  const selectors = [
    ".cPost_contentWrap",
    ".ipsType_richText",
    ".entry-content",
    ".cPost_contentInner",
    "article",
    "body"
  ];

  for (const selector of selectors) {
    const candidate = $(selector).first();
    if (candidate.length > 0) {
      const text = candidate.text().trim();
      if (text.length > 0) {
        return text;
      }
    }
  }

  return $("body").text();
}

function parseListingText(text: string): TopdeckListingEntry[] {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/•/g, "\n")
    .replace(/\u00a0/g, " ");

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: TopdeckListingEntry[] = [];

  for (const line of lines) {
    const numberMatches = [...line.matchAll(/[0-9][0-9\s.,]*/g)];
    if (numberMatches.length === 0) {
      continue;
    }

    const currencyMatch = line.match(/([0-9][0-9\s.,]*)\s*руб/i);
    const priceSource = currencyMatch ? currencyMatch[1] : numberMatches[numberMatches.length - 1][0];
    const priceIndex = currencyMatch?.index ?? numberMatches[numberMatches.length - 1].index ?? line.length;
    const price = parsePriceString(priceSource);
    if (price === null) {
      continue;
    }

    const before = line.slice(0, priceIndex).replace(/[-–—:]+$/, "").trim();
    const after = line.slice(priceIndex + priceSource.length).trim();
    const name = cleanName(before || after);

    if (!name) {
      continue;
    }

    let quantity: number | undefined;
    const firstMatch = numberMatches[0];
    const firstValue = firstMatch ? parsePriceString(firstMatch[0]) : null;
    if (firstMatch && firstMatch.index === 0 && firstValue !== null) {
      quantity = Math.round(firstValue);
    }

    entries.push({
      name,
      price,
      quantity,
      rawLine: line
    });
  }

  return entries;
}

export async function fetchTopdeckListing(
  url: string
): Promise<TopdeckListingEntry[]> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.expiresAt > now) {
    log("debug", "Topdeck cache hit", { url });
    return cached.data;
  }

  log("info", "Fetching Topdeck page", { url });
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TopdeckCompare/1.0)"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Topdeck page (${response.status})`);
  }

  const html = await response.text();
  const content = pickContent(html);

  const parsed = parseListingText(content);
  log("info", "Parsed Topdeck listings", { url, count: parsed.length });
  cache.set(url, { data: parsed, expiresAt: now + CACHE_TTL_MS });

  return parsed;
}

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
  title: string;
  author?: string;
  authorId?: string;
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const setCodes = new Set<string>();
let setCodesLoaded = false;

async function ensureSetCodes() {
  if (setCodesLoaded) return;
  try {
    const res = await fetch("https://api.scryfall.com/sets", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch sets: ${res.status}`);
    const payload = (await res.json()) as { data?: Array<{ code?: string }> };
    payload.data?.forEach((set) => {
      if (set.code) setCodes.add(set.code.toUpperCase());
    });
    setCodesLoaded = true;
  } catch (error) {
    log("warn", "Failed to load set codes, falling back to built-in list", {
      error: String(error)
    });
    ["MH2", "ICE", "DOM", "RVR", "LTR", "MH3", "SNC", "MOM", "2X2"].forEach((c) =>
      setCodes.add(c)
    );
    setCodesLoaded = true;
  }
}

function parsePriceString(value: string): number | null {
  const normalized = value.replace(/[^\d.,]/g, "").replace(/\s/g, "");
  const withDot = normalized.replace(",", ".");
  const parsed = Number.parseFloat(withDot);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanName(raw: string): string {
  const modifierTokens = new Set(
    [
      "NM",
      "SP",
      "MP",
      "HP",
      "LP",
      "EX",
      "PLD",
      "PO",
      "PR",
      "PRO",
      "PRM",
      "MPS",
      "MSC",
      "MS2",
      "DE",
      "EN",
      "RU",
      "FR",
      "GE",
      "IT",
      "JP",
      "KR",
      "CN",
      "PT",
      "ES",
      "FOIL",
      "FNM",
      "ICE",
      "MIR",
      "LEG",
      "BORDERLESS",
      "EXTENDED",
      "ETCHED",
      "GOLDBORDER",
      "SHOWCASE",
      "RETRO",
      "ALT",
      "SIGNED",
      "STAMPED",
      "ARENA",
      "MTGO"
    ].map((t) => t.toUpperCase())
  );

  const pre = raw
    .replace(/^[•\-\u2013\u2014\s]+/, "")
    .replace(/^\d+\s*[xX]?\s+/, "")
    .replace(/\s+[xX]?\d+\s*$/, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[-–—:]+$/, "")
    .trim();

  const tokens = pre.split(/\s+/).filter(Boolean);
  const filtered = tokens.filter((token) => {
    let upper = token.toUpperCase();
    // Normalize Cyrillic lookalikes (e.g., 2Х2 -> 2X2)
    upper = upper.replace(/\u0425|\u0445/g, "X");
    if (modifierTokens.has(upper)) return false;
    if (setCodes.has(upper)) return false;
    return true;
  });

  return filtered.join(" ");
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
): Promise<{
  entries: TopdeckListingEntry[];
  title: string;
  author: string;
  authorId: string;
}> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.expiresAt > now) {
    log("debug", "Topdeck cache hit", { url });
    return {
      entries: cached.data,
      title: cached.title,
      author: cached.author || "",
      authorId: cached.authorId || ""
    };
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
  await ensureSetCodes();
  const content = pickContent(html);
  const $ = load(html);
  const title =
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    url;

  const author =
    $(".cAuthorPane_author.ipsType_break").first().text().trim() ||
    $(".ipsType_blendLinks.ipsType_normal").find("a").first().text().trim() ||
    "";
  const profileHref =
    $(".cAuthorPane_photo a").attr("href") ||
    $(".ipsType_blendLinks.ipsType_normal").find("a").attr("href") ||
    "";
  const authorIdMatch = profileHref.match(/profile\/(\d+)/i);
  const authorId = authorIdMatch ? authorIdMatch[1] : "";

  const parsed = parseListingText(content);
  log("info", "Parsed Topdeck listings", { url, count: parsed.length });
  cache.set(url, {
    data: parsed,
    title,
    author,
    authorId,
    expiresAt: now + CACHE_TTL_MS
  });

  return { entries: parsed, title, author, authorId };
}

import { log } from "./logger";
export interface DeckCard {
  name: string;
  quantity: number;
  tags: string[];
}

export function parseMoxfieldDeckId(urlString: string): string | null {
  try {
    const parsed = new URL(urlString);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] !== "decks") {
      return null;
    }
    return parts[1] || null;
  } catch (error) {
    return null;
  }
}

function mergeCards(cards: DeckCard[], name: string, quantity: number, tags: string[]) {
  const existing = cards.find(
    (card) => card.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    existing.quantity += quantity;
    existing.tags = Array.from(new Set([...existing.tags, ...tags]));
  } else {
    cards.push({ name, quantity, tags });
  }
}

function extractJsonFromJina(markdown: string): string {
  const marker = "Markdown Content:";
  const index = markdown.indexOf(marker);
  if (index === -1) {
    return markdown.trim();
  }
  return markdown.slice(index + marker.length).trim();
}

async function fetchDeckJson(deckId: string) {
  const target = `https://api2.moxfield.com/v3/decks/all/${deckId}`;
  const proxyUrl = `https://r.jina.ai/${target}`;

  const response = await fetch(proxyUrl, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Moxfield deck (${response.status})`);
  }

  const body = await response.text();
  const jsonPayload = extractJsonFromJina(body);
  try {
    return JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error("Unexpected Moxfield response format");
  }
}

export async function fetchMoxfieldWishlist(deckUrl: string): Promise<{
  deckName: string;
  author?: string;
  cards: DeckCard[];
}> {
  const deckId = parseMoxfieldDeckId(deckUrl);
  if (!deckId) {
    throw new Error("Invalid Moxfield deck URL");
  }

  log("info", "Fetching Moxfield deck", { deckId });
  const { DeckListSchema } = await import("moxfield-api");
  const deck = DeckListSchema.parse(await fetchDeckJson(deckId));

  const cards: DeckCard[] = [];
  const boards = deck.boards ?? {};

  const tagMap: Record<string, string[]> = (deck as { tags?: Record<string, string[]> }).tags ?? {};
  const taggedCards: Record<string, string[]> =
    (deck as { taggedCards?: Record<string, string[]> }).taggedCards ?? {};
  const authorTags: Record<string, string[]> =
    (deck as { authorTags?: Record<string, string[]> }).authorTags ?? {};

  Object.entries(boards).forEach(([boardName, board]) => {
    if (!board || typeof board !== "object") {
      return;
    }

    // Skip tokens to avoid cluttering the wishlist.
    if (boardName === "tokens") {
      return;
    }

    Object.values(board.cards ?? {}).forEach((entry: any) => {
      const name = entry.card?.name || entry.name;
      const quantity = entry.quantity ?? 1;
      const tags = name
        ? (entry as { tags?: string[] }).tags ||
          tagMap[name] ||
          taggedCards[name] ||
          authorTags[name] ||
          []
        : [];
      if (!name) {
        return;
      }
      mergeCards(cards, name, quantity, tags);
    });
  });

  log("info", "Parsed Moxfield wishlist", { deckId, cards: cards.length });
  return {
    deckName: deck.name || deckId,
    author:
      (deck as { createdByUser?: { userName?: string; displayName?: string } }).createdByUser
        ?.displayName ||
      (deck as { createdByUser?: { userName?: string; displayName?: string } }).createdByUser
        ?.userName ||
      deck.createdBy ||
      deck.user?.userName ||
      deck.userName,
    cards
  };
}

import Link from "next/link";
import { fetchMoxfieldWishlist } from "../../lib/moxfield";
import { fetchTopdeckListing, TopdeckListingEntry } from "../../lib/topdeck";
import { normalizeForMatching } from "../../lib/names";
import { getOracleData, primeOracleData } from "../../lib/scryfall";
import { CardRow } from "./ResultsTable";
import CopyListingsButton from "./CopyListingsButton";
import ResultsView from "./ResultsView";

interface ComparePageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

interface CardComparison {
  name: string;
  oracleId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  tags: string[];
  quantity: number;
  listings: (TopdeckListingEntry & { oracleId?: string })[];
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const moxfieldUrl =
    typeof searchParams?.moxfieldUrl === "string"
      ? searchParams.moxfieldUrl
      : "";
  const topdeckUrl =
    typeof searchParams?.topdeckUrl === "string"
      ? searchParams.topdeckUrl
      : "";

  if (!moxfieldUrl || !topdeckUrl) {
    return (
      <main>
        <div className="card">
          <h1>Missing links</h1>
          <p>Please provide both a Moxfield wishlist URL and a Topdeck forum URL.</p>
          <Link href="/" className="pill">
            Go back
          </Link>
        </div>
      </main>
    );
  }

  let comparisons: CardComparison[] = [];
  let deckName = "Wishlist";
  let fetchError: string | null = null;

  try {
    const [moxfield, topdeckEntries] = await Promise.all([
      fetchMoxfieldWishlist(moxfieldUrl),
      fetchTopdeckListing(topdeckUrl)
    ]);

    const allNames = [
      ...moxfield.cards.map((c) => c.name),
      ...topdeckEntries.map((t) => t.name)
    ];
    await primeOracleData(allNames);

    deckName = moxfield.deckName;

    const listingMap = new Map<string, (TopdeckListingEntry & { oracleId?: string })[]>();
    const makeKey = (oracleId: string | undefined, name: string): string | null => {
      if (oracleId) return `oracle:${oracleId}`;
      const normalized = normalizeForMatching(name);
      return normalized ? `name:${normalized}` : null;
    };

    const topdeckWithOracle = await Promise.all(
      topdeckEntries.map(async (entry) => {
        const data = await getOracleData(entry.name);
        const normalized = normalizeForMatching(entry.name);
        return { ...entry, oracleId: data.oracleId, normalizedName: normalized };
      })
    );

    topdeckWithOracle.forEach((entry) => {
      const keys = [
        makeKey(entry.oracleId, entry.name),
        entry.normalizedName ? `name:${entry.normalizedName}` : null
      ].filter(Boolean) as string[];
      keys.forEach((key) => {
        const listings = listingMap.get(key) ?? [];
        listings.push(entry);
        listingMap.set(key, listings);
      });
    });

    const mapped = await Promise.all(
      moxfield.cards.map(async (card) => {
        const data = await getOracleData(card.name);
        const oracleKey = makeKey(data.oracleId, card.name);
        const nameKey = `name:${normalizeForMatching(card.name)}`;
        const listings =
          (oracleKey && listingMap.get(oracleKey)) ||
          listingMap.get(nameKey) ||
          [];
        return {
          name: card.name,
          oracleId: data.oracleId,
          imageUrl: data.imageUrls[0],
          imageUrls: data.imageUrls,
          eurPrice: data.eurPrice,
          quantity: card.quantity,
          tags: card.tags ?? [],
          listings
        };
      })
    );

    comparisons = mapped.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    fetchError =
      error instanceof Error ? error.message : "Failed to fetch the provided URLs.";
  }

  const listedCount = comparisons.filter((card) => card.listings.length > 0).length;
  const unresolvedCount = comparisons.filter((card) => !card.oracleId).length;
  const rows: CardRow[] = comparisons.map((card) => ({
    name: card.name,
    oracleId: card.oracleId,
    imageUrl: card.imageUrl,
    imageUrls: card.imageUrls,
    tags: card.tags,
    eurPrice: card.eurPrice,
    wishlistQty: card.quantity,
    listings: card.listings
  }));

  return (
    <main>
      <div className="card">
        <div className="header-row">
          <div>
            <h1>Comparison</h1>
            <p className="muted">
              Checking cards from <strong>{deckName}</strong> against the Topdeck listing.
            </p>
          </div>
          <div className="inline-actions">
            <Link href="/" className="pill">
              ← New search
            </Link>
            <a href={moxfieldUrl} className="pill" target="_blank" rel="noreferrer">
              Moxfield
            </a>
            <a href={topdeckUrl} className="pill" target="_blank" rel="noreferrer">
              Topdeck
            </a>
          </div>
        </div>

        {fetchError ? (
          <div className="card" style={{ marginTop: 12, background: "#1e293b" }}>
            <h2>Something went wrong</h2>
            <p className="muted">{fetchError}</p>
            <p className="muted">Double-check the URLs and try again.</p>
          </div>
        ) : (
          <>
            <div className="inline-actions" style={{ marginTop: 12, marginBottom: 6 }}>
              <span className="pill">
                Total cards: <strong>{comparisons.length}</strong>
              </span>
              <span className="pill">
                Listed on Topdeck: <strong>{listedCount}</strong>
              </span>
              <span className="pill">
                Unresolved names: <strong>{unresolvedCount}</strong>
              </span>
              <CopyListingsButton rows={rows} />
            </div>

            <ResultsView rows={rows} />
          </>
        )}
      </div>
    </main>
  );
}

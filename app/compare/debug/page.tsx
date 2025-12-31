import Link from "next/link";
import { fetchTopdeckListing } from "../../../lib/topdeck";
import { getOracleData, primeOracleData } from "../../../lib/scryfall";
import { normalizeForMatching } from "../../../lib/names";

interface DebugPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function DebugPage({ searchParams }: DebugPageProps) {
  const topdeckUrl =
    typeof searchParams?.topdeckUrl === "string"
      ? searchParams.topdeckUrl
      : "";

  if (!topdeckUrl) {
    return (
      <main>
        <div className="card">
          <h1>Listing Debug</h1>
          <p className="muted">Provide a Topdeck URL to inspect parsed lines.</p>
          <Link href="/" className="pill">
            ← Home
          </Link>
        </div>
      </main>
    );
  }

  try {
    const { entries, title } = await fetchTopdeckListing(topdeckUrl);
    const names = entries
      .map((entry) => normalizeForMatching(entry.name) || entry.name)
      .filter(Boolean);
    if (names.length) {
      await primeOracleData(names);
    }
    const resolved = await Promise.all(
      entries.map(async (entry) => {
        const normalizedName = normalizeForMatching(entry.name) || entry.name;
        const oracle = normalizedName ? await getOracleData(normalizedName) : { oracleId: undefined };
        return { ...entry, oracleId: oracle.oracleId };
      })
    );

    return (
      <main>
        <div className="card">
          <h1>Listing Debug</h1>
          <p className="muted">
            Showing parsed lines for <strong>{title || topdeckUrl}</strong>
          </p>
          <div className="inline-actions" style={{ marginBottom: 12 }}>
            <Link href="/" className="pill">
              ← New search
            </Link>
            <Link
              href={`/compare?topdeckUrl=${encodeURIComponent(topdeckUrl)}`}
              className="pill"
            >
              ← Back to compare
            </Link>
            <a href={topdeckUrl} className="pill" target="_blank" rel="noreferrer">
              Open Topdeck
            </a>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "35%" }}>Raw line</th>
                  <th style={{ width: "30%" }}>Parsed name</th>
                  <th style={{ width: "10%" }}>Price</th>
                  <th style={{ width: "10%" }}>Quantity</th>
                  <th style={{ width: "15%" }}>Oracle ID</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((entry, idx) => (
                  <tr key={idx}>
                    <td style={{ whiteSpace: "pre-wrap" }}>{entry.rawLine}</td>
                    <td>{entry.name}</td>
                    <td>{entry.price ?? "—"}</td>
                    <td>{entry.quantity ?? "—"}</td>
                    <td>{entry.oracleId || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse listing.";
    return (
      <main>
        <div className="card">
          <h1>Listing Debug</h1>
          <p className="muted">Topdeck URL: {topdeckUrl}</p>
          <p className="muted">Error: {message}</p>
          <Link href="/" className="pill">
            ← Home
          </Link>
        </div>
      </main>
    );
  }
}

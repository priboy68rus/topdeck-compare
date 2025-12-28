"use client";

import { useState, useMemo } from "react";
import ResultsTable, { CardRow } from "./ResultsTable";
import ResultsGallery from "./ResultsGallery";
import ResultsFull from "./ResultsFull";

type ViewMode = "table" | "gallery" | "full";

export default function ResultsView({ rows }: { rows: CardRow[] }) {
  const [view, setView] = useState<ViewMode>("table");
  const [onlyListed, setOnlyListed] = useState(false);
  const [eurToRub, setEurToRub] = useState(90);
  const [useTags, setUseTags] = useState(true);
  const [showCart, setShowCart] = useState(false);

  const filteredRows = useMemo(
    () => (onlyListed ? rows.filter((r) => r.listings.length > 0) : rows),
    [onlyListed, rows]
  );

  const rowsWithRate = useMemo(
    () =>
      filteredRows.map((row) => ({
        ...row,
        eurToRub
      })),
    [filteredRows, eurToRub]
  );

  const totalTopdeckRub = useMemo(() => {
    return filteredRows.reduce((sum, row) => {
      if (!row.listings.length) return sum;
      const cheapest = Math.min(...row.listings.map((l) => l.price));
      return sum + cheapest * row.wishlistQty;
    }, 0);
  }, [filteredRows]);

  const sortedRows = useMemo(() => {
    if (!useTags) {
      return [...rowsWithRate].sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...rowsWithRate].sort((a, b) => {
      const tagA = (a.tags?.[0] || "").toLowerCase();
      const tagB = (b.tags?.[0] || "").toLowerCase();
      if (tagA !== tagB) return tagA.localeCompare(tagB);
      return a.name.localeCompare(b.name);
    });
  }, [rowsWithRate, useTags]);

  return (
    <div>
      <div className="inline-actions actions-row" style={{ marginBottom: 12, gap: 12 }}>
        <div className="segmented" style={{ height: 38 }}>
          <button
            type="button"
            className={`compact ${view === "table" ? "active" : ""}`}
            onClick={() => setView("table")}
          >
            Table
          </button>
          <button
            type="button"
            className={`compact ${view === "gallery" ? "active" : ""}`}
            onClick={() => setView("gallery")}
          >
            Gallery
          </button>
          <button
            type="button"
            className={`compact ${view === "full" ? "active" : ""}`}
            onClick={() => setView("full")}
          >
            Full
          </button>
        </div>
        <button
          type="button"
          className={`compact ${onlyListed ? "" : "button-secondary"}`}
          onClick={() => setOnlyListed((prev) => !prev)}
        >
          {onlyListed ? "Show all" : "Only listed"}
        </button>
          <label className="rate-input">
            <span>EUR→RUB</span>
            <input
              type="number"
              step="0.1"
              value={eurToRub}
              onChange={(e) => setEurToRub(Number(e.target.value) || 0)}
            />
          </label>
        <label className="rate-input">
          <input
            type="checkbox"
            checked={useTags}
            onChange={(e) => setUseTags(e.target.checked)}
          />
          <span>Use tags</span>
        </label>
        <label className="rate-input">
          <input
            type="checkbox"
            checked={showCart}
            onChange={(e) => setShowCart(e.target.checked)}
          />
          <span>Show cart</span>
        </label>
      </div>
      {view === "table" ? (
        <ResultsTable rows={sortedRows} useTags={useTags} showCart={showCart} />
      ) : view === "gallery" ? (
        <ResultsGallery rows={sortedRows} useTags={useTags} />
      ) : (
        <ResultsFull rows={sortedRows} useTags={useTags} />
      )}
    </div>
  );
}

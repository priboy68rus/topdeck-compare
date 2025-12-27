"use client";

import { useMemo, useState } from "react";
import { CardRow } from "./ResultsTable";

function formatNumber(value?: number, fraction = 0) {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction
  }).format(value);
}

function ListingRow({ entry }: { entry: CardRow["listings"][number] }) {
  return (
    <div className="full-listing-row">
      <div className="status listed">
        {entry.quantity && Number.isFinite(entry.quantity) ? `${entry.quantity}x` : "—"} @{" "}
        {formatNumber(entry.price, 0)} ₽
      </div>
      <div className="listing-raw">{entry.rawLine}</div>
    </div>
  );
}

function ImageBox({ row }: { row: CardRow }) {
  const images = row.imageUrls && row.imageUrls.length > 0 ? row.imageUrls : [row.imageUrl].filter(Boolean) as string[];
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];
  const hasMultiple = images.length > 1;

  const next = () => {
    if (!hasMultiple) return;
    setIndex((prev) => (prev + 1) % images.length);
  };

  return (
    <div className="full-image-box">
      {hasMultiple && (
        <button type="button" className="chip-button" onClick={next}>
          ⟳
        </button>
      )}
      {current ? <img src={current} alt={row.name} /> : <span className="muted">No image</span>}
    </div>
  );
}

export default function ResultsFull({ rows, useTags }: { rows: CardRow[]; useTags: boolean }) {
  const data = useMemo(() => rows, [rows]);

  return (
    <div className="full-list">
      {data.map((row) => {
        const listingQty = row.listings.reduce((sum, l) => sum + (l.quantity ?? 0), 0);
        return (
          <div className="full-card" key={row.name}>
            <div className="full-card-header">
              <div>
                <div className="gallery-name">{row.name}</div>
                {useTags && row.tags?.length ? (
                  <div className="pill" style={{ width: "fit-content", padding: "4px 8px", fontSize: "0.85rem" }}>
                    {row.tags[0]}
                  </div>
                ) : null}
              </div>
              <div className="full-meta">
                <span>Wishlist: {row.wishlistQty}</span>
                <span>Topdeck qty: {listingQty || "—"}</span>
                <span>Scryfall €: {formatNumber(row.eurPrice, 2)}</span>
                <span>
                  Scryfall ₽:{" "}
                  {row.eurPrice && row.eurToRub
                    ? formatNumber(row.eurPrice * row.eurToRub, 0)
                    : "—"}
                </span>
              </div>
            </div>
            <div className="full-body">
              <ImageBox row={row} />
              <div className="full-details">
                {row.listings.length ? (
                  row.listings.map((entry, idx) => <ListingRow key={idx} entry={entry} />)
                ) : (
                  <div className="status missing">Not listed</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

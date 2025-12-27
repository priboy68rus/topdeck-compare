"use client";

import { useState } from "react";
import { CardRow } from "./ResultsTable";

function ListingChip({ text, rawLine }: { text: string; rawLine: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="listing-chip"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="listing-chip-price">{text}</span>
      {hover && (
        <div className="hover-card listing-tooltip">
          <div className="muted" style={{ fontSize: "0.9rem" }}>
            {rawLine}
          </div>
        </div>
      )}
    </div>
  );
}

function summarizeListings(listings: CardRow["listings"]) {
  return listings.map((entry) => {
    const qty =
      entry.quantity && Number.isFinite(entry.quantity) ? `${entry.quantity}x ` : "";
    return `${qty}${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(entry.price)} ₽`;
  });
}

export default function ResultsGallery({ rows, useTags }: { rows: CardRow[]; useTags: boolean }) {
  return (
    <div className="gallery-grid">
      {rows.map((row) => (
        <GalleryCard key={row.name} row={row} useTags={useTags} />
      ))}
    </div>
  );
}

function GalleryCard({ row, useTags }: { row: CardRow; useTags: boolean }) {
  const listingQty = row.listings.reduce(
    (sum, entry) => sum + (entry.quantity ?? 0),
    0
  );
  const summaries = summarizeListings(row.listings);
  const images = row.imageUrls && row.imageUrls.length > 0 ? row.imageUrls : [row.imageUrl].filter(Boolean) as string[];
  const [index, setIndex] = useState(0);
  const currentImage = images[index] ?? images[0];

  const nextImage = () => {
    if (images.length <= 1) return;
    setIndex((prev) => (prev + 1) % images.length);
  };

  return (
    <div className="gallery-card">
      <div className="gallery-image">
        {images.length > 1 && (
          <div className="gallery-controls">
            <button type="button" className="chip-button" onClick={nextImage}>
              ⟳
            </button>
          </div>
        )}
        {currentImage ? <img src={currentImage} alt={row.name} /> : <span className="muted">No image</span>}
      </div>
      <div className="gallery-body">
        <div className="gallery-name">{row.name}</div>
        {useTags && row.tags?.length ? (
          <div className="pill" style={{ width: "fit-content", padding: "4px 8px", fontSize: "0.85rem" }}>
            {row.tags[0]}
          </div>
        ) : null}
        <div className="gallery-meta">
          <span>Wishlist: {row.wishlistQty}</span>
          <span>Topdeck: {listingQty || "—"}</span>
        </div>
        <div className="gallery-listings">
          {row.listings.length ? (
            row.listings.map((entry, idx) => (
              <ListingChip key={idx} text={summaries[idx]} rawLine={entry.rawLine} />
            ))
          ) : (
            <span className="status missing">Not listed</span>
          )}
        </div>
      </div>
    </div>
  );
}

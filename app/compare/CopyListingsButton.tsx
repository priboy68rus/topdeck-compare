"use client";

import { useState } from "react";
import { CardRow } from "./ResultsTable";

function replaceQuantity(rawLine: string, quantity: number): string {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return rawLine;
  }
  const trimmed = rawLine.trimStart();
  const match = trimmed.match(/^\d+/);
  if (match) {
    const start = trimmed.slice(match[0].length).trimStart();
    return `${quantity} ${start}`;
  }
  return `${quantity} ${trimmed}`;
}

export default function CopyListingsButton({ rows }: { rows: CardRow[] }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const handleCopy = async () => {
    const lines = rows
      .filter((row) => row.listings.length > 0)
      .map((row) => {
        const sorted = [...row.listings].sort((a, b) => a.price - b.price);
        const line = sorted[0]?.rawLine ?? "";
        return replaceQuantity(line, row.wishlistQty);
      })
      .filter(Boolean);

    if (lines.length === 0) {
      setStatus("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (error) {
      console.error("Failed to copy", error);
      setStatus("error");
    }
  };

  return (
    <>
      <button type="button" className="compact" onClick={handleCopy}>
        Copy Topdeck listings
      </button>
      {status === "copied" && (
        <div className="toast toast-floating">Copied to clipboard!</div>
      )}
      {status === "error" && (
        <div className="toast toast-floating error">Nothing to copy</div>
      )}
    </>
  );
}

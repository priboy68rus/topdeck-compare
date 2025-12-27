"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable
} from "@tanstack/react-table";
import React, { useMemo, useState } from "react";
import { TopdeckListingEntry } from "../../lib/topdeck";

export interface CardRow {
  name: string;
  oracleId?: string;
  wishlistQty: number;
  imageUrl?: string;
  imageUrls?: string[];
  eurPrice?: number;
  tags?: string[];
  eurToRub?: number;
  listings: (TopdeckListingEntry & { oracleId?: string })[];
}

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

function NameCell({
  name,
  unresolved,
  imageUrl,
  oracleId,
  imageUrls
}: {
  name: string;
  unresolved: boolean;
  imageUrl?: string;
  oracleId?: string;
  imageUrls?: string[];
}) {
  const [hover, setHover] = useState(false);
  const scryfallUrl = oracleId
    ? `https://scryfall.com/search?q=oracleid%3A${oracleId}`
    : `https://scryfall.com/search?q=${encodeURIComponent(name)}`;
  return (
    <div
      className="name-cell"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <a href={scryfallUrl} target="_blank" rel="noreferrer" className="name-link">
        {name}
      </a>
      {unresolved && (
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          Unresolved name (fallback match)
        </span>
      )}
      {hover && (imageUrls?.length || imageUrl) && (
        <div className="hover-card">
          <div className="image-strip">
            {(imageUrls && imageUrls.length > 0 ? imageUrls : [imageUrl]).map(
              (url, idx) =>
                url && (
                  <img
                    key={idx}
                    src={url}
                    alt={name}
                    className="card-image"
                  />
                )
            )}
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

export default function ResultsTable({ rows, useTags }: { rows: CardRow[]; useTags: boolean }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: useTags ? "tag" : "name", desc: false }
  ]);
  React.useEffect(() => {
    setSorting([{ id: useTags ? "tag" : "name", desc: false }]);
  }, [useTags]);

  const columns = useMemo<ColumnDef<CardRow>[]>(
    () =>
      [
        {
          id: "name",
          header: "Card",
          accessorKey: "name",
          cell: (ctx) => (
            <NameCell
              name={ctx.getValue<string>()}
              unresolved={!ctx.row.original.oracleId}
              imageUrl={ctx.row.original.imageUrl}
              imageUrls={ctx.row.original.imageUrls}
              oracleId={ctx.row.original.oracleId}
            />
          )
        },
        ...(useTags
          ? [
              {
                id: "tag",
                header: "Tag",
                accessorFn: (row: CardRow) => row.tags?.[0] ?? "",
                size: 120
              } as ColumnDef<CardRow>
            ]
          : []),
        {
          id: "wishlistQty",
          header: "Wishlist qty",
          accessorKey: "wishlistQty",
          size: 120
        },
        {
          id: "topdeckQty",
          header: "Topdeck qty",
          accessorFn: (row) =>
            row.listings.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0),
          size: 120,
          cell: (ctx) => {
            const qty = ctx.getValue<number>();
            return qty > 0 ? qty : "—";
          }
        },
        {
          id: "eurPrice",
          header: "Scryfall €",
          accessorKey: "eurPrice",
          size: 120,
          cell: (ctx) => {
            const value = ctx.getValue<number | undefined>();
            if (!value) return "—";
            return new Intl.NumberFormat("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }).format(value);
          }
        },
        {
          id: "rubPrice",
          header: "Scryfall ₽",
          accessorFn: (row) =>
            row.eurPrice && row.eurToRub ? row.eurPrice * row.eurToRub : undefined,
          size: 120,
          cell: (ctx) => {
            const value = ctx.getValue<number | undefined>();
            if (!value) return "—";
            return new Intl.NumberFormat("en-US", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(value);
          }
        },
        {
          id: "listings",
          header: "Topdeck listings",
          accessorKey: "listings",
          enableSorting: false,
          cell: (ctx) => {
            const listings = ctx.getValue<CardRow["listings"]>();
            if (!listings.length) {
              return <div className="status missing">Not listed</div>;
            }
            const summaries = summarizeListings(listings);
            return (
              <div className="status listed" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                <div>Listed ({summaries.length})</div>
                <div className="listing-list">
                  {listings.map((entry, idx) => (
                    <ListingChip key={idx} text={summaries[idx]} rawLine={entry.rawLine} />
                  ))}
                </div>
              </div>
            );
          }
        }
      ],
    [useTags]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{
                    asc: " ↑",
                    desc: " ↓"
                  }[header.column.getIsSorted() as string] ?? null}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, idx, allRows) => {
            const tagLabel = useTags ? row.original.tags?.[0] || "Untagged" : null;
            const prevTag =
              useTags && idx > 0 ? allRows[idx - 1].original.tags?.[0] || "Untagged" : null;
            const showTagHeader = useTags && tagLabel !== prevTag;

            return (
              <React.Fragment key={row.id}>
                {showTagHeader && (
                  <tr className="tag-divider">
                    <td colSpan={row.getVisibleCells().length}>
                      <strong>{tagLabel}</strong>
                    </td>
                  </tr>
                )}
                <tr>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

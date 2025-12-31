export function sanitizeListingName(raw: string): string {
  return raw
    // drop bullets/qty at start
    .replace(/^[\s•\-\u2013\u2014\d+xX]+/, "")
    // drop trailing price segments (e.g., "- 123" or "- 123 руб")
    .replace(/\s*[-\u2013\u2014]\s*\d[\d\s.,]*(?:\s*руб)?\s*$/i, "")
    // remove set/condition parentheses
    .replace(/\([^)]*\)/g, "")
    // remove common condition/foil markers
    .replace(/\b(NM|SP|MP|HP|LP|EX|promo|foil)\b/gi, "")
    // collapse commas/spaces
    .replace(/,+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

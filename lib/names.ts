export function normalizeCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9/]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isQualifier(token: string): boolean {
  const lower = token.toLowerCase();
  const descriptor =
    lower === "foil" ||
    lower === "etched" ||
    lower === "nonfoil" ||
    lower === "alt" ||
    lower === "promo" ||
    lower === "prerelease" ||
    lower === "signed";

  const language =
    lower === "en" ||
    lower === "eng" ||
    lower === "ru" ||
    lower === "rus" ||
    lower === "jp" ||
    lower === "ja" ||
    lower === "de" ||
    lower === "fr" ||
    lower === "es" ||
    lower === "it" ||
    lower === "pt" ||
    lower === "cn" ||
    lower === "ko";

  const setCode = /^[A-Z]{2,4}\d?$/.test(token);

  return descriptor || language || setCode;
}

export function normalizeForMatching(name: string): string {
  const tokens = name.split(/\s+/);
  while (tokens.length > 0 && isQualifier(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return normalizeCardName(tokens.join(" "));
}

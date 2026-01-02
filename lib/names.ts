export function cleanCardName(name: string): string {
  const tokens = name.split(/\s+/).filter(Boolean);

  while (tokens.length > 0) {
    const token = tokens[tokens.length - 1];
    const lower = token.toLowerCase();

    const isDescriptor =
      lower === "foil" ||
      lower === "etched" ||
      lower === "nonfoil" ||
      lower === "alt" ||
      lower === "promo" ||
      lower === "prerelease" ||
      lower === "signed";

    const isLanguage =
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

    const isSetCode = /^[A-Z]{2,4}\d?$/.test(token);

    if (isDescriptor || isLanguage || isSetCode) {
      tokens.pop();
      continue;
    }
    break;
  }

  return tokens
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

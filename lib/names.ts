export function cleanCardName(name: string): string {
  const tokens = name.split(/\s+/).filter(Boolean);

  while (tokens.length > 0) {
    const token = tokens[tokens.length - 1];
    const lower = token.toLowerCase();
    const normalized = lower.replace(/[^\p{L}\p{N}]+/gu, "");

    const isDescriptor =
      normalized === "foil" ||
      normalized === "etched" ||
      normalized === "nonfoil" ||
      normalized === "alt" ||
      normalized === "promo" ||
      normalized === "list" ||
      normalized === "plist" ||
      normalized === "plst" ||
      normalized === "prerelease" ||
      normalized === "signed" ||
      normalized === "фойл" ||
      normalized === "фоил" ||
      normalized === "фуларт" ||
      normalized === "фулларт" ||
      normalized === "промо" ||
      normalized === "подпись" ||
      normalized === "подписано";

    const isLanguage =
      normalized === "en" ||
      normalized === "eng" ||
      normalized === "ru" ||
      normalized === "rus" ||
      normalized === "рус" ||
      normalized === "русский" ||
      normalized === "англ" ||
      normalized === "jp" ||
      normalized === "ja" ||
      normalized === "de" ||
      normalized === "fr" ||
      normalized === "es" ||
      normalized === "it" ||
      normalized === "pt" ||
      normalized === "cn" ||
      normalized === "ko";

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
    .replace(/[^\p{L}\p{N}/]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

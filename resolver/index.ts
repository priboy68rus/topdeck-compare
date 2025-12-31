import http from "http";
import { getOracleData } from "../lib/scryfall";

const PORT = Number(process.env.RESOLVER_PORT || 4000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function sanitizeName(raw: string): string {
  return raw
    // drop bullets/qty at start
    .replace(/^[\s•\-\u2013\u2014\d+xX]+/, "")
    // drop trailing price segments
    .replace(/\s*[-\u2013\u2014]\s*\d[\d\s.,]*(?:\s*руб)?\s*$/i, "")
    // remove set/condition parentheses
    .replace(/\([^)]*\)/g, "")
    // remove condition/foil keywords
    .replace(/\b(NM|SP|MP|HP|LP|EX|promo|foil)\b/gi, "")
    // collapse commas/spaces
    .replace(/,+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: "Bad request" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  console.log(`[resolver] ${req.method} ${req.url}`);

  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/resolve") {
    const rawName = url.searchParams.get("name");
    if (!rawName) {
      sendJson(res, 400, { error: "Missing name query param" });
      return;
    }
    const name = sanitizeName(rawName);
    if (!name) {
      sendJson(res, 400, { error: "Empty name after sanitization" });
      return;
    }

    try {
      const data = await getOracleData(name);
      sendJson(res, 200, data);
    } catch (error) {
      console.error("Resolver error", error);
      sendJson(res, 500, { error: "Failed to resolve card" });
    }
    return;
  }

  if (url.pathname === "/resolve-batch" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body || "{}") as { names?: string[] };
        const names = Array.from(
          new Set(
            (parsed.names ?? [])
              .map((n) => sanitizeName(n || ""))
              .filter(Boolean)
          )
        );
        const results = await Promise.all(
          names.map(async (name) => {
            const data = await getOracleData(name);
            return { name, ...data };
          })
        );
        const filtered = results.filter((r) => r.oracleId);
        sendJson(res, 200, { results: filtered });
      } catch (error) {
        console.error("Resolver batch error", error);
        sendJson(res, 400, { error: "Invalid batch request" });
      }
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Oracle resolver listening on :${PORT}`);
});

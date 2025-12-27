import http from "http";
import { getOracleData } from "../lib/scryfall";

const PORT = Number(process.env.RESOLVER_PORT || 4000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

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
    const name = url.searchParams.get("name");
    if (!name) {
      sendJson(res, 400, { error: "Missing name query param" });
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
        const names = Array.from(new Set(parsed.names ?? [])).filter(Boolean);
        const results = await Promise.all(
          names.map(async (name) => {
            const data = await getOracleData(name);
            return { name, ...data };
          })
        );
        sendJson(res, 200, { results });
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

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const maxResponseBytes = Math.min(
  Math.max(Number(process.env.MAX_RESPONSE_BYTES) || 50 * 1024 * 1024, 64 * 1024),
  50 * 1024 * 1024
);

app.use(express.json({ limit: "10mb" }));

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

function makeResponseTooLargeError(limitBytes, actualBytes) {
  const error = new Error(
    `Upstream response exceeded ${limitBytes} bytes${actualBytes ? ` (${actualBytes} bytes reported/read)` : ""}.`
  );
  error.code = "RESPONSE_TOO_LARGE";
  error.limitBytes = limitBytes;
  error.actualBytes = actualBytes;
  return error;
}

async function readBodyWithLimit(upstream, limitBytes) {
  const reportedLength = Number(upstream.headers.get("content-length"));
  if (Number.isFinite(reportedLength) && reportedLength > limitBytes) {
    try {
      await upstream.body?.cancel?.();
    } catch {
      /* ignore */
    }
    throw makeResponseTooLargeError(limitBytes, reportedLength);
  }

  if (!upstream.body) {
    return Buffer.alloc(0);
  }

  const chunks = [];
  let total = 0;

  for await (const chunk of upstream.body) {
    const nextChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += nextChunk.byteLength;

    if (total > limitBytes) {
      try {
        await upstream.body.cancel?.();
      } catch {
        /* ignore */
      }
      throw makeResponseTooLargeError(limitBytes, total);
    }

    chunks.push(nextChunk);
  }

  return Buffer.concat(chunks, total);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "post-corith-proxy" });
});

app.post("/api/request", async (req, res) => {
  const startedAt = Date.now();
  const { method, url, headers, body, timeoutMs = 15000 } = req.body ?? {};

  const nextMethod = String(method || "GET").toUpperCase();

  if (!METHODS.has(nextMethod)) {
    return res.status(400).json({ error: `Unsupported method: ${nextMethod}` });
  }

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required." });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "URL is invalid." });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: "Only HTTP(S) URLs are allowed." });
  }

  const requestHeaders = {};
  if (headers && typeof headers === "object") {
    for (const [key, value] of Object.entries(headers)) {
      if (typeof key === "string" && key.trim()) {
        requestHeaders[key] = typeof value === "string" ? value : String(value ?? "");
      }
    }
  }

  const controller = new AbortController();
  const timeout = Math.min(Math.max(Number(timeoutMs) || 15000, 500), 120000);
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const upstream = await fetch(parsedUrl, {
      method: nextMethod,
      headers: requestHeaders,
      body: BODYLESS_METHODS.has(nextMethod) || body == null ? undefined : String(body),
      signal: controller.signal,
      redirect: "follow"
    });

    const buffer = await readBodyWithLimit(upstream, maxResponseBytes);
    const responseBody = buffer.toString("utf8");

    const responseHeaders = {};
    upstream.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const contentType = responseHeaders["content-type"] || "";
    const isJsonType = contentType.includes("application/json") || contentType.includes("+json");

    let parsedJson = null;
    let isJson = false;

    if (responseBody) {
      if (isJsonType) {
        try {
          parsedJson = JSON.parse(responseBody);
          isJson = true;
        } catch {
          isJson = false;
        }
      } else {
        try {
          parsedJson = JSON.parse(responseBody);
          isJson = true;
        } catch {
          isJson = false;
        }
      }
    }

    return res.json({
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
      body: responseBody,
      isJson,
      json: parsedJson,
      sizeBytes: buffer.byteLength,
      elapsedMs: Date.now() - startedAt
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(504).json({ error: `Request timed out after ${timeout}ms.` });
    }

    if (error?.code === "RESPONSE_TOO_LARGE") {
      return res.status(413).json({
        error: error.message,
        limitBytes: error.limitBytes,
        actualBytes: error.actualBytes ?? null
      });
    }

    return res.status(502).json({ error: error?.message || "Upstream request failed." });
  } finally {
    clearTimeout(timer);
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(port, host, () => {
  console.log(`Post Corith proxy listening on http://${host}:${port} (max response ${maxResponseBytes} bytes)`);
});

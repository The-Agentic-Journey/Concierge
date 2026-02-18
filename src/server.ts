import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { processInVM } from "./worker.js";

const app = new Hono();

// Auth middleware
app.use("/ingest/*", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (auth !== `Bearer ${config.authToken}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Main ingest endpoint
app.post("/ingest", async (c) => {
  try {
    const body = await c.req.json();
    const content = body.content;

    if (!content || typeof content !== "string") {
      return c.json({ error: "Missing 'content' field" }, 400);
    }

    if (content.length > 500000) {
      return c.json({ error: "Content too large (max 500KB)" }, 400);
    }

    console.log(`[ingest] Received ${content.length} bytes`);

    const result = await processInVM(content);

    return c.json(result);
  } catch (err) {
    console.error("[ingest] Error:", err);
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      500
    );
  }
});

// Plain text endpoint (für einfaches curl)
app.post("/ingest/text", async (c) => {
  try {
    const content = await c.req.text();

    if (!content) {
      return c.json({ error: "Empty body" }, 400);
    }

    console.log(`[ingest/text] Received ${content.length} bytes`);

    const result = await processInVM(content);

    return c.json(result);
  } catch (err) {
    console.error("[ingest/text] Error:", err);
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      500
    );
  }
});

console.log(`Starting server on port ${config.port}...`);
serve({ fetch: app.fetch, port: config.port });
console.log(`Server running at http://localhost:${config.port}`);

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

const POE_API_KEY = Deno.env.get("POE_API_KEY") ?? "";
const OPENROUTER_API_KEY =
  Deno.env.get("OPENROUTER_API_KEY") ?? "";

function corsHeaders() {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
}

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    const payload = await req.json();
    const model = typeof payload.model === "string" ? payload.model : "";

    // If the model id looks like "provider/model:variant", route to OpenRouter.
    const useOpenRouter = model.includes("/");

    if (useOpenRouter) {
      if (!OPENROUTER_API_KEY) {
        return new Response("Missing OPENROUTER_API_KEY", {
          status: 500,
          headers: corsHeaders(),
        });
      }

      const orResp = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "Lovable Clone",
          },
          body: JSON.stringify(payload),
        },
      );

      const headers = new Headers(corsHeaders());
      const contentType =
        orResp.headers.get("content-type") ?? "application/json";
      headers.set("content-type", contentType);
      headers.set("cache-control", "no-cache");
      headers.set("connection", "keep-alive");

      return new Response(orResp.body, {
        status: orResp.status,
        headers,
      });
    } else {
      if (!POE_API_KEY) {
        return new Response("Missing POE_API_KEY", {
          status: 500,
          headers: corsHeaders(),
        });
      }

      const poeResp = await fetch("https://api.poe.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${POE_API_KEY}`,
          "HTTP-Referer": "http://localhost:8000",
          "X-Title": "Lovable Clone",
        },
        body: JSON.stringify(payload),
      });

      const headers = new Headers(corsHeaders());
      const contentType =
        poeResp.headers.get("content-type") ?? "application/json";
      headers.set("content-type", contentType);
      headers.set("cache-control", "no-cache");
      headers.set("connection", "keep-alive");

      return new Response(poeResp.body, {
        status: poeResp.status,
        headers,
      });
    }
  }

  return serveDir(req, {
    fsRoot: ".",
    urlRoot: "",
    showDirListing: false,
    quiet: true,
  });
}, { port: 8000 });



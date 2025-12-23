import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { streamText, tool } from "https://esm.sh/ai@3.3.12";
import { createOpenAI } from "https://esm.sh/@ai-sdk/openai@0.0.36";
import { z } from "https://esm.sh/zod@3.23.8";

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
    try {
      const payload = await req.json();
      const modelIdRaw = typeof payload.model === "string" ? payload.model : "";
      const modelId = modelIdRaw.trim();
      const messages = Array.isArray(payload.messages) ? payload.messages : [];

      // Decide provider from model id:
      // - If it contains a slash (e.g. "anthropic/claude-3.5-sonnet"), use OpenRouter.
      // - Otherwise (e.g. "claude-3.5-sonnet"), use Poe.
      const useOpenRouter = modelId.includes("/");

      if (useOpenRouter) {
        if (!OPENROUTER_API_KEY) {
          return new Response("Missing OPENROUTER_API_KEY", {
            status: 500,
            headers: corsHeaders(),
          });
        }
      } else {
        if (!POE_API_KEY) {
          return new Response("Missing POE_API_KEY", {
            status: 500,
            headers: corsHeaders(),
          });
        }
      }

      const client = createOpenAI({
        apiKey: useOpenRouter ? OPENROUTER_API_KEY : POE_API_KEY,
        baseURL: useOpenRouter
          ? "https://openrouter.ai/api/v1"
          : "https://api.poe.com/v1",
      });

      // Advertise the run_command tool so the model can request it.
      const runCommandTool = tool({
        name: "run_command",
        description: "Run a shell command in the in-browser WebContainer terminal.",
        parameters: z.object({
          command: z.string().describe(
            "The full shell command to execute, e.g. 'ls -la' or 'npm run dev'.",
          ),
        }),
      });

      const effectiveModel =
        modelId ||
        (useOpenRouter ? "xiaomi/mimo-v2-flash:free" : "essentialai-rnj-1-t");

      const result = await streamText({
        model: client(effectiveModel),
        messages,
        tools: { run_command: runCommandTool },
        maxTokens: 1024,
      });

      const sdkResp = result.toAIStreamResponse();
      const headers = new Headers(corsHeaders());
      // Preserve SDK headers
      sdkResp.headers.forEach((v, k) => headers.set(k, v));
      headers.set("cache-control", "no-cache");
      headers.set("connection", "keep-alive");

      return new Response(sdkResp.body, {
        status: sdkResp.status || 200,
        headers,
      });
    } catch (err) {
      return new Response(`Server error: ${err?.message || String(err)}`, {
        status: 500,
        headers: corsHeaders(),
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



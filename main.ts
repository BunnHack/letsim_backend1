import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { streamText, convertToCoreMessages } from "npm:ai";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { z } from "npm:zod";

const OPENROUTER_API_KEY =
  Deno.env.get("OPENROUTER_API_KEY") ??
  "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";

const POE_API_KEY = Deno.env.get("POE_API_KEY") ?? "";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
});

const poe = createOpenAI({
  baseURL: "https://api.poe.com/v1",
  apiKey: POE_API_KEY,
});

function corsHeaders() {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-vercel-ai-data-stream",
  });
}

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    try {
      const { messages, model } = await req.json();
      const modelId = typeof model === "string" ? model : "gpt-3.5-turbo";
      const useOpenRouter = modelId.includes("/");

      if (!useOpenRouter && !POE_API_KEY) {
        throw new Error("Missing POE_API_KEY");
      }

      const languageModel = useOpenRouter ? openrouter(modelId) : poe(modelId);

      const result = await streamText({
        model: languageModel,
        messages: convertToCoreMessages(messages),
        tools: {
          run_command: {
            description: "Run a shell command inside the in-browser WebContainer terminal.",
            parameters: z.object({
              command: z.string().describe("The full shell command to execute, for example: 'ls -la', 'npm test', or 'cat package.json'."),
            }),
          },
        },
      });

      return result.toDataStreamResponse({
        headers: {
          ...Object.fromEntries(corsHeaders()),
        }
      });
    } catch (error) {
      console.error("Chat error:", error);
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: {
          ...Object.fromEntries(corsHeaders()),
          "Content-Type": "application/json"
        }
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


